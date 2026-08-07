/** Stellar amounts use 7 decimal places (stroops). */
export const STROOPS = 10_000_000n;

/** Parse a decimal whole-asset string ("100.5") into integer stroops. */
export function toStroops(decimal: string): bigint {
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
 * Split `totalStroops` across `shares` (percent ints that sum to 100).
 * Floor each, then push the rounding remainder to the last recipient so the
 * sum always equals the total exactly.
 */
export function allocateByShares(totalStroops: bigint, shares: number[]): bigint[] {
  const out = shares.map((pct) => (totalStroops * BigInt(pct)) / 100n);
  const distributed = out.reduce((a, b) => a + b, 0n);
  const remainder = totalStroops - distributed;
  if (out.length > 0) out[out.length - 1] += remainder;
  return out;
}
