// The age on the door (prologue.md R-PROLOGUE-004, R-PROLOGUE-009; decision 0023): never typed. The tile's own age is
// the year its path reaches with no setback, and the player steps it a few years older, within 18 to 29. The age picked
// is the age the life starts at: the years past the path's end are worked, and the prologue's work card says what each
// year brings. The client only reads the cards, sends the year picked through the tile's preset, and says what a step does.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";

import { AGE_CARDS, type Archetype, lowestYear, startYearOf } from "../frontdoor/archetypes";
import { formatMoney } from "../words/format";
import { say, sayCount } from "../words/text";

/** The years worked after the path's end, never a card: its answers are the years in order, the last for every year after. */
export const WORK_CARD = "work";
const PASSPORT = "document.passport";
const CANADA = "points.canada" as Id<"points">;
/** How many years older than its own a tile's age steps on the door (R-PROLOGUE-009: a few years). */
export const STEPS_OLDER = 3;

function years(): number[] {
  return AGE_CARDS.flatMap((card) => (content.prologue[card]?.answers ?? []).flatMap((answer) => {
    const year = startYearOf(answer.id);
    return year === null ? [] : [year];
  }));
}

/** The youngest and the oldest a start may be, in whole years, from the age cards' own years. */
export const YOUNGEST = Math.min(...years());
export const OLDEST = Math.max(...years());

/** The year a tile's life starts at, `older` years past its own. */
export function startYearFor(archetype: Archetype, older: number): number {
  return lowestYear(archetype) + older;
}

/** The steps older the door offers a tile, its own age first: up to three, never past the oldest start. */
export function stepsOpen(archetype: Archetype): number[] {
  const most = Math.max(0, Math.min(STEPS_OLDER, OLDEST - lowestYear(archetype)));
  return Array.from({ length: most + 1 }, (_, at) => at);
}

export interface Worked {
  /** Naira in kobo the years worked save. */
  saved: number;
  /** True when they bring the passport held. */
  passport: boolean;
}

/** What so many years of work after the path's end bring, from the work card's answers in content. */
export function yearsWorked(count: number): Worked {
  const answers = content.prologue[WORK_CARD]?.answers ?? [];
  let saved = 0;
  let passport = false;
  for (let at = 0; at < count; at += 1) {
    for (const effect of answers[Math.min(at, answers.length - 1)]?.effects ?? []) {
      if (effect.type === "money/add" && effect.currency === "NGN" && typeof effect.amount === "number") saved += effect.amount;
      if (effect.type === "document/grant" && effect.document === PASSPORT) passport = true;
    }
  }
  return { saved, passport };
}

/** The age from which Canada's points for age start to fall, from its own table: the young-favouring limit the page names. */
export function youngLimitYears(): number {
  const rows = content.points[CANADA]?.age ?? [];
  const most = Math.max(...rows.map((row) => row.points));
  const top = rows.findIndex((row) => row.points === most);
  return rows[top + 1]?.years ?? rows.at(-1)?.years ?? 0;
}

/** What a step does, for the page: the years worked, their saving and the passport; at the tile's own age the years before Canada's age points fall. */
export function ageStepWords(older: number, lowest: number): string {
  if (older > 0) {
    const worked = yearsWorked(older);
    return say(worked.passport ? "prologue.age.older.passport" : "prologue.age.older", { amount: formatMoney(worked.saved, "NGN") });
  }
  // Whole years from the age printed to the limit, so "23" and "7 years before" add up to 30.
  const left = Math.max(0, youngLimitYears() - lowest);
  return sayCount("prologue.age.as-is", left, { count: left });
}
