// Obligations: docs/rules/obligation.md, and for life abroad abroad-money.md
// abroad-money:arrival-opens-upkeep-and-room, abroad-money:phone-contract-builds-credit and abroad-money:tuition-paid-in-instalments, car:missed-payments-take-the-car, car:car-handed-back-after-half and car:final-payment-owns-the-car and luck:savings-circle-holds-pot. The
// scenario's obligations are real from the first state and get instance ids from
// the engine's counter (scenario:new-state-starts-clean).
import { rateFor } from "../credit/credit.logic";
import { worldVarOr } from "../engine/check";
import { QUALITY } from "../engine/ids";
import { BP_WHOLE, bp, convertMinor, divCeil, divFloor, isWhole, mulDiv } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit, oldestFirst, ownOf } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  CarTerms,
  CarView,
  Cause,
  Command,
  Content,
  Ctx,
  Currency,
  Effect,
  Id,
  MoneyParam,
  ObligationEntry,
  ObligationSlice,
  ObligationState,
  ObligationType,
  ReadCtx,
  Reason,
  Rejection,
  Relief,
  ReportLine,
  Requirement,
  RequirementResult,
  State,
} from "../engine/types";
import { appliesHere } from "../place/place.logic";
import { couchEnds, onTheCouch } from "./obligation.couch";
import type { ClosedWhy, ObligationEvent, TuitionStage } from "./obligation.events";
import { isSponsorUndertaking, openUndertaking, payUndertaking, undertakingDue, undertakingMonthsLeft } from "./obligation.undertaking";
import { officialRates, spendable } from "../wallet/wallet.rates";

const INFLATION: Id<"var"> = "var.inflation";
/** return:return-reopens-home-charges: the car's shortfall once it has followed you home, in naira. */
const HOME_SHORTFALL: Id<"obligation"> = "obligation.car-shortfall-home";

/** Types whose misses run a grace and can default (obligation:upkeep-never-defaults, obligation:loan-default-and-recovery, abroad-money:arrival-opens-upkeep-and-room, abroad-money:phone-contract-builds-credit, abroad-money:tuition-paid-in-instalments, car:missed-payments-take-the-car). */
const GRACE_TYPES: readonly ObligationType[] = ["loan", "group-loan", "tuition", "rent", "phone", "car", "undertaking"];
/** Types that stay open in default as a debt (obligation:loan-default-and-recovery, status:course-passed-or-withdrawn, undertaking:missed-charges-lead-to-default). */
const DEBT_TYPES: readonly ObligationType[] = ["loan", "group-loan", "tuition", "undertaking"];
/** Types the lender collects from the bank once in default (obligation:loan-default-and-recovery, obligation:group-covers-misses-at-cost). */
const COLLECTED_TYPES: readonly ObligationType[] = ["loan", "group-loan"];
/** Types repaid in equal parts over their term (obligation:due-phase-charges-oldest-first, abroad-money:tuition-paid-in-instalments). */
const SCHEDULED_TYPES: readonly ObligationType[] = ["loan", "group-loan", "tuition"];
/** Types with nothing to open when no principal is given. */
const OWING_TYPES: readonly ObligationType[] = ["loan", "held-funds", "group-loan", "car", "tuition", "undertaking", "agent-debt"];

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function entryOf(content: Content, id: Id<"obligation">): ObligationEntry {
  const entry = content.obligation[id];
  if (entry === undefined) throw new Error(`There is no obligation ${id} in content.`);
  return entry;
}

function openItems(state: State): ObligationState[] {
  return Object.values(state.obligation.items).sort(oldestFirst);
}

/** The car's numbers, in its currency (docs/rules/car.md "Entries"). */
export type { CarTerms, CarView } from "../engine/types";

/** The car block of an entry, or a thrown error for an entry that is not a car. */
function carOf(entry: ObligationEntry): NonNullable<ObligationEntry["car"]> {
  const car = entry.car;
  if (car === undefined) throw new Error(`${entry.id} has no car terms.`);
  return car;
}

export function carTerms(entry: ObligationEntry): CarTerms {
  const car = carOf(entry);
  return {
    price: car.price,
    final: bp(car.price, car.finalBp),
    third: bp(car.price, car.courtThirdBp),
    half: bp(car.price, car.handBackBp),
    resale: bp(car.price, car.resaleBp),
    courtMonths: car.courtMonths,
  };
}

/**
 * car:missed-payments-take-the-car, car:car-handed-back-after-half: what has been paid toward the car's price, the deposit
 * included. The total is the price, so paid is the price less what is
 * still owed; interest paid does not count toward the thirds and the half.
 */
export function carPaid(entry: ObligationEntry, item: ObligationState): number {
  return carTerms(entry).price - item.outstanding;
}

/** car:final-payment-owns-the-car: the final payment made, the car is the character's with nothing owed. */
function isOwned(item: ObligationState, entry: ObligationEntry): boolean {
  return entry.type === "car" && item.monthsLeft === 0 && item.outstanding === 0;
}

/** car:missed-payments-take-the-car: a third or more was paid and the lender is waiting on the court. */
function inCourt(item: ObligationState, entry: ObligationEntry): boolean {
  return entry.type === "car" && item.missed > entry.grace;
}

/** A whole number from 0 up to, not including, `every`. */
function modulo(value: number, every: number): number {
  return value - divFloor(value, every) * every;
}

/**
 * abroad-money:tuition-paid-in-instalments, obligation:prepaid-entries-skip-first-charge: whether a charge falls in this month. An entry with
 * `everyMonths` is charged in the first month after opening and every
 * `everyMonths` after it; one `prepaid` had its first period paid when it opened,
 * so it is first charged `everyMonths` after the opening month, then every
 * `everyMonths`. A missed instalment is asked for again each
 * month until it is paid or defaults, so a grace of 1 is one month, not three.
 */
function dueIn(item: ObligationState, entry: ObligationEntry, month: number): boolean {
  if (isOwned(item, entry)) return false;
  // abroad-money:tuition-paid-in-instalments: a scheduled tuition is due whenever its schedule, its plan or its arrears ask for something.
  if (entry.schedule !== undefined) return tuitionDue(item, entry, month) > 0;
  if (entry.everyMonths === undefined || item.missed > 0) return true;
  const age = month - item.openedMonth - (entry.prepaid === true ? entry.everyMonths : 1);
  return age >= 0 && modulo(age, entry.everyMonths) === 0;
}

// ---------------------------------------------------------------------------
// The scheduled tuition: abroad-money:tuition-paid-in-instalments, abroad-money:missed-tuition-runs-in-stages
// ---------------------------------------------------------------------------

/** The course month a month is: the months since the tuition opened with the flight, the first month abroad being 1. */
function courseMonthOf(item: ObligationState, month: number): number {
  return month - item.openedMonth;
}

/**
 * abroad-money:tuition-paid-in-instalments, abroad-money:missed-tuition-runs-in-stages: what should have been paid by the end of course month `month`. By the
 * schedule, each month's share of the principal rounded down and the whole by its last month; on a plan, what was paid before it, then an even part a
 * month of what was owed, the last month the rest.
 */
export function tuitionOwedBy(item: ObligationState, entry: ObligationEntry, month: number): number {
  const plan = item.plan;
  if (plan !== undefined) {
    const before = item.principal - plan.total;
    const parts = month - plan.month;
    if (parts <= 0) return before;
    return before + (parts >= plan.months ? plan.total : parts * divFloor(plan.total, plan.months));
  }
  const schedule = entry.schedule ?? [];
  if (month <= 0) return 0;
  if (month >= schedule.length) return item.principal;
  const share = schedule.slice(0, month).reduce((sum, part) => sum + part, 0);
  return mulDiv(item.principal, share, BP_WHOLE);
}

