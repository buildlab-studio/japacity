// The storage interfaces, as plain types. Every store
// method is a promise, so the same interface fits a map in memory and a
// Postgres table. Times are milliseconds since 1970, always passed in by the
// caller: no store reads a clock.
import type { Command, Currency, Id, LotteryOdds, LotteryResult, Reason, Sender, State, WalletSlice, World } from "@japacity/sim";

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** Why a store refused a call. A refused call writes nothing. */
export type StoreCode =
  | "exists"
  | "missing"
  | "stale"
  | "not-held"
  | "bad-write"
  | "one-character"
  | "open"
  | "closed"
  | "conflict";

/** A refusal is data, not a thrown error, so the server can turn it into a reply. */
export interface Refusal {
  ok: false;
  code: StoreCode;
  detail: string;
}

export type StoreResult<T> = { ok: true; value: T } | Refusal;

// ---------------------------------------------------------------------------
// Characters: PlayerStore and PairStore (server.md, pair.md)
// ---------------------------------------------------------------------------

/** server:one-command-one-transaction, clock:turns-earned-from-refill-time: the row that is locked; `v` is the stored version, `segment` the one in force. */
export interface CharacterRow {
  id: string;
  account: string;
  v: number;
  refilledAt: number;
  segment: number;
  /** clock:full-bank-push-notification: when the bank fills if no turn is spent, from the last commit; null while the player has seen it full, or the life is over. */
  fullAt: number | null;
  /** clock:full-bank-push-notification: when the notice of the fill at `fullAt` was claimed; cleared whenever `fullAt` moves. */
  fullNotifiedAt: number | null;
}

/** server:log-rows-hash-state: one accepted command, with the version and hash after it. `at` is the server's real time. */
export interface LogRow {
  character: string;
  v: number;
  tick: number;
  sender: Sender;
  command: Command;
  hash: string;
  at: number;
}

/** server:snapshots-bound-replay: the full state at version `v` of one segment. */
export interface SnapshotRow {
  character: string;
  v: number;
  segment: number;
  content: string;
  overlay?: string;
  state: State;
}

/** server:save-is-list-of-segments: how a segment starts, as decision 0004 gives `SaveSegment.start`. */
export type SegmentStart = { scenario: Id<"scenario">; seed: string; worldSeed: string } | { base: State };

/** server:save-is-list-of-segments, server:newer-content-upgrades-state: a segment begins after version `fromV` and holds the log rows up to the next segment's `fromV`. */
export interface SegmentRow {
  character: string;
  segment: number;
  fromV: number;
  content: string;
  overlay?: string;
  start: SegmentStart;
}

/** server:snapshots-bound-replay, server:hidden-values-made-once: what the server knows when it makes a character. The store makes version 0 and segment 0. */
export interface NewCharacter {
  id: string;
  account: string;
  refilledAt: number;
  content: string;
  overlay?: string;
  /** A new life from its scenario and seeds, or (a sibling made from an invite, person:real-sibling-shares-family-draw) the state it starts from. */
  start: SegmentStart;
  /** The state at version 0, stored as segment 0's first snapshot. */
  state: State;
  /** account:person-kept-with-character: the person built at the door, kept with the character; none when the life was made without one. */
  person?: KeptPerson | null;
}

/**
 * account:person-kept-with-character: the person built at the door as the server keeps it beside the character: the first
 * name, the look, the archetype it started as (null for a ready life) and the player's own colours on the look. Never the
 * page's photo, which each phone draws again. The row and the wire are one declaration (decision 0027).
 */
export interface KeptPerson {
  name: string;
  look: string;
  archetype: string | null;
  style?: { skin?: string; hair?: string; top?: string; fabric?: string };
}

/** server:snapshots-bound-replay: a character as a load sees it: the latest snapshot of its segment and the log rows after it, in version order. */
export interface Held {
  character: CharacterRow;
  /** Every segment still stored, in order. */
  segments: SegmentRow[];
  snapshot: SnapshotRow;
  tail: LogRow[];
  /** server:snapshots-bound-replay: the hash of the log row at the snapshot's version, where one is stored. */
  anchor?: string;
}

