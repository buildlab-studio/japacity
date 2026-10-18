// Real-time lengths the design gives, in milliseconds, in one place.
// The simulation never reads a clock (R-ENGINE-012), so nothing in the sim
// uses these. The authorities do: the local one in the tab and the server.
// They are plain numbers so either can read them without a clock.
import { divFloor } from "./int";

export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** A day in seconds, as cookies and HTTP caches count it. */
export const DAY_S = 24 * 60 * 60;

/** R-SERVER-011: a UTC day as a whole number of days since 1970. */
export function utcDay(ms: number): number {
  return divFloor(ms, DAY_MS);
}

/** The first millisecond of a UTC day. */
export function dayStart(day: number): number {
  return day * DAY_MS;
}

/** Days from 0000-03-01 to 1970-01-01 in the proleptic Gregorian calendar; 146097 days make 400 years. */
const EPOCH_SHIFT = 719_468;
const ERA_DAYS = 146_097;

const pad = (value: number, width: number) => String(value).padStart(width, "0");

/**
 * R-ANALYTICS-005: a UTC day number as its date, `YYYY-MM-DD`, for the years 0 to 9999. Whole-number calendar
 * arithmetic (Howard Hinnant's civil_from_days), so it needs no `Date`.
 * https://howardhinnant.github.io/date_algorithms.html#civil_from_days
 */
export function dayName(day: number): string {
  const shifted = day + EPOCH_SHIFT;
  const era = divFloor(shifted, ERA_DAYS);
  const dayOfEra = shifted - era * ERA_DAYS;
  const yearOfEra = divFloor(dayOfEra - divFloor(dayOfEra, 1460) + divFloor(dayOfEra, 36_524) - divFloor(dayOfEra, ERA_DAYS - 1), 365);
  const dayOfYear = dayOfEra - (365 * yearOfEra + divFloor(yearOfEra, 4) - divFloor(yearOfEra, 100));
  const monthFromMarch = divFloor(5 * dayOfYear + 2, 153);
  const date = dayOfYear - divFloor(153 * monthFromMarch + 2, 5) + 1;
  const month = monthFromMarch < 10 ? monthFromMarch + 3 : monthFromMarch - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(date, 2)}`;
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** R-ANALYTICS-005: the UTC day number of a date `YYYY-MM-DD`, or null when it is not a real date. */
export function dayNumber(name: string): number | null {
  const parts = DATE.exec(name);
  if (parts === null) return null;
  const [year, month, date] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (month < 1 || month > 12 || date < 1 || date > 31) return null;
  const marchYear = month <= 2 ? year - 1 : year;
  const era = divFloor(marchYear, 400);
  const yearOfEra = marchYear - era * 400;
  const dayOfYear = divFloor(153 * (month > 2 ? month - 3 : month + 9) + 2, 5) + date - 1;
  const dayOfEra = yearOfEra * 365 + divFloor(yearOfEra, 4) - divFloor(yearOfEra, 100) + dayOfYear;
  const day = era * ERA_DAYS + dayOfEra - EPOCH_SHIFT;
  return dayName(day) === name ? day : null;
}

/** Lagos keeps UTC+1 all year (R-CLOCK-014). */
export const LAGOS_OFFSET_MS = HOUR_MS;

/** The hour in Lagos a sealed result opens: what real life made you wait for comes in the morning (R-CLOCK-032). */
export const MORNING_HOUR_LAGOS = 7;

// The world's own clock (R-CLOCK-033, decision 0011): one game day runs on real time but faster than life, the same
// moment for everyone, so a sitting sees the sun move. Each life's months turn only when that life sleeps.

/**
 * One game day in real time: an hour and three quarters. Not a divisor of the real day (R-CLOCK-033):
 * 24 hours hold 13 and five sevenths game days, so a player who sits down at the same real hour
 * each evening meets a different hour of the game's day each day of the week, every part of it inside a week.
 * 105 minutes split into 1,440 game minutes of 4,375 ms each, whole, so the clock's arithmetic stays in integers.
 */
export const GAME_DAY_MS = 105 * MINUTE_MS;

/** The real moment game day 0 began at its midnight: a Friday 18:00 UTC, the same epoch as the server's ticks (R-CLOCK-002), so day 0 is a Friday. */
export const GAME_DAY_EPOCH_MS = 1_791_568_800_000;

/** The game day's hours, 0 to 23, and where its parts begin: morning at six, the afternoon at noon, evening at six, night at ten. */
export const GAME_HOURS = 24;
export const MORNING_HOUR = 6;
export const AFTERNOON_HOUR = 12;
export const EVENING_HOUR = 18;
export const NIGHT_HOUR = 22;

/** One new turn every two real hours. docs/design/01-concept.md section 9, docs/rules/turn.md "Outside the simulation". */
export const TURN_REFILL_MS = 2 * HOUR_MS;

/** Twelve new turns a real day. docs/design/01-concept.md section 9. */
export const TURNS_PER_REAL_DAY = 12;

/**
 * An empty bank refills to the cap (tuning.turn.cap, 24) in two real days.
 * docs/design/01-concept.md section 9: "two days away with nothing lost".
 */
export const BANK_REFILLS_IN_MS = 2 * DAY_MS;

// Real-time lengths for the online world. The in-browser authority passes one
// tick for each month played instead (docs/rules/engine.md section 7).

/** Online, a world tick is half a real day: the rates "tick twice a real day". docs/design/01-concept.md section 13. */
export const WORLD_TICK_MS = 12 * HOUR_MS;

/** An era lasts about four real weeks. docs/design/01-concept.md section 7, "Eras". */
export const ERA_MS = 28 * DAY_MS;

/** Nothing takes effect less than two real days after it is announced. docs/design/01-concept.md section 7, fairness rule 4. */
export const ANNOUNCE_TO_FORCE_MIN_MS = 2 * DAY_MS;

/** A partner who stops playing is warned after seven real days. docs/design/01-concept.md section 6. */
export const PARTNER_IDLE_WARNING_MS = 7 * DAY_MS;

/** After fourteen real days a labelled stand-in takes over for an idle partner. docs/design/01-concept.md section 6. */
export const PARTNER_STAND_IN_MS = 14 * DAY_MS;
