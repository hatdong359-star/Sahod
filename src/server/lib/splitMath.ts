import { allocateByShares, fromStroops, toStroops } from './amount';
import { AppError } from './http';

export type ComputedLine = {
  label: string;
  address: string;
  sharePct: number;
  amount: string;
};

/** Allocate a total across recipients; remainder lands on the last line. */
export function computeLines(
  total: string,
  recs: { label: string; address: string; sharePct: number }[],
): ComputedLine[] {
  const totalStroops = toStroops(total);
  if (totalStroops <= 0n) {
    throw new AppError('INVALID_INPUT', 'Enter a paycheck amount greater than zero', 400);
  }
  const amounts = allocateByShares(
    totalStroops,
    recs.map((r) => r.sharePct),
  );
  return recs.map((r, i) => ({
    label: r.label,
    address: r.address,
    sharePct: r.sharePct,
    amount: fromStroops(amounts[i]),
  }));
}
