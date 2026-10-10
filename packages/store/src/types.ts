// The storage interfaces of the online milestone, as plain types. Every store
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

/** R-SERVER-002, R-CLOCK-004: the row that is locked; `v` is the stored version, `segment` the one in force. */
export interface CharacterRow {
  id: string;
  account: string;
  v: number;
  refilledAt: number;
  segment: number;
  /** R-CLOCK-031: when the bank fills if no turn is spent, from the last commit; null while the player has seen it full, or the life is over. */
  fullAt: number | null;
  /** R-CLOCK-031: when the notice of the fill at `fullAt` was claimed; cleared whenever `fullAt` moves. */
  fullNotifiedAt: number | null;
}

/** R-SERVER-003: one accepted command, with the version and hash after it. `at` is the server's real time. */
export interface LogRow {
  character: string;
  v: number;
  tick: number;
  sender: Sender;
  command: Command;
  hash: string;
  at: number;
}

/** R-SERVER-004: the full state at version `v` of one segment. */
export interface SnapshotRow {
  character: string;
  v: number;
  segment: number;
  content: string;
  overlay?: string;
  state: State;
}

/** R-SERVER-020: how a segment starts, as decision 0006 gives `SaveSegment.start`. */
export type SegmentStart = { scenario: Id<"scenario">; seed: string; worldSeed: string } | { base: State };

/** R-SERVER-020, R-SERVER-021: a segment begins after version `fromV` and holds the log rows up to the next segment's `fromV`. */
export interface SegmentRow {
  character: string;
  segment: number;
  fromV: number;
  content: string;
  overlay?: string;
  start: SegmentStart;
}

/** R-SERVER-004, R-SERVER-016: what the server knows when it makes a character. The store makes version 0 and segment 0. */
export interface NewCharacter {
  id: string;
  account: string;
  refilledAt: number;
  content: string;
  overlay?: string;
  /** A new life from its scenario and seeds, or (a sibling made from an invite, R-PEOPLE-011) the state it starts from. */
  start: SegmentStart;
  /** The state at version 0, stored as segment 0's first snapshot. */
  state: State;
}

/** R-SERVER-004: a character as a load sees it: the latest snapshot of its segment and the log rows after it, in version order. */
export interface Held {
  character: CharacterRow;
  /** Every segment still stored, in order. */
  segments: SegmentRow[];
  snapshot: SnapshotRow;
  tail: LogRow[];
}

/** R-SERVER-007: what a transaction's work is given. */
export interface TxRows {
  /** The held characters in ascending id order, whatever order they were asked in. */
  characters: Held[];
  /** R-PAIR-004: every stored pair record between two held characters, by key. */
  pairs: PairRow[];
}

/**
 * R-SERVER-002, R-SERVER-009: one character's writes. Applied in this order:
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
  /** R-SERVER-009: segments whose rows leave the store, after the caller has copied them to the audit store. Never the one in force. */
  retire?: number[];
}

/** R-PAIR-001: a pair write is accepted only at the version the writer read; 0 makes the record. */
export interface PairWrite {
  key: string;
  expectedV: number;
  record: PairRecord;
}

/** R-SERVER-002: everything one transaction writes, applied together or not at all. */
export interface Writes {
  characters?: CharacterWrite[];
  pairs?: PairWrite[];
}

/** R-SERVER-002: the work run under the locks. It returns what to write and what to hand back. */
export type Work<T> = (rows: TxRows) => Promise<{ writes: Writes; result: T }> | { writes: Writes; result: T };

