// Routes and schools: docs/rules/route.md. A school has no
// slice of its own: its applications live on the route (`RouteState.schools`),
// and its rules are carried out here.
import { takesApplication } from "../activity/activity.logic";
import { check, worldVar, worldVarOr } from "../engine/check";
import { QUALITY } from "../engine/ids";
import { BP_WHOLE, clamp, convertMinor, divFloor, mulDiv } from "../engine/int";
import type { RegisteredKind } from "../engine/kind";
import { emit, ownOf, readOf } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  BaseEvent,
  Cause,
  ChecklistItem,
  ChecklistItemView,
  Command,
  Content,
  Ctx,
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
import { bannedNow, overstaysIn } from "../place/place.logic";
import { countryEntry, removalBanMonths } from "../status/status.logic";
import { GATES } from "./gates";
import type { ApplicationFigures, Decision, DecisionTerms, GateEffectHandler } from "./gates";
import { EVERY_TERM } from "./gates";
import { endBeforeSettingOff } from "./gates/road";
import type { RefusalReason, RouteKindEvent } from "./route.events";
import { CURRENCIES, officialRates } from "../wallet/wallet.rates";

/** The university's confirmation, granted with the deposit and voided by a refusal. */
const CAS: Id<"document"> = "document.cas";
const LIVING_LINE: Id<"var"> = "var.uk-living-line";
const LIVING_MONTHS: Id<"var"> = "var.uk-living-months";
const STRICTNESS: Id<"var"> = "var.uk-study-strictness";
const SURCHARGE: Id<"var"> = "var.uk-surcharge";

/** Funds, tuition and deposits are counted in pence (route:funds-required, route:funds-shown-exclude-cash). */
const FUNDS_CURRENCY: ForeignCurrency = "GBP";

/** route:visa-refusal-chance counts the unexplained share in whole percents. */
const BP_PER_PERCENT = 100;
/** route:friend-tells-by-month: how talk of a route reaches a character who has not heard by `hearBy`. */
export const FRIEND = "friend";

/**
 * The arrows of the page's diagram (route:routes-move-along-arrows). A ban moves a route to `refused`, and its lifting back to `known` (route-gates:deception-bans-country);
 * a route flown whose permission is lost is `known` again (route:lapsed-route-known-again, decision 0028).
 */
const ARROWS: Record<RouteStateName, readonly RouteStateName[]> = {
  unknown: ["heard"],
  heard: ["known"],
  known: ["applying", "refused"],
  applying: ["granted", "known", "refused"],
  granted: ["departed"],
  refused: ["known"],
  departed: ["known"],
};

/** route-gates:canada-return-asks-authorisation: the country whose removal asks an authorisation to return, and its two fees in Canadian cents. */
const AUTHORISING: Id<"country"> = "country.canada";
const ARC_FEE: Id<"var"> = "var.canada-arc-fee";
const REMOVAL_COST: Id<"var"> = "var.canada-removal-cost";

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
 * A world variable the route reads by name. A route entry names only its
 * window, so the living line, living months, strictness and surcharge are
 * the UK's variables for every route. The engine's mini content has none of
 * them, so a missing one reads as 0 there; the real content has all four.
 */
function ukVar(read: ReadCtx, id: Id<"var">): number {
  return worldVarOr(read.world, id);
}

function grade(state: State): number {
  return state.quality[QUALITY.eduGrade] ?? 0;
}

/** route:closed-window-blocks-applying: the route's window, from its world variable. 0 closed, 1 narrowing, 2 open. */
function windowOf(read: ReadCtx, route: Id<"route">): RouteView["window"] {
  const window = entryOf(read.content, route).window;
  // A route with no window var (the road) is never closed by the world.
  if (window === null) return "open";
  const value = worldVar(read, window);
  if (value <= 0) return "closed";
  return value === 1 ? "narrowing" : "open";
}

/** route:school-answers-by-grade: the school's base chance plus the figure for each grade above its minimum, capped. */
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

/** The currency a route's funds are counted in: the gate's, or pence for the study route (route:funds-required). */
export function fundsCurrency(read: ReadCtx, route: Id<"route">): ForeignCurrency {
  const entry = entryOf(read.content, route);
  const gate = GATES[entry.gate];
  if (gate.funds === undefined) return FUNDS_CURRENCY;
  return gate.funds(read, entry, routeOf(read.state, route))?.currency ?? FUNDS_CURRENCY;
}

/**
 * route:funds-required, in pence: the school's tuition less its discount less the
 * deposit paid, plus the living line times the living months. Before a
 * deposit, the cheapest school holding an offer, after its discount, or else
 * the cheapest school on the route with no discount.
 */
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
 * route:funds-shown-exclude-cash, in pence: the bank and locked pockets of every currency and
 * any family support, at the official rate. Cash never counts. Each pocket
 * goes straight to pounds with `convertMinor`, rounded down once per pocket,
 * so naira is valued as kobo * 100 / the pound rate in one step.
 */
