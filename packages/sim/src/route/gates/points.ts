// The points gate: docs/rules/route-gates.md R-POINTS-001 to 005. The score is
// worked out from the state each time it is asked for; the gate keeps only the
// month the profile went into the pool and the month of the invitation. The
// invitation, not a slot, sends the application (R-POINTS-003).
import { heldBand, tenureAcross } from "../../activity/activity.logic";
import { worldVar } from "../../engine/check";
import { BP_WHOLE, convertMinor, divFloor, mulDiv } from "../../engine/int";
import { emit } from "../../engine/kind";
import type {
  BaseEvent,
  Content,
  Ctx,
  Currency,
  ForeignCurrency,
  Id,
  PersonFacts,
  PointsEntry,
  ReadCtx,
  RouteEntry,
  RouteGateState,
  RouteState,
  VisaApplication,
} from "../../engine/types";
import type { RouteKindEvent } from "../route.events";
import type { Gate } from "./gate";

type PointsBlock = NonNullable<RouteEntry["points"]>;
type PointsState = Extract<RouteGateState, { gate: "points" }>;

const AGE: Id<"quality"> = "quality.age-months";
const EDUCATION: Id<"quality"> = "quality.edu-level";
const CARE: Id<"quality"> = "quality.care";
/** The Canadian line is counted in Canadian cents (R-POINTS-002). */
const FUNDS_CURRENCY: ForeignCurrency = "CAD";
const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];
const MONTHS_PER_YEAR = 12;
/** R-POINTS-001: one band scores each of the four abilities. */
const ABILITIES = 4;
/** Education after secondary school earns the transferability points (R-POINTS-001). */
const POST_SECONDARY = 2;

function blockOf(entry: RouteEntry): PointsBlock {
  if (entry.points === undefined) throw new Error(`${entry.id} runs the points gate with no points block.`);
  return entry.points;
}

function tableOf(content: Content, block: PointsBlock): PointsEntry {
  const table = content.points[block.table];
  if (table === undefined) throw new Error(`The content has no points table ${block.table}.`);
  return table;
}

function routeEntry(content: Content, route: Id<"route">): RouteEntry {
  const entry = content.route[route];
  if (entry === undefined) throw new Error(`The content has no route ${route}.`);
  return entry;
}

function gateOf(held: RouteState): PointsState {
  return held.gate?.gate === "points" ? held.gate : { gate: "points", poolMonth: null, invitedMonth: null };
}

/** The points of the last row whose figure is at or below `have`, or 0 below the first row. */
function rowAtOrBelow<T>(rows: readonly T[], figure: (row: T) => number, points: (row: T) => number, have: number): number {
  let found = 0;
  for (const row of rows) if (figure(row) <= have) found = points(row);
  return found;
}

/** The parts of a score, for the view and for the tests of each part. */
export interface PointsParts {
  age: number;
  education: number;
  language: number;
  transfer: number;
}

/** R-POINTS-001, part by part, from the state as it is now. */
export function pointsParts(read: ReadCtx, route: Id<"route">): PointsParts {
  return partsFrom(read, tableOf(read.content, blockOf(routeEntry(read.content, route))));
}

function partsFrom(read: ReadCtx, table: PointsEntry): PointsParts {
  const years = divFloor(read.state.quality[AGE] ?? 0, MONTHS_PER_YEAR);
  const level = read.state.quality[EDUCATION] ?? 0;
  const band = heldBand(read);
  const age = rowAtOrBelow(table.age, (row) => row.years, (row) => row.points, years);
  const education = rowAtOrBelow(table.education, (row) => row.level, (row) => row.points, level);
  const language = band === null ? 0 : ABILITIES * rowAtOrBelow(table.language, (row) => row.band, (row) => row.points, band);
  return { age, education, language, transfer: transferPoints(read, table, level >= POST_SECONDARY, band) };
}

/**
 * Transferability: education after secondary school with the band, and foreign
 * work with the band, capped. The low band is the language table's first row
 * (CLB 7); below it nothing transfers.
 */
function transferPoints(read: ReadCtx, table: PointsEntry, educated: boolean, band: number | null): number {
  const low = table.language[0]?.band;
  if (band === null || low === undefined || band < low) return 0;
  const t = table.transfer;
  const high = band >= t.highBand;
  const months = tenureAcross(read.state, []);
  const education = !educated ? 0 : high ? t.educationHighBand : t.educationLowBand;
  let work = 0;
  if (months >= t.longMonths) work = high ? t.workLongHighBand : t.workLongLowBand;
  else if (months >= t.workMonths) work = high ? t.workHighBand : t.workLowBand;
  return Math.min(t.cap, education + work);
}

function sumOf(parts: PointsParts): number {
  return parts.age + parts.education + parts.language + parts.transfer;
}

