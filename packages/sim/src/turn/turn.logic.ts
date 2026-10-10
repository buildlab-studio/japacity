// Turns: docs/rules/turn.md. A turn is one month, and turns are banked.
import { reject } from "../engine/reject";
import type { RegisteredKind } from "../engine/kind";
import { turnInProgress } from "../engine/kind";
import type { BaseEvent, Command, Content, Ctx, Id, ReadCtx, Rejection, SlotLock, SlotPick, State, TurnSlice } from "../engine/types";
import { japacity } from "../japacity/japacity.logic";
import type { TurnEvent } from "./turn.events";

const WELLBEING = "quality.wellbeing";

/** The locks still holding in `month` (R-TURN-009). */
export function activeLocks(locks: readonly SlotLock[], month: number): SlotLock[] {
  return locks.filter((lock) => lock.untilMonth >= month);
}

/**
 * Free slots this month (R-TURN-006, R-TURN-009): by job, one fewer when
 * wellbeing is under the burnout line, then the locked slots come off.
 */
export function freeSlots(state: State, content: Content): number {
  // R-ROAD-005: on the road the month's activities are the chain's own.
  if (state.place.where === "road") return 0;
  const { turn, quality } = content.tuning;
  const base = state.activity.job === null ? turn.freeSlotsNoJob : turn.freeSlots;
  const wellbeing = state.quality[WELLBEING];
  const burnt = wellbeing !== undefined && wellbeing < quality.burnoutBelow;
  const locked = activeLocks(state.turn.locks, state.turn.month).reduce((sum, lock) => sum + lock.slots, 0);
  return Math.max(0, (burnt ? base - 1 : base) - locked);
}

/** Validates `turn/end` before any phase runs (R-TURN-003, R-SETPIECE-002, R-TURN-006). */
function validateEnd(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "turn/end") throw new Error(`The turn kind cannot validate ${command.type}.`);
  const { state, content } = ctx;
  if (state.turn.banked < 1) return reject("no-turns", "No turn is banked.");
  if (state.setpiece.open !== null) return reject("setpiece-open", "Finish the open set piece first.");
  if (!Array.isArray(command.slots)) return reject("not-legal", "The slots must be a list.");
  const allowed = freeSlots(state, content);
  // R-TURN-006: a pick of an activity that fills no slot rides with the month and is not counted.
  const filled = command.slots.filter((pick) => content.activity[(pick as SlotPick | null)?.activity ?? ("" as Id<"activity">)]?.slot !== "none").length;
  if (filled > allowed) {
    return reject("not-legal", `This month has ${String(allowed)} free slots, and ${String(filled)} were filled.`);
  }
  return [];
}

/** Only the authority may send this; the engine checks the sender (R-TURN-005). */
function grant(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "turns/grant") throw new Error(`The turn kind cannot grant from ${command.type}.`);
  const { count } = command;
  if (!Number.isSafeInteger(count) || count < 1) return reject("bad-amount", "A grant is a whole number of turns above zero.");
  const { banked } = ctx.state.turn;
  const after = Math.min(ctx.content.tuning.turn.cap, banked + count);
  const event: TurnEvent = { type: "turn/granted", count: after - banked, banked: after };
  return [event];
}

function spend(ctx: Ctx): BaseEvent[] {
  const { month, banked, locks } = ctx.state.turn;
  const events: TurnEvent[] = [{ type: "turn/spent", month: month + 1, banked: banked - 1 }];
  // A lock holds through its last month and is dropped as the next one begins.
  const spent = locks.filter((lock) => lock.untilMonth < month + 1);
  if (spent.length > 0) events.push({ type: "turn/unlocked", why: spent.map((lock) => lock.why) });
  return events;
}

/** Stores the month's report (R-TURN-008). */
function close(ctx: Ctx): BaseEvent[] {
  const turn = turnInProgress(ctx);
  if (turn === null) throw new Error("The close phase runs only inside a turn.");
  const lines = turn.lines();
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  const event: TurnEvent = {
    type: "turn/ended",
    report: {
      month: ctx.state.turn.month,
      lines,
      japacityBefore: turn.japacityBefore,
      japacityAfter: japacity(read).percent,
      attention: lines.some((line) => line.attention) || ctx.state.setpiece.open !== null,
    },
  };
  return [event];
}