export function fundsShown(read: ReadCtx, route: Id<"route">): number {
  const rates = officialRates(read.world);
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

/**
 * route:unexplained-share-of-funds: the wallet's lots at the official rate as a share of the funds
 * required, in basis points, never above 10000. Lots with nothing required
 * against them are wholly unexplained.
 */
export function unexplainedBp(read: ReadCtx, route: Id<"route">): number {
  const rates = officialRates(read.world);
  const target = fundsCurrency(read, route);
  const lots = read.state.wallet.lots.reduce((sum, lot) => sum + convertMinor(lot.amount, lot.currency, target, rates), 0);
  if (lots === 0) return 0;
  const required = fundsRequired(read, route);
  return required === 0 ? BP_WHOLE : Math.min(BP_WHOLE, mulDiv(lots, BP_WHOLE, required));
}

/** What the decision weighs (route:visa-refusal-chance). */
export interface VisaFile {
  strictness: number;
  unexplainedBp: number;
  refusals: number;
  interviewScore: number;
  grade: number;
}

/**
 * route:visa-refusal-chance: the route's own base, plus each point of strictness, plus each
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

/** route:refusal-reasons-recorded: most telling first, and `credibility` only when nothing else applies. */
export function refusalReasons(visa: VisaApplication, earlierRefusals: number, numbers: Tuning["route"]): RefusalReason[] {
  const reasons: RefusalReason[] = [];
  if (visa.unexplainedBp >= numbers.fundsReasonBp) reasons.push("funds");
  if ((visa.interviewScore ?? 0) < 0) reasons.push("interview");
  if (earlierRefusals > 0) reasons.push("history");
  return reasons.length > 0 ? reasons : ["credibility"];
}

/**
 * status:overstay-counts-as-refusal: the earlier refusals a decision counts: the route's own, and one for each overstay in its country
 * that went past the grace and for each removal from it.
 */
export function earlierRefusals(read: ReadCtx, entry: RouteEntry, held: RouteState): number {
  if (entry.country === null) return held.refusals;
  return held.refusals + overstaysIn(read, entry.country);
}

/**
 * route-gates:canada-return-asks-authorisation: the authorisation to return and the removal costs the first application into Canada owes after a
 * removal, or null when nothing is owed: no removal from Canada, or one paid for since.
 */
export function authorisationOwed(read: ReadCtx, entry: RouteEntry): { arc: MoneyParam; removal: MoneyParam } | null {
  if (entry.country !== AUTHORISING) return null;
  const removals = read.state.status.removals.filter((removal) => removal.country === AUTHORISING);
  const last = removals.at(-1);
  if (last === undefined) return null;
  const paid = Object.entries(read.state.route).some(([id, held]) => read.content.route[id as Id<"route">]?.country === AUTHORISING && (held.authorisedMonth ?? -1) >= last.month);
  if (paid || removalBanMonths(read.content, AUTHORISING) <= 0) return null;
  const currency = countryEntry(read.content, AUTHORISING).currency;
  return { arc: { currency, amount: worldVarOr(read.world, ARC_FEE) }, removal: { currency, amount: worldVarOr(read.world, REMOVAL_COST) } };
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

/** place:removal-bans-the-country: a removal's ban holds through the months before its last, and lifts in that month. */
function banned(read: ReadCtx, country: Id<"country"> | null): boolean {
  return country !== null && bannedNow(read, country);
}

function moved(route: Id<"route">, to: RouteStateName, via?: string): RouteKindEvent {
  return via === undefined ? { type: "route/moved", route, to } : { type: "route/moved", route, to, via };
}

function allHold(ctx: Ctx, requirements: readonly Requirement[]): boolean {
  return requirements.every((requirement) => ctx.check(requirement).met);
}

/**
 * guide:first-meetup-hears-fitting-route: the routes a first meetup tells of, in the order a life's profile fits them. Each but the last
 * carries its own bar, which stands in for the route's `hearIf` on that first meetup; the last keeps its `hearIf`.
 */
export const FIRST_MEETUP_FITS: readonly { route: Id<"route">; bar: Requirement | null }[] = [
  { route: "route.uk-care", bar: { type: "quality/min", quality: "quality.care", value: 30 } },
  { route: "route.uk-talent", bar: { type: "quality/min", quality: "quality.tech", value: 40 } },
  { route: "route.uk-masters", bar: null },
];

/**
 * The route the first meetup of a life hears of for sure (guide:first-meetup-hears-fitting-route): the first that fits the profile and is
 * still unknown, so a way already heard of never leaves the first meetup with nothing to tell.
 */
function firstMeetupFit(ctx: Ctx): { route: Id<"route">; bar: Requirement | null } | null {
  return FIRST_MEETUP_FITS.find((fit) => routeOf(ctx.state, fit.route).state === "unknown" && (fit.bar === null || ctx.check(fit.bar).met)) ?? null;
}

/**
 * route:hearing-a-route. Hearing is talk that comes up, not a school's draw, so a chance
 * to hear draws on `offer`. The draw comes first, and only for a route still
 * unknown.
 */
function hear(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "route/hear") throw new Error(`route/hear cannot carry out ${effect.type}.`);
  const entry = entryOf(ctx.content, effect.route);
  if (routeOf(ctx.state, effect.route).state !== "unknown") return [];
  // place:removal-bans-the-country: a removal bans every route into that country for its months.
  if (banned(readOf(ctx), entry.country)) return [];
  // guide:first-meetup-hears-fitting-route: the first meetup of a life hears for sure of the route that fits the life (a nil chance stays nil); the chance applies from the second on. The draw is made either way, so the stream keeps its walk (route:hearing-a-route).
  const fit = effect.via === "meetup" && (ctx.state.activity.played["activity.meetup"] ?? 0) === 0 ? firstMeetupFit(ctx) : null;
  const sure = fit !== null && fit.route === entry.id && (effect.chanceBp ?? 0) > 0;
  const rolled = effect.chanceBp === undefined ? true : ctx.random.chance("offer", effect.chanceBp);
  if (!sure && !rolled) return [];
  // The sure hear stands on the profile's bar where the rule gives one (guide:first-meetup-hears-fitting-route), on the route's own `hearIf` otherwise.
  if (!(sure && fit.bar !== null) && !allHold(ctx, entry.hearIf)) return [];
  return [moved(entry.id, "heard", effect.via)];
}

/** advice:four-ways-to-learn-route: the official page is the look-into activity, told by route:looking-into-makes-known's own line. */
const OFFICIAL_PAGE = "activity.look-into-route";

/**
 * The route a look names: the slot's param, or the term `route` an agent's
 * offer carries (advice:four-ways-to-learn-route), since an offer's choice has no param.
 */
function lookedRoute(ctx: Ctx, cause: Cause, effect?: Effect): Id<"route"> | null {
  // Decision 0001: the effect's own route first, then the slot's param or a string term.
  const named = (effect?.type === "route/look-into" ? effect.route : undefined) ?? cause.param ?? cause.terms["route"];
  return typeof named === "string" && ctx.content.route[named as Id<"route">] !== undefined ? (named as Id<"route">) : null;
}

/** route:looking-into-makes-known: the effect's route or the slot's param names the route (decision 0001). Only a heard route becomes known. */
function lookInto(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  const route = lookedRoute(ctx, cause, effect);
  if (route === null) return [];
  if (routeOf(ctx.state, route).state !== "heard") return [];
  const country = entryOf(ctx.content, route).country;
  if (banned(readOf(ctx), country)) return [];
  // advice:four-ways-to-learn-route: each of the four ways looks into the route; the event names the way unless it is the official page.
  return [cause.source === OFFICIAL_PAGE ? moved(route, "known") : moved(route, "known", cause.source)];
}

/**
 * route:applying-to-a-school, and route:closed-window-blocks-applying for the window. The slot's param names the
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
  // route:applying-to-a-school, route:degree-meets-masters-english: no school asks an English band.
  if (grade(ctx.state) < school.minGrade) return [];
  const wait = ctx.random.between("school", school.answerMonths[0], school.answerMonths[1]);
  return [own({ type: "route/school-applied", route: school.route, school: id, readyMonth: ctx.state.turn.month + wait })];
}

/**
 * The application's conditions, judged again (route:visa-application-needs). The slot that
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

/** route:visa-application-needs, route:unexplained-share-of-funds, route:application-fixes-figures, route:application-opens-interview: the application's conditions, then the sending. */
function applyVisa(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "route/apply") throw new Error(`route/apply cannot carry out ${effect.type}.`);
  const { route } = effect;
  const entry = entryOf(ctx.content, route);
  const held = routeOf(ctx.state, route);
  if (held.state !== "known" || !GATES[entry.gate].mayApply(ctx, entry, held, cause)) return [];
  if (windowOf(readOf(ctx), route) === "closed" || !conditionsHold(ctx, held, cause)) return [];
  return sendApplication(ctx, entry, cause);
}

