// What a job pays and what it needs, read from the state: docs/rules/ladders.md,
// abroad-money.md R-ABROAD-002, car.md R-CAR-002. Pure: the kind's phases, the
// view and the ledger report all read the same figures.
import { check, resolveAmount } from "../engine/check";
import { bp, divFloor, mulDiv } from "../engine/int";
import type { ActivityEntry, Content, Id, MoneyParam, ReadCtx, State, Terms } from "../engine/types";

export const MONTHS_PER_YEAR = 12;
const WEEKS_PER_YEAR = 52;

/** The driving test keeps its attempts where jobs keep their months (R-CAR-006). */
export const DRIVING_TEST: Id<"activity"> = "activity.driving-test";
/** The rented courier account: `tuning.ladder.accountRent` a week comes off its pay. */
export const COURIER: Id<"activity"> = "activity.job-uk-courier-cash";
const HOME_LICENCE: Id<"document"> = "document.home-licence";
const UK_LICENCE: Id<"document"> = "document.uk-licence";

/** A job: the main one or a side job (R-ACTIVITY-010). */
export function isJob(entry: ActivityEntry | undefined): entry is ActivityEntry {
  return entry?.slot === "main" || entry?.slot === "side";
}

/** a job abroad holds its pay a year, a job at home a month. */
export function paidYearly(entry: ActivityEntry): boolean {
  return entry.where === "abroad";
}

/**
 * The terms a sponsor's or agent's job is paid from (R-SPONSOR-007, R-CONTRACT-004):
 * the salary recorded on the route the character left on, for the country they are in.
 */
export function jobTerms(read: Pick<ReadCtx, "state" | "content">): Terms {
  const { country } = read.state.place;
  if (country === null) return {};
  for (const route of Object.values(read.content.route)) {
    const held = read.state.route[route.id];
    if (route.country !== country || held?.state !== "departed" || held.gate === null) continue;
    if (held.gate.gate === "sponsor" && held.gate.sponsor !== null) return { salary: held.gate.sponsor.salary };
    if (held.gate.gate === "contract" && held.gate.agent !== null) return { salary: held.gate.agent.salary, role: held.gate.agent.role };
  }
  return {};
}

/** R-CAR-002: the car is open and not in default. */
export function hasCar(state: State, content: Content): boolean {
  return Object.values(state.obligation.items).some((item) => item.state !== "defaulted" && content.obligation[item.entry]?.type === "car");
}

/** R-CAR-006: a home licence within its months, or the UK one. */
export function licenceInForce(read: ReadCtx): boolean {
  return check(read, { type: "document/held", document: HOME_LICENCE }).met || check(read, { type: "document/held", document: UK_LICENCE }).met;
}

/** R-LADDER-004 and R-CAR-006: an activity that needs the car needs it, and a licence in force, now. */
export function carHolds(read: ReadCtx, entry: ActivityEntry): boolean {
  return entry.needsCar !== true || (hasCar(read.state, read.content) && licenceInForce(read));
}

/** The job's pay figure as written, a year or a month. Null when it reads a term not in hand. */
function payFigure(read: ReadCtx, entry: ActivityEntry, terms: Terms): number | null {
  if (entry.pay === null) return null;
  const { amount } = entry.pay;
  // a sponsor's job started without a salary recorded on the route has nothing to pay from, so it pays nothing.
  if (typeof amount === "object" && "term" in amount && typeof terms[amount.term] !== "number") return null;
  return resolveAmount(read, amount, terms);
}

/** The bonus a year a job pays while the character has the car (R-LADDER-004). */
function carBonusNow(read: ReadCtx, entry: ActivityEntry): number {
  return entry.carBonus !== undefined && hasCar(read.state, read.content) ? entry.carBonus : 0;
}

/**
 * A month's pay before tax (R-ACTIVITY-001, R-ABROAD-002, R-LADDER-004): a job
 * abroad pays its year, bonus included, over twelve; the courier's account rent
 * comes off. Null for a job with no pay or none it can read.
 */
export function monthlyPay(read: ReadCtx, entry: ActivityEntry, terms: Terms = jobTerms(read)): MoneyParam | null {
  const figure = payFigure(read, entry, terms);
  if (entry.pay === null || figure === null) return null;
  const bonus = carBonusNow(read, entry);
  let amount = paidYearly(entry) ? divFloor(figure + bonus, MONTHS_PER_YEAR) : figure + divFloor(bonus, MONTHS_PER_YEAR);
  if (entry.id === COURIER) amount = Math.max(0, amount - mulDiv(read.content.tuning.ladder.accountRent, WEEKS_PER_YEAR, MONTHS_PER_YEAR));
  return { currency: entry.pay.currency, amount };
}

/**
 * R-ABROAD-002: a month's tax, the country's `taxBp` on the part of the yearly
 * salary above its `taxFreeLine`, over twelve. Cash work reports none (R-LADDER-003);
 * a job at home is paid after tax already.
 */
export function monthlyTax(read: ReadCtx, entry: ActivityEntry, terms: Terms = jobTerms(read)): number {
  const { country } = read.state.place;
  if (entry.cash === true || !paidYearly(entry) || country === null) return 0;
  const figure = payFigure(read, entry, terms);
  const line = read.content.country[country];
  if (figure === null || line === undefined) return 0;
  const above = Math.max(0, figure + carBonusNow(read, entry) - line.taxFreeLine);
  return divFloor(bp(above, line.taxBp), MONTHS_PER_YEAR);
}

/** The overtime a month's pay earns (ladders.md "Free slots abroad"). */
export function overtimePay(read: ReadCtx, entry: ActivityEntry): MoneyParam | null {
  const pay = monthlyPay(read, entry);
  return pay === null ? null : { currency: pay.currency, amount: bp(pay.amount, read.content.tuning.ladder.overtimeBp) };
}

/**
 * R-LADDER-002: months in any job of the country the character is in. At home,
 * the home jobs. months from an earlier stay in the same country count.
 */
export function localTenure(read: ReadCtx): number {
  const { where, country } = read.state.place;
  let months = 0;
  for (const [id, held] of Object.entries(read.state.activity.tenure)) {
    const entry = read.content.activity[id as Id<"activity">];
    if (entry?.slot !== "main") continue;
    const here = where === "abroad" ? entry.where === "abroad" && entry.country === country : where === "home" && (entry.where ?? "home") !== "abroad";
    if (here) months += held;
  }
  return months;
}

/** R-LADDER-003, for the status kind: cash work done this month, which raises an overstayer's detection. */
export function cashWorkedThisMonth(read: ReadCtx): boolean {
  const { job } = read.state.activity;
  return job !== null && read.content.activity[job]?.cash === true;
}

/** R-ACTIVITY-010, for the quality kind: skill gains halve while a side job is held. */
export function sideJobHeld(read: ReadCtx): boolean {
  return read.state.activity.side !== null;
}

/** Attempts made at the driving test so far (R-CAR-006). */
export function drivingAttempts(state: State): number {
  return state.activity.tenure[DRIVING_TEST] ?? 0;
}
