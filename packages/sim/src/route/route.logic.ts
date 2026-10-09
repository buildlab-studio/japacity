// Routes and schools: docs/rules/route.md, R-ROUTE-001 to 020. A school has no
// slice of its own: its applications live on the route (`RouteState.schools`),
// and its rules are carried out here.
import { heldBand, takesApplication } from "../activity/activity.logic";
import { check, worldVar } from "../engine/check";
import { BP_WHOLE, clamp, convertMinor, divFloor, mulDiv, mulDivCeil } from "../engine/int";
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
  EffectType,
  ForeignCurrency,
  Id,
  MoneyParam,
  PlayerView,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  RouteEntry,
  RouteGate,
  RouteSlice,
  RouteState,
  RouteStateName,
  RouteView,
  SchoolEntry,
  State,
  Tuning,
  VisaApplication,
} from "../engine/types";
import { cardOf, cardsAllowed, reportLines } from "../chapter/chapter.card";
import { routePercent } from "../japacity/japacity.logic";
import { bannedUntil as placeBannedUntil } from "../place/place.logic";
import { GATES } from "./gates";
import type { ApplicationFigures, Decision, DecisionTerms, GateEffectHandler } from "./gates";
import { EVERY_TERM } from "./gates";
import { endBeforeSettingOff } from "./gates/road";
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
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];

/** R-ROUTE-016 counts the unexplained share in whole percents. */
const BP_PER_PERCENT = 100;
/** R-ROUTE-003: how talk of a route reaches a character who has not heard by `hearBy`. */
export const FRIEND = "friend";

/** The arrows of the page's diagram (R-ROUTE-001). `refused` has none in this milestone. */
const ARROWS: Record<RouteStateName, readonly RouteStateName[]> = {
  unknown: ["heard"],
  heard: ["known"],
  known: ["applying", "refused"],
  applying: ["granted", "known", "refused"],
  granted: ["departed"],
  refused: ["known"],
  departed: [],
};

