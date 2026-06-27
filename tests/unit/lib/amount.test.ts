import { describe, expect, it } from 'vitest';
import { allocateByShares, fromStroops, STROOPS, toStroops } from '@/server/lib/amount';

describe('amount conversion', () => {
  it('round-trips whole and fractional amounts', () => {
    expect(toStroops('1')).toBe(STROOPS);
    expect(toStroops('1.5')).toBe(15_000_000n);
    expect(fromStroops(15_000_000n)).toBe('1.5');
    expect(fromStroops(toStroops('123.4567891'))).toBe('123.4567891');
  });

  it('clamps to 7 decimal places', () => {
    expect(toStroops('0.00000009')).toBe(0n);
    expect(toStroops('0.0000001')).toBe(1n);
  });

  it('handles separators and empty input', () => {
    expect(toStroops('1,000')).toBe(1000n * STROOPS);
    expect(toStroops('')).toBe(0n);
  });
});

describe('allocateByShares', () => {
  it('splits exactly with no drift', () => {
    const total = toStroops('1000');
    const parts = allocateByShares(total, [50, 30, 20]);
    expect(parts.map(fromStroops)).toEqual(['500', '300', '200']);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(total);
  });

  it('pushes rounding remainder to the last recipient', () => {
    const total = toStroops('100'); // 1,000,000,000 stroops
    const parts = allocateByShares(total, [33, 33, 34]);
    // sum must always equal the total exactly
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(total);
  });

  it('handles a tiny indivisible amount without losing stroops', () => {
    const total = 1n; // 0.0000001
    const parts = allocateByShares(total, [50, 50]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(total);
  });
});
