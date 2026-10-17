// Money: docs/rules/wallet.md. One pocket set per currency: bank, cash and
// locked. The opening balances are recorded as credits with the reason
// `opening` (R-SCENARIO-002), so the ledger identity of R-WALLET-002 holds
// from the first state.
import { resolveAmount, worldVarOr } from "../engine/check";
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

import { heldForRoad, netsAfter, passbookOpen, passbookView, roadTarget } from "./passbook";
import type { AnyPocket, RemitChannel, WalletEvent } from "./wallet.events";
import { CURRENCIES, officialRates, streetRates } from "./wallet.rates";

const ALLOWANCE: Id<"var"> = "var.fx-bank-allowance";
const QUEUE: Id<"var"> = "var.fx-bank-queue";

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
  food: "line.wallet.food",
  foodstuff: "line.wallet.foodstuff",
  goods: "line.wallet.goods",
  running: "line.wallet.running",
  enjoyment: "line.wallet.enjoyment",
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
  "top-up": "line.wallet.top-up",
  convert: null,
  move: null,
};

// ---------------------------------------------------------------------------
// Reading the world
// ---------------------------------------------------------------------------

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
function allowanceLeft(read: ReadCtx): number {
  return Math.max(0, worldVarOr(read.world, ALLOWANCE) - boughtThisMonth(read.state));
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
// Marked money: R-WALLET-020
// ---------------------------------------------------------------------------

/** The topped-up naira not yet spent (R-WALLET-020); 0 while there is none. */
function markedOf(wallet: Pick<WalletSlice, "marked">): number {
  return wallet.marked ?? 0;
}

/**
 * R-WALLET-020, R-LOTTERY-018: the naira earned in the game, the naira bank and cash less the marked figure. A Friday
 * ticket and the kiosk's slip are paid from it alone, so a top-up never stakes a ticket.
 */
export function earnedNaira(wallet: Pick<WalletSlice, "pockets" | "marked">): number {
  const { bank, cash } = wallet.pockets.NGN;
  return Math.max(0, bank + cash - markedOf(wallet));
}

/** R-WALLET-020, R-LOTTERY-018: the detail a ticket or a slip is refused with when only the marked naira would cover it. */
export const EARNED_ONLY = "Tickets come from money you earned.";

/** The slice with the marked figure set, the key dropped at zero so no state hash moves while nothing is marked. */
function withMarked(slice: WalletSlice, marked: number): WalletSlice {
  if (marked > 0) return { ...slice, marked };
  if (slice.marked === undefined) return slice;
  const rest: WalletSlice = { ...slice };
  delete rest.marked;
  return rest;
}

/**
 * R-WALLET-020: earned naira is spent first, the marked naira only once the earned runs out, so
 * after a naira debit the marked figure is never above what is left. A move between pockets is the same money and spends
 * nothing; a ticket and a slip are paid only when the earned share covers them, so they never reach it.
 */
function markedAfterDebit(slice: WalletSlice, event: Extract<WalletEvent, { type: "wallet/debited" }>): WalletSlice {
  const marked = markedOf(slice);
  if (marked === 0 || event.currency !== "NGN" || event.pocket === "locked" || event.reason === "move") return slice;
  const { bank, cash } = slice.pockets.NGN;
  return withMarked(slice, Math.min(marked, bank + cash));
}

/** R-WALLET-020: naira credited as `top-up` is marked; every other credit, a prize among them, is earned. */
function markedAfterCredit(slice: WalletSlice, event: Extract<WalletEvent, { type: "wallet/credited" }>): WalletSlice {
  if (event.reason !== "top-up" || event.currency !== "NGN" || event.pocket === "locked") return slice;
  return withMarked(slice, markedOf(slice) + event.amount);
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

/** The foreign fee's split: what that currency's own pockets give, and the naira leg for the rest with the bank's charge. */
function feeSplit(read: Pick<ReadCtx, "state" | "world" | "content">, currency: ForeignCurrency, amount: number): FeePlan {
  const pocket = read.state.wallet.pockets[currency];
  const fromBank = Math.min(pocket.bank, amount);
  const fromCash = Math.min(pocket.cash, amount - fromBank);
  const rest = amount - fromBank - fromCash;
  if (rest === 0) return { fromBank, fromCash, bought: 0, naira: 0, charge: 0 };
  // R-WALLET-005: the naira leg settles an invoice rather than buying currency, so it does not
  // count against the month's allowance.
  const naira = mulDivCeil(rest, read.world.rates[currency].official, 100);
  return { fromBank, fromCash, bought: rest, naira, charge: bp(naira, read.content.tuning.wallet.bankChargeBp) };
}

/**
 * How a foreign fee would be paid now, or null if it cannot be paid in full.
 * The naira leg rounds up, so the fee is always covered to the penny.
 */
function planFee(read: ReadCtx, currency: ForeignCurrency, amount: number): FeePlan | null {
  const plan = feeSplit(read, currency, amount);
  if (plan.bought === 0) return plan;
  if (worldVarOr(read.world, QUEUE) > 0) return null;
  if (plan.naira + plan.charge > read.state.wallet.pockets.NGN.bank) return null;
  return plan;
}

/**
 * R-WALLET-009, for a forecast: the naira a foreign fee would take from the naira bank now, the bank's charge
 * included, whether or not the bank holds it; nothing while the currency's own pockets cover the fee.
 */
export function feeInNaira(read: Pick<ReadCtx, "state" | "world" | "content">, currency: ForeignCurrency, amount: number): number {
  const plan = feeSplit(read, currency, amount);
  return plan.naira + plan.charge;
}

function feeEvents(plan: FeePlan, currency: ForeignCurrency, reason: Reason): WalletEvent[] {
  return moved([
    debit("NGN", "bank", plan.naira, "convert"),
    debit("NGN", "bank", plan.charge, "bank-charge"),
    credit(currency, "bank", plan.bought, "convert"),
    debit(currency, "bank", plan.fromBank + plan.bought, reason),
    debit(currency, "cash", plan.fromCash, reason),
  ]);
}

/** A payment a forecast can make: a whole amount taken from a pocket, or a foreign fee. */
export type Payment = { type: "money/take"; currency: Currency; pocket: "any" | "transfer" | AnyPocket; amount: number; reason: Reason } | { type: "money/pay-fee"; currency: ForeignCurrency; amount: number; reason: Reason };

/**
 * The wallet once a payment is made exactly as the wallet makes it, or null when it would not be: what a forecast
 * reads (the way home, R-PLACE-011) so that it never books money its own way.
 */
export function walletAfter(read: ReadCtx, payment: Payment): WalletSlice | null {
  const events = payment.type === "money/take" ? takeEvents(read.state, read.content, payment.currency, payment.pocket, payment.amount, payment.reason) : feePlanned(read, payment);
  if (events === null) return null;
  return events.reduce((slice, event) => evolve(slice, event, read.state), read.state.wallet);
}

function feePlanned(read: ReadCtx, payment: Extract<Payment, { type: "money/pay-fee" }>): WalletEvent[] | null {
  const plan = planFee(read, payment.currency, payment.amount);
  return plan === null ? null : feeEvents(plan, payment.currency, payment.reason);
}

function payFee(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "money/pay-fee") throw new Error(`money/pay-fee cannot carry out ${effect.type}.`);
  const amount = effectAmount(ctx, effect.amount, cause.terms);
  const plan = planFee(ctx, effect.currency, amount);
  // All or nothing: the caller learns it could not be paid through money/can-pay.
  if (plan === null) return [];
  const { currency, reason } = effect;
  return feeEvents(plan, currency, reason);
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

/**
 * R-WALLET-018 (decision 0022): the pocket a naira credit of work, a gig, a prize or the prologue's earnings lands
 * in, and the pocket a street debit is taken from first, by its size. Small money changes hands as cash; past
 * the line people ask for a transfer.
 */
export function pocketFor(amount: number, wallet: Pick<Tuning["wallet"], "cashUpTo">): Pocket {
  return amount <= wallet.cashUpTo ? "cash" : "bank";
}

/** A whole amount taken from two pockets, the first named until it runs out, never locked. */
function takeInOrder(currency: Currency, first: Pocket, amount: number, held: PocketBalance, reason: Reason): WalletEvent[] | null {
  if (held.cash + held.bank < amount) return null;
  const second: Pocket = first === "cash" ? "bank" : "cash";
  const fromFirst = Math.min(held[first], amount);
  return moved([debit(currency, first, fromFirst, reason), debit(currency, second, amount - fromFirst, reason)]);
}

/** The debits a whole amount taken from a pocket makes, or null when it cannot be taken: R-WALLET-001, all or nothing. */
function takeEvents(state: State, content: Content, currency: Currency, from: "any" | "transfer" | AnyPocket, amount: number, reason: Reason): WalletEvent[] | null {
  if (amount === 0) return [];
  const pocket = state.wallet.pockets[currency];
  // The street: cash first at or under the line, the bank first above it (R-WALLET-018, "Pockets" in wallet.md).
  if (from === "any") return takeInOrder(currency, pocketFor(amount, content.tuning.wallet), amount, pocket, reason);
  // A transfer: the bank first, then cash (decision 0012).
  if (from === "transfer") return takeInOrder(currency, "bank", amount, pocket, reason);
  if (pocket[from] < amount) return null;
  return [debit(currency, from, amount, reason)];
}

function takeMoney(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "money/take") throw new Error(`money/take cannot carry out ${effect.type}.`);
  return takeEvents(ctx.state, ctx.content, effect.currency, effect.pocket, effectAmount(ctx, effect.amount, cause.terms), effect.reason) ?? [];
}

/**
 * `wallet/top-up` (R-WALLET-020): naira bought with real money lands in the naira bank as `top-up`, a lot the visa
 * officer asks about (R-WALLET-011), and the marked figure rises by the amount as the credit is evolved.
 */
function topUpEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "wallet/top-up") throw new Error(`wallet/top-up cannot carry out ${effect.type}.`);
  if (!isGoodAmount(effect.amount)) throw new Error(`A top-up is a whole number of kobo above zero, got ${String(effect.amount)}.`);
  return [credit("NGN", "bank", effect.amount, "top-up"), lotOf(ctx.state, "NGN", effect.amount, "top-up")];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * The authority's `wallet/top-up` (R-WALLET-020, R-SERVER-013): the engine refuses it from anyone else. The processor's
 * receipts, the monthly cap and the server route that sends it come with the payment processor.
 */
