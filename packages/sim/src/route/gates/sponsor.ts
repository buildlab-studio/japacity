// The sponsor gate: the sponsor rules of docs/rules/route-gates.md.
//
// This module imports nothing from the route kind or the engine's checker at
// run time: both import the gate table, and the table imports this file.
import { heldBand } from "../../activity/activity.logic";
import { worldVar } from "../../engine/check";
import { QUALITY, VAR } from "../../engine/ids";
import { emit, turnSlots } from "../../engine/kind";
import type { BaseEvent, Cause, Content, Ctx, Effect, Id, OfferEntry, ReadCtx, RouteEntry, RouteState, Tuning } from "../../engine/types";
import type { RouteKindEvent } from "../route.events";
import { recordAgent, recordedSalary } from "./contract";
import type { DecisionTerms, Gate } from "./gate";

const FIND: Id<"activity"> = "activity.find-sponsor";
/** document:degree-english-statement: the degree's English statement, which always passes. */
const STATEMENT: Id<"document"> = "document.degree-english";

type RecordSponsor = Extract<Effect, { type: "route/record-sponsor" }>;
type Sponsor = { employer: string; salary: number };

/** route-gates:fraud-sponsor-refused: strictness, earlier refusals and the good grade; the unexplained share and the interview are not read. */
const SPONSOR_TERMS: DecisionTerms = { strictness: true, unexplained: false, refusals: true, interview: false, goodGrade: true };

function settings(entry: RouteEntry): NonNullable<RouteEntry["sponsor"]> {
  if (entry.sponsor === undefined) throw new Error(`${entry.id} is a sponsor route with no sponsor block.`);
  return entry.sponsor;
}

function routeOf(read: ReadCtx, id: Id<"route">): RouteState {
  const held = read.state.route[id];
  if (held === undefined) throw new Error(`The state holds no route ${id}.`);
  return held;
}

function sponsorOf(held: RouteState): Sponsor | null {
  return held.gate?.gate === "sponsor" ? held.gate.sponsor : null;
}

/** The salary bar, in pence a year, from the route's world variable (route-gates:sponsor-application-needs, route-gates:skilled-route-needs-degree). */
function salaryBar(read: ReadCtx, entry: RouteEntry): number {
  return worldVar(read, settings(entry).salaryVar);
}

/** route:closed-window-blocks-applying for a looked-for sponsor: the window at 1 or more. */
function windowOpen(read: ReadCtx, entry: RouteEntry): boolean {
  return entry.window === null || worldVar(read, entry.window) >= 1;
}

/** route-gates:nurses-sponsored-while-care-shut: the sponsor recorded is one who may sponsor while the window is shut. */
function sponsorsWhileShut(entry: RouteEntry, held: RouteState): boolean {
  const sponsor = sponsorOf(held);
  return sponsor !== null && settings(entry).openWhileShut.includes(sponsor.employer);
}

/** route-gates:sponsored-status-on-departure: the job a sponsor route gives on arrival. */
export function sponsorJob(entry: RouteEntry): Id<"activity"> {
  return settings(entry).job;
}

// ---------------------------------------------------------------------------
// route-gates:sponsor-offers-come-up: looking for a sponsor
// ---------------------------------------------------------------------------

/**
 * route-gates:sponsor-offers-come-up: the route's find figure plus 20 for each point of network,
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
 * route-gates:sponsor-offers-come-up: one draw on `job` at the route's find chance. A hit
 * opens one of the route's sponsor offers whose own conditions hold, picked
 * with one more draw on `job` when more than one does, so the offer's own
 * fraud draw and terms decide the rest as for any offer.
 */
export function findSponsor(ctx: Ctx, route: Id<"route">): BaseEvent[] {
  const entry = ctx.content.route[route];
  if (entry?.gate !== "sponsor" || routeOf(ctx, route).state !== "known") return [];
  const offers = sponsorOffers(ctx.content, route).filter((offer) => offer.when.every((requirement) => ctx.check(requirement).met));
  // route-gates:nurses-sponsored-while-care-shut: with the window shut, only a post that reads no window may answer, so with none open nothing is drawn.
  if (!windowOpen(ctx, entry) && offers.length === 0) return [];
  // A search that finds nobody says so on the month's results, as a job hunt's "not this time" does.
  const missed: RouteKindEvent = { type: "route/sponsor-missed", route };
  if (!ctx.random.chance("job", findChanceBp(entry, ctx.state.quality[QUALITY.network] ?? 0, ctx.content.tuning.quality))) return emit(ctx, "route", [missed]);
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
  // activity:now-acts-and-month-acts: the find is sent now and answered with the month, so the month's now-acts are read with its slots.
  const finds = [...turnSlots(ctx), ...(ctx.state.activity.now ?? [])].filter((pick) => pick.activity === FIND && pick.param === entry.id);
  return finds.flatMap(() => findSponsor(ctx, entry.id));
}

// ---------------------------------------------------------------------------
// route-gates:sponsor-application-needs: the maintenance funds
// ---------------------------------------------------------------------------

/**
 * route-gates:sponsor-application-needs for a route with a maintenance line: route:funds-held-month-count's month-end
 * check with the line in place of the study figure. It runs while the
 * route is known with a sponsor recorded, as the study check runs with a
 * deposit paid. The funds shown are route:funds-shown-exclude-cash's, read through the route
 * kind's own requirement. The checklist's `funds` item and the apply
 * activity's `route/funds` requirement read the same line, through this gate's
 * `funds`.
 */