/** The study route's figures (route:application-fixes-figures): the UK study strictness, the student surcharge, the tuning's months. */
function studyFigures(read: ReadCtx): ApplicationFigures {
  return { strictness: ukVar(read, STRICTNESS), surchargePaid: ukVar(read, SURCHARGE), decisionMonths: read.content.tuning.route.decisionMonths };
}

/**
 * route:unexplained-share-of-funds, route:application-fixes-figures, route:application-opens-interview: send the application, record the day's figures, open
 * the interview where the entry has one. A gate that sends on its own clock
 * (the points gate's invitation) calls this with its conditions already judged.
 */
function sendApplication(ctx: Ctx, entry: RouteEntry, cause: Cause): BaseEvent[] {
  const route = entry.id;
  const read = readOf(ctx);
  const month = ctx.state.turn.month;
  const owing = authorisationOwed(read, entry);
  if (owing !== null && !ctx.check({ type: "money/can-pay", currency: owing.arc.currency, amount: owing.arc.amount + owing.removal.amount }).met) return [];
  const figures = GATES[entry.gate].application?.(read, entry, routeOf(ctx.state, route)) ?? studyFigures(read);
  const { where, country } = ctx.state.place;
  const visa: VisaApplication = {
    submittedMonth: month,
    decisionMonth: month + figures.decisionMonths,
    rules: { livingLine: ukVar(read, LIVING_LINE), livingMonths: ukVar(read, LIVING_MONTHS), strictness: figures.strictness },
    unexplainedBp: unexplainedBp(read, route),
    interviewScore: null,
    surchargePaid: figures.surchargePaid,
    // status:grace-allows-in-country-applications, person:partner-route-in-country: made from inside its country, a grant needs no flight.
    ...(where === "abroad" && country !== null && country === entry.country ? { inCountry: true as const } : {}),
  };
  const events = record(ctx, { type: "route/applied", route, visa });
  if (owing !== null) {
    // route-gates:canada-return-asks-authorisation: taken once, with the first application after the removal.
    ctx.apply(
      [
        { type: "money/pay-fee", currency: owing.arc.currency as ForeignCurrency, amount: owing.arc.amount, reason: "fee-visa" },
        { type: "money/pay-fee", currency: owing.removal.currency as ForeignCurrency, amount: owing.removal.amount, reason: "fee-visa" },
      ],
      cause,
    );
    events.push(...record(ctx, { type: "route/authorised", route, month }));
  }
  // A gate with no interview (every gate but study) scores nothing and waits for the decision.
  if (entry.interview !== null) ctx.apply([{ type: "setpiece/open", setpiece: entry.interview, route }], cause);
  GATES[entry.gate].onSend?.(ctx, entry, cause);
  return events;
}