function topUp(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "wallet/top-up") throw new Error(`wallet/top-up cannot handle ${command.type}.`);
  if (ctx.sender !== "authority") return reject("not-legal", "Only the authority tops up naira.");
  if (!isGoodAmount(command.amount)) return reject("bad-amount", "A top-up is a whole number of kobo above zero.");
  return ctx.apply([{ type: "wallet/top-up", amount: command.amount }], { source: "wallet", param: null, terms: {} });
}

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
  // R-WALLET-011. Every move that leaves the month's cash paid in over the line is a lot of its own amount.
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
  const queue = worldVarOr(world, QUEUE);
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
 * that month's; the informal channel the street rate with no fee. The fee
 * comes out of the amount sent, so the amount is what leaves the pocket.
 * The contract's PlayerView has no `remit` field, so the quote is this pure function over the view's rates.
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
 * `remit` and the fee as `remit-fee`; the naira arrives as `remit`, documented, in
 * the home bank pocket by app at once or by bank next month, or as cash by the
 * informal channel, which may not arrive at all (stream `street`). Only
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
// The months kept: decision 0021
// ---------------------------------------------------------------------------

/** The money of the place: naira at home and on the road, the country's own abroad, as the results sheet reads it. */
function placeCurrency(state: State, content: Content): Currency {
  const country = state.place.country;
  if (state.place.where !== "abroad" || country === null) return "NGN";
  return content.country[country]?.currency ?? "NGN";
}

