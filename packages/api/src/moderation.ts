// Block and report (pair.md R-PAIR-014 to 016; moderation.md R-MODERATION-001
// to 009). The reasons and what a report cites are the store's, named here for
// the client.
import type { AppealRow, ReportCite, ReportReason } from "@japacity/store";

import type { ServerRejection } from "./reply";

export type { ReportCite, ReportReason };

/** R-MODERATION-020: the longest feedback, in characters (code points). */
export const FEEDBACK_MAX_CHARS = 500;

/** R-MODERATION-004: the reasons in the order the report sheet lists them. */
export const REPORT_REASONS = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"] as const satisfies readonly ReportReason[];

/** R-MODERATION-004: whom a report is about: an account, or an advert's campaign. */
export type ReportSubject = { account: string } | { campaign: string };

/** `POST /api/moderation/block` and `/unblock`. The reply never says more than that it was done. */
export interface Blocked {
  ok: true;
}

/** `POST /api/moderation/report`: received at once (R-MODERATION-007). */
export interface Reported {
  ok: true;
  report: string;
}

/** The body of a block: the other player named by the pair the two share, or by their character. */
export type BlockRequest = { pair: string } | { character: string };

/** The pair form of `POST /api/moderation/report`: a pair, and from a conversation its message ids; a block in the same step (R-PAIR-016, R-MODERATION-006). */
export interface PairReportRequest {
  pair: string;
  reason: ReportReason;
  messages?: string[];
  block?: boolean;
}

/**
 * The cite form of `POST /api/moderation/report`, for a report that cites no pair (an advert, a card, a phrase heard
 * in a place). `subject` is left out for a card, whose inviter the server finds from the code, and for a phrase heard
 * in a place.
 */
export interface CiteReportRequest {
  subject?: ReportSubject;
  reason: ReportReason;
  cites: ReportCite;
}

/** R-MODERATION-016: the actions a player is told of. */
export const TOLD_ACTIONS = ["warn", "mute", "suspend", "ban"] as const;

export type ToldAction = (typeof TOLD_ACTIONS)[number];

/** R-MODERATION-007, R-MODERATION-016: one action on the player's own account. */
export interface ActionOnMe {
  /** The log entry: what an appeal names. */
  entry: string;
  action: ToldAction;
  reason: string;
  at: number;
  /** When a mute or suspension ends; null for a warning or a ban. */
  until: number | null;
  appeal: { status: AppealRow["status"]; outcome?: AppealRow["outcome"] } | null;
}

/** `GET /api/moderation/standing`: what the player is told of actions on their account and of their own reports. */
export interface Standing {
  actions: ActionOnMe[];
  /** Milliseconds since 1970, or null. */
  mutedUntil: number | null;
  suspendedUntil: number | null;
  banned: boolean;
  /** R-MODERATION-007: the player's own reports, received and then their outcome, never what was done to whom. */
  reports: { id: string; at: number; status: "open" | "decided"; outcome?: "acted" | "no-action" }[];
}

export type StandingReply = { ok: true; standing: Standing } | ServerRejection;

/** The body of `POST /api/moderation/appeal`: the log entry appealed. */
export interface AppealRequest {
  action: string;
}

/** R-MODERATION-020: the body of `POST /api/feedback`. */
export interface FeedbackRequest {
  text: string;
  build: string;
  screen: string;
  mode: "low" | "high";
}

export type BlockReply = Blocked | ServerRejection;
export type ReportReply = Reported | ServerRejection;
