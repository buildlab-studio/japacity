// The partner gate: person:partner-routes-heard-via-bond, person:partner-gate-needs, person:partner-application-decided and person:partner-status-renews, with the sponsor's
// side in undertaking.md. The sponsor is known only by the facts on the bond
// (person:others-known-by-facts), the floor only as `meetsFloor`.
//
// The people kind holds the bonds and the joint; this module only reads them.
import { heldBand } from "../../activity/activity.logic";
import { check, worldVar } from "../../engine/check";
import { QUALITY, VAR } from "../../engine/ids";
import { emit } from "../../engine/kind";
import type { Bond, BondStage, Cause, Ctx, Id, PersonFacts, ReadCtx, RouteEntry, RouteState } from "../../engine/types";
import { bannedNow } from "../../place/place.logic";
import type { RouteKindEvent } from "../route.events";
import type { Decision, DecisionTerms, Gate } from "./gate";

type PartnerBlock = NonNullable<RouteEntry["partner"]>;

/** The stages at which a bond carries a joint application (person:joint-application-proposed). */
const JOINED: readonly BondStage[] = ["partner", "married"];
/** person:partner-application-decided, person:dependant-application-decided: the route's base and 800 for each earlier refusal, and nothing else. */
export const REFUSALS_ONLY: DecisionTerms = { strictness: false, unexplained: false, refusals: true, interview: false, goodGrade: false };

function blockOf(entry: RouteEntry): PartnerBlock {
  if (entry.partner === undefined) throw new Error(`${entry.id} runs the partner gate with no partner block.`);
  return entry.partner;
}

/** The joint's bond, intact, when the other side leads a joint that `matches` (person:joint-application-proposed). */
export function ledBond(read: ReadCtx, matches: (route: Id<"route">) => boolean): { id: string; bond: Bond } | null {
  const joint = read.state.people.joint;
  if (joint === null || joint.lead !== "them" || !matches(joint.route)) return null;
  const bond = read.state.people.bonds[joint.bond];
  return bond !== undefined && JOINED.includes(bond.stage) ? { id: joint.bond, bond } : null;
}

function sponsorOf(read: ReadCtx, entry: RouteEntry): { id: string; bond: Bond } | null {
  return ledBond(read, (route) => route === entry.id);
}

/**
 * person:partner-gate-needs: married, or for a route with `livingTogetherMonths` the bond at
 * `partner` for that many of the applicant's months.
 * The people slice keeps no record of where each side lived month by
 * month, so "while both lived in the same place" is not read; the months since
 * the bond reached `partner` are.
 */
function relationshipHolds(read: ReadCtx, block: PartnerBlock, bond: Bond): boolean {
  if (bond.stage === "married") return true;
  if (block.livingTogetherMonths === null || bond.partnerMonth === null) return false;
  return read.state.turn.month - bond.partnerMonth >= block.livingTogetherMonths;
}

/** person:partner-routes-heard-via-bond, person:partner-gate-needs: the sponsor's facts show them abroad in the route's country holding one of its `sponsorStatuses`. */
function sponsorHolds(entry: RouteEntry, facts: PersonFacts | null): boolean {
  if (facts === null || facts.where !== "abroad" || facts.country !== entry.country || facts.status === null) return false;
  return blockOf(entry).sponsorStatuses.includes(facts.status);
}

/** person:partner-gate-needs, undertaking:sponsor-earnings-floor: a route with a floor needs the sponsor's facts to say it is met; one with none needs nothing. */
function floorHolds(entry: RouteEntry, facts: PersonFacts | null): boolean {
  return blockOf(entry).floorVar === null || facts?.meetsFloor[entry.id] === true;
}

/** person:partner-gate-needs: where the route asks English, a bachelor's degree meets it, as does the degree's English statement (document:degree-english-statement), or the band. */
function bandHolds(read: ReadCtx, block: PartnerBlock): boolean {
  if (block.bandMin === null) return true;
  if ((read.state.quality[QUALITY.eduLevel] ?? 0) >= BACHELORS) return true;
  if (check(read, { type: "document/held", document: STATEMENT }).met) return true;
  const band = heldBand(read);
  return band !== null && band >= block.bandMin;
}

/** A bachelor's degree on the education scale (quality.md). */
const BACHELORS = 3;
const STATEMENT: Id<"document"> = "document.degree-english";

/**
 * The interview's word on an application sent in `submittedMonth`
 * (interview:result-applies-to-application): open or not yet scored is `waiting`, no interview at all
 * is `none`, else the result.
 */
