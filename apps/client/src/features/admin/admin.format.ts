// Times, days, counts and rates as the admin page shows them (admin:titles-and-values): a date as its day and month, a time
// in West Africa Time, a hidden count as "<" and its floor, a missing figure as "No data", a share in percent.
import type { Shown } from "@japacity/api";
import { time } from "@japacity/sim";

import { formatBp, formatNumber } from "../../shared/words/format";
import { words } from "./admin.words";

const { DAY_MS, HOUR_MS, MINUTE_MS } = time;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** West Africa Time is one hour ahead of UTC all year. */
const WAT_OFFSET_MS = HOUR_MS;

const two = (figure: number) => String(figure).padStart(2, "0");

/** Milliseconds since 1970 as `8 Oct 2026 13:00 WAT`. */
export function whenWords(at: number): string {
  const wat = new Date(at + WAT_OFFSET_MS);
  return `${String(wat.getUTCDate())} ${MONTHS[wat.getUTCMonth()] ?? ""} ${String(wat.getUTCFullYear())} ${two(wat.getUTCHours())}:${two(wat.getUTCMinutes())} WAT`;
}

/** Milliseconds since 1970 as `13:00 WAT`. */
export function timeWords(at: number): string {
  const wat = new Date(at + WAT_OFFSET_MS);
  return `${two(wat.getUTCHours())}:${two(wat.getUTCMinutes())} WAT`;
}

/** A UTC day name (`2026-10-07`) as `7 Oct`, or `7 Oct 2026` with the year. A name that is not a date is shown as it is. */
export function dayWords(name: string, withYear = false): string {
  const day = time.dayNumber(name);
  if (day === null) return name;
  const date = new Date(time.dayStart(day));
  const short = `${String(date.getUTCDate())} ${MONTHS[date.getUTCMonth()] ?? ""}`;
  return withYear ? `${short} ${String(date.getUTCFullYear())}` : short;
}

/** A wait in milliseconds as days, hours and minutes, the largest two that are not zero. */
export function duration(ms: number): string {
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  const parts = [days > 0 ? `${String(days)} d` : "", hours > 0 ? `${String(hours)} h` : "", minutes > 0 ? `${String(minutes)} min` : ""].filter((each) => each !== "");
  return parts.length === 0 ? words("admin.duration.under-minute") : parts.slice(0, 2).join(" ");
}

/** analytics:small-counts-shown-as-fewer, admin:titles-and-values: a hidden count reads "<" and its floor. */
export function shownCount(count: Shown): string {
  return typeof count === "number" ? formatNumber(count) : words("admin.fewer", { count: count.fewerThan });
}

/** The number of a shown count, or null while it is hidden. */
export function shownNumber(count: Shown): number | null {
  return typeof count === "number" ? count : null;
}

/** A share in basis points as percent, or "No data" while the server hid it. */
export function rateWords(bp: number | null): string {
  return bp === null ? words("admin.no-data") : formatBp(bp);
}

/** Kobo as whole naira, or "No data" while the server hid it. */
export function nairaWords(kobo: number | null): string {
  return kobo === null ? words("admin.no-data") : words("admin.naira", { amount: formatNumber(Math.round(kobo / 100)) });
}

/** admin:period-is-today-7-or-30: a figure's change against the previous period, as a signed percent; null when either side is missing or the previous is zero. */
export function changeWords(now: number | null, before: number | null): string | null {
  if (now === null || before === null || before === 0) return null;
  const percent = Math.round(((now - before) * 100) / before);
  return `${percent > 0 ? "+" : ""}${String(percent)}%`;
}