/** server:paired-rows-locked-in-order: what a transaction's work is given. */
export interface TxRows {
  /** The held characters in ascending id order, whatever order they were asked in. */
  characters: Held[];
  /** pair:only-server-writes-record: every stored pair record between two held characters, by key. */
  pairs: PairRow[];
}

/**
 * server:one-command-one-transaction, server:rollback-apply-one-account: one character's writes. Applied in this order:
 * the new segment, the appended rows, the snapshots, the retired segments.
 */
export interface CharacterWrite {
  id: string;
  /** Opens the next segment at `fromV`, at or above the stored version. Its base snapshot must be in `snapshots`. */
  segment?: SegmentRow;
  /** Log rows numbered on from the stored version with no gap. A row at or under it is `stale`. */
  append?: LogRow[];
  snapshots?: SnapshotRow[];
  refilledAt?: number;
  /** server:rollback-apply-one-account: segments whose rows leave the store, after the caller has copied them to the audit store. Never the one in force. */
  retire?: number[];
}

/** pair:one-record-per-two: a pair write is accepted only at the version the writer read; 0 makes the record. */
export interface PairWrite {
  key: string;
  expectedV: number;
  record: PairRecord;
}

/** server:one-command-one-transaction: everything one transaction writes, applied together or not at all. */
export interface Writes {
  characters?: CharacterWrite[];
  pairs?: PairWrite[];
}

/**
 * server:one-command-one-transaction: the stores a transaction's work may call, bound
 * to that transaction's own client. Inside a transaction every read goes
 * through them; the work never calls a store the server holds, whose handle's
 * lock the transaction already holds.
 */
export interface TxStores {
  /** clock:command-uses-stamped-tick: the stored world rows a replay needs; lottery:tickets-numbered-by-commit: the tickets a purchase adds. */
  world: WorldStore;
  /** server:rollback-apply-one-account: the retired segments a rollback copies. */
  audit: AuditStore;
}

/** server:one-command-one-transaction: the work run under the locks. It returns what to write and what to hand back. */
export type Work<T> = (rows: TxRows, stores: TxStores) => Promise<{ writes: Writes; result: T }> | { writes: Writes; result: T };

/** server:one-command-one-transaction, server:paired-rows-locked-in-order: a character's row, segments, snapshots and log. Every write goes through `transact`. */
export interface PlayerStore {
  /** server:snapshots-bound-replay: makes the character at version 0, refused with `exists` for a known id. */
  create: (character: NewCharacter) => Promise<StoreResult<Held>>;
  /** server:snapshots-bound-replay: null for an unknown id. */
  load: (id: string) => Promise<Held | null>;
  /** server:rollback-check-finds-divergence: the stored log rows after version `after`, in version order, for the rollback tool. */
  log: (id: string, after: number) => Promise<LogRow[]>;
  /**
   * server:paired-rows-locked-in-order: locks the named characters in ascending id order, runs `work`
   * once with their rows, and applies the writes it returns atomically. A
   * missing id is refused before `work` runs; a refused write writes nothing.
   */
  transact: <T>(ids: readonly string[], work: Work<T>) => Promise<StoreResult<T>>;
  /** account:deleted-data-removed-within-month, moderation:reports-hold-cited-records: removes every row that names the character, its pair records included but a record a report holds (`held: true`). */
  remove: (id: string) => Promise<void>;
  /**
   * clock:full-bank-push-notification: sets `fullAt` while the row is still at version `v`, so an
   * older commit never overwrites a newer one; a changed value clears
   * `fullNotifiedAt`. False when the row moved on or is gone.
   */
  setFullAt: (id: string, v: number, fullAt: number | null) => Promise<boolean>;
  /** clock:full-bank-push-notification: the rows whose `fullAt` is at or before `now` with no notice claimed, in ascending id order. */
  filled: (now: number) => Promise<CharacterRow[]>;
  /** clock:full-bank-push-notification: claims the notice of the fill at `fullAt`. True for the one call that claimed it, false once claimed or when `fullAt` moved. */
  claimFull: (id: string, fullAt: number, at: number) => Promise<boolean>;
  /**
   * account:two-lights-and-wink-lines: up to `limit` stored character rows
   * whose id comes after `after` (from the first when null), in ascending id
   * order, so the nightly count of lives reads every character a page at a time.
   */
  page: (after: string | null, limit: number) => Promise<CharacterRow[]>;
  /** account:person-kept-with-character: the person kept with the character, or null when none is kept or there is no such character. */
  person: (id: string) => Promise<KeptPerson | null>;
  /** account:person-kept-with-character, moderation:fixed-admin-actions: replaces the kept person, as `reset-name` does. False when there is no such character. */
  setPerson: (id: string, person: KeptPerson) => Promise<boolean>;
}