/** R-SERVER-002, R-SERVER-007: a character's row, segments, snapshots and log. Every write goes through `transact`. */
export interface PlayerStore {
  /** R-SERVER-004: makes the character at version 0, refused with `exists` for a known id. */
  create: (character: NewCharacter) => Promise<StoreResult<Held>>;
  /** R-SERVER-004: null for an unknown id. */
  load: (id: string) => Promise<Held | null>;
  /** R-SERVER-008: the stored log rows after version `after`, in version order, for the rollback tool. */
  log: (id: string, after: number) => Promise<LogRow[]>;
  /**
   * R-SERVER-007: locks the named characters in ascending id order, runs `work`
   * once with their rows, and applies the writes it returns atomically. A
   * missing id is refused before `work` runs; a refused write writes nothing.
   */
  transact: <T>(ids: readonly string[], work: Work<T>) => Promise<StoreResult<T>>;
  /** R-ACCOUNT-017, R-MODERATION-008: removes every row that names the character, its pair records included but a record a report holds (`held: true`). */
  remove: (id: string) => Promise<void>;
  /**
   * R-CLOCK-031: sets `fullAt` while the row is still at version `v`, so an
   * older commit never overwrites a newer one; a changed value clears
   * `fullNotifiedAt`. False when the row moved on or is gone.
   */
  setFullAt: (id: string, v: number, fullAt: number | null) => Promise<boolean>;
  /** R-CLOCK-031: the rows whose `fullAt` is at or before `now` with no notice claimed, in ascending id order. */
  filled: (now: number) => Promise<CharacterRow[]>;
  /** R-CLOCK-031: claims the notice of the fill at `fullAt`. True for the one call that claimed it, false once claimed or when `fullAt` moved. */
  claimFull: (id: string, fullAt: number, at: number) => Promise<boolean>;
}

/** The pair record of pair.md R-PAIR-002. Typed `unknown` until `PairRecord` lands in packages/sim/src/pair/. */
export type PairRecord = unknown;

/** R-PAIR-001: one row per pair; `key` is the two ids sorted and joined by `~`, `a` the lower id. */
export interface PairRow {
  key: string;
  a: string;
  b: string;
  v: number;
  record: PairRecord;
}

/** R-PAIR-004: read outside a transaction; written only through `PlayerStore.transact` holding both characters. */
export interface PairStore {
  get: (key: string) => Promise<PairRow | null>;
}

// ---------------------------------------------------------------------------
// The world: ticks and draws (clock.md, lottery.md)
// ---------------------------------------------------------------------------

/** The director's book (clock.md contract item 1). Typed `unknown` until `DirectorBook` lands in packages/sim/src/world/. */
export type DirectorBookRow = unknown;

/** R-CLOCK-010: one stored world tick, never rewritten. */
export interface WorldTickRow {
  tick: number;
  world: World;
  book: DirectorBookRow;
  content: string;
  hash: string;
}

/** R-LOTTERY-007, R-LOTTERY-012, R-LOTTERY-021: what is fixed when a draw opens. */
export interface NewDraw {
  draw: number;
  secret: string;
  fingerprint: string;
  beaconRound: number;
  /** The raffle's declared top-up, in tickets; switched off by decision 0010, so every new draw stores 0. */
  topUpTickets: number;
  /** R-LOTTERY-021: the odds and amounts the draw runs under. */
  odds: LotteryOdds;
  /** R-LOTTERY-012: the jackpot standing when the draw opened, in kobo. */
  jackpot: number;
}

/** R-LOTTERY-007, R-LOTTERY-008, R-LOTTERY-015: a draw; `closedAt` is set by `freeze`, `result` once after it. */
export interface DrawRow extends NewDraw {
  closedAt: number | null;
  /** R-LOTTERY-008: the published token list and its hash, set once by `setList` after the freeze; null before. */
  list: string[] | null;
  listHash: string | null;
  result: LotteryResult | null;
}

/** R-LOTTERY-005: a ticket, numbered from 0 in the order the purchases were committed. */
export interface TicketRow {
  draw: number;
  n: number;
  character: string;
}