/** The family pledge: money in a parent's account that counts toward the route (route:funds-shown-exclude-cash). */
function support(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "route/support") throw new Error(`route/support cannot carry out ${effect.type}.`);
  entryOf(ctx.content, effect.route);
  const amount = ctx.amount(effect.amount, cause.terms);
  if (amount < 0) throw new Error(`Support must not be negative, got ${String(amount)}.`);
  return [own({ type: "route/supported", route: effect.route, support: { currency: effect.currency, amount } })];
}

/**
 * person:joint-collapses-with-bond: an application resting on a bond goes back to known, the fee
 * kept, the surcharge refunded to the pound bank pocket, where a refusal
 * refunds it (route:refusal-refunds-and-resets), and an open interview closed unscored. A
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

/**
 * route:lapsed-route-known-again: permission in the country is gone (a lapse to the overstayer, a removal, a return home but with papers), so every route
 * into it that was flown is known again. The university's confirmation goes with the school.
 */
function lapse(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "route/lapse") throw new Error(`route/lapse cannot carry out ${effect.type}.`);
  const events: BaseEvent[] = [];
  for (const entry of Object.values(ctx.content.route)) {
    if (entry.country !== effect.country || routeOf(ctx.state, entry.id).state !== "departed") continue;
    events.push(...record(ctx, { type: "route/lapsed", route: entry.id }));
    if (entry.gate === "study") ctx.apply([{ type: "document/void", document: CAS }], cause);
  }
  return events;
}

/** route:answers-score-and-close: the interview's score goes on the open application, and only there. */
function interviewScored(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "route/interview-scored") throw new Error(`route/interview-scored cannot carry out ${effect.type}.`);
  const held = routeOf(ctx.state, effect.route);
  if (held.state !== "applying" || held.visa === null) return [];
  return [own({ type: "route/interview-scored", route: effect.route, score: effect.score })];
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** route:deposit-secures-school. */
function payDeposit(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "route/pay-deposit") throw new Error(`route/pay-deposit cannot handle ${command.type}.`);
  // person:stand-in-acts-narrowly: a stand-in never spends.
  if (ctx.sender === "stand-in") return reject("not-legal", "A stand-in never spends.");
  const entry = ownOf(ctx.content.route, command.route);
  const held = ownOf(ctx.state.route, command.route);
  if (entry === undefined || held === undefined) return reject("unknown-id", `There is no route ${String(command.route)}.`);
  const school = ownOf(ctx.content.school, command.school);
  if (school === undefined || !entry.schools.includes(command.school)) {
    return reject("unknown-id", `There is no school ${String(command.school)} on ${entry.id}.`);
  }
  if (held.schools[school.id]?.state !== "offer") return reject("not-legal", `There is no offer from ${school.id}.`);
  if (held.school !== null) return reject("not-legal", `A deposit is already paid on ${entry.id}, to ${held.school}.`);
  // route:closed-window-blocks-applying does not apply: a deposit is paid to a school, not with a visa application.
  if (!ctx.check({ type: "money/can-pay", currency: FUNDS_CURRENCY, amount: school.deposit }).met) {
    return reject("cannot-afford", `The deposit of ${String(school.deposit)} pence cannot be paid.`);
  }
  const cause: Cause = { source: command.type, param: school.id, terms: {} };
  ctx.apply([{ type: "money/pay-fee", currency: FUNDS_CURRENCY, amount: school.deposit, reason: "fee-school" }], cause);
  const events = record(ctx, { type: "route/deposit-paid", route: entry.id, school: school.id, amount: school.deposit });
  ctx.apply([{ type: "document/grant", document: CAS }], cause);
  return events;
}

