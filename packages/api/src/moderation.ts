// Block and report (pair.md R-PAIR-014 to 016; moderation.md R-MODERATION-001
// to 009). The reasons and what a report cites are the store's, named here for
// the client.
import type { ReportCite, ReportReason } from "@japacity/store";

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

export type BlockReply = Blocked | ServerRejection;
export type ReportReply = Reported | ServerRejection;
