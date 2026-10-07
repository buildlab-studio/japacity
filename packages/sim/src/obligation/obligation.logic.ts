// Obligations: docs/rules/obligation.md. Anything owed on a schedule: upkeep,
// money sent home, loans, funds held for you by a lender. The scenario's
// obligations are real from the first state and get instance ids from the
// engine's counter (R-SCENARIO-002).
import { bp, divCeil } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Currency,
  Effect,
  Id,
  ObligationEntry,
  ObligationSlice,
  ObligationState,
  ReadCtx,
  Reason,
  Rejection,
  ReportLine,
  State,
} from "../engine/types";
import type { ObligationEvent } from "./obligation.events";

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function entryOf(content: Content, id: Id<"obligation">): ObligationEntry {
  const entry = content.obligation[id];
  if (entry === undefined) throw new Error(`There is no obligation ${id} in content.`);
  return entry;
}

/** The instance number of an engine id such as `obligation-12`, or null for any other shape. */
function instanceNumber(id: string): number | null {
  const match = /-(\d+)$/.exec(id);
  return match === null ? null : Number(match[1]);
}

/**
 * Oldest first (R-OBLIGATION-001): by the month opened, then by id. Ids are
 * compared by their instance number, so `obligation-10` comes after
 * `obligation-9` as it was opened after it.
 */
