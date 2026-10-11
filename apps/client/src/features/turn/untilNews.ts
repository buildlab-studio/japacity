// Until news (docs/rules/world.md R-WORLD-028): the months a run ends one after another, each its own
// `turn/end` with the commitments carried on (R-WORLD-007), and what stops the run. The store runs it; these are plain
// functions over the view and the month's lines, so the stop is the same wherever it is read.
import { content } from "@japacity/content";
import { int, type Amount, type OfferEntry, type PlayerView, type ReportLine, type SlotPick } from "@japacity/sim";

import { plannable } from "../../shared/words/acts";
import { atBankRate } from "../../shared/words/cost";
import { CREDIT_DOWN, CREDIT_UP, isUnpaid, localCurrency } from "./month.results";

/** The most months one run ends. */
export const RUN_MONTHS = 6;
/** The run stops once the months to play are down to this many (the rule's "three months or fewer"). */
export const RUN_LOW_BANK = 3;

/** Why a run stopped: the reasons the rule lists, each its own word. */
export type RunStop = "attention" | "landed" | "dues" | "bank" | "ask" | "job" | "clock" | "goal" | "months" | "ended";

/** The job lost, a status clock started (R-STATUS-003), a goal reached: each stops a run, whatever its line asks. */
const JOB_LOST = "line.activity.job-ended";
const CLOCK_STARTED = "line.status.clock-started";
const GOAL_DONE = "line.goal.done";

const OPENED = "line.offer.opened";

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

/** An amount as a number, from the terms the open offer fixed; null when it is not known from the view. */
function amountOf(amount: Amount, terms: Record<string, unknown>): number | null {
  if (typeof amount === "number") return amount;
  if (!("term" in amount)) return null;
  const value = terms[amount.term];
  if (typeof value !== "number") return null;
  return amount.bp === undefined ? value : int.bp(value, amount.bp);
}

/**
 * The most one answer to an ask can cost, in naira at the bank rate, from its choices' debits and the
 * terms it opened with; null when a debit's figure is not known, which counts as above any cap.
 */
export function askCost(entry: OfferEntry, terms: Record<string, unknown>, view: Pick<PlayerView, "pockets" | "rates">): number | null {
  let most = 0;
  for (const choice of entry.choices) {
    let cost = 0;
    for (const effect of choice.effects) {
      if (effect.type !== "money/take" && effect.type !== "money/pay-fee") continue;
      const amount = amountOf(effect.amount, terms);
      if (amount === null) return null;
      cost += atBankRate(view, effect.currency, amount);
    }
    most = Math.max(most, cost);
  }
  return most;
}

/**
 * True for a small ask abroad that a run passes (R-WORLD-028). The offer kind answers it by its
 * `onExpire` when its month comes (R-OFFER-005).
 */
export function quietAsk(entry: OfferEntry | undefined, terms: Record<string, unknown>, view: Pick<PlayerView, "place" | "pockets" | "rates">): boolean {
  if (entry === undefined || entry.news !== false || view.place.where !== "abroad") return false;
  const cost = askCost(entry, terms, view);
  return cost !== null && cost <= atBankRate(view, "GBP", content.tuning.turn.quietAskCap);
}

/** True for a line that opens a small ask a run passes (R-WORLD-028). */
function opensQuietAsk(view: PlayerView, line: ReportLine): boolean {
  if (line.key !== OPENED || typeof line.params["offer"] !== "string") return false;
  const entry = content.offer[line.params["offer"] as OfferEntry["id"]];
  const open = view.offers.find((offer) => offer.entry === line.params["offer"]);
  return quietAsk(entry, open?.terms ?? {}, view);
}

/**
 * What stops a run after a month (R-WORLD-028, and the life over), from the view after it and the
 * month's lines, or the report's when they are not given. Empty when the month was quiet.
 */
export function stopsRun(view: PlayerView, lines: readonly ReportLine[], months: number): RunStop[] {
  const stops: RunStop[] = [];
  const read = lines.length > 0 ? lines : (view.report?.lines ?? []);
  if (read.some((line) => line.attention && !opensQuietAsk(view, line))) stops.push("attention");
  if (read.some((line) => LANDED.has(line.key))) stops.push("landed");
  if (read.some(isUnpaid) || duesShort(view)) stops.push("dues");
  if (view.turns.banked <= RUN_LOW_BANK) stops.push("bank");
  if (view.setpiece !== null || (view.interview?.question ?? null) !== null) stops.push("ask");
  if (read.some((line) => line.key === JOB_LOST)) stops.push("job");
  if (read.some((line) => line.key === CLOCK_STARTED)) stops.push("clock");
  if (read.some((line) => line.key === GOAL_DONE)) stops.push("goal");
  if (months >= RUN_MONTHS) stops.push("months");
  if (view.ended) stops.push("ended");
  return stops;
}

/** The credit file's move over one month of a run as a line the quiet month carries, or null when it held. */
export function creditMoved(before: Pick<PlayerView, "credit">, after: Pick<PlayerView, "credit">): ReportLine | null {
  const from = before.credit?.mark ?? null;
  const to = after.credit?.mark ?? null;
  if (from === null || to === null || from === to) return null;
  return { key: to > from ? CREDIT_UP : CREDIT_DOWN, params: {}, tone: to > from ? "good" : "bad", attention: false, counts: [] };
}

/** True when the view still lets this pick be planned: allowed, paid for, and its param still on offer. */
function stillOpen(view: Pick<PlayerView, "activities">, pick: SlotPick): boolean {
  const option = view.activities.find((entry) => entry.id === pick.activity);
  if (option === undefined || !option.allowed || !option.affordable) return false;
  return option.params === null || pick.param === null || option.params.includes(pick.param);
}

/**
 * R-WORLD-007: commitments, not a plan each month. A month-act the player
 * started carries on into the next month until it is stopped, or until it ends itself: the view no longer allows it
 * or it can no longer be paid (a course finished, a way shut), or it was the search for a job now held. A now-act is
 * never carried, nor rest, which an empty slot already is. The free time the life has is the limit (R-TURN-006).
 */
export function carriedPlan(plan: readonly (SlotPick | null)[], view: Pick<PlayerView, "freeSlots" | "job" | "activities">): SlotPick[] {
  return plan
    .filter((pick): pick is SlotPick => pick !== null && plannable(pick.activity))
    .filter((pick) => !huntsHeldJob(pick, view.job) && stillOpen(view, pick))
    .slice(0, view.freeSlots);
}
