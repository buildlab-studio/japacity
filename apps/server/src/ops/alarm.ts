// The alarm (server:ledger-alarm-lists-suspects, lottery:money-report-checks-draws): what the money job and a diverged
// load find, listed for a person to look at. An alarm takes no action. The
// list is kept in the isolate's memory and in the audit store, so the admin
// page still shows it after a restart.
import type { Alarm } from "@japacity/api";
import { time } from "@japacity/sim";
import type { AuditStore } from "@japacity/store";

import type { ServerDeps } from "../deps";

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
    await deps.stores.audit.retire({ character: ALARM_ROWS, why: "alarm", at: deps.now(), note: JSON.stringify(alarm), segments: [], log: [], snapshots: [] });
    list.push(alarm);
  }
}

/** server:log-rows-hash-state: the core calls this when a load's hash differs, so the character is listed for the rollback tool. */
export async function noteDiverged(deps: Pick<ServerDeps, "stores" | "now">, character: string, v: number): Promise<void> {
  await raiseAlarms(deps, [{ kind: "diverged", day: time.utcDay(deps.now()), character, v }]);
}
