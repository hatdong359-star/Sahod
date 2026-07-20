import { randomUUID } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { and, desc, eq } from 'drizzle-orm';
import { env } from '@/server/config/env';
import { db } from '@/server/db/client';
import { payoutLines, payoutRuns, recipients, splits } from '@/server/db/schema';
import type { SplitAsset } from '@/server/db/schema/splits';
import { AppError } from '@/server/lib/http';
import { computeLines } from '@/server/lib/splitMath';
import {
  buildPaySplitXdr,
  SALARY_SPLIT_CONTRACT_ID,
  submitSorobanSigned,
  verifySplitTransaction,
} from '@/server/stellar';

export type RecipientInput = { label: string; address: string; sharePct: number };
export { computeLines } from '@/server/lib/splitMath';

function assertRecipients(input: RecipientInput[]): void {
  if (input.length < 2) {
    throw new AppError('INVALID_INPUT', 'Add at least two recipients to split between', 400);
  }
  if (input.length > 20) {
    throw new AppError('INVALID_INPUT', 'A split supports up to 20 recipients', 400);
  }
  for (const r of input) {
    if (!r.label.trim()) throw new AppError('INVALID_INPUT', 'Every recipient needs a label', 400);
    if (!StrKey.isValidEd25519PublicKey(r.address)) {
      throw new AppError('INVALID_INPUT', `"${r.label}" has an invalid Stellar address`, 400);
    }
    if (!Number.isInteger(r.sharePct) || r.sharePct <= 0 || r.sharePct > 100) {
      throw new AppError('INVALID_INPUT', `"${r.label}" needs a share between 1 and 100`, 400);
    }
  }
  const sum = input.reduce((a, r) => a + r.sharePct, 0);
  if (sum !== 100) {
    throw new AppError('INVALID_INPUT', `Shares must total 100% (currently ${sum}%)`, 400);
  }
}

