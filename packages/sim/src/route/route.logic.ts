// Routes and schools: docs/rules/route.md, R-ROUTE-001 to 020. A school has no
// slice of its own: its applications live on the route (`RouteState.schools`),
// and its rules are carried out here.
import { heldBand, takesApplication } from "../activity/activity.logic";
import { check, worldVar } from "../engine/check";
import { BP_WHOLE, clamp, convertMinor, divFloor, mulDiv } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Cause,
  ChecklistItem,
  ChecklistItemView,
  Command,
  Content,
  Ctx,
  Currency,
  Effect,
  ForeignCurrency,
  Id,
  MoneyParam,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  RouteEntry,
  RouteSlice,
  RouteState,
  RouteStateName,
  RouteView,
  SchoolEntry,
  State,
  Tuning,
  VisaApplication,
} from "../engine/types";
import { routePercent } from "../japacity/japacity.logic";
import type { RefusalReason, RouteKindEvent } from "./route.events";

const GRADE: Id<"quality"> = "quality.edu-grade";
/** The university's confirmation, granted with the deposit and voided by a refusal. */
const CAS: Id<"document"> = "document.cas";
const LIVING_LINE: Id<"var"> = "var.uk-living-line";
const LIVING_MONTHS: Id<"var"> = "var.uk-living-months";
const STRICTNESS: Id<"var"> = "var.uk-study-strictness";
const SURCHARGE: Id<"var"> = "var.uk-surcharge";

/** Funds, tuition and deposits are counted in pence (R-ROUTE-009, 010). */
const FUNDS_CURRENCY: ForeignCurrency = "GBP";
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD"];

/** R-ROUTE-016 counts the unexplained share in whole percents. */
const BP_PER_PERCENT = 100;
/** R-ROUTE-003: how talk of a route reaches a character who has not heard by `hearBy`. */
export const FRIEND = "friend";

/** The arrows of the page's diagram (R-ROUTE-001). `refused` has none in this milestone. */
const ARROWS: Record<RouteStateName, readonly RouteStateName[]> = {
  unknown: ["heard"],
  heard: ["known"],
  known: ["applying"],
  applying: ["granted", "known"],
  granted: ["departed"],
  refused: [],
  departed: [],
};

