// The moderation records the admin view writes and reads (moderation.md
// contract): the append-only log, the banned identities, the appeals and the
// players' feedback. Reports, holds and blocks are the pair side's store.
import type { StoreResult } from "./types";

/** R-MODERATION-014: the only actions an admin may take. */
export type AdminAction =
  | "dismiss"
  | "warn"
  | "mute"
  | "suspend"
  | "ban"
  | "reset-name"
  | "pull-advert"
  | "approve-advert"
  | "refuse-advert"
  | "refer"
  | "rollback";

/** An action's parameters: `account` names whom it was taken on, `days` how long a mute or suspension lasts, `body` who a matter was referred to. */
export type LogParams = Record<string, string | number>;

/** R-MODERATION-015: one admin action as written. */
export interface ModerationLogEntry {
  id: string;
  admin: string;
  at: number;
  /** The queue item the action was taken on: a report, an appeal or an advert submission. */
  item: string;
  action: AdminAction;
  params: LogParams;
  reason: string;
  note?: string;
}

/** R-MODERATION-015: insert only. There is no method that changes or removes an entry. */
export interface ModerationLogStore {
  /** Refused with `exists` for a known id. */
  append: (entry: ModerationLogEntry) => Promise<StoreResult<ModerationLogEntry>>;
  get: (id: string) => Promise<ModerationLogEntry | null>;
  /** Entries on the item, or taken on the account (`params.account`), in the order they were written. */
  list: (filter: { item?: string; account?: string }) => Promise<ModerationLogEntry[]>;
}

/** R-MODERATION-018: a salted hash of a sign-in identity, kept after the account is gone. */
export interface BannedIdentity {
  hash: string;
  at: number;
}

export interface BannedIdentityStore {
  /** A hash already held keeps its first time. */
  add: (hashes: readonly string[], at: number) => Promise<void>;
  has: (hash: string) => Promise<boolean>;
}

/** R-MODERATION-016: an appeal against one logged action, decided once. */
export interface AppealRow {
  id: string;
  account: string;
  /** The log entry appealed. */
  entry: string;
  at: number;
  status: "open" | "decided";
  outcome?: "upheld" | "overturned";
  decidedBy?: string;
  decidedAt?: number;
}

export interface AppealStore {
  /** Refused with `exists` when the entry already has an appeal, whatever its id. */
  file: (appeal: { id: string; account: string; entry: string; at: number }) => Promise<StoreResult<AppealRow>>;
  get: (id: string) => Promise<AppealRow | null>;
  /** Open appeals, oldest first. */
  pending: () => Promise<AppealRow[]>;
  /** The account's appeals, oldest first. */
  forAccount: (account: string) => Promise<AppealRow[]>;
  /** Refused with `missing` for an unknown id and `closed` once decided. */
  decide: (id: string, decision: { outcome: "upheld" | "overturned"; by: string; at: number }) => Promise<StoreResult<AppealRow>>;
}

/** R-MODERATION-020: the one typed text the game takes. No account, session or character. */
export interface FeedbackRow {
  id: string;
  text: string;
  build: string;
  screen: string;
  mode: "low" | "high";
  /** The UTC day, `YYYY-MM-DD`. */
  day: string;
  region: string;
}

export interface FeedbackStore {
  /**
   * R-MODERATION-020: takes one of the sender's `perDay` sends on the day, and
   * answers false, counting nothing, when none is left. `sender` is a one-way
   * key kept apart from the rows, so no row can be traced to it.
   */
  take: (sender: string, day: string, perDay: number) => Promise<boolean>;
  /** Refused with `exists` for a known id. */
  add: (row: FeedbackRow) => Promise<StoreResult<FeedbackRow>>;
  /** The newest first, at most `limit`. */
  list: (limit: number) => Promise<FeedbackRow[]>;
  /** Removes every row of a day before `day`, and answers how many went. */
  drop: (day: string) => Promise<number>;
  /** Removes every send count of a day before `day`. */
  forget: (day: string) => Promise<void>;
}
