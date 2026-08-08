import { describe, expect, it } from 'vitest';
import { computeLines } from '@/server/lib/splitMath';

const recs = [
  { label: 'Family', address: 'GA'.padEnd(56, 'A'), sharePct: 50 },
  { label: 'Savings', address: 'GB'.padEnd(56, 'B'), sharePct: 30 },
  { label: 'Spending', address: 'GC'.padEnd(56, 'C'), sharePct: 20 },
];

describe('computeLines', () => {
  it('allocates a paycheck across recipient shares', () => {
    const lines = computeLines('1000', recs);
    expect(lines.map((l) => l.amount)).toEqual(['500', '300', '200']);
    expect(lines[0].label).toBe('Family');
  });

  it('keeps the sum equal to the total even with rounding', () => {
    const lines = computeLines('100', [
      { ...recs[0], sharePct: 33 },
      { ...recs[1], sharePct: 33 },
      { ...recs[2], sharePct: 34 },
    ]);
    const sum = lines.reduce((a, l) => a + Number(l.amount), 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it('rejects a zero paycheck', () => {
    expect(() => computeLines('0', recs)).toThrow();
  });
});