export function unknownRoute(): RouteState {
  return {
    state: "unknown",
    heardMonth: null,
    knownMonth: null,
    schools: {},
    school: null,
    depositPaid: 0,
    support: null,
    funds: { heldMonths: 0, covered: false, shown: 0, required: 0 },
    visa: null,
    refusals: 0,
    lastRefusal: null,
    depositRefund: null,
    gate: null,
    secret: { sponsorFraud: null },
    bannedUntil: null,
  };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const readOf = (ctx: Ctx): ReadCtx => ({ state: ctx.state, world: ctx.world, content: ctx.content });

function entryOf(content: Content, id: Id<"route">): RouteEntry {
  const entry = content.route[id];
  if (entry === undefined) throw new Error(`The content has no route ${id}.`);
  return entry;
}

function routeOf(state: State, id: Id<"route">): RouteState {
  const held = state.route[id];
  if (held === undefined) throw new Error(`The state holds no route ${id}.`);
  return held;
}

function schoolOf(content: Content, id: Id<"school">): SchoolEntry {
  const school = content.school[id];
  if (school === undefined) throw new Error(`The content has no school ${id}.`);
  return school;
}

/**
 * A world variable the route reads by name. a route entry names only
 * its window, so the living line, living months, strictness and surcharge are
 * the UK's variables for every route. The engine's mini content has none of
 * them, so a missing one reads as 0 there; the real content has all four.
 */
function ukVar(read: ReadCtx, id: Id<"var">): number {
  return (read.world.vars as Record<string, number | undefined>)[id] ?? 0;
}

function grade(state: State): number {
  return state.quality[GRADE] ?? 0;
}

function officialRates(read: ReadCtx): Record<ForeignCurrency, number> {
  const official = {} as Record<ForeignCurrency, number>;
  for (const currency of Object.keys(read.world.rates) as ForeignCurrency[]) official[currency] = read.world.rates[currency].official;
  return official;
}

/** R-ROUTE-005: the route's window, from its world variable. 0 closed, 1 narrowing, 2 open. */
export function windowOf(read: ReadCtx, route: Id<"route">): RouteView["window"] {
  const window = entryOf(read.content, route).window;
  // A route with no window var (the road) is never closed by the world.
  if (window === null) return "open";
  const value = worldVar(read, window);
  if (value <= 0) return "closed";
  return value === 1 ? "narrowing" : "open";
}

/** R-ROUTE-007: the school's base chance plus the figure for each grade above its minimum, capped. */
export function offerChanceBp(school: SchoolEntry, grade: number, numbers: Tuning["route"]): number {
  return clamp(school.offerBp + numbers.offerPerGradeBp * (grade - school.minGrade), 0, numbers.offerMaxBp);
}

/** What one school's course comes to before living money: its tuition less the discount it gave. */
function courseOf(read: ReadCtx, held: RouteState, id: Id<"school">): number {
  return schoolOf(read.content, id).tuition - (held.schools[id]?.discount ?? 0);
}

function cheapest(read: ReadCtx, held: RouteState, schools: readonly Id<"school">[], discounted: boolean): number | null {
  let best: number | null = null;
  for (const id of schools) {
    const cost = discounted ? courseOf(read, held, id) : schoolOf(read.content, id).tuition;
    best = best === null ? cost : Math.min(best, cost);
  }
  return best;
}

/**
 * R-ROUTE-009, in pence: the school's tuition less its discount less the
 * deposit paid, plus the living line times the living months. Before a
 * deposit, the cheapest school holding an offer, after its discount, or else
 * the cheapest school on the route with no discount.
 */
export function fundsRequired(read: ReadCtx, route: Id<"route">): number {
  const held = routeOf(read.state, route);
  const entry = entryOf(read.content, route);
  const living = ukVar(read, LIVING_LINE) * ukVar(read, LIVING_MONTHS);
  let course: number;
  if (held.school !== null) course = courseOf(read, held, held.school) - held.depositPaid;
  else {
    const offers = entry.schools.filter((id) => held.schools[id]?.state === "offer");
    course = (offers.length > 0 ? cheapest(read, held, offers, true) : cheapest(read, held, entry.schools, false)) ?? 0;
  }
  return Math.max(0, course) + living;
}

/**
 * R-ROUTE-010, in pence: the bank and locked pockets of every currency and
 * any family support, at the official rate. Cash never counts. Each pocket
 * goes straight to pounds with `convertMinor`, rounded down once per pocket,
 * so naira is valued as kobo * 100 / the pound rate in one step.
 */
export function fundsShown(read: ReadCtx, route: Id<"route">): number {
  const rates = officialRates(read);
  let shown = 0;
  for (const currency of CURRENCIES) {
    const pocket = read.state.wallet.pockets[currency];
    shown += convertMinor(pocket.bank, currency, FUNDS_CURRENCY, rates) + convertMinor(pocket.locked, currency, FUNDS_CURRENCY, rates);
  }
  const support = routeOf(read.state, route).support;
  if (support !== null) shown += convertMinor(support.amount, support.currency, FUNDS_CURRENCY, rates);
  return shown;
}

/**
 * R-ROUTE-013: the wallet's lots at the official rate as a share of the funds
 * required, in basis points, never above 10000. Lots with nothing required
 * against them are wholly unexplained.
 */
export function unexplainedBp(read: ReadCtx, route: Id<"route">): number {
  const rates = officialRates(read);
  const lots = read.state.wallet.lots.reduce((sum, lot) => sum + convertMinor(lot.amount, lot.currency, FUNDS_CURRENCY, rates), 0);
  if (lots === 0) return 0;
  const required = fundsRequired(read, route);
  return required === 0 ? BP_WHOLE : Math.min(BP_WHOLE, mulDiv(lots, BP_WHOLE, required));
}

/** What the decision weighs (R-ROUTE-016). */
export interface VisaFile {
  strictness: number;
  unexplainedBp: number;
  refusals: number;
  interviewScore: number;
  grade: number;
}

/**
 * R-ROUTE-016: the route's own base, plus each point of strictness, plus each
 * whole percent of unexplained share, plus each earlier refusal, less each
 * interview point, less the good grade's figure, kept between the floor and
 * the ceiling.
 */
export function refusalChanceBp(numbers: Tuning["route"], baseBp: number, file: VisaFile): number {
  const raw =
    baseBp +
    numbers.refusalPerStrictnessBp * file.strictness +
    numbers.refusalPerUnexplainedBp * divFloor(file.unexplainedBp, BP_PER_PERCENT) +
    numbers.refusalPerRefusalBp * file.refusals -
    numbers.refusalPerInterviewPointBp * file.interviewScore -
    (file.grade >= numbers.goodGrade ? numbers.refusalGoodGradeBp : 0);
  return clamp(raw, numbers.refusalMinBp, numbers.refusalMaxBp);
}

/** R-ROUTE-019: most telling first, and `credibility` only when nothing else applies. */
export function refusalReasons(visa: VisaApplication, earlierRefusals: number, numbers: Tuning["route"]): RefusalReason[] {
  const reasons: RefusalReason[] = [];
  if (visa.unexplainedBp >= numbers.fundsReasonBp) reasons.push("funds");
  if ((visa.interviewScore ?? 0) < 0) reasons.push("interview");
  if (earlierRefusals > 0) reasons.push("history");
  return reasons.length > 0 ? reasons : ["credibility"];
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** Applies one of this kind's events at once, so the rest of the handler sees it. */
function record(ctx: Ctx, event: RouteKindEvent): BaseEvent[] {
  return emit(ctx, "route", [event]);
}

/** Types an event as this kind's own where a handler returns it. */
function own(event: RouteKindEvent): RouteKindEvent {
  return event;
}

function moved(route: Id<"route">, to: RouteStateName, via?: string): RouteKindEvent {
  return via === undefined ? { type: "route/moved", route, to } : { type: "route/moved", route, to, via };
}

function allHold(ctx: Ctx, requirements: readonly Requirement[]): boolean {
  return requirements.every((requirement) => ctx.check(requirement).met);
}

/**
 * R-ROUTE-002. Hearing is talk that comes up, not a school's draw, so a chance
 * to hear draws on `offer`. The draw comes first, and only for a route still
 * unknown.
 */
function hear(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "route/hear") throw new Error(`route/hear cannot carry out ${effect.type}.`);
  const entry = entryOf(ctx.content, effect.route);
  if (routeOf(ctx.state, effect.route).state !== "unknown") return [];
  if (effect.chanceBp !== undefined && !ctx.random.chance("offer", effect.chanceBp)) return [];
  if (!allHold(ctx, entry.hearIf)) return [];
  return [moved(entry.id, "heard", effect.via)];
}

/** R-ROUTE-004: the slot's param names the route. Only a heard route becomes known. */
function lookInto(ctx: Ctx, _effect: Effect, cause: Cause): BaseEvent[] {
  const route = cause.param as Id<"route"> | null;
  if (route === null || ctx.content.route[route] === undefined) return [];
  if (routeOf(ctx.state, route).state !== "heard") return [];
  return [moved(route, "known")];
}

/**
 * R-ROUTE-006, and R-ROUTE-005 for the window. The slot's param names the
 * school. The application is written at once, so a later slot of the same
 * month cannot apply there again. A school that refused takes a new one once
 * its wait has run, and the new application replaces the refusal.
 */
function applySchool(ctx: Ctx, _effect: Effect, cause: Cause): BaseEvent[] {
  const id = cause.param as Id<"school"> | null;
  const school = id === null ? undefined : ctx.content.school[id];
  if (id === null || school === undefined) return [];
  const read = readOf(ctx);
  const held = routeOf(ctx.state, school.route);
  if (held.state !== "known" || !entryOf(ctx.content, school.route).schools.includes(id)) return [];
  if (windowOf(read, school.route) === "closed") return [];
  if (!takesApplication(held.schools[id], ctx.state.turn.month, ctx.content.tuning.route)) return [];
  const band = heldBand(read);
  if (grade(ctx.state) < school.minGrade || band === null || band < school.minBand) return [];
  const wait = ctx.random.between("school", school.answerMonths[0], school.answerMonths[1]);
  return [own({ type: "route/school-applied", route: school.route, school: id, readyMonth: ctx.state.turn.month + wait })];
}

/**
 * The application's conditions, judged again (R-ROUTE-012). The slot that
 * carries this effect judged "covered now" a moment ago, before its fees were
 * taken. Paying the visa fee and the surcharge lowers the funds shown, so it
 * is not judged a second time here: the months held, judged at the last month
 * end, stand for it. Otherwise a file that was covered when the slot began
 * would lose its fees and send nothing.
 */
function conditionsHold(ctx: Ctx, held: RouteState, cause: Cause): boolean {
  const requires = ctx.content.activity[cause.source as Id<"activity">]?.requires ?? [];
  return requires.every((requirement) =>
    requirement.type === "route/funds" ? held.funds.heldMonths >= requirement.heldMonths : ctx.check(requirement).met,
  );
}

/** R-ROUTE-012, 013, 014, 015: send the application, record the day's figures, open the interview. */
function applyVisa(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "route/apply") throw new Error(`route/apply cannot carry out ${effect.type}.`);
  const { route } = effect;
  const entry = entryOf(ctx.content, route);
  const held = routeOf(ctx.state, route);
  const read = readOf(ctx);
  if (held.state !== "known" || held.school === null || held.funds.heldMonths < 1) return [];
  if (windowOf(read, route) === "closed" || !conditionsHold(ctx, held, cause)) return [];
  const month = ctx.state.turn.month;
  const visa: VisaApplication = {
    submittedMonth: month,
    decisionMonth: month + ctx.content.tuning.route.decisionMonths,
    rules: { livingLine: ukVar(read, LIVING_LINE), livingMonths: ukVar(read, LIVING_MONTHS), strictness: ukVar(read, STRICTNESS) },
    unexplainedBp: unexplainedBp(read, route),
    interviewScore: null,
    // What the activity paid for the surcharge, refunded on a refusal (R-ROUTE-018).
    surchargePaid: ukVar(read, SURCHARGE),
  };
  const events = record(ctx, { type: "route/applied", route, visa });
  // A gate with no interview (every gate but study) scores nothing and waits for the decision.
  if (entry.interview !== null) ctx.apply([{ type: "setpiece/open", setpiece: entry.interview, route }], cause);
  return events;
}