export function unknownRoute(gate: RouteGate = "study"): RouteState {
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
    gate: GATES[gate].initial(),
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
/** The currency a route's funds are counted in: the gate's, or pence for the study route (R-ROUTE-009). */
export function fundsCurrency(read: ReadCtx, route: Id<"route">): ForeignCurrency {
  const entry = entryOf(read.content, route);
  const gate = GATES[entry.gate];
  if (gate.funds === undefined) return FUNDS_CURRENCY;
  return gate.funds(read, entry, routeOf(read.state, route))?.currency ?? FUNDS_CURRENCY;
}

export function fundsRequired(read: ReadCtx, route: Id<"route">): number {
  const held = routeOf(read.state, route);
  const entry = entryOf(read.content, route);
  const gate = GATES[entry.gate];
  // A gate with its own line (the sponsor's maintenance, the points route's settlement funds) says so; null shows no funds.
  if (gate.funds !== undefined) return gate.funds(read, entry, held)?.required ?? 0;
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
  const target = fundsCurrency(read, route);
  let shown = 0;
  for (const currency of CURRENCIES) {
    const pocket = read.state.wallet.pockets[currency];
    shown += convertMinor(pocket.bank, currency, target, rates) + convertMinor(pocket.locked, currency, target, rates);
  }
  const support = routeOf(read.state, route).support;
  if (support !== null) shown += convertMinor(support.amount, support.currency, target, rates);
  return shown;
}

/** What a foreign fee of `amount` costs in naira through the bank: the official rate, rounded up, and the charge (R-WALLET-009). */
function feeInNaira(amount: number, rate: number, chargeBp: number): number {
  const naira = mulDivCeil(amount, rate, 100);
  return naira + mulDiv(naira, chargeBp, BP_WHOLE);
}

/**
 * The most of a foreign currency that `kobo` in the naira bank could pay as a
 * fee, to the unit: the path of R-PLACE-006 and R-WALLET-009.
 */
export function nairaThroughFee(kobo: number, rate: number, chargeBp: number): number {
  let most = mulDiv(kobo, 100 * BP_WHOLE, rate * (BP_WHOLE + chargeBp));
  while (most > 0 && feeInNaira(most, rate, chargeBp) > kobo) most -= 1;
  while (feeInNaira(most + 1, rate, chargeBp) <= kobo) most += 1;
  return most;
}

/**
 * R-ROUTE-010 as amended for the study route: only the money that flies. The
 * route's own currency, bank and locked, in full; other foreign bank pockets at
 * the official rate; the naira bank through the fee path (`nairaThroughFee`).
 * Held funds in naira and the family's support stay behind, so they do not count.
 * the amendment does not name the support or locked naira; they are read as money that does not fly.
 * `fundsShown` does not call this yet. With it, all three recorded lives on the study route (ada-careful,
 * tunde-borrower, ada-abroad) stop replaying at their visa application or a later payment; it waits on the lives
 * being recorded again.
 */
export function flyingFundsShown(read: ReadCtx, route: Id<"route">): number {
  const rates = officialRates(read);
  const target = fundsCurrency(read, route);
  const chargeBp = read.content.tuning.wallet.bankChargeBp;
  let shown = 0;
  for (const currency of CURRENCIES) {
    const pocket = read.state.wallet.pockets[currency];
    if (currency === target) shown += pocket.bank + pocket.locked;
    else if (currency === "NGN") shown += nairaThroughFee(pocket.bank, rates[target], chargeBp);
    else shown += convertMinor(pocket.bank, currency, target, rates);
  }
  return shown;
}

/**
 * R-ROUTE-013: the wallet's lots at the official rate as a share of the funds
 * required, in basis points, never above 10000. Lots with nothing required
 * against them are wholly unexplained.
 */
export function unexplainedBp(read: ReadCtx, route: Id<"route">): number {
  const rates = officialRates(read);
  const target = fundsCurrency(read, route);
  const lots = read.state.wallet.lots.reduce((sum, lot) => sum + convertMinor(lot.amount, lot.currency, target, rates), 0);
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
export function refusalChanceBp(numbers: Tuning["route"], baseBp: number, file: VisaFile, terms: DecisionTerms = EVERY_TERM): number {
  const raw =
    baseBp +
    (terms.strictness ? numbers.refusalPerStrictnessBp * file.strictness : 0) +
    (terms.unexplained ? numbers.refusalPerUnexplainedBp * divFloor(file.unexplainedBp, BP_PER_PERCENT) : 0) +
    (terms.refusals ? numbers.refusalPerRefusalBp * file.refusals : 0) -
    (terms.interview ? numbers.refusalPerInterviewPointBp * file.interviewScore : 0) -
    (terms.goodGrade && file.grade >= numbers.goodGrade ? numbers.refusalGoodGradeBp : 0);
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

/** R-PLACE-008: a removal's ban holds through the months before its last, and lifts in that month. */
function banned(read: ReadCtx, country: Id<"country"> | null): boolean {
  if (country === null) return false;
  const until = placeBannedUntil(read, country);
  return until !== null && read.state.turn.month < until;
}

function moved(route: Id<"route">, to: RouteStateName, via?: string): RouteKindEvent {
  return via === undefined ? { type: "route/moved", route, to } : { type: "route/moved", route, to, via };
}

function allHold(ctx: Ctx, requirements: readonly Requirement[]): boolean {
  return requirements.every((requirement) => ctx.check(requirement).met);
}

/**
 * R-GUIDE-016: the routes a first meetup tells of, in the order a life's profile fits them. Each but the last
 * carries its own bar, which stands in for the route's `hearIf` on that first meetup; the last keeps its `hearIf`.
 */
const FIRST_MEETUP_FITS: readonly { route: Id<"route">; bar: Requirement | null }[] = [
  { route: "route.uk-care", bar: { type: "quality/min", quality: "quality.care", value: 30 } },
  { route: "route.uk-talent", bar: { type: "quality/min", quality: "quality.tech", value: 40 } },
  { route: "route.uk-masters", bar: null },
];

/**
 * The route the first meetup of a life hears of for sure (R-GUIDE-016): the first that fits the profile and is
 * still unknown, so a way already heard of never leaves the first meetup with nothing to tell.
 */
function firstMeetupFit(ctx: Ctx): { route: Id<"route">; bar: Requirement | null } | null {
  return FIRST_MEETUP_FITS.find((fit) => routeOf(ctx.state, fit.route).state === "unknown" && (fit.bar === null || ctx.check(fit.bar).met)) ?? null;
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
  // R-PLACE-008: a removal bans every route into that country for its months.
  if (banned(readOf(ctx), entry.country)) return [];
  // R-GUIDE-016: the first meetup of a life hears for sure of the route that fits the life (a nil chance stays nil); the chance applies from the second on. The draw is made either way, so the stream keeps its walk (R-ROUTE-002).
  const fit = effect.via === "meetup" && (ctx.state.activity.played["activity.meetup"] ?? 0) === 0 ? firstMeetupFit(ctx) : null;
  const sure = fit !== null && fit.route === entry.id && (effect.chanceBp ?? 0) > 0;
  const rolled = effect.chanceBp === undefined ? true : ctx.random.chance("offer", effect.chanceBp);
  if (!sure && !rolled) return [];
  // The sure hear stands on the profile's bar where the rule gives one (R-GUIDE-016), on the route's own `hearIf` otherwise.
  if (!(sure && fit.bar !== null) && !allHold(ctx, entry.hearIf)) return [];
  return [moved(entry.id, "heard", effect.via)];
}

/** R-ROUTE-004: the slot's param names the route. Only a heard route becomes known. */
/** R-ADVICE-001: the official page is the look-into activity; its line is the one R-ROUTE-004 always gave. */
const OFFICIAL_PAGE = "activity.look-into-route";

/**
 * The route a look names: the slot's param, or the term `route` an agent's
 * offer carries (R-ADVICE-001), since an offer's choice has no param.
 */
function lookedRoute(ctx: Ctx, cause: Cause): Id<"route"> | null {
  const named = cause.param ?? cause.terms["route"];
  return typeof named === "string" && ctx.content.route[named as Id<"route">] !== undefined ? (named as Id<"route">) : null;
}

function lookInto(ctx: Ctx, _effect: Effect, cause: Cause): BaseEvent[] {
  const route = lookedRoute(ctx, cause);
  if (route === null) return [];
  if (routeOf(ctx.state, route).state !== "heard") return [];
  const country = entryOf(ctx.content, route).country;
  if (banned(readOf(ctx), country)) return [];
  // R-ADVICE-001: each of the four ways looks into the route; the event names the way unless it is the official page.
  return [cause.source === OFFICIAL_PAGE ? moved(route, "known") : moved(route, "known", cause.source)];
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

/** R-ROUTE-012, 013, 014, 015: the application's conditions, then the sending. */
function applyVisa(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "route/apply") throw new Error(`route/apply cannot carry out ${effect.type}.`);
  const { route } = effect;
  const entry = entryOf(ctx.content, route);
  const held = routeOf(ctx.state, route);
  if (held.state !== "known" || !GATES[entry.gate].mayApply(ctx, entry, held, cause)) return [];
  if (windowOf(readOf(ctx), route) === "closed" || !conditionsHold(ctx, held, cause)) return [];
  return sendApplication(ctx, entry, cause);
}

/** The study route's figures (R-ROUTE-014): the UK study strictness, the student surcharge, the tuning's months. */
function studyFigures(read: ReadCtx): ApplicationFigures {
  return { strictness: ukVar(read, STRICTNESS), surchargePaid: ukVar(read, SURCHARGE), decisionMonths: read.content.tuning.route.decisionMonths };
}

/**
 * R-ROUTE-013, 014, 015: send the application, record the day's figures, open
 * the interview where the entry has one. A gate that sends on its own clock
 * (the points gate's invitation) calls this with its conditions already judged.
 */
export function sendApplication(ctx: Ctx, entry: RouteEntry, cause: Cause): BaseEvent[] {
  const route = entry.id;
  const read = readOf(ctx);
  const month = ctx.state.turn.month;
  const figures = GATES[entry.gate].application?.(read, entry, routeOf(ctx.state, route)) ?? studyFigures(read);
  const visa: VisaApplication = {
    submittedMonth: month,
    decisionMonth: month + figures.decisionMonths,
    rules: { livingLine: ukVar(read, LIVING_LINE), livingMonths: ukVar(read, LIVING_MONTHS), strictness: figures.strictness },
    unexplainedBp: unexplainedBp(read, route),
    interviewScore: null,
    surchargePaid: figures.surchargePaid,
  };
  const events = record(ctx, { type: "route/applied", route, visa });
  // A gate with no interview (every gate but study) scores nothing and waits for the decision.
  if (entry.interview !== null) ctx.apply([{ type: "setpiece/open", setpiece: entry.interview, route }], cause);
  GATES[entry.gate].onSend?.(ctx, entry, cause);
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

/**
 * R-PEOPLE-036: an application resting on a bond goes back to known, the fee
 * kept, the surcharge refunded to the pound bank pocket, where a refusal
 * refunds it (R-ROUTE-018), and an open interview closed unscored. A
 * dependant's grant not yet used is voided the same way. Nothing else moves:
 * no refusal is recorded, and an earlier one stands.
 */
function withdraw(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "route/withdraw") throw new Error(`route/withdraw cannot carry out ${effect.type}.`);
  const entry = entryOf(ctx.content, effect.route);
  const held = routeOf(ctx.state, effect.route);
  const unusedGrant = held.state === "granted" && entry.gate === "dependant";
  if (held.state !== "applying" && !unusedGrant) return [];
  const refunded = held.visa?.surchargePaid ?? 0;
  const events = record(ctx, { type: "route/withdrawn", route: effect.route, refunded });
  if (refunded > 0) ctx.apply([{ type: "money/add", currency: FUNDS_CURRENCY, pocket: "bank", amount: refunded, reason: "refund" }], { ...cause, source: effect.route });
  ctx.apply([{ type: "interview/close", route: effect.route }], cause);
  return events;
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
  // R-PEOPLE-044: a stand-in never spends.
  if (ctx.sender === "stand-in") return reject("not-legal", "A stand-in never spends.");
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

/** R-ROUTE-020, with R-GATE-003's arrival in place of the ending: the life goes on abroad. */
function depart(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "route/depart") throw new Error(`route/depart cannot handle ${command.type}.`);
  // R-PEOPLE-044: a stand-in never spends.
  if (ctx.sender === "stand-in") return reject("not-legal", "A stand-in never spends.");
  const entry = ctx.content.route[command.route];
  const held = ctx.state.route[command.route];
  if (entry === undefined || held === undefined) return reject("unknown-id", `There is no route ${String(command.route)}.`);
  if (held.state !== "granted") return reject("not-legal", "Only a granted route can be flown.");
  // the page is silent on a flight from the road; R-ROAD-005 makes the chain the month's only business there.
  if (ctx.state.place.where === "road") return reject("not-legal", "No flight leaves from the road.");
  const holding = Object.values(ctx.state.obligation.items).some((item) => ctx.content.obligation[item.entry]?.type === "held-funds");
  if (holding) return reject("not-legal", "Held funds are still open. They must be returned before you fly.");
  const flight = ctx.content.tuning.route.flight;
  const amount = ctx.amount(flight.amount);
  // R-GATE-003: the employer's flight costs nothing.
  if (!entry.flightPaidByEmployer && !ctx.check({ type: "money/can-pay", currency: flight.currency, amount }).met) {
    return reject("cannot-afford", `The flight costs ${String(amount)} and cannot be paid.`);
  }
  const cause: Cause = { source: command.type, param: command.route, terms: {} };
  if (!entry.flightPaidByEmployer) {
    const pay: Effect =
      flight.currency === "NGN"
        ? { type: "money/take", currency: "NGN", pocket: "transfer", amount, reason: "flight" }
        : { type: "money/pay-fee", currency: flight.currency, amount, reason: "flight" };
    ctx.apply([pay], cause);
  }
  const gate = GATES[entry.gate];
  const job = gate.departureJob?.(entry, held) ?? null;
  const events = record(ctx, moved(command.route, "departed"));
  if (entry.country !== null) ctx.apply([{ type: "place/move", to: "abroad", country: entry.country }], cause);
  if (entry.status !== null) ctx.apply([job === null ? { type: "status/grant", status: entry.status } : { type: "status/grant", status: entry.status, job }], cause);
  // R-LADDER-005: the sponsor's job is the job held on arrival. R-PLACE-003: a home job does not fly.
  // activity.md is silent on when; read as the moment of the flight, so no job is held that cannot be worked.
  ctx.apply([job === null ? { type: "activity/end-job", why: "moved" } : { type: "activity/start-job", job }, { type: "activity/end-job", why: "moved", side: true }], cause);
  // R-PEOPLE-027: an arrival through a partner is recorded for the bar and the assistance count (R-UNDERTAKING-004, 010).
  if (entry.gate === "partner") ctx.apply([{ type: "people/arrived", route: entry.id }], cause);
  gate.onDepart?.(ctx, entry, held, cause);
  return [...events, ...endBeforeSettingOff(ctx)];
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/** R-ROUTE-003: by `hearBy`, anyone who meets `hearIf` has heard, through a friend. Nobody talks routes on the road (R-PLACE-003). */
function hearPhase(ctx: Ctx): BaseEvent[] {
  const month = ctx.state.turn.month;
  const events: RouteKindEvent[] = [];
  if (ctx.state.place.where === "road") return events;
  for (const entry of Object.values(ctx.content.route)) {
    // A route with no `hearBy` is heard of only through an effect (R-ROUTE-003).
    if (entry.hearBy === null || routeOf(ctx.state, entry.id).state !== "unknown" || month < entry.hearBy) continue;
    if (banned(readOf(ctx), entry.country)) continue;
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

/**
 * The papers an application on this route rests on: every document its
 * checklist asks to be held (R-ADVICE-008).
 */
export function papersOf(entry: RouteEntry): Id<"document">[] {
  return entry.checklist.flatMap((item) => (item.requirement.type === "document/held" ? [item.requirement.document] : []));
}

/**
 * R-ADVICE-008: a route refuses an application that rests on fake papers,
 * before any draw, with the reason `agent` (the agent's papers did not hold
 * up). Every route's checklist asks for its papers to be genuine, judged by
 * `document/genuine` on each paper held. no ban, since nothing here
 * takes a status or ends a life; whether a fake knowingly used
 * should carry R-GATE-005's deception ban.
 */
function withPapers(read: ReadCtx, entry: RouteEntry, decision: Decision): Decision {
  if (decision.wait === true || decision.override !== null) return decision;
  const fake = papersOf(entry).some(
    (document) => check(read, { type: "document/held", document }).met && !check(read, { type: "document/genuine", document }).met,
  );
  return fake ? { ...decision, override: "agent", bans: false } : decision;
}

/** R-ROUTE-016 to 019: one draw on `visa`, from the figures recorded on the day of submission. */
function decide(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const held = routeOf(ctx.state, route);
  const month = ctx.state.turn.month;
  if (held.state !== "applying" || held.visa === null || held.visa.decisionMonth > month) return [];
  const { visa } = held;
  const numbers = ctx.content.tuning.route;
  const entry = entryOf(ctx.content, route);
  // R-GATE-002: the gate says which terms the draw reads, and whether something refuses before any draw.
  const decision = withPapers(readOf(ctx), entry, GATES[entry.gate].decision(readOf(ctx), entry, held));
  if (decision.wait === true) return [];
  const chance = refusalChanceBp(
    numbers,
    entry.refusalBaseBp + (decision.addBp ?? 0),
    { strictness: visa.rules.strictness, unexplainedBp: visa.unexplainedBp, refusals: held.refusals, interviewScore: visa.interviewScore ?? 0, grade: grade(ctx.state) },
    decision.terms,
  );
  if (decision.override === null && !ctx.random.chance("visa", chance)) return record(ctx, moved(route, "granted"));
  const back = Math.max(0, held.depositPaid - numbers.depositAdminFee);
  // A refund still on its way is kept, not lost, should a second refusal come first.
  const owed = back + (held.depositRefund?.amount ?? 0);
  const refused: RouteKindEvent = {
    type: "route/refused",
    route,
    month,
    reasons: decision.override === null ? refusalReasons(visa, held.refusals, numbers) : [decision.override, ...refusalReasons(visa, held.refusals, numbers)],
    depositRefund: owed === 0 ? null : { amount: owed, readyMonth: month + numbers.depositRefundMonths },
  };
  const events = record(ctx, refused);
  const cause: Cause = { source: route, param: null, terms: {} };
  if (held.visa.surchargePaid > 0) ctx.apply([{ type: "money/add", currency: FUNDS_CURRENCY, pocket: "bank", amount: held.visa.surchargePaid, reason: "refund" }], cause);
  if (entry.gate === "study") ctx.apply([{ type: "document/void", document: CAS }], cause);
  // R-GATE-005: deception bans every route into the country for the country's months.
  if (decision.override !== null && decision.bans && entry.country !== null) {
    const months = ctx.content.country[entry.country]?.deceptionBanMonths ?? 0;
    if (months > 0) {
      for (const other of Object.values(ctx.content.route)) {
        if (other.country !== entry.country) continue;
        const state = routeOf(ctx.state, other.id).state;
        if (state === "known" || state === "applying") events.push(...record(ctx, { type: "route/banned", route: other.id, until: month + months }));
      }
    }
  }
  return events;
}

/** R-GATE-005: a ban lifts in the month it names, and the route is known again. */
function unban(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const held = routeOf(ctx.state, route);
  if (held.state !== "refused" || held.bannedUntil === null || held.bannedUntil > ctx.state.turn.month) return [];
  return record(ctx, { type: "route/unbanned", route });
}

/** R-ROUTE-007, 011, 016 and the refund of 018, route by route in content order. */
function clocks(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  for (const entry of Object.values(ctx.content.route)) {
    events.push(...unban(ctx, entry.id));
    events.push(...(GATES[entry.gate].clocks?.(ctx, entry) ?? []));
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
    case "document/genuine":
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
    case "activity/played":
    case "setpiece/answered":
    case "setpiece/answered-with":
    case "world/lottery":
    case "people/bond":
    case "people/sibling-abroad":
    case "people/joint":
    case "wallet/total":
    case "place/returned":
    case "place/months-here":
    case "not":
    case "any":
      throw new Error(`The route kind does not judge ${requirement.type}.`);
    case "route/gate-step": {
      const entry = entryOf(read.content, requirement.route);
      return { met: GATES[entry.gate].reached(read, entry, routeOf(read.state, requirement.route), requirement.step) };
    }
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
    case "route/gate-updated":
      return withRoute(slice, event.route, (held) => (event.secret === undefined ? { ...held, gate: event.gate } : { ...held, gate: event.gate, secret: event.secret }));
    case "route/refusal-noted":
      return withRoute(slice, event.route, (held) => ({ ...held, refusals: held.refusals + 1, lastRefusal: { month: event.month, reasons: [event.reason] } }));
    case "route/banned":
      return withRoute(slice, event.route, (held) => ({ ...held, state: arrow(held, "refused", event.route), visa: null, bannedUntil: event.until }));
    case "route/unbanned":
      return withRoute(slice, event.route, (held) => ({ ...held, state: arrow(held, "known", event.route), bannedUntil: null }));
    case "route/withdrawn":
      // R-PEOPLE-036 adds the one arrow the diagram lacks: a dependant's unused grant back to known.
      return withRoute(slice, event.route, (held) => ({
        ...held,
        state: held.state === "granted" ? "known" : arrow(held, "known", event.route),
        visa: null,
        funds: { ...held.funds, heldMonths: 0 },
      }));
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

/** R-ADVICE-001: the way a route was looked into, for its line. The official page keeps the line it always had. */
function lookedLine(via: string | undefined): string {
  if (via === undefined) return "looked-into";
  if (via === "activity.ask-someone-who-went") return "looked-into-told";
  if (via === "activity.see-adviser") return "looked-into-advised";
  if (via.startsWith("offer.agent-")) return "looked-into-agent";
  return "looked-into";
}

function movedLines(event: Extract<RouteKindEvent, { type: "route/moved" }>): ReportLine[] {
  const { route, to } = event;
  switch (to) {
    case "heard":
      return [line("heard", { route, via: event.via ?? FRIEND }, "good")];
    case "known":
      return [line(lookedLine(event.via), { route }, "good")];
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

function lines(event: RouteKindEvent, _state: State, content: Content): ReportLine[] {
  switch (event.type) {
    case "route/moved":
      // R-ROAD-001: the road is never told as a route; its own notes tell the chain.
      return content.route[event.route]?.gate === "road" ? [] : movedLines(event);
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
    case "route/gate-updated":
      // R-ROAD-010: the chain's lines are tone `bad`.
      return event.note === null ? [] : [line(event.note, { route: event.route }, event.gate?.gate === "road" ? "bad" : "plain", true)];
    case "route/refusal-noted":
      return [line("refused", { route: event.route, reason: event.reason }, "bad", true)];
    case "route/banned":
      return [line("banned", { route: event.route, month: event.until }, "bad", true)];
    case "route/unbanned":
      return [line("unbanned", { route: event.route }, "plain", true)];
    case "route/withdrawn":
      return [line("withdrawn", { route: event.route }, "bad", true)];
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
    gate: GATES[entry.gate].view?.(read, entry, held) ?? null,
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
  // R-ROAD-005: the road is applying while its chain runs, with no application.
  if (held.state === "applying" && held.visa === null && entry.gate !== "road") problems.push(`${id} is applying with no application.`);
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

/** The effect handlers every gate module brings, merged for the kind's table. */
function gateEffects(): Partial<Record<EffectType, GateEffectHandler>> {
  const merged: Partial<Record<EffectType, GateEffectHandler>> = {};
  for (const gate of Object.values(GATES)) {
    for (const [type, handler] of Object.entries(gate.effects ?? {}) as [EffectType, GateEffectHandler][]) merged[type] = handler;
  }
  return merged;
}

/** R-SHARE-001: the granted card through the month after a visa is granted (R-ROUTE-017), for the route granted. */
export function grantedCard(read: ReadCtx): PlayerView["card"] {
  if (!cardsAllowed(read)) return null;
  const granted = reportLines(read, "line.route.granted")[0];
  return granted === undefined ? null : cardOf(read, "granted", { route: granted.params.route as Id<"route"> });
}

export const routeKind: RegisteredKind<RouteSlice, RouteKindEvent> = {
  kind: "route",
  // Every route starts unknown (R-SCENARIO-002).
  initial(_scenario, content) {
    const slice: RouteSlice = {};
    for (const entry of Object.values(content.route)) slice[entry.id] = unknownRoute(entry.gate);
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
    "route/withdraw": withdraw,
    // Each gate's own effects (R-GATE-001): the sponsor's record, the road's steps.
    ...gateEffects(),
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
    // R-ROAD-001: the road never appears in the routes view.
    routes: Object.entries(read.state.route).filter(([id]) => read.content.route[id as Id<"route">]?.gate !== "road").map(([id, held]) => routeView(read, id as Id<"route">, held)),
  }),
};