/** What the month's charge asks of a scheduled tuition: what should be paid by its course month less what has been, the arrears among it. */
function tuitionDue(item: ObligationState, entry: ObligationEntry, month: number): number {
  return Math.max(0, tuitionOwedBy(item, entry, courseMonthOf(item, month)) - (item.principal - item.outstanding));
}

/** obligation:paying-down-obligations: every charge missed and not yet paid, read after the last month played. */
export function tuitionArrears(read: ReadCtx, item: ObligationState, entry: ObligationEntry): number {
  return entry.schedule === undefined ? 0 : tuitionDue(item, entry, read.state.turn.month);
}

/** abroad-money:missed-tuition-runs-in-stages: the plan's months, the course months left to its last, never fewer than one. */
function planMonths(read: ReadCtx, item: ObligationState): number {
  return Math.max(1, read.content.tuning.status.courseMonths - courseMonthOf(item, read.state.turn.month));
}

/** One month's charge, split by the sink it is paid under (obligation:due-phase-charges-oldest-first). */
interface Charge {
  /** The fixed amount plus the principal part, paid under the entry's sink. */
  base: number;
  /** Interest on the opening principal, paid under the entry's interest sink. */
  interest: number;
  /** The part of `base` that lowers what is owed. */
  principal: number;
  /** What each relief took off `base`, already taken (obligation:cooking-and-fetching-water). Empty when the item has none. */
  relief: { source: string; amount: number }[];
}

/**
 * obligation:cooking-and-fetching-water: each relief on the item takes its share of the charge's base, never below zero.
 * Each share is of the whole base, so the order of two reliefs changes nothing until the base runs out.
 */
function relieve(item: ObligationState, charge: Omit<Charge, "relief">): Charge {
  let base = charge.base;
  const relief: Charge["relief"] = [];
  for (const { source, bp: share } of item.relief ?? []) {
    const amount = Math.min(base, bp(charge.base, share));
    base -= amount;
    relief.push({ source, amount });
  }
  return { ...charge, base, relief };
}

/** car:car-bought-on-finance, car:final-payment-owns-the-car: the car's monthly part stops at the final payment; at term end the final payment is the charge. */
function carCharge(item: ObligationState, entry: ObligationEntry): Charge {
  const { final } = carTerms(entry);
  if (item.monthsLeft === 0) return { base: item.outstanding, interest: 0, principal: item.outstanding, relief: [] };
  const scheduled = divCeil(Math.max(0, item.principal - final), entry.term ?? 1);
  const principal = Math.min(scheduled, Math.max(0, item.outstanding - final));
  // The ladder's rate is fixed at opening as the monthly interest, held in `amount` (see `openEffect`).
  return { base: principal, interest: item.amount, principal, relief: [] };
}

function chargeOf(read: ReadCtx, item: ObligationState, entry: ObligationEntry): Charge {
  return relieve(item, scheduledCharge(read, item, entry));
}

/**
 * home:moves-carry-cost-and-reason: one month's charge of an upkeep or support held at `amount`, as the bill takes it before any relief.
 * director:december-and-inflation: "at home" is a naira charge, so money sent home from abroad rises with it too.
 * The home view and the scheduled charge both read it, so the home card and the bill agree. Content without the
 * entry (a test's small world has no room on the water) charges the amount as it stands.
 */
export function livingCharge(read: Pick<ReadCtx, "world" | "content">, obligation: Id<"obligation">, amount: number): number {
  const entry = read.content.obligation[obligation];
  const rise = entry?.currency === "NGN" ? bp(amount, worldVarOr(read.world, INFLATION)) : 0;
  // home:living-by-hand (decision 0013): at home the living is lived by hand, as meals, water, fares and data; that share is never charged.
  // Makoko's figure goes the same way (the child of the water keeps equal or better odds); the room's first month is paid on the move.
  const byHand = entry?.currency === "NGN" && entry.type === "upkeep" ? bp(amount + rise, read.content.tuning.home.livingByHandBp) : 0;
  return Math.max(0, amount + rise - byHand);
}

/** The charge as scheduled, before any relief. */
function scheduledCharge(read: ReadCtx, item: ObligationState, entry: ObligationEntry): Omit<Charge, "relief"> {
  const interest = bp(item.principal, entry.rateBp);
  // Held funds are returned whole (obligation:paying-down-obligations); only these types repay principal on a schedule.
  const scheduled = SCHEDULED_TYPES.includes(entry.type) && entry.term !== null ? divCeil(item.principal, entry.term) : 0;
  // abroad-money:tuition-paid-in-instalments: a scheduled tuition charges its course month's share and its arrears together.
  const principal = entry.schedule !== undefined ? Math.min(tuitionDue(item, entry, read.state.turn.month), item.outstanding) : Math.min(scheduled, item.outstanding);
  switch (entry.type) {
    case "car":
      return carCharge(item, entry);
    case "group-loan":
      // No fixed charge: `amount` holds the savings held back (see `openEffect`).
      return { base: principal, interest, principal };
    case "upkeep":
    case "support":
      return { base: livingCharge(read, item.entry, item.amount), interest, principal };
    case "loan":
    case "held-funds":
    case "rent":
    case "phone":
    case "surcharge":
    case "tuition":
    case "agent-debt":
    case "undertaking":
    case "ajo":
      return { base: item.amount + principal, interest, principal };
    default: {
      const never: never = entry.type;
      throw new Error(`Unknown obligation type ${String(never)}.`);
    }
  }
}

function totalOf(charge: Charge): number {
  return charge.base + charge.interest;
}

/** car:missed-payments-take-the-car: what clears a car's arrears with `obligation/pay`: every missed charge, the ones left in the term at most. */
function carArrears(item: ObligationState, entry: ObligationEntry): Charge & { months: number } {
  const months = Math.min(item.missed, item.monthsLeft ?? 0);
  const monthly = carCharge(item, entry);
  const principal = Math.min(months * monthly.principal, Math.max(0, item.outstanding - carTerms(entry).final));
  return { months, base: principal, interest: months * monthly.interest, principal, relief: [] };
}

/**
 * What the view shows as due this coming month. A defaulted loan has no charge
 * any more: the lender takes what is owed from the bank (obligation:loan-default-and-recovery).
 * So the view shows what is still owed, the most the lender can take;
 * a car behind on its payments shows its arrears, the amount `obligation/pay`
 * takes to clear them (car:missed-payments-take-the-car).
 */
function dueNext(read: ReadCtx, item: ObligationState, entry: ObligationEntry): number {
  // route:education-loan-pays-the-school: nothing is due while the charges wait.
  if (item.deferred !== undefined) return 0;
  // undertaking:view-lists-undertaking: what is owed now, all of it asked for at once.
  if (isSponsorUndertaking(entry)) return item.outstanding;
  if (item.state === "defaulted") return COLLECTED_TYPES.includes(entry.type) ? item.outstanding : 0;
  if (entry.type === "car" && item.missed > 0 && item.monthsLeft !== 0) return totalOf(carArrears(item, entry));
  if (entry.schedule !== undefined) return tuitionDue(item, entry, read.state.turn.month + 1);
  if (!dueIn(item, entry, read.state.turn.month + 1)) return 0;
  return totalOf(chargeOf(read, item, entry));
}

/**
 * True when this much could be taken from cash and bank now (obligation:charges-paid-whole-or-missed).
 * Naira is judged with `money/can-pay`. A foreign charge is taken from that
 * currency's own pockets, never through naira, so it is judged with
 * `money/min` instead.
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

/** credit:payments-move-the-mark: a payment on an entry that reports to the file moves it. */
function report(ctx: Ctx, item: ObligationState, entry: ObligationEntry, points: number): void {
  if (entry.reportsToCredit !== true) return;
  ctx.apply([{ type: "credit/mark", amount: points }], causeOf(item));
}