/** The family pledge: money in a parent's account that counts toward the route (R-ROUTE-010). */
function support(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "route/support") throw new Error(`route/support cannot carry out ${effect.type}.`);
  entryOf(ctx.content, effect.route);
  const amount = ctx.amount(effect.amount, cause.terms);
  if (amount < 0) throw new Error(`Support must not be negative, got ${String(amount)}.`);
  return [own({ type: "route/supported", route: effect.route, support: { currency: effect.currency, amount } })];
}

/** R-SETPIECE-004: the interview's score goes on the open application, and only there. */
function interviewScored(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "route/interview-scored") throw new Error(`route/interview-scored cannot carry out ${effect.type}.`);
  const held = routeOf(ctx.state, effect.route);
  if (held.state !== "applying" || held.visa === null) return [];
  return [own({ type: "route/interview-scored", route: effect.route, score: effect.score })];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** R-ROUTE-008. */
function payDeposit(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "route/pay-deposit") throw new Error(`route/pay-deposit cannot handle ${command.type}.`);
  const entry = ctx.content.route[command.route];
  const held = ctx.state.route[command.route];
  if (entry === undefined || held === undefined) return reject("unknown-id", `There is no route ${String(command.route)}.`);
  const school = ctx.content.school[command.school];
  if (school === undefined || !entry.schools.includes(command.school)) {
    return reject("unknown-id", `There is no school ${String(command.school)} on ${entry.id}.`);
  }
  if (held.schools[school.id]?.state !== "offer") return reject("not-legal", `There is no offer from ${school.id}.`);
  if (held.school !== null) return reject("not-legal", `A deposit is already paid on ${entry.id}, to ${held.school}.`);
  // R-ROUTE-005 does not apply: a deposit is paid to a school, not with a visa application.
  if (!ctx.check({ type: "money/can-pay", currency: FUNDS_CURRENCY, amount: school.deposit }).met) {
    return reject("cannot-afford", `The deposit of ${String(school.deposit)} pence cannot be paid.`);
  }
  const cause: Cause = { source: command.type, param: school.id, terms: {} };
  ctx.apply([{ type: "money/pay-fee", currency: FUNDS_CURRENCY, amount: school.deposit, reason: "fee-school" }], cause);
  const events = record(ctx, { type: "route/deposit-paid", route: entry.id, school: school.id, amount: school.deposit });
  ctx.apply([{ type: "document/grant", document: CAS }], cause);
  return events;
}

