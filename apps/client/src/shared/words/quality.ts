// A quality's value as the player reads it, wherever it shows: the profile,
// the prologue's life so far, a requirement.
import { formatNumber } from "./format";
import { qualityIn } from "@japacity/sim";
import { bandWords, hasWords, say } from "./text";

export const AGE = "quality.age-months";
const MONTHS_IN_YEAR = 12;

/** Whole years in an age kept in months. */
export function yearsOf(months: number): number {
  return Math.floor(months / MONTHS_IN_YEAR);
}

/** The character's age as the band's clock says it, "23 yrs 4 mo": the game's own time (world:top-band-is-lively-pill). */
export function clockWords(qualities: readonly { id: string; value: number }[]): string {
  const age = qualityIn({ qualities }, AGE);
  return say("ui.world.clock", { years: yearsOf(age), months: age % MONTHS_IN_YEAR });
}

/**
 * The character's age as the data page prints it, "26 yrs": whole years with their word, never the months, since a
 * real page carries a date of birth the game's time has none of (prologue:front-door-builds-a-person). The band
 * keeps the clock in years and months (world:top-band-is-lively-pill).
 */
export function pageAgeWords(qualities: readonly { id: string; value: number }[]): string {
  return say("prologue.page.age.years", { years: yearsOf(qualityIn({ qualities }, AGE)) });
}

/** A value as the player reads it: a named level where content names one, years for age, the band it is in, else the number. */
export function valueWords(id: string, value: number): string {
  if (id === AGE) return say("ui.profile.age", { years: yearsOf(value) });
  const label = `${id}.value.${String(value)}`;
  if (hasWords(label)) return say(label);
  return bandWords(id, value) ?? formatNumber(value);
}