export function oldestFirst(a: ObligationState, b: ObligationState): number {
  if (a.openedMonth !== b.openedMonth) return a.openedMonth - b.openedMonth;
  const na = instanceNumber(a.id);
  const nb = instanceNumber(b.id);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function openItems(state: State): ObligationState[] {
  return Object.values(state.obligation.items).sort(oldestFirst);
}

/** One month's charge, split by the sink it is paid under (R-OBLIGATION-001). */
export interface Charge {
  /** The fixed amount plus the principal part, paid under the entry's sink. */
  base: number;
  /** Interest on the opening principal, paid under the entry's interest sink. */
  interest: number;
  /** The part of `base` that lowers what is owed. */
  principal: number;
}

export function chargeOf(item: ObligationState, entry: ObligationEntry): Charge {
  const interest = bp(item.principal, entry.rateBp);
  // Only a loan repays principal on a schedule; held funds are returned whole (R-OBLIGATION-008).
  const scheduled = entry.type === "loan" && entry.term !== null ? divCeil(item.principal, entry.term) : 0;
  const principal = Math.min(scheduled, item.outstanding);
  return { base: item.amount + principal, interest, principal };
}

/**
 * What the view shows as due this month. A defaulted loan has no charge any
 * more: the lender takes what is owed from the bank (R-OBLIGATION-005).
 * so the view shows what is still owed, the most the lender can take.
 */
function dueNow(item: ObligationState, entry: ObligationEntry): number {
  if (item.state === "defaulted") return item.outstanding;
  const charge = chargeOf(item, entry);
  return charge.base + charge.interest;
}

/**
 * True when this much could be taken from cash and bank now (R-OBLIGATION-002).
 * Naira is judged with `money/can-pay`. A foreign charge is taken from that
 * currency's own pockets, never through naira, so it is judged with
 * `money/min` instead. no obligation in content is foreign yet.
 */
function canTake(ctx: Ctx, currency: Currency, amount: number): boolean {
  if (currency === "NGN") return ctx.check({ type: "money/can-pay", currency, amount }).met;
  return ctx.check({ type: "money/min", currency, amount }).met;
}

function causeOf(item: ObligationState): Cause {
  return { source: item.entry, param: null, terms: { principal: item.principal, amount: item.amount, outstanding: item.outstanding } };
}

function record(ctx: Ctx, event: ObligationEvent): BaseEvent[] {
  return emit(ctx, "obligation", [event]);
}

// ---------------------------------------------------------------------------
// The due phase
// ---------------------------------------------------------------------------

/** Takes money under a reason. Zero takes nothing. */
function take(ctx: Ctx, cause: Cause, currency: Currency, pocket: "any" | "bank" | "locked", amount: number, reason: Reason): void {
  if (amount <= 0) return;
  ctx.apply([{ type: "money/take", currency, pocket, amount, reason }], cause);
}

/**
 * A defaulted loan (R-OBLIGATION-005): no charge and no misses any more. The
 * lender takes whatever is in the bank pocket of the loan's currency, up to
 * what is owed, and the loan closes when nothing is owed.
 * "what is owed" is the principal still outstanding. Interest stops
 * once a loan is in default, and the taking starts in the `due` phase after
 * the one in which it defaulted ("from then on").
 */
function seize(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const amount = Math.min(ctx.state.wallet.pockets[entry.currency].bank, item.outstanding);
  const events: BaseEvent[] = [];
  if (amount > 0) {
    take(ctx, causeOf(item), entry.currency, "bank", amount, entry.sink);
    events.push(...record(ctx, { type: "obligation/seized", id: item.id, entry: item.entry, amount }));
  }
  if (item.outstanding - amount === 0) events.push(...record(ctx, { type: "obligation/closed", id: item.id, entry: item.entry, why: "paid" }));
  return events;
}

/** A charge paid in full (R-OBLIGATION-002): fixed and principal under the sink, interest under the interest sink. */
function pay(ctx: Ctx, item: ObligationState, entry: ObligationEntry, charge: Charge): BaseEvent[] {
  const cause = causeOf(item);
  take(ctx, cause, entry.currency, "any", charge.base, entry.sink);
  take(ctx, cause, entry.currency, "any", charge.interest, entry.interestSink);
  const events = record(ctx, {
    type: "obligation/charged",
    id: item.id,
    entry: item.entry,
    total: charge.base + charge.interest,
    interest: charge.interest,
    principal: charge.principal,
  });
  // R-OBLIGATION-002, 009: only a loan is ever paid off by its charges.
  if (entry.type === "loan" && item.outstanding - charge.principal === 0) {
    events.push(...record(ctx, { type: "obligation/closed", id: item.id, entry: item.entry, why: "paid" }));
  }
  return events;
}

/** A charge that could not be paid (R-OBLIGATION-003, 004, 005, 007). */
function miss(ctx: Ctx, item: ObligationState, entry: ObligationEntry, charge: Charge): BaseEvent[] {
  const cause = causeOf(item);
  if (entry.type === "held-funds") {
    // R-OBLIGATION-007: the lender takes the principal back at once, then onMiss. a missed
    // month on held funds counts no miss and checks no grace, since the obligation is gone.
    const amount = Math.min(ctx.state.wallet.pockets[entry.currency].locked, item.outstanding);
    take(ctx, cause, entry.currency, "locked", amount, "held-funds-return");
    const events = record(ctx, { type: "obligation/taken-back", id: item.id, entry: item.entry, amount });
    ctx.apply(entry.onMiss, cause);
    return events;
  }
  const missed = item.missed + 1;
  const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: charge.base + charge.interest, missed });
  ctx.apply(entry.onMiss, cause);
  // R-OBLIGATION-004: upkeep and support never default. Only a loan goes past its grace.
  // the miss that passes the grace applies onMiss, then onDefault, in that order.
  if (entry.type === "loan" && missed > entry.grace) {
    events.push(...record(ctx, { type: "obligation/defaulted", id: item.id, entry: item.entry, outstanding: item.outstanding }));
    ctx.apply(entry.onDefault, cause);
  }
  return events;
}

/** Everything owed this month, oldest first (R-OBLIGATION-001). */
function due(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  // Ids first, then each item read again: an earlier charge may have changed the state.
  for (const id of openItems(ctx.state).map((item) => item.id)) {
    const item = ctx.state.obligation.items[id];
    if (item === undefined) continue;
    const entry = entryOf(ctx.content, item.entry);
    if (item.state === "defaulted") {
      events.push(...seize(ctx, item, entry));
      continue;
    }
    const charge = chargeOf(item, entry);
    const paid = canTake(ctx, entry.currency, charge.base + charge.interest);
    events.push(...(paid ? pay(ctx, item, entry, charge) : miss(ctx, item, entry, charge)));
  }
  return events;
}

// ---------------------------------------------------------------------------
// Opening: R-OBLIGATION-006
// ---------------------------------------------------------------------------

function openEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "obligation/open") throw new Error(`obligation/open cannot carry out ${effect.type}.`);
  const entry = entryOf(ctx.content, effect.obligation);
  const principal = effect.principal === undefined ? 0 : ctx.amount(effect.principal, cause.terms);
  const amount = effect.amount === undefined ? entry.amount : ctx.amount(effect.amount, cause.terms);
  if (principal < 0 || amount < 0) throw new Error(`${entry.id} cannot open owing a negative amount.`);
  const lends = entry.type === "loan" || entry.type === "held-funds";
  // a loan or held funds of nothing would close before it was ever owed, so nothing opens.
  if (lends && principal === 0) return [];
  const item: ObligationState = {
    id: ctx.nextId("obligation"),
    entry: entry.id,
    state: "active",
    openedMonth: ctx.state.turn.month,
    amount,
    principal,
    outstanding: principal,
    monthsLeft: entry.term,
    missed: 0,
  };
  const events = record(ctx, { type: "obligation/opened", item });
  const credit = { source: item.entry, param: null, terms: cause.terms };
  // The page says the naira bank; every loan in content is in naira, so the entry's currency is the same thing.
  if (entry.type === "loan") {
    ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: principal, reason: "loan", flagged: true }], credit);
  }
  if (entry.type === "held-funds") {
    ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: principal, reason: "held-funds", flagged: true, locked: true }], credit);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Paying early: R-OBLIGATION-008
// ---------------------------------------------------------------------------

function isGoodAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount > 0;
}

function payCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "obligation/pay") throw new Error(`obligation/pay cannot handle ${command.type}.`);
  const item = typeof command.obligation === "string" ? ctx.state.obligation.items[command.obligation] : undefined;
  if (item === undefined) return reject("unknown-id", `There is no open obligation ${String(command.obligation)}.`);
  const entry = entryOf(ctx.content, item.entry);
  const { amount } = command;
  const cause = causeOf(item);
  switch (entry.type) {
    case "upkeep":
    case "support":
      return reject("not-legal", `${entry.id} is paid month by month and cannot be paid ahead.`);
    case "loan": {
      if (!isGoodAmount(amount) || amount > item.outstanding) {
        return reject("bad-amount", `A loan takes a whole amount above zero and up to the ${String(item.outstanding)} owed.`);
      }
      if (!canTake(ctx, entry.currency, amount)) return reject("cannot-afford", "There is not that much in cash and the bank together.");
      take(ctx, cause, entry.currency, "any", amount, "loan-repay");
      const events = record(ctx, { type: "obligation/repaid", id: item.id, entry: item.entry, amount });
      if (amount === item.outstanding) events.push(...record(ctx, { type: "obligation/closed", id: item.id, entry: item.entry, why: "paid" }));
      return events;
    }
    case "held-funds": {
      if (!isGoodAmount(amount) || amount !== item.outstanding) {
        return reject("bad-amount", `Held funds go back whole: ${String(item.outstanding)}.`);
      }
      if (ctx.state.wallet.pockets[entry.currency].locked < amount) return reject("cannot-afford", "The locked pocket holds less than the principal.");
      take(ctx, cause, entry.currency, "locked", amount, "held-funds-return");
      return record(ctx, { type: "obligation/closed", id: item.id, entry: item.entry, why: "returned" });
    }
    default: {
      const never: never = entry.type;
      throw new Error(`Unknown obligation type ${String(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Evolve
// ---------------------------------------------------------------------------

function withItem(slice: ObligationSlice, id: string, change: (item: ObligationState) => ObligationState): ObligationSlice {
  const item = slice.items[id];
  if (item === undefined) throw new Error(`There is no open obligation ${id}.`);
  return { ...slice, items: { ...slice.items, [id]: change(item) } };
}

function without(slice: ObligationSlice, id: string): ObligationSlice {
  const items = { ...slice.items };
  delete items[id];
  return { ...slice, items };
}

function evolve(slice: ObligationSlice, event: ObligationEvent, _state: State, content: Content): ObligationSlice {
  switch (event.type) {
    case "obligation/opened":
      return { ...slice, items: { ...slice.items, [event.item.id]: event.item } };
    case "obligation/charged":
      return withItem(slice, event.id, (item) => ({
        ...item,
        // A paid charge ends a grace (R-OBLIGATION-003).
        state: item.state === "grace" ? "active" : item.state,
        outstanding: item.outstanding - event.principal,
        monthsLeft: item.monthsLeft === null ? null : Math.max(0, item.monthsLeft - 1),
        missed: 0,
      }));
    case "obligation/missed":
      return withItem(slice, event.id, (item) => ({
        ...item,
        // Only a loan has a grace to be in. Upkeep and support carry no arrears (R-OBLIGATION-004).
        state: item.state === "active" && entryOf(content, item.entry).type === "loan" ? "grace" : item.state,
        missed: event.missed,
      }));
    case "obligation/defaulted":
      return withItem(slice, event.id, (item) => ({ ...item, state: "defaulted" }));
    case "obligation/seized":
    case "obligation/repaid":
      return withItem(slice, event.id, (item) => ({ ...item, outstanding: item.outstanding - event.amount }));
    case "obligation/taken-back":
    case "obligation/closed":
      return without(slice, event.id);
    default: {
      const never: never = event;
      throw new Error(`Unknown obligation event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention: boolean): ReportLine {
  return { key, params, tone, attention, counts: [] };
}

function lines(event: ObligationEvent): ReportLine[] {
  switch (event.type) {
    case "obligation/charged":
      // Said quietly: the wallet's own lines already show the money leaving.
      return event.total === 0 ? [] : [line("line.obligation.charged", { obligation: event.entry, amount: event.total }, "plain", false)];
    case "obligation/missed":
      return [line("line.obligation.missed", { obligation: event.entry, amount: event.total }, "bad", true)];
    case "obligation/defaulted":
      return [line("line.obligation.defaulted", { obligation: event.entry, amount: event.outstanding }, "bad", true)];
    case "obligation/seized":
      // the brief lists no line for this; without one the wallet's "loan repayment" line would hide that it was taken.
      return [line("line.obligation.seized", { obligation: event.entry, amount: event.amount }, "bad", false)];
    case "obligation/taken-back":
      return [line("line.obligation.taken-back", { obligation: event.entry, amount: event.amount }, "bad", true)];
    case "obligation/closed":
      return [line("line.obligation.closed", { obligation: event.entry }, "good", false)];
    case "obligation/opened":
    case "obligation/repaid":
      // The wallet's line for the loan, the locked money or the repayment says it.
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown obligation event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Invariants and the view
// ---------------------------------------------------------------------------

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  for (const [id, item] of Object.entries(state.obligation.items)) {
    if (item.id !== id) problems.push(`Obligation ${id} is stored under the wrong key.`);
    const entry = content.obligation[item.entry];
    if (entry === undefined) {
      problems.push(`Obligation ${id} names ${item.entry}, which is not in content.`);
      continue;
    }
    for (const [name, value] of Object.entries({ amount: item.amount, principal: item.principal, outstanding: item.outstanding, missed: item.missed })) {
      if (!Number.isSafeInteger(value) || value < 0) problems.push(`Obligation ${id} has ${name} ${String(value)}.`);
    }
    if (item.outstanding > item.principal) problems.push(`Obligation ${id} owes ${String(item.outstanding)}, more than its principal ${String(item.principal)}.`);
    if (item.state !== "active" && entry.type !== "loan") problems.push(`Obligation ${id} is ${item.state}, but only a loan has a grace or a default.`);
  }
  return problems;
}

export function obligationsView(read: ReadCtx): (ObligationState & { due: number })[] {
  return openItems(read.state).map((item) => ({ ...item, due: dueNow(item, entryOf(read.content, item.entry)) }));
}

// ---------------------------------------------------------------------------
// The kind
// ---------------------------------------------------------------------------

export const obligationKind: RegisteredKind<ObligationSlice, ObligationEvent> = {
  kind: "obligation",
  initial(scenario, _content, ids) {
    if (ids === undefined) throw new Error("The obligation kind needs an id source to open the scenario's obligations.");
    const items: ObligationSlice["items"] = {};
    for (const owed of scenario.obligations) {
      const id = ids.next("obligation");
      items[id] = {
        id,
        entry: owed.obligation,
        state: "active",
        openedMonth: 0,
        amount: owed.amount,
        principal: 0,
        outstanding: 0,
        monthsLeft: null,
        missed: 0,
      };
    }
    return { items };
  },
  commands: { "obligation/pay": payCommand },
  effects: { "obligation/open": openEffect },
  phases: { due },
  evolve,
  lines,
  invariants,
  view: (read) => ({ obligations: obligationsView(read) }),
};
