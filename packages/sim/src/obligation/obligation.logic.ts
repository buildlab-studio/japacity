// Obligations: docs/rules/obligation.md, and for life abroad abroad-money.md
// R-ABROAD-003 to 005, car.md R-CAR-003 to 005 and luck.md R-LUCK-009. The
// scenario's obligations are real from the first state and get instance ids from
// the engine's counter (R-SCENARIO-002).
import { rateFor } from "../credit/credit.logic";
import { worldVarOr } from "../engine/check";
import { bp, convertMinor, divCeil, divFloor, mulDiv } from "../engine/int";
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
import { couchEnds, onTheCouch } from "./couch";
import type { ClosedWhy, ObligationEvent } from "./obligation.events";
import { isSponsorUndertaking, openUndertaking, payUndertaking, undertakingDue, undertakingMonthsLeft } from "./undertaking";
import { officialRates } from "../wallet/wallet.rates";

const STANDING: Id<"quality"> = "quality.standing";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const INFLATION: Id<"var"> = "var.inflation";
/** R-RETURN-006: the car's shortfall once it has followed you home, in naira. */
const HOME_SHORTFALL: Id<"obligation"> = "obligation.car-shortfall-home";

/** Types whose misses run a grace and can default (R-OBLIGATION-004, 005, R-ABROAD-003 to 005, R-CAR-003). */
const GRACE_TYPES: readonly ObligationType[] = ["loan", "group-loan", "tuition", "rent", "phone", "car", "undertaking"];
/** Types that stay open in default as a debt (R-OBLIGATION-005, R-STATUS-011, R-UNDERTAKING-008). */
const DEBT_TYPES: readonly ObligationType[] = ["loan", "group-loan", "tuition", "undertaking"];
/** Types the lender collects from the bank once in default (R-OBLIGATION-005, 011). */
const COLLECTED_TYPES: readonly ObligationType[] = ["loan", "group-loan"];
/** Types repaid in equal parts over their term (R-OBLIGATION-001, R-ABROAD-005). */
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
 * R-CAR-003, 004: what has been paid toward the car's price, the deposit
 * included. the total is the price, so paid is the price less what is
 * still owed; interest paid does not count toward the thirds and the half.
 */
export function carPaid(entry: ObligationEntry, item: ObligationState): number {
  return carTerms(entry).price - item.outstanding;
}

/** R-CAR-005: the final payment made, the car is the character's with nothing owed. */
function isOwned(item: ObligationState, entry: ObligationEntry): boolean {
  return entry.type === "car" && item.monthsLeft === 0 && item.outstanding === 0;
}

/** R-CAR-003: a third or more was paid and the lender is waiting on the court. */
function inCourt(item: ObligationState, entry: ObligationEntry): boolean {
  return entry.type === "car" && item.missed > entry.grace;
}

/** A whole number from 0 up to, not including, `every`. */
function modulo(value: number, every: number): number {
  return value - divFloor(value, every) * every;
}

/**
 * R-ABROAD-005, R-OBLIGATION-015: whether a charge falls in this month. An entry with
 * `everyMonths` is charged in the first month after opening and every
 * `everyMonths` after it; one `prepaid` had its first period paid when it opened,
 * so it is first charged `everyMonths` after the opening month, then every
 * `everyMonths`. a missed instalment is asked for again each
 * month until it is paid or defaults, so a grace of 1 is one month, not three.
 */
function dueIn(item: ObligationState, entry: ObligationEntry, month: number): boolean {
  if (isOwned(item, entry)) return false;
  if (entry.everyMonths === undefined || item.missed > 0) return true;
  const age = month - item.openedMonth - (entry.prepaid === true ? entry.everyMonths : 1);
  return age >= 0 && modulo(age, entry.everyMonths) === 0;
}

/** One month's charge, split by the sink it is paid under (R-OBLIGATION-001). */
export interface Charge {
  /** The fixed amount plus the principal part, paid under the entry's sink. */
  base: number;
  /** Interest on the opening principal, paid under the entry's interest sink. */
  interest: number;
  /** The part of `base` that lowers what is owed. */
  principal: number;
  /** What each relief took off `base`, already taken (R-OBLIGATION-014). Empty when the item has none. */
  relief: { source: string; amount: number }[];
}

