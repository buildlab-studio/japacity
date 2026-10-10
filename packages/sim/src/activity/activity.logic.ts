// Activities and jobs: docs/rules/activity.md, ladders.md and car.md. The month
// has one main activity, the job, a side job if one is held, and a few free
// slots. The slot rules read here are judged twice: once when `turn/end` is
// checked (R-ACTIVITY-002), and again when each slot resolves (R-ACTIVITY-003),
// because an earlier slot can change the state.
import { check, resolveAmount } from "../engine/check";
import { bp, valueInKobo } from "../engine/int";
import { cardOf, cardsAllowed, reportLines } from "../chapter/chapter.card";
import type { RegisteredKind } from "../engine/kind";
import { emit, turnInProgress, turnSlots } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  ActivityEntry,
  ActivityOption,
  ActivitySlice,
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Currency,
  Effect,
  Id,
  MoneyParam,
  PlayerView,
  ReadCtx,
  Reason,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  SchoolApplication,
  SetpieceQuestion,
  SlotPick,
  State,
  Tuning,
} from "../engine/types";
import { appliesHere } from "../place/place.logic";
import { isKept, statusEntry, workAllows } from "../status/status.logic";
import { activeLocks, fillsSlot, freeSlots } from "../turn/turn.logic";
import type { ActivityEvent, Prize, SlotFailure } from "./activity.events";
import { ADVISER, adviserReading, FRIEND, friendWord } from "./activity.advice";
import {
  carHolds,
  DRIVING_TEST,
  drivingAttempts,
  isJob,
  jobTerms,
  localTenure,
  monthlyPay,
  monthlyTax,
  overtimePay,
  raisedJob,
} from "./activity.pay";
import { officialRates } from "../wallet/wallet.rates";
import type { Judge } from "../japacity/japacity.logic";

export { cashWorkedThisMonth, localTenure, sideJobHeld } from "./activity.pay";

const NETWORK: Id<"quality"> = "quality.network";
const TECH: Id<"quality"> = "quality.tech";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const GRADE: Id<"quality"> = "quality.edu-grade";
const DRIVING: Id<"quality"> = "quality.driving";
const HOME_LICENCE: Id<"document"> = "document.home-licence";
const UK_LICENCE: Id<"document"> = "document.uk-licence";
/** The offer a landed hunt opens. It learns the job from the terms (R-OFFER-007). */
const JOB_OFFER = "offer.job" as const;
/** R-GUIDE-014: the months in which a life's first hunt is sure, counted as the month being played. */
const SURE_HUNT_MONTHS = 3;
/** A side gig pays naira cash (R-ACTIVITY-008). */
const GIG_CURRENCY: Currency = "NGN";
/** The source named on the rest an empty slot gives. */
export const REST_SOURCE = "rest";

// The activities whose figures are tuning rather than entry fields: the kind runs them by id.
const OVERTIME: Id<"activity"> = "activity.overtime";
const LOTTO: Id<"activity"> = "activity.play-lotto";
const BET: Id<"activity"> = "activity.bet-slip";
/** R-STREET-001: the phone is paid from cash, at the tuning's price. */
const PHONE: Id<"activity"> = "activity.buy-phone";
/** R-ACTIVITY-013: being noticed at work, a raise on a draw. */
const NOTICED: Id<"activity"> = "activity.be-noticed";
/** R-ACTIVITY-013: open source tells its month even when no piece comes of it. */
const OPEN_SOURCE: Id<"activity"> = "activity.open-source";
const PORTFOLIO: Id<"quality"> = "quality.portfolio";
/** R-ACTIVITY-011: a slot of either keeps the bus home safe that month. */
const COUNTER_MOVES: readonly Id<"activity">[] = ["activity.safe-ride", "activity.sleep-at-office"];
/** R-ACTIVITY-015: the now-acts whose draw lands with the month: the kiosk's draw and the match. */
const DRAWN_LATER: readonly Id<"activity">[] = [LOTTO, BET];
/** R-ACTIVITY-015: the effects of a now-act that land with the month: the employer's answer to a hunt. */
const LATER_EFFECTS: readonly Effect["type"][] = ["activity/hunt"];

/** The lock reasons this kind reads and writes (R-TURN-009, R-HEALTH-004). */
export const SIDE_JOB_LOCK = "side-job";
export const ILLNESS_LOCK = "illness";
const UNLOCKED_LINE = "line.turn.unlocked";
/** The staged line of the first pay abroad (R-LUCK-008), which the first-pay card reads (R-SHARE-001). */
const FIRST_PAY_ABROAD = "line.activity.salary-first-abroad";

/** The kiosk draws each ticket out of a million (R-LUCK-005). */
export const PER_MILLION = 1000000;
const BP_IN_MILLION = 100;


/** Applies this kind's events at once, so the rest of the handler sees them. */
function record(ctx: Ctx, ...events: ActivityEvent[]): BaseEvent[] {
  return emit(ctx, "activity", events);
}

const readOf = (ctx: Ctx): ReadCtx => ({ state: ctx.state, world: ctx.world, content: ctx.content });
const judgeOf = (ctx: Ctx): Judge => (requirement) => ctx.check(requirement);

function allHold(requirements: readonly Requirement[], judge: Judge): boolean {
  return requirements.every((requirement) => judge(requirement).met);
}

/** R-ACTIVITY-015: an entry that answers now, sent as `activity/now`; every other entry fills the month. */
export function answersNow(entry: Pick<ActivityEntry, "when">): boolean {
  return entry.when === "now";
}

/** R-ACTIVITY-015: the now-acts sent in the month in hand, in order. */
export function nowThisMonth(state: State): SlotPick[] {
  return state.activity.now ?? [];
}

/** R-ACTIVITY-015: a now-act that is not a purchase, already done this month, so shut until the next. */
export function doneThisMonth(state: State, entry: Pick<ActivityEntry, "id" | "purchase">): boolean {
  return entry.purchase !== true && nowThisMonth(state).some((pick) => pick.activity === entry.id);
}

// ---------------------------------------------------------------------------
// The kiosk's numbers: R-LUCK-005 and 006
// ---------------------------------------------------------------------------

/**
 * Each ticket's chances out of a million: the small and mid prizes are basis
 * points, the jackpot `jackpotPerMillion`, since one in 100,000 is under one basis point.
 */
export function prizeOdds(luck: Tuning["luck"]): { prize: Prize; perMillion: number; amount: number }[] {
  return [
    { prize: "jackpot", perMillion: luck.jackpotPerMillion, amount: luck.prizeJackpot },
    { prize: "mid", perMillion: luck.prizeMidBp * BP_IN_MILLION, amount: luck.prizeMid },
    { prize: "small", perMillion: luck.prizeSmallBp * BP_IN_MILLION, amount: luck.prizeSmall },
  ];
}

/** The prize one draw out of a million wins, if any. */
function prizeFor(draw: number, luck: Tuning["luck"]): { prize: Prize; amount: number } | null {
  let below = 0;
  for (const odds of prizeOdds(luck)) {
    below += odds.perMillion;
    if (draw < below) return { prize: odds.prize, amount: odds.amount };
  }
  return null;
}

