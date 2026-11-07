// What a job pays and what it needs, read from the state: docs/rules/ladders.md,
// abroad-money:salary-abroad-taxed-locally, car:open-finance-gives-the-car. Pure: the kind's phases, the
// view and the ledger report all read the same figures.
import { check, resolveAmount } from "../engine/check";
import { DOCUMENT } from "../engine/ids";
import { bp, divFloor, mulDiv } from "../engine/int";
import type { ActivityEntry, CatchBandTuning, Content, Id, MoneyParam, ReadCtx, State, Terms } from "../engine/types";

export const MONTHS_PER_YEAR = 12;
const WEEKS_PER_YEAR = 52;

/** The driving test keeps its attempts where jobs keep their months (car:licence-and-driving-test). */
export const DRIVING_TEST: Id<"activity"> = "activity.driving-test";
/** The rented courier account: `tuning.ladder.accountRent` a week comes off its pay. */
const COURIER: Id<"activity"> = "activity.job-uk-courier-cash";

/** A job: the main one or a side job (activity:side-job-holds-a-slot). */
export function isJob(entry: ActivityEntry | undefined): entry is ActivityEntry {
  return entry?.slot === "main" || entry?.slot === "side";
}

/** A job abroad's pay is written a year, a job at home's a month. */
export function paidYearly(entry: ActivityEntry): boolean {
  return entry.where === "abroad";
}

/**
 * The terms a sponsor's or agent's job is paid from (route-gates:sponsored-status-on-departure, route-gates:employer-flies-and-holds-passport):
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

/** car:open-finance-gives-the-car: the car is open and not in default. */
export function hasCar(state: State, content: Content): boolean {
  return Object.values(state.obligation.items).some((item) => item.state !== "defaulted" && content.obligation[item.entry]?.type === "car");
}

/** car:licence-and-driving-test: a home licence within its months, or the UK one. */
function licenceInForce(read: ReadCtx): boolean {
  return check(read, { type: "document/held", document: DOCUMENT.homeLicence }).met || check(read, { type: "document/held", document: DOCUMENT.ukLicence }).met;
}

/** ladders:car-bonus-needs-car and car:licence-and-driving-test: an activity that needs the car needs it, and a licence in force, now. */
export function carHolds(read: ReadCtx, entry: ActivityEntry): boolean {
  return entry.needsCar !== true || (hasCar(read.state, read.content) && licenceInForce(read));
}

/**
 * activity:side-jobs-pay-by-tier: the best-paying tier whose `needs` all hold, as a figure in the pay's
 * currency, or null when no tier is met. A tier paid in another currency than the job's is a content error.
 */
function tierFigure(read: ReadCtx, entry: ActivityEntry): number | null {
  let best: number | null = null;
  for (const tier of entry.tiers ?? []) {
    if (entry.pay !== null && tier.pay.currency !== entry.pay.currency) throw new Error(`${entry.id} has a tier paid in ${tier.pay.currency}, not ${entry.pay.currency}.`);
    if (!tier.needs.every((need) => check(read, need).met)) continue;
    const figure = resolveAmount(read, tier.pay.amount, {});
    if (best === null || figure > best) best = figure;
  }
  return best;
}

/** activity:waiting-months-build-profile: the job has had its one raise. */
export function raisedJob(state: State, job: Id<"activity">): boolean {
  return (state.activity.raised ?? []).includes(job);
}

/**
 * Own work's growth on its written takings (activity:capital-opens-own-work, activity:trader-opens-own-shop): `tuning.activity.raiseBp` a
 * full year, pro rata for the months it has stood before this one.
 */
function ownGrowth(read: ReadCtx, entry: ActivityEntry, written: number): number {
  if (entry.employer !== "own") return 0;
  const months = read.state.activity.tenure[entry.id] ?? 0;
  return mulDiv(bp(written, read.content.tuning.activity.raiseBp), months, MONTHS_PER_YEAR);
}

/**
 * The job's pay figure, a year or a month: as written, or its tier's when one is met (activity:side-jobs-pay-by-tier),
 * then the raise once it has come (activity:waiting-months-build-profile). Null when it reads a term not in hand.
 */
function payFigure(read: ReadCtx, entry: ActivityEntry, terms: Terms): number | null {
  if (entry.pay === null) return null;
  const { amount } = entry.pay;
  // A sponsor's job started without a salary recorded on the route has nothing to pay from, so it pays nothing.
  if (typeof amount === "object" && "term" in amount && typeof terms[amount.term] !== "number") return null;
  // activity:naira-pay-reviewed-yearly: the held job pays what its reviews have left it.
  const held = read.state.activity.job === entry.id ? read.state.activity.pay : undefined;
  const written = held ?? resolveAmount(read, amount, terms);
  const figure = Math.max(written, tierFigure(read, entry) ?? written) + ownGrowth(read, entry, written);
  return raisedJob(read.state, entry.id) ? figure + bp(figure, read.content.tuning.activity.raiseBp) : figure;
}

