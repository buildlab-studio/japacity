// The admin routes of the moderation queue, the log, the dedication lights and
// the feedback (R-MODERATION-010 to 016, R-MODERATION-020, R-MODERATION-021).
import type { AdminAction, AppealRow, FeedbackRow, ModerationLogEntry, ReportReason } from "@japacity/store";

import type { AdminRefusal, RollbackCheck } from "./admin";
import type { LightYears } from "./lights";
import type { ReportCite, ReportSubject } from "./moderation";

export type { AdminAction, AppealRow, FeedbackRow, ModerationLogEntry };

/** R-MODERATION-014: the actions a report can be closed with. The advert actions are the advert queue's; `rollback` opens the tool and leaves the report open. */
export const REPORT_ACTIONS = ["dismiss", "warn", "mute", "suspend", "ban", "reset-name", "refer", "rollback"] as const satisfies readonly AdminAction[];

export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** R-MODERATION-008: what a report keeps unchanged until it is decided or `until`. */
export interface Hold {
  report: string;
  messages: string[];
  pair?: string;
  until: number;
}

/** A held message as the admin reads it: the phrase's own words and when it was sent. */
export interface HeldMessage {
  id: string;
  sender: string;
  phrase: string;
  words: string;
  fill: string | null;
  sentAt: number;
}

/** A report as an account summary lists it. */
export interface ReportBrief {
  id: string;
  reason: ReportReason;
  at: number;
  status: "open" | "decided";
  outcome?: "acted" | "no-action";
}

/** R-MODERATION-013: one account as the admin view shows it. Never an email, a seed or a character's state. */
export interface AccountSummary {
  account: string;
  region: string | null;
  /** Milliseconds since the account was made; null once it is gone. */
  accountAge: number | null;
  made: ReportBrief[];
  received: ReportBrief[];
  actions: ModerationLogEntry[];
}

export type QueueItem =
  | {
      kind: "report";
      id: string;
      reason: ReportReason;
      at: number;
      age: number;
      subject: ReportSubject;
      cites: ReportCite;
      unverified: boolean;
      hold: Hold | null;
      messages: HeldMessage[];
      reporter: AccountSummary;
      reported: AccountSummary | null;
    }
  | {
      kind: "appeal";
      id: string;
      at: number;
      age: number;
      entry: ModerationLogEntry | null;
      appellant: AccountSummary;
      /** R-MODERATION-016: the admin who acted, who should not decide it while another can. */
      actedBy: string | null;
    };

export interface QueueView {
  items: QueueItem[];
  /** R-MODERATION-011: the oldest open item's age in milliseconds, 0 for an empty queue. */
  oldest: number;
  target: number;
  overdue: number;
}

/** The body of `POST /api/admin/moderation/:item/close` for a report. */
export interface CloseReportBody {
  action: ReportAction;
  reason: ReportReason;
  days?: number;
  body?: string;
  note?: string;
}

/** The body of the same route for an appeal. */
export interface DecideAppealBody {
  outcome: "upheld" | "overturned";
  reason: ReportReason;
  note?: string;
}

export type QueueReply = { ok: true; queue: QueueView } | AdminRefusal;
export type DecidedReply = { ok: true; entry: ModerationLogEntry; appeal?: AppealRow; rollback?: RollbackCheck } | AdminRefusal;
export type LogReply = { ok: true; entries: ModerationLogEntry[] } | AdminRefusal;

/** R-MODERATION-021: a dedication light whose name awaits a look, as `GET /api/admin/dedication/pending` lists it. */
export interface PendingLight {
  account: string;
  id: string;
  name: string;
  years: LightYears;
  /** The account's username and region, null when the account row is gone. */
  username: string | null;
  region: string | null;
  litAt: number;
}

export type PendingLightsReply = { ok: true; lights: PendingLight[] } | AdminRefusal;
/** An approval or a refusal, with the admin log's entry it was written as. */
export type LightDecidedReply = { ok: true; entry: string } | AdminRefusal;
export type FeedbackReply = { ok: true; feedback: FeedbackRow[] } | AdminRefusal;
