// What follows a commit (server:one-command-one-transaction, server:log-rows-hash-state):
// the nudge, never inside the transaction, and the queue for the rollback
// tool when a load diverged.
import type { Sender } from "@japacity/sim";
import { time } from "@japacity/sim";

import { noteDiverged } from "../ops/alarm";
import { markAfterCommit } from "../ops/money";
import type { ServerDeps } from "../dependencies";
import { rewardInviters } from "../pair/rewards";
import { noteFills } from "../notify/fill";
import { noteFigures } from "../boards/figures";
import type { Diverged, Live } from "./load";

/**
 * server:one-command-one-transaction, clock:socket-only-nudges: runs after the commit. A character whose state
 * moved without its player sending the command is nudged with its new version.
 * clock:full-bank-push-notification: every held character's fill is noted. server:daily-money-report: every
 * character that logged a row has its money mark kept, from the state it was
 * loaded with, on the UTC day of the commit. city:boards-switch-when-and-who: its board figure is written.
 */
export async function afterCommit(deps: ServerDeps, lives: readonly Live[], by: Sender): Promise<void> {
  const day = time.utcDay(deps.now());
  for (const live of lives) if (live.rows.length > 0) await markAfterCommit(deps, live.id, live.loaded, day);
  await rewardInviters(deps, lives);
  await noteFills(deps, lives, by);
  await noteFigures(deps, lives);
  if (by === "player") return;
  for (const live of lives) {
    if (live.rows.length > 0) await deps.stores.nudges.send(live.account, { nudge: "view", v: live.state.v });
  }
}

/** The note an audit entry carries when a character is queued for the rollback tool. */
export const DIVERGED_NOTE = "diverged:";

/**
 * server:log-rows-hash-state, server:rollback-check-finds-divergence, server:ledger-alarm-lists-suspects: queues a diverged character for
 * the rollback tool as an audit entry with no rows, its note starting
 * `diverged:`, and raises the admin alarm. The same divergence is queued and
 * raised once however often the player retries.
 */
export async function queueDiverged(deps: ServerDeps, diverged: Diverged): Promise<void> {
  const note = `${DIVERGED_NOTE} version ${String(diverged.v)}. ${diverged.detail}`;
  const known = await deps.stores.audit.list(diverged.character);
  if (known.some((entry) => entry.note === note)) return;
  await deps.stores.audit.retire({ character: diverged.character, why: "rollback", at: deps.now(), note, segments: [], log: [], snapshots: [] });
  await noteDiverged(deps, diverged.character, diverged.v);
}
