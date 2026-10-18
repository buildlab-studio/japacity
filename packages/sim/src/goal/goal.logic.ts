// Life goals: docs/rules/goal.md. A goal opens when its `openIf` holds and is
// done when its `doneIf` holds. Goals gate nothing and refill nothing: they
// are what the view offers once the chapters are over (goal:done-goal-stays-done).
import { check } from "../engine/check";
import type { RegisteredKind } from "../engine/kind";
import { emit } from "../engine/kind";
import type { BaseEvent, Cause, Content, Ctx, Effect, GoalEntry, GoalSlice, Id, PlayerView, ReadCtx, ReportLine, Requirement, RequirementResult, State } from "../engine/types";
import { appliesHere } from "../place/place.logic";
import type { GoalEvent } from "./goal.events";

function entryOf(content: Content, id: Id<"goal">): GoalEntry {
  const entry = content.goal[id];
  if (entry === undefined) throw new Error(`The content has no goal ${id}.`);
  return entry;
}

/** Every goal in id order, so the phase opens and finishes them in the same order on every machine. */
function byId(content: Content): GoalEntry[] {
  return Object.values(content.goal).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function isOpen(state: State, goal: Id<"goal">): boolean {
  return state.goal.open[goal] !== undefined;
}

function isDone(state: State, goal: Id<"goal">): boolean {
  return state.goal.done[goal] !== undefined;
}

/** Opens a goal that is neither open nor done. */
function openGoal(ctx: Ctx, goal: Id<"goal">): BaseEvent[] {
  if (isOpen(ctx.state, goal) || isDone(ctx.state, goal)) return [];
  const opened: GoalEvent = { type: "goal/opened", goal, month: ctx.state.turn.month };
  return emit(ctx, "goal", [opened]);
}

/** goal:goals-open-and-complete: done, then the reward once, under the goal as source. A goal already done is left as it is (goal:done-goal-stays-done). */
function finishGoal(ctx: Ctx, goal: Id<"goal">): BaseEvent[] {
  if (isDone(ctx.state, goal)) return [];
  const finished: GoalEvent = { type: "goal/done", goal, month: ctx.state.turn.month };
  const events = emit(ctx, "goal", [finished]);
  const cause: Cause = { source: goal, param: null, terms: {} };
  ctx.apply(entryOf(ctx.content, goal).reward, cause);
  return events;
}

/**
 * goal:goals-open-and-complete. Runs in the `chapter` phase; the goal kind comes after the
 * chapter kind in the registry, so chapters are judged first. Every goal not
 * yet open whose `openIf` holds where it applies (place:entries-legal-by-where) opens; then
 * every open goal whose `doneIf` holds is done, the ones just opened included.
 * `where` decides where a goal opens; an open goal is judged done
 * wherever the character is, since its `doneIf` says what it needs.
 */
function judge(ctx: Ctx): BaseEvent[] {
  const events: BaseEvent[] = [];
  const met = (requirements: readonly Requirement[]): boolean => requirements.every((requirement) => ctx.check(requirement).met);
  for (const entry of byId(ctx.content)) {
    if (isOpen(ctx.state, entry.id) || isDone(ctx.state, entry.id)) continue;
    if (appliesHere(entry, ctx.state) && met(entry.openIf)) events.push(...openGoal(ctx, entry.id));
  }
  for (const entry of byId(ctx.content)) {
    if (isOpen(ctx.state, entry.id) && met(entry.doneIf)) events.push(...finishGoal(ctx, entry.id));
  }
  return events;
}

/** `goal/open` opens the goal whatever its `openIf` says. */
function openByEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "goal/open") throw new Error(`goal/open cannot carry out ${effect.type}.`);
  return openGoal(ctx, entryOf(ctx.content, effect.goal).id);
}

/** `goal/done` finishes the goal, open or not, with its reward. */
function doneByEffect(ctx: Ctx, effect: Effect): BaseEvent[] {
  if (effect.type !== "goal/done") throw new Error(`goal/done cannot carry out ${effect.type}.`);
  return finishGoal(ctx, entryOf(ctx.content, effect.goal).id);
}