/**
 * R-PEOPLE-030: the table with the lead's columns for one with a spouse.
 * the route's points block names one table, so the spouse's is found
 * by name, the route's table with `-spouse` after it.
 */
function spouseTableOf(content: Content, block: PointsBlock): PointsEntry & { spouse: NonNullable<PointsEntry["spouse"]> } {
  const table = content.points[`${block.table}-spouse` as Id<"points">];
  if (table?.spouse === undefined) throw new Error(`The content has no spouse table for ${block.table}.`);
  return table as PointsEntry & { spouse: NonNullable<PointsEntry["spouse"]> };
}

/**
 * R-PEOPLE-030: the facts of the partner a joint on this route names as the
 * dependant, while the character leads it. Null: the character applies alone.
 */
export function spouseOnJoint(read: ReadCtx, route: Id<"route">): PersonFacts | null {
  const joint = read.state.people.joint;
  if (joint === null || joint.route !== route || joint.lead !== "me") return null;
  const bond = read.state.people.bonds[joint.bond];
  return bond === undefined || (bond.stage !== "partner" && bond.stage !== "married") ? null : bond.facts;
}

/**
 * R-PEOPLE-030: the spouse's own factors from the facts, capped: education by
 * `eduLevel`, the band for each of four abilities, and Canadian work. 
 * a spouse has Canadian work only while working in the route's country, a
 * year for each twelve months there.
 */
export function spouseFactors(read: ReadCtx, route: Id<"route">, spouse: PersonFacts): number {
  const entry = routeEntry(read.content, route);
  const factors = spouseTableOf(read.content, blockOf(entry)).spouse;
  const education = rowAtOrBelow(factors.education, (row) => row.level, (row) => row.points, spouse.eduLevel);
  const language = spouse.englishBand === null ? 0 : ABILITIES * rowAtOrBelow(factors.language, (row) => row.band, (row) => row.points, spouse.englishBand);
  const worked = spouse.job !== null && spouse.where === "abroad" && spouse.country === entry.country;
  const years = worked ? divFloor(spouse.monthsInCountry, MONTHS_PER_YEAR) : 0;
  const work = rowAtOrBelow(factors.canadianWork, (row) => row.years, (row) => row.points, years);
  return Math.min(factors.cap, education + language + work);
}

/** The statuses the route leads to in its country: its own, then the settled and citizen ones after it. */
function residentStatuses(read: ReadCtx, entry: RouteEntry): Id<"status">[] {
  const statuses: Id<"status">[] = [];
  let next = entry.status;
  while (next !== null && !statuses.includes(next)) {
    statuses.push(next);
    const status = read.content.status[next];
    next = status?.settled ?? status?.citizen ?? null;
  }
  return statuses;
}

/**
 * R-PEOPLE-031: `siblingBonus` for a sibling, real or computer, abroad in the
 * route's country with the status the route gives or one after it, aged at
 * least the table's first age. One is enough.
 * the people kind judges `people/sibling-abroad`; until it does, the
 * bonds' facts are read here the same way.
 */
export function siblingPoints(read: ReadCtx, route: Id<"route">): number {
  const entry = routeEntry(read.content, route);
  const table = tableOf(read.content, blockOf(entry));
  const statuses = residentStatuses(read, entry);
  const minAgeMonths = (table.age[0]?.years ?? 0) * MONTHS_PER_YEAR;
  const found = Object.values(read.state.people.bonds).some((bond) => {
    const facts = bond.facts;
    if (bond.role !== "sibling" || bond.stage === "ended" || facts === null || facts.status === null) return false;
    return facts.where === "abroad" && facts.country === entry.country && statuses.includes(facts.status) && facts.ageMonths >= minAgeMonths;
  });
  return found ? table.siblingBonus : 0;
}

/** R-POINTS-001 and R-PEOPLE-031: the score applying alone. */
export function pointsScoreAlone(read: ReadCtx, route: Id<"route">): number {
  return sumOf(pointsParts(read, route)) + siblingPoints(read, route);
}

/** R-PEOPLE-030, 031: the score leading with this spouse: the with-spouse columns, the spouse's factors, the sibling. */
export function pointsScoreWith(read: ReadCtx, route: Id<"route">, spouse: PersonFacts): number {
  const table = spouseTableOf(read.content, blockOf(routeEntry(read.content, route)));
  return sumOf(partsFrom(read, table)) + spouseFactors(read, route, spouse) + siblingPoints(read, route);
}

/**
 * R-POINTS-001: the score, a pure reading of the state. Age makes it a clock
 * (R-POINTS-005). With a dependant on the joint the lead's score uses the
 * spouse's table (R-PEOPLE-030); a sibling there adds its bonus (R-PEOPLE-031).
 */
