// The ledger report: wallet:ledger-report-raises-alarms. Pure: it reads only
// the totals the ledger already keeps and the content, never the world, so the
// authority can run it over every saved account.
import { jobTerms, MONTHS_PER_YEAR, paidYearly } from "../activity/activity.pay";
import { bp, divCeil } from "../engine/int";
import type { ActivityEntry, Content, Currency, Effect, Reason, State } from "../engine/types";

type Totals = State["wallet"]["totals"]["in"];

/** A reason whose money in is more than it can make in the months played. */
interface LedgerAlarm {
  reason: Reason;
  currency: Currency;
  total: number;
  ceiling: number;
}

export interface LedgerReport {
  months: number;
  /** Money that came into being, by reason and currency. The two transfers are left out: they only move money. */
  created: Totals;
  /** Money that left the game, by reason and currency, transfers left out. */
  destroyed: Totals;
  alarms: LedgerAlarm[];
  /** True when any alarm stands: the account is named as suspect. */
  suspect: boolean;
}

// A remit leaves one currency and arrives in another, so it creates and destroys nothing either.
const TRANSFERS: readonly Reason[] = ["convert", "move", "remit"];
const TECH = "quality.tech" as const;

function withoutTransfers(totals: Totals): Totals {
  const kept: Totals = {};
  for (const [reason, byCurrency] of Object.entries(totals)) {
    if (!TRANSFERS.includes(reason as Reason) && byCurrency !== undefined) kept[reason as Reason] = { ...byCurrency };
  }
  return kept;
}

/**
 * The most a job pays in a month, rounded up, bonus included: a sponsor's job
 * from the salary recorded on the route. Null when its pay reads nothing in hand.
 */
function bestMonth(entry: ActivityEntry, state: State, content: Content): number | null {
  if (entry.pay === null) return null;
  const { amount } = entry.pay;
  let figure: number | null = null;
  if (typeof amount === "number") figure = amount;
  else if ("term" in amount) {
    const term = jobTerms({ state, content })[amount.term];
    figure = typeof term === "number" ? (amount.bp === undefined ? term : bp(term, amount.bp)) : null;
  }
  if (figure === null) return null;
  const bonus = entry.carBonus ?? 0;
  return paidYearly(entry) ? divCeil(figure + bonus, MONTHS_PER_YEAR) : figure + divCeil(bonus, MONTHS_PER_YEAR);
}

/** The best a month of one kind of job pays in a currency: main jobs paid to the bank, cash jobs, or side jobs. */
function bestPay(state: State, content: Content, currency: Currency, fits: (entry: ActivityEntry) => boolean): number {
  let best = 0;
  for (const entry of Object.values(content.activity)) {
    if (entry.pay?.currency !== currency || !fits(entry)) continue;
    best = Math.max(best, bestMonth(entry, state, content) ?? 0);
  }
  return best;
}

/** The most one free slot of side gigs can pay, at the highest tech. */
function bestGig(content: Content): number {
  const tech = content.quality[TECH]?.max ?? 0;
  let best = 0;
  for (const entry of Object.values(content.activity)) {
    for (const effect of entry.effects) if (effect.type === "activity/gig") best = Math.max(best, effect.max + effect.perTech * tech);
  }
  return best;
}

/** Everything the prologue can pay under a reason, once. */
function prologueAllowance(content: Content, reason: Reason, currency: Currency): number {
  const paid = (effects: readonly Effect[]): number =>
    effects.reduce((sum, effect) => sum + (effect.type === "money/add" && effect.reason === reason && effect.currency === currency && typeof effect.amount === "number" ? effect.amount : 0), 0);
  let total = 0;
  for (const step of Object.values(content.prologue)) {
    for (const answer of step.answers) total += paid(answer.effects) + (answer.draw ?? []).reduce((sum, outcome) => sum + paid(outcome.effects), 0);
  }
  return total;
}

type Ceiling = (currency: Currency, state: State, content: Content) => number;

/** A month's main job with overtime in every free slot, over the months played. */
function working(main: number, state: State, content: Content): number {
  const { turn, ladder } = content.tuning;
  return state.turn.month * (main + turn.freeSlots * bp(main, ladder.overtimeBp));
}

/**
 * What a reason can make in a currency over the months played. Salary: the best
 * main job's month, plus overtime in every free slot, plus the best side job paid
 * to the bank. Cash work: the best cash job the same way. Gig: a side gig in every
 * free slot and the best side job paid in cash, plus what the prologue pays.
 * Opening: the richest starting life. Pot-top-up: nothing (decision 0016).
 * A reason with no ceiling here raises no alarm.
 */
const CEILINGS: Partial<Record<Reason, Ceiling>> = {
  salary: (currency, state, content) =>
    working(bestPay(state, content, currency, (entry) => entry.slot === "main" && entry.cash !== true), state, content) +
    state.turn.month * bestPay(state, content, currency, (entry) => entry.slot === "side" && currency !== "NGN"),
  "cash-work": (currency, state, content) => working(bestPay(state, content, currency, (entry) => entry.slot === "main" && entry.cash === true), state, content),
  gig: (currency, state, content) => {
    const side = bestPay(state, content, currency, (entry) => entry.slot === "side" && currency === "NGN");
    const gigs = currency === "NGN" ? content.tuning.turn.freeSlotsNoJob * bestGig(content) : 0;
    return state.turn.month * (gigs + side) + prologueAllowance(content, "gig", currency);
  },
  opening: (currency, _state, content) =>
    Object.values(content.scenario).reduce((best, life) => {
      const pocket = life.pockets[currency];
      return Math.max(best, pocket === undefined ? 0 : pocket.bank + pocket.cash);
    }, 0),
  "pot-top-up": () => 0,
};

/**
 * wallet:ledger-report-raises-alarms: money created and destroyed by reason and currency, and the alarms that name an account as suspect.
 * `topUp` is the ceiling for `top-up` in naira, the processor's receipts for the account (wallet:top-ups-are-marked); with none
 * fed in it is 0, so any top-up names the account. A top-up in any other currency has no receipts at all.
 */
export function ledgerReport(state: State, content: Content, topUp = 0): LedgerReport {
  const created = withoutTransfers(state.wallet.totals.in);
  const alarms: LedgerAlarm[] = [];
  for (const [reason, byCurrency] of Object.entries(created)) {
    for (const [currency, total] of Object.entries(byCurrency ?? {})) {
      const ceiling = reason === "top-up" ? (currency === "NGN" ? topUp : 0) : (CEILINGS[reason as Reason]?.(currency as Currency, state, content) ?? null);
      if (ceiling !== null && (total ?? 0) > ceiling) alarms.push({ reason: reason as Reason, currency: currency as Currency, total: total ?? 0, ceiling });
    }
  }
  return { months: state.turn.month, created, destroyed: withoutTransfers(state.wallet.totals.out), alarms, suspect: alarms.length > 0 };
}
