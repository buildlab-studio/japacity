// Until news (docs/rules/world.md R-WORLD-028): the months a run ends one after another, each its own
// `turn/end` with last month's slots, and what stops the run. The store runs it; these are plain
// functions over the view and the month's lines, so the stop is the same wherever it is read.
import { content } from "@japacity/content";
import type { PlayerView, ReportLine, SlotPick } from "@japacity/sim";

import { isUnpaid, localCurrency } from "./month.results";

/** The most months one run ends. */
export const RUN_MONTHS = 6;
/** The run stops once the months to play are down to this many (the rule's "three months or fewer"). */
export const RUN_LOW_BANK = 3;

/** Why a run stopped: the reasons the rule lists, each its own word. */
export type RunStop = "attention" | "landed" | "dues" | "bank" | "ask" | "months" | "ended";

/** A paper issued, or an answer: a school's, a visa's, an invitation, a sponsor's, an endorsing body's. */
const LANDED: ReadonlySet<string> = new Set([
  "line.document.issued",
  "line.document.issued-band",
  "line.document.faked",
  "line.route.school-offer",
  "line.route.school-rejected",
  "line.route.granted",
  "line.route.refused",
  "line.route.invited",
  "line.route.sponsor-recorded",
  "line.route.sponsor-under-bar",
  "line.route.endorsement-refused",
]);

const HUNT = "activity.job-hunt";

/** A hunt for a job the character already holds: last month's search, done now that it paid off. */
export function huntsHeldJob(pick: SlotPick | null, job: PlayerView["job"]): boolean {
  return pick !== null && pick.activity === HUNT && pick.param !== null && (pick.param === job.id || pick.param === job.side);
}

/**
 * The money due this month in the money the character lives on, against what is held of it: true
 * when it is not covered. Abroad that is the country's money (R-WORLD-003's gap); at home the naira.
 */
function duesShort(view: Pick<PlayerView, "place" | "pockets" | "obligations">): boolean {
  const currency = localCurrency(view);
  const due = view.obligations.reduce((sum, owed) => (owed.due > 0 && (content.obligation[owed.entry]?.currency ?? "NGN") === currency ? sum + owed.due : sum), 0);
  const pocket = view.pockets[currency];
  return due > pocket.bank + pocket.cash;
}

/**
 * What stops a run after a month (R-WORLD-028), from the view after it and the month's lines: a
 * report that asks for attention, a paper or an answer landing, dues not covered, the months to play
 * at three or fewer, a set piece or an interview question open, the sixth month, or the life over.
 * Empty when the month was quiet and the run goes on.
 */
export function stopsRun(view: PlayerView, lines: readonly ReportLine[], months: number): RunStop[] {
  const stops: RunStop[] = [];
  if (view.report?.attention === true || lines.some((line) => line.attention)) stops.push("attention");
  if (lines.some((line) => LANDED.has(line.key))) stops.push("landed");
  if (lines.some(isUnpaid) || duesShort(view)) stops.push("dues");
  if (view.turns.banked <= RUN_LOW_BANK) stops.push("bank");
  if (view.setpiece !== null || (view.interview?.question ?? null) !== null) stops.push("ask");
  if (months >= RUN_MONTHS) stops.push("months");
  if (view.ended) stops.push("ended");
  return stops;
}

/** True when the view still lets this pick be planned: allowed, paid for, and its param still on offer. */
function stillOpen(view: Pick<PlayerView, "activities">, pick: SlotPick): boolean {
  const option = view.activities.find((entry) => entry.id === pick.activity);
  if (option === undefined || !option.allowed || !option.affordable) return false;
  return option.params === null || pick.param === null || option.params.includes(pick.param);
}

/**
 * Last month's slots again (Same again, R-WORLD-007) for the next month of a run: the picks that
 * fill a slot and are still open, never the search for a job now held. A pick that fills no slot (the
 * word of someone who went) was a one-off and is not asked twice. A slot left out rests.
 */
export function againSlots(view: Pick<PlayerView, "lastSlots" | "freeSlots" | "job" | "activities">): SlotPick[] {
  return view.lastSlots
    .filter((pick) => content.activity[pick.activity]?.slot !== "none")
    .filter((pick) => !huntsHeldJob(pick, view.job) && stillOpen(view, pick))
    .slice(0, view.freeSlots);
}
