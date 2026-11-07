// An act's facts as typed pieces (text:show-then-tell, world:one-action-one-sheet): the pay, the chance, the time, when it pays or
// lands, a bill over months, a fee, a rate, where it counts and a catch, each an icon and two or three words, always in that
// order, so a sheet never joins them into its line. The flavour line beside them keeps only what no fact says.
import type { ChanceBand } from "./jobs";
import { blurbOf, say } from "./text";

export type Fact =
  | { kind: "pay"; words: string }
  | { kind: "chance"; band: ChanceBand }
  | { kind: "time"; words: string }
  | { kind: "when"; words: string }
  | { kind: "bill"; words: string }
  | { kind: "fee"; words: string }
  | { kind: "rate"; words: string }
  | { kind: "counts"; id: string }
  | { kind: "catch"; words: string };

export type FactKind = Fact["kind"];

/** The one order facts stand in, whichever sheet shows them. */
export const FACT_ORDER: readonly FactKind[] = ["pay", "chance", "time", "when", "bill", "fee", "rate", "counts", "catch"];

/** The facts in their order; a kind given twice keeps the order it was given in. */
export function ordered(facts: readonly Fact[]): Fact[] {
  return [...facts].sort((a, b) => FACT_ORDER.indexOf(a.kind) - FACT_ORDER.indexOf(b.kind));
}

/**
 * Blurbs whose later sentences say what a fact now says: the sheet shows only their first sentences, the content as it is.
 * The racks' "Up before light, paid at the month's end." is the when fact; the English study's "A month of study lifts your
 * chance at the test." is its gain tag.
 */
const SHOWN_SENTENCES: Readonly<Record<string, number>> = {
  "activity.job-fish-racks": 1,
  "activity.study-english": 1,
};

/** The fact a cut sentence becomes: the racks' "paid at the month's end" is a when fact. */
const WHEN_FACTS: Readonly<Record<string, string>> = {
  "activity.job-fish-racks": "ui.fact.paid-month-end",
};

/** The when fact an entry's cut blurb said, or null. */
export function whenFactOf(id: string): Fact | null {
  const key = WHEN_FACTS[id];
  return key === undefined ? null : { kind: "when", words: say(key) };
}

/** The first `count` sentences of a line. */
function firstSentences(line: string, count: number): string {
  const sentences = line.match(/[^.?]+[.?]+(?:\s|$)/g);
  if (sentences === null) return line;
  return sentences.slice(0, count).join("").trim();
}

/** An entry's blurb as a sheet with facts shows it: whole, or cut to the sentences no fact repeats. */
export function flavourOf(id: string): string | null {
  const blurb = blurbOf(id);
  if (blurb === null) return null;
  const count = SHOWN_SENTENCES[id];
  return count === undefined ? blurb : firstSentences(blurb, count);
}
