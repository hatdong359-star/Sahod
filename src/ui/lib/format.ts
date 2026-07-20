import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type AssetCode = 'XLM' | 'USDC';

const STROOPS = 10_000_000n;

/** Parse a decimal whole-asset string into integer stroops. */
export function toStroops(decimal: string | number): bigint {
  const cleaned = String(decimal).replace(/[, _]/g, '').trim();
  if (cleaned === '' || cleaned === '.') return 0n;
  const neg = cleaned.startsWith('-');
  const [whole, frac = ''] = cleaned.replace(/^-/, '').split('.');
  const fracPadded = (frac + '0000000').slice(0, 7);
  const value = BigInt(whole || '0') * STROOPS + BigInt(fracPadded || '0');
  return neg ? -value : value;
}

/** Render integer stroops back to a trimmed decimal string. */
export function fromStroops(s: bigint): string {
  const neg = s < 0n;
  const abs = neg ? -s : s;
  const whole = abs / STROOPS;
  const frac = (abs % STROOPS).toString().padStart(7, '0').replace(/0+$/, '');
  const out = frac ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${out}` : out;
}

/**
 * Allocate a total decimal amount across percentage shares. Identical algorithm
 * to the server so the transaction the wallet signs matches what the server
 * re-derives and verifies on-chain. Remainder lands on the last share.
 */
export function allocateShares(total: string, shares: number[]): string[] {
  const totalStroops = toStroops(total);
  const out = shares.map((pct) => (totalStroops * BigInt(pct)) / 100n);
  const distributed = out.reduce((a, b) => a + b, 0n);
  if (out.length > 0) out[out.length - 1] += totalStroops - distributed;
  return out.map(fromStroops);
}

/** Format an amount for display (trims trailing zeros). */
export function fmtAmount(amount: string | number): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
}

export function fmtAsset(amount: string | number, asset: AssetCode): string {
  return `${fmtAmount(amount)} ${asset}`;
}

export function shortKey(key: string, lead = 4, tail = 4): string {
  if (!key) return '';
  if (key.length <= lead + tail + 1) return key;
  return `${key.slice(0, lead)}…${key.slice(-tail)}`;
}

export function explorerTx(hash: string, network = 'testnet'): string {
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

export function explorerAccount(addr: string, network = 'testnet'): string {
  return `https://stellar.expert/explorer/${network}/account/${addr}`;
}

export function explorerContract(id: string, network = 'testnet'): string {
  return `https://stellar.expert/explorer/${network}/contract/${id}`;
}