function evolve(slice: GoalSlice, event: GoalEvent): GoalSlice {
  switch (event.type) {
    case "goal/opened":
      return { ...slice, open: { ...slice.open, [event.goal]: { openedMonth: event.month } } };
    case "goal/done": {
      // goal:done-goal-stays-done: done only grows, and a done goal is no longer open.
      const open = { ...slice.open };
      delete open[event.goal];
      return { open, done: { ...slice.done, [event.goal]: { month: event.month } } };
    }
    default: {
      const never: never = event;
      throw new Error(`Unknown goal event ${JSON.stringify(never)}.`);
    }
  }
}

/** A goal done is a moment: it asks for attention. An opening is quieter. */
function lines(event: GoalEvent): ReportLine[] {
  switch (event.type) {
    case "goal/opened":
      return [{ key: "line.goal.opened", params: { goal: event.goal }, tone: "plain", attention: false, counts: [] }];
    case "goal/done":
      return [{ key: "line.goal.done", params: { goal: event.goal }, tone: "good", attention: true, counts: [] }];
    default: {
      const never: never = event;
      throw new Error(`Unknown goal event ${JSON.stringify(never)}.`);
    }
  }
}

/** `goal/done`: the goal has been done, whatever has happened since (goal:done-goal-stays-done). */
function judgeDone(read: ReadCtx, requirement: Requirement): RequirementResult {
  if (requirement.type !== "goal/done") throw new Error(`The goal kind cannot judge ${requirement.type}.`);
  return { met: isDone(read.state, requirement.goal) };
}

/**
 * goal:view-shows-goal-items: open goals by the month they opened, then by id, each `doneIf`
 * requirement an item met or not; its id is its place in `doneIf`, which is
 * where the interface finds its words (`<goal>.item.<id>`, else the
 * requirement itself). The done list by month, then by id.
 */
function view(read: ReadCtx): Pick<PlayerView, "goals"> {
  const { open, done } = read.state.goal;
  const openIds = (Object.keys(open) as Id<"goal">[]).sort((a, b) => (open[a]?.openedMonth ?? 0) - (open[b]?.openedMonth ?? 0) || (a < b ? -1 : a > b ? 1 : 0));
  const doneIds = (Object.keys(done) as Id<"goal">[]).sort((a, b) => (done[a]?.month ?? 0) - (done[b]?.month ?? 0) || (a < b ? -1 : a > b ? 1 : 0));
  return {
    goals: {
      open: openIds.map((id) => ({
        id,
        items: entryOf(read.content, id).doneIf.map((requirement, index) => ({ id: String(index), met: check(read, requirement).met })),
      })),
      done: doneIds.map((id) => ({ id, month: done[id]?.month ?? 0 })),
    },
  };
}

function invariants(state: State, content: Content): string[] {
  const problems: string[] = [];
  for (const [id, held] of Object.entries(state.goal.open)) {
    if (content.goal[id as Id<"goal">] === undefined) problems.push(`The open goal ${id} is not in content.`);
    if (state.goal.done[id as Id<"goal">] !== undefined) problems.push(`The goal ${id} is both open and done.`);
    if (held.openedMonth > state.turn.month) problems.push(`The goal ${id} opened in month ${String(held.openedMonth)}, after this one.`);
  }
  for (const [id, held] of Object.entries(state.goal.done)) {
    if (content.goal[id as Id<"goal">] === undefined) problems.push(`The done goal ${id} is not in content.`);
    if (held.month > state.turn.month) problems.push(`The goal ${id} was done in month ${String(held.month)}, after this one.`);
  }
  return problems;
}

export const goalKind: RegisteredKind<GoalSlice, GoalEvent> = {
  kind: "goal",
  initial: () => ({ open: {}, done: {} }),
  effects: { "goal/open": openByEffect, "goal/done": doneByEffect },
  phases: { chapter: judge },
  evolve,
  lines,
  requirements: { "goal/done": judgeDone },
  invariants,
  view,
};