function maintenanceCheck(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const line = settings(entry).maintenanceVar;
  const held = routeOf(ctx, entry.id);
  if (line === null || held.state !== "known" || sponsorOf(held) === null) return [];
  const shown = ctx.check({ type: "route/funds", route: entry.id, heldMonths: 0 }).have ?? 0;
  const required = worldVar(ctx, line);
  const covered = shown >= required;
  const funds = { heldMonths: covered ? held.funds.heldMonths + 1 : 0, covered, shown, required };
  const event: RouteKindEvent = { type: "route/funds-checked", route: entry.id, funds, was: held.funds.covered };
  return emit(ctx, "route", [event]);
}

// ---------------------------------------------------------------------------
// route-gates:taking-sponsor-records-it: recording a sponsor
// ---------------------------------------------------------------------------

/**
 * route-gates:taking-sponsor-records-it: the employer and the salary in pence a year go on a known
 * route. A fraud's fee was taken by the offer's own fraud effects. A sponsor
 * under the bar is recorded all the same and the line says it cannot be used
 * (route-gates:skilled-route-needs-degree).
 */
function recordSponsor(ctx: Ctx, entry: RouteEntry, effect: RecordSponsor, cause: Cause): BaseEvent[] {
  if (routeOf(ctx, entry.id).state !== "known") return [];
  const sponsor: Sponsor = { employer: effect.employer, salary: recordedSalary(effect, cause.terms) };
  const note = sponsor.salary >= salaryBar(ctx, entry) ? "sponsor-recorded" : "sponsor-under-bar";
  // The fraud rides on the route's secret, never in the view (route-gates:taking-sponsor-records-it).
  const event: RouteKindEvent = { type: "route/gate-updated", route: entry.id, gate: { gate: "sponsor", sponsor }, note, secret: { sponsorFraud: effect.fraud } };
  return emit(ctx, "route", [event]);
}

/**
 * `route/record-sponsor` for every gate: one effect type has one handler, so
 * this module claims it and hands the contract route's agent to its module
 * (route-gates:gulf-agent-offer). On any other gate it does nothing (route-gates:route-runs-its-gate-steps).
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
  // `open`: the window at 1 or more, or a sponsor recorded who may sponsor while it is shut (route-gates:nurses-sponsored-while-care-shut).
  steps: ["sponsor", "salary", "open"],
  initial: () => ({ gate: "sponsor", sponsor: null }),
  reached: (read, entry, held, step) => {
    const sponsor = sponsorOf(held);
    if (step === "sponsor") return sponsor !== null;
    if (step === "salary") return sponsor !== null && sponsor.salary >= salaryBar(read, entry);
    if (step === "open") return windowOpen(read, entry) || sponsorsWhileShut(entry, held);
    return false;
  },
  appliesShut: (_read, entry, held) => sponsorsWhileShut(entry, held),
  /**
   * route-gates:sponsor-application-needs: the sponsor at the bar, the route's qualification papers,
   * the English (the degree's statement or the band) and, with a maintenance line, the funds covered at one
   * month end. As on the study route (route:visa-application-needs), the month end stands for
   * "covered", since the activity's fees come out of the funds shown.
   */
  mayApply: (ctx, entry, held) => {
    const { documents, bandMin, maintenanceVar } = settings(entry);
    if (!sponsorGate.reached(ctx, entry, held, "salary")) return false;
    if (!documents.every((document) => ctx.check({ type: "document/held", document }).met)) return false;
    // The degree's English statement meets the English (document:degree-english-statement), or else the band.
    const band = heldBand(ctx);
    if (!ctx.check({ type: "document/held", document: STATEMENT }).met && (band === null || band < bandMin)) return false;
    return maintenanceVar === null || held.funds.heldMonths >= 1;
  },
  /** route-gates:fraud-sponsor-refused and route-gates:deception-bans-country: a fraud sponsor is refused with the reason `sponsor` before any draw, and that refusal bans. */
  decision: (_read, _entry, held) => {
    const fraud = held.secret.sponsorFraud === true;
    return { terms: SPONSOR_TERMS, override: fraud ? "sponsor" : null, bans: fraud };
  },
  clocks: (ctx, entry) => [...findsThisTurn(ctx, entry), ...maintenanceCheck(ctx, entry)],
  effects: { "route/record-sponsor": record },
  // route:application-fixes-figures for this gate: the route's own strictness and the surcharge its status needs.
  application: (read, entry) => ({
    strictness: worldVar(read, settings(entry).strictnessVar),
    surchargePaid: settings(entry).surchargeYears * worldVar(read, VAR.ukSurchargeYear),
    decisionMonths: read.content.tuning.route.decisionMonths,
  }),
  // The maintenance line is the funds this route shows; the care route shows none (route-gates:sponsor-application-needs).
  funds: (read, entry) => {
    const line = settings(entry).maintenanceVar;
    return line === null ? null : { required: worldVar(read, line), currency: "GBP" };
  },
  departureJob: (entry) => sponsorJob(entry),
  view: (read, entry, held) => {
    const sponsor = sponsorOf(held);
    return { gate: "sponsor", employer: sponsor?.employer ?? null, salary: sponsor?.salary ?? null, underBar: sponsor !== null && sponsor.salary < salaryBar(read, entry) };
  },
};