/**
 * R-OBLIGATION-014: each relief on the item takes its share of the charge's base, never below zero.
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

/** R-CAR-001, 005: the car's monthly part stops at the final payment; at term end the final payment is the charge. */
function carCharge(item: ObligationState, entry: ObligationEntry): Charge {
  const { final } = carTerms(entry);
  if (item.monthsLeft === 0) return { base: item.outstanding, interest: 0, principal: item.outstanding, relief: [] };
  const scheduled = divCeil(Math.max(0, item.principal - final), entry.term ?? 1);
  const principal = Math.min(scheduled, Math.max(0, item.outstanding - final));
  // The ladder's rate is fixed at opening as the monthly interest, held in `amount` (see `openEffect`).
  return { base: principal, interest: item.amount, principal, relief: [] };
}

export function chargeOf(read: ReadCtx, item: ObligationState, entry: ObligationEntry): Charge {
  return relieve(item, scheduledCharge(read, item, entry));
}

/**
 * R-HOME-008: one month's charge of an upkeep or support held at `amount`, as the bill takes it before any relief.
 * R-DIRECTOR-006. "at home" is a naira charge, so money sent home from abroad rises with it too.
 * The home view and the scheduled charge both read it, so the home card and the bill agree. Content without the
 * entry (a test's small world has no room on the water) charges the amount as it stands.
 */
export function livingCharge(read: Pick<ReadCtx, "world" | "content">, obligation: Id<"obligation">, amount: number): number {
  const entry = read.content.obligation[obligation];
  const rise = entry?.currency === "NGN" ? bp(amount, worldVarOr(read.world, INFLATION)) : 0;
  // R-HOME-012 (decision 0035): at home the living is lived by hand, as meals, water, fares and data; that share is never charged.
  // Makoko's figure goes the same way (P26: the child of the water keeps equal or better odds); the room's first month is paid on the move.
  const byHand = entry?.currency === "NGN" && entry.type === "upkeep" ? bp(amount + rise, read.content.tuning.home.livingByHandBp) : 0;
  return Math.max(0, amount + rise - byHand);
}

/** The charge as scheduled, before any relief. */
function scheduledCharge(read: ReadCtx, item: ObligationState, entry: ObligationEntry): Omit<Charge, "relief"> {
  const interest = bp(item.principal, entry.rateBp);
  // Held funds are returned whole (R-OBLIGATION-008); only these types repay principal on a schedule.
  const scheduled = SCHEDULED_TYPES.includes(entry.type) && entry.term !== null ? divCeil(item.principal, entry.term) : 0;
  const principal = Math.min(scheduled, item.outstanding);
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

/** R-CAR-003: what clears a car's arrears with `obligation/pay`: every missed charge, the ones left in the term at most. */
function carArrears(item: ObligationState, entry: ObligationEntry): Charge & { months: number } {
  const months = Math.min(item.missed, item.monthsLeft ?? 0);
  const monthly = carCharge(item, entry);
  const principal = Math.min(months * monthly.principal, Math.max(0, item.outstanding - carTerms(entry).final));
  return { months, base: principal, interest: months * monthly.interest, principal, relief: [] };
}

/**
 * What the view shows as due this coming month. A defaulted loan has no charge
 * any more: the lender takes what is owed from the bank (R-OBLIGATION-005).
 * so the view shows what is still owed, the most the lender can take;
 * a car behind on its payments shows its arrears, the amount `obligation/pay`
 * takes to clear them (R-CAR-003).
 */
function dueNext(read: ReadCtx, item: ObligationState, entry: ObligationEntry): number {
  // R-UNDERTAKING-012: what is owed now, all of it asked for at once.
  if (isSponsorUndertaking(entry)) return item.outstanding;
  if (item.state === "defaulted") return COLLECTED_TYPES.includes(entry.type) ? item.outstanding : 0;
  if (entry.type === "car" && item.missed > 0 && item.monthsLeft !== 0) return totalOf(carArrears(item, entry));
  if (!dueIn(item, entry, read.state.turn.month + 1)) return 0;
  return totalOf(chargeOf(read, item, entry));
}

/**
 * True when this much could be taken from cash and bank now (R-OBLIGATION-002).
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

/** R-CREDIT-002: a payment on an entry that reports to the file moves it. */
function report(ctx: Ctx, item: ObligationState, entry: ObligationEntry, points: number): void {
  if (entry.reportsToCredit !== true) return;
  ctx.apply([{ type: "credit/mark", amount: points }], causeOf(item));
}

/** R-OBLIGATION-010: the savings held back come back when a group loan closes paid. */
function returnSavings(ctx: Ctx, item: ObligationState, entry: ObligationEntry): void {
  if (entry.type !== "group-loan" || item.state === "defaulted") return;
  if (item.amount > 0) ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: item.amount, reason: "deposit-return" }], causeOf(item));
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
 * A defaulted loan (R-OBLIGATION-005): no charge and no misses any more. The
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
 * R-LUCK-009: after a paid month, one draw in the months still to come gives
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
 * R-OBLIGATION-012: three months after standing guarantor, the relative may be
 * gone, and the undertaking's `onDefault` opens the loan on the character for
 * the balance. the page names no stream for the draw; it is `offer`,
 * the stream of the offer that opened it.
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

