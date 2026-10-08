// Times, days and counts as the admin page shows them: UTC throughout, since
// the server's days are UTC days.
import { formatBp, formatNumber } from "../../shared/words/format";
import type { Shown } from "./admin.contract";
import { words } from "./admin.words";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Milliseconds since 1970 as `2026-10-08 09:00 UTC`. */
export function utcTime(at: number): string {
  return `${new Date(at).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** A whole number of UTC days since 1970 as `2026-10-08`. */
export function utcDate(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** `2026-10-08` as whole UTC days since 1970, or null for anything else. */
export function dayOf(date: string): number | null {
  if (!DATE.test(date)) return null;
  const at = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(at) ? null : Math.floor(at / DAY_MS);
}

/** A wait in milliseconds as days, hours and minutes, the largest two that are not zero. */
export function duration(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  const parts = [days > 0 ? `${String(days)} d` : "", hours > 0 ? `${String(hours)} h` : "", minutes > 0 ? `${String(minutes)} min` : ""].filter((each) => each !== "");
  return parts.length === 0 ? "under a minute" : parts.slice(0, 2).join(" ");
}

/** R-ANALYTICS-010: a hidden count says only the floor it is under. */
export function shownCount(count: Shown): string {
  return typeof count === "number" ? formatNumber(count) : words("admin.analytics.fewer", { count: count.fewerThan });
}

export function rate(bp: number | null, reference: number): string {
  if (bp === null) return words("admin.analytics.hidden");
  return words(bp < reference ? "admin.analytics.under" : "admin.analytics.over", { rate: formatBp(bp) });
}
