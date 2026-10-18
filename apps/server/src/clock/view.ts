// The clock a reply carries (clock:server-owns-the-clock, clock:world-tick-length-and-epoch and clock:reply-carries-the-clock). Every
// time here is the server's: a client never sends one.
import type { ClockView } from "@japacity/api";
import type { State } from "@japacity/sim";
import { int, nextGameMorning, worldClockAt } from "@japacity/sim";

import type { ServerConfig } from "../config";
import type { TurnClock } from "./turns";
import { nextTurnAt } from "./turns";

/** clock:server-owns-the-clock: the tick of a real time; the same reading as `currentTick` in app.ts. */
export function tickAt(clock: ServerConfig["clock"], now: number): number {
  return Math.max(0, int.divFloor(now - clock.epoch, clock.worldTickMs));
}

/** clock:world-tick-length-and-epoch: the real time a tick begins. */
export function tickStartsAt(clock: ServerConfig["clock"], tick: number): number {
  return clock.epoch + tick * clock.worldTickMs;
}

/** clock:turns-earned-from-refill-time: the turn clock for a content's cap under the server's config. */
export function turnClock(config: ServerConfig, cap: number): TurnClock {
  return { cap, turnRefillMs: config.clock.turnRefillMs, fastClock: config.testing.fastClock };
}

/** clock:reply-carries-the-clock: the tick, when the next one begins, and when the next turn is earned. */
export function clockView(config: ServerConfig, now: number, state: State, refilledAt: number, cap: number): ClockView {
  const tick = tickAt(config.clock, now);
  return { tick, nextTickAt: tickStartsAt(config.clock, tick + 1), nextTurnAt: nextTurnAt(state, refilledAt, turnClock(config, cap)), morningAt: nextGameMorning(now), world: worldClockAt(now) };
}