/**
 * Money that is not the month's own on the results sheet (R-WORLD-008): a move between pockets is the
 * same money, a change of money is a move between currencies (decision 0021: what is done with
 * it afterwards is the spending), and held funds only sit locked from the day they land to the day they go back.
 */
const NOT_THE_MONTHS: ReadonlySet<Reason> = new Set<Reason>(["move", "convert", "held-funds", "held-funds-return"]);

/**
 * The month's net, with one credit or debit added. A change's two sides count nothing; its bank charge
 * and a short count stay money out. The prologue's years are not a month: money that moves while it is
 * open is what the character starts with.
 */
function withMonthNet(slice: WalletSlice, state: State, currency: Currency, change: number, reason: Reason): WalletSlice {
  if (state.prologue.open || NOT_THE_MONTHS.has(reason)) return slice;
  const net = slice.monthNet ?? {};
  return withPaceNet({ ...slice, monthNet: { ...net, [currency]: (net[currency] ?? 0) + change } }, currency, change, reason);
}

/** The road's own costs (the passbook): its target counts the fees ahead and the flight, so paying them moves no pace. */
const THE_ROADS: ReadonlySet<Reason> = new Set<Reason>(["fee-document", "fee-test", "fee-school", "fee-visa", "fee-surcharge", "flight"]);

