// Turns: docs/rules/turn.md. A turn is one month, and turns are banked.
import { reject } from "../engine/reject";
import type { RegisteredKind } from "../engine/kind";
import { turnInProgress } from "../engine/kind";
import type { BaseEvent, Command, Content, Ctx, ReadCtx, Rejection, State, TurnSlice } from "../engine/types";
import { japacity } from "../japacity/japacity.logic";
import type { TurnEvent } from "./turn.events";

const WELLBEING = "quality.wellbeing";

/** Free slots this month (R-TURN-006): by job, one fewer when wellbeing is under the burnout line. */
export function freeSlots(state: State, content: Content): number {
  const { turn, quality } = content.tuning;
  const base = state.activity.job === null ? turn.freeSlotsNoJob : turn.freeSlots;
  const wellbeing = state.quality[WELLBEING];
  const burnt = wellbeing !== undefined && wellbeing < quality.burnoutBelow;
  return Math.max(0, burnt ? base - 1 : base);
}

/** Validates `turn/end` before any phase runs (R-TURN-003, R-SETPIECE-002, R-TURN-006). */
function validateEnd(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "turn/end") throw new Error(`The turn kind cannot validate ${command.type}.`);
  const { state, content } = ctx;
  if (state.turn.banked < 1) return reject("no-turns", "No turn is banked.");
  if (state.setpiece.open !== null) return reject("setpiece-open", "Finish the open set piece first.");
  if (!Array.isArray(command.slots)) return reject("not-legal", "The slots must be a list.");
  const allowed = freeSlots(state, content);
  if (command.slots.length > allowed) {
    return reject("not-legal", `This month has ${String(allowed)} free slots, and ${String(command.slots.length)} were filled.`);
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
  const { month, banked } = ctx.state.turn;
  const event: TurnEvent = { type: "turn/spent", month: month + 1, banked: banked - 1 };
  return [event];
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
    default: {
      const never: never = event;
      throw new Error(`Unknown turn event ${JSON.stringify(never)}.`);
    }
  }
}

export const turnKind: RegisteredKind<TurnSlice, TurnEvent> = {
  kind: "turn",
  // R-TURN-001.
  initial: (_scenario, content) => ({ month: 0, banked: content.tuning.turn.start, ended: false, report: null }),
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
  },
  phases: { spend, close },
  evolve,
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
    freeSlots: freeSlots(state, content),
    report: state.turn.report,
  }),
};