/** R-CLOCK-010, R-CLOCK-013, R-LOTTERY-005 to 008: the world's history and the draws. */
export interface WorldStore {
  /** R-CLOCK-010: null when the tick is not stored. */
  tick: (n: number) => Promise<WorldTickRow | null>;
  /** R-CLOCK-012: the highest stored tick, or null with none. */
  latest: () => Promise<WorldTickRow | null>;
  /** R-CLOCK-013: keeps the first row for a tick. True when this row was stored, false when one was there already. */
  insertTick: (row: WorldTickRow) => Promise<boolean>;
  /** R-LOTTERY-007: null when the draw is not stored. */
  draw: (n: number) => Promise<DrawRow | null>;
  /** R-LOTTERY-007, R-LOTTERY-021: stores a draw once. The same commitments, odds and jackpot again is a no-op; different ones are a `conflict`. */
  putDraw: (row: NewDraw) => Promise<StoreResult<DrawRow>>;
  /** R-LOTTERY-005: appends `count` tickets and returns their numbers. Refused with `closed` once the draw is frozen. */
  addTickets: (draw: number, character: string, count: number) => Promise<StoreResult<number[]>>;
  /** R-LOTTERY-005: the draw's tickets in number order. */
  tickets: (draw: number) => Promise<TicketRow[]>;
  /** R-LOTTERY-008: closes the list at `at` and returns it. A second freeze keeps the first `closedAt`. */
  freeze: (draw: number, at: number) => Promise<StoreResult<TicketRow[]>>;
  /** R-LOTTERY-008: stores the published list and its hash once, only after the freeze. The same list again is a no-op; another is a `conflict`. */
  setList: (draw: number, list: readonly string[], listHash: string) => Promise<StoreResult<DrawRow>>;
  /** R-LOTTERY-015: stores the result once, only after the freeze. */
  setResult: (draw: number, result: LotteryResult) => Promise<StoreResult<DrawRow>>;
}

// ---------------------------------------------------------------------------
// Presence and nudges (clock.md)
// ---------------------------------------------------------------------------

/** R-CLOCK-026: what a socket's attachment carries. */
export interface PresenceMember {
  account: string;
  name: string;
  look: string;
  place: string;
  joinedAt: number;
}

/** R-CLOCK-025 to 028: who is in a place, held in memory only. */
export interface PresenceStore {
  /** R-CLOCK-026: one entry per socket. */
  join: (place: string, socket: string, member: PresenceMember) => Promise<void>;
  /** R-CLOCK-027: a closed socket leaves at once. */
  leave: (place: string, socket: string) => Promise<void>;
  /**
   * R-CLOCK-028: at most `n` members of the place, never the asker's account,
   * never one account twice. `seed` picks the sample, so the caller draws it
   * afresh for each fetch and a test can repeat one.
   */
  sample: (place: string, n: number, asker: string | null, seed: number) => Promise<PresenceMember[]>;
}

/** R-CLOCK-020: a socket only says that something changed. */
export type Nudge = { nudge: "view"; v: number } | { nudge: "messages" } | { nudge: "presence" };

export type NudgeHandler = (nudge: Nudge) => void;

/** R-CLOCK-020, R-CLOCK-022: best effort; a nudge to an account with no subscriber is dropped. */
export interface NudgeBus {
  send: (account: string, nudge: Nudge) => Promise<void>;
  /** Returns the function that ends the subscription. */
  subscribe: (account: string, handler: NudgeHandler) => () => void;
}

// ---------------------------------------------------------------------------
// Accounts and deletion (account.md)
// ---------------------------------------------------------------------------

/** R-ACCOUNT-012, R-ACCOUNT-020: the account's own row, beside the auth library's tables. */
export interface AccountRow {
  id: string;
  country: string;
  age: { passed: boolean; at: number; method: "declared" | "verified" };
  createdAt: number;
  character: string | null;
  /** R-CLOCK-031: the setting that sends the bank-full notice. Off until the player agrees. */
  notifyBankFull: boolean;
  /** R-ANALYTICS-006: the "Send usage counts" setting. On until the player turns it off. */
  sendUsageCounts: boolean;
}

