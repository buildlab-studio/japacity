// The dependant gate: docs/rules/people.md R-PEOPLE-019 to 024. The lead is
// known only by the facts on the bond (R-PEOPLE-001).
//
// The people kind holds the bonds and the joint; this module only reads them.
import { worldVar } from "../../engine/check";
import { emit } from "../../engine/kind";
import type { BaseEvent, Bond, Cause, Ctx, Effect, ForeignCurrency, Id, PersonFacts, ReadCtx, Reason, RouteEntry, RouteState } from "../../engine/types";
import type { RouteKindEvent } from "../route.events";
import type { Decision, Gate } from "./gate";
import { afterInterview, interviewSince, ledBond, REFUSALS_ONLY } from "./partner";

type DependantBlock = NonNullable<RouteEntry["dependant"]>;
type Fee = { currency: ForeignCurrency; amount: number; reason: Reason };

function blockOf(entry: RouteEntry): DependantBlock {
  if (entry.dependant === undefined) throw new Error(`${entry.id} runs the dependant gate with no dependant block.`);
  return entry.dependant;
}

/** A route that brings `entry` as its dependants' route (R-PEOPLE-019). */
function leadsTo(read: ReadCtx, route: Id<"route">, entry: RouteEntry): boolean {
  return route === entry.id || read.content.route[route]?.dependants === entry.id;
}

/** R-PEOPLE-022: the joint agreed with the other side leading, and its bond intact. */
function leadOf(read: ReadCtx, entry: RouteEntry): { id: string; bond: Bond } | null {
  return ledBond(read, (route) => leadsTo(read, route, entry));
}

/** R-PEOPLE-020, 021: the lead already holds a status in the route's country whose `dependants` lets a partner join. */
function statusAllows(read: ReadCtx, entry: RouteEntry, facts: PersonFacts): boolean {
  if (facts.where !== "abroad" || facts.country !== entry.country || facts.status === null) return false;
  const status = read.content.status[facts.status];
  if (status === undefined) return false;
  if (status.dependants === "any") return true;
  if (status.dependants === "none") return false;
  return facts.job !== null && status.dependants.includes(facts.job);
}

/** Where the lead stands for this route: still applying, through (granted, departed or a status that allows it), or neither. */
type LeadStanding = "applying" | "through" | "not";

function leadStanding(read: ReadCtx, entry: RouteEntry, facts: PersonFacts | null): LeadStanding {
  if (facts === null) return "not";
  const joint = facts.joint;
  if (joint !== null && leadsTo(read, joint.route, entry)) {
    if (joint.state === "granted" || joint.state === "departed") return "through";
    if (joint.state === "applying") return "applying";
  }
  return statusAllows(read, entry, facts) ? "through" : "not";
}

/**
 * The lead's route: the one the lead's facts or the joint name, else the route
 * that grants the status the lead holds and brings this one. a lead
 * already abroad is taken to have come on that route, for the fee.
 */
function leadRoute(read: ReadCtx, entry: RouteEntry, facts: PersonFacts | null): Id<"route"> | null {
  const named = [facts?.joint?.route, read.state.people.joint?.route];
  for (const route of named) if (route !== undefined && route !== entry.id && read.content.route[route]?.dependants === entry.id) return route;
  if (facts === null || facts.status === null) return null;
  return Object.values(read.content.route).find((route) => route.dependants === entry.id && route.status === facts.status)?.id ?? null;
}

/**
 * R-PEOPLE-022: the fee. With `feeFromLead`, the lead route's visa fee and the
 * surcharge for the lead's years, read from the costs of the activity that
 * applies for the lead's route, which hold exactly those. Else `feeVar` in the
 * country's currency.
 */
export function dependantFee(read: ReadCtx, entry: RouteEntry, facts: PersonFacts | null): Fee[] | null {
  const block = blockOf(entry);
  const fees: Fee[] = [];
  if (block.feeVar !== null) {
    const currency = entry.country === null ? undefined : read.content.country[entry.country]?.currency;
    if (currency === undefined || currency === "NGN") return null;
    fees.push({ currency, amount: worldVar(read, block.feeVar), reason: "fee-visa" });
  }
  if (block.feeFromLead) {
    const route = leadRoute(read, entry, facts);
    const applying = route === null ? undefined : Object.values(read.content.activity).find((activity) => activity.effects.some((effect) => effect.type === "route/apply" && effect.route === route));
    if (applying === undefined) return null;
    for (const cost of applying.cost) {
      if (cost.currency === "NGN" || typeof cost.amount === "object" && "term" in cost.amount) return null;
      fees.push({ currency: cost.currency, amount: typeof cost.amount === "number" ? cost.amount : worldVar(read, cost.amount.var), reason: cost.reason });
    }
  }
  return fees;
}

/** R-PEOPLE-022: the maintenance funds are asked for unless the route has none or the lead has `leadMonthsExempt` months in the country. */
function maintenanceAsked(entry: RouteEntry, facts: PersonFacts | null): boolean {
  const block = blockOf(entry);
  if (block.maintenanceVar === null) return false;
  return block.leadMonthsExempt === null || facts === null || facts.monthsInCountry < block.leadMonthsExempt;
}

function canPay(ctx: Ctx, fees: readonly Fee[]): boolean {
  const totals = new Map<ForeignCurrency, number>();
  for (const fee of fees) totals.set(fee.currency, (totals.get(fee.currency) ?? 0) + fee.amount);
  return [...totals].every(([currency, amount]) => ctx.check({ type: "money/can-pay", currency, amount }).met);
}

