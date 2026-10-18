// Turns: docs/rules/turn.md. A turn is one month, and the month is lived (decision 0011): now-acts spend its
// free days (turn:month-lived-in-half-days) and the bank, filled by the server's clock, gates nothing.
import { QUALITY } from "../engine/ids";
import { bp } from "../engine/int";
import { reject } from "../engine/reject";
import type { RegisteredKind } from "../engine/kind";
import { readOf, turnInProgress } from "../engine/kind";
import type { BaseEvent, Command, Content, Ctx, Id, Rejection, SlotLock, SlotPick, State, TurnSlice } from "../engine/types";
import { japacity } from "../japacity/japacity.logic";
import type { TurnEvent } from "./turn.events";

/** The locks still holding in `month` (turn:slots-can-be-locked). */
export function activeLocks(locks: readonly SlotLock[], month: number): SlotLock[] {
  return locks.filter((lock) => lock.untilMonth >= month);
}

/** turn:free-slots-per-month: true when a pick of the activity fills one of the month's slots; an activity whose `slot` is `none` rides with the month. */
export function fillsSlot(content: Content, activity: string): boolean {
  return content.activity[activity as Id<"activity">]?.slot !== "none";
}

/**
 * Free slots this month (turn:free-slots-per-month, turn:slots-can-be-locked): by job, one fewer when
 * wellbeing is under the burnout line, then the locked slots come off.
 */
export function freeSlots(state: State, content: Content): number {
  // road:road-truth-asks-more: on the road the month's activities are the chain's own.
  if (state.place.where === "road") return 0;
  const { turn, quality } = content.tuning;
  const base = state.activity.job === null ? turn.freeSlotsNoJob : turn.freeSlots;
  const wellbeing = state.quality[QUALITY.wellbeing];
  const burnt = wellbeing !== undefined && wellbeing < quality.burnoutBelow;
  const locked = activeLocks(state.turn.locks, state.turn.month).reduce((sum, lock) => sum + lock.slots, 0);
  return Math.max(0, (burnt ? base - 1 : base) - locked);
}

/** The month's free time in half-days (turn:month-lived-in-half-days): the whole month with no job, what a job leaves with one. */
export function freeHalfDays(state: State, content: Content): number {
  const { halfDays } = content.tuning.turn;
  return state.activity.job === null ? halfDays.noJob : halfDays.withJob;
}

/** Validates `turn/end` before any phase runs (route:open-set-piece-holds-month, turn:free-slots-per-month). The bank does not gate it (turn:month-turns-on-empty-bank, decision 0011). */
function validateEnd(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "turn/end") throw new Error(`The turn kind cannot validate ${command.type}.`);
  const { state, content } = ctx;
  if (state.setpiece.open !== null) return reject("setpiece-open", "Finish the open set piece first.");
  if (!Array.isArray(command.slots)) return reject("not-legal", "The slots must be a list.");
  const allowed = freeSlots(state, content);
  const filled = command.slots.filter((pick) => fillsSlot(content, (pick as SlotPick | null)?.activity ?? "")).length;
  if (filled > allowed) {
    return reject("not-legal", `This month has ${String(allowed)} free slots, and ${String(filled)} were filled.`);
  }
  return [];
}

/** Only the authority may send this; the engine checks the sender (turn:only-authority-grants-turns). */
function grant(ctx: Ctx, command: Command): BaseEvent[] | Rejection {
  if (command.type !== "turns/grant") throw new Error(`The turn kind cannot grant from ${command.type}.`);
  const { count } = command;
  if (!Number.isSafeInteger(count) || count < 1) return reject("bad-amount", "A grant is a whole number of turns above zero.");
  const { banked } = ctx.state.turn;
  const after = Math.min(ctx.content.tuning.turn.cap, banked + count);
  const event: TurnEvent = { type: "turn/granted", count: after - banked, banked: after };
  return [event];
}

/**
 * How many of the arrival marks (shares of the month's free time, in basis points) one spend carries the time across:
 * a mark at `bp` is crossed when the time was under it and is now at or past it (offer:day-arrivals-roll-offers).
 */
export function arrivalsCrossed(before: number, after: number, free: number, marksBp: readonly number[]): number {
  return marksBp.filter((markBp) => {
    const mark = bp(free, markBp);
    return before < mark && after >= mark;
  }).length;
}

