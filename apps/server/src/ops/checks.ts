// The checks (admin:checks-have-three-states, admin:check-handled-with-reason, admin:check-change-sends-email): one list,
// each measured against a limit and always in one of three states. A change of state is a row in the audit store under
// one fixed name, as the alarms are; the rows are the history. What a check found is measured live and never stored,
// so no row names an account. The checks read; they act on nothing.
import type { Alarm, CheckChange, CheckFound, CheckName, CheckState, CheckView } from "@japacity/api";
import { CHECK_NAMES } from "@japacity/api";
import { time } from "@japacity/sim";
import type { AuditStore } from "@japacity/store";

import { askedEarly } from "../analytics/dashboard";
import type { AuthNotice } from "../auth/auth";
import type { ServerDeps } from "../dependencies";
import { readQueue } from "../moderation/queue";
import type { ReportQueueStore } from "../moderation/reports";
import { listAlarms } from "./alarm";

/** The audit rows that hold the checks' changes of state are filed under this name; each row's note is a `StoredChange` as JSON. */
export const CHECK_ROWS = "admin.checks";

/** admin.md Numbers: the counted day is the day that ended once the time is past this hour UTC, and the day before it until then. */
export const COUNTED_DAY_HOUR = 2;

/** analytics:nightly-game-counters: the total every nightly run writes, whoever played; its presence says the day was counted. */
export const NIGHTLY_MARK = "players/total";

/** admin.md Numbers: every check's limit. */
export const CHECK_LIMIT = 0;

/** What the checks read beside the stores: the moderation queue. */
export interface CheckPorts {
  reports: ReportQueueStore;
}

/** admin:check-change-sends-email: who is told and how. Null when the server runs without the auth library. */
export interface CheckMail {
  /** The verified emails of the admin accounts. */
  admins: () => Promise<string[]>;
  send: (notice: AuthNotice) => Promise<void>;
  /** The admin page's address. */
  link: string;
}

interface StoredChange extends CheckChange {
  check: CheckName;
}

interface Measured {
  value: number | null;
  found: CheckFound;
}

/** admin:checks-have-three-states: the day a check reads, so a day is read only after its nightly jobs have had time to finish. */
export function countedDay(now: number): number {
  const today = time.utcDay(now);
  return now >= time.dayStart(today) + COUNTED_DAY_HOUR * time.HOUR_MS ? today - 1 : today - 2;
}

/** When an alarm was raised: as stamped, or, for one stored before the stamp, when its day's job ran (the day after for the nightly ones). */
function raisedAt(alarm: Alarm): number {
  if (alarm.at !== undefined) return alarm.at;
  return alarm.kind === "diverged" ? time.dayStart(alarm.day) : time.dayStart(alarm.day + 1);
}

export function stateOf(value: number | null, limit: number = CHECK_LIMIT): CheckState {
  if (value === null) return "no-data";
  return value > limit ? "alarm" : "ok";
}

async function readChanges(audit: AuditStore): Promise<StoredChange[]> {
  const rows = await audit.list(CHECK_ROWS);
  return rows.map((row) => JSON.parse(row.note) as StoredChange);
}

/** When the check was last marked handled, or 0. */
function handledAt(changes: readonly StoredChange[], check: CheckName): number {
  return changes.findLast((change) => change.check === check && change.admin !== undefined)?.at ?? 0;
}

async function measure(deps: ServerDeps, ports: CheckPorts, check: CheckName, after: number): Promise<Measured> {
  const day = countedDay(deps.now());
  const alarmsOf = async (test: (alarm: Alarm) => boolean) => (await listAlarms(deps)).filter((alarm) => raisedAt(alarm) > after && test(alarm));
  switch (check) {
    case "money-suspects": {
      const alarms = await alarmsOf((alarm) => alarm.kind === "suspect" && alarm.day === day);
      return { value: alarms.length, found: { kind: "alarms", alarms } };
    }
    case "draw-payouts": {
      const alarms = await alarmsOf((alarm) => alarm.kind === "draw" && alarm.day === day);
      return { value: alarms.length, found: { kind: "alarms", alarms } };
    }
    case "diverged-lives": {
      const alarms = await alarmsOf((alarm) => alarm.kind === "diverged");
      return { value: alarms.length, found: { kind: "alarms", alarms } };
    }
    case "asked-early": {
      const name = time.dayName(day);
      const totals = await deps.stores.counters.days(name, name);
      if (totals.length === 0) return { value: null, found: { kind: "asks", rows: [] } };
      const rows = askedEarly(totals);
      return { value: rows.reduce((sum, row) => sum + row.count, 0), found: { kind: "asks", rows } };
    }
    case "reports-overdue": {
      const queue = await readQueue(deps, ports.reports);
      return { value: queue.overdue, found: { kind: "queue", overdue: queue.overdue, oldest: queue.oldest, target: queue.target } };
    }
    case "nightly-counts": {
      const name = time.dayName(day);
      const totals = await deps.stores.counters.days(name, name);
      // The nightly job writes the accounts' total on every run, so a day with no one playing still reads as counted.
      const counted = totals.some((row) => row.name === NIGHTLY_MARK);
      return { value: counted ? 0 : 1, found: { kind: "day", day: name, counted } };
    }
    default: {
      const never: never = check;
      return never;
    }
  }
}