/** return:papers-return-keeps-status: the status kept from a return with papers, as it is granted again with its months, when it is for the route's country. */
function tokenFor(read: ReadCtx, entry: RouteEntry): Effect | null {
  const token = read.state.place.heldAbroad;
  if (token === null || entry.country === null || read.content.status[token.status]?.country !== entry.country) return null;
  return { type: "status/grant", status: token.status, kept: { monthsHeld: token.monthsHeld, lawfulMonths: token.lawfulMonths } };
}

/**
 * offer:lapsed-offer-removed: an open ask that belongs at home (the family's send-off, a pitch at the park) cannot be
 * answered abroad; the plane closes it unanswered, as a lapse with no choice, so nothing waits on the player abroad.
 */
function closeHomeOffers(ctx: Ctx, cause: Cause): void {
  const homeOnly = Object.values(ctx.state.offer.items).filter((item) => ctx.content.offer[item.entry]?.where === "home");
  if (homeOnly.length > 0) ctx.apply(homeOnly.map((item) => ({ type: "offer/close" as const, offer: item.entry })), cause);
}

/**
 * route:departure-pays-flight, with route-gates:departure-grants-status's arrival in place of the ending: the life goes on abroad. return:papers-return-keeps-status: a status kept
 * from a return with papers flies any route into its country, with no gate and no fee but the flight, and the
 * arrival is on that status; the route itself does not move. A granted route into that country departs as any
 * granted route does, and the arrival is still on the status kept, since a settled status never expires (status:lawful-months-reach-settlement).
 */
function depart(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "route/depart") throw new Error(`route/depart cannot handle ${command.type}.`);
  // person:stand-in-acts-narrowly: a stand-in never spends.
  if (ctx.sender === "stand-in") return reject("not-legal", "A stand-in never spends.");
  const entry = ownOf(ctx.content.route, command.route);
  const held = ownOf(ctx.state.route, command.route);
  if (entry === undefined || held === undefined) return reject("unknown-id", `There is no route ${String(command.route)}.`);
  const kept = tokenFor(readOf(ctx), entry);
  const token = held.state === "granted" ? null : kept;
  if (held.state !== "granted" && token === null) return reject("not-legal", "Only a granted route, or a route into the country of a status kept, can be flown.");
  // place:departure-moves-abroad: the airport's gate is in Lagos, so a flight leaves only from home; road:road-truth-asks-more makes the chain the month's
  // only business on the road.
  if (ctx.state.place.where === "road") return reject("not-legal", "No flight leaves from the road.");
  if (ctx.state.place.where === "abroad") return reject("not-legal", "No flight leaves from abroad. The gate is at the Lagos airport.");
  const holding = Object.values(ctx.state.obligation.items).some((item) => ctx.content.obligation[item.entry]?.type === "held-funds");
  if (holding) return reject("not-legal", "Held funds are still open. They must be returned before you fly.");
  const flight = ctx.content.tuning.route.flight;
  const amount = ctx.amount(flight.amount);
  // route-gates:departure-grants-status: the employer's flight costs nothing. A flight on a kept status is the character's own.
  const paid = token !== null || !entry.flightPaidByEmployer;
  if (paid && !ctx.check({ type: "money/can-pay", currency: flight.currency, amount }).met) {
    return reject("cannot-afford", `The flight costs ${String(amount)} and cannot be paid.`);
  }
  const cause: Cause = { source: command.type, param: command.route, terms: {} };
  if (paid) {
    const pay: Effect =
      flight.currency === "NGN"
        ? { type: "money/take", currency: "NGN", pocket: "transfer", amount, reason: "flight" }
        : { type: "money/pay-fee", currency: flight.currency, amount, reason: "flight" };
    ctx.apply([pay], cause);
  }
  if (token !== null && entry.country !== null) {
    ctx.apply([{ type: "place/move", to: "abroad", country: entry.country }], cause);
    ctx.apply([token, { type: "activity/end-job", why: "moved" }, { type: "activity/end-job", why: "moved", side: true }], cause);
    closeHomeOffers(ctx, cause);
    return endBeforeSettingOff(ctx);
  }
  const gate = GATES[entry.gate];
  const job = gate.departureJob?.(entry, held) ?? null;
  const events = record(ctx, moved(command.route, "departed"));
  if (entry.country !== null) ctx.apply([{ type: "place/move", to: "abroad", country: entry.country }], cause);
  if (kept !== null) ctx.apply([kept], cause);
  else if (entry.status !== null) ctx.apply([job === null ? { type: "status/grant", status: entry.status } : { type: "status/grant", status: entry.status, job }], cause);
  // ladders:sponsor-job-ties-status: the sponsor's job is the job held on arrival. place:entries-legal-by-where: a home job does not fly.
  // activity.md is silent on when; it is the moment of the flight, so no job is held that cannot be worked.
  ctx.apply([job === null ? { type: "activity/end-job", why: "moved" } : { type: "activity/start-job", job }, { type: "activity/end-job", why: "moved", side: true }], cause);
  // person:partner-application-decided: an arrival through a partner is recorded for the bar and the assistance count (undertaking:sponsored-arrivals-wait-to-sponsor, undertaking:social-assistance-offer).
  if (entry.gate === "partner") ctx.apply([{ type: "people/arrived", route: entry.id }], cause);
  gate.onDepart?.(ctx, entry, held, cause);
  closeHomeOffers(ctx, cause);
  return [...events, ...endBeforeSettingOff(ctx)];
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/** route:friend-tells-by-month: by `hearBy`, anyone who meets `hearIf` has heard, through a friend. Nobody talks routes on the road (place:entries-legal-by-where). */
function hearPhase(ctx: Ctx): BaseEvent[] {
  const month = ctx.state.turn.month;
  const events: RouteKindEvent[] = [];
  if (ctx.state.place.where === "road") return events;
  for (const entry of Object.values(ctx.content.route)) {
    // A route with no `hearBy` is heard of only through an effect (route:friend-tells-by-month).
    if (entry.hearBy === null || routeOf(ctx.state, entry.id).state !== "unknown" || month < entry.hearBy) continue;
    if (banned(readOf(ctx), entry.country)) continue;
    if (allHold(ctx, entry.hearIf)) events.push(moved(entry.id, "heard", FRIEND));
  }
  return events;
}

