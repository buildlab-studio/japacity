// Money: docs/rules/wallet.md. One pocket set per currency: bank, cash and
// locked. The opening balances are recorded as credits with the reason
// `opening` (R-SCENARIO-002), so the ledger identity of R-WALLET-002 holds
// from the first state.
import { resolveAmount } from "../engine/check";
import { bp, convertMinor, mulDiv, mulDivCeil, valueInKobo } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  Amount,
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Currency,
  Effect,
  ForeignCurrency,
  Id,
  Lot,
  MoneyParam,
  Pocket,
  PocketBalance,
  ReadCtx,
  Reason,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  State,
  Terms,
  Tuning,
  WalletSlice,
  World,
} from "../engine/types";

/** Every foreign currency, in the order the rates are listed. */
const FOREIGN_CURRENCIES: readonly ForeignCurrency[] = ["GBP", "USD", "CAD", "AED", "EUR"];
import type { AnyPocket, RemitChannel, WalletEvent } from "./wallet.events";

/** Every pocket the wallet keeps: naira and each foreign currency (R-ABROAD-001). */
const CURRENCIES: readonly Currency[] = ["NGN", ...FOREIGN_CURRENCIES];
const ALLOWANCE: Id<"var"> = "var.fx-bank-allowance";
const QUEUE: Id<"var"> = "var.fx-bank-queue";

/** Reasons money comes in under. Every other reason except the two transfers is money going out. */
export const SOURCES: readonly Reason[] = ["opening", "salary", "gig", "gift", "sale", "loan", "held-funds", "refund", "deposit-return", "cash-work", "win", "remit"];
/** A bank remit waits in the queue under an id with this prefix and arrives under `remit` (R-ABROAD-006). */
const REMIT_PREFIX = "remit";

/**
 * The report line for each reason. The two transfers have lines of their own,
 * shown once for the pair, so they map to null here.
 */
export const REASON_LINE: Record<Reason, string | null> = {
  opening: "line.wallet.opening",
  salary: "line.wallet.salary",
  gig: "line.wallet.gig",
  gift: "line.wallet.gift",
  sale: "line.wallet.sale",
  loan: "line.wallet.loan",
  "held-funds": "line.wallet.held-funds",
  refund: "line.wallet.refund",
  upkeep: "line.wallet.upkeep",
  family: "line.wallet.family",
  "fee-document": "line.wallet.fee-document",
  "fee-test": "line.wallet.fee-test",
  "fee-school": "line.wallet.fee-school",
  "fee-visa": "line.wallet.fee-visa",
  "fee-surcharge": "line.wallet.fee-surcharge",
  "fee-agent": "line.wallet.fee-agent",
  "fee-advice": "line.wallet.fee-advice",
  "bank-charge": "line.wallet.bank-charge",
  "loan-repay": "line.wallet.loan-repay",
  "loan-interest": "line.wallet.loan-interest",
  "held-funds-return": "line.wallet.held-funds-return",
  "held-funds-interest": "line.wallet.held-funds-interest",
  study: "line.wallet.study",
  social: "line.wallet.social",
  mishap: "line.wallet.mishap",
  flight: "line.wallet.flight",
  "short-count": "line.wallet.short-count",
  rent: "line.wallet.rent",
  "deposit-return": "line.wallet.deposit-return",
  phone: "line.wallet.phone",
  "car-payment": "line.wallet.car-payment",
  "car-deposit": "line.wallet.car-deposit",
  remit: "line.wallet.remit",
  "remit-fee": "line.wallet.remit-fee",
  "cash-work": "line.wallet.cash-work",
  tax: "line.wallet.tax",
  "agent-debt": "line.wallet.agent-debt",
  ransom: "line.wallet.ransom",
  fare: "line.wallet.fare",
  build: "line.wallet.build",
  win: "line.wallet.win",
  "pot-top-up": "line.wallet.pot-top-up",
  ticket: "line.wallet.ticket",
  wedding: "line.wallet.wedding",
  undertaking: "line.wallet.undertaking",
  assistance: "line.wallet.assistance",
  convert: null,
  move: null,
};

// ---------------------------------------------------------------------------
// Reading the world
// ---------------------------------------------------------------------------

/**
 * A world variable the wallet reads, with what holds when the content has no
 * such variable. the engine's mini content has no foreign-exchange
 * variables, so the wallet reads a missing queue as no queue and a missing
 * allowance as none. The real content has both, so this only touches fixtures.
 */
