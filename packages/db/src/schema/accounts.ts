// R-ACCOUNT-012, R-ACCOUNT-015, R-ACCOUNT-017, R-ACCOUNT-018, R-ACCOUNT-020: the
// game's own account row beside the auth library's tables, and deletions.
import { sql } from "drizzle-orm";
import { bigint, boolean, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  country: text("country").notNull(),
  agePassed: boolean("age_passed").notNull(),
  ageAt: bigint("age_at", { mode: "number" }).notNull(),
  ageMethod: text("age_method").$type<"declared" | "verified">().notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  character: text("character"),
});

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
    uniqueIndex("deletions_pending_idx").on(table.account).where(sql`${table.completedAt} is null`),
    index("deletions_hash_idx").on(table.accountHash),
    index("deletions_due_idx").on(table.dueAt),
  ],
);