/** route:refusal-refunds-and-resets: a refund booked by a refusal lands in the pound bank pocket when its month comes. */
function refundArrives(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const due = routeOf(ctx.state, route).depositRefund;
  if (due === null || due.readyMonth > ctx.state.turn.month) return [];
  const events = record(ctx, { type: "route/deposit-refunded", route, amount: due.amount });
  ctx.apply([{ type: "money/add", currency: FUNDS_CURRENCY, pocket: "bank", amount: due.amount, reason: "refund" }], { source: route, param: null, terms: {} });
  return events;
}

/**
 * route:school-answers-by-grade, in the route's school order. One draw on `school` for the
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
 * route:funds-held-month-count. "No visa application pending" is read as the route being
 * `known`: a route applying has one pending, and a granted or departed
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
 * checklist asks to be held (advice:agent-loss-is-the-fee).
 */
export function papersOf(entry: RouteEntry): Id<"document">[] {
  return entry.checklist.flatMap((item) => (item.requirement.type === "document/held" ? [item.requirement.document] : []));
}

/**
 * advice:agent-loss-is-the-fee: a route refuses an application that rests on fake papers,
 * before any draw, with the reason `agent` (the agent's papers did not hold
 * up). Every route's checklist asks for its papers to be genuine, judged by
 * `document/genuine` on each paper held. No ban, since nothing here takes a
 * status or ends a life, so a fake knowingly used carries no route-gates:deception-bans-country
 * deception ban.
 */
function withPapers(read: ReadCtx, entry: RouteEntry, decision: Decision): Decision {
  if (decision.wait === true || decision.override !== null) return decision;
  const fake = papersOf(entry).some(
    (document) => check(read, { type: "document/held", document }).met && !check(read, { type: "document/genuine", document }).met,
  );
  return fake ? { ...decision, override: "agent", bans: false } : decision;
}

