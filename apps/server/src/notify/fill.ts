// clock:full-bank-push-notification: when a character's bank fills if nothing is spent, worked out
// after every commit from the state and `refilledAt`, so the scheduled job
// finds the fills without loading a single save.
import type { Sender, State } from "@japacity/sim";

import type { Live } from "../authority/load";
import type { TurnClock } from "../clock/turns";
import { turnClock } from "../clock/view";
import type { ServerDeps } from "../dependencies";

/**
 * clock:turns-earned-from-refill-time, clock:earned-turns-granted-first, clock:full-bank-earns-nothing, clock:full-bank-push-notification: one turn every `turnRefillMs` from
 * `refilledAt` until the bank holds the cap. A bank already full is a fill the
 * player has seen when the player sent the request, and one to tell of at
 * once when the authority filled it. A life that is over never fills.
 */
export function fullAtOf(state: State, refilledAt: number, at: number, by: Sender, clock: TurnClock): number | null {
  if (state.turn.ended) return null;
  const room = clock.cap - state.turn.banked;
  if (room <= 0) return by === "player" ? null : at;
  return refilledAt + room * clock.turnRefillMs;
}

/** clock:full-bank-push-notification: after a commit, each held character's fill, written only while its row is at the committed version. */
export async function noteFills(deps: ServerDeps, lives: readonly Live[], by: Sender): Promise<void> {
  const at = deps.now();
  for (const live of lives) {
    const fullAt = fullAtOf(live.state, live.refilledAt, at, by, turnClock(deps.config, live.content.tuning.turn.cap));
    await deps.stores.player.setFullAt(live.id, live.state.v, fullAt);
  }
}