function mayApply(ctx: Ctx, entry: RouteEntry, held: RouteState): boolean {
  const lead = leadOf(ctx, entry);
  if (lead === null) return false;
  const facts = lead.bond.facts;
  if (leadStanding(ctx, entry, facts) === "not") return false;
  // R-PEOPLE-022, as R-SPONSOR-003 reads "covered at one month end".
  if (maintenanceAsked(entry, facts) && held.funds.heldMonths < 1) return false;
  const fees = dependantFee(ctx, entry, facts);
  return fees !== null && canPay(ctx, fees);
}

/**
 * The fee is paid as the application goes in, as foreign fees (R-WALLET-009),
 * the bond is noted on the route, and the interview is asked to open, which it
 * does only over a thin record (R-INTERVIEW-002).
 */
function onSend(ctx: Ctx, entry: RouteEntry, cause: Cause): void {
  const lead = leadOf(ctx, entry);
  const fees = dependantFee(ctx, entry, lead?.bond.facts ?? null) ?? [];
  const pay: Effect[] = fees.map((fee) => ({ type: "money/pay-fee", currency: fee.currency, amount: fee.amount, reason: fee.reason }));
  ctx.apply(pay, cause);
  const event: RouteKindEvent = { type: "route/gate-updated", route: entry.id, gate: { gate: "dependant", bond: lead?.id ?? null }, note: null };
  emit(ctx, "route", [event]);
  if (lead !== null) ctx.apply([{ type: "interview/open", route: entry.id, bond: lead.id }], cause);
}

/**
 * R-PEOPLE-023: waits while the lead's route is applying; refused with `lead`
 * when the lead is neither through nor applying; else the interview where one
 * was held, then one draw with earlier refusals only.
 */
function decision(read: ReadCtx, entry: RouteEntry, held: RouteState): Decision {
  const lead = leadOf(read, entry);
  const standing = leadStanding(read, entry, lead?.bond.facts ?? null);
  if (standing === "applying") return { terms: REFUSALS_ONLY, override: null, bans: false, wait: true };
  if (standing === "not") return { terms: REFUSALS_ONLY, override: "lead", bans: false };
  const result = held.visa === null ? "none" : interviewSince(read, entry.id, held.visa.submittedMonth);
  if (result === "waiting") return { terms: REFUSALS_ONLY, override: null, bans: false, wait: true };
  // A dependant application without an interview never waits for one (R-INTERVIEW-009).
  if (result === "none") return { terms: REFUSALS_ONLY, override: null, bans: false };
  return afterInterview(read, result);
}

/**
 * R-PEOPLE-022, as R-ROUTE-011 runs: the maintenance covered at each month end
 * while the route is known with a lead to follow. Once the lead has their year
 * in the country nothing is required, so the month end is covered all the same
 * and the apply activity's `route/funds` holds.
 */
function clocks(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const held = ctx.state.route[entry.id];
  const block = blockOf(entry);
  const lead = leadOf(ctx, entry);
  if (held === undefined || held.state !== "known" || lead === null || block.maintenanceVar === null) return [];
  const shown = ctx.check({ type: "route/funds", route: entry.id, heldMonths: 0 }).have ?? 0;
  const required = maintenanceAsked(entry, lead.bond.facts) ? worldVar(ctx, block.maintenanceVar) : 0;
  const covered = shown >= required;
  const funds = { heldMonths: covered ? held.funds.heldMonths + 1 : 0, covered, shown, required };
  const event: RouteKindEvent = { type: "route/funds-checked", route: entry.id, funds, was: held.funds.covered };
  return emit(ctx, "route", [event]);
}

/**
 * R-PEOPLE-024: a status whose `months` is `lead` lasts as long as the lead's,
 * from the facts on the joint's bond. Null: the lead's does not expire. The
 * status kind reads it when it grants such a status.
 */
export function leadStatusMonths(read: ReadCtx): number | null {
  const joint = read.state.people.joint;
  const facts = joint === null ? null : (read.state.people.bonds[joint.bond]?.facts ?? null);
  return facts?.statusMonthsLeft ?? null;
}

export const dependantGate: Gate = {
  gate: "dependant",
  steps: ["joint", "lead"],
  initial: () => ({ gate: "dependant", bond: null }),
  /** `joint`: the joint agreed with the other side leading. `lead`: the lead's route applying or through, or a status that allows it. */
  reached: (read, entry, _held, step) => {
    const lead = leadOf(read, entry);
    if (step === "joint") return lead !== null;
    if (step === "lead") return lead !== null && leadStanding(read, entry, lead.bond.facts) !== "not";
    return false;
  },
  mayApply,
  decision,
  onSend,
  clocks,
  // R-ROUTE-014 for this gate: no strictness; the surcharge part of the fee is what a refusal or a withdrawal refunds.
  application: (read, entry) => {
    const lead = leadOf(read, entry);
    const fees = dependantFee(read, entry, lead?.bond.facts ?? null) ?? [];
    const surchargePaid = fees.filter((fee) => fee.reason === "fee-surcharge").reduce((sum, fee) => sum + fee.amount, 0);
    return { strictness: 0, surchargePaid, decisionMonths: blockOf(entry).decisionMonths };
  },
  // The maintenance line, in the country's currency, while it is asked for; none once the lead has a year there.
  funds: (read, entry) => {
    const block = blockOf(entry);
    const currency = entry.country === null ? undefined : read.content.country[entry.country]?.currency;
    if (block.maintenanceVar === null || currency === undefined || currency === "NGN" || !maintenanceAsked(entry, leadOf(read, entry)?.bond.facts ?? null)) return null;
    return { required: worldVar(read, block.maintenanceVar), currency };
  },
  view: (read, entry, held) => {
    const lead = leadOf(read, entry);
    return { gate: "dependant", bond: lead?.id ?? (held.gate?.gate === "dependant" ? held.gate.bond : null), lead: lead?.bond.facts?.joint?.state ?? null };
  },
};