/** R-ROUTE-020. */
function depart(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "route/depart") throw new Error(`route/depart cannot handle ${command.type}.`);
  const held = ctx.state.route[command.route];
  if (ctx.content.route[command.route] === undefined || held === undefined) return reject("unknown-id", `There is no route ${String(command.route)}.`);
  if (held.state !== "granted") return reject("not-legal", "Only a granted route can be flown.");
  const holding = Object.values(ctx.state.obligation.items).some((item) => ctx.content.obligation[item.entry]?.type === "held-funds");
  if (holding) return reject("not-legal", "Held funds are still open. They must be returned before you fly.");
  const flight = ctx.content.tuning.route.flight;
  const amount = ctx.amount(flight.amount);
  if (!ctx.check({ type: "money/can-pay", currency: flight.currency, amount }).met) {
    return reject("cannot-afford", `The flight costs ${String(amount)} and cannot be paid.`);
  }
  const cause: Cause = { source: command.type, param: command.route, terms: {} };
  const pay: Effect =
    flight.currency === "NGN"
      ? { type: "money/take", currency: "NGN", pocket: "any", amount, reason: "flight" }
      : { type: "money/pay-fee", currency: flight.currency, amount, reason: "flight" };
  ctx.apply([pay], cause);
  const events = record(ctx, moved(command.route, "departed"));
  ctx.apply([{ type: "turn/finish" }], cause);
  return events;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/** R-ROUTE-003: by `hearBy`, anyone who meets `hearIf` has heard, through a friend. */
