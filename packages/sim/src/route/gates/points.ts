// The points gate: route-gates:points-score-from-table, route-gates:entering-the-pool, route-gates:pool-draws-invite, route-gates:points-decision-gives-residence and route-gates:profile-lapses-and-score-ages. The score is
// worked out from the state each time it is asked for; the gate keeps only the
// month the profile went into the pool and the month of the invitation. The
// invitation, not a slot, sends the application (route-gates:pool-draws-invite).
import { heldBand, tenureAcross } from "../../activity/activity.logic";
import { check, worldVar } from "../../engine/check";
import { QUALITY } from "../../engine/ids";
import { BP_WHOLE, convertMinor, divFloor, mulDiv } from "../../engine/int";
import { emit, readOf } from "../../engine/kind";
import type {
  BaseEvent,
  Content,
  Ctx,
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
import { CURRENCIES, officialRates } from "../../wallet/wallet.rates";

type PointsBlock = NonNullable<RouteEntry["points"]>;
type PointsState = Extract<RouteGateState, { gate: "points" }>;

const CARE: Id<"quality"> = "quality.care";
/** route-gates:family-gift-counts-with-deed: the notary's deed that makes the family's gift count as the applicant's own money. */
const GIFT_DEED: Id<"document"> = "document.gift-deed";
/** The Canadian line is counted in Canadian cents (route-gates:entering-the-pool). */
const FUNDS_CURRENCY: ForeignCurrency = "CAD";
const MONTHS_PER_YEAR = 12;
/** route-gates:points-score-from-table: one band scores each of the four abilities. */
const ABILITIES = 4;
/** Education after secondary school earns the transferability points (route-gates:points-score-from-table). */
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

/** route-gates:points-score-from-table, part by part, from the state as it is now. */
export function pointsParts(read: ReadCtx, route: Id<"route">): PointsParts {
  return partsFrom(read, tableOf(read.content, blockOf(routeEntry(read.content, route))));
}

function partsFrom(read: ReadCtx, table: PointsEntry): PointsParts {
  const years = divFloor(read.state.quality[QUALITY.age] ?? 0, MONTHS_PER_YEAR);
  const level = read.state.quality[QUALITY.eduLevel] ?? 0;
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

/** person:canada-spouse-points: the table the points block names for the lead's columns with a spouse. */
function spouseTableOf(content: Content, block: PointsBlock): PointsEntry & { spouse: NonNullable<PointsEntry["spouse"]> } {
  const table = block.spouseTable === null ? undefined : content.points[block.spouseTable];
  if (table?.spouse === undefined) throw new Error(`The content has no spouse table for ${block.table}.`);
  return table as PointsEntry & { spouse: NonNullable<PointsEntry["spouse"]> };
}

/**
 * person:canada-spouse-points: the facts of the partner a joint on this route names as the
 * dependant, while the character leads it. Null: the character applies alone.
 */
function spouseOnJoint(read: ReadCtx, route: Id<"route">): PersonFacts | null {
  const joint = read.state.people.joint;
  if (joint === null || joint.route !== route || joint.lead !== "me") return null;
  const bond = read.state.people.bonds[joint.bond];
  return bond === undefined || (bond.stage !== "partner" && bond.stage !== "married") ? null : bond.facts;
}

/**
 * person:canada-spouse-points: the spouse's own factors from the facts, capped: education by
 * `eduLevel`, the band for each of four abilities, and Canadian work. A
 * spouse has Canadian work only while working in the route's country, a
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
 * person:canada-sibling-bonus: `siblingBonus` for a sibling, real or computer, abroad in the
 * route's country with the status the route gives or one after it, aged at
 * least the table's first age, as the people kind judges `people/sibling-abroad`.
 * One is enough.
 */
export function siblingPoints(read: ReadCtx, route: Id<"route">): number {
  const entry = routeEntry(read.content, route);
  const table = tableOf(read.content, blockOf(entry));
  if (entry.country === null) return 0;
  const minAgeMonths = (table.age[0]?.years ?? 0) * MONTHS_PER_YEAR;
  const found = check(read, { type: "people/sibling-abroad", country: entry.country, statuses: residentStatuses(read, entry), minAgeMonths }).met;
  return found ? table.siblingBonus : 0;
}

/** route-gates:points-score-from-table and person:canada-sibling-bonus: the score applying alone. */
export function pointsScoreAlone(read: ReadCtx, route: Id<"route">): number {
  return sumOf(pointsParts(read, route)) + siblingPoints(read, route);
}

/** person:canada-spouse-points, person:canada-sibling-bonus: the score leading with this spouse: the with-spouse columns, the spouse's factors, the sibling. */
export function pointsScoreWith(read: ReadCtx, route: Id<"route">, spouse: PersonFacts): number {
  const table = spouseTableOf(read.content, blockOf(routeEntry(read.content, route)));
  return sumOf(partsFrom(read, table)) + spouseFactors(read, route, spouse) + siblingPoints(read, route);
}

/**
 * route-gates:points-score-from-table: the score, a pure reading of the state. Age makes it a clock
 * (route-gates:profile-lapses-and-score-ages). With a dependant on the joint the lead's score uses the
 * spouse's table (person:canada-spouse-points); a sibling there adds its bonus (person:canada-sibling-bonus).
 */
export function pointsScore(read: ReadCtx, route: Id<"route">): number {
  const spouse = spouseOnJoint(read, route);
  const withSpouse = spouse !== null && blockOf(routeEntry(read.content, route)).spouseTable !== null;
  return spouse === null || !withSpouse ? pointsScoreAlone(read, route) : pointsScoreWith(read, route, spouse);
}

/**
 * route-gates:entering-the-pool with route:funds-shown-exclude-cash's reading in Canadian cents: the bank and
 * locked pockets of every currency and any family support, each pocket
 * converted in one step and rounded down once. Cash never counts.
 */
export function pointsFunds(read: ReadCtx, route: Id<"route">): { shown: number; required: number } {
  const block = blockOf(routeEntry(read.content, route));
  const rates = officialRates(read.world);
  const unproved = giftUncounted(read, route);
  let shown = 0;
  for (const currency of CURRENCIES) {
    const pocket = read.state.wallet.pockets[currency];
    // route-gates:family-gift-counts-with-deed: the gift is left out of the naira bank until its deed is held, never more than the bank holds.
    const bank = currency === "NGN" ? pocket.bank - Math.min(unproved, pocket.bank) : pocket.bank;
    shown += convertMinor(bank, currency, FUNDS_CURRENCY, rates) + convertMinor(pocket.locked, currency, FUNDS_CURRENCY, rates);
  }
  const support = read.state.route[route]?.support ?? null;
  if (support !== null) shown += convertMinor(support.amount, support.currency, FUNDS_CURRENCY, rates);
  return { shown, required: worldVar(read, block.fundsVar) };
}

/** route-gates:family-gift-counts-with-deed: the naira of the family's gift that does not count yet, 0 once its deed is held or with none given. */
function giftUncounted(read: ReadCtx, route: Id<"route">): number {
  const gift = read.state.route[route]?.gift;
  return gift === undefined || gift.deeded ? 0 : gift.amount;
}

/**
 * route-gates:family-gift-counts-with-deed: once the deed is held the gift counts, and its lot is dropped, so it adds nothing to the unexplained share.
 * Read in the `clocks` phase after the papers are issued.
 */
function deedClock(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const gift = ctx.state.route[entry.id]?.gift;
  if (gift === undefined || gift.deeded || !ctx.check({ type: "document/held", document: GIFT_DEED }).met) return [];
  const event: RouteKindEvent = { type: "route/gift-deeded", route: entry.id };
  const events = emit(ctx, "route", [event]);
  ctx.apply([{ type: "money/drop-lot", currency: "NGN", amount: gift.amount, reason: "gift" }], { source: entry.id, param: null, terms: {} });
  return events;
}

/**
 * route:unexplained-share-of-funds against the Canadian line: the wallet's lots in Canadian cents
 * as a share of `fundsVar`, never above the whole.
 */
export function pointsUnexplainedBp(read: ReadCtx, route: Id<"route">): number {
  const rates = officialRates(read.world);
  const lots = read.state.wallet.lots.reduce((sum, lot) => sum + convertMinor(lot.amount, lot.currency, FUNDS_CURRENCY, rates), 0);
  if (lots === 0) return 0;
  const { required } = pointsFunds(read, route);
  return required <= 0 ? BP_WHOLE : Math.min(BP_WHOLE, mulDiv(lots, BP_WHOLE, required));
}

/**
 * route-gates:pool-draws-invite: the education cut-off, while it stands, for a teacher with the table's months across its teacher jobs. It stands
 * while the director's draw holds it below the general cut-off (director:education-draw-opens-for-a-time); otherwise null.
 */
export function educationCutoff(read: ReadCtx, route: Id<"route">): number | null {
  const block = blockOf(routeEntry(read.content, route));
  if (block.educationCutoffVar === null) return null;
  const cutoff = worldVar(read, block.educationCutoffVar);
  return cutoff < worldVar(read, block.cutoffVar) ? cutoff : null;
}

/** route-gates:pool-draws-invite: the months across the table's teacher jobs reach its education months. */
function teaches(read: ReadCtx, table: PointsEntry): boolean {
  return table.educationJobs.length > 0 && tenureAcross(read.state, table.educationJobs) >= table.educationMonths;
}

/** route-gates:pool-draws-invite: the general cut-off at or below the score, the care cut-off for a carer, or the education cut-off for a teacher while it stands. */
export function invites(read: ReadCtx, route: Id<"route">): boolean {
  const block = blockOf(routeEntry(read.content, route));
  const table = tableOf(read.content, block);
  const score = pointsScore(read, route);
  if (worldVar(read, block.cutoffVar) <= score) return true;
  if (block.careCutoffVar !== null && (read.state.quality[CARE] ?? 0) >= table.careMin && worldVar(read, block.careCutoffVar) <= score) return true;
  const education = educationCutoff(read, route);
  return education !== null && teaches(read, table) && education <= score;
}

function windowClosed(read: ReadCtx, entry: RouteEntry): boolean {
  return entry.window !== null && worldVar(read, entry.window) <= 0;
}

function updated(ctx: Ctx, route: Id<"route">, gate: PointsState, note: string | null): BaseEvent[] {
  const event: RouteKindEvent = { type: "route/gate-updated", route, gate, note };
  return emit(ctx, "route", [event]);
}

/**
 * route-gates:entering-the-pool: `route/enter-pool` from the slot. The slot's requirements,
 * the Canadian funds among them, were judged when the turn was accepted; the
 * route kind's funds check reads this gate's line in Canadian cents.
 */
function enterPool(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
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

/** route-gates:pool-draws-invite: the funds are asked when you apply, so `fundsVar` must be covered as the invitation is used, before its fee is taken. */
function fundsCovered(read: ReadCtx, route: Id<"route">): boolean {
  const { shown, required } = pointsFunds(read, route);
  return shown >= required;
}

/** route-gates:canada-funds-checked-at-departure: what the shown funds lack of `fundsVar` today, in Canadian cents; 0 when covered. */
export function fundsShort(read: ReadCtx, route: Id<"route">): number {
  const { shown, required } = pointsFunds(read, route);
  return Math.max(0, required - shown);
}

/** Why an invitation cannot be used now: the fee or the funds; null when it can. */
function invitationShort(ctx: Ctx, entry: RouteEntry, block: PointsBlock): "fee" | "funds" | null {
  if (!canPayFee(ctx, block)) return "fee";
  return fundsCovered(readOf(ctx), entry.id) ? null : "funds";
}

/**
 * route-gates:pool-draws-invite, route:application-fixes-figures: pay the fee as a foreign fee in Canadian cents
 * and send the application, decided `decisionVar` months later. The caller has
 * judged that the fee can be paid.
 *
 * The gate writes the application itself rather than through the
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
 * refusal, a pick of the pool slot is judged, an invitation held for its fee or its funds is used or
 * lapses, a profile lapses at `profileMonths`, and a live profile is invited.
 *
 * A profile entered in month m is live in months m to m + 11 and
 * lapses in m + 12 (route-gates:profile-lapses-and-score-ages). An invitation that cannot be paid stands
 * through the next month's clocks, which try the fee once more, and lapses
 * there if it still cannot be paid; the profile goes on and is looked at again
 * the month after. No invitation comes while the window is closed (route:closed-window-blocks-applying).
 */
function clocks(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const block = blockOf(entry);
  const route = entry.id;
  const month = ctx.state.turn.month;
  const deeded = deedClock(ctx, entry);
  const start = ctx.state.route[route];
  if (start === undefined || start.state !== "known") return deeded;
  const events: BaseEvent[] = [...deeded];
  let gate = gateOf(start);
  // After a refusal the invitation is spent; the pool is entered again from the start.
  if (gate.invitedMonth !== null && start.lastRefusal !== null && start.lastRefusal.month > gate.invitedMonth) {
    gate = { gate: "points", poolMonth: null, invitedMonth: null };
    events.push(...updated(ctx, route, gate, null));
  }
  if (gate.poolMonth === null) return events;
  if (gate.invitedMonth !== null) {
    const held = invitationShort(ctx, entry, block);
    if (held === null) return [...events, ...payAndSend(ctx, entry, block)];
    return [...events, ...updated(ctx, route, { ...gate, invitedMonth: null }, held === "fee" ? "invite-lapsed" : "invite-lapsed-short")];
  }
  if (month >= gate.poolMonth + block.profileMonths) {
    return [...events, ...updated(ctx, route, { gate: "points", poolMonth: null, invitedMonth: null }, "profile-lapsed")];
  }
  const read = readOf(ctx);
  if (windowClosed(read, entry) || !invites(read, route)) return events;
  // The invitation is recorded before the application, so the step is reached when it is sent.
  const held = invitationShort(ctx, entry, block);
  const note = held === null ? "invited" : held === "fee" ? "invite-unpaid" : "invite-short";
  events.push(...updated(ctx, route, { ...gate, invitedMonth: month }, note));
  return held === null ? [...events, ...payAndSend(ctx, entry, block)] : events;
}

export const pointsGate: Gate = {
  gate: "points",
  steps: ["pool", "invited", "gift"],
  initial: () => ({ gate: "points", poolMonth: null, invitedMonth: null }),
  // `pool` is a profile in the pool; `invited` an invitation, unpaid or used; `gift` the family's gift taken (route-gates:family-gift-counts-with-deed).
  reached: (_read, _entry, held, step) => {
    const gate = gateOf(held);
    if (step === "pool") return gate.poolMonth !== null;
    if (step === "invited") return gate.invitedMonth !== null;
    if (step === "gift") return held.gift !== undefined;
    return false;
  },
  // route-gates:pool-draws-invite: the invitation sends the application; no slot does.
  mayApply: () => false,
  // route-gates:points-decision-gives-residence: the unexplained share and earlier refusals, not the strictness.
  decision: () => ({ terms: { strictness: false, unexplained: true, refusals: true, interview: false, goodGrade: false }, override: null, bans: false }),
  clocks,
  effects: {
    "route/enter-pool": (ctx, effect) => {
      if (effect.type !== "route/enter-pool") throw new Error(`route/enter-pool cannot carry out ${effect.type}.`);
      return enterPool(ctx, routeEntry(ctx.content, effect.route));
    },
  },
  // route-gates:entering-the-pool: the settlement funds in Canadian cents are what this route shows.
  funds: (read, entry) => ({ required: worldVar(read, blockOf(entry).fundsVar), currency: FUNDS_CURRENCY }),
  // route-gates:canada-funds-checked-at-departure: the funds must be held when the visa is issued, so the flight asks them again.
  departureShort: (read, entry) => fundsShort(read, entry.id),
  // route-gates:points-score-from-table: the score shows from the moment the route is known.
  view: (read, entry, held) => {
    const block = blockOf(entry);
    const gate = gateOf(held);
    return {
      gate: "points",
      points: pointsScore(read, entry.id),
      cutoff: worldVar(read, block.cutoffVar),
      careCutoff: block.careCutoffVar === null ? null : worldVar(read, block.careCutoffVar),
      // route-gates:points-view-carries-invites: the teachers' cut-off while the draw stands.
      educationCutoff: educationCutoff(read, entry.id),
      // route-gates:canada-funds-checked-at-departure: the way's file says how much is missing.
      fundsShort: fundsShort(read, entry.id),
      // route-gates:points-view-carries-invites: the clocks' own test, the care cut-off for a carer among it.
      invites: invites(read, entry.id),
      poolMonth: gate.poolMonth,
      profileEndsMonth: gate.poolMonth === null ? null : gate.poolMonth + block.profileMonths,
      invitedMonth: gate.invitedMonth,
    };
  },
};
