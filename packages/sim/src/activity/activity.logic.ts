// Activities and jobs: docs/rules/activity.md. The month has one main
// activity, the job, and a few free slots. The slot rules read here are judged
// twice: once when `turn/end` is checked (R-ACTIVITY-002), and again when each
// slot resolves (R-ACTIVITY-003), because an earlier slot can change the state.
import { check, resolveAmount } from "../engine/check";
import type { RegisteredKind } from "../engine/kind";
import { emit, turnInProgress, turnSlots } from "../engine/kind";
import { reject } from "../engine/reject";
import type {
  ActivityEntry,
  ActivityOption,
  ActivitySlice,
  BaseEvent,
  Cause,
  Command,
  Content,
  Ctx,
  Currency,
  Id,
  ReadCtx,
  Rejection,
  ReportLine,
  Requirement,
  RequirementResult,
  SlotPick,
  State,
  Tuning,
} from "../engine/types";
import { freeSlots } from "../turn/turn.logic";
import type { ActivityEvent, SlotFailure } from "./activity.events";

const NETWORK: Id<"quality"> = "quality.network";
const TECH: Id<"quality"> = "quality.tech";
const WELLBEING: Id<"quality"> = "quality.wellbeing";
const GRADE: Id<"quality"> = "quality.edu-grade";
/** The offer a landed hunt opens. It learns the job from the terms (R-OFFER-007). */
const JOB_OFFER = "offer.job" as const;
/** The source named on the rest an empty slot gives. */
export const REST_SOURCE = "rest";

/** Judges one requirement. Inside a step it is `ctx.check`; outside, the engine's `check`. */
export type Judge = (requirement: Requirement) => RequirementResult;

/** Applies one of this kind's events at once, so the rest of the handler sees it. */
function record(ctx: Ctx, event: ActivityEvent): BaseEvent[] {
  return emit(ctx, "activity", [event]);
}

const readOf = (ctx: Ctx): ReadCtx => ({ state: ctx.state, world: ctx.world, content: ctx.content });
const judgeOf = (ctx: Ctx): Judge => (requirement) => ctx.check(requirement);

