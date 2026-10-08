// R-ACCOUNT-012: the age screen's arithmetic and its two cookies. The date of
// birth is read, judged and dropped here; nothing below keeps it.
import { time } from "@japacity/sim";

/** Set on a refusal; while present the screen refuses without asking. */
export const REFUSED_COOKIE = "japacity-age-refused";

/** Set on a pass; names a single-use pass row that account creation consumes. */
export const PASS_COOKIE = "japacity-age-pass";

/** The verification-row prefix of a pass. */
export const PASS_PREFIX = "japacity-age-pass-";

// no config field holds how long a pass lasts before sign-up; an hour covers an email code's round trip.
export const PASS_TTL_MS = time.HOUR_MS;

export interface BirthDate {
  year: number;
  month: number;
  day: number;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date as `YYYY-MM-DD`, or null when it is not a real date. */
export function parseBirthDate(text: unknown): BirthDate | null {
  if (typeof text !== "string") return null;
  const match = DATE.exec(text);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Whole years from `birth` to the UTC calendar day of `now`; a 29 February birthday turns on 1 March in other years. */
export function ageOn(birth: BirthDate, now: number): number {
  const today = new Date(now);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();
  const before = month < birth.month || (month === birth.month && day < birth.day);
  return year - birth.year - (before ? 1 : 0);
}

/** A date of birth after today, or before 1900, is not believed. */
export function plausible(birth: BirthDate, now: number): boolean {
  return birth.year >= 1900 && Date.UTC(birth.year, birth.month - 1, birth.day) <= now;
}

/** The `Cookie` header's value for `name`, or null. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (header === null || header === undefined) return null;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at === -1) continue;
    if (part.slice(0, at).trim() === name) return decodeURIComponent(part.slice(at + 1).trim());
  }
  return null;
}