/** The pair record of pair:record-fields. Typed `unknown` here; the simulation's own `PairRecord` is in packages/sim/src/engine/types.ts. */
export type PairRecord = unknown;

/** pair:one-record-per-two: one row per pair; `key` is the two ids sorted and joined by `~`, `a` the lower id. */
export interface PairRow {
  key: string;
  a: string;
  b: string;
  v: number;
  record: PairRecord;
}

/** pair:only-server-writes-record: read outside a transaction; written only through `PlayerStore.transact` holding both characters. */
export interface PairStore {
  get: (key: string) => Promise<PairRow | null>;
}

// ---------------------------------------------------------------------------
// The world: ticks and draws (clock.md, lottery.md)
// ---------------------------------------------------------------------------

/** The director's book (clock.md, Contract): the simulation's `DirectorBook`, typed `unknown` here. */
export type DirectorBookRow = unknown;

/** clock:world-is-stored-history: one stored world tick, never rewritten. */
export interface WorldTickRow {
  tick: number;
  world: World;
  book: DirectorBookRow;
  content: string;
  hash: string;
}

/** lottery:fingerprint-commits-secret, lottery:jackpot-rolls-over, lottery:odds-fixed-at-draw-open: what is fixed when a draw opens. */
export interface NewDraw {
  draw: number;
  secret: string;
  fingerprint: string;
  beaconRound: number;
  /** lottery:odds-fixed-at-draw-open: the odds and amounts the draw runs under. */
  odds: LotteryOdds;
  /** lottery:jackpot-rolls-over: the jackpot standing when the draw opened, in kobo. */
  jackpot: number;
}

/** lottery:fingerprint-commits-secret, lottery:ticket-list-frozen-anonymously, lottery:result-published-in-tick-row: a draw; `closedAt` is set by `freeze`, `result` once after it. */
export interface DrawRow extends NewDraw {
  closedAt: number | null;
  /** lottery:ticket-list-frozen-anonymously: the published token list and its hash, set once by `setList` after the freeze; null before. */
  list: string[] | null;
  listHash: string | null;
  result: LotteryResult | null;
}

/** lottery:tickets-numbered-by-commit: a ticket, numbered from 0 in the order the purchases were committed. */
export interface TicketRow {
  draw: number;
  n: number;
  character: string;
}