/** route:visa-refusal-chance, route:grant-moves-to-granted, route:refusal-refunds-and-resets and route:refusal-reasons-recorded: one draw on `visa`, from the figures recorded on the day of submission. */
function decide(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const held = routeOf(ctx.state, route);
  const month = ctx.state.turn.month;
  if (held.state !== "applying" || held.visa === null || held.visa.decisionMonth > month) return [];
  const { visa } = held;
  const numbers = ctx.content.tuning.route;
  const entry = entryOf(ctx.content, route);
  // route-gates:gate-decision-draw-terms: the gate says which terms the draw reads, and whether something refuses before any draw.
  const decision = withPapers(readOf(ctx), entry, GATES[entry.gate].decision(readOf(ctx), entry, held));
  if (decision.wait === true) return [];
  const refusals = earlierRefusals(readOf(ctx), entry, held);
  const chance = refusalChanceBp(
    numbers,
    entry.refusalBaseBp + (decision.addBp ?? 0),
    { strictness: visa.rules.strictness, unexplainedBp: visa.unexplainedBp, refusals, interviewScore: visa.interviewScore ?? 0, grade: grade(ctx.state) },
    decision.terms,
  );
  if (decision.override === null && !ctx.random.chance("visa", chance)) {
    const granted = record(ctx, moved(route, "granted"));
    return visa.inCountry === true ? [...granted, ...switchInCountry(ctx, entry)] : granted;
  }
  const back = Math.max(0, held.depositPaid - numbers.depositAdminFee);
  // A refund still on its way is kept, not lost, should a second refusal come first.
  const owed = back + (held.depositRefund?.amount ?? 0);
  const refused: RouteKindEvent = {
    type: "route/refused",
    route,
    month,
    reasons: decision.override === null ? refusalReasons(visa, refusals, numbers) : [decision.override, ...refusalReasons(visa, refusals, numbers)],
    depositRefund: owed === 0 ? null : { amount: owed, readyMonth: month + numbers.depositRefundMonths },
  };
  const events = record(ctx, refused);
  const cause: Cause = { source: route, param: null, terms: {} };
  if (held.visa.surchargePaid > 0) ctx.apply([{ type: "money/add", currency: FUNDS_CURRENCY, pocket: "bank", amount: held.visa.surchargePaid, reason: "refund" }], cause);
  if (entry.gate === "study") ctx.apply([{ type: "document/void", document: CAS }], cause);
  // route-gates:deception-bans-country: deception bans every route into the country for the country's months.
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

/**
 * route-gates:in-country-grant-switches-status: an application made inside its country is not flown. Its grant departs in the same phase with no flight and
 * no move, and the route's status replaces the overstay, with the job a sponsor gives and what the gate opens on arrival, as a flight would.
 */
function switchInCountry(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  if (ctx.state.place.where !== "abroad" || ctx.state.place.country !== entry.country) return [];
  const held = routeOf(ctx.state, entry.id);
  const cause: Cause = { source: entry.id, param: null, terms: {} };
  const gate = GATES[entry.gate];
  const job = gate.departureJob?.(entry, held) ?? null;
  const events = record(ctx, moved(entry.id, "departed", IN_COUNTRY));
  if (entry.status !== null) ctx.apply([job === null ? { type: "status/grant", status: entry.status } : { type: "status/grant", status: entry.status, job }], cause);
  if (job !== null) ctx.apply([{ type: "activity/start-job", job }], cause);
  if (entry.gate === "partner") ctx.apply([{ type: "people/arrived", route: entry.id }], cause);
  gate.onDepart?.(ctx, entry, held, cause);
  return events;
}

/** route-gates:in-country-grant-switches-status: the `via` of a departure made with no flight, so its line says the new permission. */
const IN_COUNTRY = "in-country";

/** route-gates:deception-bans-country: a ban lifts in the month it names, and the route is known again. */
function unban(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const held = routeOf(ctx.state, route);
  if (held.state !== "refused" || held.bannedUntil === null || held.bannedUntil > ctx.state.turn.month) return [];
  return record(ctx, { type: "route/unbanned", route });
}

/** route:school-answers-by-grade, route:funds-held-month-count, route:visa-refusal-chance and the refund of route:refusal-refunds-and-resets, route by route in content order. */
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
    case "place/banned":
    case "home/host":
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

/** route:routes-move-along-arrows: an arrow that is not on the page is a bug, never a quiet change. */
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
    case "route/sponsor-missed":
      return slice;
    case "route/refusal-noted":
      return withRoute(slice, event.route, (held) => ({ ...held, refusals: held.refusals + 1, lastRefusal: { month: event.month, reasons: [event.reason] } }));
    case "route/banned":
      return withRoute(slice, event.route, (held) => ({ ...held, state: arrow(held, "refused", event.route), visa: null, bannedUntil: event.until }));
    case "route/unbanned":
      return withRoute(slice, event.route, (held) => ({ ...held, state: arrow(held, "known", event.route), bannedUntil: null }));
    case "route/lapsed":
      return withRoute(slice, event.route, (held) => ({
        ...held,
        state: arrow(held, "known", event.route),
        knownMonth: month,
        schools: {},
        school: null,
        depositPaid: 0,
        funds: { ...held.funds, heldMonths: 0, covered: false },
        visa: null,
        gate: held.gate === null ? null : GATES[held.gate.gate].initial(),
        secret: { sponsorFraud: null },
      }));
    case "route/authorised":
      return withRoute(slice, event.route, (held) => ({ ...held, authorisedMonth: event.month }));
    case "route/withdrawn":
      // person:joint-collapses-with-bond adds the one arrow the diagram lacks: a dependant's unused grant back to known.
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

/** The care route, whose sponsors are trusts and care homes (route-gates.md). */
const CARE_ROUTE: Id<"route"> = "route.uk-care";

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention = false): ReportLine {
  return { key: `line.route.${key}`, params, tone, attention, counts: [] };
}

