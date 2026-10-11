// The world's own clock (docs/rules/clock.md R-CLOCK-033; decision 0036): one game day runs on real time, faster
// than life, the same moment for everyone, so a sitting sees the sun move; events hang on it and the city opens
// and shuts by it. Each life's months turn only when that life sleeps. Pure: `now` is given, never read, and the
// simulation never sees this (R-ENGINE-012); the authority carries it in the clock view.
import { divFloor } from "./int";
import { AFTERNOON_HOUR, EVENING_HOUR, GAME_DAY_EPOCH_MS, GAME_DAY_MS, GAME_HOURS, MORNING_HOUR, NIGHT_HOUR } from "./time";

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export interface WorldClock {
  /** Game days since the epoch's midnight. */
  day: number;
  /** Minutes into the game day, 0 to 1439. */
  minute: number;
  /** The day of the week, 0 Sunday to 6 Saturday; day 0 is a Friday. */
  weekday: number;
  part: DayPart;
  /** The real moment this game day's next morning begins (six o'clock). */
  morningAt: number;
}

const MINUTES_A_DAY = GAME_HOURS * 60;
const MS_A_GAME_MINUTE = divFloor(GAME_DAY_MS, MINUTES_A_DAY);
const FRIDAY = 5;

/** The part of the day a game hour falls in. */
export function partOf(hour: number): DayPart {
  if (hour >= NIGHT_HOUR || hour < MORNING_HOUR) return "night";
  if (hour < AFTERNOON_HOUR) return "morning";
  if (hour < EVENING_HOUR) return "afternoon";
  return "evening";
}

/** The next real moment the game's clock reaches six in the morning after `now`. */
export function nextGameMorning(now: number): number {
  const since = Math.max(0, now - GAME_DAY_EPOCH_MS);
  const day = divFloor(since, GAME_DAY_MS);
  const morning = GAME_DAY_EPOCH_MS + day * GAME_DAY_MS + MORNING_HOUR * 60 * MS_A_GAME_MINUTE;
  return now < morning ? morning : morning + GAME_DAY_MS;
}

/** The world's clock at a real moment. Before the epoch the clock stands at its first midnight. */
export function worldClockAt(now: number): WorldClock {
  const since = Math.max(0, now - GAME_DAY_EPOCH_MS);
  const day = divFloor(since, GAME_DAY_MS);
  const minute = divFloor(since - day * GAME_DAY_MS, MS_A_GAME_MINUTE);
  const hour = divFloor(minute, 60);
  return { day, minute, weekday: (FRIDAY + day) % 7, part: partOf(hour), morningAt: nextGameMorning(now) };
}
