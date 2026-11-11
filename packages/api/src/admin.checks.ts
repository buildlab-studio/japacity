// The admin page's checks (admin:checks-have-three-states, admin:check-handled-with-reason): `GET /api/admin/checks` and
// `POST /api/admin/checks/:check/handle`. Every check is always in one of three states; its history is the changes of
// state, newest first; what it found is read live when the page asks.
import type { AdminRefusal, Alarm } from "./admin";

export const CHECK_NAMES = ["money-suspects", "draw-payouts", "diverged-lives", "asked-early", "reports-overdue", "nightly-counts"] as const;

export type CheckName = (typeof CHECK_NAMES)[number];

/** OK: at or under the limit. In alarm: over it. No data: what the check measures is not there to read. */
export type CheckState = "ok" | "alarm" | "no-data";

/** One change of state. `admin` and `reason` are set when a person marked the check handled (admin:check-handled-with-reason). */
export interface CheckChange {
  state: CheckState;
  value: number | null;
  limit: number;
  at: number;
  admin?: string;
  reason?: string;
}

/** analytics:day-one-and-seven-return: one `ask/*` counter's `:before` count on one day, every region added up. */
export interface AskedEarlyRow {
  day: string;
  name: string;
  key: string;
  count: number;
}

/** What a check found when it was last measured. */
export type CheckFound =
  | { kind: "alarms"; alarms: Alarm[] }
  | { kind: "asks"; rows: AskedEarlyRow[] }
  | { kind: "queue"; overdue: number; oldest: number; target: number }
  | { kind: "day"; day: string; counted: boolean };

export interface CheckView {
  check: CheckName;
  state: CheckState;
  /** The live measurement; null when there is no data. */
  value: number | null;
  limit: number;
  /** When the state last changed; null while the check has never been evaluated. */
  since: number | null;
  found: CheckFound;
  /** Newest first. */
  history: CheckChange[];
}

export type ChecksReply = { ok: true; checks: CheckView[] } | AdminRefusal;

export interface HandleCheckBody {
  reason: string;
}