function view(check: CheckName, changes: readonly StoredChange[], measured: Measured): CheckView {
  const own = changes.filter((change) => change.check === check);
  const latest = own.at(-1);
  const history: CheckChange[] = own.map((change) => ({ state: change.state, value: change.value, limit: change.limit, at: change.at, ...(change.admin === undefined ? {} : { admin: change.admin, reason: change.reason }) })).reverse();
  return { check, state: latest?.state ?? "no-data", value: measured.value, limit: CHECK_LIMIT, since: latest?.at ?? null, found: measured.found, history };
}

async function write(deps: ServerDeps, change: StoredChange): Promise<void> {
  await deps.stores.audit.retire({ character: CHECK_ROWS, why: "alarm", at: change.at, note: JSON.stringify(change), segments: [], log: [], snapshots: [] });
}

function figure(value: number | null): string {
  return value === null ? "no data" : String(value);
}

/** admin:check-change-sends-email: one mail to each admin with a verified email; a send that fails never stops the others or the run. */
async function tell(mail: CheckMail, change: StoredChange, state: "alarm" | "ok"): Promise<void> {
  const emails = await mail.admins();
  await Promise.all(emails.map((email) => mail.send({ email, kind: "check-changed", at: change.at, check: change.check, state, value: figure(change.value), limit: String(change.limit), link: mail.link }).catch(() => undefined)));
}

/** admin:checks-have-three-states: every check as it stands, measured live, with the state and history the evaluations wrote. */
export async function listChecks(deps: ServerDeps, ports: CheckPorts): Promise<CheckView[]> {
  const changes = await readChanges(deps.stores.audit);
  const views: CheckView[] = [];
  for (const check of CHECK_NAMES) views.push(view(check, changes, await measure(deps, ports, check, handledAt(changes, check))));
  return views;
}

/**
 * admin:checks-have-three-states, admin:check-change-sends-email: measures every check, writes each change of state and
 * tells the admins of each change into alarm or from alarm to OK. The cron's job.
 */
export async function evaluateChecks(deps: ServerDeps, ports: CheckPorts, mail: CheckMail | null): Promise<CheckView[]> {
  const now = deps.now();
  const changes = await readChanges(deps.stores.audit);
  const views: CheckView[] = [];
  for (const check of CHECK_NAMES) {
    const own = changes.filter((change) => change.check === check);
    const before = own.at(-1);
    const measured = await measure(deps, ports, check, handledAt(changes, check));
    const state = stateOf(measured.value);
    if (before === undefined || before.state !== state) {
      const change: StoredChange = { check, state, value: measured.value, limit: CHECK_LIMIT, at: now };
      await write(deps, change);
      own.push(change);
      if (mail !== null && (state === "alarm" || (state === "ok" && before?.state === "alarm"))) await tell(mail, change, state);
    }
    views.push(view(check, own, measured));
  }
  return views;
}

export type Handled = { ok: true; check: CheckView } | { ok: false; code: "not-possible"; detail: string };

/** admin:check-handled-with-reason: the check is OK from now; its next measurement counts only what comes after. */
export async function handleCheck(deps: ServerDeps, ports: CheckPorts, check: CheckName, admin: string, reason: string): Promise<Handled> {
  const changes = await readChanges(deps.stores.audit);
  const latest = changes.findLast((change) => change.check === check);
  if (latest?.state !== "alarm") return { ok: false, code: "not-possible", detail: `${check} is not in alarm.` };
  const at = deps.now();
  const change: StoredChange = { check, state: "ok", value: latest.value, limit: latest.limit, at, admin, reason };
  await write(deps, change);
  const after = [...changes, change];
  return { ok: true, check: view(check, after, await measure(deps, ports, check, at)) };
}