/** The passbook's pace: the month's net as the results count it, every money, the road's own costs aside. */
function withPaceNet(slice: WalletSlice, currency: Currency, change: number, reason: Reason): WalletSlice {
  const net = slice.paceNet ?? {};
  // A road's fee still marks the month as one that moved money; it adds nothing to what was kept.
  if (THE_ROADS.has(reason)) return { ...slice, paceNet: net };
  return { ...slice, paceNet: { ...net, [currency]: (net[currency] ?? 0) + change } };
}

/**
 * R-WALLET-019: nothing moves by itself; the world warns. The first month of a life to close with more naira cash
 * on the character than the warning line, after the prologue, draws the warning once.
 */
function cashWarning(state: State, content: Content): WalletEvent[] {
  const { wallet } = state;
  if (state.prologue.open || wallet.cashWarned === true || wallet.pockets.NGN.cash <= content.tuning.wallet.cashWarnAt) return [];
  return [{ type: "wallet/cash-warned" }];
}

/** As the month closes, it is told with its net in the money of the place where it ended. A month that moved nothing tells nothing. */
function closeMonth(ctx: Ctx): BaseEvent[] {
  const warned = cashWarning(ctx.state, ctx.content);
  // The passbook reads a month that moved money, as the month's net does; a month that moved nothing tells nothing.
  const passbook = ctx.state.wallet.paceNet === undefined ? [] : [...paced(ctx), ...stamped(ctx)];
  const net = ctx.state.wallet.monthNet;
  if (net === undefined) return [...warned, ...passbook];
  const currency = placeCurrency(ctx.state, ctx.content);
  const closed: WalletEvent = { type: "wallet/month-closed", currency, net: net[currency] ?? 0 };
  return [closed, ...warned, ...passbook];
}

/**
 * The passbook's pace: a month closed at home keeps its net for the road, every money at the official rate, the road's
 * own costs aside. Away from home the pace waits, and its month is let go.
 */
function paced(ctx: Ctx): WalletEvent[] {
  const net = ctx.state.wallet.paceNet;
  if (!passbookOpen(ctx.state)) return [{ type: "wallet/paced", kept: 0 }];
  const official = officialRates(ctx.world);
  const kept = CURRENCIES.reduce((sum, currency) => sum + valueInKobo(net?.[currency] ?? 0, currency, official), 0);
  return [{ type: "wallet/paced", kept }];
}

/**
 * The passbook's stamps: at a month's close at home, each fixed figure the money held for the road has reached, and the
 * plan's own target once it is held, each once in a life with the month it was reached.
 */
function stamped(ctx: Ctx): WalletEvent[] {
  if (!passbookOpen(ctx.state)) return [];
  const held = heldForRoad(ctx.state, ctx.world);
  const month = ctx.state.turn.month;
  const reached = ctx.state.wallet.stamps ?? [];
  const events: WalletEvent[] = ctx.content.tuning.wallet.stamps
    .filter((at) => held >= at && !reached.some((stamp) => stamp.target !== true && stamp.at === at))
    .map((at) => ({ type: "wallet/stamped", at, month, target: false, route: null }));
  const target = roadTarget(ctx);
  if (target !== null && held >= target.total && !reached.some((stamp) => stamp.target === true)) events.push({ type: "wallet/stamped", at: target.total, month, target: true, route: target.route });
  return events;
}

