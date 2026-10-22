// Block and report (pair:block-and-report-one-tap, pair:block-ends-every-bond and pair:report-holds-conversation; moderation:block-refuses-both-ways, moderation:block-ends-pair-records, moderation:report-from-every-surface, moderation:report-carries-subject-and-reason, moderation:spoken-phrases-not-stored, moderation:report-offers-block, moderation:reporter-told-outcome-only, moderation:reports-hold-cited-records and moderation:open-report-pauses-conversation). The reasons and what a report cites are the store's, named here for
// the client.
import type { AppealRow, ReportCite, ReportReason } from "@japacity/store";

import type { ServerRejection } from "./reply";

export type { ReportCite, ReportReason };

/** moderation:feedback-box-in-settings: the longest feedback, in characters (code points). */
export const FEEDBACK_MAX_CHARS = 500;

/** moderation:report-carries-subject-and-reason: the reasons in the order the report sheet lists them. */
export const REPORT_REASONS = ["scam", "harassment", "impersonation", "underage", "sexual", "hate", "self-harm", "illegal", "cheating", "advert", "other"] as const satisfies readonly ReportReason[];

/** moderation:report-carries-subject-and-reason: whom a report is about: an account, or an advert's campaign. */
export type ReportSubject = { account: string } | { campaign: string };

/** `POST /api/moderation/block` and `/unblock`. The reply never says more than that it was done, nor whether an account unblocked was on the list. */
export interface Blocked {
  ok: true;
}

/** `POST /api/moderation/report`: received at once (moderation:reporter-told-outcome-only). */
export interface Reported {
  ok: true;
  report: string;
}

/** The body of a block: the other player named by the pair the two share, or by their character, from where the two met. */
export type BlockRequest = { pair: string } | { character: string };

/** The body of an unblock: as a block's, or a line of the blocked list by its account (moderation:blocked-list-in-settings). */
export type UnblockRequest = BlockRequest | { account: string };

/** moderation:blocked-list-in-settings: one account the player has blocked. */
export interface BlockedLine {
  account: string;
  /** The account's username, or null when its row is gone (a deletion under way): the screen reads "A player". */
  username: string | null;
  /** When the block was made, milliseconds since 1970. */
  at: number;
}

/** `GET /api/moderation/blocked`: every account the player has blocked, newest first (moderation:blocked-list-in-settings). */
export interface BlockedList {
  ok: true;
  blocked: BlockedLine[];
}

export type BlockedListReply = BlockedList | ServerRejection;

/** The pair form of `POST /api/moderation/report`: a pair, and from a conversation its message ids; a block in the same step (pair:report-holds-conversation, moderation:report-offers-block). */
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

/** moderation:actioned-player-told-and-appeals: the actions a player is told of. */
export const TOLD_ACTIONS = ["warn", "mute", "suspend", "ban"] as const;

export type ToldAction = (typeof TOLD_ACTIONS)[number];

/** moderation:reporter-told-outcome-only, moderation:actioned-player-told-and-appeals: one action on the player's own account. */
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
  /** moderation:reporter-told-outcome-only: the player's own reports, received and then their outcome, never what was done to whom. */
  reports: { id: string; at: number; status: "open" | "decided"; outcome?: "acted" | "no-action" }[];
}

export type StandingReply = { ok: true; standing: Standing } | ServerRejection;

/** The body of `POST /api/moderation/appeal`: the log entry appealed. */
export interface AppealRequest {
  action: string;
}

/** moderation:feedback-box-in-settings: the body of `POST /api/feedback`. */
export interface FeedbackRequest {
  text: string;
  build: string;
  screen: string;
  mode: "low" | "high";
}

export type BlockReply = Blocked | ServerRejection;
export type ReportReply = Reported | ServerRejection;
