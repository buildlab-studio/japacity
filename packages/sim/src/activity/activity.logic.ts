// Activities and jobs: docs/rules/activity.md, ladders.md and car.md. The month
// has one main activity, the job, a side job if one is held, and a few free
// slots. The slot rules read here are judged twice: once when `turn/end` is
// checked (activity:illegal-slot-rejects-turn), and again when each slot resolves (activity:slots-resolve-in-order),
// because an earlier slot can change the state.
import { check, resolveAmount, worldVarOr } from "../engine/check";
import { DOCUMENT, QUALITY } from "../engine/ids";
import { bp, mulDiv, roundDownTo, valueInKobo } from "../engine/int";
import { cardOf, cardsAllowed, reportLines } from "../chapter/chapter.card";
import type { RegisteredKind } from "../engine/kind";
import { emit, readOf, turnInProgress, turnSlots } from "../engine/kind";
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
  MONTHS_PER_YEAR,
  drivingAttempts,
  isJob,
  jobTerms,
  localTenure,
  bookedPay,
  monthlyPay,
  monthlyTax,
  overtimePay,
  raisedJob,
} from "./activity.pay";
import {
  bandGain,
  behindOnFees,
  BOOTCAMP,
  bootcampHelpBp,
  bootcampTaken,
  certificateTech,
  classDaysNow,
  dayGain,
  DEVELOPER_JOBS,
  FREE_PATH,
  holdsCourse,
  LEARN_TECH,
  onBootcamp,
  onCourse,
} from "./activity.learning";
import { withThings } from "../thing/thing.modifiers";
import { EARNED_ONLY, earnedNaira, pocketFor } from "../wallet/wallet.logic";
import { officialRates } from "../wallet/wallet.rates";
import type { Judge } from "../japacity/japacity.logic";

export { cashWorkedThisMonth, localTenure, sideJobHeld } from "./activity.pay";

const TECH: Id<"quality"> = "quality.tech";
const DRIVING: Id<"quality"> = "quality.driving";
/** The offer a landed hunt opens. It learns the job from the terms (offer:effect-opens-named-offer). */
const JOB_OFFER = "offer.job" as const;
const HUNT_ACTIVITY: Id<"activity"> = "activity.job-hunt";
/** guide:early-win-in-three-turns: the months in which a life's first hunt is sure, counted as the month being played. */
const SURE_HUNT_MONTHS = 3;
/** A side gig pays naira cash (activity:side-gig-pays-a-draw). */
const GIG_CURRENCY: Currency = "NGN";
/** The source named on the rest an empty slot gives. */
const REST_SOURCE = "rest";

// The activities whose figures are tuning rather than entry fields: the kind runs them by id.
const OVERTIME: Id<"activity"> = "activity.overtime";
const LOTTO: Id<"activity"> = "activity.play-lotto";
const BET: Id<"activity"> = "activity.bet-slip";
/** streets:buy-phone-at-computer-village: the phone is paid from cash, at the tuning's price. */
const PHONE: Id<"activity"> = "activity.buy-phone";
/** activity:waiting-months-build-profile: being noticed at work, a raise on a draw. */
const NOTICED: Id<"activity"> = "activity.be-noticed";
/** activity:waiting-months-build-profile: open source tells its month even when no piece comes of it. */
const OPEN_SOURCE: Id<"activity"> = "activity.open-source";
/** activity:one-chance-bus-robbery: a slot of either keeps the bus home safe that month. */
const COUNTER_MOVES: readonly Id<"activity">[] = ["activity.safe-ride", "activity.sleep-at-office"];
/** activity:now-acts-and-month-acts: the now-acts whose draw lands with the month: the kiosk's draw and the match. */
const DRAWN_LATER: readonly Id<"activity">[] = [LOTTO, BET];
/** activity:now-acts-and-month-acts: the effects of a now-act that land with the month: the employer's answer to a hunt. */
const LATER_EFFECTS: readonly Effect["type"][] = ["activity/hunt"];

/** The lock reasons this kind reads and writes (turn:slots-can-be-locked, health:sick-pay-unless-sick-leave). */
export const SIDE_JOB_LOCK = "side-job";
const ILLNESS_LOCK = "illness";
const UNLOCKED_LINE = "line.turn.unlocked";
/** The staged line of the first pay abroad (luck:big-wins-are-staged), which the first-pay card reads (share:cards-due-at-set-moments). */
const FIRST_PAY_ABROAD = "line.activity.salary-first-abroad";

/** activity:bootcamp-paid-after-a-job: the loan the first developer job opens. */
const BOOTCAMP_LOAN: Id<"obligation"> = "obligation.bootcamp";
/** Kobo in a naira: a reviewed pay is rounded down to whole naira (activity:naira-pay-reviewed-yearly). */
const KOBO_PER_NAIRA = 100;
/** A rise read in basis points of the rate it rose from. */
const BP_WHOLE = 10000;
const PORTFOLIO: Id<"quality"> = "quality.portfolio";

/** The kiosk draws each ticket out of a million (luck:kiosk-sells-lotto-tickets). */
export const PER_MILLION = 1000000;
const BP_IN_MILLION = 100;

/** Applies this kind's events at once, so the rest of the handler sees them. */
function record(ctx: Ctx, ...events: ActivityEvent[]): BaseEvent[] {
  return emit(ctx, "activity", events);
}

const judgeOf = (ctx: Ctx): Judge => (requirement) => ctx.check(requirement);

function allHold(requirements: readonly Requirement[], judge: Judge): boolean {
  return requirements.every((requirement) => judge(requirement).met);
}

/** activity:now-acts-and-month-acts: an entry that answers now, sent as `activity/now`; every other entry fills the month. */
export function answersNow(entry: Pick<ActivityEntry, "when">): boolean {
  return entry.when === "now";
}

/** activity:now-acts-and-month-acts: the now-acts sent in the month in hand, in order. */
function nowThisMonth(state: State): SlotPick[] {
  return state.activity.now ?? [];
}

/**
 * activity:spent-body-refuses-acts (decision 0011): the body is spent for an act that takes effort (any time at all) when energy is under
 * `tuning.turn.body.spentBelow`; a purchase, and an act that takes no time, never waits.
 */
function bodySpent(state: State, content: Content, entry: Pick<ActivityEntry, "purchase" | "halfDays">): boolean {
  if (entry.purchase === true || (entry.halfDays ?? 1) <= 0 || content.quality["quality.energy"] === undefined) return false;
  return (state.quality["quality.energy"] ?? 0) < content.tuning.turn.body.spentBelow;
}

/** activity:now-acts-and-month-acts: a now-act that is not a purchase and does not repeat (activity:acts-may-repeat-in-month), already done this month, so shut until the next. */
function doneThisMonth(state: State, entry: Pick<ActivityEntry, "id" | "purchase" | "repeat">): boolean {
  return entry.purchase !== true && entry.repeat !== true && nowThisMonth(state).some((pick) => pick.activity === entry.id);
}

// ---------------------------------------------------------------------------
// The kiosk's numbers: luck:kiosk-sells-lotto-tickets and luck:bet-slip-stake-and-odds
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

/** The ticket counts the kiosk sells (luck:kiosk-sells-lotto-tickets, engine:limits-tested-through-step): 1 up to the cap. */
export function ticketParams(luck: Tuning["luck"]): string[] {
  return Array.from({ length: luck.maxTickets }, (_unused, index) => String(index + 1));
}

/**
 * luck:kiosk-sells-lotto-tickets: the counts the kiosk still sells this month, under its ceiling less the tickets already bought, so the view
 * never offers a slip `activity/now` refuses. None once the month's ceiling is reached.
 */
function ticketsLeft(read: ReadCtx): string[] {
  const bought = nowThisMonth(read.state)
    .filter((done) => done.activity === LOTTO)
    .reduce((sum, done) => sum + Number(done.param ?? 0), 0);
  return ticketParams(read.content.tuning.luck).slice(0, Math.max(0, read.content.tuning.luck.maxTickets - bought));
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
 * Jobs that may be hunted (activity:job-hunt-lands-offer, ladders:activities-filtered-by-where, activity:side-job-holds-a-slot): main and
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
        // activity:paid-tech-courses: no job is held while the bootcamp runs.
        !(entry.slot === "main" && onBootcamp(read.state)) &&
        entry.id !== job &&
        entry.id !== side &&
        appliesHere(entry, read.state) &&
        workAllows(read, entry) &&
        carHolds(read, entry) &&
        allHold(entry.requires, judge),
    )
    .map((entry) => entry.id);
}