function hearPhase(ctx: Ctx): BaseEvent[] {
  const month = ctx.state.turn.month;
  const events: RouteKindEvent[] = [];
  for (const entry of Object.values(ctx.content.route)) {
    // A route with no `hearBy` is heard of only through an effect (R-ROUTE-003).
    if (entry.hearBy === null || routeOf(ctx.state, entry.id).state !== "unknown" || month < entry.hearBy) continue;
    if (allHold(ctx, entry.hearIf)) events.push(moved(entry.id, "heard", FRIEND));
  }
  return events;
}

/** R-ROUTE-018: a refund booked by a refusal lands in the pound bank pocket when its month comes. */
function refundArrives(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const due = routeOf(ctx.state, route).depositRefund;
  if (due === null || due.readyMonth > ctx.state.turn.month) return [];
  const events = record(ctx, { type: "route/deposit-refunded", route, amount: due.amount });
  ctx.apply([{ type: "money/add", currency: FUNDS_CURRENCY, pocket: "bank", amount: due.amount, reason: "refund" }], { source: route, param: null, terms: {} });
  return events;
}

/**
 * R-ROUTE-007, in the route's school order. One draw on `school` for the
 * offer, and one more for the merit discount only when an offer is made.
 */
function schoolsAnswer(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const events: BaseEvent[] = [];
  for (const id of entry.schools) {
    const application = routeOf(ctx.state, entry.id).schools[id];
    if (application?.state !== "pending" || application.readyMonth > ctx.state.turn.month) continue;
    const school = schoolOf(ctx.content, id);
    const have = grade(ctx.state);
    const offer = ctx.random.chance("school", offerChanceBp(school, have, ctx.content.tuning.route));
    let discount = 0;
    if (offer && school.autoDiscount !== null && have >= school.autoDiscount.minGrade) discount += school.autoDiscount.amount;
    if (offer && school.meritDiscount !== null && ctx.random.chance("school", school.meritDiscount.bp)) discount += school.meritDiscount.amount;
    events.push(...record(ctx, { type: "route/school-answered", route: entry.id, school: id, offer, discount }));
  }
  return events;
}

/**
 * R-ROUTE-011. "no visa application pending" is read as the route
 * being `known`: a route applying has one pending, and a granted or departed
 * route has nothing left to show funds for.
 */
function fundsCheck(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const held = routeOf(ctx.state, route);
  if (held.state !== "known" || held.school === null) return [];
  const read = readOf(ctx);
  const shown = fundsShown(read, route);
  const required = fundsRequired(read, route);
  const covered = shown >= required;
  const funds = { heldMonths: covered ? held.funds.heldMonths + 1 : 0, covered, shown, required };
  return record(ctx, { type: "route/funds-checked", route, funds, was: held.funds.covered });
}