/** The slice with the month's net cleared, and the month counted when it was kept. */
function monthClosed(slice: WalletSlice, net: number): WalletSlice {
  const rest: WalletSlice = { ...slice };
  delete rest.monthNet;
  return net > 0 ? { ...rest, keptMonths: (slice.keptMonths ?? 0) + 1 } : rest;
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

function evolve(slice: WalletSlice, event: WalletEvent, state: State): WalletSlice {
  switch (event.type) {
    case "wallet/credited":
      return markedAfterCredit(withMonthNet(
        {
          ...slice,
          pockets: withPocket(slice, event.currency, event.pocket, event.amount),
          totals: { ...slice.totals, in: addTo(slice.totals.in, event.reason, event.currency, event.amount) },
        },
        state,
        event.currency,
        event.amount,
        event.reason,
      ), event);
    case "wallet/debited":
      return markedAfterDebit(withMonthNet(
        {
          ...slice,
          pockets: withPocket(slice, event.currency, event.pocket, -event.amount),
          totals: { ...slice.totals, out: addTo(slice.totals.out, event.reason, event.currency, event.amount) },
        },
        state,
        event.currency,
        -event.amount,
        event.reason,
      ), event);
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
    case "wallet/month-closed":
      return monthClosed(slice, event.net);
    case "wallet/cash-warned":
      return { ...slice, cashWarned: true };
    case "wallet/paced": {
      const rest: WalletSlice = { ...slice };
      delete rest.paceNet;
      // Away from home the month is let go and the pace keeps what it had.
      return passbookOpen(state) ? { ...rest, nets: netsAfter(slice.nets, event.kept) } : rest;
    }
    case "wallet/stamped":
      return { ...slice, stamps: [...(slice.stamps ?? []), { at: event.at, month: event.month, ...(event.target ? { target: true as const } : {}) }] };
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
      // A change tells what came in; the side paid in is told too, plainly, so the screen never has to guess it from the charge.
      if (reason === "convert") return [line(event.type === "wallet/credited" ? "line.wallet.converted" : "line.wallet.convert-paid", { amount: money }, "plain")];
      if (reason === "move") return event.type === "wallet/credited" ? [line("line.wallet.moved", { amount: money, pocket: event.pocket }, "plain")] : [];
      const key = REASON_LINE[reason];
      // R-WALLET-017: the tone is the event's, so a remit's foreign leg is money out and a refund under a fee's reason money in.
      return key === null ? [] : [line(key, { amount: money }, event.type === "wallet/credited" ? "good" : "bad")];
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
    case "wallet/cash-warned":
      // R-WALLET-019: someone who cares says it, with no figure; moving the money stays the player's act.
      return [{ ...line("line.wallet.cash-warning", {}, "plain"), attention: true }];
    case "wallet/stamped": {
      // The passbook: a stamp is told as people tell it, its figure in naira; the road's own figure names the way.
      const amount: MoneyParam = { currency: "NGN", amount: event.at };
      if (event.target) return [{ ...line("line.passbook.ready", { amount, route: event.route ?? "" }, "good"), attention: true }];
      return [{ ...line("line.passbook.stamped", { amount }, "good"), attention: true }];
    }
    case "wallet/paced":
      return [];
    case "wallet/arrived":
    case "wallet/lots-dropped":
    case "wallet/bought":
    case "wallet/allowance-reset":
    case "wallet/cash-paid-in":
    case "wallet/month-closed":
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
  // R-WALLET-020: the marked figure is a share of the naira held, never negative, missing while zero.
  const { marked } = state.wallet;
  if (marked !== undefined) {
    const { bank, cash } = state.wallet.pockets.NGN;
    if (!Number.isSafeInteger(marked) || marked <= 0) problems.push(`The marked figure is ${String(marked)}; it is a whole number above zero or missing (R-WALLET-020).`);
    if (marked > bank + cash) problems.push(`The marked figure ${String(marked)} is over the naira bank and cash, ${String(bank + cash)} (R-WALLET-020).`);
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
    "wallet/top-up": topUp,
  },
  effects: {
    "money/add": addMoney,
    "money/take": takeMoney,
    "money/pay-fee": payFee,
    "wallet/top-up": topUpEffect,
  },
  phases: { settle, close: closeMonth },
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
    keptMonths: read.state.wallet.keptMonths ?? 0,
    wallet: { marked: markedOf(read.state.wallet) },
    passbook: passbookView(read),
  }),
};