/** obligation:group-loan-fees-up-front: the savings held back come back when a group loan closes paid. */
function returnSavings(ctx: Ctx, item: ObligationState, entry: ObligationEntry): void {
  if (entry.type !== "group-loan" || item.state === "defaulted") return;
  if (item.amount > 0) ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: item.amount, reason: "deposit-return" }], causeOf(item));
}

/**
 * abroad-money:arrival-opens-upkeep-and-room: a flat's deposit comes back to the bank of its currency when the tenancy ends. An eviction, the
 * flat's own default closing it, keeps it: the rent it was missed for is never charged again.
 */
function returnDeposit(ctx: Ctx, item: ObligationState, entry: ObligationEntry, cause: Cause): void {
  if (entry.deposit === undefined || entry.deposit === 0 || cause.source === item.entry) return;
  ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: entry.deposit, reason: "deposit-return" }], causeOf(item));
}

function close(ctx: Ctx, item: ObligationState, why: "paid" | "closed" | "ended" | "dropped"): BaseEvent[] {
  return record(ctx, { type: "obligation/closed", id: item.id, entry: item.entry, why });
}

/** Closes a loan paid off, with a group loan's savings returned. */
function closePaid(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  returnSavings(ctx, item, entry);
  return close(ctx, item, "paid");
}

/**
 * A defaulted loan (obligation:loan-default-and-recovery): no charge and no misses any more. The
 * lender takes whatever is in the bank pocket of the loan's currency, up to
 * what is owed, and the loan closes when nothing is owed. What is owed is the
 * principal still outstanding: interest stops once a loan is in default, and
 * the taking starts in the `due` phase after the one in which it defaulted.
 */
function seize(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const amount = Math.min(ctx.state.wallet.pockets[entry.currency].bank, item.outstanding);
  const events: BaseEvent[] = [];
  if (amount > 0) {
    take(ctx, causeOf(item), entry.currency, "bank", amount, entry.sink);
    events.push(...record(ctx, { type: "obligation/seized", id: item.id, entry: item.entry, amount }));
  }
  if (item.outstanding - amount === 0) events.push(...close(ctx, item, "paid"));
  return events;
}

/**
 * luck:savings-circle-holds-pot: after a paid month, one draw in the months still to come gives
 * the pot, once per circle; the circle ends with its last month. The pot is
 * held as the circle's outstanding until it is paid.
 */
function drawPot(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const events: BaseEvent[] = [];
  const toCome = item.monthsLeft ?? 0;
  if (item.outstanding > 0 && toCome > 0 && ctx.random.int("lotto", toCome) === 0) {
    ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: item.outstanding, reason: "gift" }], causeOf(item));
    events.push(...record(ctx, { type: "obligation/pot-paid", id: item.id, entry: item.entry, amount: item.outstanding }));
  }
  if (toCome <= 1) events.push(...close(ctx, item, "ended"));
  return events;
}

/**
 * obligation:three-roads-to-group-loan: three months after standing guarantor, the relative may be
 * gone, and the undertaking's `onDefault` opens the loan on the character for
 * the balance. The draw is on `offer`, the stream of the offer that opened it.
 */
function callGuarantee(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  if ((item.monthsLeft ?? 0) > 1) return [];
  const events: BaseEvent[] = [];
  if (ctx.random.chance("offer", ctx.content.tuning.groupLoan.vanishBp)) {
    events.push(...record(ctx, { type: "obligation/defaulted", id: item.id, entry: item.entry, outstanding: item.outstanding }));
    ctx.apply(entry.onDefault, causeOf(item));
  }
  if (ctx.state.obligation.items[item.id] !== undefined) events.push(...close(ctx, item, "ended"));
  return events;
}

/** A charge paid in full (obligation:charges-paid-whole-or-missed): fixed and principal under the sink, interest under the interest sink. */
function pay(ctx: Ctx, item: ObligationState, entry: ObligationEntry, charge: Charge): BaseEvent[] {
  const cause = causeOf(item);
  take(ctx, cause, entry.currency, "any", charge.base, entry.sink);
  take(ctx, cause, entry.currency, "any", charge.interest, entry.interestSink);
  const events = record(ctx, {
    type: "obligation/charged",
    id: item.id,
    entry: item.entry,
    total: totalOf(charge),
    interest: charge.interest,
    principal: charge.principal,
    ...(charge.relief.length === 0 ? {} : { relief: charge.relief }),
  });
  report(ctx, item, entry, ctx.content.tuning.credit.onTime);
  switch (entry.type) {
    case "loan":
    case "group-loan":
    case "tuition":
      // obligation:charges-paid-whole-or-missed, obligation:closed-obligation-removed: paid off by its charges.
      if (item.outstanding - charge.principal === 0) events.push(...closePaid(ctx, item, entry));
      return events;
    case "car":
      if (item.monthsLeft === 0) events.push(...record(ctx, { type: "obligation/owned", id: item.id, entry: item.entry }));
      return events;
    case "ajo":
      return [...events, ...drawPot(ctx, item, entry)];
    case "undertaking":
      return [...events, ...callGuarantee(ctx, item, entry)];
    case "upkeep":
    case "support":
    case "held-funds":
    case "rent":
    case "phone":
    case "surcharge":
    case "agent-debt":
      return events;
    default: {
      const never: never = entry.type;
      throw new Error(`Unknown obligation type ${String(never)}.`);
    }
  }
}

/** car:missed-payments-take-the-car: the car is taken. What is owed less its resale is still owed, with a judgment, when above zero. */
function repossess(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const cause = causeOf(item);
  const shortfall = Math.max(0, item.outstanding - carTerms(entry).resale);
  const events = record(ctx, { type: "obligation/repossessed", id: item.id, entry: item.entry, owed: item.outstanding, shortfall });
  report(ctx, item, entry, -ctx.content.tuning.credit.onDefault);
  ctx.apply(entry.onDefault, cause);
  if (shortfall > 0) ctx.apply([{ type: "obligation/open", obligation: carOf(entry).shortfall, principal: shortfall }, { type: "credit/judgment" }], cause);
  return events;
}

/** car:missed-payments-take-the-car, car:final-payment-owns-the-car: a missed car payment. */
function missCar(ctx: Ctx, item: ObligationState, entry: ObligationEntry, charge: Charge): BaseEvent[] {
  const missed = item.missed + 1;
  const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: totalOf(charge), missed });
  ctx.apply(entry.onMiss, causeOf(item));
  if (item.monthsLeft === 0) {
    // car:final-payment-owns-the-car: the final payment missed, the car goes back with nothing owed.
    report(ctx, item, entry, -ctx.content.tuning.credit.onMiss);
    return [...events, ...record(ctx, { type: "obligation/handed-back", id: item.id, entry: item.entry, shortfall: 0 })];
  }
  if (missed <= entry.grace) {
    report(ctx, item, entry, -ctx.content.tuning.credit.onMiss);
    return events;
  }
  const terms = carTerms(entry);
  if (carPaid(entry, item) < terms.third) return [...events, ...repossess(ctx, item, entry)];
  report(ctx, item, entry, -ctx.content.tuning.credit.onMiss);
  return [...events, ...record(ctx, { type: "obligation/court", id: item.id, entry: item.entry, takenMonth: ctx.state.turn.month + terms.courtMonths })];
}

