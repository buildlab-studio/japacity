// The English test's words (world:one-action-one-sheet, world:month-end-results-sheet): the chance of the band the route
// needs before the fee is paid, and a result that says it fell short and what next. Beside jobs.ts, whose
// chance words it shares, so the card and the results read one band of words.
import { content } from "@japacity/content";
import type { ReportLine, Requirement, Tuning } from "@japacity/sim";
import { int, qualityIn } from "@japacity/sim";

import { formatBand } from "./format";
import { chanceBand, type ChanceBand } from "./jobs";
import { say } from "./text";

export const ENGLISH_TEST = "activity.sit-english-test";
export const STUDY_ENGLISH = "activity.study-english";
const ENGLISH_PAPER = "document.english-test";
const ENGLISH = "quality.english";
/** English is held out of 100; the band adds its per-hundred figure for each 100 (document.logic.ts). */
const ENGLISH_PER = 100;
export const ISSUED_BAND = "line.document.issued-band";
export const ISSUED_BAND_SHORT = "line.document.issued-band-short";
export const ISSUED_BAND_MET = "line.document.issued-band-met";

/** What the band needed is read from: the plan, whose route's own content names its band. */
export interface BandView {
  plan?: { route: string | null } | undefined;
}

/**
 * The band a route asks for in its own content, held as the band times ten: its checklist's English result (the care
 * file's 4.0, the master's 6.0). Null for a route that asks none.
 */
export function routeBand(route: string): number | null {
  for (const item of content.route[route as keyof typeof content.route]?.checklist ?? []) {
    const band = bandIn(item.requirement);
    if (band !== null) return band;
  }
  return null;
}

/** The English result's band a requirement asks, inside an either-or too (the degree's statement or the band, route-gates:sponsor-application-needs). */
function bandIn(requirement: Requirement): number | null {
  if (requirement.type === "document/held" && requirement.document === ENGLISH_PAPER && requirement.min !== undefined) return requirement.min;
  if (requirement.type !== "any") return null;
  for (const inner of requirement.of) {
    const band = bandIn(inner);
    if (band !== null) return band;
  }
  return null;
}

/**
 * The band the route asks for, held as the band times ten (one figure from one place):
 * the plan's route's own, from its content, so the file, the centre's sheet and the result say one band. With no plan,
 * or a plan that asks no band, the least the chapter's English item takes (the nudge's "Score 6.0"), else the lowest
 * band any university asks for.
 */
export function bandNeeded(view: BandView = {}): number {
  const lean = view.plan?.route ?? null;
  const own = lean === null ? null : routeBand(lean);
  if (own !== null) return own;
  const asked = Object.values(content.chapter).flatMap((chapter) =>
    chapter.items.flatMap((item) => (item.requirement.type === "document/held" && item.requirement.document === ENGLISH_PAPER && item.requirement.min !== undefined ? [item.requirement.min] : [])),
  );
  // route:applying-to-a-school: no school asks a band, so with none asked the lowest band a test gives stands.
  return asked.length > 0 ? Math.min(...asked) : content.tuning.english.min;
}

/**
 * The band a result is told against (world:month-end-results-sheet): the plan's route's own, or null with no plan or a plan that asks none
 * (the master's, whose English is the degree, route:degree-meets-masters-english), when the result says the band alone.
 */
export function bandAsked(view: BandView = {}): number | null {
  const lean = view.plan?.route ?? null;
  return lean === null ? null : routeBand(lean);
}

/** The band a sitting gives at one draw of the noise, as the simulation sets it (document:english-test-band-value). */
function bandAt(english: number, numbers: Tuning["english"], steps: number): number {
  const raw = numbers.base + int.mulDiv(numbers.perHundred, english, ENGLISH_PER) + steps * numbers.bandStep;
  return int.clamp(int.roundDownTo(raw, numbers.bandStep), numbers.min, numbers.max);
}

/** The bands one sitting may give from this much English, one for each even draw of the noise, lowest first. */
export function possibleBands(english: number): number[] {
  const numbers = content.tuning.english;
  const bands: number[] = [];
  for (let steps = -numbers.noiseSteps; steps <= numbers.noiseSteps; steps += 1) bands.push(bandAt(english, numbers, steps));
  return bands;
}

/** The chance in basis points that one sitting reaches `needed` from this much English: the share of the noise's draws that do. */
export function bandChanceBp(english: number, needed: number = bandNeeded()): number {
  const bands = possibleBands(english);
  return int.mulDiv(bands.filter((band) => band >= needed).length, 10_000, bands.length);
}

/** The character's English from the view, 0 when it has none. */
export function englishOf(view: { qualities: readonly { id: string; value: number }[] }): number {
  return qualityIn(view, ENGLISH);
}

export interface TestChance {
  /** The chance of `bandNeeded`, which the nudge's long shot reads too. */
  band: ChanceBand;
  /** "Band 6.0 this sitting: a long shot.", or with no band asked the band alone: "Your band this sitting: about 5.5." */
  words: string;
  /** "Study first: a month of study lifts the chance." on a long shot of a band asked, else null. */
  study: string | null;
}

/** The band a sitting most likely gives from this much English: the middle draw of the noise. */
export function likelyBand(english: number): number {
  const bands = possibleBands(english);
  return bands[int.divFloor(bands.length, 2)] ?? content.tuning.english.min;
}

/**
 * The sit-the-test card's chance of the band the route needs, in the jobs' words, and the advice to study first on a long
 * shot. With no plan, or a plan that asks no band, the sheet says the band a sitting would likely give alone and names no
 * route's figure (world:one-action-one-sheet), so there is no long shot to study for.
 */
export function testChance(view: { qualities: readonly { id: string; value: number }[] } & BandView): TestChance {
  const needed = bandNeeded(view);
  const english = englishOf(view);
  const band = chanceBand(bandChanceBp(english, needed));
  if (bandAsked(view) === null) return { band, words: say("activity.sit-english-test.band-alone", { band: formatBand(likelyBand(english)) }), study: null };
  const chance = say(`jobs.chance.${band}`).toLowerCase();
  return {
    band,
    words: say("activity.sit-english-test.chance", { band: formatBand(needed), chance }),
    study: band === "long" ? say("activity.sit-english-test.study-first") : null,
  };
}

/**
 * The English result as the results say it (world:month-end-results-sheet): a band under the one the route needs says so
 * and what next, in content's words; a band that reaches it says it meets the route's band; with no band asked, the
 * band alone.
 */
export function bandResultLine(line: ReportLine, needed: number | null = null): ReportLine {
  if (line.key !== ISSUED_BAND || line.params.document !== ENGLISH_PAPER) return line;
  const band = line.params.band;
  if (typeof band !== "number" || needed === null) return line;
  if (band >= needed) return { ...line, key: ISSUED_BAND_MET, params: { ...line.params, needed: formatBand(needed) } };
  return { ...line, key: ISSUED_BAND_SHORT, tone: "bad", params: { ...line.params, needed: formatBand(needed) } };
}

/**
 * A result as the month's lines tell it, told again against the plan's own band: the nurse's 5.0 on a care plan says
 * the route needs 5.5; with no band asked it says the band alone. The engine's line is always good in tone.
 */
export function bandResultFor(line: ReportLine, view: BandView): ReportLine {
  if (line.key !== ISSUED_BAND && line.key !== ISSUED_BAND_MET && line.key !== ISSUED_BAND_SHORT) return line;
  return bandResultLine({ ...line, key: ISSUED_BAND, tone: "good" }, bandAsked(view));
}