function allHold(requirements: readonly Requirement[], judge: Judge): boolean {
  return requirements.every((requirement) => judge(requirement).met);
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

/**
 * The English band the character holds: the best value among held documents
 * whose result is a band. Null when none is held. Read from the state, since a
 * band is a value and no requirement type returns one.
 */
export function heldBand(read: ReadCtx): number | null {
  let best: number | null = null;
  for (const [id, held] of Object.entries(read.state.document)) {
    if (read.content.document[id as Id<"document">]?.result !== "english-band") continue;
    if (held.state !== "held" || held.value === null) continue;
    best = best === null ? held.value : Math.max(best, held.value);
  }
  return best;
}

/** Jobs that may be hunted: their requirements hold and they are not the job held (R-ACTIVITY-005). */
function huntableJobs(read: ReadCtx, judge: Judge): string[] {
  return Object.values(read.content.activity)
    .filter((entry) => entry.slot === "main" && entry.id !== read.state.activity.job && allHold(entry.requires, judge))
    .map((entry) => entry.id);
}

/** Routes that may be looked into: heard of and not yet known (R-ROUTE-004). */
function heardRoutes(read: ReadCtx): string[] {
  return Object.keys(read.content.route).filter((id) => read.state.route[id as Id<"route">]?.state === "heard");
}

/**
 * Schools that may be applied to (R-ROUTE-006): on a known route, the grade
 * and the band held meet the school's minimums, and there is no application
 * or offer there already. A rejected application counts as one already there.
 */
function openSchools(read: ReadCtx): string[] {
  const band = heldBand(read);
  if (band === null) return [];
  const grade = read.state.quality[GRADE] ?? 0;
  const schools: string[] = [];
  for (const route of Object.values(read.content.route)) {
    const held = read.state.route[route.id];
    if (held?.state !== "known") continue;
    for (const id of route.schools) {
      const school = read.content.school[id];
      if (school === undefined || held.schools[id] !== undefined) continue;
      if (grade >= school.minGrade && band >= school.minBand) schools.push(id);
    }
  }
  return schools;
}

/**
 * The params a free activity may take now (R-ACTIVITY-002). Null when it
 * takes none. Pure: the turn check, each slot as it resolves, the view and
 * the route kind all read the same list. Pass a judge to run inside a step.
 */
export function paramsFor(read: ReadCtx, entry: ActivityEntry, judge: Judge = (requirement) => check(read, requirement)): string[] | null {
  switch (entry.param) {
    case null:
      return null;
    case "job":
      return huntableJobs(read, judge);
    case "route":
      return heardRoutes(read);
    case "school":
      return openSchools(read);
    default: {
      const never: never = entry.param;
      throw new Error(`Unknown param kind ${String(never)}.`);
    }
  }
}

function paramAllowed(read: ReadCtx, entry: ActivityEntry, param: string | null, judge: Judge): boolean {
  const allowed = paramsFor(read, entry, judge);
  return allowed === null ? param === null : param !== null && allowed.includes(param);
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

/**
 * True when every cost could be paid now. Costs in one currency are judged
 * together, so two fees that can each be met alone but not both do not pass.
 */
export function canPayAll(
  costs: readonly { currency: Currency; amount: number }[],
  judge: (requirement: { type: "money/can-pay"; currency: Currency; amount: number }) => { met: boolean },
): boolean {
  const totals = new Map<Currency, number>();
  for (const cost of costs) totals.set(cost.currency, (totals.get(cost.currency) ?? 0) + cost.amount);
  return [...totals].every(([currency, amount]) => judge({ type: "money/can-pay", currency, amount }).met);
}

function resolvedCosts(read: ReadCtx, entry: ActivityEntry): { currency: Currency; amount: number; reason: ActivityEntry["cost"][number]["reason"] }[] {
  return entry.cost.map((cost) => ({ currency: cost.currency, amount: resolveAmount(read, cost.amount), reason: cost.reason }));
}

/** Pays each cost under its own reason: naira from any pocket, cash first; a foreign fee by R-WALLET-009 (R-ACTIVITY-004). */
function payCosts(ctx: Ctx, entry: ActivityEntry, cause: Cause): void {
  for (const cost of resolvedCosts(readOf(ctx), entry)) {
    if (cost.amount <= 0) continue;
    if (cost.currency === "NGN") {
      ctx.apply([{ type: "money/take", currency: "NGN", pocket: "any", amount: cost.amount, reason: cost.reason }], cause);
    } else {
      ctx.apply([{ type: "money/pay-fee", currency: cost.currency, amount: cost.amount, reason: cost.reason }], cause);
    }
  }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/** The chance one month of hunting lands a job (R-ACTIVITY-005). */
export function hireChanceBp(entry: ActivityEntry, network: number, tuning: Tuning["quality"]): number {
  return Math.min(tuning.hireMaxBp, (entry.hireBp ?? 0) + tuning.networkHireBp * network);
}

function jobEntry(content: Content, id: string): ActivityEntry {
  const entry = content.activity[id as Id<"activity">];
  if (entry?.slot !== "main") throw new Error(`${id} is not a job in content.`);
  return entry;
}

/** The job's month (R-ACTIVITY-001): pay to the bank as salary, a month more in the job, then its effects. */
function main(ctx: Ctx): BaseEvent[] {
  const job = ctx.state.activity.job;
  if (job === null) return [];
  const entry = jobEntry(ctx.content, job);
  const cause: Cause = { source: job, param: null, terms: {} };
  if (entry.pay !== null) {
    ctx.apply([{ type: "money/add", currency: entry.pay.currency, pocket: "bank", amount: entry.pay.amount, reason: "salary" }], cause);
  }
  const worked: ActivityEvent = {
    type: "activity/month-worked",
    job,
    tenure: (ctx.state.activity.tenure[job] ?? 0) + 1,
    pay: entry.pay === null ? null : { currency: entry.pay.currency, amount: ctx.amount(entry.pay.amount) },
  };
  const events = record(ctx, worked);
  ctx.apply(entry.effects, cause);
  return events;
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

/** Why a pick may not be played now, or null when it may. Requirements first, then the param, then the cost. */
function slotProblem(ctx: Ctx, entry: ActivityEntry, pick: SlotPick, withCost: boolean): SlotFailure | null {
  const judge = judgeOf(ctx);
  const read = readOf(ctx);
  if (!allHold(entry.requires, judge)) return "requirements";
  if (!paramAllowed(read, entry, pick.param, judge)) return "param";
  if (withCost && !canPayAll(resolvedCosts(read, entry), judge)) return "cost";
  return null;
}

function isPick(value: unknown): value is SlotPick {
  if (typeof value !== "object" || value === null) return false;
  const { activity, param } = value as Record<string, unknown>;
  return typeof activity === "string" && (param === null || typeof param === "string");
}

/** Checks every slot of `turn/end` before anything happens (R-ACTIVITY-002). Never returns events. */
function validateSlots(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "turn/end") throw new Error(`The activity kind cannot validate ${command.type}.`);
  const slots: unknown[] = Array.isArray(command.slots) ? command.slots : [];
  for (const [index, pick] of slots.entries()) {
    const where = `Slot ${String(index + 1)}`;
    if (!isPick(pick)) return reject("not-legal", `${where} is not an activity and a param.`);
    const entry = ctx.content.activity[pick.activity];
    if (entry?.slot !== "free") return reject("not-legal", `${where}: ${pick.activity} is not a free-slot activity.`);
    // Cost is not checked here: a slot that cannot be paid fails when it resolves (R-ACTIVITY-003).
    const problem = slotProblem(ctx, entry, pick, false);
    if (problem === "requirements") return reject("not-legal", `${where}: the requirements of ${entry.id} do not hold.`);
    if (problem === "param") return reject("not-legal", `${where}: ${String(pick.param)} is not a param ${entry.id} may take now.`);
  }
  return [];
}

/** One slot (R-ACTIVITY-003, R-ACTIVITY-004): checked again, paid, then its effects. A failure pays nothing. */
function resolveSlot(ctx: Ctx, pick: SlotPick, slot: number): BaseEvent[] {
  const entry = ctx.content.activity[pick.activity];
  if (entry === undefined) throw new Error(`The slot names ${pick.activity}, which the turn check let through.`);
  const why = slotProblem(ctx, entry, pick, true);
  if (why !== null) {
    return record(ctx, { type: "activity/slot-failed", slot, activity: entry.id, param: pick.param, why });
  }
  const events = record(ctx, { type: "activity/slot-played", slot, activity: entry.id, param: pick.param });
  const cause: Cause = { source: entry.id, param: pick.param, terms: {} };
  payCosts(ctx, entry, cause);
  ctx.apply(entry.effects, cause);
  return events;
}

/**
 * The free slots, first slot first. Then each slot left empty counts as rest
 * (R-TURN-006), and the slots sent are kept for "same again" (R-ACTIVITY-009).
 */
function slots(ctx: Ctx): BaseEvent[] {
  const picks = turnSlots(ctx);
  const events: BaseEvent[] = [];
  picks.forEach((pick, index) => events.push(...resolveSlot(ctx, pick, index)));
  // the count is the one the player saw at the turn check, carried by
  // the engine, not the count after the job's toll in `main`.
  const turn = turnInProgress(ctx);
  const allowed = turn === null ? freeSlots(ctx.state, ctx.content) : turn.freeSlots;
  const empty = Math.max(0, allowed - picks.length);
  if (empty > 0) {
    events.push(...record(ctx, { type: "activity/rested", slots: empty }));
    if (ctx.content.quality[WELLBEING] !== undefined) {
      const amount = empty * ctx.content.tuning.quality.wellbeingRest;
      ctx.apply([{ type: "quality/add", quality: WELLBEING, amount }], { source: REST_SOURCE, param: null, terms: {} });
    }
  }
  events.push(...record(ctx, { type: "activity/slots-recorded", slots: picks.map((pick) => ({ ...pick })) }));
  return events;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/** One month of hunting the job the slot names (R-ACTIVITY-005). A landed hunt opens the job offer with the job in its terms. */
function huntEffect(ctx: Ctx, _effect: unknown, cause: Cause): BaseEvent[] {
  if (cause.param === null) throw new Error(`A hunt from ${cause.source} names no job.`);
  const entry = jobEntry(ctx.content, cause.param);
  const network = ctx.state.quality[NETWORK] ?? 0;
  const hired = ctx.random.chance("job", hireChanceBp(entry, network, ctx.content.tuning.quality));
  const events = record(ctx, { type: "activity/hunted", job: entry.id, hired });
  // content without the job offer has nothing to open, so the landed hunt opens nothing.
  if (hired && ctx.content.offer[JOB_OFFER] !== undefined) {
    ctx.apply([{ type: "offer/open", offer: JOB_OFFER }], { source: cause.source, param: cause.param, terms: { ...cause.terms, job: entry.id } });
  }
  return events;
}

/**
 * Takes the job at once, replacing the one held (R-ACTIVITY-006). The job is
 * named outright or read from the terms in hand. Its requirements are not
 * judged again: they were judged when it was hunted (R-ACTIVITY-005, 007).
 */
function startJobEffect(ctx: Ctx, effect: { job: Id<"activity"> | { term: string } }, cause: Cause): ActivityEvent[] {
  const named = typeof effect.job === "string" ? effect.job : cause.terms[effect.job.term];
  if (typeof named !== "string") throw new Error(`The job to start is not named: ${JSON.stringify(effect.job)}.`);
  const entry = jobEntry(ctx.content, named);
  const previous = ctx.state.activity.job;
  if (previous === entry.id) return [];
  return [{ type: "activity/job-started", job: entry.id, previous }];
}

function endJob(ctx: Ctx, why: string): ActivityEvent[] {
  const job = ctx.state.activity.job;
  return job === null ? [] : [{ type: "activity/job-ended", job, why }];
}

/** A side gig (R-ACTIVITY-008): a draw between its figures plus its figure for each point of tech, in naira cash. */
function gigEffect(ctx: Ctx, effect: { min: number; max: number; perTech: number }, cause: Cause): BaseEvent[] {
  const tech = ctx.state.quality[TECH] ?? 0;
  const amount = ctx.random.between("gig", effect.min, effect.max) + effect.perTech * tech;
  if (amount <= 0) return [];
  const events = record(ctx, { type: "activity/gig-paid", amount });
  ctx.apply([{ type: "money/add", currency: "NGN", pocket: "cash", amount, reason: "gig" }], cause);
  return events;
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

/** Months added across the listed jobs. An empty list means every job. */
export function tenureAcross(state: State, activities: readonly Id<"activity">[]): number {
  const counted = activities.length === 0 ? (Object.keys(state.activity.tenure) as Id<"activity">[]) : activities;
  return counted.reduce((sum, id) => sum + (state.activity.tenure[id] ?? 0), 0);
}

function judgeJob(read: ReadCtx, requirement: Requirement): RequirementResult {
  const job = read.state.activity.job;
  switch (requirement.type) {
    case "job/any":
      return { met: job !== null };
    case "job/none":
      return { met: job === null };
    case "job/is":
      return { met: job !== null && requirement.activities.includes(job) };
    case "activity/tenure": {
      const have = tenureAcross(read.state, requirement.activities);
      return { met: have >= requirement.months, have, need: requirement.months };
    }
    case "quality/min":
    case "quality/max":
    case "document/held":
    case "document/absent":
    case "document/pending":
    case "route/state":
    case "route/offer":
    case "route/deposit":
    case "route/funds":
    case "route/unexplained-max":
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
    case "route/gate-step":
    case "activity/local-tenure":
    case "setpiece/answered":
    case "wallet/total":
    case "place/returned":
    case "place/months-here":
    case "not":
    case "any":
      throw new Error(`The activity kind does not judge ${requirement.type}.`);
    default: {
      const never: never = requirement;
      throw new Error(`Unknown requirement ${JSON.stringify(never)}.`);
    }
  }
}

// ---------------------------------------------------------------------------
// The view and the report
// ---------------------------------------------------------------------------

/** Every free-slot activity as the player may pick it now. `allowed` needs the requirements and, where it takes one, a param to pick. */
export function activityOptions(read: ReadCtx): ActivityOption[] {
  const judge: Judge = (requirement) => check(read, requirement);
  return Object.values(read.content.activity)
    .filter((entry) => entry.slot === "free")
    .map((entry) => {
      const missing = entry.requires.filter((requirement) => !judge(requirement).met);
      const params = paramsFor(read, entry, judge);
      const cost = resolvedCosts(read, entry).map(({ currency, amount }) => ({ currency, amount }));
      return {
        id: entry.id,
        allowed: missing.length === 0 && (params === null || params.length > 0),
        missing,
        params,
        cost,
        affordable: canPayAll(cost, judge),
      };
    });
}

function line(key: string, params: ReportLine["params"], tone: ReportLine["tone"], attention = false): ReportLine {
  return { key, params, tone, attention, counts: [] };
}

function pickParams(activity: Id<"activity">, param: string | null): ReportLine["params"] {
  return param === null ? { activity } : { activity, param };
}

function lines(event: ActivityEvent): ReportLine[] {
  switch (event.type) {
    case "activity/job-started":
      return [line("line.activity.job-started", { job: event.job }, "good")];
    case "activity/job-ended":
      return event.why === "quit"
        ? [line("line.activity.quit", { job: event.job }, "plain")]
        : [line("line.activity.job-ended", { job: event.job }, "bad")];
    case "activity/month-worked":
      return event.pay === null ? [] : [line("line.activity.salary", { job: event.job, amount: event.pay.amount, currency: event.pay.currency }, "good")];
    case "activity/slot-played":
      return [line("line.activity.played", pickParams(event.activity, event.param), "plain")];
    case "activity/slot-failed":
      return [line(`line.activity.failed-${event.why}`, pickParams(event.activity, event.param), "bad")];
    case "activity/rested":
      return [line("line.activity.rested", { slots: event.slots }, "plain")];
    case "activity/hunted":
      // A landed hunt means an offer to answer.
      return event.hired
        ? [line("line.activity.hunt-hired", { job: event.job }, "good", true)]
        : [line("line.activity.hunt-missed", { job: event.job }, "plain")];
    case "activity/gig-paid":
      return [line("line.activity.gig", { amount: event.amount }, "good")];
    case "activity/slots-recorded":
      return [];
    default: {
      const never: never = event;
      throw new Error(`Unknown activity event ${JSON.stringify(never)}.`);
    }
  }
}

function evolve(slice: ActivitySlice, event: ActivityEvent): ActivitySlice {
  switch (event.type) {
    case "activity/job-started":
      return { ...slice, job: event.job };
    case "activity/job-ended":
      // Tenure stays: time served is kept when a job is left (R-ACTIVITY-006).
      return { ...slice, job: null };
    case "activity/month-worked":
      return { ...slice, tenure: { ...slice.tenure, [event.job]: event.tenure } };
    case "activity/slots-recorded":
      return { ...slice, lastSlots: event.slots };
    case "activity/slot-played":
    case "activity/slot-failed":
    case "activity/rested":
    case "activity/hunted":
    case "activity/gig-paid":
      return slice;
    default: {
      const never: never = event;
      throw new Error(`Unknown activity event ${JSON.stringify(never)}.`);
    }
  }
}

export const activityKind: RegisteredKind<ActivitySlice, ActivityEvent> = {
  kind: "activity",
  initial: (scenario) => ({ job: scenario.job, side: null, tenure: { ...scenario.tenure }, lastSlots: [] }),
  commands: {
    "turn/end": validateSlots,
    "activity/quit": (ctx) => {
      if (ctx.state.activity.job === null) return reject("not-legal", "There is no job to quit.");
      return endJob(ctx, "quit");
    },
  },
  effects: {
    "activity/hunt": huntEffect,
    "activity/start-job": (ctx, effect, cause) => {
      if (effect.type !== "activity/start-job") throw new Error(`start-job cannot carry out ${effect.type}.`);
      return startJobEffect(ctx, effect, cause);
    },
    "activity/end-job": (ctx, effect) => {
      if (effect.type !== "activity/end-job") throw new Error(`end-job cannot carry out ${effect.type}.`);
      return endJob(ctx, effect.why);
    },
    "activity/gig": (ctx, effect, cause) => {
      if (effect.type !== "activity/gig") throw new Error(`gig cannot carry out ${effect.type}.`);
      return gigEffect(ctx, effect, cause);
    },
  },
  phases: { main, slots },
  evolve,
  lines,
  requirements: {
    "job/any": judgeJob,
    "job/none": judgeJob,
    "job/is": judgeJob,
    "activity/tenure": judgeJob,
    // Built with life abroad (docs/rules/ladders.md R-LADDER-002). Until then no local tenure is held.
    "activity/local-tenure": () => ({ met: false }),
  },
  invariants(state, content) {
    const problems: string[] = [];
    const { job, tenure, lastSlots } = state.activity;
    if (job !== null && content.activity[job]?.slot !== "main") problems.push(`The job ${job} is not a main-slot activity in content.`);
    for (const [id, months] of Object.entries(tenure)) {
      if (content.activity[id as Id<"activity">]?.slot !== "main") problems.push(`Tenure is kept for ${id}, which is not a job in content.`);
      if (!Number.isSafeInteger(months) || months < 0) problems.push(`Tenure in ${id} is ${String(months)}.`);
    }
    for (const pick of lastSlots) {
      if (content.activity[pick.activity]?.slot !== "free") problems.push(`The last slots name ${pick.activity}, which is not a free-slot activity.`);
    }
    return problems;
  },
  view: (read) => ({
    job: {
      id: read.state.activity.job,
      months: read.state.activity.job === null ? 0 : (read.state.activity.tenure[read.state.activity.job] ?? 0),
    },
    activities: activityOptions(read),
    lastSlots: read.state.activity.lastSlots,
  }),
};
