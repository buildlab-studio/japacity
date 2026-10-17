// The sponsor gate: docs/rules/route-gates.md R-SPONSOR-001 to 007.
//
// This module imports nothing from the route kind or the engine's checker at
// run time: both import the gate table, and the table imports this file.
import { emit, turnSlots } from "../../engine/kind";
import type { BaseEvent, Cause, Content, Ctx, Effect, Id, OfferEntry, ReadCtx, RouteEntry, RouteState, Tuning } from "../../engine/types";
import type { RouteKindEvent } from "../route.events";
import { recordAgent, recordedSalary } from "./contract";
import type { DecisionTerms, Gate } from "./gate";

const FIND: Id<"activity"> = "activity.find-sponsor";
const NETWORK: Id<"quality"> = "quality.network";
const SURCHARGE_YEAR: Id<"var"> = "var.uk-surcharge-year";

type RecordSponsor = Extract<Effect, { type: "route/record-sponsor" }>;
type Sponsor = { employer: string; salary: number };

/** R-SPONSOR-004: strictness, earlier refusals and the good grade; the unexplained share and the interview are not read. */
const SPONSOR_TERMS: DecisionTerms = { strictness: true, unexplained: false, refusals: true, interview: false, goodGrade: true };

function settings(entry: RouteEntry): NonNullable<RouteEntry["sponsor"]> {
  if (entry.sponsor === undefined) throw new Error(`${entry.id} is a sponsor route with no sponsor block.`);
  return entry.sponsor;
}

function varOf(read: ReadCtx, id: Id<"var">): number {
  const value = (read.world.vars as Record<string, number | undefined>)[id];
  if (value === undefined) throw new Error(`The world has no variable ${id}.`);
  return value;
}

function routeOf(read: ReadCtx, id: Id<"route">): RouteState {
  const held = read.state.route[id];
  if (held === undefined) throw new Error(`The state holds no route ${id}.`);
  return held;
}

function sponsorOf(held: RouteState): Sponsor | null {
  return held.gate?.gate === "sponsor" ? held.gate.sponsor : null;
}

/** The salary bar, in pence a year, from the route's world variable (R-SPONSOR-003, 006). */
function salaryBar(read: ReadCtx, entry: RouteEntry): number {
  return varOf(read, settings(entry).salaryVar);
}

/** R-ROUTE-005 for a looked-for sponsor: the window at 1 or more. */
function windowOpen(read: ReadCtx, entry: RouteEntry): boolean {
  return entry.window === null || varOf(read, entry.window) >= 1;
}

/** The best English band held and in date, as the activity kind reads it. */
function englishBand(read: ReadCtx): number | null {
  let best: number | null = null;
  for (const [id, held] of Object.entries(read.state.document)) {
    if (read.content.document[id as Id<"document">]?.result !== "english-band") continue;
    if (held.state !== "held" || held.value === null) continue;
    best = best === null ? held.value : Math.max(best, held.value);
  }
  return best;
}

/** R-SPONSOR-007: the job a sponsor route gives on arrival. */
export function sponsorJob(entry: RouteEntry): Id<"activity"> {
  return settings(entry).job;
}

// ---------------------------------------------------------------------------
// R-SPONSOR-001: looking for a sponsor
// ---------------------------------------------------------------------------

/**
 * R-SPONSOR-001: the route's find figure plus 20 for each point of network,
 * capped at 9500. The 20 and the cap are the job hunt's network
 * figures in tuning, which are the same two numbers.
 */
export function findChanceBp(entry: RouteEntry, network: number, tuning: Tuning["quality"]): number {
  return Math.min(tuning.hireMaxBp, settings(entry).findBp + tuning.networkHireBp * network);
}

function recordsOn(effects: readonly Effect[] | null, route: Id<"route">): boolean {
  return (effects ?? []).some((effect) => effect.type === "route/record-sponsor" && effect.route === route);
}