/** Funds, tuition, deposits and discounts are pence (route:funds-required), shown as pounds. */
function pounds(amount: number): MoneyParam {
  return { currency: FUNDS_CURRENCY, amount };
}

/** advice:four-ways-to-learn-route: the way a route was looked into, for its line. The official page has the plain looked-into line. */
function lookedLine(via: string | undefined): string {
  if (via === undefined) return "looked-into";
  if (via === "activity.ask-someone-who-went") return "looked-into-told";
  if (via === "activity.see-adviser") return "looked-into-advised";
  // Asking around at the park is told as asking around, never as a reading.
  if (via === "activity.ask-around") return "looked-into-asked";
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
      // route-gates:in-country-grant-switches-status: no flight, so the line says the new permission.
      if (event.via === IN_COUNTRY) return [{ ...line("switched", { route }, "good", true), big: true }];
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
      // road:road-route-has-no-figure: the road is never told as a route; its own notes tell the chain.
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
      // The score is never shown (route:view-shows-progress-not-score).
      return [];
    case "route/refused":
      return [line("refused", { route: event.route, reason: event.reasons[0] ?? "credibility" }, "bad", true)];
    case "route/deposit-refunded":
      return [line("deposit-refunded", { route: event.route, amount: pounds(event.amount) }, "good")];
    case "route/supported":
      return [line("supported", { route: event.route, amount: { currency: event.support.currency, amount: event.support.amount } }, "good")];
    case "route/gate-updated":
      // road:road-earns-nothing: the chain's lines are tone `bad`.
      return event.note === null ? [] : [line(event.note, { route: event.route }, event.gate?.gate === "road" ? "bad" : "plain", true)];
    case "route/refusal-noted":
      return [line("refused", { route: event.route, reason: event.reason }, "bad", true)];
    case "route/banned":
      return [line("banned", { route: event.route, month: event.until }, "bad", true)];
    case "route/unbanned":
      return [line("unbanned", { route: event.route }, "plain", true)];
    case "route/withdrawn":
      return [line("withdrawn", { route: event.route }, "bad", true)];
    case "route/lapsed":
      return [line("lapsed", { route: event.route }, "plain")];
    case "route/authorised":
      return [line("authorised", { route: event.route }, "plain")];
    case "route/sponsor-missed":
      // Health care's sponsors are trusts and care homes; the skilled route's are employers.
      return [line(event.route === CARE_ROUTE ? "sponsor-missed" : "sponsor-missed-employer", { route: event.route }, "plain")];
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
function checklistItemView(read: ReadCtx, item: ChecklistItem): ChecklistItemView {
  const result = check(read, item.requirement);
  const have = item.partial && result.have !== undefined ? Math.max(0, result.have) : null;
  const need = item.partial && result.need !== undefined ? result.need : null;
  let earned = 0;
  if (result.met) earned = item.weight;
  else if (have !== null && need !== null && need > 0) earned = Math.min(item.weight, mulDiv(item.weight, have, need));
  return { id: item.id, weight: item.weight, met: result.met, have, need, earned };
}

/** route:looking-into-makes-known: the checklist shows once the route is known, and stays. */
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
    ...authorisationView(read, entry),
  };
}

/** route-gates:canada-return-asks-authorisation: the route's view names what its first application still owes. */
function authorisationView(read: ReadCtx, entry: RouteEntry): Pick<RouteView, "authorisation"> {
  const owing = authorisationOwed(read, entry);
  return owing === null ? {} : { authorisation: owing };
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
  // road:road-truth-asks-more: the road is applying while its chain runs, with no application.
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

/** share:cards-due-at-set-moments: the granted card through the month after a visa is granted (route:grant-moves-to-granted), for the route granted. */
export function grantedCard(read: ReadCtx): PlayerView["card"] {
  if (!cardsAllowed(read)) return null;
  const granted = reportLines(read, "line.route.granted")[0];
  return granted === undefined ? null : cardOf(read, "granted", { route: granted.params.route as Id<"route"> });
}

export const routeKind: RegisteredKind<RouteSlice, RouteKindEvent> = {
  kind: "route",
  // Every route starts unknown (scenario:new-state-starts-clean).
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
    "route/lapse": lapse,
    // Each gate's own effects (route-gates:route-runs-its-gate-steps): the sponsor's record, the road's steps.
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
    // road:road-route-has-no-figure: the road never appears in the routes view. route:looking-into-makes-known: in content order, never the stored state's
    // key order, which a database may hand back reordered, so every client lists the routes the same way.
    routes: (Object.keys(read.content.route) as Id<"route">[]).flatMap((id) => {
      const held = ownOf(read.state.route, id);
      return held === undefined || read.content.route[id]?.gate === "road" ? [] : [routeView(read, id, held)];
    }),
  }),
};