/** A charge paid in full (R-OBLIGATION-002): fixed and principal under the sink, interest under the interest sink. */
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
      // R-OBLIGATION-002, 009: paid off by its charges.
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

/** R-CAR-003: the car is taken. What is owed less its resale is still owed, with a judgment, when above zero. */
function repossess(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const cause = causeOf(item);
  const shortfall = Math.max(0, item.outstanding - carTerms(entry).resale);
  const events = record(ctx, { type: "obligation/repossessed", id: item.id, entry: item.entry, owed: item.outstanding, shortfall });
  report(ctx, item, entry, -ctx.content.tuning.credit.onDefault);
  ctx.apply(entry.onDefault, cause);
  if (shortfall > 0) ctx.apply([{ type: "obligation/open", obligation: carOf(entry).shortfall, principal: shortfall }, { type: "credit/judgment" }], cause);
  return events;
}

/** R-CAR-003, 005: a missed car payment. */
function missCar(ctx: Ctx, item: ObligationState, entry: ObligationEntry, charge: Charge): BaseEvent[] {
  const missed = item.missed + 1;
  const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: totalOf(charge), missed });
  ctx.apply(entry.onMiss, causeOf(item));
  if (item.monthsLeft === 0) {
    // R-CAR-005: the final payment missed, the car goes back with nothing owed.
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

/** R-CAR-003: waiting on the court, nothing is charged; each month is another miss until the car is taken. */
function courtMonth(ctx: Ctx, item: ObligationState, entry: ObligationEntry): BaseEvent[] {
  const missed = item.missed + 1;
  const charge = carCharge(item, entry);
  const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: totalOf(charge), missed });
  if (missed >= entry.grace + 1 + carTerms(entry).courtMonths) return [...events, ...repossess(ctx, item, entry)];
  report(ctx, item, entry, -ctx.content.tuning.credit.onMiss);
  return events;
}

/** R-OBLIGATION-011: what each miss in a row costs on a group loan before the default. */
function groupMissEffects(ctx: Ctx, entry: ObligationEntry, missed: number): Effect[] {
  if (missed === 1) return entry.onMiss;
  if (missed === 2) {
    const { standing, wellbeing } = ctx.content.tuning.groupLoan.visit;
    return [
      { type: "quality/add", quality: STANDING, amount: standing },
      { type: "quality/add", quality: WELLBEING, amount: wellbeing },
    ];
  }
  return [];
}