/** The sponsor offers of a route: the entries whose take records a sponsor on it. */
function sponsorOffers(content: Content, route: Id<"route">): OfferEntry[] {
  return Object.values(content.offer)
    .filter((offer) => offer.choices.some((choice) => recordsOn(choice.effects, route) || recordsOn(choice.fraudEffects, route)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * R-SPONSOR-001: one draw on `job` at the route's find chance. A hit
 * opens one of the route's sponsor offers whose own conditions hold, picked
 * with one more draw on `job` when more than one does, so the offer's own
 * fraud draw and terms decide the rest as for any offer.
 */
export function findSponsor(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const entry = ctx.content.route[route];
  if (entry?.gate !== "sponsor" || routeOf(ctx, route).state !== "known" || !windowOpen(ctx, entry)) return [];
  // A search that finds nobody says so on the month's results, as a job hunt's "not this time" does.
  const missed: RouteKindEvent = { type: "route/sponsor-missed", route };
  if (!ctx.random.chance("job", findChanceBp(entry, ctx.state.quality[NETWORK] ?? 0, ctx.content.tuning.quality))) return emit(ctx, "route", [missed]);
  const offers = sponsorOffers(ctx.content, route).filter((offer) => offer.when.every((requirement) => ctx.check(requirement).met));
  const picked = offers.length > 1 ? offers[ctx.random.int("job", offers.length)] : offers[0];
  if (picked === undefined) return emit(ctx, "route", [missed]);
  ctx.apply([{ type: "offer/open", offer: picked.id }], { source: FIND, param: route, terms: {} });
  return [];
}

/**
 * The finds sent with this turn's slots for this route. The content's
 * `activity.find-sponsor` carries no effect, so the gate's `clocks` reads the
 * turn's slots and rolls each find there, after the slots and in the same month.
 */
function findsThisTurn(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  // R-ACTIVITY-015: the find is sent now and answered with the month, so the month's now-acts are read with its slots.
  const finds = [...turnSlots(ctx), ...(ctx.state.activity.now ?? [])].filter((pick) => pick.activity === FIND && pick.param === entry.id);
  return finds.flatMap(() => findSponsor(ctx, entry.id));
}

// ---------------------------------------------------------------------------
// R-SPONSOR-003: the maintenance funds
// ---------------------------------------------------------------------------

/**
 * R-SPONSOR-003 for a route with a maintenance line: R-ROUTE-011's month-end
 * check with the line in place of the study figure. It runs while the
 * route is known with a sponsor recorded, as the study check runs with a
 * deposit paid. The funds shown are R-ROUTE-010's, read through the route
 * kind's own requirement. The checklist's `funds` item and the apply
 * activity's `route/funds` requirement read the same line, through this gate's
 * `funds`.
 */
function maintenanceCheck(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const line = settings(entry).maintenanceVar;
  const held = routeOf(ctx, entry.id);
  if (line === null || held.state !== "known" || sponsorOf(held) === null) return [];
  const shown = ctx.check({ type: "route/funds", route: entry.id, heldMonths: 0 }).have ?? 0;
  const required = varOf(ctx, line);
  const covered = shown >= required;
  const funds = { heldMonths: covered ? held.funds.heldMonths + 1 : 0, covered, shown, required };
  const event: RouteKindEvent = { type: "route/funds-checked", route: entry.id, funds, was: held.funds.covered };
  return emit(ctx, "route", [event]);
}

// ---------------------------------------------------------------------------
// R-SPONSOR-002: recording a sponsor
// ---------------------------------------------------------------------------

/**
 * R-SPONSOR-002: the employer and the salary in pence a year go on a known
 * route. A fraud's fee was taken by the offer's own fraud effects. A sponsor
 * under the bar is recorded all the same and the line says it cannot be used
 * (R-SPONSOR-006).
 */
function recordSponsor(ctx: Ctx, entry: RouteEntry, effect: RecordSponsor, cause: Cause): BaseEvent[] {
  if (routeOf(ctx, entry.id).state !== "known") return [];
  const sponsor: Sponsor = { employer: effect.employer, salary: recordedSalary(effect, cause.terms) };
  const note = sponsor.salary >= salaryBar(ctx, entry) ? "sponsor-recorded" : "sponsor-under-bar";
  // The fraud rides on the route's secret, never in the view (R-SPONSOR-002).
  const event: RouteKindEvent = { type: "route/gate-updated", route: entry.id, gate: { gate: "sponsor", sponsor }, note, secret: { sponsorFraud: effect.fraud } };
  return emit(ctx, "route", [event]);
}

/**
 * `route/record-sponsor` for every gate: one effect type has one handler, so
 * this module claims it and hands the contract route's agent to its module
 * (R-CONTRACT-002). On any other gate it does nothing (R-GATE-001).
 */
function record(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "route/record-sponsor") throw new Error(`route/record-sponsor cannot carry out ${effect.type}.`);
  const entry = ctx.content.route[effect.route];
  if (entry === undefined) throw new Error(`The content has no route ${effect.route}.`);
  switch (entry.gate) {
    case "sponsor":
      return recordSponsor(ctx, entry, effect, cause);
    case "contract":
      return recordAgent(ctx, entry, effect, cause);
    case "study":
    case "points":
    case "endorsement":
    case "road":
    case "partner":
    case "dependant":
      return [];
    default: {
      const never: never = entry.gate;
      throw new Error(`Unknown gate ${String(never)}.`);
    }
  }
}

export const sponsorGate: Gate = {
  gate: "sponsor",
  steps: ["sponsor", "salary"],
  initial: () => ({ gate: "sponsor", sponsor: null }),
  reached: (read, entry, held, step) => {
    const sponsor = sponsorOf(held);
    if (step === "sponsor") return sponsor !== null;
    if (step === "salary") return sponsor !== null && sponsor.salary >= salaryBar(read, entry);
    return false;
  },
  /**
   * R-SPONSOR-003: the sponsor at the bar, the route's qualification papers,
   * the English band and, with a maintenance line, the funds covered at one
   * month end. As on the study route (R-ROUTE-012), the month end stands for
   * "covered", since the activity's fees come out of the funds shown.
   */
  mayApply: (ctx, entry, held) => {
    const { documents, bandMin, maintenanceVar } = settings(entry);
    if (!sponsorGate.reached(ctx, entry, held, "salary")) return false;
    if (!documents.every((document) => ctx.check({ type: "document/held", document }).met)) return false;
    const band = englishBand(ctx);
    if (band === null || band < bandMin) return false;
    return maintenanceVar === null || held.funds.heldMonths >= 1;
  },
  /** R-SPONSOR-004 and R-GATE-005: a fraud sponsor is refused with the reason `sponsor` before any draw, and that refusal bans. */
  decision: (_read, _entry, held) => {
    const fraud = held.secret.sponsorFraud === true;
    return { terms: SPONSOR_TERMS, override: fraud ? "sponsor" : null, bans: fraud };
  },
  clocks: (ctx, entry) => [...findsThisTurn(ctx, entry), ...maintenanceCheck(ctx, entry)],
  effects: { "route/record-sponsor": record },
  // R-ROUTE-014 for this gate: the route's own strictness and the surcharge its status needs.
  application: (read, entry) => ({
    strictness: varOf(read, settings(entry).strictnessVar),
    surchargePaid: settings(entry).surchargeYears * varOf(read, SURCHARGE_YEAR),
    decisionMonths: read.content.tuning.route.decisionMonths,
  }),
  // The maintenance line is the funds this route shows; the care route shows none (R-SPONSOR-003).
  funds: (read, entry) => {
    const line = settings(entry).maintenanceVar;
    return line === null ? null : { required: varOf(read, line), currency: "GBP" };
  },
  departureJob: (entry) => sponsorJob(entry),
  view: (read, entry, held) => {
    const sponsor = sponsorOf(held);
    return { gate: "sponsor", employer: sponsor?.employer ?? null, salary: sponsor?.salary ?? null, underBar: sponsor !== null && sponsor.salary < salaryBar(read, entry) };
  },
};