export const splitService = {
  async create(
    publicKey: string,
    data: { name: string; asset: SplitAsset; recipients: RecipientInput[] },
  ) {
    assertRecipients(data.recipients);
    const [split] = await db
      .insert(splits)
      .values({
        publicKey,
        name: data.name.trim(),
        asset: data.asset,
        network: env.STELLAR_NETWORK,
      })
      .returning();
    await db.insert(recipients).values(
      data.recipients.map((r, i) => ({
        splitId: split.id,
        label: r.label.trim(),
        address: r.address,
        sharePct: r.sharePct,
        sortOrder: i,
      })),
    );
    return splitService.getOwned(split.id, publicKey);
  },

  async listByOwner(publicKey: string) {
    const rows = await db
      .select()
      .from(splits)
      .where(eq(splits.publicKey, publicKey))
      .orderBy(desc(splits.createdAt));
    const out = [];
    for (const s of rows) {
      const recs = await db
        .select()
        .from(recipients)
        .where(eq(recipients.splitId, s.id))
        .orderBy(recipients.sortOrder);
      const runCount = await db.select().from(payoutRuns).where(eq(payoutRuns.splitId, s.id));
      out.push({ ...s, recipients: recs, runCount: runCount.length });
    }
    return out;
  },

  async getOwned(id: string, publicKey: string) {
    const [split] = await db
      .select()
      .from(splits)
      .where(and(eq(splits.id, id), eq(splits.publicKey, publicKey)))
      .limit(1);
    if (!split) throw new AppError('NOT_FOUND', 'Split not found', 404);
    const recs = await db
      .select()
      .from(recipients)
      .where(eq(recipients.splitId, id))
      .orderBy(recipients.sortOrder);
    const runs = await db
      .select()
      .from(payoutRuns)
      .where(eq(payoutRuns.splitId, id))
      .orderBy(desc(payoutRuns.createdAt));
    const runsWithLines = [];
    for (const run of runs) {
      const lines = await db.select().from(payoutLines).where(eq(payoutLines.runId, run.id));
      runsWithLines.push({ ...run, lines });
    }
    return { ...split, recipients: recs, runs: runsWithLines };
  },

  async preview(id: string, publicKey: string, total: string) {
    const split = await splitService.getOwned(id, publicKey);
    return { asset: split.asset, lines: computeLines(total, split.recipients) };
  },

  /**
   * Build the UNSIGNED transaction for a split run. XLM (default) goes through
   * the atomic Soroban `pay_split` contract; the server returns the assembled
   * invoke XDR for the payer to sign in Freighter.
   */
  async buildRun(id: string, publicKey: string, total: string) {
    const split = await splitService.getOwned(id, publicKey);
    if (split.recipients.length < 2) {
      throw new AppError('CONFLICT', 'This split needs at least two recipients', 409);
    }
    if (split.asset !== 'XLM') {
      throw new AppError(
        'INVALID_INPUT',
        'USDC splits settle on the classic path, not the contract.',
        400,
      );
    }
    const lines = computeLines(total, split.recipients);
    const runRef = randomUUID();
    const xdr = await buildPaySplitXdr({
      payer: publicKey,
      runRef,
      lines: lines.map((l) => ({ address: l.address, amount: l.amount })),
    });
    return { mode: 'contract' as const, xdr, runRef, lines, contractId: SALARY_SPLIT_CONTRACT_ID };
  },

  /** Submit a payer-signed `pay_split` invoke, then record the run + lines. */
  async submitContractRun(
    id: string,
    publicKey: string,
    data: { signedXdr: string; totalAmount: string },
  ) {
    const split = await splitService.getOwned(id, publicKey);
    if (split.asset !== 'XLM') {
      throw new AppError('INVALID_INPUT', 'Not a contract split.', 400);
    }
    const lines = computeLines(data.totalAmount, split.recipients);
    const txHash = await submitSorobanSigned(data.signedXdr);
    return splitService.persistRun(id, publicKey, {
      asset: split.asset,
      totalAmount: data.totalAmount,
      txHash,
      mode: 'contract',
      lines,
    });
  },

  /** Verify a classic (USDC) on-chain split tx, then record the run + lines. */
  async recordRun(id: string, publicKey: string, data: { txHash: string; totalAmount: string }) {
    const split = await splitService.getOwned(id, publicKey);
    if (split.recipients.length === 0) {
      throw new AppError('CONFLICT', 'This split has no recipients', 409);
    }
    const lines = computeLines(data.totalAmount, split.recipients);
    await verifySplitTransaction(
      data.txHash,
      split.asset,
      publicKey,
      lines.map((l) => ({ address: l.address, amount: l.amount })),
    );
    return splitService.persistRun(id, publicKey, {
      asset: split.asset,
      totalAmount: data.totalAmount,
      txHash: data.txHash,
      mode: 'classic',
      lines,
    });
  },

  async persistRun(
    id: string,
    publicKey: string,
    data: {
      asset: SplitAsset;
      totalAmount: string;
      txHash: string;
      mode: 'contract' | 'classic';
      lines: { label: string; address: string; sharePct: number; amount: string }[];
    },
  ) {
    const existing = await db
      .select()
      .from(payoutRuns)
      .where(eq(payoutRuns.txHash, data.txHash))
      .limit(1);
    if (existing.length > 0) {
      throw new AppError('ALREADY_EXISTS', 'This payout is already recorded', 409);
    }

    const [run] = await db
      .insert(payoutRuns)
      .values({
        splitId: id,
        publicKey,
        asset: data.asset,
        totalAmount: data.totalAmount,
        txHash: data.txHash,
        mode: data.mode,
        network: env.STELLAR_NETWORK,
      })
      .returning();

    await db.insert(payoutLines).values(
      data.lines.map((l) => ({
        runId: run.id,
        label: l.label,
        address: l.address,
        sharePct: l.sharePct,
        amount: l.amount,
      })),
    );

    return { run, lines: data.lines };
  },
};
