// The contract gate: docs/rules/route-gates.md R-CONTRACT-001 to 004. Hearing
// (R-CONTRACT-001) and the agent's fee (R-CONTRACT-002) are content's.
import { emit } from "../../engine/kind";
import type { BaseEvent, Cause, Ctx, Effect, Id, RouteEntry, RouteState, Terms } from "../../engine/types";
import type { RouteKindEvent } from "../route.events";
import type { Gate } from "./gate";
import { NO_TERM } from "./gate";

const AGE: Id<"quality"> = "quality.age-months";

type RecordSponsor = Extract<Effect, { type: "route/record-sponsor" }>;
type Agent = { employer: string; salary: number; role: string };

/**
 * The offer's `role` term and what it means (R-CONTRACT-004). The content
 * carries the role as a number, since a term is a number: 1 a guard, 2 a cleaner.
 */
const ROLES: Record<number, { role: string; job: Id<"activity"> }> = {
  1: { role: "guard", job: "activity.job-gulf-guard" },
  2: { role: "cleaner", job: "activity.job-gulf-cleaner" },
};

function settings(entry: RouteEntry): NonNullable<RouteEntry["contract"]> {
  if (entry.contract === undefined) throw new Error(`${entry.id} is a contract route with no contract block.`);
  return entry.contract;
}

export function agentOf(held: RouteState): Agent | null {
  return held.gate?.gate === "contract" ? held.gate.agent : null;
}

/**
 * The salary a record carries (R-SPONSOR-002, R-CONTRACT-002). The content's
 * record names 0 when the salary is a draw, and the offer's `salary` term in
 * hand is the salary.
 */
export function recordedSalary(effect: RecordSponsor, terms: Terms): number {
  if (effect.salary > 0) return effect.salary;
  const salary = terms.salary;
  if (typeof salary !== "number" || !Number.isSafeInteger(salary) || salary < 0) {
    throw new Error(`The record on ${effect.route} names no salary and the terms carry none.`);
  }
  return salary;
}

function roleOf(terms: Terms): { role: string; job: Id<"activity"> } {
  const role = typeof terms.role === "number" ? ROLES[terms.role] : undefined;
  if (role === undefined) throw new Error(`The agent's terms carry no known role: ${String(terms.role)}.`);
  return role;
}

/** R-CONTRACT-004: the job the agent's contract gives on arrival, by its role. Null with no agent. */
export function contractJob(held: RouteState): Id<"activity"> | null {
  const agent = agentOf(held);
  if (agent === null) return null;
  const found = Object.values(ROLES).find((entry) => entry.role === agent.role);
  if (found === undefined) throw new Error(`The agent's role ${agent.role} names no job.`);
  return found.job;
}

/**
 * R-CONTRACT-002: the agent goes on a known route with the contract's salary
 * in fils a month and its role. The fee was taken by the offer's own effect.
 * The sponsor module claims `route/record-sponsor` and hands contract routes
 * here, since one effect type has one handler.
 */
export function recordAgent(ctx: Ctx, entry: RouteEntry, effect: RecordSponsor, cause: Cause): BaseEvent[] {
  const held = ctx.state.route[entry.id];
  if (held?.state !== "known") return [];
  const agent: Agent = { employer: effect.employer, salary: recordedSalary(effect, cause.terms), role: roleOf(cause.terms).role };
  // The fraud rides on the route's secret, never in the view (R-CONTRACT-002).
  const event: RouteKindEvent = { type: "route/gate-updated", route: entry.id, gate: { gate: "contract", agent }, note: "agent-recorded", secret: { sponsorFraud: effect.fraud } };
  return emit(ctx, "route", [event]);
}

export const contractGate: Gate = {
  gate: "contract",
  // The agent's step is named `sponsor`, as the content's checklist and apply activity ask for it.
  steps: ["sponsor"],
  initial: () => ({ gate: "contract", agent: null }),
  reached: (_read, _entry, held, step) => step === "sponsor" && agentOf(held) !== null,
  // R-CONTRACT-003: the agent, the medical, and under the age cap. The passport and the schooling are the slot's.
  mayApply: (ctx, entry, held) => {
    const { medical, maxAgeMonths } = settings(entry);
    if (agentOf(held) === null || !ctx.check({ type: "document/held", document: medical }).met) return false;
    return (ctx.state.quality[AGE] ?? 0) < maxAgeMonths;
  },
  // R-CONTRACT-003: the base alone, and a fraud agent refused whatever the draw. Nothing was forged in
  // the character's name, so the refusal bans nothing (R-GATE-005).
  decision: (_read, _entry, held) => ({ terms: NO_TERM, override: held.secret.sponsorFraud === true ? "agent" : null, bans: false }),
  // R-CONTRACT-003: no fee, no surcharge, no strictness; the employer's flight and the route's status (R-CONTRACT-004).
  application: (read) => ({ strictness: 0, surchargePaid: 0, decisionMonths: read.content.tuning.route.decisionMonths }),
  funds: () => null,
  departureJob: (_entry, held) => contractJob(held),
  view: (_read, _entry, held) => {
    const agent = agentOf(held);
    return { gate: "contract", employer: agent?.employer ?? null, salary: agent?.salary ?? null, role: agent?.role ?? null };
  },
};