/** R-ACCOUNT-015, R-ACCOUNT-017. */
export interface AccountStore {
  get: (id: string) => Promise<AccountRow | null>;
  /** Refused with `exists` for a known id. */
  create: (row: AccountRow) => Promise<StoreResult<AccountRow>>;
  /** R-ACCOUNT-015: refused with `one-character` while another character is set. Null clears it. */
  setCharacter: (id: string, character: string | null) => Promise<StoreResult<AccountRow>>;
  /** R-CLOCK-031: the bank-full setting. Refused with `missing` for an unknown id. */
  setNotify: (id: string, on: boolean) => Promise<StoreResult<AccountRow>>;
  /** R-ANALYTICS-006: the usage counts setting. Refused with `missing` for an unknown id. */
  setUsageCounts: (id: string, on: boolean) => Promise<StoreResult<AccountRow>>;
  /** R-ACCOUNT-017. */
  remove: (id: string) => Promise<void>;
}

/** R-ACCOUNT-017, R-ACCOUNT-018: `account` is set while the deletion is pending and cleared when it completes, leaving only the hash. */
export interface DeletionRow {
  account: string | null;
  accountHash: string;
  requestedAt: number;
  dueAt: number;
  completedAt: number | null;
}

/** R-ACCOUNT-017, R-ACCOUNT-018. */
export interface DeletionStore {
  /** A second request while one is pending returns the first unchanged. */
  request: (row: { account: string; accountHash: string; requestedAt: number; dueAt: number }) => Promise<StoreResult<DeletionRow>>;
  /** Pending deletions with `dueAt` at or before `now`, earliest first. */
  due: (now: number) => Promise<DeletionRow[]>;
  /** Refused with `missing` when no deletion is pending for the account. */
  complete: (account: string, at: number) => Promise<StoreResult<DeletionRow>>;
  /** R-ACCOUNT-018: so a second request can be answered after the account is gone. */
  find: (accountHash: string) => Promise<DeletionRow | null>;
}

// ---------------------------------------------------------------------------
// Notifications (clock.md R-CLOCK-031)
// ---------------------------------------------------------------------------

/** R-CLOCK-031: a browser's push subscription, as `PushSubscription.toJSON()` gives it. */
export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** R-CLOCK-031, R-ACCOUNT-017, R-ACCOUNT-020: the devices that agreed, one row per endpoint, kept only while the setting is on. */
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

/** R-SERVER-011: a character's wallet totals at its last mark, and the day it was taken. */
export interface LedgerMark {
  character: string;
  day: number;
  totals: WalletSlice["totals"];
}

/** R-SERVER-011: money created and destroyed on one UTC day, by reason and currency. */
export interface DayRow {
  day: number;
  created: ByReason;
  destroyed: ByReason;
}

/** R-SERVER-011. A day is a whole number of UTC days since 1970. */
export interface LedgerStore {
  mark: (character: string) => Promise<LedgerMark | null>;
  /** Replaces the mark, never adds to it. */
  setMark: (character: string, totals: WalletSlice["totals"], day: number) => Promise<void>;
  /** Adds to the day's totals. */
  addDay: (day: number, created: ByReason, destroyed: ByReason) => Promise<void>;
  /** A day with nothing added has empty totals. */
  day: (day: number) => Promise<DayRow>;
  /** R-ACCOUNT-017: the marks go with the account. */
  dropMark: (character: string) => Promise<void>;
}

/** R-SERVER-009, R-SERVER-021: rows a correction or an upgrade took out of play. */
export interface AuditEntry {
  character: string;
  /** `passkey`: a passkey bound to an account (R-ACCOUNT-003); the alarm list never reads these rows. */
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

/** R-SERVER-009: append-only. Nothing changes or removes a row once retired. */
export interface AuditStore {
  retire: (entry: AuditEntry) => Promise<AuditRow>;
  /** The character's entries in the order they were retired. */
  list: (character: string) => Promise<AuditRow[]>;
}
