// moderation.md contract: the admin log (insert only), the banned identities,
// the appeals, the feedback and its send counts. `n` keeps the order rows came in.
import type { AdminAction, LogParams } from "@japacity/store";
import { bigint, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";

export const moderationLog = pgTable(
  "moderation_log",
  {
    n: bigint("n", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    id: text("id").notNull(),
    admin: text("admin").notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    item: text("item").notNull(),
    action: text("action").$type<AdminAction>().notNull(),
    params: jsonb("params").$type<LogParams>().notNull(),
    reason: text("reason").notNull(),
    note: text("note"),
  },
  (table) => [uniqueIndex("moderation_log_id_idx").on(table.id), index("moderation_log_item_idx").on(table.item)],
);

export const bannedIdentities = pgTable("banned_identities", {
  hash: text("hash").primaryKey(),
  at: bigint("at", { mode: "number" }).notNull(),
});

export const appeals = pgTable(
  "appeals",
  {
    n: bigint("n", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    id: text("id").notNull(),
    account: text("account").notNull(),
    entry: text("entry").notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    status: text("status").$type<"open" | "decided">().notNull(),
    outcome: text("outcome").$type<"upheld" | "overturned">(),
    decidedBy: text("decided_by"),
    decidedAt: bigint("decided_at", { mode: "number" }),
  },
  (table) => [uniqueIndex("appeals_id_idx").on(table.id), uniqueIndex("appeals_entry_idx").on(table.entry), index("appeals_account_idx").on(table.account)],
);

export const feedback = pgTable(
  "feedback",
  {
    n: bigint("n", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    id: text("id").notNull(),
    text: text("text").notNull(),
    build: text("build").notNull(),
    screen: text("screen").notNull(),
    mode: text("mode").$type<"low" | "high">().notNull(),
    day: text("day").notNull(),
    region: text("region").notNull(),
  },
  (table) => [uniqueIndex("feedback_id_idx").on(table.id), index("feedback_day_idx").on(table.day)],
);

/** moderation:feedback-box-in-settings: how many a sender has sent on a day, kept apart from the rows. */
export const feedbackSends = pgTable(
  "feedback_sends",
  {
    sender: text("sender").notNull(),
    day: text("day").notNull(),
    count: integer("count").notNull(),
  },
  (table) => [primaryKey({ columns: [table.sender, table.day] }), index("feedback_sends_day_idx").on(table.day)],
);
