// The partner gate: docs/rules/people.md R-PEOPLE-025 to 028, with the sponsor's
// side in undertaking.md. The sponsor lives abroad and is known here only by the
// facts on the bond (R-PEOPLE-001): applying reads the relationship, the joint
// agreed with the sponsor as lead, the sponsor's status in the country and the
// floor as `meetsFloor`, never a figure. The decision waits for the genuineness
// interview's result (R-INTERVIEW-009) and reads earlier refusals only.
//
// The people kind holds the bonds and the joint; this module only reads them.
import { heldBand } from "../../activity/activity.logic";
import { worldVar } from "../../engine/check";
import { emit } from "../../engine/kind";
import type { Bond, BondStage, Ctx, Id, PersonFacts, ReadCtx, RouteEntry, RouteState } from "../../engine/types";
import { bannedUntil } from "../../place/place.logic";
import type { RouteKindEvent } from "../route.events";
import type { Decision, DecisionTerms, Gate } from "./gate";

type PartnerBlock = NonNullable<RouteEntry["partner"]>;

const SURCHARGE_YEAR: Id<"var"> = "var.uk-surcharge-year";
/** The stages at which a bond carries a joint application (R-PEOPLE-021). */
export const JOINED: readonly BondStage[] = ["partner", "married"];
/** R-PEOPLE-027, R-PEOPLE-023: the route's base and 800 for each earlier refusal, and nothing else. */
export const REFUSALS_ONLY: DecisionTerms = { strictness: false, unexplained: false, refusals: true, interview: false, goodGrade: false };

function blockOf(entry: RouteEntry): PartnerBlock {
  if (entry.partner === undefined) throw new Error(`${entry.id} runs the partner gate with no partner block.`);
  return entry.partner;
}

/** The joint's bond, intact, when the other side leads a joint that `matches` (R-PEOPLE-021). */
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
 * R-PEOPLE-026: married, or for a route with `livingTogetherMonths` the bond at
 * `partner` for that many of the applicant's months.
 * the people slice keeps no record of where each side lived month by
 * month, so "while both lived in the same place" is not read; the months since
 * the bond reached `partner` are.
 */
function relationshipHolds(read: ReadCtx, block: PartnerBlock, bond: Bond): boolean {
  if (bond.stage === "married") return true;
  if (block.livingTogetherMonths === null || bond.partnerMonth === null) return false;
  return read.state.turn.month - bond.partnerMonth >= block.livingTogetherMonths;
}

/** R-PEOPLE-025, 026: the sponsor's facts show them abroad in the route's country holding one of its `sponsorStatuses`. */
export function sponsorHolds(entry: RouteEntry, facts: PersonFacts | null): boolean {
  if (facts === null || facts.where !== "abroad" || facts.country !== entry.country || facts.status === null) return false;
  return blockOf(entry).sponsorStatuses.includes(facts.status);
}

/** R-PEOPLE-026, R-UNDERTAKING-003: a route with a floor needs the sponsor's facts to say it is met; one with none needs nothing. */
function floorHolds(entry: RouteEntry, facts: PersonFacts | null): boolean {
  return blockOf(entry).floorVar === null || facts?.meetsFloor[entry.id] === true;
}

function bandHolds(read: ReadCtx, block: PartnerBlock): boolean {
  if (block.bandMin === null) return true;
  const band = heldBand(read);
  return band !== null && band >= block.bandMin;
}

/**
 * The interview's word on an application sent in `submittedMonth`
 * (R-INTERVIEW-009): open or not yet scored is `waiting`, no interview at all
 * is `none`, else the result.
 */
export function interviewSince(read: ReadCtx, route: Id<"route">, submittedMonth: number): "waiting" | "none" | "pass" | "doubt" | "fail" | "caught" {
  const { open, last } = read.state.interview;
  if (open !== null && open.route === route) return "waiting";
  if (last === null || last.route !== route || last.month < submittedMonth) return "none";
  return last.result;
}

/**
 * R-INTERVIEW-009 on a decision: `fail` refuses with `relationship` and no
 * draw, `caught` refuses with `sham` and bans the country (R-GATE-005),
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

/** R-PEOPLE-027: the result is waited for; a partner application is never decided without one. */
function decision(read: ReadCtx, entry: RouteEntry, held: RouteState): Decision {
  const result = held.visa === null ? "waiting" : interviewSince(read, entry.id, held.visa.submittedMonth);
  if (result === "waiting" || result === "none") return { terms: REFUSALS_ONLY, override: null, bans: false, wait: true };
  return afterInterview(read, result);
}

/** R-PEOPLE-026: everything applying needs beyond the slot's papers, which the apply activity asks for. */
function mayApply(ctx: Ctx, entry: RouteEntry): boolean {
  const block = blockOf(entry);
  const sponsor = sponsorOf(ctx, entry);
  if (sponsor === null || !relationshipHolds(ctx, block, sponsor.bond)) return false;
  if (!sponsorHolds(entry, sponsor.bond.facts) || !floorHolds(entry, sponsor.bond.facts)) return false;
  // No ban on the country: a deception ban leaves the route refused, a removal's ban is read here.
  if (entry.country !== null && bannedUntil(ctx, entry.country) !== null) return false;
  return bandHolds(ctx, block);
}

/** The bond the application rests on goes on the route, so a collapse can find it (R-PEOPLE-036). */
function onSend(ctx: Ctx, entry: RouteEntry): void {
  const bond = sponsorOf(ctx, entry)?.id ?? null;
  const event: RouteKindEvent = { type: "route/gate-updated", route: entry.id, gate: { gate: "partner", bond }, note: null };
  emit(ctx, "route", [event]);
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
  // R-ROUTE-014 for this gate: no strictness, the surcharge for the route's years, the route's own months to decide.
  application: (read, entry) => {
    const block = blockOf(entry);
    return { strictness: 0, surchargePaid: block.surchargeYears === 0 ? 0 : block.surchargeYears * worldVar(read, SURCHARGE_YEAR), decisionMonths: block.decisionMonths };
  },
  // The floor is the sponsor's, judged in the sponsor's life; the applicant shows no funds.
  funds: () => null,
  view: (read, entry, held) => {
    const sponsor = sponsorOf(read, entry);
    return { gate: "partner", bond: sponsor?.id ?? bondOnRoute(held), lead: sponsor?.bond.facts?.joint?.state ?? null };
  },
};