/** clock:world-is-stored-history, clock:request-fills-missing-ticks, lottery:tickets-numbered-by-commit, lottery:view-shows-draw-state, lottery:fingerprint-commits-secret and lottery:ticket-list-frozen-anonymously: the world's history and the draws. */
export interface WorldStore {
  /** clock:world-is-stored-history: null when the tick is not stored. */
  tick: (n: number) => Promise<WorldTickRow | null>;
  /** clock:cron-stores-missing-ticks: the highest stored tick, or null with none. */
  latest: () => Promise<WorldTickRow | null>;
  /** clock:request-fills-missing-ticks: keeps the first row for a tick. True when this row was stored, false when one was there already. */
  insertTick: (row: WorldTickRow) => Promise<boolean>;
  /** lottery:fingerprint-commits-secret: null when the draw is not stored. */
  draw: (n: number) => Promise<DrawRow | null>;
  /** lottery:fingerprint-commits-secret, lottery:odds-fixed-at-draw-open: stores a draw once. The same commitments, odds and jackpot again is a no-op; different ones are a `conflict`. */
  putDraw: (row: NewDraw) => Promise<StoreResult<DrawRow>>;
  /** lottery:tickets-numbered-by-commit: appends `count` tickets and returns their numbers. Refused with `closed` once the draw is frozen. */
  addTickets: (draw: number, character: string, count: number) => Promise<StoreResult<number[]>>;
  /** lottery:tickets-numbered-by-commit: the draw's tickets in number order. */
  tickets: (draw: number) => Promise<TicketRow[]>;
  /** lottery:ticket-list-frozen-anonymously: closes the list at `at` and returns it. A second freeze keeps the first `closedAt`. */
  freeze: (draw: number, at: number) => Promise<StoreResult<TicketRow[]>>;
  /** lottery:ticket-list-frozen-anonymously: stores the published list and its hash once, only after the freeze. The same list again is a no-op; another is a `conflict`. */
  setList: (draw: number, list: readonly string[], listHash: string) => Promise<StoreResult<DrawRow>>;
  /** lottery:result-published-in-tick-row: stores the result once, only after the freeze. */
  setResult: (draw: number, result: LotteryResult) => Promise<StoreResult<DrawRow>>;
}

// ---------------------------------------------------------------------------
// Presence and nudges (clock.md)
// ---------------------------------------------------------------------------

/** clock:attachments-rebuild-presence: what a socket's attachment carries. */
export interface PresenceMember {
  account: string;
  name: string;
  look: string;
  place: string;
  joinedAt: number;
}

/** clock:presence-held-in-memory, clock:attachments-rebuild-presence, clock:moving-switches-place-socket and clock:presence-is-a-sample: who is in a place, held in memory only. */
export interface PresenceStore {
  /** clock:attachments-rebuild-presence: one entry per socket. */
  join: (place: string, socket: string, member: PresenceMember) => Promise<void>;
  /** clock:moving-switches-place-socket: a closed socket leaves at once. */
  leave: (place: string, socket: string) => Promise<void>;
  /**
   * clock:presence-is-a-sample: at most `n` members of the place, never the asker's account,
   * never one account twice. `seed` picks the sample, so the caller draws it
   * afresh for each fetch and a test can repeat one.
   */
  sample: (place: string, n: number, asker: string | null, seed: number) => Promise<PresenceMember[]>;
  /**
   * account:player-deletes-account, moderation:fixed-admin-actions: closes every socket of the account in these places at
   * once, and `name` leaves the day's list where one is kept (city:players-shown-present-not-tracked).
   */
  forget: (places: readonly string[], account: string, name: string) => Promise<void>;
}

/** clock:socket-only-nudges: a socket only says that something changed. */
export type Nudge = { nudge: "view"; v: number } | { nudge: "messages" } | { nudge: "presence" };

export type NudgeHandler = (nudge: Nudge) => void;

/** clock:socket-only-nudges, clock:nudges-are-best-effort: best effort; a nudge to an account with no subscriber is dropped. */
export interface NudgeBus {
  send: (account: string, nudge: Nudge) => Promise<void>;
  /** Returns the function that ends the subscription. */
  subscribe: (account: string, handler: NudgeHandler) => () => void;
}

// ---------------------------------------------------------------------------
// Accounts and deletion (account.md)
// ---------------------------------------------------------------------------