/** The ticket counts the kiosk sells (R-LUCK-005, R-ENGINE-016): 1 up to the cap. */
export function ticketParams(luck: Tuning["luck"]): string[] {
  return Array.from({ length: luck.maxTickets }, (_unused, index) => String(index + 1));
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

/**
 * The English band the character holds: the best value among held documents
 * whose result is a band. Null when none is held. Read from the state, since a
 * band is a value and no requirement type returns one.
 */
export function heldBand(read: ReadCtx): number | null {
  let best: number | null = null;
  for (const [id, held] of Object.entries(read.state.document)) {
    if (read.content.document[id as Id<"document">]?.result !== "english-band") continue;
    if (held.state !== "held" || held.value === null) continue;
    best = best === null ? held.value : Math.max(best, held.value);
  }
  return best;
}

/**
 * Jobs that may be hunted (R-ACTIVITY-005, R-LADDER-001, R-ACTIVITY-010): main and
 * side jobs of this place whose requirements hold, that the status lets the
 * character work, and that are not held already. A job with no hiring chance is
 * never hunted: it is started by a departure or a starting life.
 */
function huntableJobs(read: ReadCtx, judge: Judge): string[] {
  const { job, side } = read.state.activity;
  return Object.values(read.content.activity)
    .filter(
      (entry) =>
        isJob(entry) &&
        entry.hireBp !== null &&
        entry.id !== job &&
        entry.id !== side &&
        appliesHere(entry, read.state) &&
        workAllows(read, entry) &&
        carHolds(read, entry) &&
        allHold(entry.requires, judge),
    )
    .map((entry) => entry.id);
}

/** Routes that may be looked into: heard of and not yet known (R-ROUTE-004). */
function heardRoutes(read: ReadCtx): string[] {
  return Object.keys(read.content.route).filter((id) => read.state.route[id as Id<"route">]?.state === "heard");
}

/** Routes known, for the activities that work a route already looked into (the sponsor's find, R-SPONSOR-001). */
function knownRoutes(read: ReadCtx): string[] {
  return Object.keys(read.content.route).filter((id) => read.state.route[id as Id<"route">]?.state === "known");
}

/**
 * The month from which a school that refused takes a new application
 * (R-ROUTE-006): its answer's month plus `reapplyMonths`. Null when there is
 * no refusal there.
 */
export function reapplyFrom(application: SchoolApplication | undefined, numbers: Tuning["route"]): number | null {
  return application?.state === "rejected" ? application.readyMonth + numbers.reapplyMonths : null;
}

/**
 * Whether a school takes an application now (R-ROUTE-006): none there yet, or
 * a refusal whose wait has run. The route kind judges the same.
 */
export function takesApplication(application: SchoolApplication | undefined, month: number, numbers: Tuning["route"]): boolean {
  if (application === undefined) return true;
  const from = reapplyFrom(application, numbers);
  return from !== null && month >= from;
}

/** The schools on known routes whose grade and band minimums the character meets, each with its application. */
function reachableSchools(read: ReadCtx): { id: Id<"school">; application: SchoolApplication | undefined }[] {
  const band = heldBand(read);
  if (band === null) return [];
  const grade = read.state.quality[GRADE] ?? 0;
  const schools: { id: Id<"school">; application: SchoolApplication | undefined }[] = [];
  for (const route of Object.values(read.content.route)) {
    const held = read.state.route[route.id];
    if (held?.state !== "known") continue;
    for (const id of route.schools) {
      const school = read.content.school[id];
      if (school !== undefined && grade >= school.minGrade && band >= school.minBand) schools.push({ id, application: held.schools[id] });
    }
  }
  return schools;
}

/**
 * Schools that may be applied to (R-ROUTE-006): on a known route, the grade
 * and the band held meet the school's minimums, and there is no application
 * or offer there already, unless it refused and its wait has run.
 */
function openSchools(read: ReadCtx): string[] {
  const { month } = read.state.turn;
  return reachableSchools(read)
    .filter(({ application }) => takesApplication(application, month, read.content.tuning.route))
    .map(({ id }) => id);
}

/**
 * While no school may be applied to but one that refused will take a new
 * application, the view names the month it can (R-ROUTE-006).
 */
function schoolWait(read: ReadCtx): Requirement[] {
  const months = reachableSchools(read)
    .map(({ application }) => reapplyFrom(application, read.content.tuning.route))
    .filter((from): from is number => from !== null && from > read.state.turn.month);
  return months.length === 0 ? [] : [{ type: "month/min", value: Math.min(...months) }];
}

/**
 * The params a free activity may take now (R-ACTIVITY-002). Null when it
 * takes none. Pure: the turn check, each slot as it resolves, the view and
 * the route kind all read the same list. Pass a judge to run inside a step.
 * the contract's `param` has no `tickets`, so the kiosk's ticket counts are read by its id.
 */
export function paramsFor(read: ReadCtx, entry: ActivityEntry, judge: Judge = (requirement) => check(read, requirement)): string[] | null {
  if (entry.id === LOTTO) return ticketParams(read.content.tuning.luck);
  switch (entry.param) {
    case null:
      return null;
    case "job":
      return huntableJobs(read, judge);
    case "route":
      return heardRoutes(read);
    case "known-route":
      return knownRoutes(read);
    case "school":
      return openSchools(read);
    default: {
      const never: never = entry.param;
      throw new Error(`Unknown param kind ${String(never)}.`);
    }
  }
}

function paramAllowed(read: ReadCtx, entry: ActivityEntry, param: string | null, judge: Judge): boolean {
  const allowed = paramsFor(read, entry, judge);
  return allowed === null ? param === null : param !== null && allowed.includes(param);
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

/** A price as the kind pays it. `cash` is paid from the cash pocket only (R-LUCK-005, 006). */
interface Price {
  currency: Currency;
  amount: number;
  reason: Reason;
  cash: boolean;
}

/**
 * True when every cost could be paid now. Costs in one currency are judged
 * together, so two fees that can each be met alone but not both do not pass.
 */
export function canPayAll(
  costs: readonly { currency: Currency; amount: number }[],
  judge: (requirement: { type: "money/can-pay"; currency: Currency; amount: number }) => { met: boolean },
): boolean {
  const totals = new Map<Currency, number>();
  for (const cost of costs) totals.set(cost.currency, (totals.get(cost.currency) ?? 0) + cost.amount);
  return [...totals].every(([currency, amount]) => judge({ type: "money/can-pay", currency, amount }).met);
}

/**
 * Every price is judged as `canPayAll` does: a naira price from cash and bank together, cash first
 * (decision 0012: a street price is cash first, never cash alone; only the street takes cash by itself).
 */
function canPayPrices(prices: readonly Price[], judge: Judge): boolean {
  return canPayAll(prices, judge);
}

/** The ticket count a lotto pick names, or 1 when the pick names none the kiosk sells. */
function ticketsOf(param: string | null, luck: Tuning["luck"]): number {
  return param !== null && ticketParams(luck).includes(param) ? Number(param) : 1;
}

/**
 * What an activity costs now: its entry's costs, and the ones the kind sets for
 * the activities it runs by id. the lessons are paid under `study` and
 * each attempt under `fee-test`, in the currency of the country the test is in.
 */
function pricesOf(read: ReadCtx, entry: ActivityEntry, param: string | null): Price[] {
  const prices: Price[] = entry.cost.map((cost) => ({ currency: cost.currency, amount: resolveAmount(read, cost.amount), reason: cost.reason, cash: false }));
  const { luck, car } = read.content.tuning;
  if (entry.id === LOTTO) prices.push({ currency: "NGN", amount: luck.ticket * ticketsOf(param, luck), reason: "social", cash: true });
  if (entry.id === BET) prices.push({ currency: "NGN", amount: luck.stake, reason: "social", cash: true });
  if (entry.id === PHONE) prices.push({ currency: "NGN", amount: read.content.tuning.street.phonePrice, reason: "phone", cash: true });
  // R-ADVICE-004: the adviser's fee under its own reason (decision 0011).
  // The licensed adviser is paid by transfer like any office; the street prices above are cash first.
  if (entry.id === ADVISER) prices.push({ currency: "NGN", amount: read.content.tuning.advice.adviserFee, reason: "fee-advice", cash: false });
  if (entry.id === DRIVING_TEST) {
    const currency = entry.country === undefined || entry.country === null ? null : read.content.country[entry.country]?.currency;
    if (currency === undefined || currency === null) throw new Error(`${entry.id} names no country to pay in.`);
    if (drivingAttempts(read.state) === 0) prices.push({ currency, amount: car.lessons, reason: "study", cash: false });
    prices.push({ currency, amount: car.testFee, reason: "fee-test", cash: false });
  }
  return prices;
}

/** Pays each cost under its own reason: naira by transfer, bank first, or cash first for a street price (decision 0012 as amended); a foreign fee by R-WALLET-009 (R-ACTIVITY-004). */
function payPrices(ctx: Ctx, prices: readonly Price[], cause: Cause): void {
  for (const price of prices) {
    if (price.amount <= 0) continue;
    const { currency, amount, reason } = price;
    if (currency === "NGN") ctx.apply([{ type: "money/take", currency, pocket: price.cash ? "any" : "transfer", amount, reason }], cause);
    else ctx.apply([{ type: "money/pay-fee", currency, amount, reason }], cause);
  }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** The chance one month of hunting lands a job (R-ACTIVITY-005). */
export function hireChanceBp(entry: ActivityEntry, network: number, tuning: Tuning["quality"]): number {
  return Math.min(tuning.hireMaxBp, (entry.hireBp ?? 0) + tuning.networkHireBp * network);
}

/** director.md: the remote-hiring boom adds its bonus to the remote job's hire chance, under the same cap. */
const REMOTE_JOB: Id<"activity"> = "activity.job-remote-dev";
const REMOTE_BONUS: Id<"var"> = "var.remote-hire-bonus";

/** R-ACTIVITY-005: a hunt's chance now, the world's bonus for the remote job included. */
export function huntChanceBp(read: ReadCtx, entry: ActivityEntry): number {
  const tuning = read.content.tuning.quality;
  const network = read.state.quality[NETWORK] ?? 0;
  const bonus = entry.id === REMOTE_JOB ? ((read.world.vars as Record<string, number | undefined>)[REMOTE_BONUS] ?? 0) : 0;
  return Math.min(tuning.hireMaxBp, hireChanceBp(entry, network, tuning) + bonus);
}

function jobEntry(content: Content, id: string): ActivityEntry {
  const entry = content.activity[id as Id<"activity">];
  if (!isJob(entry)) throw new Error(`${id} is not a job in content.`);
  return entry;
}

/**
 * R-HEALTH-004 reads the lock's reason. A lock for this turn either still holds
 * or was dropped by this turn's `spend`, which the turn kind reports in a line.
 * the turn in progress carries no locks, so the dropped ones are read
 * from that line.
 */
function lockedThisTurn(ctx: Ctx, why: string): boolean {
  if (activeLocks(ctx.state.turn.locks, ctx.state.turn.month).some((lock) => lock.why === why)) return true;
  const lines = turnInProgress(ctx)?.lines() ?? [];
  return lines.some((line) => line.key === UNLOCKED_LINE && typeof line.params.why === "string" && line.params.why.split(", ").includes(why));
}

/** The country's one-employer status that a sponsor's certificate grants (R-LADDER-005). */
function sponsoredStatusOf(content: Content, country: Id<"country">): Id<"status"> | null {
  const found = Object.values(content.status).find((entry) => entry.country === country && entry.work === "one-employer" && entry.clockMonths !== null);
  return found?.id ?? null;
}

/**
 * Leaving a job (R-ACTIVITY-006). R-STATUS-003: on a one-employer status, losing
 * a job of the country starts the clock. A home job left behind on moving is not that.
 */
function endJob(ctx: Ctx, why: string): BaseEvent[] {
  const job = ctx.state.activity.job;
  if (job === null) return [];
  const entry = jobEntry(ctx.content, job);
  const events = record(ctx, { type: "activity/job-ended", job, why });
  const current = ctx.state.status.current;
  if (current !== null && statusEntry(ctx.content, current.entry).work === "one-employer" && appliesHere(entry, ctx.state)) {
    ctx.apply([{ type: "status/clock-start" }], { source: job, param: null, terms: {} });
  }
  return events;
}

function endSide(ctx: Ctx, why: string): BaseEvent[] {
  const side = ctx.state.activity.side;
  return side === null ? [] : record(ctx, { type: "activity/side-ended", side, why });
}

/** R-ACTIVITY-010: one slot locked for the month in hand, renewed each month the side job is kept. */
function lockForSide(ctx: Ctx, side: Id<"activity">): void {
  ctx.apply([{ type: "turn/lock", slots: 1, months: 1, why: SIDE_JOB_LOCK }], { source: side, param: null, terms: {} });
}

/**
 * Takes a job at once (R-ACTIVITY-006), or a side job beside it (R-ACTIVITY-010).
 * Its requirements are not judged again: they were judged when it was hunted
 * (R-ACTIVITY-005, 007). The status's work rule is (R-STATUS-002): a job it does
 * not allow does not start. A sponsor's job carries its own certificate and
 * grants the country's one-employer status for it (R-LADDER-005), unless the
 * status held is a settled or citizen one.
 */
function startJob(ctx: Ctx, entry: ActivityEntry): BaseEvent[] {
  if (!workAllows(readOf(ctx), entry)) return [];
  if (entry.slot === "side") {
    const previous = ctx.state.activity.side;
    if (previous === entry.id) return [];
    const events = record(ctx, { type: "activity/side-started", side: entry.id, previous });
    lockForSide(ctx, entry.id);
    return events;
  }
  const previous = ctx.state.activity.job;
  if (previous === entry.id) return [];
  const events = record(ctx, { type: "activity/job-started", job: entry.id, previous });
  const { place, status } = ctx.state;
  const kept = status.current !== null && isKept(ctx.content, status.current.entry);
  if (entry.sponsor === true && place.where === "abroad" && place.country !== null && !kept) {
    const sponsored = sponsoredStatusOf(ctx.content, place.country);
    // The status granted on arrival already names this job (R-SPONSOR-007).
    const named = status.current?.entry === sponsored && status.current.job === entry.id;
    if (sponsored !== null && !named) ctx.apply([{ type: "status/grant", status: sponsored, job: entry.id }], { source: entry.id, param: null, terms: {} });
  }
  return events;
}

function startJobEffect(ctx: Ctx, effect: { job: Id<"activity"> | { term: string } }, cause: Cause): BaseEvent[] {
  const named = typeof effect.job === "string" ? effect.job : cause.terms[effect.job.term];
  if (typeof named !== "string") throw new Error(`The job to start is not named: ${JSON.stringify(effect.job)}.`);
  return startJob(ctx, jobEntry(ctx.content, named));
}

// ---------------------------------------------------------------------------
// The main phase
// ---------------------------------------------------------------------------

/**
 * R-CAR-006: a driver holds the home licence from arrival. it is granted
 * in the first month abroad, so its 12 months run from that month.
 */
function licenceOnArrival(ctx: Ctx): void {
  const { place, turn, quality } = ctx.state;
  if (place.where !== "abroad" || place.movedMonth !== turn.month - 1 || (quality[DRIVING] ?? 0) < 1) return;
  if (ctx.content.document[HOME_LICENCE] === undefined) return;
  ctx.apply([{ type: "document/grant", document: HOME_LICENCE }], { source: DRIVING, param: null, terms: {} });
}

/** R-LADDER-005: the job a one-employer status names is the job held, until it is lost and the clock runs. */
function followStatus(ctx: Ctx): BaseEvent[] {
  const current = ctx.state.status.current;
  if (current === null || current.job === null || current.clock !== null) return [];
  if (statusEntry(ctx.content, current.entry).work !== "one-employer" || ctx.state.activity.job === current.job) return [];
  const entry = jobEntry(ctx.content, current.job);
  return record(ctx, { type: "activity/job-started", job: entry.id, previous: ctx.state.activity.job });
}

/**
 * R-PLACE-003 and R-STATUS-002 for the jobs held: a job of another place ends,
 * unless it is the job the status names, and so does one the status does not let
 * the character work. they end before the month is paid.
 */
function dropUnfit(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  const read = readOf(ctx);
  const { job, side } = ctx.state.activity;
  if (job !== null) {
    const entry = jobEntry(ctx.content, job);
    const named = ctx.state.status.current?.job === job;
    if (!named && !appliesHere(entry, ctx.state)) events.push(...endJob(ctx, "moved"));
    else if (!named && !workAllows(read, entry)) events.push(...endJob(ctx, "status"));
  }
  if (side !== null) {
    const entry = jobEntry(ctx.content, side);
    if (!appliesHere(entry, ctx.state)) events.push(...endSide(ctx, "moved"));
    else if (!workAllows(read, entry)) events.push(...endSide(ctx, "status"));
  }
  return events;
}

/** Cash work is paid to the cash pocket under its own reason; everything else to the bank as salary. */
function payEffect(entry: ActivityEntry, pay: MoneyParam): Effect {
  return entry.cash === true
    ? { type: "money/add", currency: pay.currency, pocket: "cash", amount: pay.amount, reason: "cash-work" }
    : { type: "money/add", currency: pay.currency, pocket: "bank", amount: pay.amount, reason: "salary" };
}

/**
 * The job's month (R-ACTIVITY-001, R-ABROAD-002, R-LADDER-003, R-HEALTH-004): pay,
 * less tax, a month more in the job, then its effects. A cash job may not pay at
 * all (stream `status`); a sick month pays `sickPayBp` of it without sick leave.
 */
function workJob(ctx: Ctx): BaseEvent[] {
  const job = ctx.state.activity.job;
  if (job === null) return [];
  const entry = jobEntry(ctx.content, job);
  const read = readOf(ctx);
  const terms = jobTerms(read);
  const cause: Cause = { source: job, param: null, terms };
  const tenure = (ctx.state.activity.tenure[job] ?? 0) + 1;
  const full = monthlyPay(read, entry, terms);
  const events: BaseEvent[] = [];
  // Always drawn for cash work, so the stream's position does not hang on the chance's size.
  const withheld = entry.cash === true && ctx.random.chance("status", entry.withheldBp ?? 0);
  if (full === null || withheld) {
    if (full !== null) events.push(...record(ctx, { type: "activity/pay-withheld", job, pay: full }));
    events.push(...record(ctx, { type: "activity/month-worked", job, tenure, pay: null }));
    ctx.apply(entry.effects, cause);
    return events;
  }
  const sick = entry.sickLeave !== true && lockedThisTurn(ctx, ILLNESS_LOCK);
  const share = (amount: number): number => (sick ? bp(amount, ctx.content.tuning.health.sickPayBp) : amount);
  const pay: MoneyParam = { currency: full.currency, amount: share(full.amount) };
  const tax = share(monthlyTax(read, entry, terms));
  ctx.apply([payEffect(entry, pay)], cause);
  if (tax > 0) ctx.apply([{ type: "money/take", currency: pay.currency, pocket: "bank", amount: tax, reason: "tax" }], cause);
  if (sick) events.push(...record(ctx, { type: "activity/sick-pay", job, pay }));
  const worked: ActivityEvent =
    pay.currency === "NGN"
      ? { type: "activity/month-worked", job, tenure, pay }
      : { type: "activity/month-worked", job, tenure, pay, naira: valueInKobo(pay.amount, pay.currency, officialRates(read.world)) };
  events.push(...record(ctx, worked));
  ctx.apply(entry.effects, cause);
  return events;
}

/**
 * R-ACTIVITY-011: at home with a side job, the bus home may be a robbery, unless
 * a slot this month is a counter-move. the slots sent for the month are read.
 */
function oneChance(ctx: Ctx, side: Id<"activity">): BaseEvent[] {
  if (ctx.state.place.where !== "home") return [];
  // R-ACTIVITY-015: the safe ride is bought now, for the month.
  if ([...turnSlots(ctx), ...nowThisMonth(ctx.state)].some((pick) => COUNTER_MOVES.includes(pick.activity))) return [];
  const { oneChanceBp, phone } = ctx.content.tuning.ladder;
  if (!ctx.random.chance("street", oneChanceBp)) return [];
  const pocket = ctx.state.wallet.pockets.NGN;
  const lost = pocket.bank >= phone ? phone : 0;
  const events = record(ctx, { type: "activity/robbed", cash: pocket.cash, phone: lost });
  const cause: Cause = { source: side, param: null, terms: {} };
  ctx.apply(
    [
      { type: "money/take", currency: "NGN", pocket: "cash", amount: pocket.cash, reason: "mishap" },
      { type: "money/take", currency: "NGN", pocket: "bank", amount: lost, reason: "mishap" },
    ],
    cause,
  );
  if (ctx.content.quality[WELLBEING] !== undefined) ctx.apply([{ type: "quality/add", quality: WELLBEING, amount: ctx.content.tuning.ladder.robberyWellbeing }], cause);
  return events;
}

/**
 * The side job's month (R-ACTIVITY-010): its pay, its toll, the slot locked for
 * the month to come, and at home the one chance. the contract's pay
 * names no pocket, so naira goes to cash as `gig` and a foreign currency to the
 * bank as `salary`.
 */
function workSide(ctx: Ctx): BaseEvent[] {
  const side = ctx.state.activity.side;
  if (side === null) return [];
  const entry = jobEntry(ctx.content, side);
  const cause: Cause = { source: side, param: null, terms: {} };
  const full = monthlyPay(readOf(ctx), entry, {});
  const sick = entry.sickLeave !== true && lockedThisTurn(ctx, ILLNESS_LOCK);
  const pay = full === null ? null : { currency: full.currency, amount: sick ? bp(full.amount, ctx.content.tuning.health.sickPayBp) : full.amount };
  if (pay !== null) {
    const effect: Effect =
      pay.currency === "NGN"
        ? { type: "money/add", currency: pay.currency, pocket: "cash", amount: pay.amount, reason: "gig" }
        : { type: "money/add", currency: pay.currency, pocket: "bank", amount: pay.amount, reason: "salary" };
    ctx.apply([effect], cause);
  }
  const events = record(ctx, { type: "activity/side-worked", side, pay });
  ctx.apply(entry.effects, cause);
  lockForSide(ctx, side);
  events.push(...oneChance(ctx, side));
  return events;
}

function main(ctx: Ctx): BaseEvent[] {
  licenceOnArrival(ctx);
  return [...followStatus(ctx), ...dropUnfit(ctx), ...workJob(ctx), ...workSide(ctx)];
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/** R-PLACE-003, R-LADDER-001 and R-LADDER-004: the place, the car and the requirements. */
function requirementsHold(read: ReadCtx, entry: ActivityEntry, judge: Judge): boolean {
  return appliesHere(entry, read.state) && carHolds(read, entry) && allHold(entry.requires, judge);
}

/**
 * R-ACTIVITY-013: an act sat as a set piece (the talk, the exam) needs the stage to itself. with a
 * set piece already open from an earlier slot this month, it fails before it is paid, since its set piece
 * could not open and what it gives would come without it.
 */
function opensSetpieceWhileOpen(ctx: Ctx, entry: ActivityEntry): boolean {
  return ctx.state.setpiece.open !== null && entry.effects.some((effect) => effect.type === "setpiece/open");
}

/** Why a pick may not be played now, or null when it may. Requirements first, then the param, then the cost. */
function slotProblem(ctx: Ctx, entry: ActivityEntry, pick: SlotPick, withCost: boolean): SlotFailure | null {
  const judge = judgeOf(ctx);
  const read = readOf(ctx);
  if (!requirementsHold(read, entry, judge)) return "requirements";
  if (opensSetpieceWhileOpen(ctx, entry)) return "requirements";
  if (!paramAllowed(read, entry, pick.param, judge)) return "param";
  if (withCost && !canPayPrices(pricesOf(read, entry, pick.param), judge)) return "cost";
  return null;
}

function isPick(value: unknown): value is SlotPick {
  if (typeof value !== "object" || value === null) return false;
  const { activity, param } = value as Record<string, unknown>;
  return typeof activity === "string" && (param === null || typeof param === "string");
}

/** Checks every slot of `turn/end` before anything happens (R-ACTIVITY-002). Never returns events. */
function validateSlots(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "turn/end") throw new Error(`The activity kind cannot validate ${command.type}.`);
  const slots: unknown[] = Array.isArray(command.slots) ? command.slots : [];
  for (const [index, pick] of slots.entries()) {
    const where = `Slot ${String(index + 1)}`;
    if (!isPick(pick)) return reject("not-legal", `${where} is not an activity and a param.`);
    const entry = ctx.content.activity[pick.activity];
    if (entry?.slot !== "free" && entry?.slot !== "none") return reject("not-legal", `${where}: ${pick.activity} is not a free-slot activity.`);
    // R-ACTIVITY-015: a now-act fills no slot; it is sent at once as `activity/now`.
    if (answersNow(entry)) return reject("not-legal", `${where}: ${entry.id} answers now. It is sent as activity/now and fills no slot.`);
    // Cost is not checked here: a slot that cannot be paid fails when it resolves (R-ACTIVITY-003).
    const problem = slotProblem(ctx, entry, pick, false);
    if (problem === "requirements") return reject("not-legal", `${where}: ${entry.id} cannot be done here and now.`);
    if (problem === "param") return reject("not-legal", `${where}: ${String(pick.param)} is not a param ${entry.id} may take now.`);
  }
  return [];
}

/** Overtime: a quarter more of the month's pay, to cash for cash work and the bank otherwise. untaxed. */
function overtime(ctx: Ctx, cause: Cause): BaseEvent[] {
  const job = ctx.state.activity.job;
  if (job === null) return [];
  const entry = jobEntry(ctx.content, job);
  const pay = overtimePay(readOf(ctx), entry);
  if (pay === null || pay.amount === 0) return [];
  ctx.apply([payEffect(entry, pay)], cause);
  return record(ctx, { type: "activity/overtime-paid", job, pay });
}

/** R-CAR-006: 5500 plus 500 for each earlier attempt, capped, on stream `status`. A pass grants the UK licence. */
export function passChanceBp(attempts: number, car: Tuning["car"]): number {
  return Math.min(car.passCapBp, car.passBp + car.passPerAttemptBp * attempts);
}

function drivingTest(ctx: Ctx, cause: Cause): BaseEvent[] {
  const earlier = drivingAttempts(ctx.state);
  const passed = ctx.random.chance("status", passChanceBp(earlier, ctx.content.tuning.car));
  const events = record(ctx, { type: "activity/driving-test", attempt: earlier + 1, passed });
  if (passed) ctx.apply([{ type: "document/grant", document: UK_LICENCE }], cause);
  return events;
}

/** R-LUCK-005: each ticket drawn on stream `lotto`; winnings to the bank as `win`, never flagged. */
function lotto(ctx: Ctx, pick: SlotPick, cause: Cause): BaseEvent[] {
  const { luck } = ctx.content.tuning;
  const tickets = ticketsOf(pick.param, luck);
  const prizes: Prize[] = [];
  let won = 0;
  for (let ticket = 0; ticket < tickets; ticket += 1) {
    const hit = prizeFor(ctx.random.int("lotto", PER_MILLION), luck);
    if (hit === null) continue;
    prizes.push(hit.prize);
    won += hit.amount;
  }
  const stake: MoneyParam = { currency: "NGN", amount: luck.ticket * tickets };
  const events = record(ctx, { type: "activity/lotto-played", tickets, stake, prizes, won: { currency: "NGN", amount: won } });
  if (won > 0) ctx.apply([{ type: "money/add", currency: "NGN", pocket: "bank", amount: won, reason: "win" }], cause);
  return events;
}

/** R-LUCK-006: the stake on stream `lotto`; a win pays `betOddsBp` of it to cash. */
function betSlip(ctx: Ctx, cause: Cause): BaseEvent[] {
  const { stake, betWinBp, betOddsBp, betWellbeing } = ctx.content.tuning.luck;
  const win = ctx.random.chance("lotto", betWinBp);
  const won = win ? bp(stake, betOddsBp) : 0;
  const events = record(ctx, { type: "activity/bet-placed", stake: { currency: "NGN", amount: stake }, won: { currency: "NGN", amount: won } });
  if (won > 0) ctx.apply([{ type: "money/add", currency: "NGN", pocket: "cash", amount: won, reason: "win" }], cause);
  if (ctx.content.quality[WELLBEING] !== undefined) ctx.apply([{ type: "quality/add", quality: WELLBEING, amount: win ? betWellbeing : -betWellbeing }], cause);
  return events;
}

/** R-ADVICE-003: someone who went tells the checklist as it stood when they left. Their look-into is the entry's effect. */
function friendTells(ctx: Ctx, pick: SlotPick): BaseEvent[] {
  const route = pick.param as Id<"route"> | null;
  if (route === null || ctx.content.route[route] === undefined) return [];
  return record(ctx, { type: "activity/word-of-mouth", route, ...friendWord(readOf(ctx), route) });
}

/** R-ADVICE-004: the adviser reads every route heard or known, then looks into every one only heard. */
function adviserReads(ctx: Ctx, cause: Cause): BaseEvent[] {
  const routes = adviserReading(readOf(ctx));
  const events = record(ctx, { type: "activity/advised", routes });
  for (const { route } of routes) {
    if (ctx.state.route[route]?.state === "heard") ctx.apply([{ type: "route/look-into" }], { ...cause, param: route });
  }
  return events;
}

/** What the activities the kind runs by id do, after their costs. */
function runById(ctx: Ctx, entry: ActivityEntry, pick: SlotPick, cause: Cause): BaseEvent[] {
  switch (entry.id) {
    case OVERTIME:
      return overtime(ctx, cause);
    case DRIVING_TEST:
      return drivingTest(ctx, cause);
    case LOTTO:
      return lotto(ctx, pick, cause);
    case BET:
      return betSlip(ctx, cause);
    case FRIEND:
      return friendTells(ctx, pick);
    case ADVISER:
      return adviserReads(ctx, cause);
    case NOTICED:
      return beNoticed(ctx);
    default:
      return [];
  }
}

/**
 * R-ACTIVITY-013: one draw on `job` at `tuning.activity.raiseChanceBp`; a landed draw raises the held
 * job's pay by `raiseBp`, once for each job. the page names no stream, and the raise is the
 * job's, so it is drawn on `job`; a job already raised, or one with no pay of its own, draws nothing.
 */
function beNoticed(ctx: Ctx): BaseEvent[] {
  const job = ctx.state.activity.job;
  if (job === null || raisedJob(ctx.state, job)) return [];
  const entry = jobEntry(ctx.content, job);
  const read = readOf(ctx);
  const now = monthlyPay(read, entry);
  if (now === null) return [];
  const raised = ctx.random.chance("job", ctx.content.tuning.activity.raiseChanceBp);
  const after: ReadCtx = { ...read, state: { ...read.state, activity: { ...read.state.activity, raised: [...(read.state.activity.raised ?? []), job] } } };
  const pay = raised ? (monthlyPay(after, entry) ?? now) : now;
  return record(ctx, { type: "activity/noticed", job, raised, pay, was: now, month: ctx.state.turn.month });
}

/**
 * R-ACTIVITY-013: the raise from being noticed, for the Jobs app. The held job's pay a
 * month with the raise and the month it landed; nothing while the job held has no raise or no pay of its own.
 */
function raiseView(read: ReadCtx): { raise?: { pay: MoneyParam; month: number | null } } {
  const job = read.state.activity.job;
  if (job === null || !raisedJob(read.state, job)) return {};
  const pay = monthlyPay(read, jobEntry(read.content, job));
  return pay === null ? {} : { raise: { pay, month: read.state.activity.raisedIn?.[job] ?? null } };
}

/** Why the flight ends a job: the move abroad (R-PLACE-003). */
const MOVED = "moved";

/**
 * R-ACTIVITY-013: a course at home in progress ends with the flight. A course is an
 * activity whose months open fees; it is in progress once those fees are open and before its last month. Its
 * fees close by their type, so nothing of it is charged after. The flight ends the main job and the side job
 * in turn, so this is reached twice; the second time the fees are gone and nothing is told again.
 */
function endCourses(ctx: Ctx, cause: Cause): BaseEvent[] {
  const events: BaseEvent[] = [];
  for (const [id, count] of Object.entries(ctx.state.activity.played) as [Id<"activity">, number][]) {
    const steps = ctx.content.activity[id]?.onMonth ?? [];
    const opening = steps.find((step) => step.effects.some((effect) => effect.type === "obligation/open"));
    const fees = opening?.effects.find((effect) => effect.type === "obligation/open");
    if (opening === undefined || fees?.type !== "obligation/open") continue;
    const last = Math.max(...steps.filter((step) => step.repeat !== true).map((step) => step.at));
    const owed = ctx.content.obligation[fees.obligation];
    const open = Object.values(ctx.state.obligation.items).some((item) => item.entry === fees.obligation);
    if (count < opening.at || count >= last || owed === undefined || !open) continue;
    events.push(...record(ctx, { type: "activity/course-ended", activity: id }));
    ctx.apply([{ type: "obligation/close", obligationType: owed.type }], cause);
  }
  return events;
}

/**
 * R-ACTIVITY-013: the effects tied to the months an activity has filled a slot, this month counted. The
 * count before this month is the life's `played`, which the slots phase raises after every slot resolves.
 */
function milestones(ctx: Ctx, entry: ActivityEntry, cause: Cause): void {
  const count = (ctx.state.activity.played[entry.id] ?? 0) + 1;
  for (const step of entry.onMonth ?? []) {
    if (count === step.at || (step.repeat === true && count % step.at === 0)) ctx.apply(step.effects, cause);
  }
}

function questionIn(content: Content, setpiece: Id<"setpiece">, id: string): SetpieceQuestion | undefined {
  const entry = content.setpiece[setpiece];
  return entry?.questions.find((question) => question.id === id) ?? entry?.followUps?.find((question) => question.id === id);
}

/**
 * R-ACTIVITY-013: the effect `activity/exam`, given with the quiz's last answer. The answers given in the
 * open set piece are counted right when they score above zero in content (the quiz is opened with no route,
 * so nothing is scored on the state); `pass` or more applies the quiz's effects under the activity.
 */
function examEffect(ctx: Ctx, effect: Extract<Effect, { type: "activity/exam" }>): BaseEvent[] {
  const entry = ctx.content.activity[effect.activity];
  const exam = entry?.exam;
  const open = ctx.state.setpiece.open;
  if (entry === undefined || exam === undefined || open === null || open.entry !== exam.setpiece) return [];
  const right = open.questions.filter((question) => {
    const given = open.answers[question];
    return (questionIn(ctx.content, exam.setpiece, question)?.answers.find((answer) => answer.id === given)?.score ?? 0) > 0;
  }).length;
  const passed = right >= exam.pass;
  const events = record(ctx, { type: "activity/exam-marked", activity: entry.id, right, asked: open.questions.length, pass: exam.pass, passed });
  if (passed) ctx.apply(exam.effects, { source: entry.id, param: null, terms: {} });
  return events;
}

/** R-ACTIVITY-015: the month the paper the act just asked for is due, so the place can say how long; null for an act that asks for none. */
function paperDue(ctx: Ctx, entry: ActivityEntry): number | null {
  for (const effect of entry.effects) {
    if (effect.type !== "document/request") continue;
    const due = ctx.state.document[effect.document]?.readyMonth ?? null;
    if (due !== null) return due;
  }
  return null;
}

/**
 * `activity/now` (R-ACTIVITY-015): a now-act at once, with a slot's own checks, cost, effects and
 * lines (R-ACTIVITY-003, 004), then the place's answer. The kiosk's draw, the match and a hunt's
 * answer wait for the month. A now-act that is not a purchase runs once a month.
 */
function actNow(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "activity/now") throw new Error(`activity/now cannot handle ${command.type}.`);
  const pick = { activity: command.activity, param: command.param ?? null };
  if (!isPick(pick)) return reject("not-legal", "The act is not an activity and a param.");
  const entry = ctx.content.activity[pick.activity];
  if (entry === undefined) return reject("unknown-id", `${pick.activity} is not an activity in content.`);
  if ((entry.slot !== "free" && entry.slot !== "none") || !answersNow(entry)) return reject("not-legal", `${entry.id} fills the month: it is a slot pick, not an act now.`);
  if (doneThisMonth(ctx.state, entry)) return reject("not-legal", `${entry.id} was done this month already. It runs once a month.`);
  const problem = slotProblem(ctx, entry, pick, true);
  if (problem === "requirements") return reject("not-legal", `${entry.id} cannot be done here and now.`);
  if (problem === "param") return reject("not-legal", `${String(pick.param)} is not a param ${entry.id} may take now.`);
  if (problem === "cost") return reject("cannot-afford", `${entry.id} cannot be paid now.`);
  const events = record(ctx, { type: "activity/now-played", activity: entry.id, param: pick.param });
  const cause: Cause = { source: entry.id, param: pick.param, terms: {} };
  payPrices(ctx, pricesOf(readOf(ctx), entry, pick.param), cause);
  if (!DRAWN_LATER.includes(entry.id)) events.push(...runById(ctx, entry, pick, cause));
  ctx.apply(
    entry.effects.filter((effect) => !LATER_EFFECTS.includes(effect.type)),
    cause,
  );
  milestones(ctx, entry, cause);
  events.push(...record(ctx, { type: "activity/now-said", activity: entry.id, param: pick.param, ready: paperDue(ctx, entry) }));
  return events;
}

/** R-ACTIVITY-015: what the month's now-acts left to the month, first sent first: the kiosk's draw, the match, the employer's answer. */
function answerNowActs(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  for (const pick of nowThisMonth(ctx.state)) {
    const entry = ctx.content.activity[pick.activity];
    if (entry === undefined) throw new Error(`The month's now-acts name ${pick.activity}, which is not in content.`);
    const cause: Cause = { source: entry.id, param: pick.param, terms: {} };
    if (DRAWN_LATER.includes(entry.id)) events.push(...runById(ctx, entry, pick, cause));
    const later = entry.effects.filter((effect) => LATER_EFFECTS.includes(effect.type));
    if (later.length > 0) events.push(...ctx.apply(later, cause));
  }
  return events;
}

/** R-ACTIVITY-015: as the month closes, its now-acts are done with. */
function closeMonth(ctx: Ctx): BaseEvent[] {
  return nowThisMonth(ctx.state).length === 0 ? [] : record(ctx, { type: "activity/now-cleared" });
}

/** One slot (R-ACTIVITY-003, R-ACTIVITY-004): checked again, paid, then its effects. A failure pays nothing. */
function resolveSlot(ctx: Ctx, pick: SlotPick, slot: number): BaseEvent[] {
  const entry = ctx.content.activity[pick.activity];
  if (entry === undefined) throw new Error(`The slot names ${pick.activity}, which the turn check let through.`);
  // R-ACTIVITY-013: an act done once a month at most; a second pick of it fails as a slot, with nothing paid.
  const again = entry.once === true && turnSlots(ctx).slice(0, slot).some((earlier) => earlier.activity === entry.id);
  const why = again ? "requirements" : slotProblem(ctx, entry, pick, true);
  if (why !== null) {
    return record(ctx, { type: "activity/slot-failed", slot, activity: entry.id, param: pick.param, why });
  }
  const events = record(ctx, { type: "activity/slot-played", slot, activity: entry.id, param: pick.param });
  const cause: Cause = { source: entry.id, param: pick.param, terms: {} };
  const pieces = ctx.state.quality[PORTFOLIO] ?? 0;
  payPrices(ctx, pricesOf(readOf(ctx), entry, pick.param), cause);
  events.push(...runById(ctx, entry, pick, cause));
  ctx.apply(entry.effects, cause);
  milestones(ctx, entry, cause);
  events.push(...outcome(ctx, entry, pieces));
  return events;
}

/**
 * R-ACTIVITY-013, R-WORLD-008: a month of open source that added no piece is told all the same, its first
 * merge or a quiet month of fixes. A piece added is told by the portfolio's own line.
 */
function outcome(ctx: Ctx, entry: ActivityEntry, before: number): BaseEvent[] {
  if (entry.id !== OPEN_SOURCE || (ctx.state.quality[PORTFOLIO] ?? 0) > before) return [];
  return record(ctx, { type: "activity/contributed", first: (ctx.state.activity.played[OPEN_SOURCE] ?? 0) === 0 });
}

/**
 * The free slots, first slot first. Then each slot left empty counts as rest
 * (R-TURN-006), and the slots sent are kept for "same again" (R-ACTIVITY-009).
 */
function slots(ctx: Ctx): BaseEvent[] {
  const picks = turnSlots(ctx);
  const events: BaseEvent[] = answerNowActs(ctx);
  picks.forEach((pick, index) => events.push(...resolveSlot(ctx, pick, index)));
  // the count is the one the player saw at the turn check, carried by
  // the engine, not the count after the job's toll in `main`.
  const turn = turnInProgress(ctx);
  const allowed = turn === null ? freeSlots(ctx.state, ctx.content) : turn.freeSlots;
  const counted = picks.filter((pick) => fillsSlot(ctx.content, pick.activity)).length;
  const empty = Math.max(0, allowed - counted);
  if (empty > 0) {
    events.push(...record(ctx, { type: "activity/rested", slots: empty }));
    if (ctx.content.quality[WELLBEING] !== undefined) {
      const amount = empty * ctx.content.tuning.quality.wellbeingRest;
      ctx.apply([{ type: "quality/add", quality: WELLBEING, amount }], { source: REST_SOURCE, param: null, terms: {} });
    }
  }
  events.push(...record(ctx, { type: "activity/slots-recorded", slots: picks.map((pick) => ({ ...pick })) }));
  // The picks are the month's `lastSlots` now; a now-act done this month is counted with them, once (R-ACTIVITY-015).
  const filled = playedThisMonth(ctx.state);
  if (filled.size > 0) events.push(...record(ctx, { type: "activity/played-counted", activities: [...filled] }));
  return events;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/**
 * R-GUIDE-014 as amended: the job a life's first hunt lands, in its first
 * three months, when the draw misses. `month` is the month being played. Null
 * when the hunt is not that one: a month past the third, a month before with a hunt in it, or a hunt earlier in
 * this month. The job is the lowest month's pay, valued in naira at the
 * official rate, of the jobs that may be hunted now in the same slot as the
 * one named, then by id; the named job when none reads a pay.
 */
export function sureHuntJob(read: ReadCtx, named: ActivityEntry, month: number, huntedThisMonth: boolean): ActivityEntry | null {
  if (huntedThisMonth || month > SURE_HUNT_MONTHS) return null;
  const hunts = Object.values(read.content.activity).filter((entry) => entry.effects.some((effect) => effect.type === "activity/hunt"));
  if (hunts.some((entry) => (read.state.activity.played[entry.id] ?? 0) > 0)) return null;
  const rates = officialRates(read.world);
  let best: { entry: ActivityEntry; kobo: number } | null = null;
  for (const id of huntableJobs(read, (requirement) => check(read, requirement))) {
    const entry = jobEntry(read.content, id);
    const pay = entry.slot === named.slot ? monthlyPay(read, entry) : null;
    if (pay === null) continue;
    const kobo = valueInKobo(pay.amount, pay.currency, rates);
    if (best === null || kobo < best.kobo || (kobo === best.kobo && entry.id < best.entry.id)) best = { entry, kobo };
  }
  return best?.entry ?? named;
}

/**
 * One month of hunting the job the slot names (R-ACTIVITY-005). A landed hunt opens the job offer with the job in its terms.
 * R-GUIDE-014's sure first hunt (`sureHuntJob`) is not called here yet. Every recorded life's first hunt
 * missed, and landing it opens an offer that moves every later offer id, so all six recorded lives stop replaying at
 * their first offer command. Calling it waits on the lives being recorded again.
 */
function huntEffect(ctx: Ctx, _effect: unknown, cause: Cause): BaseEvent[] {
  if (cause.param === null) throw new Error(`A hunt from ${cause.source} names no job.`);
  const entry = jobEntry(ctx.content, cause.param);
  const hired = ctx.random.chance("job", huntChanceBp(readOf(ctx), entry));
  const events = record(ctx, { type: "activity/hunted", job: entry.id, hired });
  // content without the job offer has nothing to open, so the landed hunt opens nothing.
  if (hired && ctx.content.offer[JOB_OFFER] !== undefined) {
    ctx.apply([{ type: "offer/open", offer: JOB_OFFER }], { source: cause.source, param: cause.param, terms: { ...cause.terms, job: entry.id } });
  }
  return events;
}

/** A side gig (R-ACTIVITY-008): a draw between its figures plus its figure for each point of tech, in naira cash. */
function gigEffect(ctx: Ctx, effect: { min: number; max: number; perTech: number }, cause: Cause): BaseEvent[] {
  const tech = ctx.state.quality[TECH] ?? 0;
  const amount = ctx.random.between("gig", effect.min, effect.max) + effect.perTech * tech;
  if (amount <= 0) return [];
  const events = record(ctx, { type: "activity/gig-paid", amount });
  ctx.apply([{ type: "money/add", currency: GIG_CURRENCY, pocket: "cash", amount, reason: "gig" }], cause);
  return events;
}

/** `activity/quit` (R-ACTIVITY-006), or with `side` the side job (R-ACTIVITY-010). Nothing to leave is not legal. */
function quit(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "activity/quit") throw new Error(`activity/quit cannot handle ${command.type}.`);
  if (command.side === true) {
    if (ctx.state.activity.side === null) return reject("not-legal", "There is no side job to quit.");
    return endSide(ctx, "quit");
  }
  if (ctx.state.activity.job === null) return reject("not-legal", "There is no job to quit.");
  return endJob(ctx, "quit");
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

/** Months added across the listed jobs. An empty list means every job; the driving test's attempts are not months. */
export function tenureAcross(state: State, activities: readonly Id<"activity">[]): number {
  const counted = activities.length === 0 ? (Object.keys(state.activity.tenure) as Id<"activity">[]).filter((id) => id !== DRIVING_TEST) : activities;
  return counted.reduce((sum, id) => sum + (state.activity.tenure[id] ?? 0), 0);
}

/**
 * R-STREET-004: what filled a slot in the month just played, the way R-ACTIVITY-012 counts it: the
 * job and the side job held, and every free slot sent. At the `come-up` phase the slots sent are this
 * month's, recorded at `slots`. a slot that failed still counts, as it does for R-ACTIVITY-012.
 */
function playedThisMonth(state: State): Set<Id<"activity">> {
  const { job, side, lastSlots } = state.activity;
  // R-ACTIVITY-015: the month's now-acts are kept until the month closes, after `come-up`.
  const done = nowThisMonth(state).map((pick) => pick.activity);
  return new Set<Id<"activity">>([...(job === null ? [] : [job]), ...(side === null ? [] : [side]), ...lastSlots.map((pick) => pick.activity), ...done]);
}

function judgeJob(read: ReadCtx, requirement: Requirement): RequirementResult {
  const job = read.state.activity.job;
  switch (requirement.type) {
    case "job/any":
      return { met: job !== null };
    case "job/none":
      return { met: job === null };
    case "job/is":
      return { met: job !== null && requirement.activities.includes(job) };
    case "activity/tenure": {
      const have = tenureAcross(read.state, requirement.activities);
      return { met: have >= requirement.months, have, need: requirement.months };
    }
    case "activity/local-tenure": {
      const have = localTenure(read);
      return { met: have >= requirement.months, have, need: requirement.months };
    }
    case "activity/played":
      return { met: playedThisMonth(read.state).has(requirement.activity) };
    case "quality/min":
    case "quality/max":
    case "document/held":
    case "document/absent":
    case "document/pending":
    case "document/genuine":
    case "route/state":
    case "route/offer":
    case "route/deposit":
    case "route/funds":
    case "route/unexplained-max":
    case "money/min":
    case "money/can-pay":
    case "var/min":
    case "var/max":
    case "month/min":
    case "chapter/done":
    case "place/is":
    case "status/is":
    case "status/clock-under":
    case "credit/min":
    case "goal/done":
    case "era/is":
    case "obligation/has":
    case "route/gate-step":
    case "setpiece/answered":
    case "setpiece/answered-with":
    case "world/lottery":
    case "people/bond":
    case "people/sibling-abroad":
    case "people/joint":
    case "wallet/total":
    case "place/returned":
    case "place/months-here":
    case "home/host":
    case "not":
    case "any":
      throw new Error(`The activity kind does not judge ${requirement.type}.`);
    default: {
      const never: never = requirement;
      throw new Error(`Unknown requirement ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// The view and the report
// ---------------------------------------------------------------------------

/**
 * Every free-slot activity as the player may pick it now; abroad, only those of
 * the place (R-LADDER-001). `allowed` needs the place, the requirements and,
 * where it takes one, a param to pick. The cost shown is the first param's.
 */
export function activityOptions(read: ReadCtx): ActivityOption[] {
  const judge: Judge = (requirement) => check(read, requirement);
  const abroad = read.state.place.where === "abroad";
  return Object.values(read.content.activity)
    .filter((entry) => (entry.slot === "free" || entry.slot === "none") && (!abroad || appliesHere(entry, read.state)))
    .map((entry) => {
      const params = paramsFor(read, entry, judge);
      const waiting = entry.param === "school" && params?.length === 0 ? schoolWait(read) : [];
      const missing = [...entry.requires.filter((requirement) => !judge(requirement).met), ...waiting];
      const prices = pricesOf(read, entry, params?.[0] ?? null);
      const done = doneThisMonth(read.state, entry);
      return {
        id: entry.id,
        allowed: !done && missing.length === 0 && requirementsHold(read, entry, judge) && (params === null || params.length > 0),
        missing,
        params,
        cost: prices.map(({ currency, amount }) => ({ currency, amount })),
        affordable: canPayPrices(prices, judge),
        when: answersNow(entry) ? "now" : "month",
        done,
      };
    });
}

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention = false): ReportLine {
  return { key, params, tone, attention, counts: [] };
}

function pickParams(activity: Id<"activity">, param: string | null): ReportLine["params"] {
  return param === null ? { activity } : { activity, param };
}

/** The pay just credited is all the ledger holds under `reasons` in `currencies`. */
function onlyPay(state: State, pay: MoneyParam, currencies: readonly Currency[] | null): boolean {
  const paid = (["salary", "cash-work"] as const).flatMap((reason) =>
    Object.entries(state.wallet.totals.in[reason] ?? {}).filter(([currency, amount]) => (amount ?? 0) > 0 && (currencies === null || currencies.includes(currency as Currency))),
  );
  return paid.length === 1 && paid[0]?.[0] === pay.currency && paid[0][1] === pay.amount;
}

/**
 * The first pay of a life is a staged win; so is the first pay in a foreign
 * currency, shown in naira: the first dollar salary, the first pay abroad
 * (docs/rules/text.md "Money on screen", R-LUCK-008). The wallet credits the
 * pay before the month is recorded, so the ledger already counts it.
 */
function salaryLines(state: State, event: Extract<ActivityEvent, { type: "activity/month-worked" }>): ReportLine[] {
  if (event.pay === null) return [];
  const amount = { currency: event.pay.currency, amount: event.pay.amount };
  if (event.naira !== undefined && onlyPay(state, event.pay, [event.pay.currency])) {
    const naira: MoneyParam = { currency: "NGN", amount: event.naira };
    // Two different moments: the first dollar salary at home, and the first pay abroad.
    const key = state.place.where === "abroad" ? FIRST_PAY_ABROAD : "line.activity.salary-first-foreign";
    return [{ ...line(key, { job: event.job, amount, naira }, "good"), big: true }];
  }
  const salary = line("line.activity.salary", { job: event.job, amount }, "good");
  return [onlyPay(state, event.pay, null) ? { ...salary, big: true } : salary];
}

/** R-SHARE-001: the first-pay-abroad card through the month after the first pay abroad is told (R-LUCK-008). */
export function firstPayAbroadCard(read: ReadCtx): PlayerView["card"] {
  if (!cardsAllowed(read) || reportLines(read, FIRST_PAY_ABROAD).length === 0) return null;
  return cardOf(read, "first-pay-abroad");
}

function lines(event: ActivityEvent, state: State): ReportLine[] {
  switch (event.type) {
    case "activity/job-started":
      return [line("line.activity.job-started", { job: event.job }, "good")];
    case "activity/job-ended":
      return event.why === "quit"
        ? [line("line.activity.quit", { job: event.job }, "plain")]
        : [line("line.activity.job-ended", { job: event.job }, "bad")];
    case "activity/month-worked":
      return salaryLines(state, event);
    case "activity/pay-withheld":
      return [line("line.activity.pay-withheld", { job: event.job, amount: event.pay }, "bad", true)];
    case "activity/sick-pay":
      return [line("line.activity.sick-pay", { job: event.job, amount: event.pay }, "bad")];
    case "activity/side-started":
      return [line("line.activity.side-started", { job: event.side }, "good")];
    case "activity/course-ended":
      return [line("line.activity.course-ended", { activity: event.activity }, "bad")];
    case "activity/side-ended":
      return event.why === "quit"
        ? [line("line.activity.side-quit", { job: event.side }, "plain")]
        : [line("line.activity.side-ended", { job: event.side }, "bad")];
    case "activity/side-worked":
      return event.pay === null ? [] : [line("line.activity.side-pay", { job: event.side, amount: event.pay }, "good")];
    case "activity/robbed":
      return [
        line(
          "line.activity.robbed",
          { cash: { currency: "NGN", amount: event.cash }, phone: { currency: "NGN", amount: event.phone } },
          "bad",
          true,
        ),
      ];
    case "activity/overtime-paid":
      return [line("line.activity.overtime", { job: event.job, amount: event.pay }, "good")];
    case "activity/driving-test":
      return event.passed
        ? [line("line.activity.driving-passed", { attempt: event.attempt }, "good", true)]
        : [line("line.activity.driving-failed", { attempt: event.attempt }, "bad")];
    case "activity/lotto-played": {
      // A jackpot or a mid prize is staged (R-LUCK-008).
      const big = event.prizes.includes("jackpot") || event.prizes.includes("mid");
      if (event.won.amount === 0) return [line("line.activity.lotto-lost", { tickets: event.tickets, stake: event.stake }, "plain")];
      const won = line("line.activity.lotto-won", { tickets: event.tickets, stake: event.stake, won: event.won }, "good", big);
      return [big ? { ...won, big: true } : won];
    }
    case "activity/bet-placed":
      return event.won.amount === 0
        ? [line("line.activity.bet-lost", { stake: event.stake }, "bad")]
        : [line("line.activity.bet-won", { stake: event.stake, won: event.won }, "good")];
    case "activity/slot-played":
      return [line("line.activity.played", pickParams(event.activity, event.param), "plain")];
    case "activity/slot-failed":
      return [line(`line.activity.failed-${event.why}`, pickParams(event.activity, event.param), "bad")];
    case "activity/rested":
      return [line("line.activity.rested", { slots: event.slots }, "plain")];
    case "activity/hunted":
      // A landed hunt means an offer to answer.
      return event.hired
        ? [line("line.activity.hunt-hired", { job: event.job }, "good", true)]
        : [line("line.activity.hunt-missed", { job: event.job }, "plain")];
    case "activity/gig-paid":
      return [line("line.activity.gig", { amount: { currency: GIG_CURRENCY, amount: event.amount } }, "good")];
    case "activity/slots-recorded":
    case "activity/played-counted":
      return [];
    case "activity/noticed":
      return event.raised
        ? [line("line.activity.raised", { job: event.job, amount: event.pay, rise: { currency: event.pay.currency, amount: event.pay.amount - event.was.amount } }, "good", true)]
        : [line("line.activity.not-noticed", { job: event.job }, "plain")];
    case "activity/exam-marked":
      return event.passed
        ? [line("line.activity.exam-passed", { right: event.right, asked: event.asked }, "good", true)]
        : [line("line.activity.exam-failed", { right: event.right, asked: event.asked, pass: event.pass }, "bad", true)];
    case "activity/contributed":
      return [line(event.first ? "line.activity.first-merged" : "line.activity.contributed", {}, event.first ? "good" : "plain")];
    case "activity/word-of-mouth":
      return friendLines(event);
    case "activity/advised":
      return event.routes.flatMap(adviserLines);
    case "activity/now-said":
      return [line(nowLineKey(event.activity), { ...pickParams(event.activity, event.param), ...(event.ready === null ? {} : { month: event.ready }) }, "plain")];
    case "activity/now-played":
      // The act itself, told with the month's other lines as a slot's is, and named before the money it spends.
      return [line("line.activity.played-now", pickParams(event.activity, event.param), "plain")];
    case "activity/now-cleared":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown activity event ${JSON.stringify(never)}.`);
    }
  }
}

/** R-ACTIVITY-015: the place's answer to a now-act, `line.activity.<slug>.now`. */
export function nowLineKey(activity: Id<"activity">): string {
  return `line.activity.${activity.slice("activity.".length)}.now`;
}

/** The checklist item's words, by the key the route's words use, as a param the interface names (`<key>.name`). */
function itemParam(route: Id<"route">, item: string): string {
  return `${route}.item.${item}`;
}

/**
 * R-ADVICE-003: the friend's checklist, the out-of-date item said the same way
 * as the rest, and marked out of date only when the player meets it.
 */
function friendLines(event: Extract<ActivityEvent, { type: "activity/word-of-mouth" }>): ReportLine[] {
  const told = event.items.map((item) => line("line.activity.went-item", { item: itemParam(event.route, item) }, "plain"));
  const marked = event.wrong !== null && event.metWrong ? [line("line.activity.went-out-of-date", { item: itemParam(event.route, event.wrong) }, "plain", true)] : [];
  return [line("line.activity.went-told", { route: event.route }, "plain"), ...told, ...marked];
}

/** R-ADVICE-004: fits or not, what is missing, and "at least N months". */
function adviserLines(reading: Extract<ActivityEvent, { type: "activity/advised" }>["routes"][number]): ReportLine[] {
  if (reading.fits) return [line("line.activity.adviser-fits", { route: reading.route }, "good")];
  return [
    line("line.activity.adviser-missing", { route: reading.route, count: reading.missing.length, months: reading.months }, "plain", true),
    ...reading.missing.map((item) => line("line.activity.adviser-item", { item: itemParam(reading.route, item) }, "plain")),
  ];
}

function evolve(slice: ActivitySlice, event: ActivityEvent): ActivitySlice {
  switch (event.type) {
    case "activity/job-started":
      return { ...slice, job: event.job };
    case "activity/job-ended":
      // Tenure stays: time served is kept when a job is left (R-ACTIVITY-006).
      return { ...slice, job: null };
    case "activity/month-worked":
      return { ...slice, tenure: { ...slice.tenure, [event.job]: event.tenure } };
    case "activity/side-started":
      return { ...slice, side: event.side };
    case "activity/side-ended":
      return { ...slice, side: null };
    case "activity/driving-test":
      return { ...slice, tenure: { ...slice.tenure, [DRIVING_TEST]: event.attempt } };
    case "activity/slots-recorded":
      return { ...slice, lastSlots: event.slots };
    case "activity/played-counted": {
      const played = { ...slice.played };
      for (const id of event.activities) played[id] = (played[id] ?? 0) + 1;
      return { ...slice, played };
    }
    case "activity/noticed":
      return event.raised ? { ...slice, raised: [...(slice.raised ?? []), event.job], raisedIn: { ...slice.raisedIn, [event.job]: event.month } } : slice;
    case "activity/now-played":
      return { ...slice, now: [...(slice.now ?? []), { activity: event.activity, param: event.param }] };
    case "activity/now-cleared":
      return { ...slice, now: [] };
    case "activity/now-said":
    case "activity/pay-withheld":
    case "activity/sick-pay":
    case "activity/side-worked":
    case "activity/robbed":
    case "activity/overtime-paid":
    case "activity/lotto-played":
    case "activity/bet-placed":
    case "activity/slot-played":
    case "activity/slot-failed":
    case "activity/rested":
    case "activity/hunted":
    case "activity/gig-paid":
    case "activity/word-of-mouth":
    case "activity/advised":
    case "activity/exam-marked":
    case "activity/contributed":
    case "activity/course-ended":
      return slice;
    default: {
      const never: never = event;
      throw new Error(`Unknown activity event ${JSON.stringify(never)}.`);
    }
  }
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  const { job, side, tenure, lastSlots } = state.activity;
  if (job !== null && content.activity[job]?.slot !== "main") problems.push(`The job ${job} is not a main-slot activity in content.`);
  if (side !== null && content.activity[side]?.slot !== "side") problems.push(`The side job ${side} is not a side-slot activity in content.`);
  for (const [id, months] of Object.entries(tenure)) {
    if (id !== DRIVING_TEST && content.activity[id as Id<"activity">]?.slot !== "main") problems.push(`Tenure is kept for ${id}, which is not a job in content.`);
    if (!Number.isSafeInteger(months) || months < 0) problems.push(`Tenure in ${id} is ${String(months)}.`);
  }
  for (const id of state.activity.raised ?? []) {
    if (content.activity[id]?.slot !== "main") problems.push(`The raise is kept for ${id}, which is not a job in content.`);
  }
  for (const pick of state.activity.now ?? []) {
    const entry = content.activity[pick.activity];
    if (entry === undefined || !answersNow(entry)) problems.push(`The month's now-acts name ${pick.activity}, which does not answer now.`);
  }
  for (const pick of lastSlots) {
    if (content.activity[pick.activity]?.slot !== "free" && content.activity[pick.activity]?.slot !== "none") problems.push(`The last slots name ${pick.activity}, which is not a free-slot activity.`);
  }
  return problems;
}

export const activityKind: RegisteredKind<ActivitySlice, ActivityEvent> = {
  kind: "activity",
  initial: (scenario) => ({ job: scenario.job, side: null, tenure: { ...scenario.tenure }, lastSlots: [], played: {} }),
  commands: {
    "turn/end": validateSlots,
    "activity/quit": quit,
    "activity/now": actNow,
  },
  effects: {
    "activity/hunt": huntEffect,
    "activity/start-job": (ctx, effect, cause) => {
      if (effect.type !== "activity/start-job") throw new Error(`start-job cannot carry out ${effect.type}.`);
      return startJobEffect(ctx, effect, cause);
    },
    "activity/end-job": (ctx, effect, cause) => {
      if (effect.type !== "activity/end-job") throw new Error(`end-job cannot carry out ${effect.type}.`);
      // R-ACTIVITY-010: `side` ends the side job and leaves the main job.
      const ended = effect.side === true ? endSide(ctx, effect.why) : endJob(ctx, effect.why);
      return effect.why === MOVED ? [...ended, ...endCourses(ctx, cause)] : ended;
    },
    "activity/gig": (ctx, effect, cause) => {
      if (effect.type !== "activity/gig") throw new Error(`gig cannot carry out ${effect.type}.`);
      return gigEffect(ctx, effect, cause);
    },
    "activity/exam": (ctx, effect) => {
      if (effect.type !== "activity/exam") throw new Error(`exam cannot carry out ${effect.type}.`);
      return examEffect(ctx, effect);
    },
  },
  phases: { main, slots, close: closeMonth },
  evolve,
  lines,
  requirements: {
    "job/any": judgeJob,
    "job/none": judgeJob,
    "job/is": judgeJob,
    "activity/tenure": judgeJob,
    "activity/local-tenure": judgeJob,
    "activity/played": judgeJob,
  },
  invariants,
  view: (read) => ({
    job: {
      id: read.state.activity.job,
      months: read.state.activity.job === null ? 0 : (read.state.activity.tenure[read.state.activity.job] ?? 0),
      side: read.state.activity.side,
      ...raiseView(read),
    },
    activities: activityOptions(read),
    lastSlots: read.state.activity.lastSlots,
  }),
};
