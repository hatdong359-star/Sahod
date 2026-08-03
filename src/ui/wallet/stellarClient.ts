'use client';

import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
import {
  Asset,
  BASE_FEE,
  Horizon,
  Memo,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { publicEnv } from '@/server/config/env.public';
import type { AssetCode } from '@/ui/lib/format';

const PASSPHRASE = publicEnv.networkPassphrase; // PINNED to the app network, not the wallet's.

function server() {
  return new Horizon.Server(publicEnv.horizonUrl);
}

function assetFor(code: AssetCode): Asset {
  return code === 'XLM' ? Asset.native() : new Asset(publicEnv.usdcCode, publicEnv.usdcIssuer);
}

export class WalletError extends Error {}

export async function ensureFreighter(): Promise<void> {
  const res = await isConnected();
  if (!res.isConnected) {
    throw new WalletError(
      'Freighter wallet not detected. Install the Freighter extension to connect.',
    );
  }
}

export async function requestPublicKey(): Promise<string> {
  const res = await requestAccess();
  if (res.error || !res.address) {
    throw new WalletError(res.error?.message ?? 'Wallet connection was rejected.');
  }
  return res.address;
}

/** Sign an XDR with Freighter, pinning the passphrase to the app network. */
export async function sign(xdr: string, address: string): Promise<string> {
  const res = await signTransaction(xdr, { networkPassphrase: PASSPHRASE, address });
  if (res.error || !res.signedTxXdr) {
    throw new WalletError(res.error?.message ?? 'Signing was rejected in the wallet.');
  }
  return res.signedTxXdr;
}

async function loadAccount(pubkey: string) {
  try {
    return await server().loadAccount(pubkey);
  } catch {
    throw new WalletError(
      'Your wallet is not funded on testnet yet. Fund it with the Friendbot, then try again.',
    );
  }
}

async function submit(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE);
  try {
    const res = await server().submitTransaction(tx);
    return res.hash;
  } catch (e: unknown) {
    const codes = (
      e as { response?: { data?: { extras?: { result_codes?: { operations?: string[] } } } } }
    )?.response?.data?.extras?.result_codes;
    const ops = codes?.operations ?? [];
    if (ops.includes('op_no_trust')) {
      throw new WalletError(
        'A recipient has no USDC trustline. Pay in XLM, or ask them to enable USDC.',
      );
    }
    if (ops.includes('op_no_destination')) {
      throw new WalletError('A recipient account does not exist on testnet yet.');
    }
    if (ops.includes('op_underfunded')) {
      throw new WalletError('Insufficient balance for this paycheck (remember the network fee).');
    }
    throw new WalletError('Stellar rejected the transaction. Check your balance and try again.');
  }
}

export type SplitLine = { address: string; amount: string };

/**
 * Build → sign → submit ONE transaction that pays every recipient at once.
 * Returns the real on-chain transaction hash.
 */
export async function paySplit(params: {
  from: string;
  asset: AssetCode;
  memo: string;
  lines: SplitLine[];
}): Promise<string> {
  const account = await loadAccount(params.from);
  const builder = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * Math.max(1, params.lines.length) * 10).toString(),
    networkPassphrase: PASSPHRASE,
  });
  const asset = assetFor(params.asset);
  for (const line of params.lines) {
    builder.addOperation(
      Operation.payment({ destination: line.address, asset, amount: line.amount }),
    );
  }
  const tx = builder
    .addMemo(Memo.text(params.memo.slice(0, 28)))
    .setTimeout(180)
    .build();

  const signed = await sign(tx.toXDR(), params.from);
  return submit(signed);
}

/** Build → sign → submit a changeTrust so the wallet can hold USDC. */
export async function enableUsdc(from: string): Promise<string> {
  const account = await loadAccount(from);
  const tx = new TransactionBuilder(account, {
    fee: (Number(BASE_FEE) * 10).toString(),
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({ asset: new Asset(publicEnv.usdcCode, publicEnv.usdcIssuer) }),
    )
    .setTimeout(120)
    .build();
  const signed = await sign(tx.toXDR(), from);
  return submit(signed);
}
