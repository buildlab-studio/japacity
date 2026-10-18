// The sponsor's undertaking: docs/rules/undertaking.md R-UNDERTAKING-006 to
// 009 and 012. The obligation kind calls these for an undertaking whose sink is
// `undertaking`; any other undertaking (a guarantee) keeps the kind's own path.
import { worldVar } from "../engine/check";
import { isWhole } from "../engine/int";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type { BaseEvent, Cause, Ctx, Effect, Id, ObligationEntry, ObligationState, ReadCtx, Rejection, State } from "../engine/types";
import { spendable } from "../wallet/wallet.rates";
import type { ObligationEvent } from "./obligation.events";

const ASSISTANCE: Id<"var"> = "var.ca-assistance";

/** The sponsor's undertaking, told from a guarantee by the reason it is paid under. */
export function isSponsorUndertaking(entry: ObligationEntry): boolean {
  return entry.type === "undertaking" && entry.sink === "undertaking";
}

function record(ctx: Ctx, events: ObligationEvent[]): BaseEvent[] {
  return emit(ctx, "obligation", events);
}

function causeOf(item: ObligationState): Cause {
  return { source: item.entry, param: null, terms: {} };
}

/** R-UNDERTAKING-006, 009: the undertaking's months, counted from the month it opened. */
function termEnds(read: ReadCtx, item: ObligationState): number {
  return item.openedMonth + read.content.tuning.undertaking.months;
}

/** R-UNDERTAKING-012: months left of the undertaking, for the view. */
export function undertakingMonthsLeft(read: ReadCtx, item: ObligationState): number {
  return Math.max(0, termEnds(read, item) - read.state.turn.month);
}

/** The bond an undertaking opens for: the one the effect names, else the sponsorship on record. */
function bondOf(state: State, bond: string | undefined): string | null {
  if (bond !== undefined && state.people.bonds[bond] !== undefined) return bond;
  return state.people.sponsoring?.bond ?? null;
}

/** R-UNDERTAKING-006: open with nothing owed, naming the bond. */
export function openUndertaking(ctx: Ctx, entry: ObligationEntry, bond: string | undefined): BaseEvent[] {
  const item: ObligationState = {
    id: ctx.nextId("obligation"),
    entry: entry.id,
    state: "active",
    openedMonth: ctx.state.turn.month,
    amount: 0,
    principal: 0,
    outstanding: 0,
    // The months left are read from the month it opened; a month with nothing owed records nothing to count them by.
    monthsLeft: null,
    missed: 0,
    bond: bondOf(ctx.state, bond),
    charged: 0,
  };
  return record(ctx, [{ type: "obligation/opened", item }]);
}

/** The effect `obligation/open` naming the bond, for the people kind to apply when the authority sends `people/agreed` with `landed` (R-UNDERTAKING-006). */
export function undertakingOpening(obligation: Id<"obligation">, bond: string): Effect {
  return { type: "obligation/open", obligation, bond };
}

/** R-UNDERTAKING-007: months of assistance in the partner's facts not yet charged. A bond that has gone keeps its last facts. */
function newMonths(state: State, item: ObligationState): number {
  const taken = item.bond === null ? 0 : (state.people.bonds[item.bond]?.facts?.assistanceTaken ?? 0);
  return Math.max(0, taken - item.charged);
}


/** R-UNDERTAKING-007: from the bank pocket first, then cash. The caller has judged that both together hold it. */
function takeBankFirst(ctx: Ctx, item: ObligationState, entry: ObligationEntry, amount: number): void {
  const fromBank = Math.min(ctx.state.wallet.pockets[entry.currency].bank, amount);
  const takes: Effect[] = [];
  if (fromBank > 0) takes.push({ type: "money/take", currency: entry.currency, pocket: "bank", amount: fromBank, reason: entry.sink });
  if (amount - fromBank > 0) takes.push({ type: "money/take", currency: entry.currency, pocket: "cash", amount: amount - fromBank, reason: entry.sink });
  ctx.apply(takes, causeOf(item));
}