/** car:missed-payments-take-the-car: waiting on the court, nothing is charged; each month is another miss until the car is taken. */
function courtMonth(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const missed = item.missed + 1;
  const charge = carCharge(item, entry);
  const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: totalOf(charge), missed });
  if (missed >= entry.grace + 1 + carTerms(entry).courtMonths) return [...events, ...repossess(ctx, item, entry)];
  report(ctx, item, entry, -ctx.content.tuning.credit.onMiss);
  return events;
}

/** obligation:group-covers-misses-at-cost: what each miss in a row costs on a group loan before the default. */
function groupMissEffects(ctx: Ctx, entry: ObligationEntry, missed: number): Effect[] {
  if (missed === 1) return entry.onMiss;
  if (missed === 2) {
    const { standing, wellbeing } = ctx.content.tuning.groupLoan.visit;
    return [
      { type: "quality/add", quality: QUALITY.standing, amount: standing },
      { type: "quality/add", quality: QUALITY.wellbeing, amount: wellbeing },
    ];
  }
  return [];
}

/**
 * abroad-money:missed-tuition-runs-in-stages: a scheduled tuition's miss is a stage, never a grace count. With no plan: a reminder, then the cut of
 * access with the plan offered, then the final warning, then withdrawal; on a plan: the final warning, then withdrawal. Withdrawal is told as the
 * default and applies `onDefault` (status:course-passed-or-withdrawn).
 */
function missTuition(ctx: Ctx, item: ObligationState, entry: ObligationEntry, charge: Charge): BaseEvent[] {
  const missed = item.missed + 1;
  const cause = causeOf(item);
  const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: totalOf(charge), missed });
  const stages: readonly (TuitionStage | "withdrawn")[] = item.plan !== undefined ? ["warning", "withdrawn"] : ["reminder", "cut", "warning", "withdrawn"];
  const stage = stages[Math.min(missed, stages.length) - 1] ?? "withdrawn";
  if (stage === "withdrawn") {
    events.push(...record(ctx, { type: "obligation/defaulted", id: item.id, entry: item.entry, outstanding: item.outstanding }));
    ctx.apply(entry.onDefault, cause);
    return events;
  }
  events.push(...record(ctx, { type: "obligation/staged", id: item.id, entry: item.entry, stage, total: totalOf(charge) }));
  if (stage === "cut") {
    // The plan's offer reads what a plan agreed now would ask a month, and its fee.
    const months = planMonths(ctx, item);
    ctx.apply(entry.onCut ?? [], { ...cause, terms: { ...cause.terms, instalment: divFloor(item.outstanding, months), fee: ctx.content.tuning.status.planFee } });
  }
  return events;
}

/**
 * route:family-pledge-pays-tuition: a tuition charge abroad is met from the family's pledge first, while any of it is left, and the student's own
 * money meets only what the pledge no longer covers, so the student's pay is left for the living. True when the charge can be taken now.
 */
function pledgeCovers(ctx: Ctx, item: ObligationState, entry: ObligationEntry, total: number): boolean {
  if (entry.type === "tuition" && entry.currency !== "NGN" && ctx.state.place.where === "abroad" && total > 0) {
    ctx.apply([{ type: "route/pledge-pay", currency: entry.currency, amount: total }], causeOf(item));
  }
  return canTake(ctx, entry.currency, total);
}

/** A charge that could not be paid (obligation:miss-applies-its-effects, obligation:upkeep-never-defaults, obligation:loan-default-and-recovery, obligation:missed-interest-recalls-held-funds, obligation:group-covers-misses-at-cost, abroad-money:arrival-opens-upkeep-and-room, abroad-money:phone-contract-builds-credit, abroad-money:tuition-paid-in-instalments, luck:savings-circle-holds-pot). */
function miss(ctx: Ctx, item: ObligationState, entry: ObligationEntry, charge: Charge): BaseEvent[] {
  const cause = causeOf(item);
  if (entry.type === "held-funds") {
    // obligation:missed-interest-recalls-held-funds: the lender takes the principal back at once, then onMiss. A missed
    // month on held funds counts no miss and checks no grace, since the obligation is gone.
    const amount = Math.min(ctx.state.wallet.pockets[entry.currency].locked, item.outstanding);
    take(ctx, cause, entry.currency, "locked", amount, "held-funds-return");
    const events = record(ctx, { type: "obligation/taken-back", id: item.id, entry: item.entry, amount });
    ctx.apply(entry.onMiss, cause);
    return events;
  }
  if (entry.type === "car") return missCar(ctx, item, entry, charge);
  if (entry.schedule !== undefined) return missTuition(ctx, item, entry, charge);
  const missed = item.missed + 1;
  if (entry.type === "ajo") {
    // luck:savings-circle-holds-pot: a missed month closes the circle, and no pot.
    const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: totalOf(charge), missed });
    ctx.apply(entry.onMiss, cause);
    return [...events, ...close(ctx, item, "dropped")];
  }
  if (entry.type === "group-loan" && missed === 1) {
    // obligation:group-covers-misses-at-cost: the group covers the charge and adds it to what is owed.
    const events = record(ctx, { type: "obligation/covered", id: item.id, entry: item.entry, total: totalOf(charge), principal: charge.principal, missed });
    ctx.apply(entry.onMiss, cause);
    return events;
  }
  // obligation:charges-paid-whole-or-missed (decision 0013): the upkeep takes what the naira holds and the shortfall is the miss, so a bill
  // short by a little never leaves the whole month's money untouched and the results saying nothing moved.
  const paid = entry.type === "upkeep" && entry.currency === "NGN" ? Math.min(totalOf(charge), spendable(ctx.state.wallet.pockets.NGN)) : 0;
  if (paid > 0) take(ctx, cause, entry.currency, "any", paid, "upkeep");
  const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: totalOf(charge), missed, ...(paid > 0 ? { paid } : {}) });
  ctx.apply(entry.type === "group-loan" ? groupMissEffects(ctx, entry, missed) : entry.onMiss, cause);
  // obligation:upkeep-never-defaults: upkeep and support never default. obligation:loan-default-and-recovery: the miss that passes the grace applies onMiss, then onDefault.
  const defaults = GRACE_TYPES.includes(entry.type) && missed > entry.grace;
  // credit:payments-move-the-mark: the month that defaults takes the default figure in place of the miss figure.
  report(ctx, item, entry, -(defaults ? ctx.content.tuning.credit.onDefault : ctx.content.tuning.credit.onMiss));
  if (!defaults) return events;
  events.push(...record(ctx, { type: "obligation/defaulted", id: item.id, entry: item.entry, outstanding: item.outstanding }));
  ctx.apply(entry.onDefault, cause);
  // obligation:group-covers-misses-at-cost: the named asset goes with the default.
  if (entry.seize !== undefined) ctx.apply(entry.seize, cause);
  return events;
}

/**
 * route:education-loan-pays-the-school: a loan whose charges wait on a status charges nothing before that status is held, nor while it is. The month it is
 * first found ended, the charges are set to start, and the first falls the month after.
 */
function deferral(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const waits = entry.deferWhile;
  const holding = waits !== undefined && ctx.state.status.current?.entry === waits;
  if (holding && item.deferred?.seen !== true) return record(ctx, { type: "obligation/deferral-seen", id: item.id, entry: item.entry });
  if (holding || item.deferred?.seen !== true) return [];
  return record(ctx, { type: "obligation/started", id: item.id, entry: item.entry, month: ctx.state.turn.month });
}