/** R-ROUTE-016 to 019: one draw on `visa`, from the figures recorded on the day of submission. */
function decide(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const held = routeOf(ctx.state, route);
  const month = ctx.state.turn.month;
  if (held.state !== "applying" || held.visa === null || held.visa.decisionMonth > month) return [];
  const { visa } = held;
  const numbers = ctx.content.tuning.route;
  const chance = refusalChanceBp(numbers, entryOf(ctx.content, route).refusalBaseBp, {
    strictness: visa.rules.strictness,
    unexplainedBp: visa.unexplainedBp,
    refusals: held.refusals,
    interviewScore: visa.interviewScore ?? 0,
    grade: grade(ctx.state),
  });
  if (!ctx.random.chance("visa", chance)) return record(ctx, moved(route, "granted"));
  const back = Math.max(0, held.depositPaid - numbers.depositAdminFee);
  // A refund still on its way is kept, not lost, should a second refusal come first.
  const owed = back + (held.depositRefund?.amount ?? 0);
  const refused: RouteKindEvent = {
    type: "route/refused",
    route,
    month,
    reasons: refusalReasons(visa, held.refusals, numbers),
    depositRefund: owed === 0 ? null : { amount: owed, readyMonth: month + numbers.depositRefundMonths },
  };
  const events = record(ctx, refused);
  const cause: Cause = { source: route, param: null, terms: {} };
  ctx.apply([{ type: "money/add", currency: FUNDS_CURRENCY, pocket: "bank", amount: held.visa.surchargePaid, reason: "refund" }], cause);
  ctx.apply([{ type: "document/void", document: CAS }], cause);
  return events;
}

