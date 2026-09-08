/** Formats an ISO farm date (`YYYY-MM-DD`) for display without timezone shifts. */
export function formatFarmDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  return `${match[3]}-${match[2]}-${match[1].slice(-2)}`;
}

/** Returns elapsed calendar months and days, for example `4M 15D`. */
export function formatElapsedMonthsDays(startDate: string, endDate = new Date().toISOString().slice(0, 10)): string | null {
  const start = parseFarmDate(startDate);
  const end = parseFarmDate(endDate);
  if (!start || !end || start > end) return null;

  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  let anchor = addUtcMonths(start, months);
  if (anchor > end) {
    months -= 1;
    anchor = addUtcMonths(start, months);
  }
  const days = Math.round((end.getTime() - anchor.getTime()) / 86_400_000);
  return `${months}M ${days}D`;
}

function parseFarmDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.getUTCFullYear() === Number(match[1]) && parsed.getUTCMonth() === Number(match[2]) - 1 && parsed.getUTCDate() === Number(match[3]) ? parsed : null;
}

function addUtcMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear() + Math.floor((date.getUTCMonth() + months) / 12);
  const month = (date.getUTCMonth() + months) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay)));
}
