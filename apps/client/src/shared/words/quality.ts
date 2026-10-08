// A quality's value as the player reads it, wherever it shows: the profile,
// the prologue's life so far, a requirement.
import { formatNumber } from "./format";
import { hasWords, say } from "./text";

export const AGE = "quality.age-months";
const MONTHS_IN_YEAR = 12;

/** Whole years in an age kept in months. */
export function yearsOf(months: number): number {
  return Math.floor(months / MONTHS_IN_YEAR);
}

/** A value as the player reads it: a named level where content names one, years for age, else the number. */
export function valueWords(id: string, value: number): string {
  if (id === AGE) return say("ui.profile.age", { years: yearsOf(value) });
  const label = `${id}.value.${String(value)}`;
  return hasWords(label) ? say(label) : formatNumber(value);
}
