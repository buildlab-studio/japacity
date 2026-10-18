// The stores of the server's pair side (pair:invite-card-contents, pair:invite-link-single-use, pair:invite-rewards-never-cash, pair:preset-phrases-only, pair:conversation-phrases-stored, pair:place-phrases-not-stored, pair:phrase-checks-before-send, pair:block-and-report-one-tap, pair:block-ends-every-bond and pair:report-holds-conversation,
// moderation:block-refuses-both-ways, moderation:block-ends-pair-records, moderation:report-from-every-surface, moderation:report-carries-subject-and-reason, moderation:spoken-phrases-not-stored, moderation:report-offers-block, moderation:reporter-told-outcome-only, moderation:reports-hold-cited-records and moderation:open-report-pauses-conversation): invite links and their rewards,
// the conversations in preset phrases, and blocks, reports and holds. Times
// are milliseconds since 1970, passed in by the caller.
import type { ConversationRow } from "@japacity/sim";

import type { StoreResult } from "./types";

export type { ConversationRow };

// ---------------------------------------------------------------------------
// Invites (pair:invite-card-contents, pair:invite-link-single-use and pair:invite-rewards-never-cash)
// ---------------------------------------------------------------------------

/** How far an invited friend's character has come (pair:invite-rewards-never-cash). */
export type InviteMilestone = "prologue" | "chapter-two" | "departed";

/** pair:invite-link-single-use: a link as made, before anyone opens it. */
export interface NewInvite {
  code: string;
  /** The inviter's character. */
  from: string;
  /** The inviter's account: the invitee may not take their own invite, and a block between the two accounts refuses it. */
  account: string;
  slot: string;
  looking: "partner" | "sibling";
  fill: string | null;
  /** The card as it was when the link was made (pair:invite-card-contents): text keys and ids only. */
  card: unknown;
  madeAt: number;
  expires: number;
}

/** pair:invite-link-single-use: once used, the friend's character, the pair key it made and the milestones the friend had reached already. */
export interface InviteRow extends NewInvite {
  used: boolean;
  by: string | null;
  pair: string | null;
  usedAt: number | null;
  before: InviteMilestone[];
}

/** pair:invite-rewards-never-cash: a card frame and a line given to the inviter, once per friend and milestone. */
export interface RewardRow {
  from: string;
  friend: string;
  reached: InviteMilestone;
  frame: string;
  line: string;
  at: number;
}

/**
 * pair:invite-card-contents, pair:invite-link-single-use and pair:invite-rewards-never-cash. Every pair record is made by a used invite while the
 * matchmaker is shut (pair:no-records-between-strangers), so the used invites are also the index of
 * which pairs a character is in.
 */
