export function isUniqueViolation(err: unknown, constraintName?: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  if (code !== '23505') return false;
  if (!constraintName) return true;
  const constraint = (err as { constraint?: string }).constraint;
  return constraint === constraintName;
}