function varOr(world: World, id: Id<"var">, missing: number): number {
  return (world.vars as Record<string, number | undefined>)[id] ?? missing;
}

function officialRates(world: World): Record<ForeignCurrency, number> {
  const rates = {} as Record<ForeignCurrency, number>;
  for (const currency of FOREIGN_CURRENCIES) rates[currency] = world.rates[currency].official;
  return rates;
}

function streetRates(world: World): Record<ForeignCurrency, number> {
  const rates = {} as Record<ForeignCurrency, number>;
  for (const currency of FOREIGN_CURRENCIES) rates[currency] = world.rates[currency].street;
  return rates;
}

function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/** R-WALLET-012: a whole number above zero. */
function isGoodAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount > 0;
}

/** US cents bought at the bank this month (R-WALLET-005). A record from an earlier month counts as nothing. */
function boughtThisMonth(state: State): number {
  return state.wallet.bought.month === state.turn.month ? state.wallet.bought.cents : 0;
}

/** What may still be bought at the bank this month, in US cents. */
export function allowanceLeft(read: ReadCtx): number {
  return Math.max(0, varOr(read.world, ALLOWANCE, 0) - boughtThisMonth(read.state));
}

/** R-WALLET-005, 006: the allowance is the Lagos bank's, so the view shows none abroad. */
function allowanceShown(read: ReadCtx): number | null {
  return atHome(read.state) ? allowanceLeft(read) : null;
}

/** The allowance and the queue are the Lagos bank's, so they bind only at home. */
function atHome(state: State): boolean {
  return state.place.where === "home";
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function credit(currency: Currency, pocket: AnyPocket, amount: number, reason: Reason): WalletEvent {
  return { type: "wallet/credited", currency, pocket, amount, reason };
}

function debit(currency: Currency, pocket: AnyPocket, amount: number, reason: Reason): WalletEvent {
  return { type: "wallet/debited", currency, pocket, amount, reason };
}

/** Drops the zero-amount moves a plan can contain, so the ledger only records money that moved. */
function moved(events: WalletEvent[]): WalletEvent[] {
  return events.filter((event) => (event.type === "wallet/credited" || event.type === "wallet/debited" ? event.amount > 0 : true));
}

// ---------------------------------------------------------------------------
// Foreign fees: R-WALLET-009
// ---------------------------------------------------------------------------

interface FeePlan {
  fromBank: number;
  fromCash: number;
  /** Foreign currency bought from the naira bank to cover the rest. */
  bought: number;
  naira: number;
  charge: number;
}

/**
 * How a foreign fee would be paid now, or null if it cannot be paid in full.
 * The naira leg rounds up, so the fee is always covered to the penny.
 */
function planFee(read: ReadCtx, currency: ForeignCurrency, amount: number): FeePlan | null {
  const pocket = read.state.wallet.pockets[currency];
  const fromBank = Math.min(pocket.bank, amount);
  const fromCash = Math.min(pocket.cash, amount - fromBank);
  const rest = amount - fromBank - fromCash;
  if (rest === 0) return { fromBank, fromCash, bought: 0, naira: 0, charge: 0 };
  if (varOr(read.world, QUEUE, 0) > 0) return null;
  // R-WALLET-005: the naira leg settles an invoice rather than buying currency, so it does not
  // count against the month's allowance.
  const naira = mulDivCeil(rest, read.world.rates[currency].official, 100);
  const charge = bp(naira, read.content.tuning.wallet.bankChargeBp);
  if (naira + charge > read.state.wallet.pockets.NGN.bank) return null;
  return { fromBank, fromCash, bought: rest, naira, charge };
}

function payFee(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "money/pay-fee") throw new Error(`money/pay-fee cannot carry out ${effect.type}.`);
  const amount = effectAmount(ctx, effect.amount, cause.terms);
  const plan = planFee(ctx, effect.currency, amount);
  // All or nothing: the caller learns it could not be paid through money/can-pay.
  if (plan === null) return [];
  const { currency, reason } = effect;
  return moved([
    debit("NGN", "bank", plan.naira, "convert"),
    debit("NGN", "bank", plan.charge, "bank-charge"),
    credit(currency, "bank", plan.bought, "convert"),
    debit(currency, "bank", plan.fromBank + plan.bought, reason),
    debit(currency, "cash", plan.fromCash, reason),
  ]);
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

function effectAmount(ctx: Ctx, amount: Amount, terms: Terms): number {
  const value = ctx.amount(amount, terms);
  if (value < 0) throw new Error(`A money effect's amount must not be negative, got ${String(value)}.`);
  return value;
}

function lotOf(state: State, currency: Currency, amount: number, reason: Reason): WalletEvent {
  const lot: Lot = { currency, amount, month: state.turn.month, reason };
  return { type: "wallet/lot-recorded", lot };
}

function addMoney(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "money/add") throw new Error(`money/add cannot carry out ${effect.type}.`);
  const amount = effectAmount(ctx, effect.amount, cause.terms);
  if (amount === 0) return [];
  // "A credit to the bank marked locked goes to the locked pocket."
  const pocket: AnyPocket = effect.locked === true ? "locked" : effect.pocket;
  const events = [credit(effect.currency, pocket, amount, effect.reason)];
  // R-WALLET-011: locked money sits in the bank too, so a flagged locked credit is a lot as well.
  if (effect.flagged === true && pocket !== "cash") events.push(lotOf(ctx.state, effect.currency, amount, effect.reason));
  return events;
}

