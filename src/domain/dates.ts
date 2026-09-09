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

export function tenDayCycleStart(value: string): string {
  const date = parseFarmDate(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() <= 10 ? 1 : date.getUTCDate() <= 20 ? 11 : 21);
  return date.toISOString().slice(0, 10);
}

export function shiftTenDayCycle(value: string, direction: -1 | 1): string {
  const start = parseFarmDate(tenDayCycleStart(value));
  if (!start) return value;
  const day = start.getUTCDate();
  if (direction === 1) {
    if (day === 1) start.setUTCDate(11);
    else if (day === 11) start.setUTCDate(21);
    else { start.setUTCMonth(start.getUTCMonth() + 1); start.setUTCDate(1); }
  } else if (day === 21) start.setUTCDate(11);
  else if (day === 11) start.setUTCDate(1);
  else { start.setUTCMonth(start.getUTCMonth() - 1); start.setUTCDate(21); }
  return start.toISOString().slice(0, 10);
}

export function tenDayCycleEnd(value: string): string {
  const start = parseFarmDate(tenDayCycleStart(value));
  if (!start) return value;
  const day = start.getUTCDate();
  const endDay = day === 1 ? 10 : day === 11 ? 20 : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(endDay);
  return start.toISOString().slice(0, 10);
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
