// The clock a reply carries (docs/rules/clock.md R-CLOCK-001 to 003). Every
// time here is the server's: a client never sends one.
import type { State } from "@japacity/sim";
import { int } from "@japacity/sim";

import type { ServerConfig } from "../config";
import type { ClockView } from "../types";
import type { TurnClock } from "./turns";
import { nextTurnAt } from "./turns";

/** R-CLOCK-001: the tick of a real time; the same reading as `currentTick` in app.ts. */
export function tickAt(clock: ServerConfig["clock"], now: number): number {
  return Math.max(0, int.divFloor(now - clock.epoch, clock.worldTickMs));
}

/** R-CLOCK-002: the real time a tick begins. */
export function tickStartsAt(clock: ServerConfig["clock"], tick: number): number {
  return clock.epoch + tick * clock.worldTickMs;
}

/** R-CLOCK-004: the turn clock for a content's cap under the server's config. */
export function turnClock(config: ServerConfig, cap: number): TurnClock {
  return { cap, turnRefillMs: config.clock.turnRefillMs, fastClock: config.testing.fastClock };
}

/** R-CLOCK-003: the tick, when the next one begins, and when the next turn is earned. */
export function clockView(config: ServerConfig, now: number, state: State, refilledAt: number, cap: number): ClockView {
  const tick = tickAt(config.clock, now);
  return { tick, nextTickAt: tickStartsAt(config.clock, tick + 1), nextTurnAt: nextTurnAt(state, refilledAt, turnClock(config, cap)) };
}