/** R-ROUTE-007, 011, 016 and the refund of 018, route by route in content order. */
function clocks(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  for (const entry of Object.values(ctx.content.route)) {
    events.push(...refundArrives(ctx, entry.id));
    events.push(...schoolsAnswer(ctx, entry));
    events.push(...fundsCheck(ctx, entry.id));
    events.push(...decide(ctx, entry.id));
  }
  return events;
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

function judge(read: ReadCtx, requirement: Requirement): RequirementResult {
  switch (requirement.type) {
    case "route/state":
      return { met: requirement.in.includes(routeOf(read.state, requirement.route).state) };
    case "route/offer":
      return { met: Object.values(routeOf(read.state, requirement.route).schools).some((application) => application.state === "offer") };
    case "route/deposit":
      return { met: routeOf(read.state, requirement.route).school !== null };
    case "route/funds": {
      // `have` and `need` are the funds now, so the checklist's slow item fills as they grow.
      const have = fundsShown(read, requirement.route);
      const need = fundsRequired(read, requirement.route);
      const held = routeOf(read.state, requirement.route).funds.heldMonths;
      return { met: have >= need && held >= requirement.heldMonths, have, need };
    }
    case "route/unexplained-max": {
      const have = unexplainedBp(read, requirement.route);
      return { met: have <= requirement.bp, have, need: requirement.bp };
    }
    case "quality/min":
    case "quality/max":
    case "job/any":
    case "job/none":
    case "job/is":
    case "activity/tenure":
    case "document/held":
    case "document/absent":
    case "document/pending":
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
    case "activity/local-tenure":
    case "setpiece/answered":
    case "wallet/total":
    case "place/returned":
    case "place/months-here":
    case "not":
    case "any":
      throw new Error(`The route kind does not judge ${requirement.type}.`);
    case "route/gate-step":
      // Built with the gates (docs/rules/route-gates.md). Until then no step is reached.
      return { met: false };
    default: {
      const never: never = requirement;
      throw new Error(`Unknown requirement ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Evolve
// ---------------------------------------------------------------------------

function withRoute(slice: RouteSlice, id: Id<"route">, change: (held: RouteState) => RouteState): RouteSlice {
  const held = slice[id];
  if (held === undefined) throw new Error(`The state holds no route ${id}.`);
  return { ...slice, [id]: change(held) };
}

/** R-ROUTE-001: an arrow that is not on the page is a bug, never a quiet change. */
function arrow(held: RouteState, to: RouteStateName, route: Id<"route">): RouteStateName {
  if (!ARROWS[held.state].includes(to)) throw new Error(`${route} cannot move from ${held.state} to ${to}.`);
  return to;
}

function evolve(slice: RouteSlice, event: RouteKindEvent, state: State): RouteSlice {
  const month = state.turn.month;
  switch (event.type) {
    case "route/moved":
      return withRoute(slice, event.route, (held) => {
        const to = arrow(held, event.to, event.route);
        if (to === "heard") return { ...held, state: to, heardMonth: month };
        if (to === "known") return { ...held, state: to, knownMonth: month };
        return { ...held, state: to };
      });
    case "route/school-applied":
      return withRoute(slice, event.route, (held) => ({
        ...held,
        schools: { ...held.schools, [event.school]: { state: "pending", readyMonth: event.readyMonth, discount: 0 } },
      }));
    case "route/school-answered":
      return withRoute(slice, event.route, (held) => {
        const application = held.schools[event.school];
        if (application === undefined) throw new Error(`${event.school} answered an application that was never sent.`);
        const answered = { ...application, state: event.offer ? ("offer" as const) : ("rejected" as const), discount: event.discount };
        return { ...held, schools: { ...held.schools, [event.school]: answered } };
      });
    case "route/deposit-paid":
      return withRoute(slice, event.route, (held) => ({ ...held, school: event.school, depositPaid: event.amount }));
    case "route/funds-checked":
      return withRoute(slice, event.route, (held) => ({ ...held, funds: event.funds }));
    case "route/applied":
      return withRoute(slice, event.route, (held) => ({ ...held, state: arrow(held, "applying", event.route), visa: event.visa }));
    case "route/interview-scored":
      return withRoute(slice, event.route, (held) => {
        if (held.visa === null) throw new Error(`${event.route} has no application to score.`);
        return { ...held, visa: { ...held.visa, interviewScore: event.score } };
      });
    case "route/refused":
      return withRoute(slice, event.route, (held) => ({
        ...held,
        state: arrow(held, "known", event.route),
        refusals: held.refusals + 1,
        lastRefusal: { month: event.month, reasons: event.reasons },
        school: null,
        depositPaid: 0,
        funds: { ...held.funds, heldMonths: 0 },
        visa: null,
        depositRefund: event.depositRefund,
      }));
    case "route/deposit-refunded":
      return withRoute(slice, event.route, (held) => ({ ...held, depositRefund: null }));
    case "route/supported":
      return withRoute(slice, event.route, (held) => ({ ...held, support: event.support }));
    default: {
      const never: never = event;
      throw new Error(`Unknown route event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention = false): ReportLine {
  return { key: `line.route.${key}`, params, tone, attention, counts: [] };
}

/** Funds, tuition, deposits and discounts are pence (R-ROUTE-009), shown as pounds. */
function pounds(amount: number): MoneyParam {
  return { currency: FUNDS_CURRENCY, amount };
}

function movedLines(event: Extract<RouteKindEvent, { type: "route/moved" }>): ReportLine[] {
  const { route, to } = event;
  switch (to) {
    case "heard":
      return [line("heard", { route, via: event.via ?? FRIEND }, "good")];
    case "known":
      return [line("looked-into", { route }, "good")];
    // The grant and the send-off are staged wins (docs/rules/text.md, "Money on screen").
    case "granted":
      return [{ ...line("granted", { route }, "good", true), big: true }];
    case "departed":
      return [{ ...line("departed", { route }, "good", true), big: true }];
    case "unknown":
    case "applying":
    case "refused":
      return [];
    default: {
      const never: never = to;
      throw new Error(`Unknown route state ${String(never)}.`);
    }
  }
}

function lines(event: RouteKindEvent): ReportLine[] {
  switch (event.type) {
    case "route/moved":
      return movedLines(event);
    case "route/school-applied":
      return [line("school-applied", { school: event.school, month: event.readyMonth }, "plain")];
    case "route/school-answered":
      // An answer is what the player waited for.
      return event.offer
        ? [line("school-offer", { school: event.school, discount: pounds(event.discount) }, "good", true)]
        : [line("school-rejected", { school: event.school }, "bad", true)];
    case "route/deposit-paid":
      return [line("deposit-paid", { school: event.school, amount: pounds(event.amount) }, "good")];
    case "route/funds-checked": {
      const { covered, shown, required, heldMonths } = event.funds;
      // Only a change asks the player to look; the same answer every month does not.
      const changed = covered !== event.was;
      return covered
        ? [line("funds-covered", { route: event.route, shown: pounds(shown), required: pounds(required), months: heldMonths }, "good", changed)]
        : [line("funds-short", { route: event.route, shown: pounds(shown), required: pounds(required) }, "bad", changed)];
    }
    case "route/applied":
      return [line("applied", { route: event.route, month: event.visa.decisionMonth }, "plain")];
    case "route/interview-scored":
      // The score is never shown (R-SETPIECE-005).
      return [];
    case "route/refused":
      return [line("refused", { route: event.route, reason: event.reasons[0] ?? "credibility" }, "bad", true)];
    case "route/deposit-refunded":
      return [line("deposit-refunded", { route: event.route, amount: pounds(event.amount) }, "good")];
    case "route/supported":
      return [line("supported", { route: event.route, amount: { currency: event.support.currency, amount: event.support.amount } }, "good")];
    default: {
      const never: never = event;
      throw new Error(`Unknown route event ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/**
 * One checklist item as the view shows it. A met item earns its weight; a
 * slow item earns weight * have / need rounded down as it fills; any other
 * unmet item earns nothing. Only slow items carry `have` and `need`.
 */
export function checklistItemView(read: ReadCtx, item: ChecklistItem): ChecklistItemView {
  const result = check(read, item.requirement);
  const have = item.partial && result.have !== undefined ? Math.max(0, result.have) : null;
  const need = item.partial && result.need !== undefined ? result.need : null;
  let earned = 0;
  if (result.met) earned = item.weight;
  else if (have !== null && need !== null && need > 0) earned = Math.min(item.weight, mulDiv(item.weight, have, need));
  return { id: item.id, weight: item.weight, met: result.met, have, need, earned };
}

/** R-ROUTE-004: the checklist shows once the route is known, and stays. */
function checklistShown(state: RouteStateName): boolean {
  return state !== "unknown" && state !== "heard";
}

function routeView(read: ReadCtx, id: Id<"route">, held: RouteState): RouteView {
  const entry = entryOf(read.content, id);
  return {
    id,
    state: held.state,
    percent: routePercent(read, id),
    window: windowOf(read, id),
    checklist: checklistShown(held.state) ? entry.checklist.map((item) => checklistItemView(read, item)) : [],
    schools: Object.entries(held.schools).map(([school, application]) => ({
      id: school as Id<"school">,
      state: application.state,
      readyMonth: application.readyMonth,
      discount: application.discount,
    })),
    school: held.school,
    depositPaid: held.depositPaid,
    support: held.support,
    funds: held.funds,
    unexplainedBp: unexplainedBp(read, id),
    visa: held.visa === null ? null : { submittedMonth: held.visa.submittedMonth, decisionMonth: held.visa.decisionMonth },
    refusals: held.refusals,
    lastRefusal: held.lastRefusal,
    depositRefund: held.depositRefund,
  };
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

function routeProblems(id: Id<"route">, held: RouteState, content: Content): string[] {
  const problems: string[] = [];
  const entry = content.route[id];
  if (entry === undefined) return [`The state holds ${id}, which is not a route in content.`];
  for (const school of Object.keys(held.schools)) {
    if (!entry.schools.includes(school as Id<"school">)) problems.push(`${id} holds an application to ${school}, which is not one of its schools.`);
  }
  if (held.school === null && held.depositPaid !== 0) problems.push(`${id} has ${String(held.depositPaid)} paid in deposit but no school.`);
  if (held.school !== null && held.schools[held.school]?.state !== "offer") problems.push(`${id} paid a deposit to ${held.school} without an offer from it.`);
  if (held.state === "applying" && held.visa === null) problems.push(`${id} is applying with no application.`);
  if (held.visa !== null && !["applying", "granted", "departed"].includes(held.state)) problems.push(`${id} is ${held.state} but holds an application.`);
  for (const [name, value] of [
    ["heldMonths", held.funds.heldMonths],
    ["refusals", held.refusals],
    ["depositPaid", held.depositPaid],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) problems.push(`${id} has ${name} ${String(value)}.`);
  }
  return problems;
}

export const routeKind: RegisteredKind<RouteSlice, RouteKindEvent> = {
  kind: "route",
  // Every route starts unknown (R-SCENARIO-002).
  initial(_scenario, content) {
    const slice: RouteSlice = {};
    for (const entry of Object.values(content.route)) slice[entry.id] = unknownRoute();
    return slice;
  },
  commands: {
    "route/pay-deposit": payDeposit,
    "route/depart": depart,
  },
  effects: {
    "route/hear": hear,
    "route/look-into": lookInto,
    "route/apply-school": applySchool,
    "route/apply": applyVisa,
    "route/support": support,
    "route/interview-scored": interviewScored,
  },
  phases: { clocks, hear: hearPhase },
  evolve,
  lines,
  requirements: {
    "route/state": judge,
    "route/offer": judge,
    "route/deposit": judge,
    "route/funds": judge,
    "route/unexplained-max": judge,
    "route/gate-step": judge,
  },
  invariants(state, content) {
    return Object.entries(state.route).flatMap(([id, held]) => routeProblems(id as Id<"route">, held, content));
  },
  view: (read) => ({
    routes: Object.entries(read.state.route).map(([id, held]) => routeView(read, id as Id<"route">, held)),
  }),
};