/** Routes that may be looked into: heard of and not yet known (route:looking-into-makes-known). */
function heardRoutes(read: ReadCtx): string[] {
  return Object.keys(read.content.route).filter((id) => read.state.route[id as Id<"route">]?.state === "heard");
}

/** Routes known, for the activities that work a route already looked into (the sponsor's find, route-gates:sponsor-offers-come-up). */
function knownRoutes(read: ReadCtx): string[] {
  return Object.keys(read.content.route).filter((id) => read.state.route[id as Id<"route">]?.state === "known");
}

/**
 * The month from which a school that refused takes a new application
 * (route:applying-to-a-school): its answer's month plus `reapplyMonths`. Null when there is
 * no refusal there.
 */
function reapplyFrom(application: SchoolApplication | undefined, numbers: Tuning["route"]): number | null {
  return application?.state === "rejected" ? application.readyMonth + numbers.reapplyMonths : null;
}

/**
 * Whether a school takes an application now (route:applying-to-a-school): none there yet, or
 * a refusal whose wait has run. The route kind judges the same.
 */
export function takesApplication(application: SchoolApplication | undefined, month: number, numbers: Tuning["route"]): boolean {
  if (application === undefined) return true;
  const from = reapplyFrom(application, numbers);
  return from !== null && month >= from;
}

/** The schools on known routes whose grade minimum the character meets, each with its application (route:applying-to-a-school: no school asks a band). */
function reachableSchools(read: ReadCtx): { id: Id<"school">; application: SchoolApplication | undefined }[] {
  const grade = read.state.quality[QUALITY.eduGrade] ?? 0;
  const schools: { id: Id<"school">; application: SchoolApplication | undefined }[] = [];
  for (const route of Object.values(read.content.route)) {
    const held = read.state.route[route.id];
    if (held?.state !== "known") continue;
    for (const id of route.schools) {
      const school = read.content.school[id];
      if (school !== undefined && grade >= school.minGrade) schools.push({ id, application: held.schools[id] });
    }
  }
  return schools;
}

/**
 * Schools that may be applied to (route:applying-to-a-school): on a known route, the grade
 * meets the school's minimum, and there is no application
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
 * application, the view names the month it can (route:applying-to-a-school).
 */
function schoolWait(read: ReadCtx): Requirement[] {
  const months = reachableSchools(read)
    .map(({ application }) => reapplyFrom(application, read.content.tuning.route))
    .filter((from): from is number => from !== null && from > read.state.turn.month);
  return months.length === 0 ? [] : [{ type: "month/min", value: Math.min(...months) }];
}

/**
 * The params a free activity may take now (activity:illegal-slot-rejects-turn). Null when it
 * takes none. Pure: the turn check, each slot as it resolves, the view and
 * the route kind all read the same list. Pass a judge to run inside a step.
 * The contract's `param` has no `tickets`, so the kiosk's ticket counts are read by its id.
 */
