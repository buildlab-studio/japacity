// The age the data page prints before a life begins (prologue.md R-PROLOGUE-004, R-PROLOGUE-009; decision 0023): the
// year picked for a tile, which is the year the life starts at, and a ready life's own from its scenario. A true number:
// the life is between that birthday and the next.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";

const AGE = "quality.age-months";
const YEAR = 12;

/** A ready life's own age in months. */
export function readyMonths(scenario: Id<"scenario">): number {
  return content.scenario[scenario]?.qualities[AGE] ?? content.tuning.prologue.startAgeMonths;
}

/** The years the page prints for an age in months: the birthdays passed. */
export function yearsOf(months: number): number {
  return Math.floor(months / YEAR);
}