function takeMoney(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "money/take") throw new Error(`money/take cannot carry out ${effect.type}.`);
  const amount = effectAmount(ctx, effect.amount, cause.terms);
  if (amount === 0) return [];
  const { currency, reason } = effect;
  const pocket = ctx.state.wallet.pockets[currency];
  if (effect.pocket === "any") {
    // Cash first, then bank, never locked ("Pockets" in wallet.md). R-WALLET-001: all or nothing.
    if (pocket.cash + pocket.bank < amount) return [];
    const fromCash = Math.min(pocket.cash, amount);
    return moved([debit(currency, "cash", fromCash, reason), debit(currency, "bank", amount - fromCash, reason)]);
  }
  if (pocket[effect.pocket] < amount) return [];
  return [debit(currency, effect.pocket, amount, reason)];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function move(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "wallet/move") throw new Error(`wallet/move cannot handle ${command.type}.`);
  const { currency, amount, to } = command;
  if (!isCurrency(currency)) return reject("unknown-id", `There is no currency ${String(currency)}.`);
  if (to !== "bank" && to !== "cash") return reject("not-legal", "Money moves to the bank or to cash.");
  if (!isGoodAmount(amount)) return reject("bad-amount", "An amount is a whole number above zero.");
  const from: Pocket = to === "bank" ? "cash" : "bank";
  // Locked money is never in `bank` here, so it cannot be moved (R-WALLET-010).
  if (amount > ctx.state.wallet.pockets[currency][from]) return reject("cannot-afford", `The ${from} pocket holds less than that.`);
  const events = [debit(currency, from, amount, "move"), credit(currency, to, amount, "move")];
  if (to !== "bank") return events;
  // R-WALLET-011. every move that leaves the month's cash paid in over the line is a lot of its own amount.
  const month = ctx.state.turn.month;
  const { cashIn } = ctx.state.wallet;
  const kobo = (cashIn.month === month ? cashIn.kobo : 0) + valueInKobo(amount, currency, officialRates(ctx.world));
  events.push({ type: "wallet/cash-paid-in", month, kobo });
  if (kobo > ctx.content.tuning.wallet.flagDepositAbove) events.push(lotOf(ctx.state, currency, amount, "move"));
  return events;
}

/**
 * What the aboki gives: buying costs the street rate, selling earns it less the spread (R-WALLET-007).
 * R-WALLET-007 does not say whether the aboki changes pounds for dollars. It is allowed,
 * as a sale for naira then a purchase, with one chance of a short count.
 */
function abokiGives(amount: number, from: Currency, to: Currency, world: World, content: Content): number {
  const street = streetRates(world);
  const sellRate = (currency: ForeignCurrency) => street[currency] - bp(street[currency], content.tuning.wallet.streetSpreadBp);
  const naira = from === "NGN" ? amount : mulDiv(amount, sellRate(from), 100);
  return to === "NGN" ? naira : convertMinor(naira, "NGN", to, street);
}