export function paramsFor(read: ReadCtx, entry: ActivityEntry, judge: Judge = (requirement) => check(read, requirement)): string[] | null {
  if (entry.id === LOTTO) return ticketsLeft(read);
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

/** A price as the kind pays it. `cash` is paid from the cash pocket only (luck:kiosk-sells-lotto-tickets, luck:bet-slip-stake-and-odds). `earned`: paid from earned naira only (wallet:top-ups-are-marked). */
interface Price {
  currency: Currency;
  amount: number;
  reason: Reason;
  cash: boolean;
  earned: boolean;
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
 * (decision 0014: a street price is cash first, never cash alone; only the street takes cash by itself).
 */
function canPayPrices(prices: readonly Price[], judge: Judge, wallet: State["wallet"]): boolean {
  return canPayAll(prices, judge) && earnedCovers(prices, wallet);
}

/** wallet:top-ups-are-marked, lottery:tickets-bought-with-earned-naira: the kiosk's slip is paid from earned naira only, the naira held less the marked, topped-up share. */
function earnedCovers(prices: readonly Price[], wallet: State["wallet"]): boolean {
  const owed = prices.reduce((sum, price) => sum + (price.earned && price.currency === "NGN" ? price.amount : 0), 0);
  return owed <= earnedNaira(wallet);
}

/** The ticket count a lotto pick names, or 1 when the pick names none the kiosk sells. */
function ticketsOf(param: string | null, luck: Tuning["luck"]): number {
  return param !== null && ticketParams(luck).includes(param) ? Number(param) : 1;
}

/**
 * What an activity costs now: its entry's costs, and the ones the kind sets for
 * the activities it runs by id. The lessons are paid under `study` and each
 * attempt under `fee-test`, in the currency of the country the test is in.
 */
function pricesOf(read: ReadCtx, entry: ActivityEntry, param: string | null): Price[] {
  // activity:paid-tech-courses: a path's own price is paid once, at its start.
  const costs = holdsCourse(read.state, entry) ? [] : entry.cost;
  const prices: Price[] = costs.map((cost) => ({ currency: cost.currency, amount: resolveAmount(read, cost.amount), reason: cost.reason, cash: false, earned: false }));
  const { luck, car } = read.content.tuning;
  // luck:kiosk-sells-lotto-tickets with wallet:top-ups-are-marked: the slip is paid from earned naira only.
  if (entry.id === LOTTO) prices.push({ currency: "NGN", amount: luck.ticket * ticketsOf(param, luck), reason: "social", cash: true, earned: true });
  if (entry.id === BET) prices.push({ currency: "NGN", amount: luck.stake, reason: "social", cash: true, earned: false });
  if (entry.id === PHONE) prices.push({ currency: "NGN", amount: read.content.tuning.street.phonePrice, reason: "phone", cash: true, earned: false });
  // advice:licensed-adviser-is-truthful: the adviser's fee under its own reason, `fee-advice`.
  // The licensed adviser is paid by transfer like any office; the street prices above are cash first.
  if (entry.id === ADVISER) prices.push({ currency: "NGN", amount: read.content.tuning.advice.adviserFee, reason: "fee-advice", cash: false, earned: false });
  if (entry.id === DRIVING_TEST) {
    const currency = entry.country === undefined || entry.country === null ? null : read.content.country[entry.country]?.currency;
    if (currency === undefined || currency === null) throw new Error(`${entry.id} names no country to pay in.`);
    if (drivingAttempts(read.state) === 0) prices.push({ currency, amount: car.lessons, reason: "study", cash: false, earned: false });
    prices.push({ currency, amount: car.testFee, reason: "fee-test", cash: false, earned: false });
  }
  return prices;
}

/** Pays each cost under its own reason: naira by transfer, bank first, or cash first for a street price (decision 0014); a foreign fee by wallet:foreign-fee-payment-order (activity:costs-paid-bank-or-cash). */
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

/** The chance one month of hunting lands a job (activity:job-hunt-lands-offer). */
export function hireChanceBp(entry: ActivityEntry, network: number, tuning: Tuning["quality"]): number {
  return Math.min(tuning.hireMaxBp, (entry.hireBp ?? 0) + tuning.networkHireBp * network);
}

/** director.md: the remote-hiring boom adds its bonus to the remote job's hire chance, under the same cap. */
const REMOTE_JOB: Id<"activity"> = "activity.job-remote-developer";
const REMOTE_BONUS: Id<"var"> = "var.remote-hire-bonus";

/** activity:job-hunt-lands-offer: a hunt's chance now, the world's bonus for the remote job included. */
export function huntChanceBp(read: ReadCtx, entry: ActivityEntry): number {
  const tuning = read.content.tuning.quality;
  const network = read.state.quality[QUALITY.network] ?? 0;
  const bonus = (entry.id === REMOTE_JOB ? worldVarOr(read.world, REMOTE_BONUS) : 0) + bootcampHelpBp(read, entry.id);
  return Math.min(tuning.hireMaxBp, hireChanceBp(entry, network, tuning) + bonus);
}

function jobEntry(content: Content, id: string): ActivityEntry {
  const entry = content.activity[id as Id<"activity">];
  if (!isJob(entry)) throw new Error(`${id} is not a job in content.`);
  return entry;
}

/**
 * health:sick-pay-unless-sick-leave reads the lock's reason. A lock for this turn either still holds
 * or was dropped by this turn's `spend`, which the turn kind reports in a line.
 * The turn in progress carries no locks, so the dropped ones are read from
 * that line.
 */
function lockedThisTurn(ctx: Ctx, why: string): boolean {
  if (activeLocks(ctx.state.turn.locks, ctx.state.turn.month).some((lock) => lock.why === why)) return true;
  const lines = turnInProgress(ctx)?.lines() ?? [];
  return lines.some((line) => line.key === UNLOCKED_LINE && typeof line.params.why === "string" && line.params.why.split(", ").includes(why));
}

/** The country's one-employer status that a sponsor's certificate grants (ladders:sponsor-job-ties-status). */
function sponsoredStatusOf(content: Content, country: Id<"country">): Id<"status"> | null {
  const found = Object.values(content.status).find((entry) => entry.country === country && entry.work === "one-employer" && entry.clockMonths !== null);
  return found?.id ?? null;
}

/**
 * Leaving a job (activity:new-job-replaces-held). status:lost-job-starts-clock: on a one-employer status, losing
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

/** activity:side-job-holds-a-slot: one slot locked for the month in hand, renewed each month the side job is kept. */
function lockForSide(ctx: Ctx, side: Id<"activity">): void {
  ctx.apply([{ type: "turn/lock", slots: 1, months: 1, why: SIDE_JOB_LOCK }], { source: side, param: null, terms: {} });
}

/**
 * Takes a job at once (activity:new-job-replaces-held), or a side job beside it (activity:side-job-holds-a-slot).
 * Its requirements are not judged again: they were judged when it was hunted
 * (activity:job-hunt-lands-offer, activity:requirements-judged-at-hunt). The status's work rule is (status:status-sets-work-rule): a job it does
 * not allow does not start. A sponsor's job carries its own certificate and
 * grants the country's one-employer status for it (ladders:sponsor-job-ties-status), unless the
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
  events.push(...holdPay(ctx, entry), ...billBootcamp(ctx, entry));
  const { place, status } = ctx.state;
  const kept = status.current !== null && isKept(ctx.content, status.current.entry);
  if (entry.sponsor === true && place.where === "abroad" && place.country !== null && !kept) {
    const sponsored = sponsoredStatusOf(ctx.content, place.country);
    // The status granted on arrival already names this job (route-gates:sponsored-status-on-departure).
    const named = status.current?.entry === sponsored && status.current.job === entry.id;
    if (sponsored !== null && !named) ctx.apply([{ type: "status/grant", status: sponsored, job: entry.id }], { source: entry.id, param: null, terms: {} });
  }
  return events;
}

/** activity:naira-pay-reviewed-yearly: the jobs whose pay is reviewed: naira main jobs at home with an employer that reviews. */
function reviewed(entry: ActivityEntry): boolean {
  return entry.slot === "main" && entry.where !== "abroad" && entry.pay?.currency === "NGN" && (entry.employer === "formal" || entry.employer === "informal");
}

/** activity:naira-pay-reviewed-yearly: a reviewed job's pay is held from its start, with the official dollar rate of the day. */
function holdPay(ctx: Ctx, entry: ActivityEntry): BaseEvent[] {
  if (!reviewed(entry) || entry.pay === null) return [];
  const pay = resolveAmount(readOf(ctx), entry.pay.amount, {});
  return record(ctx, { type: "activity/pay-held", job: entry.id, pay, rate: officialRates(ctx.world).USD });
}

/**
 * activity:bootcamp-paid-after-a-job: the first developer job after the bootcamp opens its loan for what is owed. It is a debt taken over,
 * so it credits nothing (obligation:loan-opening-credits-principal), and it is opened under the loan's own name.
 */
function billBootcamp(ctx: Ctx, entry: ActivityEntry): BaseEvent[] {
  const owed = ctx.state.activity.bootcampOwed;
  if (owed === undefined || !DEVELOPER_JOBS.includes(entry.id) || ctx.content.obligation[BOOTCAMP_LOAN] === undefined) return [];
  ctx.apply([{ type: "obligation/open", obligation: BOOTCAMP_LOAN, principal: owed }], { source: BOOTCAMP_LOAN, param: null, terms: {} });
  return record(ctx, { type: "activity/bootcamp-billed", owed });
}

/**
 * activity:naira-pay-reviewed-yearly: at each 12 months in a reviewed job, before that month's pay, the held pay rises by the employer's
 * share: a formal one's 10% and half the official dollar's rise beyond it since the last review, at most the cap; an informal one's 5%.
 * A job held with no pay on record (a starting life's, or one carried from an older save) records it now and is reviewed a year on.
 */
function review(ctx: Ctx): BaseEvent[] {
  const job = ctx.state.activity.job;
  if (job === null) return [];
  const entry = jobEntry(ctx.content, job);
  if (!reviewed(entry)) return [];
  const { pay, reviewRate } = ctx.state.activity;
  if (pay === undefined || reviewRate === undefined) return holdPay(ctx, entry);
  const months = ctx.state.activity.tenure[job] ?? 0;
  if (months === 0 || months % MONTHS_PER_YEAR !== 0) return [];
  const rate = officialRates(ctx.world).USD;
  const numbers = ctx.content.tuning.activity;
  const rise = rate > reviewRate ? mulDiv(rate - reviewRate, BP_WHOLE, reviewRate) : 0;
  const share =
    entry.employer === "formal" ? Math.min(numbers.reviewCapBp, numbers.reviewFormalBp + bp(Math.max(0, rise - numbers.reviewFormalBp), numbers.reviewShareBp)) : numbers.reviewInformalBp;
  const next = roundDownTo(pay + bp(pay, share), KOBO_PER_NAIRA);
  return record(ctx, { type: "activity/reviewed", job, was: { currency: "NGN", amount: pay }, pay: { currency: "NGN", amount: next }, rate });
}

/** activity:naira-pay-reviewed-yearly: the months until the held job's next review, for the Jobs app; nothing for a job not reviewed or with no pay on record. */
function reviewView(read: ReadCtx): { review?: number } {
  const job = read.state.activity.job;
  if (job === null || read.state.activity.pay === undefined || !reviewed(jobEntry(read.content, job))) return {};
  const months = read.state.activity.tenure[job] ?? 0;
  const into = months % MONTHS_PER_YEAR;
  return { review: months > 0 && into === 0 ? 1 : MONTHS_PER_YEAR - into + 1 };
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
 * car:licence-and-driving-test: a driver holds the home licence from arrival. It is granted in
 * the first month abroad, so its 12 months run from that month.
 */
function licenceOnArrival(ctx: Ctx): void {
  const { place, turn, quality } = ctx.state;
  if (place.where !== "abroad" || place.movedMonth !== turn.month - 1 || (quality[DRIVING] ?? 0) < 1) return;
  if (ctx.content.document[DOCUMENT.homeLicence] === undefined) return;
  ctx.apply([{ type: "document/grant", document: DOCUMENT.homeLicence }], { source: DRIVING, param: null, terms: {} });
}

/** ladders:sponsor-job-ties-status: the job a one-employer status names is the job held, until it is lost and the clock runs. */
function followStatus(ctx: Ctx): BaseEvent[] {
  const current = ctx.state.status.current;
  if (current === null || current.job === null || current.clock !== null) return [];
  if (statusEntry(ctx.content, current.entry).work !== "one-employer" || ctx.state.activity.job === current.job) return [];
  const entry = jobEntry(ctx.content, current.job);
  return record(ctx, { type: "activity/job-started", job: entry.id, previous: ctx.state.activity.job });
}

/**
 * place:entries-legal-by-where and status:status-sets-work-rule for the jobs held: a job of another place ends,
 * unless it is the job the status names, and so does one the status does not let
 * the character work. They end before the month is paid.
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

/**
 * Cash work is paid under its own reason, in naira to the pocket its size takes (wallet:money-lands-as-in-lagos) and abroad in hand;
 * everything else to the bank as salary.
 */
function payEffect(entry: ActivityEntry, pay: MoneyParam, content: Content): Effect {
  const pocket = pay.currency === "NGN" ? pocketFor(pay.amount, content.tuning.wallet) : "cash";
  return entry.cash === true
    ? { type: "money/add", currency: pay.currency, pocket, amount: pay.amount, reason: "cash-work" }
    : { type: "money/add", currency: pay.currency, pocket: "bank", amount: pay.amount, reason: "salary" };
}

/**
 * The job's month (activity:one-job-paid-monthly, abroad-money:salary-abroad-taxed-locally, ladders:cash-jobs-paid-in-hand, health:sick-pay-unless-sick-leave): pay,
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
  ctx.apply([payEffect(entry, pay, ctx.content)], cause);
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
 * activity:one-chance-bus-robbery: at home with a side job, the bus home may be a robbery, unless
 * a slot this month is a counter-move. The slots sent for the month are read.
 */
function oneChance(ctx: Ctx, side: Id<"activity">): BaseEvent[] {
  if (ctx.state.place.where !== "home") return [];
  // activity:now-acts-and-month-acts: the safe ride is bought now, for the month.
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
  if (ctx.content.quality[QUALITY.wellbeing] !== undefined) ctx.apply([{ type: "quality/add", quality: QUALITY.wellbeing, amount: ctx.content.tuning.ladder.robberyWellbeing }], cause);
  return events;
}

/**
 * The side job's month (activity:side-job-holds-a-slot): its pay, its toll, the slot locked for
 * the month to come, and at home the one chance. Naira pay goes as `gig` to the
 * pocket its size takes (wallet:money-lands-as-in-lagos), and a foreign currency to the bank as `salary`.
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
        ? { type: "money/add", currency: pay.currency, pocket: pocketFor(pay.amount, ctx.content.tuning.wallet), amount: pay.amount, reason: "gig" }
        : { type: "money/add", currency: pay.currency, pocket: "bank", amount: pay.amount, reason: "salary" };
    ctx.apply([effect], cause);
  }
  const events = record(ctx, { type: "activity/side-worked", side, pay, tenure: (ctx.state.activity.tenure[side] ?? 0) + 1 });
  ctx.apply(entry.effects, cause);
  lockForSide(ctx, side);
  events.push(...oneChance(ctx, side));
  return events;
}

function main(ctx: Ctx): BaseEvent[] {
  licenceOnArrival(ctx);
  return [...followStatus(ctx), ...dropUnfit(ctx), ...review(ctx), ...workJob(ctx), ...workSide(ctx)];
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/**
 * activity:capital-opens-own-work: an act that starts a side job of its own needs the side slot free, since one side job is held at a
 * time (activity:side-job-holds-a-slot) and the capital is never given back.
 */
function sideSlotTaken(read: ReadCtx, entry: ActivityEntry): boolean {
  if (read.state.activity.side === null) return false;
  return entry.effects.some((effect) => effect.type === "activity/start-job" && typeof effect.job === "string" && read.content.activity[effect.job]?.slot === "side");
}

/**
 * place:entries-legal-by-where, ladders:activities-filtered-by-where and ladders:car-bonus-needs-car: the place, the car and the requirements.
 * activity:paid-tech-courses: a path held was judged at its start and goes on; one tech study at a time; the bootcamp once a life.
 */
function requirementsHold(read: ReadCtx, entry: ActivityEntry, judge: Judge): boolean {
  const judged = holdsCourse(read.state, entry) || allHold(entry.requires, judge);
  return appliesHere(entry, read.state) && carHolds(read, entry) && judged && !sideSlotTaken(read, entry) && !onCourse(read.state, entry) && !bootcampTaken(read.state, entry);
}

/**
 * activity:waiting-months-build-profile: an act sat as a set piece (the talk, the exam) needs the stage to itself. With a
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
  if (withCost && !canPayPrices(pricesOf(read, entry, pick.param), judge, read.state.wallet)) return "cost";
  return null;
}

/** wallet:top-ups-are-marked: the money held would pay, and only the marked, topped-up share is short, so the kiosk says tickets come from money earned. */
function earnedShort(ctx: Ctx, entry: ActivityEntry, pick: SlotPick): boolean {
  const prices = pricesOf(readOf(ctx), entry, pick.param);
  return canPayAll(prices, judgeOf(ctx)) && !earnedCovers(prices, ctx.state.wallet);
}

function isPick(value: unknown): value is SlotPick {
  if (typeof value !== "object" || value === null) return false;
  const { activity, param } = value as Record<string, unknown>;
  return typeof activity === "string" && (param === null || typeof param === "string");
}

/** Checks every slot of `turn/end` before anything happens (activity:illegal-slot-rejects-turn). Never returns events. */
function validateSlots(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "turn/end") throw new Error(`The activity kind cannot validate ${command.type}.`);
  const slots: unknown[] = Array.isArray(command.slots) ? command.slots : [];
  for (const [index, pick] of slots.entries()) {
    const where = `Slot ${String(index + 1)}`;
    if (!isPick(pick)) return reject("not-legal", `${where} is not an activity and a param.`);
    const entry = ctx.content.activity[pick.activity];
    if (entry?.slot !== "free" && entry?.slot !== "none") return reject("not-legal", `${where}: ${pick.activity} is not a free-slot activity.`);
    // activity:now-acts-and-month-acts: a now-act fills no slot; it is sent at once as `activity/now`. An act that repeats (activity:acts-may-repeat-in-month) may
    // also stand as a commitment in a slot, resolved as the month turns, so a recorded life that planned it still plays.
    if (answersNow(entry) && entry.repeat !== true) return reject("not-legal", `${where}: ${entry.id} answers now. It is sent as activity/now and fills no slot.`);
    // Cost is not checked here: a slot that cannot be paid fails when it resolves (activity:slots-resolve-in-order).
    const problem = slotProblem(ctx, entry, pick, false);
    if (problem === "requirements") return reject("not-legal", `${where}: ${entry.id} cannot be done here and now.`);
    if (problem === "param") return reject("not-legal", `${where}: ${String(pick.param)} is not a param ${entry.id} may take now.`);
  }
  return [];
}

/** Overtime: a quarter more of the month's pay, to cash for cash work and the bank otherwise, untaxed (ladders.md). */
function overtime(ctx: Ctx, cause: Cause): BaseEvent[] {
  const job = ctx.state.activity.job;
  if (job === null) return [];
  const entry = jobEntry(ctx.content, job);
  const pay = overtimePay(readOf(ctx), entry);
  if (pay === null || pay.amount === 0) return [];
  ctx.apply([payEffect(entry, pay, ctx.content)], cause);
  return record(ctx, { type: "activity/overtime-paid", job, pay });
}

/** car:licence-and-driving-test: 5500 plus 500 for each earlier attempt, capped, on stream `status`. A pass grants the UK licence. */
export function passChanceBp(attempts: number, car: Tuning["car"]): number {
  return Math.min(car.passCapBp, car.passBp + car.passPerAttemptBp * attempts);
}

function drivingTest(ctx: Ctx, cause: Cause): BaseEvent[] {
  const earlier = drivingAttempts(ctx.state);
  const passed = ctx.random.chance("status", passChanceBp(earlier, ctx.content.tuning.car));
  const events = record(ctx, { type: "activity/driving-test", attempt: earlier + 1, passed });
  if (passed) ctx.apply([{ type: "document/grant", document: DOCUMENT.ukLicence }], cause);
  return events;
}

/** luck:kiosk-sells-lotto-tickets: each ticket drawn on stream `lotto`; winnings as `win`, never flagged, to the pocket their size takes (wallet:money-lands-as-in-lagos). */
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
  if (won > 0) ctx.apply([{ type: "money/add", currency: "NGN", pocket: pocketFor(won, ctx.content.tuning.wallet), amount: won, reason: "win" }], cause);
  return events;
}

/** luck:bet-slip-stake-and-odds: the stake on stream `lotto`; a win pays `betOddsBp` of it, to the pocket its size takes (wallet:money-lands-as-in-lagos). */
function betSlip(ctx: Ctx, cause: Cause): BaseEvent[] {
  const { stake, betWinBp, betOddsBp, betWellbeing } = ctx.content.tuning.luck;
  const win = ctx.random.chance("lotto", betWinBp);
  const won = win ? bp(stake, betOddsBp) : 0;
  const events = record(ctx, { type: "activity/bet-placed", stake: { currency: "NGN", amount: stake }, won: { currency: "NGN", amount: won } });
  if (won > 0) ctx.apply([{ type: "money/add", currency: "NGN", pocket: pocketFor(won, ctx.content.tuning.wallet), amount: won, reason: "win" }], cause);
  if (ctx.content.quality[QUALITY.wellbeing] !== undefined) ctx.apply([{ type: "quality/add", quality: QUALITY.wellbeing, amount: win ? betWellbeing : -betWellbeing }], cause);
  return events;
}

/** advice:someone-who-went-answers-free: someone who went tells the checklist as it stood when they left. Their look-into is the entry's effect. */
function friendTells(ctx: Ctx, pick: SlotPick): BaseEvent[] {
  const route = pick.param as Id<"route"> | null;
  if (route === null || ctx.content.route[route] === undefined) return [];
  return record(ctx, { type: "activity/word-of-mouth", route, ...friendWord(readOf(ctx), route) });
}

/** advice:licensed-adviser-is-truthful: the adviser reads every route heard or known, then looks into every one only heard. */
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
 * activity:waiting-months-build-profile: one draw on `job` at `tuning.activity.raiseChanceBp`; a landed draw raises the held
 * job's pay by `raiseBp`, once for each job. The page names no stream, and the raise is the
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
 * activity:waiting-months-build-profile: the raise from being noticed, for the Jobs app. The held job's pay a
 * month with the raise and the month it landed; nothing while the job held has no raise or no pay of its own.
 */
function raiseView(read: ReadCtx): { raise?: { pay: MoneyParam; month: number | null } } {
  const job = read.state.activity.job;
  if (job === null || !raisedJob(read.state, job)) return {};
  const pay = monthlyPay(read, jobEntry(read.content, job));
  return pay === null ? {} : { raise: { pay, month: read.state.activity.raisedIn?.[job] ?? null } };
}

/** Why the flight ends a job: the move abroad (place:entries-legal-by-where). */
const MOVED = "moved";

/**
 * activity:waiting-months-build-profile: a course at home in progress ends with the flight. A course is an
 * activity whose months open fees; it is in progress once those fees are open and before its last month. Its
 * fees close by their type, so nothing of it is charged after. The flight ends the main job and the side job
 * in turn, so this is reached twice; the second time the fees are gone and nothing is told again.
 */
function endCourses(ctx: Ctx, cause: Cause): BaseEvent[] {
  const events: BaseEvent[] = [];
  // activity:paid-tech-courses: a tech study path held ends with the flight as the master's does, its fees closed with it.
  const study = ctx.state.activity.study;
  if (study !== undefined) {
    events.push(...record(ctx, { type: "activity/course-ended", activity: study.activity }));
    const fees = (ctx.content.activity[study.activity]?.onMonth ?? []).flatMap((step) => step.effects).flatMap((effect) => (effect.type === "obligation/open" ? [effect.obligation] : []));
    for (const id of fees) {
      const owed = ctx.content.obligation[id];
      if (owed !== undefined && Object.values(ctx.state.obligation.items).some((item) => item.entry === id)) ctx.apply([{ type: "obligation/close", obligationType: owed.type }], cause);
    }
  }
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
 * activity:waiting-months-build-profile: the effects tied to the months an activity has filled a slot, this month counted. The
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
 * activity:waiting-months-build-profile: the effect `activity/exam`, given with the quiz's last answer. The answers given in the
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

/** activity:now-acts-and-month-acts: the month the paper the act just asked for is due, so the place can say how long; null for an act that asks for none. */
function paperDue(ctx: Ctx, entry: ActivityEntry): number | null {
  for (const effect of entry.effects) {
    if (effect.type !== "document/request") continue;
    const due = ctx.state.document[effect.document]?.readyMonth ?? null;
    if (due !== null) return due;
  }
  return null;
}

/**
 * `activity/now` (activity:now-acts-and-month-acts): a now-act at once, with a slot's own checks, cost, effects and
 * lines (activity:slots-resolve-in-order, activity:costs-paid-bank-or-cash), then the place's answer. The kiosk's draw, the match and a hunt's
 * answer wait for the month. A now-act that is not a purchase runs once a month.
 */
function actNow(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "activity/now") throw new Error(`activity/now cannot handle ${command.type}.`);
  const pick = { activity: command.activity, param: command.param ?? null };
  if (!isPick(pick)) return reject("not-legal", "The act is not an activity and a param.");
  const plain = ctx.content.activity[pick.activity];
  if (plain === undefined) return reject("unknown-id", `${pick.activity} is not an activity in content.`);
  // The things owned that work change the act's time, price and lift.
  const entry = withThings(ctx, plain);
  if ((entry.slot !== "free" && entry.slot !== "none") || !answersNow(entry)) return reject("not-legal", `${entry.id} fills the month: it is a slot pick, not an act now.`);
  if (doneThisMonth(ctx.state, entry)) return reject("not-legal", `${entry.id} was done this month already. It runs once a month.`);
  // activity:spent-body-refuses-acts (decision 0011): an act that takes effort waits for sleep once the body is spent; what takes none is always open.
  if (bodySpent(ctx.state, ctx.content, entry)) return reject("not-legal", `${entry.id} takes effort, and you are spent. Sleep.`);
  // luck:kiosk-sells-lotto-tickets: the kiosk sells at most `maxTickets` a month across visits; a ticket past it
  // is refused, and the kiosk says so in its own voice on the screen.
  if (entry.id === LOTTO) {
    const bought = nowThisMonth(ctx.state).filter((done) => done.activity === LOTTO).reduce((sum, done) => sum + Number(done.param ?? 0), 0);
    const cap = ctx.content.tuning.luck.maxTickets;
    if (bought + Number(pick.param ?? 0) > cap) return reject("not-legal", `The kiosk sells ${String(cap)} tickets a month, and ${String(bought)} are bought.`);
  }
  // activity:study-days-capped: a fourth day of class in a month is refused.
  if (classCapped(ctx.state, ctx.content, entry, 0)) return reject("not-legal", `${entry.id} has run its days this month.`);
  const problem = slotProblem(ctx, entry, pick, true);
  if (problem === "requirements") return reject("not-legal", `${entry.id} cannot be done here and now.`);
  if (problem === "param") return reject("not-legal", `${String(pick.param)} is not a param ${entry.id} may take now.`);
  if (problem === "cost") return reject("cannot-afford", earnedShort(ctx, entry, pick) ? EARNED_ONLY : `${entry.id} cannot be paid now.`);
  const events = record(ctx, { type: "activity/now-played", activity: entry.id, param: pick.param, ...(entry.repeat === true ? { counted: true as const } : {}) });
  const cause: Cause = { source: entry.id, param: pick.param, terms: {} };
  payPrices(ctx, pricesOf(readOf(ctx), entry, pick.param), cause);
  // activity:now-acts-spend-half-days (decision 0011): the act spends its time of the month, a morning without a figure; a purchase spends none.
  if (entry.purchase !== true) ctx.apply([{ type: "turn/spend-days", halfDays: entry.halfDays ?? 1 }], cause);
  if (!DRAWN_LATER.includes(entry.id)) events.push(...runById(ctx, entry, pick, cause));
  ctx.apply(
    entry.effects.filter((effect) => !LATER_EFFECTS.includes(effect.type)),
    cause,
  );
  milestones(ctx, entry, cause);
  events.push(...learn(ctx, entry, cause, classDaysNow(ctx.state)));
  events.push(...record(ctx, { type: "activity/now-said", activity: entry.id, param: pick.param, ready: paperDue(ctx, entry) }));
  return events;
}

/** activity:now-acts-and-month-acts: what the month's now-acts left to the month, first sent first: the kiosk's draw, the match, the employer's answer. */
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

/** activity:now-acts-and-month-acts: as the month closes, its now-acts are done with. */
function closeMonth(ctx: Ctx): BaseEvent[] {
  return nowThisMonth(ctx.state).length === 0 ? [] : record(ctx, { type: "activity/now-cleared" });
}

function addTech(ctx: Ctx, amount: number, cause: Cause): void {
  if (amount > 0) ctx.apply([{ type: "quality/add", quality: TECH, amount }], cause);
}

/**
 * quality:skill-bands-slow-gains: what a tech study gives as it is done, by the band the character is in: the day's class its day's share
 * (activity:study-days-capped), the free path its month and streak (activity:free-path-keeps-a-streak), a path its month (activity:paid-tech-courses),
 * and the apprenticeship its month (streets:apprentice-learns-repair). `day` is the day of class this month, counted with this one.
 */
function learn(ctx: Ctx, entry: ActivityEntry, cause: Cause, day: number): BaseEvent[] {
  if (entry.bandGains === undefined) return [];
  if (entry.course !== undefined) return courseMonth(ctx, entry, entry.course, cause);
  if (entry.id === FREE_PATH) return freeMonth(ctx, entry, cause);
  const read = readOf(ctx);
  addTech(ctx, entry.id === LEARN_TECH ? dayGain(read, entry, day) : bandGain(read, entry), cause);
  return [];
}

/** activity:free-path-keeps-a-streak: the month's gain by band, a month more in the streak, and each fifth month in a row a certificate. */
function freeMonth(ctx: Ctx, entry: ActivityEntry, cause: Cause): BaseEvent[] {
  addTech(ctx, bandGain(readOf(ctx), entry), cause);
  const months = (ctx.state.activity.streak ?? 0) + 1;
  const events = record(ctx, { type: "activity/streak", months });
  if (months % ctx.content.tuning.activity.freeStreakMonths !== 0) return events;
  events.push(...record(ctx, { type: "activity/certificate" }));
  addTech(ctx, certificateTech(readOf(ctx)), cause);
  ctx.apply([{ type: "quality/add", quality: PORTFOLIO, amount: 1 }], cause);
  return events;
}

/**
 * activity:paid-tech-courses: a month of the path. Its first month starts it (the bootcamp ends the job held, as a new job does); a month
 * behind on its fees gives nothing and does not count; the last month gives its closing gains, and the bootcamp leaves its fee owed
 * (activity:bootcamp-paid-after-a-job).
 */
function courseMonth(ctx: Ctx, entry: ActivityEntry, course: NonNullable<ActivityEntry["course"]>, cause: Cause): BaseEvent[] {
  const held = ctx.state.activity.study;
  const months = held?.activity === entry.id ? held.months : 0;
  const events = months === 0 && entry.id === BOOTCAMP ? endJob(ctx, "bootcamp") : [];
  if (behindOnFees(readOf(ctx), entry)) return [...events, ...record(ctx, { type: "activity/course-month", activity: entry.id, months })];
  addTech(ctx, bandGain(readOf(ctx), entry), cause);
  if (months + 1 < course.months) return [...events, ...record(ctx, { type: "activity/course-month", activity: entry.id, months: months + 1 })];
  events.push(...record(ctx, { type: "activity/course-finished", activity: entry.id }));
  ctx.apply(course.effects, cause);
  if (entry.id === BOOTCAMP) events.push(...record(ctx, { type: "activity/bootcamp-done", owed: ctx.content.tuning.activity.bootcampFee, month: ctx.state.turn.month }));
  return events;
}

/** activity:study-days-capped: the days of class the month's slots have run so far, beside the ones taken now. */
interface ClassDays {
  slots: number;
}

/** activity:study-days-capped: the day's class has run its days this month, counting the now-acts and the slots' days together. */
function classCapped(state: State, content: Content, entry: Pick<ActivityEntry, "id">, slotDays: number): boolean {
  return entry.id === LEARN_TECH && classDaysNow(state) + slotDays >= content.tuning.turn.studyDaysCap;
}

/** One slot (activity:slots-resolve-in-order, activity:costs-paid-bank-or-cash): checked again, paid, then its effects. A failure pays nothing. */
function resolveSlot(ctx: Ctx, pick: SlotPick, slot: number, days: ClassDays = { slots: 0 }): BaseEvent[] {
  const plain = ctx.content.activity[pick.activity];
  if (plain === undefined) throw new Error(`The slot names ${pick.activity}, which the turn check let through.`);
  const entry = withThings(ctx, plain);
  // activity:waiting-months-build-profile: an act done once a month at most; a second pick of it fails as a slot, with nothing paid.
  const again = entry.once === true && turnSlots(ctx).slice(0, slot).some((earlier) => earlier.activity === entry.id);
  const why = again || classCapped(ctx.state, ctx.content, entry, days.slots) ? "requirements" : slotProblem(ctx, entry, pick, true);
  if (why !== null) {
    return record(ctx, { type: "activity/slot-failed", slot, activity: entry.id, param: pick.param, why });
  }
  const events = record(ctx, { type: "activity/slot-played", slot, activity: entry.id, param: pick.param });
  const cause: Cause = { source: entry.id, param: pick.param, terms: {} };
  const pieces = ctx.state.quality[QUALITY.portfolio] ?? 0;
  // activity:acts-may-repeat-in-month: an act that repeats, kept as a commitment in a slot, is a month's worth of it: `repeatPerSlot` times,
  // each paid, stopping when one can no longer be paid.
  const times = entry.repeat === true ? ctx.content.tuning.turn.repeatPerSlot : 1;
  for (let time = 0; time < times; time += 1) {
    if (time > 0 && (slotProblem(ctx, entry, pick, true) !== null || classCapped(ctx.state, ctx.content, entry, days.slots))) break;
    payPrices(ctx, pricesOf(readOf(ctx), entry, pick.param), cause);
    events.push(...runById(ctx, entry, pick, cause));
    ctx.apply(entry.effects, cause);
    milestones(ctx, entry, cause);
    if (entry.id === LEARN_TECH) days.slots += 1;
    events.push(...learn(ctx, entry, cause, classDaysNow(ctx.state) + days.slots));
  }
  events.push(...outcome(ctx, entry, pieces));
  return events;
}

/**
 * activity:waiting-months-build-profile, world:month-end-results-sheet: a month of open source that added no piece is told all the same, its first
 * merge or a quiet month of fixes. A piece added is told by the portfolio's own line.
 */
function outcome(ctx: Ctx, entry: ActivityEntry, before: number): BaseEvent[] {
  if (entry.id !== OPEN_SOURCE || (ctx.state.quality[QUALITY.portfolio] ?? 0) > before) return [];
  return record(ctx, { type: "activity/contributed", first: (ctx.state.activity.played[OPEN_SOURCE] ?? 0) === 0 });
}

/**
 * The free slots, first slot first. Then each slot left empty counts as rest
 * (turn:free-slots-per-month), and the slots sent are kept for "same again" (activity:last-month-plan-kept).
 */
function slots(ctx: Ctx): BaseEvent[] {
  const picks = turnSlots(ctx);
  const events: BaseEvent[] = answerNowActs(ctx);
  const days: ClassDays = { slots: 0 };
  picks.forEach((pick, index) => events.push(...resolveSlot(ctx, pick, index, days)));
  // activity:free-path-keeps-a-streak: a month without the free path sets its streak to nothing.
  if ((ctx.state.activity.streak ?? 0) > 0 && !events.some((event) => event.type === "activity/streak")) events.push(...record(ctx, { type: "activity/streak", months: 0 }));
  // The count is the one the player saw at the turn check, carried by the
  // engine, not the count after the job's toll in `main`.
  const turn = turnInProgress(ctx);
  const allowed = turn === null ? freeSlots(ctx.state, ctx.content) : turn.freeSlots;
  const counted = picks.filter((pick) => fillsSlot(ctx.content, pick.activity)).length;
  const empty = Math.max(0, allowed - counted);
  if (empty > 0) {
    events.push(...record(ctx, { type: "activity/rested", slots: empty }));
    if (ctx.content.quality[QUALITY.wellbeing] !== undefined) {
      const amount = empty * ctx.content.tuning.quality.wellbeingRest;
      ctx.apply([{ type: "quality/add", quality: QUALITY.wellbeing, amount }], { source: REST_SOURCE, param: null, terms: {} });
    }
  }
  events.push(...record(ctx, { type: "activity/slots-recorded", slots: picks.map((pick) => ({ ...pick })) }));
  // The picks are the month's `lastSlots` now; a now-act done this month is counted with them, once (activity:now-acts-and-month-acts).
  const filled = playedThisMonth(ctx.state, ctx.content);
  if (filled.size > 0) events.push(...record(ctx, { type: "activity/played-counted", activities: [...filled] }));
  return events;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** The naira the life owes a month: every open obligation charged in naira (upkeep, rent, support, a loan's instalment). */
function nairaDues(read: ReadCtx): number {
  return Object.values(read.state.obligation.items).reduce((sum, item) => {
    const entry = read.content.obligation[item.entry];
    return entry !== undefined && entry.currency === "NGN" && item.state !== "defaulted" ? sum + item.amount : sum;
  }, 0);
}

/**
 * guide:early-win-in-three-turns: the job a life's first hunt lands, in its first
 * three months, when the draw misses. `month` is the month being played. Null
 * when the hunt is not that one: a month past the third, a month before with a hunt in it, or a hunt earlier in
 * this month. The job is the lowest month's pay, valued in naira at the
 * official rate, of the jobs that may be hunted now in the same slot as the
 * one named, among those whose pay covers the naira the life owes a month (a
 * smaller job must still pay the month, or it traps the life under its dues), else of them all; then by id;
 * the named job when none reads a pay.
 */
export function sureHuntJob(read: ReadCtx, named: ActivityEntry, month: number, huntedThisMonth: boolean): ActivityEntry | null {
  if (huntedThisMonth || month > SURE_HUNT_MONTHS) return null;
  const hunts = Object.values(read.content.activity).filter((entry) => entry.effects.some((effect) => effect.type === "activity/hunt"));
  if (hunts.some((entry) => (read.state.activity.played[entry.id] ?? 0) > 0)) return null;
  const rates = officialRates(read.world);
  const dues = nairaDues(read);
  let best: { entry: ActivityEntry; kobo: number } | null = null;
  let covering: { entry: ActivityEntry; kobo: number } | null = null;
  for (const id of huntableJobs(read, (requirement) => check(read, requirement))) {
    const entry = jobEntry(read.content, id);
    const pay = entry.slot === named.slot ? monthlyPay(read, entry) : null;
    if (pay === null) continue;
    const kobo = valueInKobo(pay.amount, pay.currency, rates);
    if (best === null || kobo < best.kobo || (kobo === best.kobo && entry.id < best.entry.id)) best = { entry, kobo };
    if (named.slot === "main" && kobo >= dues && (covering === null || kobo < covering.kobo || (kobo === covering.kobo && entry.id < covering.entry.id))) covering = { entry, kobo };
  }
  return covering?.entry ?? best?.entry ?? named;
}

/** True while this life's next hunt is its sure first one (guide:early-win-in-three-turns): the first three months, no hunt before, none earlier this month. */
function firstHuntSure(read: ReadCtx): boolean {
  const named = Object.values(read.content.activity).find((entry) => isJob(entry) && entry.hireBp !== null);
  return named !== undefined && sureHuntJob(read, named, read.state.turn.month + 1, huntedThisMonth(read.state)) !== null;
}

/** A hunt earlier this month landed: its offer opened this month (every first hunt lands, so a miss cannot be earlier in a sure month). */
function huntedThisMonth(state: State): boolean {
  return Object.values(state.offer.items).some((item) => item.entry === JOB_OFFER && item.openedMonth === state.turn.month);
}

/**
 * One month of hunting the job the slot names (activity:job-hunt-lands-offer). A landed hunt opens the job offer with the job in its terms.
 * guide:early-win-in-three-turns: a starting life's first hunt in its first three months lands for sure: the draw is made as ever, and when it
 * misses, the sure hunt lands the lowest-paid job the life may hunt in the slot (the named one when none reads a pay).
 * activity:job-hunt-lands-offer: when that is another job, the named one is told as missed before it.
 */
function huntEffect(ctx: Ctx, _effect: unknown, cause: Cause): BaseEvent[] {
  if (cause.param === null) throw new Error(`A hunt from ${cause.source} names no job.`);
  const entry = jobEntry(ctx.content, cause.param);
  const read = readOf(ctx);
  const drawn = ctx.random.chance("job", huntChanceBp(read, entry));
  const landed = drawn ? entry : sureHuntJob(read, entry, ctx.state.turn.month + 1, huntedThisMonth(ctx.state));
  // A sure hunt that lands another job first says the job asked for came to nothing, so the
  // pick is never lost from the month's telling.
  const instead = landed !== null && landed.id !== entry.id ? record(ctx, { type: "activity/hunted", job: entry.id, hired: false }) : [];
  const events = [...instead, ...record(ctx, { type: "activity/hunted", job: landed?.id ?? entry.id, hired: landed !== null })];
  // Content without the job offer has nothing to open, so the landed hunt opens nothing.
  if (landed !== null && ctx.content.offer[JOB_OFFER] !== undefined) {
    ctx.apply([{ type: "offer/open", offer: JOB_OFFER }], { source: cause.source, param: landed.id, terms: { ...cause.terms, job: landed.id } });
  }
  return events;
}

/** A side gig (activity:side-gig-pays-a-draw): a draw between its figures plus its figure for each point of tech, in naira, to the pocket its size takes (wallet:money-lands-as-in-lagos). */
function gigEffect(ctx: Ctx, effect: { min: number; max: number; perTech: number }, cause: Cause): BaseEvent[] {
  const tech = ctx.state.quality[TECH] ?? 0;
  const amount = ctx.random.between("gig", effect.min, effect.max) + effect.perTech * tech;
  if (amount <= 0) return [];
  const events = record(ctx, { type: "activity/gig-paid", amount });
  ctx.apply([{ type: "money/add", currency: GIG_CURRENCY, pocket: pocketFor(amount, ctx.content.tuning.wallet), amount, reason: "gig" }], cause);
  return events;
}

/** `activity/quit` (activity:new-job-replaces-held), or with `side` the side job (activity:side-job-holds-a-slot). Nothing to leave is not legal. */
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

/**
 * Months added across the listed jobs. An empty list means every main job: a side job's months count only where a list names it
 * (activity:each-trade-climbs-its-ladder, night support toward remote support), and the driving test's attempts are not months.
 */
export function tenureAcross(state: State, content: Content, activities: readonly Id<"activity">[]): number {
  const counted = activities.length === 0 ? (Object.keys(state.activity.tenure) as Id<"activity">[]).filter((id) => content.activity[id]?.slot === "main") : activities;
  return counted.reduce((sum, id) => sum + (state.activity.tenure[id] ?? 0), 0);
}

/**
 * streets:sleeping-under-the-bridge: what filled a slot in the month just played, the way activity:months-played-counted counts it: the
 * job and the side job held, and every free slot sent. At the `come-up` phase the slots sent are this
 * month's, recorded at `slots`. A slot that failed still counts, as it does for activity:months-played-counted.
 */
function playedThisMonth(state: State, content: Content): Set<Id<"activity">> {
  const { job, side, lastSlots } = state.activity;
  // activity:now-acts-and-month-acts: the month's now-acts are kept until the month closes, after `come-up`; a repeat act was counted at once (activity:acts-may-repeat-in-month).
  const done = nowThisMonth(state).map((pick) => pick.activity).filter((id) => content.activity[id]?.repeat !== true);
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
      const have = tenureAcross(read.state, read.content, requirement.activities);
      return { met: have >= requirement.months, have, need: requirement.months };
    }
    case "activity/local-tenure": {
      const have = localTenure(read);
      return { met: have >= requirement.months, have, need: requirement.months };
    }
    case "activity/played":
      return { met: playedThisMonth(read.state, read.content).has(requirement.activity) };
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
    case "place/banned":
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
 * the place (ladders:activities-filtered-by-where). `allowed` needs the place, the requirements and,
 * where it takes one, a param to pick. The cost shown is the first param's.
 */
function activityOptions(read: ReadCtx): ActivityOption[] {
  const judge: Judge = (requirement) => check(read, requirement);
  const abroad = read.state.place.where === "abroad";
  return Object.values(read.content.activity)
    .filter((entry) => (entry.slot === "free" || entry.slot === "none") && (!abroad || appliesHere(entry, read.state)))
    .map((plain) => {
      const entry = withThings(read, plain);
      const params = paramsFor(read, entry, judge);
      const waiting = entry.param === "school" && params?.length === 0 ? schoolWait(read) : [];
      // activity:paid-tech-courses: a path held was judged at its start, so nothing is missing while it runs.
      const missing = holdsCourse(read.state, entry) ? [] : [...entry.requires.filter((requirement) => !judge(requirement).met), ...waiting];
      const capped = classCapped(read.state, read.content, entry, 0);
      const studying = onCourse(read.state, entry);
      const prices = pricesOf(read, entry, params?.[0] ?? null);
      const done = doneThisMonth(read.state, entry);
      // activity:spent-body-refuses-acts: a now-act that takes effort waits for sleep once the body is spent; what takes none stays open.
      const spent = answersNow(entry) && bodySpent(read.state, read.content, entry);
      const sure = entry.id === HUNT_ACTIVITY && firstHuntSure(read);
      return {
        id: entry.id,
        allowed: !done && !spent && !capped && missing.length === 0 && requirementsHold(read, entry, judge) && (params === null || params.length > 0),
        missing,
        params,
        cost: prices.map(({ currency, amount }) => ({ currency, amount })),
        affordable: canPayPrices(prices, judge, read.state.wallet),
        when: answersNow(entry) ? "now" : "month",
        done,
        ...(sure ? { sure: true as const } : {}),
        ...(spent ? { spent: true as const } : {}),
        ...(capped ? { capped: true as const } : {}),
        ...(studying ? { onCourse: true as const } : {}),
        // A thing owned changed the act's time.
        ...(entry.halfDays !== plain.halfDays && entry.halfDays !== undefined ? { halfDays: entry.halfDays } : {}),
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
 * (docs/rules/text.md "Money on screen", luck:big-wins-are-staged). The wallet credits the
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

/** share:cards-due-at-set-moments: the first-pay-abroad card through the month after the first pay abroad is told (luck:big-wins-are-staged). */
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
      // A jackpot or a mid prize is staged (luck:big-wins-are-staged).
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
        // The act rides with the line, so a talk is told as a talk and the exam as an exam.
        ? [line("line.activity.exam-passed", { right: event.right, asked: event.asked, activity: event.activity }, "good", true)]
        : [line("line.activity.exam-failed", { right: event.right, asked: event.asked, pass: event.pass, activity: event.activity }, "bad", true)];
    case "activity/contributed":
      return [line(event.first ? "line.activity.first-merged" : "line.activity.contributed", {}, event.first ? "good" : "plain")];
    case "activity/word-of-mouth":
      return friendLines(event);
    case "activity/advised":
      return event.routes.flatMap(adviserLines);
    case "activity/now-said":
      return [line(nowLineKey(event.activity), { ...pickParams(event.activity, event.param), ...(event.ready === null ? {} : { month: event.ready }) }, "plain")];
    case "activity/now-played":
      // The act itself, told with the month's other lines as a slot's is, and named before the money it spends. A repeat act
      // answers on the spot and is not listed at the month's end (activity:acts-may-repeat-in-month).
      return event.counted === true ? [] : [line("line.activity.played-now", pickParams(event.activity, event.param), "plain")];
    case "activity/now-cleared":
      return [];
    case "activity/reviewed":
      return [line("line.activity.reviewed", { job: event.job, amount: event.pay }, "good")];
    case "activity/certificate":
      return [line("line.activity.certificate", {}, "good")];
    case "activity/course-finished":
      return [line("line.activity.course-finished", { activity: event.activity }, "good")];
    case "activity/pay-held":
    case "activity/streak":
    case "activity/course-month":
    case "activity/bootcamp-done":
    case "activity/bootcamp-billed":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown activity event ${JSON.stringify(never)}.`);
    }
  }
}

/** activity:now-acts-and-month-acts: the place's answer to a now-act, `line.activity.<slug>.now`. */
function nowLineKey(activity: Id<"activity">): string {
  return `line.activity.${activity.slice("activity.".length)}.now`;
}

/** The checklist item's words, by the key the route's words use, as a param the interface names (`<key>.name`). */
function itemParam(route: Id<"route">, item: string): string {
  return `${route}.item.${item}`;
}

/**
 * advice:someone-who-went-answers-free: the friend's checklist, the out-of-date item said the same way
 * as the rest, and marked out of date only when the player meets it.
 */
function friendLines(event: Extract<ActivityEvent, { type: "activity/word-of-mouth" }>): ReportLine[] {
  const told = event.items.map((item) => line("line.activity.went-item", { item: itemParam(event.route, item) }, "plain"));
  const marked = event.wrong !== null && event.metWrong ? [line("line.activity.went-out-of-date", { item: itemParam(event.route, event.wrong) }, "plain", true)] : [];
  return [line("line.activity.went-told", { route: event.route }, "plain"), ...told, ...marked];
}

/** advice:licensed-adviser-is-truthful: fits or not, what is missing, and "at least N months". */
function adviserLines(reading: Extract<ActivityEvent, { type: "activity/advised" }>["routes"][number]): ReportLine[] {
  if (reading.fits) return [line("line.activity.adviser-fits", { route: reading.route }, "good")];
  return [
    line("line.activity.adviser-missing", { route: reading.route, count: reading.missing.length, months: reading.months }, "plain", true),
    ...reading.missing.map((item) => line("line.activity.adviser-item", { item: itemParam(reading.route, item) }, "plain")),
  ];
}

/** The slice with the optional fields named left out, so a life that never held them keeps its shape. */
function without(slice: ActivitySlice, keys: readonly (keyof ActivitySlice)[]): ActivitySlice {
  return Object.fromEntries(Object.entries(slice).filter(([key]) => !keys.includes(key as keyof ActivitySlice))) as unknown as ActivitySlice;
}

/** activity:naira-pay-reviewed-yearly: the slice without a job's pay on record. */
function withoutHeldPay(slice: ActivitySlice): ActivitySlice {
  return without(slice, ["pay", "reviewRate"]);
}

/** activity:paid-tech-courses: the slice with no path held. */
function withoutStudy(slice: ActivitySlice): ActivitySlice {
  return without(slice, ["study"]);
}

function evolve(slice: ActivitySlice, event: ActivityEvent): ActivitySlice {
  switch (event.type) {
    case "activity/job-started":
      // activity:naira-pay-reviewed-yearly: the pay held is the job's; a new job records its own.
      return { ...withoutHeldPay(slice), job: event.job };
    case "activity/job-ended":
      // Tenure stays: time served is kept when a job is left (activity:new-job-replaces-held).
      return { ...withoutHeldPay(slice), job: null };
    case "activity/pay-held":
      return { ...slice, pay: event.pay, reviewRate: event.rate };
    case "activity/reviewed":
      return { ...slice, pay: event.pay.amount, reviewRate: event.rate };
    case "activity/streak":
      return { ...slice, streak: event.months };
    case "activity/course-month":
      return { ...slice, study: { activity: event.activity, months: event.months } };
    case "activity/course-finished":
      return withoutStudy(slice);
    case "activity/bootcamp-done":
      return { ...slice, bootcampOwed: event.owed, bootcampDone: event.month };
    case "activity/bootcamp-billed":
      return without(slice, ["bootcampOwed"]);
    case "activity/month-worked":
      return { ...slice, tenure: { ...slice.tenure, [event.job]: event.tenure } };
    case "activity/side-worked":
      return { ...slice, tenure: { ...slice.tenure, [event.side]: event.tenure } };
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
      return {
        ...slice,
        now: [...(slice.now ?? []), { activity: event.activity, param: event.param }],
        // activity:acts-may-repeat-in-month: a repeat act counts as played each time, at once.
        ...(event.counted === true ? { played: { ...slice.played, [event.activity]: (slice.played[event.activity] ?? 0) + 1 } } : {}),
      };
    case "activity/now-cleared":
      return { ...slice, now: [] };
    case "activity/now-said":
    case "activity/pay-withheld":
    case "activity/sick-pay":
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
    case "activity/certificate":
      return slice;
    case "activity/course-ended":
      return slice.study?.activity === event.activity ? withoutStudy(slice) : slice;
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
    if (id !== DRIVING_TEST && !isJob(content.activity[id as Id<"activity">])) problems.push(`Tenure is kept for ${id}, which is not a job in content.`);
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
      // activity:side-job-holds-a-slot: `side` ends the side job and leaves the main job.
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
      // wallet:view-carries-month-pay: the month as the wallet will book it; the side job is paid from no route's terms (`workSide`).
      pay: read.state.activity.job === null ? null : bookedPay(read, jobEntry(read.content, read.state.activity.job)),
      sidePay: read.state.activity.side === null ? null : bookedPay(read, jobEntry(read.content, read.state.activity.side), {}),
      ...raiseView(read),
      ...reviewView(read),
    },
    activities: activityOptions(read),
    lastSlots: read.state.activity.lastSlots,
  }),
};
