// account:age-screen-refuses-minors, account:one-character-per-account, account:deleted-data-removed-within-month, account:deletion-keeps-anonymous-totals, account:only-needed-data-kept: the
// game's own account row beside the auth library's tables, deletions, and the
// devices that take the bank-full notice (clock:full-bank-push-notification).
import { sql } from "drizzle-orm";
import { bigint, boolean, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    country: text("country").notNull(),
    agePassed: boolean("age_passed").notNull(),
    ageAt: bigint("age_at", { mode: "number" }).notNull(),
    ageMethod: text("age_method").$type<"declared" | "verified">().notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    character: text("character"),
    /** clock:full-bank-push-notification. */
    notifyBankFull: boolean("notify_bank_full").notNull().default(false),
    /** analytics:player-can-stop-usage-counts. */
    sendUsageCounts: boolean("send_usage_counts").notNull().default(true),
    /** account:guest-and-secured-states. A row given no state is secured: only the guest start makes a guest. */
    state: text("state").$type<"guest" | "secured">().notNull().default("secured"),
    /** account:username-and-unconfirmed-email. A row given no username gets a generated one. */
    username: text("username")
      .notNull()
      .default(sql`('player_' || substr(md5(random()::text), 1, 12))`),
    usernameChangedAt: bigint("username_changed_at", { mode: "number" }),
    /** account:idle-guests-cleaned-by-hand. */
    lastPlayedAt: bigint("last_played_at", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    // account:username-and-unconfirmed-email: unique whatever the capitals.
    uniqueIndex("accounts_username_idx").on(sql`lower(${table.username})`),
    index("accounts_idle_guests_idx").on(table.lastPlayedAt).where(sql`${table.state} = 'guest'`),
  ],
);

/** clock:full-bank-push-notification, account:only-needed-data-kept: one row per device that agreed, kept only while the account's setting is on. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    endpoint: text("endpoint").primaryKey(),
    account: text("account").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
  },
  (table) => [index("push_subscriptions_account_idx").on(table.account)],
);

/** `n` keeps the order requests came in; one pending request per account. */
export const deletions = pgTable(
  "deletions",
  {
    n: bigint("n", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    account: text("account"),
    accountHash: text("account_hash").notNull(),
    requestedAt: bigint("requested_at", { mode: "number" }).notNull(),
    dueAt: bigint("due_at", { mode: "number" }).notNull(),
    completedAt: bigint("completed_at", { mode: "number" }),
  },
  (table) => [
    uniqueIndex("deletions_pending_idx")
      .on(table.account)
      .where(sql`${table.completedAt} is null`),
    index("deletions_hash_idx").on(table.accountHash),
    index("deletions_due_idx").on(table.dueAt),
  ],
);