function convertAtAboki(ctx: Ctx, from: Currency, to: Currency, amount: number): BaseEvent[] | Rejection {
  if (amount > ctx.state.wallet.pockets[from].cash) return reject("cannot-afford", "The aboki takes cash, and there is less than that in cash.");
  const received = abokiGives(amount, from, to, ctx.world, ctx.content);
  // R-WALLET-012: a conversion must give back at least one unit of the other currency.
  if (received === 0) return reject("bad-amount", "That is too little to change.");
  const { streetShortBp, streetShortLossBp } = ctx.content.tuning.wallet;
  const events = [debit(from, "cash", amount, "convert"), credit(to, "cash", received, "convert")];
  // R-WALLET-008: the count is short after the money is handed over, so it shows as a debit.
  if (ctx.random.chance("street", streetShortBp)) {
    const lossBp = ctx.random.between("street", streetShortLossBp[0], streetShortLossBp[1]);
    events.push(debit(to, "cash", bp(received, lossBp), "short-count"));
  }
  return moved(events);
}

function convertAtBank(ctx: Ctx, from: Currency, to: Currency, amount: number): BaseEvent[] | Rejection {
  const { state, world, content } = ctx;
  if (amount > state.wallet.pockets[from].bank) return reject("cannot-afford", "The bank pocket holds less than that.");
  const charge = bp(amount, content.tuning.wallet.bankChargeBp);
  const net = amount - charge;
  const official = officialRates(world);
  const buying = to !== "NGN" && atHome(state);
  const cents = buying ? convertMinor(net, from, "USD", official) : 0;
  if (cents > allowanceLeft(ctx)) {
    return reject("bad-amount", `That is ${String(cents)} US cents; the bank allows ${String(allowanceLeft(ctx))} more this month.`);
  }
  const month = state.turn.month;
  const leaving = [debit(from, "bank", charge, "bank-charge"), debit(from, "bank", net, "convert")];
  const bought: WalletEvent[] = buying ? [{ type: "wallet/bought", month, cents }] : [];
  const received = convertMinor(net, from, to, official);
  // R-WALLET-012, as at the aboki. A queued purchase is judged at today's rate, before it waits.
  if (received === 0) return reject("bad-amount", "That is too little to change.");
  const queue = varOr(world, QUEUE, 0);
  if (buying && queue > 0) {
    // R-WALLET-006: the money leaves now; the rate is the one on the day it arrives.
    const queued: WalletEvent = { type: "wallet/queued", conversion: { id: ctx.nextId("conversion"), from, to, paid: net, readyMonth: month + queue } };
    return [...moved(leaving), queued, ...bought];
  }
  return [...moved([...leaving, credit(to, "bank", received, "convert")]), ...bought];
}

function convert(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "wallet/convert") throw new Error(`wallet/convert cannot handle ${command.type}.`);
  const { from, to, amount, via } = command;
  if (!isCurrency(from) || !isCurrency(to)) return reject("unknown-id", "Both currencies must be ones the wallet keeps.");
  if (from === to) return reject("not-legal", "A conversion needs two different currencies.");
  if (via !== "bank" && via !== "aboki") return reject("not-legal", "Change money at the bank or at the aboki.");
  if (!isGoodAmount(amount)) return reject("bad-amount", "An amount is a whole number above zero.");
  return via === "bank" ? convertAtBank(ctx, from, to, amount) : convertAtAboki(ctx, from, to, amount);
}

// ---------------------------------------------------------------------------
// Sending money home: R-ABROAD-006 and 008
// ---------------------------------------------------------------------------

const CHANNELS: readonly RemitChannel[] = ["app", "bank", "informal"];

/** One channel's terms for an amount: the fee kept, and the naira that arrives. */
export interface RemitTerms {
  fee: number;
  naira: number;
}

/**
 * What each channel gives for an amount sent from a foreign bank pocket, from the
 * view's rates and the content's tuning (R-ABROAD-008), so the interface quotes the
 * same figures the command pays. The app pays the official rate less its margin;
 * the bank the official rate, here today's, though the money arrives next month at
 * that month's; the informal channel the street rate with no fee. the fee
 * comes out of the amount sent, so the amount is what leaves the pocket.
 * the contract's PlayerView has no `remit` field, so the quote is this pure function over the view's rates.
 */