/** account:age-screen-refuses-minors, account:only-needed-data-kept: the account's own row, beside the auth library's tables. */
export interface AccountRow {
  id: string;
  country: string;
  age: { passed: boolean; at: number; method: "declared" | "verified" };
  createdAt: number;
  character: string | null;
  /** clock:full-bank-push-notification: the setting that sends the bank-full notice. Off until the player agrees. */
  notifyBankFull: boolean;
  /** analytics:player-can-stop-usage-counts: the "Send usage counts" setting. On until the player turns it off. */
  sendUsageCounts: boolean;
  /** account:guest-and-secured-states: a guest has no sign-in method yet; securing adds one and never goes back. */
  state: "guest" | "secured";
  /** account:username-and-unconfirmed-email: the handle, unique whatever the capitals. */
  username: string;
  /** account:username-and-unconfirmed-email: the last change of the username; null while the free change is unused. */
  usernameChangedAt: number | null;
  /** account:idle-guests-cleaned-by-hand: the last command or new life of the account. */
  lastPlayedAt: number;
}

/** account:one-character-per-account, account:deleted-data-removed-within-month. */
export interface AccountStore {
  get: (id: string) => Promise<AccountRow | null>;
  /** Refused with `exists` for a known id and `conflict` for a username another account holds in any capitals. */
  create: (row: AccountRow) => Promise<StoreResult<AccountRow>>;
  /** account:username-and-unconfirmed-email: the account holding `username` in any capitals, or null. */
  byUsername: (username: string) => Promise<AccountRow | null>;
  /** account:username-and-unconfirmed-email, city:board-line-and-ranking: the usernames of these accounts in one read, for the everyone board; an unknown id is left out. */
  usernames: (ids: readonly string[]) => Promise<Map<string, string>>;
  /** account:username-and-unconfirmed-email: refused with `missing` for an unknown id and `conflict` for a username another account holds. `at` becomes `usernameChangedAt`; null clears it, so the account may choose a name at once (a moderator's reset, moderation:fixed-admin-actions). */
  setUsername: (id: string, username: string, at: number | null) => Promise<StoreResult<AccountRow>>;
  /** account:guest-secures-the-life: the account is secured. Refused with `missing` for an unknown id. */
  secure: (id: string) => Promise<StoreResult<AccountRow>>;
  /** account:idle-guests-cleaned-by-hand: `lastPlayedAt` becomes `at` unless it is later already. A no-op for an unknown id. */
  touch: (id: string, at: number) => Promise<void>;
  /** account:idle-guests-cleaned-by-hand: guests whose `lastPlayedAt` is before `before`, oldest play first. Secured accounts never. */
  idleGuests: (before: number) => Promise<AccountRow[]>;
  /** account:one-character-per-account: refused with `one-character` while another character is set. Null clears it. */
  setCharacter: (id: string, character: string | null) => Promise<StoreResult<AccountRow>>;
  /** clock:full-bank-push-notification: the bank-full setting. Refused with `missing` for an unknown id. */
  setNotify: (id: string, on: boolean) => Promise<StoreResult<AccountRow>>;
  /** analytics:player-can-stop-usage-counts: the usage counts setting. Refused with `missing` for an unknown id. */
  setUsageCounts: (id: string, on: boolean) => Promise<StoreResult<AccountRow>>;
  /** account:deleted-data-removed-within-month. */
  remove: (id: string) => Promise<void>;
}

/** account:deleted-data-removed-within-month, account:deletion-keeps-anonymous-totals: `account` is set while the deletion is pending and cleared when it completes, leaving only the hash. */
export interface DeletionRow {
  account: string | null;
  accountHash: string;
  requestedAt: number;
  dueAt: number;
  completedAt: number | null;
}

/** account:deleted-data-removed-within-month, account:deletion-keeps-anonymous-totals. */
export interface DeletionStore {
  /** A second request while one is pending returns the first unchanged. */
  request: (row: { account: string; accountHash: string; requestedAt: number; dueAt: number }) => Promise<StoreResult<DeletionRow>>;
  /** Pending deletions with `dueAt` at or before `now`, earliest first. */
  due: (now: number) => Promise<DeletionRow[]>;
  /** Refused with `missing` when no deletion is pending for the account. */
  complete: (account: string, at: number) => Promise<StoreResult<DeletionRow>>;
  /** account:deletion-keeps-anonymous-totals: so a second request can be answered after the account is gone. */
  find: (accountHash: string) => Promise<DeletionRow | null>;
}