/** A charge that could not be paid (R-OBLIGATION-003, 004, 005, 007, 011, R-ABROAD-003 to 005, R-LUCK-009). */
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
  if (entry.type === "car") return missCar(ctx, item, entry, charge);
  const missed = item.missed + 1;
  if (entry.type === "ajo") {
    // R-LUCK-009: a missed month closes the circle, and no pot.
    const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: totalOf(charge), missed });
    ctx.apply(entry.onMiss, cause);
    return [...events, ...close(ctx, item, "dropped")];
  }
  if (entry.type === "group-loan" && missed === 1) {
    // R-OBLIGATION-011: the group covers the charge and adds it to what is owed.
    const events = record(ctx, { type: "obligation/covered", id: item.id, entry: item.entry, total: totalOf(charge), principal: charge.principal, missed });
    ctx.apply(entry.onMiss, cause);
    return events;
  }
  // R-OBLIGATION-002 (decision 0015): the upkeep takes what the naira holds and the shortfall is the miss, so a bill
  // short by a little never leaves the whole month's money untouched and the results saying nothing moved.
  const paid = entry.type === "upkeep" && entry.currency === "NGN" ? Math.min(totalOf(charge), ctx.state.wallet.pockets.NGN.cash + ctx.state.wallet.pockets.NGN.bank) : 0;
  if (paid > 0) take(ctx, cause, entry.currency, "any", paid, "upkeep");
  const events = record(ctx, { type: "obligation/missed", id: item.id, entry: item.entry, total: totalOf(charge), missed, ...(paid > 0 ? { paid } : {}) });
  ctx.apply(entry.type === "group-loan" ? groupMissEffects(ctx, entry, missed) : entry.onMiss, cause);
  // R-OBLIGATION-004: upkeep and support never default. R-OBLIGATION-005: the miss that passes the grace applies onMiss, then onDefault.
  const defaults = GRACE_TYPES.includes(entry.type) && missed > entry.grace;
  // R-CREDIT-002. the month that defaults takes the default figure in place of the miss figure.
  report(ctx, item, entry, -(defaults ? ctx.content.tuning.credit.onDefault : ctx.content.tuning.credit.onMiss));
  if (!defaults) return events;
  events.push(...record(ctx, { type: "obligation/defaulted", id: item.id, entry: item.entry, outstanding: item.outstanding }));
  ctx.apply(entry.onDefault, cause);
  // R-OBLIGATION-011: the named asset goes with the default.
  if (entry.seize !== undefined) ctx.apply(entry.seize, cause);
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
    if (isSponsorUndertaking(entry)) {
      events.push(...undertakingDue(ctx, item, entry));
      continue;
    }
    if (item.state === "defaulted") {
      // a withdrawn student's tuition stays on record (R-STATUS-011 reads it) and is collected no further.
      if (COLLECTED_TYPES.includes(entry.type)) events.push(...seize(ctx, item, entry));
      continue;
    }
    if (inCourt(item, entry)) {
      events.push(...courtMonth(ctx, item, entry));
      continue;
    }
    if (!dueIn(item, entry, ctx.state.turn.month)) continue;
    const charge = chargeOf(ctx, item, entry);
    const paid = canTake(ctx, entry.currency, totalOf(charge));
    events.push(...(paid ? pay(ctx, item, entry, charge) : miss(ctx, item, entry, charge)));
  }
  // R-PEOPLE-032: after the month's charges, so the couch's months are free.
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
 * R-OBLIGATION-006, 010, R-PLACE-003. an obligation opened by another
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
  // R-LUCK-009: the circle holds the pot it will pay, `amount` times `term`.
  const principal = entry.type === "ajo" ? amount * (entry.term ?? 1) : given;
  // R-CAR-001, R-CREDIT-005. an obligation keeps no rate of its own, and R-OBLIGATION-001's interest on the
  // opening principal is a fixed sum, so the ladder's rate is fixed now as the monthly interest, held in `amount`.
  if (entry.type === "car") amount = bp(principal, rateFor(ctx, entry) ?? entry.rateBp);
  const lent = !takenOver(ctx.content, cause);
  // R-OBLIGATION-010. a group loan has no fixed charge, so `amount` holds the savings held back, none when taken over.
  if (entry.type === "group-loan") amount = lent ? bp(principal, ctx.content.tuning.groupLoan.savingsBp) : 0;
  // a debt of nothing would close before it was ever owed, and a circle of nothing has no pot, so nothing opens.
  if ((OWING_TYPES.includes(entry.type) || entry.type === "ajo") && principal === 0) return [];
  // R-ROAD-006: a ransom nobody pays is added to the debt already owed to the same men.
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
  };
  const events = record(ctx, { type: "obligation/opened", item });
  if (!lent) return events;
  const credit = { source: item.entry, param: null, terms: cause.terms };
  if (entry.type === "loan") {
    ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: principal, reason: "loan", flagged: true }], credit);
  }
  if (entry.type === "held-funds") {
    ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: principal, reason: "held-funds", flagged: true, locked: true }], credit);
  }
  if (entry.type === "group-loan") {
    // R-OBLIGATION-010: the savings are held back from the credit, then the fee is paid out of it.
    const fee = bp(principal, ctx.content.tuning.groupLoan.feeBp);
    ctx.apply([{ type: "money/add", currency: entry.currency, pocket: "bank", amount: principal - amount, reason: "loan", flagged: true }], credit);
    if (fee > 0) ctx.apply([{ type: "money/take", currency: entry.currency, pocket: "bank", amount: fee, reason: "fee-agent" }], credit);
  }
  return events;
}