export function interviewSince(read: ReadCtx, route: Id<"route">, submittedMonth: number): "waiting" | "none" | "pass" | "doubt" | "fail" | "caught" {
  const { open, last } = read.state.interview;
  if (open !== null && open.route === route) return "waiting";
  if (last === null || last.route !== route || last.month < submittedMonth) return "none";
  return last.result;
}

/**
 * interview:result-applies-to-application on a decision: `fail` refuses with `relationship` and no
 * draw, `caught` refuses with `sham` and bans the country (route-gates:deception-bans-country),
 * `doubt` adds `tuning.interview.doubtBp`, and `pass` adds nothing.
 */
export function afterInterview(read: ReadCtx, result: "pass" | "doubt" | "fail" | "caught"): Decision {
  switch (result) {
    case "pass":
      return { terms: REFUSALS_ONLY, override: null, bans: false };
    case "doubt":
      return { terms: REFUSALS_ONLY, override: null, bans: false, addBp: read.content.tuning.interview.doubtBp };
    case "fail":
      return { terms: REFUSALS_ONLY, override: "relationship", bans: false };
    case "caught":
      return { terms: REFUSALS_ONLY, override: "sham", bans: true };
    default: {
      const never: never = result;
      throw new Error(`Unknown interview result ${String(never)}.`);
    }
  }
}

/** person:partner-application-decided: the result is waited for; a partner application is never decided without one. */
function decision(read: ReadCtx, entry: RouteEntry, held: RouteState): Decision {
  const result = held.visa === null ? "waiting" : interviewSince(read, entry.id, held.visa.submittedMonth);
  if (result === "waiting" || result === "none") return { terms: REFUSALS_ONLY, override: null, bans: false, wait: true };
  return afterInterview(read, result);
}

/** person:partner-gate-needs: everything applying needs beyond the slot's papers, which the apply activity asks for. */
function mayApply(ctx: Ctx, entry: RouteEntry): boolean {
  const block = blockOf(entry);
  const sponsor = sponsorOf(ctx, entry);
  if (sponsor === null || !relationshipHolds(ctx, block, sponsor.bond)) return false;
  if (!sponsorHolds(entry, sponsor.bond.facts) || !floorHolds(entry, sponsor.bond.facts)) return false;
  // No ban on the country: a deception ban leaves the route refused, a removal's ban is read here until it lifts.
  if (entry.country !== null && bannedNow(ctx, entry.country)) return false;
  return bandHolds(ctx, block);
}

/**
 * The bond the application rests on goes on the route, so a collapse can find
 * it (person:joint-collapses-with-bond), and the genuineness interview opens on it (interview:partner-application-opens-interview).
 */
function onSend(ctx: Ctx, entry: RouteEntry, cause: Cause): void {
  const bond = sponsorOf(ctx, entry)?.id ?? null;
  const event: RouteKindEvent = { type: "route/gate-updated", route: entry.id, gate: { gate: "partner", bond }, note: null };
  emit(ctx, "route", [event]);
  if (bond !== null) ctx.apply([{ type: "interview/open", route: entry.id, bond }], cause);
}

function bondOnRoute(held: RouteState): string | null {
  return held.gate?.gate === "partner" ? held.gate.bond : null;
}

export const partnerGate: Gate = {
  gate: "partner",
  steps: ["married", "sponsor", "floor"],
  initial: () => ({ gate: "partner", bond: null }),
  /** The checklist's steps: the relationship, the sponsor's status in the country, the floor met. */
  reached: (read, entry, _held, step) => {
    const sponsor = sponsorOf(read, entry);
    if (sponsor === null) return false;
    if (step === "married") return relationshipHolds(read, blockOf(entry), sponsor.bond);
    if (step === "sponsor") return sponsorHolds(entry, sponsor.bond.facts);
    if (step === "floor") return sponsorHolds(entry, sponsor.bond.facts) && floorHolds(entry, sponsor.bond.facts);
    return false;
  },
  mayApply: (ctx, entry) => mayApply(ctx, entry),
  decision,
  onSend,
  // route:application-fixes-figures for this gate: no strictness, the surcharge for the route's years, the route's own months to decide.
  application: (read, entry) => {
    const block = blockOf(entry);
    return { strictness: 0, surchargePaid: block.surchargeYears === 0 ? 0 : block.surchargeYears * worldVar(read, VAR.ukSurchargeYear), decisionMonths: block.decisionMonths };
  },
  // The floor is the sponsor's, judged in the sponsor's life; the applicant shows no funds.
  funds: () => null,
  view: (read, entry, held) => {
    const sponsor = sponsorOf(read, entry);
    return { gate: "partner", bond: sponsor?.id ?? bondOnRoute(held), lead: sponsor?.bond.facts?.joint?.state ?? null };
  },
};