/** R-UNDERTAKING-008: in default, what is owed is taken from the bank pocket as R-OBLIGATION-005 takes a defaulted loan. */
function collect(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const amount = Math.min(ctx.state.wallet.pockets[entry.currency].bank, item.outstanding);
  if (amount === 0) return [];
  ctx.apply([{ type: "money/take", currency: entry.currency, pocket: "bank", amount, reason: entry.sink }], causeOf(item));
  const events = record(ctx, [{ type: "obligation/seized", id: item.id, entry: item.entry, amount }]);
  // What is owed taken in full lifts the default, as paying it all does (R-UNDERTAKING-008).
  return item.outstanding === amount ? [...events, ...record(ctx, [{ type: "obligation/cleared", id: item.id, entry: item.entry }])] : events;
}

/**
 * R-UNDERTAKING-007, 008: everything owed is asked for at once, paid in full or
 * missed. A missed charge is asked for again each month with what is
 * new, and each month it cannot be paid is one more miss in a row.
 */
function charge(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const total = item.outstanding;
  if (spendable(ctx.state.wallet.pockets[entry.currency]) >= total) {
    takeBankFirst(ctx, item, entry, total);
    return record(ctx, [{ type: "obligation/charged", id: item.id, entry: item.entry, total, interest: 0, principal: total }]);
  }
  const missed = item.missed + 1;
  const events = record(ctx, [{ type: "obligation/missed", id: item.id, entry: item.entry, total, missed }]);
  ctx.apply(entry.onMiss, causeOf(item));
  if (missed <= entry.grace) return events;
  events.push(...record(ctx, [{ type: "obligation/defaulted", id: item.id, entry: item.entry, outstanding: total }]));
  ctx.apply(entry.onDefault, causeOf(item));
  return events;
}

/** The `due` phase for one sponsor's undertaking (R-UNDERTAKING-007 to 009). A month with nothing new and nothing owed records nothing. */
export function undertakingDue(ctx: Ctx, start: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const events: BaseEvent[] = [];
  const months = newMonths(ctx.state, start);
  if (months > 0) {
    const amount = months * worldVar(ctx, ASSISTANCE);
    events.push(...record(ctx, [{ type: "obligation/assessed", id: start.id, entry: start.entry, months, amount }]));
  }
  const item = ctx.state.obligation.items[start.id];
  if (item === undefined) return events;
  // The default was in force before this month's charge, so collection starts the month after it (R-UNDERTAKING-008).
  if (start.state === "defaulted") events.push(...collect(ctx, item, entry));
  else if (item.outstanding > 0) events.push(...charge(ctx, item, entry));
  const after = ctx.state.obligation.items[start.id];
  // R-UNDERTAKING-009: only the end of its months with nothing owed closes it; the bond, the place and the status do not.
  if (after !== undefined && after.outstanding === 0 && ctx.state.turn.month >= termEnds(ctx, after)) {
    events.push(...record(ctx, [{ type: "obligation/closed", id: after.id, entry: after.entry, why: "ended" }]));
  }
  return events;
}

/** R-UNDERTAKING-008: `obligation/pay` pays down what is owed, bank first; paying it all lifts the default. */
export function payUndertaking(ctx: Ctx, item: ObligationState, entry: ObligationEntry, amount: unknown): BaseEvent[] | Rejection {
  if (item.outstanding === 0) return reject("not-legal", "Nothing is owed on the undertaking.");
  if (!isWhole(amount) || amount <= 0 || amount > item.outstanding) {
    return reject("bad-amount", `The undertaking takes a whole amount above zero and up to the ${String(item.outstanding)} owed.`);
  }
  if (spendable(ctx.state.wallet.pockets[entry.currency]) < amount) return reject("cannot-afford", "There is not that much in the bank and cash together.");
  takeBankFirst(ctx, item, entry, amount);
  const events = record(ctx, [{ type: "obligation/repaid", id: item.id, entry: item.entry, amount }]);
  const cleared = amount === item.outstanding && (item.state !== "active" || item.missed > 0);
  return cleared ? [...events, ...record(ctx, [{ type: "obligation/cleared", id: item.id, entry: item.entry }])] : events;
}