/** Everything owed this month, oldest first (obligation:due-phase-charges-oldest-first). */
function due(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  // Ids first, then each item read again: an earlier charge may have changed the state.
  for (const id of openItems(ctx.state).map((item) => item.id)) {
    const item = ctx.state.obligation.items[id];
    if (item === undefined) continue;
    const entry = entryOf(ctx.content, item.entry);
    if (isSponsorUndertaking(entry)) {
      events.push(...undertakingDue(ctx, item, entry));
      continue;
    }
    if (item.state === "defaulted") {
      // A withdrawn student's tuition stays on record (status:course-passed-or-withdrawn reads it) and is collected no further.
      if (COLLECTED_TYPES.includes(entry.type)) events.push(...seize(ctx, item, entry));
      continue;
    }
    if (inCourt(item, entry)) {
      events.push(...courtMonth(ctx, item, entry));
      continue;
    }
    if (item.deferred !== undefined) {
      events.push(...deferral(ctx, item, entry));
      continue;
    }
    if (!dueIn(item, entry, ctx.state.turn.month)) continue;
    const charge = chargeOf(ctx, item, entry);
    const paid = pledgeCovers(ctx, item, entry, totalOf(charge));
    events.push(...(paid ? pay(ctx, item, entry, charge) : miss(ctx, item, entry, charge)));
  }
  // person:sibling-couch-delays-rent: after the month's charges, so the couch's months are free.
  ctx.apply(couchEnds(ctx), { source: "people.couch", param: null, terms: {} });
  return events;
}

// ---------------------------------------------------------------------------
// Opening and closing
// ---------------------------------------------------------------------------

/** True when the effect comes from an obligation's own effects: a debt taken over, not money lent. */
function takenOver(content: Content, cause: Cause): boolean {
  return (content.obligation as Record<string, ObligationEntry | undefined>)[cause.source] !== undefined;
}

/**
 * obligation:loan-opening-credits-principal, obligation:group-loan-fees-up-front, place:entries-legal-by-where. An obligation opened by another
 * obligation's effects (the room after an eviction, the shortfall after a
 * repossession, a guarantee called in) is owed but credits nothing.
 */
function openEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "obligation/open") throw new Error(`obligation/open cannot carry out ${effect.type}.`);
  const entry = entryOf(ctx.content, effect.obligation);
  if (!appliesHere(entry, ctx.state) || onTheCouch(ctx, entry.id)) return [];
  if (isSponsorUndertaking(entry)) return openUndertaking(ctx, entry, effect.bond);
  const given = effect.principal === undefined ? 0 : ctx.amount(effect.principal, cause.terms);
  let amount = effect.amount === undefined ? entry.amount : ctx.amount(effect.amount, cause.terms);
  if (given < 0 || amount < 0) throw new Error(`${entry.id} cannot open owing a negative amount.`);
  // luck:savings-circle-holds-pot: the circle holds the pot it will pay, `amount` times `term`.
  const principal = entry.type === "ajo" ? amount * (entry.term ?? 1) : given;
  // car:car-bought-on-finance, credit:rate-follows-credit-ladder. An obligation keeps no rate of its own, and obligation:due-phase-charges-oldest-first's interest on the
  // opening principal is a fixed sum, so the ladder's rate is fixed now as the monthly interest, held in `amount`.
  if (entry.type === "car") amount = bp(principal, rateFor(ctx, entry) ?? entry.rateBp);
  const lent = !takenOver(ctx.content, cause);
  // obligation:group-loan-fees-up-front. A group loan has no fixed charge, so `amount` holds the savings held back, none when taken over.
  if (entry.type === "group-loan") amount = lent ? bp(principal, ctx.content.tuning.groupLoan.savingsBp) : 0;
  // A debt of nothing would close before it was ever owed, and a circle of nothing has no pot, so nothing opens.
  if ((OWING_TYPES.includes(entry.type) || entry.type === "ajo") && principal === 0) return [];
  // road:chain-steps-monthly: a ransom nobody pays is added to the debt already owed to the same men.
  const owed = entry.type === "agent-debt" ? openItems(ctx.state).find((open) => open.entry === entry.id) : undefined;
  if (owed !== undefined) return record(ctx, { type: "obligation/grown", id: owed.id, entry: owed.entry, amount: principal });
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
    bond: null,
    charged: 0,
    // route:education-loan-pays-the-school: charges wait on the status the entry names.
    ...(entry.deferWhile === undefined ? {} : { deferred: { seen: false } }),
  };
  const events = record(ctx, { type: "obligation/opened", item });
  if (!lent) return events;
  const credit = { source: item.entry, param: null, terms: cause.terms };
  // route:education-loan-pays-the-school: a loan paid to the school credits nothing to the borrower.
  if (entry.type === "loan" && entry.paysSchool !== true) {
    ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: principal, reason: "loan", flagged: true }], credit);
  }
  if (entry.type === "held-funds") {
    ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: principal, reason: "held-funds", flagged: true, locked: true }], credit);
  }
  if (entry.type === "group-loan") {
    // obligation:group-loan-fees-up-front: the savings are held back from the credit, then the fee is paid out of it.
    const fee = bp(principal, ctx.content.tuning.groupLoan.feeBp);
    ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: principal - amount, reason: "loan", flagged: true }], credit);
    if (fee > 0) ctx.apply([{ type: "money/take", currency: entry.currency, pocket: "bank", amount: fee, reason: "fee-agent" }], credit);
  }
  return events;
}

/**
 * return:return-reopens-home-charges for a car closed by type: it is handed back as car:car-handed-back-after-half, and
 * when under half is paid what is owed less its resale still follows. Closed on
 * the way home, the shortfall opens in naira at the day's official rate.
 */
function closeCar(ctx: Ctx, item: ObligationState, entry: ObligationEntry, cause: Cause): BaseEvent[] {
  const terms = carTerms(entry);
  const shortfall = carPaid(entry, item) >= terms.half ? 0 : Math.max(0, item.outstanding - terms.resale);
  const events = record(ctx, { type: "obligation/handed-back", id: item.id, entry: item.entry, shortfall });
  if (shortfall === 0) return events;
  const from = { ...cause, source: item.entry };
  if (ctx.state.place.where === "home" && ctx.content.obligation[HOME_SHORTFALL] !== undefined) {
    const naira = convertMinor(shortfall, entry.currency, "NGN", officialRates(ctx.world));
    ctx.apply([{ type: "obligation/open", obligation: HOME_SHORTFALL, principal: naira }], from);
  } else {
    ctx.apply([{ type: "obligation/open", obligation: carOf(entry).shortfall, principal: shortfall }], from);
  }
  return events;
}

/** Closes every open obligation of one type: a move, a return, an eviction (place:departure-moves-abroad, abroad-money:arrival-opens-upkeep-and-room, return:return-reopens-home-charges). */
function closeEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "obligation/close") throw new Error(`obligation/close cannot carry out ${effect.type}.`);
  const events: BaseEvent[] = [];
  for (const item of openItems(ctx.state)) {
    const entry = entryOf(ctx.content, item.entry);
    if (entry.type !== effect.obligationType || (effect.obligation !== undefined && item.entry !== effect.obligation)) continue;
    if (entry.type === "car") {
      events.push(...closeCar(ctx, item, entry, cause));
      continue;
    }
    returnDeposit(ctx, item, entry, cause);
    events.push(...close(ctx, item, "closed"));
  }
  return events;
}

/**
 * abroad-money:missed-tuition-runs-in-stages: agreeing the payment plan turns the open tuition of the entry into it: what is owed now, spread evenly over
 * the course months left to the last. The cut of access ends with the misses.
 */
function planEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "obligation/plan") throw new Error(`obligation/plan cannot carry out ${effect.type}.`);
  const item = openItems(ctx.state).find((open) => open.entry === effect.obligation && open.state !== "defaulted");
  const entry = item === undefined ? undefined : entryOf(ctx.content, item.entry);
  if (item === undefined || entry?.schedule === undefined || item.outstanding === 0) return [];
  const plan = { month: courseMonthOf(item, ctx.state.turn.month), total: item.outstanding, months: planMonths(ctx, item) };
  return record(ctx, { type: "obligation/planned", id: item.id, entry: item.entry, plan });
}