function spend(ctx: Ctx): BaseEvent[] {
  const { month, banked, locks } = ctx.state.turn;
  const events: TurnEvent[] = [{ type: "turn/spent", month: month + 1, banked: Math.max(0, banked - 1) }];
  // A lock holds through its last month and is dropped as the next one begins.
  const spent = locks.filter((lock) => lock.untilMonth < month + 1);
  if (spent.length > 0) events.push({ type: "turn/unlocked", why: spent.map((lock) => lock.why) });
  return events;
}

/** Stores the month's report (turn:turn-stores-a-report). */
function close(ctx: Ctx): BaseEvent[] {
  const turn = turnInProgress(ctx);
  if (turn === null) throw new Error("The close phase runs only inside a turn.");
  const lines = turn.lines();
  const read = readOf(ctx);
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
      // The new month starts with no days spent (turn:month-lived-in-half-days).
      return { ...slice, month: event.month, banked: event.banked, spent: 0 };
    case "turn/days-spent":
      return { ...slice, spent: event.spent };
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
  // turn:new-character-full-bank.
  initial: (_scenario, content) => ({ month: 0, banked: content.tuning.turn.start, spent: 0, ended: false, report: null, locks: [] }),
  commands: {
    "turn/end": validateEnd,
    "turns/grant": grant,
  },
  effects: {
    // turn:month-lived-in-half-days: a now-act spends free time, never past the month's; a spend past it is simply the month lived.
    "turn/spend-days": (ctx, effect) => {
      if (effect.type !== "turn/spend-days") throw new Error(`The turn kind cannot spend days from ${effect.type}.`);
      if (!(effect.halfDays > 0)) return [];
      const free = freeHalfDays(ctx.state, ctx.content);
      const spent = Math.min(free, ctx.state.turn.spent + effect.halfDays);
      if (spent === ctx.state.turn.spent) return [];
      const taken = spent - ctx.state.turn.spent;
      // quality:body-belly-and-energy: the time lived takes a little off the belly and the energy, where content has them.
      const { body } = ctx.content.tuning.turn;
      const drain = ([["quality.belly", body.bellyPerHalfDay], ["quality.energy", body.energyPerHalfDay]] as const)
        .filter(([quality]) => ctx.content.quality[quality] !== undefined)
        .map(([quality, per]) => ({ type: "quality/add" as const, quality, amount: -per * taken }));
      if (drain.length > 0) ctx.apply(drain, { source: "turn/spend-days", param: null, terms: {} });
      // offer:day-arrivals-roll-offers: an ask may land as the day is lived: one offer may come up for each arrival mark this spend crosses.
      const crossed = arrivalsCrossed(ctx.state.turn.spent, spent, free, ctx.content.tuning.turn.arrivalsBp);
      for (let mark = 0; mark < crossed; mark += 1) ctx.apply([{ type: "offer/come-up", max: 1 }], { source: "turn/spend-days", param: null, terms: {} });
      const event: TurnEvent = { type: "turn/days-spent", halfDays: taken, spent };
      return [event];
    },
    // turn:refill-fills-the-bank.
    "turn/refill": (ctx) => {
      const event: TurnEvent = { type: "turn/refilled", banked: ctx.content.tuning.turn.cap };
      return [event];
    },
    // turn:finish-ends-the-life.
    "turn/finish": (ctx) => {
      if (ctx.state.turn.ended) return [];
      const event: TurnEvent = { type: "turn/finished" };
      return [event];
    },
    // turn:slots-can-be-locked. The month in hand counts, so `months` of 1 locks this month only.
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
      case "turn/days-spent":
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
    const { month, report, spent } = state.turn;
    if (!Number.isSafeInteger(month) || month < 0) problems.push(`The month is ${String(month)}, not a whole number from 0.`);
    if (!Number.isSafeInteger(spent) || spent < 0 || spent > 62) problems.push(`The half-days spent this month are ${String(spent)}, not a whole number within a month.`);
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
    halfDays: { spent: state.turn.spent, free: freeHalfDays(state, content) },
    locks: activeLocks(state.turn.locks, state.turn.month),
    freeSlots: freeSlots(state, content),
    report: state.turn.report,
  }),
};