function evolve(slice: TurnSlice, event: TurnEvent): TurnSlice {
  switch (event.type) {
    case "turn/granted":
      return { ...slice, banked: event.banked };
    case "turn/spent":
      return { ...slice, month: event.month, banked: event.banked };
    case "turn/refilled":
      return { ...slice, banked: event.banked };
    case "turn/finished":
      return { ...slice, ended: true };
    case "turn/ended":
      return { ...slice, report: event.report };
    case "turn/locked":
      return { ...slice, locks: [...slice.locks, { slots: event.slots, untilMonth: event.untilMonth, why: event.why }] };
    case "turn/unlocked":
      return { ...slice, locks: activeLocks(slice.locks, slice.month) };
    default: {
      const never: never = event;
      throw new Error(`Unknown turn event ${JSON.stringify(never)}.`);
    }
  }
}

export const turnKind: RegisteredKind<TurnSlice, TurnEvent> = {
  kind: "turn",
  // R-TURN-001.
  initial: (_scenario, content) => ({ month: 0, banked: content.tuning.turn.start, ended: false, report: null, locks: [] }),
  commands: {
    "turn/end": validateEnd,
    "turns/grant": grant,
  },
  effects: {
    // R-TURN-004.
    "turn/refill": (ctx) => {
      const event: TurnEvent = { type: "turn/refilled", banked: ctx.content.tuning.turn.cap };
      return [event];
    },
    // R-TURN-007.
    "turn/finish": (ctx) => {
      if (ctx.state.turn.ended) return [];
      const event: TurnEvent = { type: "turn/finished" };
      return [event];
    },
    // R-TURN-009. The month in hand counts, so `months` of 1 locks this month only.
    "turn/lock": (ctx, effect) => {
      if (effect.type !== "turn/lock") throw new Error(`The turn kind cannot lock from ${effect.type}.`);
      const { month, locks } = ctx.state.turn;
      const held = activeLocks(locks, month).reduce((sum, lock) => sum + lock.slots, 0);
      const room = Math.max(0, ctx.content.tuning.turn.maxLocked - held);
      const slots = Math.min(effect.slots, room);
      if (slots <= 0 || effect.months <= 0) return [];
      const event: TurnEvent = { type: "turn/locked", slots, untilMonth: month + effect.months - 1, why: effect.why };
      return [event];
    },
  },
  phases: { spend, close },
  evolve,
  lines(event) {
    switch (event.type) {
      case "turn/locked":
        return [{ key: "line.turn.locked", params: { slots: event.slots, why: event.why }, tone: "bad", attention: true, counts: [] }];
      case "turn/unlocked":
        return [{ key: "line.turn.unlocked", params: { why: event.why.join(", ") }, tone: "good", attention: false, counts: [] }];
      case "turn/granted":
      case "turn/spent":
      case "turn/refilled":
      case "turn/finished":
      case "turn/ended":
        return [];
      default: {
        const never: never = event;
        throw new Error(`Unknown turn event ${JSON.stringify(never)}.`);
      }
    }
  },
  invariants(state) {
    const problems: string[] = [];
    const { month, report } = state.turn;
    if (!Number.isSafeInteger(month) || month < 0) problems.push(`The month is ${String(month)}, not a whole number from 0.`);
    if (report !== null && report.month !== month) {
      problems.push(`The stored report is for month ${String(report.month)}, but the month is ${String(month)}.`);
    }
    return problems;
  },
  view: ({ state, content }) => ({
    v: state.v,
    scenario: state.scenario,
    month: state.turn.month,
    ended: state.turn.ended,
    turns: { banked: state.turn.banked, cap: content.tuning.turn.cap },
    locks: activeLocks(state.turn.locks, state.turn.month),
    freeSlots: freeSlots(state, content),
    report: state.turn.report,
  }),
};
