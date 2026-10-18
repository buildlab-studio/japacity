// The admin routes' money and rollback replies (R-SERVER-005, 008, 011, 012).
// Every admin route answers the admin accounts of R-MODERATION-012 only.
import type { Command, Currency, Reason, RejectionCode } from "@japacity/sim";
import type { ByReason, DayRow } from "@japacity/store";

export type { ByReason, DayRow };

/** A refusal from any admin route: `code` is the server's, `missing` the checks an approval lacked. */
export interface AdminRefusal {
  ok: false;
  code?: string;
  detail: string;
  missing?: string[];
  refusals?: string[];
}

export type Alarm =
  /** R-SERVER-012: `ledgerReport` named the character as suspect. */
  | { kind: "suspect"; day: number; character: string; reason: Reason; currency: Currency; total: number; ceiling: number }
  /**
   * R-LOTTERY-014: `win` paid for the draw other than its result gives (`win`),
   * any `pot-top-up` paid for it (`top-up`, which decision 0016 does not pay), or
   * `ticket` taken for it other than its sales (`ticket`); `limit` is the
   * figure it should have been.
   */
  | { kind: "draw"; day: number; draw: number; check: "win" | "top-up" | "ticket"; total: number; limit: number }
  /** R-SERVER-003: a load found the replay's hash differs from the stored one; the character waits for the rollback tool. */
  | { kind: "diverged"; day: number; character: string; v: number };

/** Why a replay could not run at all. */
export interface LoadFailure {
  ok: false;
  code: "missing" | "no-world" | "no-content";
  detail: string;
}

/** R-SERVER-008: the first logged version whose stored hash differs from the replay's. `replayed` is null when the command is now rejected. */
export interface Diff {
  v: number;
  stored: string;
  replayed: string | null;
}

/** R-SERVER-009: a command the log says was accepted that the replay now rejects. */
export interface Dropped {
  v: number;
  type: Command["type"];
  code: RejectionCode;
  detail: string;
}

/** What the rollback check found for one character. */
export interface RollbackReport {
  character: string;
  /** The stored version when the check ran. */
  v: number;
  /** Commands replayed, across every segment. */
  replayed: number;
  /** R-SERVER-008: the first logged version whose hash differs, or null when none does. */
  firstDiff: Diff | null;
  /** R-SERVER-009: commands the log says were accepted that are now rejected. */
  dropped: Dropped[];
}

/** `GET /api/admin/rollback/:character`. */
export type RollbackCheck = { ok: true; report: RollbackReport } | LoadFailure;

/** `GET /api/admin/report?day=`: one day's money made and destroyed. */
export type LedgerReportReply = { ok: true; report: DayRow } | AdminRefusal;
/** `GET /api/admin/alarms`. */
export type AlarmsReply = { ok: true; alarms: Alarm[] } | AdminRefusal;
/** `GET /api/admin/rejections`: the refusals counted by code. */
export type RejectionsReply = { ok: true; counts: Record<string, number> } | AdminRefusal;