export function pointsScore(read: ReadCtx, route: Id<"route">): number {
  const spouse = spouseOnJoint(read, route);
  return spouse === null ? pointsScoreAlone(read, route) : pointsScoreWith(read, route, spouse);
}

function officialRates(read: ReadCtx): Record<ForeignCurrency, number> {
  const official = {} as Record<ForeignCurrency, number>;
  for (const currency of Object.keys(read.world.rates) as ForeignCurrency[]) official[currency] = read.world.rates[currency].official;
  return official;
}

/**
 * R-POINTS-002 with R-ROUTE-010's reading in Canadian cents: the bank and
 * locked pockets of every currency and any family support, each pocket
 * converted in one step and rounded down once. Cash never counts.
 */
export function pointsFunds(read: ReadCtx, route: Id<"route">): { shown: number; required: number } {
  const block = blockOf(routeEntry(read.content, route));
  const rates = officialRates(read);
  let shown = 0;
  for (const currency of CURRENCIES) {
    const pocket = read.state.wallet.pockets[currency];
    shown += convertMinor(pocket.bank, currency, FUNDS_CURRENCY, rates) + convertMinor(pocket.locked, currency, FUNDS_CURRENCY, rates);
  }
  const support = read.state.route[route]?.support ?? null;
  if (support !== null) shown += convertMinor(support.amount, support.currency, FUNDS_CURRENCY, rates);
  return { shown, required: worldVar(read, block.fundsVar) };
}

/**
 * R-ROUTE-013 against the Canadian line: the wallet's lots in Canadian cents
 * as a share of `fundsVar`, never above the whole.
 */
export function pointsUnexplainedBp(read: ReadCtx, route: Id<"route">): number {
  const rates = officialRates(read);
  const lots = read.state.wallet.lots.reduce((sum, lot) => sum + convertMinor(lot.amount, lot.currency, FUNDS_CURRENCY, rates), 0);
  if (lots === 0) return 0;
  const { required } = pointsFunds(read, route);
  return required <= 0 ? BP_WHOLE : Math.min(BP_WHOLE, mulDiv(lots, BP_WHOLE, required));
}

/** R-POINTS-003: the general cut-off at or below the score, or the care cut-off for a carer. */
export function invites(read: ReadCtx, route: Id<"route">): boolean {
  const block = blockOf(routeEntry(read.content, route));
  const score = pointsScore(read, route);
  if (worldVar(read, block.cutoffVar) <= score) return true;
  const careMin = tableOf(read.content, block).careMin;
  return block.careCutoffVar !== null && (read.state.quality[CARE] ?? 0) >= careMin && worldVar(read, block.careCutoffVar) <= score;
}

function windowClosed(read: ReadCtx, entry: RouteEntry): boolean {
  return entry.window !== null && worldVar(read, entry.window) <= 0;
}

const readOf = (ctx: Ctx): ReadCtx => ({ state: ctx.state, world: ctx.world, content: ctx.content });

function updated(ctx: Ctx, route: Id<"route">, gate: PointsState, note: string | null): BaseEvent[] {
  const event: RouteKindEvent = { type: "route/gate-updated", route, gate, note };
  return emit(ctx, "route", [event]);
}

/**
 * R-POINTS-002: `route/enter-pool` from the slot. The slot's requirements,
 * the Canadian funds among them, were judged when the turn was accepted; the
 * route kind's funds check reads this gate's line in Canadian cents.
 */
export function enterPool(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const held = ctx.state.route[entry.id];
  if (held === undefined || held.state !== "known" || gateOf(held).poolMonth !== null) return [];
  if (windowClosed(readOf(ctx), entry)) return [];
  return updated(ctx, entry.id, { gate: "points", poolMonth: ctx.state.turn.month, invitedMonth: null }, "pool-entered");
}

function feeOf(block: PointsBlock): { var: Id<"var"> } {
  return { var: block.feeVar };
}

function canPayFee(ctx: Ctx, block: PointsBlock): boolean {
  return ctx.check({ type: "money/can-pay", currency: FUNDS_CURRENCY, amount: feeOf(block) }).met;
}

/**
 * R-POINTS-003, R-ROUTE-014: pay the fee as a foreign fee in Canadian cents
 * and send the application, decided `decisionVar` months later. The caller has
 * judged that the fee can be paid.
 *
 * the gate writes the application itself rather than through the
 * shared `sendApplication`, which dates the decision by the tuning's
 * `decisionMonths` (1) and records the study route's surcharge and funds line.
 * The points route pays no surcharge, so a refusal refunds nothing, and its
 * unexplained share is measured against the Canadian line.
 */
