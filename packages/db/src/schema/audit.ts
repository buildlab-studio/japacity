// server:rollback-apply-one-account, server:newer-content-upgrades-state: rows taken out of play, append-only, `n` rising.
import type { AuditEntry, LogRow, SegmentRow, SnapshotRow } from "@japacity/store";
import { bigint, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const audit = pgTable(
  "audit",
  {
    n: bigint("n", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    character: text("character").notNull(),
    why: text("why").$type<AuditEntry["why"]>().notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    note: text("note").notNull(),
    segments: jsonb("segments").$type<SegmentRow[]>().notNull(),
    log: jsonb("log").$type<LogRow[]>().notNull(),
    snapshots: jsonb("snapshots").$type<SnapshotRow[]>().notNull(),
  },
  (table) => [index("audit_character_idx").on(table.character, table.n)],
);
