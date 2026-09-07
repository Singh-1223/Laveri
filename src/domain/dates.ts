/** Formats an ISO farm date (`YYYY-MM-DD`) for display without timezone shifts. */
export function formatFarmDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  return `${match[3]}-${match[2]}-${match[1].slice(-2)}`;
}