/**
 * R-RETURN-006 for a car closed by type: it is handed back as R-CAR-004, and
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

/** Closes every open obligation of one type: a move, a return, an eviction (R-PLACE-002, R-ABROAD-003, R-RETURN-006). */
function closeEffect(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "obligation/close") throw new Error(`obligation/close cannot carry out ${effect.type}.`);
  const events: BaseEvent[] = [];
  for (const item of openItems(ctx.state)) {
    const entry = entryOf(ctx.content, item.entry);
    if (entry.type !== effect.obligationType) continue;
    events.push(...(entry.type === "car" ? closeCar(ctx, item, entry, cause) : close(ctx, item, "closed")));
  }
  return events;
}

/**
 * R-OBLIGATION-014: a share off the next charge of the open obligation of the type that applies where
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
// Paying early: R-OBLIGATION-008, R-CAR-003, 004
// ---------------------------------------------------------------------------

function isWhole(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isSafeInteger(amount);
}

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

/** R-CAR-004: an amount of 0 hands the car back once half is paid. R-CAR-003: any other amount must clear the arrears exactly. */
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

function payCommand(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "obligation/pay") throw new Error(`obligation/pay cannot handle ${command.type}.`);
  // R-PEOPLE-044: a stand-in never spends.
  if (ctx.sender === "stand-in") return reject("not-legal", "A stand-in never spends.");
  const item = ownOf(ctx.state.obligation.items, command.obligation);
  if (item === undefined) return reject("unknown-id", `There is no open obligation ${String(command.obligation)}.`);
  const entry = entryOf(ctx.content, item.entry);
  const { amount } = command;
  switch (entry.type) {
    case "loan":
    case "group-loan":
      // R-OBLIGATION-013: a group loan can be paid ahead like any loan.
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
    // R-OBLIGATION-008 rejects anything else, the agent's debt and tuition included; neither can be paid ahead.
    case "upkeep":
    case "support":
    case "rent":
    case "phone":
    case "surcharge":
    case "undertaking":
      // R-UNDERTAKING-008: what a sponsor owes can be paid down; a guarantee cannot.
      if (isSponsorUndertaking(entry)) return payUndertaking(ctx, item, entry, amount);
      return reject("not-legal", `${entry.id} is paid month by month and cannot be paid ahead.`);
    case "tuition":
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

/** The item with its reliefs spent by the charge that just fell (R-OBLIGATION-014). */
function spent(item: ObligationState): ObligationState {
  if (item.relief === undefined) return item;
  const rest = { ...item };
  delete rest.relief;
  return rest;
}

function typeOf(content: Content, item: ObligationState): ObligationType {
  return entryOf(content, item.entry).type;
}

function evolve(slice: ObligationSlice, event: ObligationEvent, _state: State, content: Content): ObligationSlice {
  switch (event.type) {
    case "obligation/opened":
      return { ...slice, items: { ...slice.items, [event.item.id]: event.item } };
    case "obligation/charged":
      return withItem(slice, event.id, (item) => ({
        ...spent(item),
        // A paid charge ends a grace (R-OBLIGATION-003).
        state: item.state === "grace" ? "active" : item.state,
        outstanding: item.outstanding - event.principal,
        monthsLeft: item.monthsLeft === null ? null : Math.max(0, item.monthsLeft - 1),
        missed: 0,
      }));
    case "obligation/missed":
      return withItem(slice, event.id, (item) => ({
        ...spent(item),
        // Only these types have a grace to be in. Upkeep and support carry no arrears (R-OBLIGATION-004).
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
    case "obligation/defaulted":
      // A debt stays open in default; a rent or a phone starts over, or its onDefault has closed it.
      return withItem(slice, event.id, (item) =>
        DEBT_TYPES.includes(typeOf(content, item)) ? { ...item, state: "defaulted" } : { ...item, state: "active", missed: 0 },
      );
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
      // home (R-HOME-011). Abroad, a flat's default sends the character back to a room; a room has nowhere cheaper to go.
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

/** R-OBLIGATION-014: a relief is told in its activity's own words: `line.obligation.relief.cook-at-home`. */
function reliefKey(source: string): string {
  return `relief.${source.slice(source.indexOf(".") + 1)}`;
}

/** The key a miss is told with: the car's notice and the group's visit are their own (R-CAR-003, R-OBLIGATION-011). */
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
      // Said quietly: the wallet's own lines already show the money leaving. Each relief is its own line (R-OBLIGATION-014).
      return [
        ...(event.total === 0 ? [] : [line("charged", { obligation: event.entry, amount: money(event.entry, event.total) }, "plain", false)]),
        ...(event.relief ?? []).filter((relief) => relief.amount > 0).map((relief) => line(reliefKey(relief.source), { obligation: event.entry, amount: money(event.entry, relief.amount) }, "good", false)),
      ];
    case "obligation/missed":
      if (event.paid !== undefined && event.paid > 0) return [line("missed-part", { obligation: event.entry, amount: money(event.entry, event.total), paid: money(event.entry, event.paid), short: money(event.entry, event.total - event.paid) }, "bad", true)];
      return [line(missKey(entryOf(content, event.entry), event.missed), { obligation: event.entry, amount: money(event.entry, event.total) }, "bad", true)];
    case "obligation/covered":
      return [line("group-covered", { obligation: event.entry, amount: money(event.entry, event.total) }, "bad", true)];
    case "obligation/defaulted":
      return [line(defaultKey(entryOf(content, event.entry)), { obligation: event.entry, amount: money(event.entry, event.outstanding) }, "bad", true)];
    case "obligation/seized": {
      // without this line the wallet's "loan repayment" line would hide that it was taken.
      const key = isSponsorUndertaking(entryOf(content, event.entry)) ? "undertaking-seized" : "seized";
      return [line(key, { obligation: event.entry, amount: money(event.entry, event.amount) }, "bad", false)];
    }
    case "obligation/assessed":
      // R-UNDERTAKING-007: the months the sponsored partner took, never what they did with them.
      return [line("assessed", { obligation: event.entry, months: event.months, amount: money(event.entry, event.amount) }, "bad", true)];
    case "obligation/cleared":
      return [line("cleared", { obligation: event.entry }, "good", true)];
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

/** R-CAR-002: an open obligation of the type, not in default; with `obligation` set, only that entry (R-GOAL-004). */
function judgeHas(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "obligation/has") throw new Error(`obligation/has cannot judge ${requirement.type}.`);
  const met = Object.values(read.state.obligation.items).some(
    (item) =>
      item.state !== "defaulted" &&
      read.content.obligation[item.entry]?.type === requirement.obligationType &&
      (requirement.obligation === undefined || item.entry === requirement.obligation),
  );
  return { met };
}

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
    // R-OBLIGATION-011: only the group's cover adds to what is owed.
    if (item.outstanding > item.principal && entry.type !== "group-loan") {
      problems.push(`Obligation ${id} owes ${String(item.outstanding)}, more than its principal ${String(item.principal)}.`);
    }
    if (item.state === "grace" && !GRACE_TYPES.includes(entry.type)) problems.push(`Obligation ${id} is in grace, but a ${entry.type} has none.`);
    if (item.state === "defaulted" && !DEBT_TYPES.includes(entry.type)) problems.push(`Obligation ${id} is in default, but a ${entry.type} does not stay open in default.`);
    // R-OBLIGATION-014: one share per source, each a share of the charge.
    const sources = (item.relief ?? []).map((relief) => relief.source);
    if (new Set(sources).size !== sources.length) problems.push(`Obligation ${id} holds the same relief twice.`);
    if ((item.relief ?? []).some((relief) => !Number.isSafeInteger(relief.bp) || relief.bp <= 0 || relief.bp > 10000)) problems.push(`Obligation ${id} holds a relief that is not a share.`);
  }
  return problems;
}

export function obligationsView(read: ReadCtx): (ObligationState & { due: number; car: CarView | null })[] {
  // R-CAR-005: an owned car is kept with no obligation. the contract has no other place for the car, so the item stays in the state for hasCar.
  return openItems(read.state)
    .filter((item) => !isOwned(item, entryOf(read.content, item.entry)))
    .map((item) => {
      const entry = entryOf(read.content, item.entry);
      // R-UNDERTAKING-012: an undertaking's months run from the month it opened, whether or not anything was charged.
      const monthsLeft = isSponsorUndertaking(entry) ? undertakingMonthsLeft(read, item) : item.monthsLeft;
      return { ...item, monthsLeft, due: dueNext(read, item, entry), car: carView(read, item) };
    });
}

/** R-CAR-007's figures for one car; the view carries them on the item as `car`. */
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
  effects: { "obligation/open": openEffect, "obligation/close": closeEffect, "obligation/relief": reliefEffect },
  phases: { due },
  evolve,
  lines,
  requirements: { "obligation/has": judgeHas },
  invariants,
  view: (read) => ({ obligations: obligationsView(read) }),
};
