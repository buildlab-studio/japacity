// R-ANALYTICS-005: a stored total's day is the UTC date as `YYYY-MM-DD`.
import { dayStart, utcDay } from "../admin/day";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The date of a UTC day number. */
export function dayName(day: number): string {
  return new Date(dayStart(day)).toISOString().slice(0, 10);
}

/** The UTC day number of a date, or null when it is not a real date. */
export function dayNumber(name: string): number | null {
  if (!DATE.test(name)) return null;
  const ms = Date.parse(`${name}T00:00:00Z`);
  if (!Number.isFinite(ms) || dayName(utcDay(ms)) !== name) return null;
  return utcDay(ms);
}