export function remitQuote(
  rates: World["rates"],
  remit: Tuning["remit"],
  currency: ForeignCurrency,
  amount: number,
): Record<RemitChannel, RemitTerms> {
  const { official, street } = rates[currency];
  const appFee = bp(amount, remit.appFeeBp);
  const bankFee = bp(amount, remit.bankFeeBp);
  return {
    app: { fee: appFee, naira: mulDiv(amount - appFee, official - bp(official, remit.appMarginBp), 100) },
    bank: { fee: bankFee, naira: mulDiv(amount - bankFee, official, 100) },
    informal: { fee: 0, naira: mulDiv(amount, street, 100) },
  };
}

function isForeign(value: unknown): value is ForeignCurrency {
  return isCurrency(value) && value !== "NGN";
}

/**
 * `wallet/remit` (R-ABROAD-006): the amount leaves the currency's bank pocket as
 * `remit` and the fee as `remit-fee`; the naira arrives as `gift`, documented, in
 * the home bank pocket by app at once or by bank next month, or as cash by the
 * informal channel, which may not arrive at all (stream `street`). only
 * from abroad, since it sends money home.
 */
function remit(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "wallet/remit") throw new Error(`wallet/remit cannot handle ${command.type}.`);
  const { currency, amount, channel } = command;
  if (ctx.state.place.where !== "abroad") return reject("not-legal", "Money is sent home from abroad.");
  if (!isForeign(currency)) return reject("unknown-id", `There is no foreign currency ${String(currency)}.`);
  if (!CHANNELS.includes(channel)) return reject("not-legal", "Send money by app, by bank or through someone.");
  if (!isGoodAmount(amount)) return reject("bad-amount", "An amount is a whole number above zero.");
  if (amount > ctx.state.wallet.pockets[currency].bank) return reject("cannot-afford", `The ${currency} bank pocket holds less than that.`);
  const terms = remitQuote(ctx.world.rates, ctx.content.tuning.remit, currency, amount)[channel];
  if (terms.naira === 0) return reject("bad-amount", "That is too little to send.");
  const month = ctx.state.turn.month;
  const sent: MoneyParam = { currency, amount };
  const events: WalletEvent[] = [debit(currency, "bank", amount - terms.fee, "remit"), debit(currency, "bank", terms.fee, "remit-fee")];
  const remitted = (lost: boolean, readyMonth: number): WalletEvent => ({ type: "wallet/remitted", channel, sent, fee: terms.fee, naira: lost ? 0 : terms.naira, lost, readyMonth });
  switch (channel) {
    case "app":
      events.push(credit("NGN", "bank", terms.naira, "remit"), remitted(false, month));
      break;
    case "bank": {
      const conversion = { id: ctx.nextId(REMIT_PREFIX), from: currency, to: "NGN" as const, paid: amount - terms.fee, readyMonth: month + 1 };
      events.push({ type: "wallet/queued", conversion }, remitted(false, month + 1));
      break;
    }
    case "informal": {
      const lost = ctx.random.chance("street", ctx.content.tuning.remit.informalLossBp);
      if (!lost) events.push(credit("NGN", "cash", terms.naira, "remit"));
      events.push(remitted(lost, month));
      break;
    }
    default: {
      const never: never = channel;
      throw new Error(`Unknown channel ${String(never)}.`);
    }
  }
  return moved(events);
}

/** A queued bank remit, as opposed to a queued purchase of foreign currency. */
function isRemit(conversion: { id: string }): boolean {
  return conversion.id.startsWith(`${REMIT_PREFIX}-`);
}

// ---------------------------------------------------------------------------
// The settle phase
// ---------------------------------------------------------------------------

function settle(ctx: Ctx): BaseEvent[] {
  const { state, world, content } = ctx;
  const month = state.turn.month;
  const events: WalletEvent[] = [];
  // Only when something was bought: a month with no purchase has nothing to reset.
  if (state.wallet.bought.month !== month && state.wallet.bought.cents > 0) events.push({ type: "wallet/allowance-reset", month });
  const official = officialRates(world);
  for (const conversion of state.wallet.queued) {
    if (conversion.readyMonth > month) continue;
    events.push({ type: "wallet/arrived", id: conversion.id });
    const reason: Reason = isRemit(conversion) ? "remit" : "convert";
    events.push(credit(conversion.to, "bank", convertMinor(conversion.paid, conversion.from, conversion.to, official), reason));
  }
  // R-WALLET-011: a lot is remembered for lotMonths whole months after the one it landed in.
  const keepFrom = month - content.tuning.wallet.lotMonths;
  const count = state.wallet.lots.filter((lot) => lot.month < keepFrom).length;
  if (count > 0) events.push({ type: "wallet/lots-dropped", keepFrom, count });
  return moved(events);
}

