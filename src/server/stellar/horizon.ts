import { env, USDC_ASSET_ISSUER_VALUE } from '@/server/config/env';
import type { SplitAsset } from '@/server/db/schema/splits';
import { toStroops } from '@/server/lib/amount';
import { AppError } from '@/server/lib/http';

const HORIZON = env.STELLAR_HORIZON_URL;

type PaymentOp = {
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
};

export type ExpectedLine = { address: string; amount: string };

/**
 * Verify a REAL on-chain split: the transaction `txHash` must be successful,
 * sourced from `from`, and contain — for every expected line — a payment of the
 * right asset/amount to that recipient address. We read amounts from Horizon and
 * never trust the client. Returns nothing on success; throws on any mismatch.
 */
export async function verifySplitTransaction(
  txHash: string,
  asset: SplitAsset,
  from: string,
  lines: ExpectedLine[],
): Promise<void> {
  const txRes = await fetch(`${HORIZON}/transactions/${txHash}`);
  if (txRes.status === 404) {
    throw new AppError('NOT_FOUND', 'Transaction not found on Stellar testnet yet', 404);
  }
  if (!txRes.ok) throw new AppError('INTERNAL', `Horizon error ${txRes.status}`, 502);
  const tx = (await txRes.json()) as { successful?: boolean; source_account?: string };
  if (tx.successful === false) throw new AppError('CONFLICT', 'Transaction failed on-chain', 409);

  const opsRes = await fetch(`${HORIZON}/transactions/${txHash}/operations?limit=100`);
  if (!opsRes.ok) throw new AppError('INTERNAL', `Horizon error ${opsRes.status}`, 502);
  const opsJson = (await opsRes.json()) as { _embedded?: { records?: PaymentOp[] } };
  const ops = (opsJson._embedded?.records ?? []).filter(
    (op) => op.type === 'payment' || op.type === 'createAccount',
  );

  const assetMatches = (op: PaymentOp): boolean => {
    if (asset === 'XLM') return op.asset_type === 'native' || op.type === 'createAccount';
    return op.asset_code === 'USDC' && op.asset_issuer === USDC_ASSET_ISSUER_VALUE;
  };

  for (const line of lines) {
    const match = ops.find(
      (op) =>
        op.to === line.address &&
        op.from === from &&
        assetMatches(op) &&
        op.amount != null &&
        toStroops(op.amount) === toStroops(line.amount),
    );
    if (!match) {
      throw new AppError(
        'INVALID_INPUT',
        `On-chain payment of ${line.amount} to ${line.address.slice(0, 6)}… not found in this transaction`,
        400,
      );
    }
  }
}
