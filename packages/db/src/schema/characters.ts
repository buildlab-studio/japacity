// server:one-command-one-transaction, server:log-rows-hash-state, server:snapshots-bound-replay, server:save-is-list-of-segments, pair:one-record-per-two: a character's row, its save
// segments, snapshots and command log, and the records shared by two characters.
// Ids are ordered in JavaScript by UTF-16 code unit (compareIds), never by a
// collation, so no id column needs COLLATE "C".
import type { Command, Sender, State } from "@japacity/sim";
import type { KeptPerson, PairRecord, SegmentStart } from "@japacity/store";
import { sql } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

/** server:one-command-one-transaction: the row every command locks. */
export const characters = pgTable(
  "characters",
  {
    id: text("id").primaryKey(),
    account: text("account").notNull(),
    v: integer("v").notNull(),
    refilledAt: bigint("refilled_at", { mode: "number" }).notNull(),
    segment: integer("segment").notNull(),
    /** clock:full-bank-push-notification. */
    fullAt: bigint("full_at", { mode: "number" }),
    fullNotifiedAt: bigint("full_notified_at", { mode: "number" }),
    /** account:person-kept-with-character: the person built at the door; null for a life made without one. */
    person: jsonb("person").$type<KeptPerson>(),
  },
  (table) => [
    index("characters_account_idx").on(table.account),
    index("characters_full_idx").on(table.fullAt).where(sql`${table.fullNotifiedAt} is null`),
  ],
);

/** server:save-is-list-of-segments: a segment begins after version `from_v`. */
export const segments = pgTable(
  "segments",
  {
    character: text("character")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    segment: integer("segment").notNull(),
    fromV: integer("from_v").notNull(),
    content: text("content").notNull(),
    overlay: text("overlay"),
    start: jsonb("start").$type<SegmentStart>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.character, table.segment] })],
);

/** server:snapshots-bound-replay: the full state at version `v` of one segment, never rewritten. */
export const snapshots = pgTable(
  "snapshots",
  {
    character: text("character")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    segment: integer("segment").notNull(),
    v: integer("v").notNull(),
    content: text("content").notNull(),
    overlay: text("overlay"),
    state: jsonb("state").$type<State>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.character, table.segment, table.v] })],
);

/**
 * server:log-rows-hash-state: one row per accepted command, never rewritten. A plain table
 * keyed on (character, v), not split by month, since a partitioned table must
 * carry the month in its primary key.
 */
export const commandLog = pgTable(
  "command_log",
  {
    character: text("character")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    v: integer("v").notNull(),
    tick: integer("tick").notNull(),
    sender: text("sender").$type<Sender>().notNull(),
    command: jsonb("command").$type<Command>().notNull(),
    hash: text("hash").notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
  },
  // analytics:session-split-by-command-gaps: online now, every five minutes, and the nightly counts read the log by its time.
  (table) => [primaryKey({ columns: [table.character, table.v] }), index("command_log_at_idx").on(table.at)],
);

/** pair:one-record-per-two: one row per pair; `key` is the two ids sorted, `a` the lower. */
export const pairs = pgTable(
  "pairs",
  {
    key: text("key").primaryKey(),
    a: text("a").notNull(),
    b: text("b").notNull(),
    v: integer("v").notNull(),
    record: jsonb("record").$type<PairRecord>().notNull(),
  },
  (table) => [index("pairs_a_idx").on(table.a), index("pairs_b_idx").on(table.b)],
);