function payAndSend(ctx: Ctx, entry: RouteEntry, block: PointsBlock): BaseEvent[] {
  const read = readOf(ctx);
  const month = ctx.state.turn.month;
  const visa: VisaApplication = {
    submittedMonth: month,
    decisionMonth: month + worldVar(read, block.decisionVar),
    rules: { livingLine: 0, livingMonths: 0, strictness: 0 },
    unexplainedBp: pointsUnexplainedBp(read, entry.id),
    interviewScore: null,
    surchargePaid: 0,
  };
  ctx.apply([{ type: "money/pay-fee", currency: FUNDS_CURRENCY, amount: feeOf(block), reason: "fee-visa" }], { source: entry.id, param: null, terms: {} });
  const event: RouteKindEvent = { type: "route/applied", route: entry.id, visa };
  return emit(ctx, "route", [event]);
}

/**
 * The monthly work, in this order: a used invitation is cleared after a
 * refusal, a pick of the pool slot is judged, an unpaid invitation is paid or
 * lapses, a profile lapses at `profileMonths`, and a live profile is invited.
 *
 * a profile entered in month m is live in months m to m + 11 and
 * lapses in m + 12 (R-POINTS-005). An invitation that cannot be paid stands
 * through the next month's clocks, which try the fee once more, and lapses
 * there if it still cannot be paid; the profile goes on and is looked at again
 * the month after. No invitation comes while the window is closed (R-ROUTE-005).
 */
function clocks(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const block = blockOf(entry);
  const route = entry.id;
  const month = ctx.state.turn.month;
  const start = ctx.state.route[route];
  if (start === undefined || start.state !== "known") return [];
  const events: BaseEvent[] = [];
  let gate = gateOf(start);
  // After a refusal the invitation is spent; the pool is entered again from the start.
  if (gate.invitedMonth !== null && start.lastRefusal !== null && start.lastRefusal.month > gate.invitedMonth) {
    gate = { gate: "points", poolMonth: null, invitedMonth: null };
    events.push(...updated(ctx, route, gate, null));
  }
  if (gate.poolMonth === null) return events;
  if (gate.invitedMonth !== null) {
    if (canPayFee(ctx, block)) return [...events, ...payAndSend(ctx, entry, block)];
    return [...events, ...updated(ctx, route, { ...gate, invitedMonth: null }, "invite-lapsed")];
  }
  if (month >= gate.poolMonth + block.profileMonths) {
    return [...events, ...updated(ctx, route, { gate: "points", poolMonth: null, invitedMonth: null }, "profile-lapsed")];
  }
  const read = readOf(ctx);
  if (windowClosed(read, entry) || !invites(read, route)) return events;
  // The invitation is recorded before the application, so the step is reached when it is sent.
  const paid = canPayFee(ctx, block);
  events.push(...updated(ctx, route, { ...gate, invitedMonth: month }, paid ? "invited" : "invite-unpaid"));
  return paid ? [...events, ...payAndSend(ctx, entry, block)] : events;
}

export const pointsGate: Gate = {
  gate: "points",
  steps: ["pool", "invited"],
  initial: () => ({ gate: "points", poolMonth: null, invitedMonth: null }),
  // `pool` is a profile in the pool; `invited` an invitation, unpaid or used.
  reached: (_read, _entry, held, step) => {
    const gate = gateOf(held);
    if (step === "pool") return gate.poolMonth !== null;
    if (step === "invited") return gate.invitedMonth !== null;
    return false;
  },
  // R-POINTS-003: the invitation sends the application; no slot does.
  mayApply: () => false,
  // R-POINTS-004: the unexplained share and earlier refusals, not the strictness.
  decision: () => ({ terms: { strictness: false, unexplained: true, refusals: true, interview: false, goodGrade: false }, override: null, bans: false }),
  clocks,
  effects: {
    "route/enter-pool": (ctx, effect) => {
      if (effect.type !== "route/enter-pool") throw new Error(`route/enter-pool cannot carry out ${effect.type}.`);
      return enterPool(ctx, routeEntry(ctx.content, effect.route));
    },
  },
  // R-POINTS-002: the settlement funds in Canadian cents are what this route shows.
  funds: (read, entry) => ({ required: worldVar(read, blockOf(entry).fundsVar), currency: FUNDS_CURRENCY }),
  // R-POINTS-001: the score shows from the moment the route is known.
  view: (read, entry, held) => {
    const block = blockOf(entry);
    const gate = gateOf(held);
    return {
      gate: "points",
      points: pointsScore(read, entry.id),
      cutoff: worldVar(read, block.cutoffVar),
      careCutoff: block.careCutoffVar === null ? null : worldVar(read, block.careCutoffVar),
      poolMonth: gate.poolMonth,
      profileEndsMonth: gate.poolMonth === null ? null : gate.poolMonth + block.profileMonths,
      invitedMonth: gate.invitedMonth,
    };
  },
};
