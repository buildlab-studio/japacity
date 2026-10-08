// What follows a commit (docs/rules/server.md R-SERVER-002, R-SERVER-003):
// the nudge, never inside the transaction, and the queue for the rollback
// tool when a load diverged.
import type { Sender } from "@japacity/sim";

import type { ServerDeps } from "../deps";
import { rewardInviters } from "../pair/rewards";
import { noteFills } from "../notify/fill";
import type { Diverged, Live } from "./load";

/**
 * R-SERVER-002, R-CLOCK-020: runs after the commit. A character whose state
 * moved without its player sending the command is nudged with its new version.
 * R-CLOCK-031: every held character's fill is noted.
 */
export async function afterCommit(deps: ServerDeps, lives: readonly Live[], by: Sender): Promise<void> {
  // The money report's mark (R-SERVER-011) is the admin work's and is added here.
  await rewardInviters(deps, lives);
  await noteFills(deps, lives, by);
  if (by === "player") return;
  for (const live of lives) {
    if (live.rows.length > 0) await deps.stores.nudges.send(live.account, { nudge: "view", v: live.state.v });
  }
}

/** The note an audit entry carries when a character is queued for the rollback tool. */
export const DIVERGED_NOTE = "diverged:";

/**
 * R-SERVER-003, R-SERVER-008: queues a diverged character for the rollback
 * tool as an audit entry with no rows, its note starting `diverged:`. The same
 * divergence is queued once however often the player retries.
 */
export async function queueDiverged(deps: ServerDeps, diverged: Diverged): Promise<void> {
  const note = `${DIVERGED_NOTE} version ${String(diverged.v)}. ${diverged.detail}`;
  const known = await deps.stores.audit.list(diverged.character);
  if (known.some((entry) => entry.note === note)) return;
  await deps.stores.audit.retire({ character: diverged.character, why: "rollback", at: deps.now(), note, segments: [], log: [], snapshots: [] });
}