// ---------------------------------------------------------------------------
// Notifications (clock:full-bank-push-notification)
// ---------------------------------------------------------------------------

/** clock:full-bank-push-notification: a browser's push subscription, as `PushSubscription.toJSON()` gives it. */
export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** clock:full-bank-push-notification, account:deleted-data-removed-within-month, account:only-needed-data-kept: the devices that agreed, one row per endpoint, kept only while the setting is on. */
export interface PushStore {
  /** Stores the device for the account. An endpoint already stored moves to this account with the new keys. */
  subscribe: (account: string, subscription: PushSubscriptionJson) => Promise<void>;
  /** Removes the device when the account holds it; anything else is a no-op. */
  unsubscribe: (account: string, endpoint: string) => Promise<void>;
  /** The account's devices in ascending endpoint order. */
  forAccount: (account: string) => Promise<PushSubscriptionJson[]>;
  /** Removes every device of the account. */
  forget: (account: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Money and audit (server.md)
// ---------------------------------------------------------------------------

/** Kobo, pence or cents by reason and currency, as the wallet's totals hold them. */
export type ByReason = Partial<Record<Reason, Partial<Record<Currency, number>>>>;

/** server:daily-money-report: a character's wallet totals at its last mark, and the day it was taken. */
export interface LedgerMark {
  character: string;
  day: number;
  totals: WalletSlice["totals"];
}

/** server:daily-money-report: money created and destroyed on one UTC day, by reason and currency. */
export interface DayRow {
  day: number;
  created: ByReason;
  destroyed: ByReason;
}

/** server:daily-money-report: the ledger's reads and writes, on its own or inside one of its transactions. */
export interface LedgerRows {
  mark: (character: string) => Promise<LedgerMark | null>;
  /** Replaces the mark, never adds to it. */
  setMark: (character: string, totals: WalletSlice["totals"], day: number) => Promise<void>;
  /** Adds to the day's totals. */
  addDay: (day: number, created: ByReason, destroyed: ByReason) => Promise<void>;
  /** A day with nothing added has empty totals. */
  day: (day: number) => Promise<DayRow>;
  /** account:deleted-data-removed-within-month: the marks go with the account. */
  dropMark: (character: string) => Promise<void>;
}

/** server:daily-money-report. A day is a whole number of UTC days since 1970. */
export interface LedgerStore extends LedgerRows {
  /**
   * server:daily-money-report: one transaction. The work is handed the ledger bound to the transaction (as
   * decision 0006 hands a player transaction its stores) and reads and writes only through it: what it wrote is
   * kept when it resolves, and none of it when it throws, so a day's totals and the mark that closes them move together.
   */
  transaction: <T>(work: (ledger: LedgerRows) => Promise<T>) => Promise<T>;
}

/** server:rollback-apply-one-account, server:newer-content-upgrades-state: rows a correction or an upgrade took out of play. */
export interface AuditEntry {
  character: string;
  /** `passkey`: a passkey bound to an account (account:passkey-needs-signed-in-session); the alarm list never reads these rows. */
  why: "rollback" | "upgrade" | "alarm" | "passkey";
  at: number;
  note: string;
  segments: SegmentRow[];
  log: LogRow[];
  snapshots: SnapshotRow[];
}

/** An audit entry as stored; `n` rises with every entry. */
export interface AuditRow extends AuditEntry {
  n: number;
}

/**
 * server:rollback-apply-one-account: append-only. Nothing changes a row once retired, and only `forget` removes one:
 * account:deleted-data-removed-within-month takes a deleted account's character's rows with the rest.
 */
export interface AuditStore {
  retire: (entry: AuditEntry) => Promise<AuditRow>;
  /** The character's entries in the order they were retired. */
  list: (character: string) => Promise<AuditRow[]>;
  /** account:deleted-data-removed-within-month: removes every entry of the character; one with none is no fault. */
  forget: (character: string) => Promise<void>;
}