// ---------------------------------------------------------------------------
// Evolve
// ---------------------------------------------------------------------------

type Totals = WalletSlice["totals"]["in"];

function addTo(totals: Totals, reason: Reason, currency: Currency, amount: number): Totals {
  const byCurrency = totals[reason] ?? {};
  return { ...totals, [reason]: { ...byCurrency, [currency]: (byCurrency[currency] ?? 0) + amount } };
}

function withPocket(slice: WalletSlice, currency: Currency, pocket: AnyPocket, change: number): WalletSlice["pockets"] {
  const balance: PocketBalance = slice.pockets[currency];
  return { ...slice.pockets, [currency]: { ...balance, [pocket]: balance[pocket] + change } };
}

function evolve(slice: WalletSlice, event: WalletEvent): WalletSlice {
  switch (event.type) {
    case "wallet/credited":
      return {
        ...slice,
        pockets: withPocket(slice, event.currency, event.pocket, event.amount),
        totals: { ...slice.totals, in: addTo(slice.totals.in, event.reason, event.currency, event.amount) },
      };
    case "wallet/debited":
      return {
        ...slice,
        pockets: withPocket(slice, event.currency, event.pocket, -event.amount),
        totals: { ...slice.totals, out: addTo(slice.totals.out, event.reason, event.currency, event.amount) },
      };
    case "wallet/queued":
      return { ...slice, queued: [...slice.queued, event.conversion] };
    case "wallet/arrived":
      return { ...slice, queued: slice.queued.filter((conversion) => conversion.id !== event.id) };
    case "wallet/lot-recorded":
      return { ...slice, lots: [...slice.lots, event.lot] };
    case "wallet/lots-dropped":
      return { ...slice, lots: slice.lots.filter((lot) => lot.month >= event.keepFrom) };
    case "wallet/bought": {
      const sofar = slice.bought.month === event.month ? slice.bought.cents : 0;
      return { ...slice, bought: { month: event.month, cents: sofar + event.cents } };
    }
    case "wallet/allowance-reset":
      return { ...slice, bought: { month: event.month, cents: 0 } };
    case "wallet/cash-paid-in":
      return { ...slice, cashIn: { month: event.month, kobo: event.kobo } };
    case "wallet/remitted":
      return slice;
    default: {
      const never: never = event;
      throw new Error(`Unknown wallet event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"]): ReportLine {
  return { key, params, tone, attention: false, counts: [] };
}

function lines(event: WalletEvent): ReportLine[] {
  switch (event.type) {
    case "wallet/credited":
    case "wallet/debited": {
      const { currency, amount, reason } = event;
      // A transfer is one line for the pair, told from the side the money arrives on.
      const money = { currency, amount };
      if (reason === "convert") return event.type === "wallet/credited" ? [line("line.wallet.converted", { amount: money }, "plain")] : [];
      if (reason === "move") return event.type === "wallet/credited" ? [line("line.wallet.moved", { amount: money, pocket: event.pocket }, "plain")] : [];
      const key = REASON_LINE[reason];
      return key === null ? [] : [line(key, { amount: money }, SOURCES.includes(reason) ? "good" : "bad")];
    }
    case "wallet/queued": {
      const { from, to, paid, readyMonth } = event.conversion;
      // A bank remit is told by its own line.
      if (isRemit(event.conversion)) return [];
      return [line("line.wallet.queued", { paid: { currency: from, amount: paid }, currency: to, readyMonth }, "plain")];
    }
    case "wallet/remitted": {
      const naira: MoneyParam = { currency: "NGN", amount: event.naira };
      if (event.lost) return [{ ...line("line.wallet.remit-lost", { sent: event.sent }, "bad"), attention: true }];
      return [line(`line.wallet.remit-${event.channel}`, { sent: event.sent, naira, readyMonth: event.readyMonth }, "plain")];
    }
    case "wallet/lot-recorded":
      return [line("line.wallet.flagged", { amount: { currency: event.lot.currency, amount: event.lot.amount } }, "bad")];
    case "wallet/arrived":
    case "wallet/lots-dropped":
    case "wallet/bought":
    case "wallet/allowance-reset":
    case "wallet/cash-paid-in":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown wallet event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

function moneyMin(read: ReadCtx, requirement: Requirement, terms: Terms): RequirementResult {
  if (requirement.type !== "money/min") throw new Error(`money/min cannot judge ${requirement.type}.`);
  const pocket = read.state.wallet.pockets[requirement.currency];
  // Locked money never counts.
  const have = requirement.pocket === undefined ? pocket.bank + pocket.cash : pocket[requirement.pocket];
  const need = resolveAmount(read, requirement.amount, terms);
  return { met: have >= need, have, need };
}

function moneyCanPay(read: ReadCtx, requirement: Requirement, terms: Terms): RequirementResult {
  if (requirement.type !== "money/can-pay") throw new Error(`money/can-pay cannot judge ${requirement.type}.`);
  const need = resolveAmount(read, requirement.amount, terms);
  const { currency } = requirement;
  if (currency === "NGN") {
    const pocket = read.state.wallet.pockets.NGN;
    const have = pocket.bank + pocket.cash;
    return { met: have >= need, have, need };
  }
  // A foreign fee can draw on the naira bank, so there is no single figure to show as `have`.
  return { met: planFee(read, currency, need) !== null, need };
}

/** R-WALLET-014: the ledger's total under one reason, in one currency. */
function walletTotal(read: ReadCtx, requirement: Requirement, terms: Terms): RequirementResult {
  if (requirement.type !== "wallet/total") throw new Error(`wallet/total cannot judge ${requirement.type}.`);
  const have = read.state.wallet.totals[requirement.flow][requirement.reason]?.[requirement.currency] ?? 0;
  const need = resolveAmount(read, requirement.amount, terms);
  return { met: have >= need, have, need };
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

function sumFor(totals: Totals, currency: Currency): number {
  return Object.values(totals).reduce((sum, byCurrency) => sum + (byCurrency?.[currency] ?? 0), 0);
}

function invariants(state: State): string[] {
  const problems: string[] = [];
  for (const currency of CURRENCIES) {
    const pocket = state.wallet.pockets[currency];
    for (const [name, value] of Object.entries(pocket)) {
      if (!Number.isSafeInteger(value) || value < 0) problems.push(`${currency} ${name} is ${String(value)} (R-WALLET-001).`);
    }
    const held = pocket.bank + pocket.cash + pocket.locked;
    const booked = sumFor(state.wallet.totals.in, currency) - sumFor(state.wallet.totals.out, currency);
    if (held !== booked) problems.push(`${currency} holds ${String(held)} but the ledger says ${String(booked)} (R-WALLET-002).`);
  }
  for (const conversion of state.wallet.queued) {
    if (!Number.isSafeInteger(conversion.paid) || conversion.paid <= 0) problems.push(`Queued conversion ${conversion.id} carries ${String(conversion.paid)}.`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The kind
// ---------------------------------------------------------------------------

export const walletKind: RegisteredKind<WalletSlice, WalletEvent> = {
  kind: "wallet",
  initial(scenario) {
    const pockets = {} as Record<Currency, PocketBalance>;
    const opening: Partial<Record<Currency, number>> = {};
    for (const currency of CURRENCIES) {
      const given = scenario.pockets[currency] ?? { bank: 0, cash: 0 };
      pockets[currency] = { bank: given.bank, cash: given.cash, locked: 0 };
      if (given.bank + given.cash > 0) opening[currency] = given.bank + given.cash;
    }
    return {
      pockets,
      queued: [],
      lots: [],
      totals: { in: Object.keys(opening).length > 0 ? { opening } : {}, out: {} },
      bought: { month: 0, cents: 0 },
      cashIn: { month: 0, kobo: 0 },
    };
  },
  commands: {
    "wallet/move": move,
    "wallet/convert": convert,
    "wallet/remit": remit,
  },
  effects: {
    "money/add": addMoney,
    "money/take": takeMoney,
    "money/pay-fee": payFee,
  },
  phases: { settle },
  evolve,
  lines,
  requirements: {
    "money/min": moneyMin,
    "money/can-pay": moneyCanPay,
    "wallet/total": walletTotal,
  },
  invariants,
  view: (read) => ({
    pockets: read.state.wallet.pockets,
    queued: read.state.wallet.queued,
    rates: read.world.rates,
    bankAllowanceLeft: allowanceShown(read),
  }),
};