/** The bonus a year a job pays while the character has the car (ladders:car-bonus-needs-car). */
function carBonusNow(read: ReadCtx, entry: ActivityEntry): number {
  return entry.carBonus !== undefined && hasCar(read.state, read.content) ? entry.carBonus : 0;
}

/**
 * A month's pay before tax (activity:one-job-paid-monthly, abroad-money:salary-abroad-taxed-locally, ladders:car-bonus-needs-car): a job
 * abroad pays its year, bonus included, over twelve; the courier's account rent
 * comes off. Null for a job with no pay or none it can read.
 */
export function monthlyPay(read: ReadCtx, entry: ActivityEntry, terms: Terms = jobTerms(read)): MoneyParam | null {
  const figure = payFigure(read, entry, terms);
  if (entry.pay === null || figure === null) return null;
  const bonus = carBonusNow(read, entry);
  let amount = paidYearly(entry) ? divFloor(figure + bonus, MONTHS_PER_YEAR) : figure + divFloor(bonus, MONTHS_PER_YEAR);
  if (entry.id === COURIER) amount = Math.max(0, amount - mulDiv(read.content.tuning.ladder.accountRent, WEEKS_PER_YEAR, MONTHS_PER_YEAR));
  if (entry.part === true && inVacation(read)) amount = bp(amount, read.content.tuning.status.vacationPayBp);
  return { currency: entry.pay.currency, amount };
}

/**
 * status:status-sets-work-rule, ladders:student-holds-one-part-job: the month in play is a vacation of the course the status runs (the Christmas and Easter
 * months), when a `part` job pays full time. The course month is the months the status has been held plus the one in play. Read from the slices here,
 * as the status kind reads this file.
 */
function inVacation(read: ReadCtx): boolean {
  const held = read.state.status.current;
  const course = held === null ? undefined : read.content.status[held.entry]?.course;
  return held !== null && course !== undefined && course.vacations.includes(held.monthsHeld + 1);
}

/**
 * abroad-money:salary-abroad-taxed-locally: a month's tax, the country's `taxBp` on the part of the yearly
 * salary above its `taxFreeLine`, over twelve. Cash work reports none (ladders:cash-jobs-paid-in-hand);
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

/**
 * wallet:view-carries-month-pay: a job's month as the wallet will book it: `monthlyPay` less `monthlyTax`, from the route's salary for
 * a sponsored or contract job. Null for a job with no pay or none it can read. A sick month and a cash month held back
 * are not foreseen: they are drawn when the month ends.
 */
export function bookedPay(read: ReadCtx, entry: ActivityEntry, terms: Terms = jobTerms(read)): MoneyParam | null {
  const pay = monthlyPay(read, entry, terms);
  return pay === null ? null : { currency: pay.currency, amount: pay.amount - monthlyTax(read, entry, terms) };
}

/** The overtime a month's pay earns (ladders.md "Free slots abroad"). */
export function overtimePay(read: ReadCtx, entry: ActivityEntry): MoneyParam | null {
  const pay = monthlyPay(read, entry);
  return pay === null ? null : { currency: pay.currency, amount: bp(pay.amount, read.content.tuning.ladder.overtimeBp) };
}

/**
 * ladders:local-tenure-counted: months in any job of the country the character is in. At home,
 * the home jobs. Months from an earlier stay in the same country count.
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

/** ladders:cash-jobs-paid-in-hand, for the status kind: cash work done this month, which raises an overstayer's detection. */
export function cashWorkedThisMonth(read: ReadCtx): boolean {
  const { job } = read.state.activity;
  return job !== null && read.content.activity[job]?.cash === true;
}

/** activity:side-job-holds-a-slot, for the quality kind: skill gains halve while a side job is held. */
export function sideJobHeld(read: ReadCtx): boolean {
  return read.state.activity.side !== null;
}

/** Attempts made at the driving test so far (car:licence-and-driving-test). */
export function drivingAttempts(state: State): number {
  return state.activity.tenure[DRIVING_TEST] ?? 0;
}

/**
 * activity:catch-drawn-each-month: the band a draw under 10,000 lands in, read against the bands' chances in order (lean, fair,
 * good), the rains' chances while the rains run. A roll past every chance takes the last band.
 */
export function catchBandAt(bands: readonly CatchBandTuning[], rains: boolean, roll: number): CatchBandTuning {
  let reach = 0;
  for (const band of bands) {
    reach += rains ? band.rainsBp : band.chanceBp;
    if (roll < reach) return band;
  }
  const last = bands.at(-1);
  if (last === undefined) throw new Error("The catch has no bands in content.");
  return last;
}
