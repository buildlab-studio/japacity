// The alarm (R-SERVER-012, R-LOTTERY-014): what the money job and a diverged
// load find, listed for a person to look at. An alarm takes no action. The
// list is kept in the isolate's memory and in the audit store, so the admin
// page still shows it after a restart.
import type { Currency, Reason } from "@japacity/sim";
import type { AuditStore } from "@japacity/store";

import type { ServerDeps } from "../deps";
import { utcDay } from "./day";

export type Alarm =
  /** R-SERVER-012: `ledgerReport` named the character as suspect. */
  | { kind: "suspect"; day: number; character: string; reason: Reason; currency: Currency; total: number; ceiling: number }
  /** R-LOTTERY-014: `win` paid for the draw above its fund (`limit`), or `ticket` taken for it other than its pot (`limit`). */
  | { kind: "draw"; day: number; draw: number; check: "win" | "ticket"; total: number; limit: number }
  /** R-SERVER-003: a load found the replay's hash differs from the stored one; the character waits for the rollback tool. */
  | { kind: "diverged"; day: number; character: string; v: number };

/**
 * The audit rows that hold alarms are filed under this name instead of a
 * character id; each row's note is the alarm as JSON and its row lists are empty.
 */
export const ALARM_ROWS = "admin.alarms";

const held = new WeakMap<AuditStore, Alarm[]>();

async function cached(audit: AuditStore): Promise<Alarm[]> {
  const found = held.get(audit);
  if (found !== undefined) return found;
  const rows = await audit.list(ALARM_ROWS);
  const alarms = rows.map((row) => JSON.parse(row.note) as Alarm);
  // Another call may have filled the list while the audit store was read.
  const raced = held.get(audit);
  if (raced !== undefined) return raced;
  held.set(audit, alarms);
  return alarms;
}

/** Every alarm raised, oldest first. */
export async function listAlarms(deps: Pick<ServerDeps, "stores">): Promise<Alarm[]> {
  return [...(await cached(deps.stores.audit))];
}

/** Adds the alarms to the list and to the audit store. */
export async function raiseAlarms(deps: Pick<ServerDeps, "stores" | "now">, alarms: readonly Alarm[]): Promise<void> {
  const list = await cached(deps.stores.audit);
  for (const alarm of alarms) {
    // AuditEntry.why has no "alarm"; "rollback" is used until someone adds it, since an alarm is mended only by the rollback tool.
    await deps.stores.audit.retire({ character: ALARM_ROWS, why: "rollback", at: deps.now(), note: JSON.stringify(alarm), segments: [], log: [], snapshots: [] });
    list.push(alarm);
  }
}

/** R-SERVER-003: the core calls this when a load's hash differs, so the character is listed for the rollback tool. */
export async function noteDiverged(deps: Pick<ServerDeps, "stores" | "now">, character: string, v: number): Promise<void> {
  await raiseAlarms(deps, [{ kind: "diverged", day: utcDay(deps.now()), character, v }]);
}