export interface InviteStore {
  /** Refused with `exists` for a known code. */
  create: (invite: NewInvite) => Promise<StoreResult<InviteRow>>;
  get: (code: string) => Promise<InviteRow | null>;
  /** The character's links neither used nor expired at `now`, oldest first. */
  open: (from: string, now: number) => Promise<InviteRow[]>;
  /** pair:invite-link-single-use: single use. Refused with `missing` for an unknown code and `closed` once used. */
  use: (code: string, use: { by: string; pair: string; at: number; before: InviteMilestone[] }) => Promise<StoreResult<InviteRow>>;
  /** Gives back a claim whose link then failed, so the link stays usable. Refused with `missing` when the code is not used. */
  release: (code: string) => Promise<StoreResult<InviteRow>>;
  /** The pair keys of the used links that name the character, either side, each once and in key order. */
  pairsOf: (character: string) => Promise<string[]>;
  /** Every pair key a used link made, each once and in key order. */
  pairs: () => Promise<string[]>;
  /** The used links that brought `friend` in, oldest first. */
  linkedBy: (friend: string) => Promise<InviteRow[]>;
  /** The rewards the inviter has had, in the order given. */
  rewards: (from: string) => Promise<RewardRow[]>;
  /** Refused with `exists` when the inviter has had this friend's milestone already. */
  reward: (row: RewardRow) => Promise<StoreResult<RewardRow>>;
  /** account:deleted-data-removed-within-month: the character's links, the links it used, and the rewards that name it. */
  remove: (character: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Conversations (pair:conversation-phrases-stored)
// ---------------------------------------------------------------------------

/** pair:conversation-phrases-stored: rows ordered by `sentAt`, then by id. */
export interface ConversationStore {
  /** Refused with `exists` for a known message id. */
  add: (row: ConversationRow) => Promise<StoreResult<ConversationRow>>;
  /** The conversation's rows after the message `after` (all of them when null), in order. An unknown `after` gives every row. */
  list: (conversation: string, after: string | null) => Promise<ConversationRow[]>;
  /** Marks read at `at` every unread row in the conversation not sent by `reader`, and answers how many. */
  markRead: (conversation: string, reader: string, at: number) => Promise<number>;
  /** When `sender` sent each row in the conversation at or after `since`. */
  sentSince: (conversation: string, sender: string, since: number) => Promise<number[]>;
  /** The rows by id, for a report's cites. */
  byIds: (ids: readonly string[]) => Promise<ConversationRow[]>;
  /** account:deleted-data-removed-within-month, moderation:reports-hold-cited-records: removes every row of the conversations whose id names the character, except the ids in `keep`; answers how many went. */
  removeFor: (character: string, keep: readonly string[]) => Promise<number>;
}

// ---------------------------------------------------------------------------
// Blocks, reports and holds (pair:block-ends-every-bond, pair:report-holds-conversation, moderation:block-refuses-both-ways, moderation:block-ends-pair-records, moderation:report-from-every-surface, moderation:report-carries-subject-and-reason, moderation:spoken-phrases-not-stored, moderation:report-offers-block, moderation:reporter-told-outcome-only, moderation:reports-hold-cited-records and moderation:open-report-pauses-conversation)
// ---------------------------------------------------------------------------

/** moderation:block-refuses-both-ways: one account blocking another. */
export interface BlockRow {
  from: string;
  to: string;
  at: number;
}

/** moderation:report-carries-subject-and-reason. */
export type ReportReason = "scam" | "harassment" | "impersonation" | "underage" | "sexual" | "hate" | "self-harm" | "illegal" | "cheating" | "advert" | "other";

/** moderation:report-carries-subject-and-reason: what a report cites. */
export type ReportCite =
  | { messages: string[] }
  | { place: string; phrase: string; at: number }
  | { card: string }
  | { pair: string }
  | { campaign: string; slot: string };

/** pair:report-holds-conversation, moderation:report-carries-subject-and-reason, moderation:reporter-told-outcome-only. `pair` is the record the report holds, when one is cited or the messages are in one. */
export interface ReportRow {
  id: string;
  reporter: string;
  subject: { account: string } | { campaign: string };
  reason: ReportReason;
  cites: ReportCite;
  pair: string | null;
  unverified: boolean;
  at: number;
  status: "open" | "decided";
  outcome: "acted" | "no-action" | null;
  decidedAt: number | null;
}

/** moderation:reports-hold-cited-records: what a report keeps unchanged, until it is decided or `until`. */
export interface HoldRow {
  report: string;
  messages: string[];
  pair: string | null;
  until: number;
  lifted: boolean;
}

export type NewReport = Omit<ReportRow, "status" | "outcome" | "decidedAt">;

/** The pair side stores; the moderation queue and admin view read and close through `list`, `close` and `lift`. */
export interface ModerationStore {
  /** moderation:block-refuses-both-ways: a block already held keeps its first time. */
  block: (row: BlockRow) => Promise<BlockRow>;
  /** moderation:block-ends-pair-records: false when there was no block to lift. */
  unblock: (from: string, to: string) => Promise<boolean>;
  /** moderation:block-refuses-both-ways: true when either account blocks the other. */
  blocked: (x: string, y: string) => Promise<boolean>;
  /** The blocks the account has made, oldest first. */
  blocksBy: (account: string) => Promise<BlockRow[]>;
  /** pair:report-holds-conversation, moderation:reports-hold-cited-records: the report and its hold, together. Refused with `exists` for a known id. */
  report: (report: NewReport, hold: Omit<HoldRow, "report" | "lifted">) => Promise<StoreResult<ReportRow>>;
  get: (id: string) => Promise<ReportRow | null>;
  /** moderation:one-queue-by-reason-weight: the reports with this status, oldest first. */
  list: (status: "open" | "decided") => Promise<ReportRow[]>;
  /** moderation:report-offers-block: how many reports the account has filed at or after `since`. */
  filedSince: (reporter: string, since: number) => Promise<number>;
  /** moderation:open-report-pauses-conversation: the open reports on the pair record, oldest first. */
  openOn: (pair: string) => Promise<ReportRow[]>;
  /** moderation:reporter-told-outcome-only, moderation:reports-hold-cited-records: decides the report and lifts its hold. Refused with `missing` for an unknown id and `closed` once decided. */
  close: (id: string, outcome: "acted" | "no-action", at: number) => Promise<StoreResult<ReportRow>>;
  /** moderation:reports-hold-cited-records: lifts the report's hold without deciding it. Refused with `missing` when the report has no hold. */
  lift: (report: string) => Promise<StoreResult<HoldRow>>;
  /** moderation:reports-hold-cited-records: the holds not lifted and running past `now`. */
  holds: (now: number) => Promise<HoldRow[]>;
  /** account:deleted-data-removed-within-month: the account's blocks either way and the reports it filed, keeping every report whose hold still runs at `now`. */
  remove: (account: string, now: number) => Promise<void>;
}
