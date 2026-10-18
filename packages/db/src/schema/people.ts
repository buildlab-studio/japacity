// pair:invite-card-contents, pair:invite-link-single-use, pair:invite-rewards-never-cash, pair:preset-phrases-only, pair:conversation-phrases-stored, pair:block-ends-every-bond, pair:report-holds-conversation; moderation.md
// moderation:block-refuses-both-ways, moderation:block-ends-pair-records, moderation:report-from-every-surface, moderation:report-carries-subject-and-reason, moderation:spoken-phrases-not-stored, moderation:report-offers-block, moderation:reporter-told-outcome-only, moderation:reports-hold-cited-records and moderation:open-report-pauses-conversation: invite links and their rewards, the stored
// phrases, and blocks, reports and holds. Ids are ordered in JavaScript by
// UTF-16 code unit where order matters, never by a collation.
import type { InviteMilestone, ReportCite, ReportReason, ReportRow } from "@japacity/store";
import { bigint, boolean, index, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

/** pair:invite-link-single-use: one row per link; `pair` and `by` are set once it is used. */
export const invites = pgTable(
  "invites",
  {
    code: text("code").primaryKey(),
    from: text("from_character").notNull(),
    account: text("account").notNull(),
    slot: text("slot").notNull(),
    looking: text("looking").$type<"partner" | "sibling">().notNull(),
    fill: text("fill"),
    card: jsonb("card").$type<unknown>().notNull(),
    madeAt: bigint("made_at", { mode: "number" }).notNull(),
    expires: bigint("expires", { mode: "number" }).notNull(),
    used: boolean("used").notNull(),
    by: text("by_character"),
    pair: text("pair"),
    usedAt: bigint("used_at", { mode: "number" }),
    before: jsonb("before").$type<InviteMilestone[]>().notNull(),
  },
  (table) => [index("invites_from_idx").on(table.from), index("invites_by_idx").on(table.by), index("invites_pair_idx").on(table.pair)],
);

/** pair:invite-rewards-never-cash: once per inviter, friend and milestone; `n` keeps the order given. */
export const inviteRewards = pgTable(
  "invite_rewards",
  {
    n: bigint("n", { mode: "number" }).generatedAlwaysAsIdentity(),
    from: text("from_character").notNull(),
    friend: text("friend").notNull(),
    reached: text("reached").$type<InviteMilestone>().notNull(),
    frame: text("frame").notNull(),
    line: text("line").notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.from, table.friend, table.reached] }), index("invite_rewards_friend_idx").on(table.friend)],
);

/** pair:conversation-phrases-stored: one stored phrase; the conversation is the pair key. */
export const conversationRows = pgTable(
  "conversation_rows",
  {
    id: text("id").primaryKey(),
    conversation: text("conversation").notNull(),
    sender: text("sender").notNull(),
    phrase: text("phrase").notNull(),
    fill: text("fill"),
    sentAt: bigint("sent_at", { mode: "number" }).notNull(),
    readAt: bigint("read_at", { mode: "number" }),
  },
  (table) => [index("conversation_rows_conversation_idx").on(table.conversation, table.sentAt)],
);

/** moderation:block-refuses-both-ways: one account blocking another. */
export const blocks = pgTable(
  "blocks",
  {
    from: text("from_account").notNull(),
    to: text("to_account").notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.from, table.to] }), index("blocks_to_idx").on(table.to)],
);

/** pair:report-holds-conversation, moderation:report-carries-subject-and-reason, moderation:reporter-told-outcome-only. */
export const reports = pgTable(
  "reports",
  {
    id: text("id").primaryKey(),
    reporter: text("reporter").notNull(),
    subject: jsonb("subject").$type<ReportRow["subject"]>().notNull(),
    reason: text("reason").$type<ReportReason>().notNull(),
    cites: jsonb("cites").$type<ReportCite>().notNull(),
    pair: text("pair"),
    unverified: boolean("unverified").notNull(),
    at: bigint("at", { mode: "number" }).notNull(),
    status: text("status").$type<ReportRow["status"]>().notNull(),
    outcome: text("outcome").$type<"acted" | "no-action">(),
    decidedAt: bigint("decided_at", { mode: "number" }),
  },
  (table) => [index("reports_reporter_idx").on(table.reporter, table.at), index("reports_pair_idx").on(table.pair), index("reports_status_idx").on(table.status, table.at)],
);

/** moderation:reports-hold-cited-records: what a report keeps unchanged. */
export const holds = pgTable("holds", {
  report: text("report")
    .primaryKey()
    .references(() => reports.id, { onDelete: "cascade" }),
  messages: jsonb("messages").$type<string[]>().notNull(),
  pair: text("pair"),
  until: bigint("until", { mode: "number" }).notNull(),
  lifted: boolean("lifted").notNull(),
});