/**
 * obligation:cooking-and-fetching-water: a share off the next charge of the open obligation of the type that applies where
 * the character lives, the oldest when there are several. A source already on the item adds nothing,
 * so cooking twice in a month takes the share once. With nothing open of the type, nothing happens.
 */
function reliefEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "obligation/relief") throw new Error(`obligation/relief cannot carry out ${effect.type}.`);
  const item = openItems(ctx.state).find((open) => {
    const entry = entryOf(ctx.content, open.entry);
    return entry.type === effect.obligationType && open.state !== "defaulted" && appliesHere(entry, ctx.state);
  });
  if (item === undefined || effect.bp === 0 || (item.relief ?? []).some((relief) => relief.source === cause.source)) return [];
  return record(ctx, { type: "obligation/relieved", id: item.id, entry: item.entry, source: cause.source, bp: effect.bp });
}

// ---------------------------------------------------------------------------
// Paying early: obligation:paying-down-obligations, car:missed-payments-take-the-car, car:car-handed-back-after-half
// ---------------------------------------------------------------------------

function isGoodAmount(amount: unknown): amount is number {
  return isWhole(amount) && amount > 0;
}

function payLoan(ctx: Ctx, item: ObligationState, entry: ObligationEntry, amount: unknown): BaseEvent[] | Rejection {
  if (!isGoodAmount(amount) || amount > item.outstanding) {
    return reject("bad-amount", `A loan takes a whole amount above zero and up to the ${String(item.outstanding)} owed.`);
  }
  if (!canTake(ctx, entry.currency, amount)) return reject("cannot-afford", "There is not that much in cash and the bank together.");
  take(ctx, causeOf(item), entry.currency, "any", amount, "loan-repay");
  const events = record(ctx, { type: "obligation/repaid", id: item.id, entry: item.entry, amount });
  if (amount === item.outstanding) events.push(...closePaid(ctx, item, entry));
  return events;
}

/** car:car-handed-back-after-half: an amount of 0 hands the car back once half is paid. car:missed-payments-take-the-car: any other amount must clear the arrears exactly. */
function payCar(ctx: Ctx, item: ObligationState, entry: ObligationEntry, amount: unknown): BaseEvent[] | Rejection {
  if (!isWhole(amount) || amount < 0) return reject("bad-amount", "A car takes 0 to hand it back, or the whole of its arrears.");
  if (isOwned(item, entry)) return reject("not-legal", "The car is yours. Nothing is owed on it.");
  if (amount === 0) {
    if (carPaid(entry, item) < carTerms(entry).half) return reject("not-legal", "A car can be handed back only once half its price is paid.");
    return record(ctx, { type: "obligation/handed-back", id: item.id, entry: item.entry, shortfall: 0 });
  }
  const arrears = carArrears(item, entry);
  if (arrears.months === 0) return reject("not-legal", "The car has no arrears. It is paid month by month.");
  if (amount !== totalOf(arrears)) return reject("bad-amount", `The arrears are ${String(totalOf(arrears))}, paid whole.`);
  if (!canTake(ctx, entry.currency, amount)) return reject("cannot-afford", "There is not that much in cash and the bank together.");
  const cause = causeOf(item);
  take(ctx, cause, entry.currency, "any", arrears.base, entry.sink);
  take(ctx, cause, entry.currency, "any", arrears.interest, entry.interestSink);
  return record(ctx, { type: "obligation/caught-up", id: item.id, entry: item.entry, months: arrears.months, total: amount, principal: arrears.principal });
}

/**
 * obligation:paying-down-obligations: a scheduled tuition takes every charge missed and not yet paid, whole, under its sink. It clears the arrears and
 * what they set in motion (abroad-money:missed-tuition-runs-in-stages): the stage ends, access is restored, and a withdrawn student is reinstated (status:course-passed-or-withdrawn).
 */
function payTuition(ctx: Ctx, item: ObligationState, entry: ObligationEntry, amount: unknown): BaseEvent[] | Rejection {
  const arrears = tuitionArrears(ctx, item, entry);
  if (arrears === 0) return reject("not-legal", `${entry.id} has no arrears. It is paid month by month.`);
  if (!isGoodAmount(amount) || amount !== arrears) return reject("bad-amount", `The arrears are ${String(arrears)}, paid whole.`);
  if (!canTake(ctx, entry.currency, amount)) return reject("cannot-afford", "There is not that much in cash and the bank together.");
  const cause = causeOf(item);
  take(ctx, cause, entry.currency, "any", amount, entry.sink);
  const events = record(ctx, { type: "obligation/caught-up", id: item.id, entry: item.entry, months: 0, total: amount, principal: amount });
  if (item.state === "defaulted") ctx.apply([{ type: "status/reinstate" }], cause);
  if (item.outstanding - amount === 0) events.push(...close(ctx, item, "paid"));
  return events;
}

function payCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "obligation/pay") throw new Error(`obligation/pay cannot handle ${command.type}.`);
  // person:stand-in-acts-narrowly: a stand-in never spends.
  if (ctx.sender === "stand-in") return reject("not-legal", "A stand-in never spends.");
  const item = ownOf(ctx.state.obligation.items, command.obligation);
  if (item === undefined) return reject("unknown-id", `There is no open obligation ${String(command.obligation)}.`);
  const entry = entryOf(ctx.content, item.entry);
  const { amount } = command;
  switch (entry.type) {
    case "loan":
    case "group-loan":
      // obligation:way-out-at-every-stage: a group loan can be paid ahead like any loan.
      return payLoan(ctx, item, entry, amount);
    case "held-funds": {
      if (!isGoodAmount(amount) || amount !== item.outstanding) {
        return reject("bad-amount", `Held funds go back whole: ${String(item.outstanding)}.`);
      }
      if (ctx.state.wallet.pockets[entry.currency].locked < amount) return reject("cannot-afford", "The locked pocket holds less than the principal.");
      take(ctx, causeOf(item), entry.currency, "locked", amount, "held-funds-return");
      return record(ctx, { type: "obligation/closed", id: item.id, entry: item.entry, why: "returned" });
    }
    case "car":
      return payCar(ctx, item, entry, amount);
    // obligation:paying-down-obligations rejects anything else, the agent's debt and tuition included; neither can be paid ahead.
    case "upkeep":
    case "support":
    case "rent":
    case "phone":
    case "surcharge":
    case "undertaking":
      // undertaking:missed-charges-lead-to-default: what a sponsor owes can be paid down; a guarantee cannot.
      if (isSponsorUndertaking(entry)) return payUndertaking(ctx, item, entry, amount);
      return reject("not-legal", `${entry.id} is paid month by month and cannot be paid ahead.`);
    case "tuition":
      if (entry.schedule !== undefined) return payTuition(ctx, item, entry, amount);
      return reject("not-legal", `${entry.id} is paid month by month and cannot be paid ahead.`);
    case "agent-debt":
    case "ajo":
      return reject("not-legal", `${entry.id} is paid month by month and cannot be paid ahead.`);
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

/** The item with its reliefs spent by the charge that just fell (obligation:cooking-and-fetching-water). */
function spent(item: ObligationState): ObligationState {
  if (item.relief === undefined) return item;
  const rest = { ...item };
  delete rest.relief;
  return rest;
}

function typeOf(content: Content, item: ObligationState): ObligationType {
  return entryOf(content, item.entry).type;
}

function evolve(slice: ObligationSlice, event: ObligationEvent, state: State, content: Content): ObligationSlice {
  switch (event.type) {
    case "obligation/opened":
      return { ...slice, items: { ...slice.items, [event.item.id]: event.item } };
    case "obligation/charged":
      return withItem(slice, event.id, (item) => ({
        ...spent(item),
        // A paid charge ends a grace (obligation:miss-applies-its-effects).
        state: item.state === "grace" ? "active" : item.state,
        outstanding: item.outstanding - event.principal,
        monthsLeft: item.monthsLeft === null ? null : Math.max(0, item.monthsLeft - 1),
        missed: 0,
      }));
    case "obligation/missed":
      return withItem(slice, event.id, (item) => ({
        ...spent(item),
        // Only these types have a grace to be in. Upkeep and support carry no arrears (obligation:upkeep-never-defaults).
        state: item.state === "active" && GRACE_TYPES.includes(typeOf(content, item)) ? "grace" : item.state,
        missed: event.missed,
      }));
    case "obligation/covered":
      return withItem(slice, event.id, (item) => ({
        ...spent(item),
        state: "grace",
        outstanding: item.outstanding - event.principal + event.total,
        monthsLeft: item.monthsLeft === null ? null : Math.max(0, item.monthsLeft - 1),
        missed: event.missed,
      }));
    case "obligation/defaulted": {
      // A debt stays open in default; a rent or a phone starts over, or its onDefault has closed it.
      const changed = withItem(slice, event.id, (item) =>
        DEBT_TYPES.includes(typeOf(content, item)) ? { ...item, state: "defaulted" } : { ...item, state: "active", missed: 0 },
      );
      // obligation:three-roads-to-group-loan: the month of the default is kept after the obligation closes.
      return { ...changed, defaulted: { ...slice.defaulted, [event.entry]: state.turn.month } };
    }
    case "obligation/seized":
    case "obligation/repaid":
    case "obligation/pot-paid":
      return withItem(slice, event.id, (item) => ({ ...item, outstanding: item.outstanding - event.amount }));
    case "obligation/grown":
      return withItem(slice, event.id, (item) => ({ ...item, principal: item.principal + event.amount, outstanding: item.outstanding + event.amount }));
    case "obligation/caught-up":
      return withItem(slice, event.id, (item) => ({
        ...item,
        state: "active",
        outstanding: item.outstanding - event.principal,
        monthsLeft: item.monthsLeft === null ? null : Math.max(0, item.monthsLeft - event.months),
        missed: 0,
      }));
    case "obligation/assessed":
      return withItem(slice, event.id, (item) => ({
        ...item,
        charged: item.charged + event.months,
        principal: item.principal + event.amount,
        outstanding: item.outstanding + event.amount,
      }));
    case "obligation/cleared":
      return withItem(slice, event.id, (item) => ({ ...item, state: "active", missed: 0 }));
    case "obligation/planned":
      return withItem(slice, event.id, (item) => ({ ...item, state: "active", missed: 0, plan: event.plan }));
    case "obligation/deferral-seen":
      return withItem(slice, event.id, (item) => ({ ...item, deferred: { seen: true } }));
    case "obligation/started":
      return withItem(slice, event.id, (item) => {
        const started = { ...item };
        delete started.deferred;
        return started;
      });
    case "obligation/staged":
      return slice;
    case "obligation/relieved": {
      const relief: Relief = { source: event.source, bp: event.bp };
      return withItem(slice, event.id, (item) => ({ ...item, relief: [...(item.relief ?? []), relief] }));
    }
    case "obligation/court":
    case "obligation/owned":
      return slice;
    case "obligation/taken-back":
    case "obligation/closed":
    case "obligation/repossessed":
    case "obligation/handed-back":
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
  return { key: `line.obligation.${key}`, params, tone, attention, counts: [] };
}

/** The key a default is told with, by what was in default. */
function defaultKey(entry: ObligationEntry): string {
  switch (entry.type) {
    case "rent":
      // A room at home keeps no credit file: its landlord takes the room back, and the home kind sends the character
      // home (home:rent-default-returns-to-family). Abroad, a flat's default sends the character back to a room; a room has nowhere cheaper to go.
      if (entry.reportsToCredit !== true) return "rent-lost";
      return entry.onDefault.length > 0 ? "evicted" : "rent-default";
    case "phone":
      return "cut-off";
    case "tuition":
      return "withdrawn";
    case "group-loan":
      return "group-default";
    case "undertaking":
      return isSponsorUndertaking(entry) ? "undertaking-default" : "guarantee-called";
    case "loan":
    case "upkeep":
    case "support":
    case "held-funds":
    case "car":
    case "surcharge":
    case "agent-debt":
    case "ajo":
      return "defaulted";
    default: {
      const never: never = entry.type;
      throw new Error(`Unknown obligation type ${String(never)}.`);
    }
  }
}

/** obligation:cooking-and-fetching-water: a relief is told in its activity's own words: `line.obligation.relief.cook-at-home`. */
function reliefKey(source: string): string {
  return `relief.${source.slice(source.indexOf(".") + 1)}`;
}

/** The key a miss is told with: the car's notice and the group's visit are their own (car:missed-payments-take-the-car, obligation:group-covers-misses-at-cost). */
function missKey(entry: ObligationEntry, missed: number): string {
  if (entry.type === "car" && missed === entry.grace) return "car-notice";
  if (entry.type === "group-loan" && missed === 2) return "group-visit";
  return "missed";
}

/** A close by type is told by what caused it: the move, the return or the eviction. */
function closedLines(entry: Id<"obligation">, why: ClosedWhy): ReportLine[] {
  switch (why) {
    case "paid":
    case "returned":
      return [line("closed", { obligation: entry }, "good", false)];
    case "ended":
      return [line("ended", { obligation: entry }, "good", false)];
    case "dropped":
      return [line("dropped", { obligation: entry }, "bad", true)];
    case "closed":
      return [];
    default: {
      const never: never = why;
      throw new Error(`Unknown close ${String(never)}.`);
    }
  }
}

function lines(event: ObligationEvent, _state: State, content: Content): ReportLine[] {
  // An obligation's money is in its entry's currency.
  const money = (entry: Id<"obligation">, amount: number): MoneyParam => ({ currency: entryOf(content, entry).currency, amount });
  switch (event.type) {
    case "obligation/charged":
      // Said quietly: the wallet's own lines already show the money leaving. Each relief is its own line (obligation:cooking-and-fetching-water).
      return [
        ...(event.total === 0 ? [] : [line("charged", { obligation: event.entry, amount: money(event.entry, event.total) }, "plain", false)]),
        ...(event.relief ?? []).filter((relief) => relief.amount > 0).map((relief) => line(reliefKey(relief.source), { obligation: event.entry, amount: money(event.entry, relief.amount) }, "good", false)),
      ];
    case "obligation/missed":
      // abroad-money:missed-tuition-runs-in-stages: a scheduled tuition's miss is told by its stage's letter.
      if (entryOf(content, event.entry).schedule !== undefined) return [];
      if (event.paid !== undefined && event.paid > 0) return [line("missed-part", { obligation: event.entry, amount: money(event.entry, event.total), paid: money(event.entry, event.paid), short: money(event.entry, event.total - event.paid) }, "bad", true)];
      return [line(missKey(entryOf(content, event.entry), event.missed), { obligation: event.entry, amount: money(event.entry, event.total) }, "bad", true)];
    case "obligation/covered":
      return [line("group-covered", { obligation: event.entry, amount: money(event.entry, event.total) }, "bad", true)];
    case "obligation/defaulted":
      return [line(defaultKey(entryOf(content, event.entry)), { obligation: event.entry, amount: money(event.entry, event.outstanding) }, "bad", true)];
    case "obligation/seized": {
      // Without this line the wallet's "loan repayment" line would hide that it was taken.
      const key = isSponsorUndertaking(entryOf(content, event.entry)) ? "undertaking-seized" : "seized";
      return [line(key, { obligation: event.entry, amount: money(event.entry, event.amount) }, "bad", false)];
    }
    case "obligation/assessed":
      // undertaking:assistance-charged-to-sponsor: the months the sponsored partner took, never what they did with them.
      return [line("assessed", { obligation: event.entry, months: event.months, amount: money(event.entry, event.amount) }, "bad", true)];
    case "obligation/cleared":
      return [line("cleared", { obligation: event.entry }, "good", true)];
    case "obligation/staged":
      return [line(`tuition-${event.stage}`, { obligation: event.entry, amount: money(event.entry, event.total) }, "bad", true)];
    case "obligation/started":
      return [line("repayments-start", { obligation: event.entry }, "plain", true)];
    case "obligation/deferral-seen":
      return [];
    case "obligation/planned":
      return [line("tuition-plan", { obligation: event.entry, amount: money(event.entry, divFloor(event.plan.total, event.plan.months)), months: event.plan.months }, "good", false)];
    case "obligation/taken-back":
      return [line("taken-back", { obligation: event.entry, amount: money(event.entry, event.amount) }, "bad", true)];
    case "obligation/closed":
      return closedLines(event.entry, event.why);
    case "obligation/pot-paid":
      return [line("pot", { obligation: event.entry, amount: money(event.entry, event.amount) }, "good", true)];
    case "obligation/caught-up":
      return [line("caught-up", { obligation: event.entry, amount: money(event.entry, event.total) }, "good", false)];
    case "obligation/court":
      return [line("car-court", { obligation: event.entry, month: event.takenMonth }, "bad", true)];
    case "obligation/repossessed":
      return [
        line(
          event.shortfall > 0 ? "repossessed-owing" : "repossessed",
          { obligation: event.entry, amount: money(event.entry, event.owed), shortfall: money(event.entry, event.shortfall) },
          "bad",
          true,
        ),
      ];
    case "obligation/handed-back":
      return [
        line(event.shortfall > 0 ? "handed-back-owing" : "handed-back", { obligation: event.entry, shortfall: money(event.entry, event.shortfall) }, "plain", true),
      ];
    case "obligation/owned":
      return [line("owned", { obligation: event.entry }, "good", true)];
    case "obligation/grown":
      return [line("debt-grown", { obligation: event.entry, amount: money(event.entry, event.amount) }, "bad", true)];
    case "obligation/opened":
    case "obligation/repaid":
    case "obligation/relieved":
      // The wallet's line for the loan, the locked money or the repayment says it.
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown obligation event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Requirements, invariants and the view
// ---------------------------------------------------------------------------

/**
 * car:open-finance-gives-the-car: an open obligation of the type, not in default; with `obligation` set, only that entry (goal:goals-need-the-real-deed);
 * with `defaulted`, only one in default; with `localCurrency`, only one owed in the currency of the country the
 * character is in, naira at home (health:forced-months-warned-ahead).
 */
function judgeHas(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "obligation/has") throw new Error(`obligation/has cannot judge ${requirement.type}.`);
  const country = read.state.place.country;
  const local = country === null ? "NGN" : (read.content.country[country]?.currency ?? "NGN");
  const met = Object.values(read.state.obligation.items).some((item) => {
    const entry = read.content.obligation[item.entry];
    return (
      (item.state === "defaulted") === (requirement.defaulted === true) &&
      entry?.type === requirement.obligationType &&
      (requirement.obligation === undefined || item.entry === requirement.obligation) &&
      (requirement.localCurrency !== true || entry.currency === local)
    );
  });
  return { met };
}

/** obligation:three-roads-to-group-loan: one of the entries went into default within the tuning's months, open or since closed. */
function judgeDefaultedLately(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "obligation/defaulted-lately") throw new Error(`obligation/defaulted-lately cannot judge ${requirement.type}.`);
  const month = read.state.turn.month;
  const shut = read.content.tuning.groupLoan.shutAfterDefault;
  const met = requirement.obligations.some((entry) => {
    const at = read.state.obligation.defaulted?.[entry];
    return at !== undefined && month - at < shut;
  });
  return { met };
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  for (const [entry, month] of Object.entries(state.obligation.defaulted ?? {})) {
    if (month === undefined || !Number.isSafeInteger(month) || month < 0 || month > state.turn.month) problems.push(`The default of ${entry} is kept at month ${String(month)}, not a month played.`);
  }
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
    // obligation:group-covers-misses-at-cost: only the group's cover adds to what is owed.
    if (item.outstanding > item.principal && entry.type !== "group-loan") {
      problems.push(`Obligation ${id} owes ${String(item.outstanding)}, more than its principal ${String(item.principal)}.`);
    }
    if (item.state === "grace" && !GRACE_TYPES.includes(entry.type)) problems.push(`Obligation ${id} is in grace, but a ${entry.type} has none.`);
    if (item.state === "defaulted" && !DEBT_TYPES.includes(entry.type)) problems.push(`Obligation ${id} is in default, but a ${entry.type} does not stay open in default.`);
    // obligation:cooking-and-fetching-water: one share per source, each a share of the charge.
    const sources = (item.relief ?? []).map((relief) => relief.source);
    if (new Set(sources).size !== sources.length) problems.push(`Obligation ${id} holds the same relief twice.`);
    if ((item.relief ?? []).some((relief) => !Number.isSafeInteger(relief.bp) || relief.bp <= 0 || relief.bp > 10000)) problems.push(`Obligation ${id} holds a relief that is not a share.`);
  }
  return problems;
}

function obligationsView(read: ReadCtx): (ObligationState & { due: number; car: CarView | null })[] {
  // car:final-payment-owns-the-car: an owned car is kept with no obligation. The contract has no other place for the car, so the item stays in the state for hasCar.
  return openItems(read.state)
    .filter((item) => !isOwned(item, entryOf(read.content, item.entry)))
    .map((item) => {
      const entry = entryOf(read.content, item.entry);
      // undertaking:view-lists-undertaking: an undertaking's months run from the month it opened, whether or not anything was charged.
      const monthsLeft = isSponsorUndertaking(entry) ? undertakingMonthsLeft(read, item) : item.monthsLeft;
      return { ...item, monthsLeft, due: dueNext(read, item, entry), car: carView(read, item) };
    });
}

/** car:view-shows-car-terms's figures for one car; the view carries them on the item as `car`. */
export function carView(read: ReadCtx, item: ObligationState): CarView | null {
  const entry = read.content.obligation[item.entry];
  if (entry?.type !== "car") return null;
  const terms = carTerms(entry);
  const court = inCourt(item, entry);
  // In court each month is another miss, and the car goes at the miss that ends the court months.
  const courtMonth = court ? read.state.turn.month + entry.grace + 1 + terms.courtMonths - item.missed : null;
  const rateBp = item.principal > 0 ? mulDiv(item.amount, 10000, item.principal) : 0;
  return { ...terms, paid: carPaid(entry, item), interest: item.amount, rateBp, notice: item.missed >= entry.grace, courtMonth };
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
        bond: null,
        charged: 0,
      };
    }
    return { items };
  },
  commands: { "obligation/pay": payCommand },
  effects: { "obligation/open": openEffect, "obligation/close": closeEffect, "obligation/relief": reliefEffect, "obligation/plan": planEffect },
  phases: { due },
  evolve,
  lines,
  requirements: { "obligation/has": judgeHas, "obligation/defaulted-lately": judgeDefaultedLately },
  invariants,
  view: (read) => ({ obligations: obligationsView(read) }),
};
