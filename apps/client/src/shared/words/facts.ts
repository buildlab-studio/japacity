// An act's facts as typed pieces (text:show-then-tell, world:one-action-one-sheet): the pay, the chance, the time, when it pays or
// answers, a bill over months, a fee, a rate, where it counts and a catch, each an icon and two or three words, always in that
// order, so a sheet never joins them into its line. What the act changes stands beside them as arrow tags, a gain up and a cost to
// the body or the mood down, and what it needs as marks. The line above them is content's own words, holding none of these.
import { content, text } from "@japacity/content";
import type { ActivityOption, Id, PlayerView, Requirement } from "@japacity/sim";

import { effectTagsOf, timeWordsOf } from "./acts";
import { ENGLISH_TEST, testChance } from "./englishTest";
import { formatMoney } from "./format";
import { chanceOf, huntBand, payWords, type ChanceBand } from "./jobs";
import { payAMonth } from "./pay";
import { countsRoutes, liftWords } from "./profile";
import { requirementSentence } from "./requirement";
import { courseParts, heldBackWords, ownWorkCapital, studyGainNow, studyPaysWords } from "./study";
import { blurbOf, say } from "./text";

export type Fact =
  | { kind: "pay"; words: string }
  | { kind: "chance"; band: ChanceBand; words?: string }
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

/** What an act changes, as a tag with its arrow: a gain up, a cost to the body or the mood down. */
export interface Change {
  tone: "up" | "down";
  words: string;
}

/** What an act needs or why it waits, as a mark and a few words: a tick once met, a cross while unmet, a warning when taught out, a clock while held back. */
export interface Need {
  state: "done" | "failed" | "setback" | "waiting";
  words: string;
  id: string;
}

/** An act's sheet in pieces: its one line (content's words, or null), its facts, its changes and its needs. */
export interface ActFacts {
  line: string | null;
  facts: Fact[];
  changes: Change[];
  needs: Need[];
}

/** The most gains a sheet shows (docs/design/09-the-games-look.md section 2); a cost is always shown. */
const GAINS_MAX = 2;

/** When an entry pays or answers, where content says it (`<id>.when`: the racks' "Paid at month's end"), as a fact. */
function whenOf(id: string): Fact[] {
  const words = text[`${id}.when`];
  return words === undefined ? [] : [{ kind: "when", words }];
}

/** The job an act starts at once (own work, the kiln), or null; a job named by an offer's terms is the offer's to say. */
function startedJob(activity: string): string | null {
  for (const effect of content.activity[activity as Id<"activity">]?.effects ?? []) if (effect.type === "activity/start-job" && typeof effect.job === "string") return effect.job;
  return null;
}

/** The changes, the gains first and at most two of them, then the costs. */
function capped(changes: readonly Change[]): Change[] {
  return [...changes.filter((change) => change.tone === "up").slice(0, GAINS_MAX), ...changes.filter((change) => change.tone === "down")];
}

/**
 * A job named on a hunt's card as its pieces (world:one-action-one-sheet, text:show-then-tell, activity:job-hunt-lands-offer): the job's
 * own words for its card where content has them (`<job>.card`), else its blurb, else the hunt's; its pay a month and its own chance as
 * facts, with when it pays where content says it; what lifts the pay next as a gain (activity:side-jobs-pay-by-tier); what the work
 * costs the mood as a tag with a down arrow.
 */
export function jobFacts(view: PlayerView, hunt: string, job: string): ActFacts {
  const pay = payWords(job, view);
  const lift = liftWords(view, job);
  return {
    line: text[`${job}.card`] ?? blurbOf(job) ?? blurbOf(hunt),
    facts: [...(pay === null ? [] : [{ kind: "pay" as const, words: pay }]), { kind: "chance", band: huntBand(chanceOf(view, job)) }, ...whenOf(job)],
    changes: capped([...(lift === null ? [] : [{ tone: "up" as const, words: lift }]), ...effectTagsOf(job)]),
    needs: [],
  };
}

/**
 * An act's sheet as pieces (world:one-action-one-sheet, text:show-then-tell): its line is content's blurb alone; its facts the pay of the
 * work it starts, the English test's chance, the time past a morning, when it pays, a course's months, its bill over months, where it
 * counts and the catch of capital not given back; its changes its gains and its costs to the body or the mood; its needs why it waits,
 * or that it has taught what it can at this level (quality:skill-bands-slow-gains).
 */
export function actFacts(view: PlayerView, option: Pick<ActivityOption, "id" | "halfDays" | "capped" | "onCourse">): ActFacts {
  const id = option.id;
  const facts: Fact[] = [];
  const changes: Change[] = [];
  const needs: Need[] = [];
  // activity:capital-opens-own-work: own work and its kit start a job, its pay a month from next month.
  const started = startedJob(id);
  const pay = started === null ? null : payAMonth(started);
  if (pay !== null) facts.push({ kind: "pay", words: say("jobs.pay", { amount: formatMoney(pay.amount, pay.currency) }) }, { kind: "when", words: say("ui.fact.next-month") });
  // world:one-action-one-sheet: the English test says its chance of the band the route needs before the fee is paid.
  if (id === ENGLISH_TEST) {
    const chance = testChance(view);
    facts.push({ kind: "chance", band: chance.band, words: chance.words });
  }
  // activity:now-acts-spend-half-days: an act done at once says its time in words, only past a morning; content's own time words
  // (`<id>.time`: the talk's "Twenty minutes") where the act's time is not its half-days.
  const time = text[`${id}.time`] ?? timeWordsOf(id, option.halfDays);
  if (time !== null && time !== say("ui.world.time.morning")) facts.push({ kind: "time", words: time });
  facts.push(...whenOf(id));
  // activity:paid-tech-courses: a course's months, what it ends with, and its bill where nothing is paid now.
  const course = courseParts(id);
  if (course !== null) {
    facts.push({ kind: "time", words: course.months });
    changes.push(...course.gains.map((gain) => ({ tone: "up" as const, words: gain })));
  }
  const bill = studyPaysWords(id);
  if (bill !== null) facts.push({ kind: "bill", words: bill });
  // activity:waiting-months-build-profile: where the act counts, by the ways' short names.
  if (countsRoutes(id) !== null) facts.push({ kind: "counts", id });
  // activity:capital-opens-own-work, world:costly-acts-confirmed: the capital is not given back when the work ends.
  if (ownWorkCapital(id)) facts.push({ kind: "catch", words: say("ui.world.capital-kept") });
  // quality:skill-bands-slow-gains: a tech study says its gain at the band held, or that it has taught what it can.
  const study = studyGainNow(view, id);
  if (study?.taught === true) needs.push({ state: "setback", words: say("ui.fact.taught"), id: "taught" });
  else if (study !== null) changes.unshift({ tone: "up", words: study.words });
  changes.push(...effectTagsOf(id).filter((change) => study === null || change.tone === "down"));
  // activity:study-days-capped, activity:paid-tech-courses: a study held back says why.
  const held = heldBackWords(option);
  if (held !== null) needs.push({ state: "waiting", words: held, id: "held" });
  return { line: blurbOf(id), facts, changes: capped(changes), needs };
}

/** What an act still asks, each a cross and the requirement in a few words (world:one-action-one-sheet); `done` leaves out what is already done. */
export function missingNeeds(missing: readonly Requirement[], view: Pick<PlayerView, "routes">, done: (requirement: Requirement) => boolean = () => false): Need[] {
  return missing.filter((requirement) => !done(requirement)).map((requirement, index) => ({ state: "failed" as const, words: requirementSentence(requirement, { routes: view.routes }), id: `missing-${String(index)}` }));
}
