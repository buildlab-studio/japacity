// The points gate: docs/rules/route-gates.md R-POINTS-001 to 005. The score is
// worked out from the state each time it is asked for; the gate keeps only the
// month the profile went into the pool and the month of the invitation. The
// invitation, not a slot, sends the application (R-POINTS-003).
import { heldBand, tenureAcross } from "../../activity/activity.logic";
import { worldVar } from "../../engine/check";
import { BP_WHOLE, convertMinor, divFloor, mulDiv } from "../../engine/int";
import { emit, turnSlots } from "../../engine/kind";
import type {
  BaseEvent,
  Cause,
  Content,
  Ctx,
  Currency,
  ForeignCurrency,
  Id,
  PointsEntry,
  ReadCtx,
  Requirement,
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
// the page counts foreign work "12 to 35 months" and the care
// cut-off from `quality.care` 60, but neither number is in content: the
// transfer block has `longMonths` and no lower bound, and the points block has
// no care figure. R-ENGINE-017 wants both in content (`transfer.workMonths`,
// `points.careMin`); until then they live here.
const WORK_FROM_MONTHS = 12;
const CARE_MIN = 60;
// `activity.enter-pool` carries no effect and the contract has no
// `route/enter-pool`, so nothing hands the gate the slot as it resolves. Until
// the effect exists (`{ type: "route/enter-pool"; route }`, carried out by
// `enterPool` below with the slot's cause), the gate reads this turn's slots in
// `clocks` and judges the pick then. That stand-in and this id go when the
// effect arrives.
const ENTER_POOL: Id<"activity"> = "activity.enter-pool";

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
  const table = tableOf(read.content, blockOf(routeEntry(read.content, route)));
  const years = divFloor(read.state.quality[AGE] ?? 0, MONTHS_PER_YEAR);
  const level = read.state.quality[EDUCATION] ?? 0;
  const band = heldBand(read);
  const age = rowAtOrBelow(table.age, (row) => row.years, (row) => row.points, years);
  const education = rowAtOrBelow(table.education, (row) => row.level, (row) => row.points, level);
  const language = band === null ? 0 : ABILITIES * rowAtOrBelow(table.language, (row) => row.band, (row) => row.points, band);
  return { age, education, language, transfer: transferPoints(read, table, education > 0, band) };
}

/**
 * Transferability: education with the band, and foreign work with the band,
 * capped. The low band is the language table's first row (CLB 7); below it
 * nothing transfers.
 *
 * the page counts "education with band 60 or 65" for any education,
 * so secondary school earns it too here. The real grid counts only education
 * after secondary school.
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
  else if (months >= WORK_FROM_MONTHS) work = high ? t.workHighBand : t.workLowBand;
  return Math.min(t.cap, education + work);
}

/** R-POINTS-001: the score, a pure reading of the state. Age makes it a clock (R-POINTS-005). */
export function pointsScore(read: ReadCtx, route: Id<"route">): number {
  const parts = pointsParts(read, route);
  return parts.age + parts.education + parts.language + parts.transfer;
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
  return block.careCutoffVar !== null && (read.state.quality[CARE] ?? 0) >= CARE_MIN && worldVar(read, block.careCutoffVar) <= score;
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
 * R-POINTS-002: the slot's requirements judged again as it resolves, with the
 * route's own funds read in Canadian cents in place of the shared funds line.
 * The carrier for the `route/enter-pool` effect, once there is one.
 */
export function enterPool(ctx: Ctx, entry: RouteEntry, cause: Cause): BaseEvent[] {
  const held = ctx.state.route[entry.id];
  if (held === undefined || held.state !== "known" || gateOf(held).poolMonth !== null) return [];
  const read = readOf(ctx);
  if (windowClosed(read, entry)) return [];
  const requires = ctx.content.activity[cause.source as Id<"activity">]?.requires ?? [];
  const holds = (requirement: Requirement): boolean => {
    if (requirement.type !== "route/funds" || requirement.route !== entry.id) return ctx.check(requirement).met;
    const { shown, required } = pointsFunds(read, entry.id);
    return shown >= required;
  };
  if (!requires.every(holds)) return [];
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
  if (gate.poolMonth === null && turnSlots(ctx).some((pick) => pick.activity === ENTER_POOL)) {
    events.push(...enterPool(ctx, entry, { source: ENTER_POOL, param: null, terms: {} }));
    gate = gateOf(ctx.state.route[route] ?? start);
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
};
