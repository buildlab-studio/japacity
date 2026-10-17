// Turns on real time (docs/rules/clock.md R-CLOCK-004 to 006, R-CLOCK-009):
// `earnTurns` is a pure function of the state, the character's `refilledAt`
// and the server's time.
import type { State } from "@japacity/sim";
import { int } from "@japacity/sim";

/** What real time has earned: the turns to grant now, and where `refilledAt` stands after the grant. */
export interface Earned {
  grant: number;
  refilledAt: number;
}

export interface TurnClock {
  cap: number;
  turnRefillMs: number;
  /** R-CLOCK-009: the test server's switch alone; production config holds it off. */
  fastClock: boolean;
}

/**
 * R-CLOCK-004, R-CLOCK-005, R-CLOCK-006: one turn for every `turnRefillMs`
 * since `refilledAt`, never past the cap. A full bank earns nothing and holds
 * `refilledAt` at now. The fast clock refills an empty bank at once.
 */
export function earnTurns(state: State, refilledAt: number, now: number, clock: TurnClock): Earned {
  if (state.turn.ended) return { grant: 0, refilledAt };
  const banked = state.turn.banked;
  if (clock.fastClock) return { grant: banked < 1 ? clock.cap - banked : 0, refilledAt: now };
  if (banked >= clock.cap) return { grant: 0, refilledAt: now };
  const earned = int.divFloor(now - refilledAt, clock.turnRefillMs);
  if (earned < 1) return { grant: 0, refilledAt };
  const room = clock.cap - banked;
  return { grant: Math.min(earned, room), refilledAt: earned >= room ? now : refilledAt + earned * clock.turnRefillMs };
}

/** R-CLOCK-003: the real time the next turn is earned, or null while the bank is full or the life is over. */
export function nextTurnAt(state: State, refilledAt: number, clock: TurnClock): number | null {
  if (state.turn.ended || state.turn.banked >= clock.cap) return null;
  return refilledAt + clock.turnRefillMs;
}
