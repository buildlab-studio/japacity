// The month's name as the band says it (docs/rules/world.md R-WORLD-002; decision 0011), and the world's part of the day
// beside it (clock.md R-CLOCK-033; decision 0011). Month 0 of a life is the month of the year the life began in, read on
// Lagos's clock, so a life begun in March is in April at month 1. The month's phase by its free time spent stays for
// what reads it; the band does not say it.
import type { DayPart, PlayerView } from "@japacity/sim";
import { time } from "@japacity/sim";

import { say } from "./text";

const MONTHS_IN_YEAR = 12;

export type MonthPhase = "early" | "mid" | "late" | "end";

/** The month of the year, 0 for January, that a life begun at `beganAt` is in at its month `month`. */
export function monthIndexOf(beganAt: number, month: number): number {
  const first = new Date(beganAt + time.LAGOS_OFFSET_MS).getUTCMonth();
  return (((first + month) % MONTHS_IN_YEAR) + MONTHS_IN_YEAR) % MONTHS_IN_YEAR;
}

/** The month's name in words: "April". */
export function monthNameOf(beganAt: number, month: number): string {
  return say(`ui.month.name.${String(monthIndexOf(beganAt, month))}`);
}

/**
 * Where the month stands by its free time spent (R-TURN-010): below a third Early, below two thirds Mid, below the whole
 * Late, and at the whole the month's end. Whole numbers only: the edges are compared as thirds, never as fractions.
 */
export function phaseOf(halfDays: PlayerView["halfDays"]): MonthPhase {
  const { spent, free } = halfDays;
  if (spent >= free) return "end";
  if (spent * 3 < free) return "early";
  if (spent * 3 < free * 2) return "mid";
  return "late";
}

/** The world's part of the day in words (R-CLOCK-033): Morning, Afternoon, Evening, Night. */
export function dayPartWords(part: DayPart): string {
  return say(`ui.day.part.${part}`);
}
