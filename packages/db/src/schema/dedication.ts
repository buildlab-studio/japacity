// server.md R-SERVER-045, account.md R-ACCOUNT-033, moderation.md R-MODERATION-021: one dedication light per account,
// gone with the account. `id` is opaque and never the account's id; `approved_at` stays null until an admin approves
// the name, and a light lit again clears it.
import { sql } from "drizzle-orm";
import { bigint, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";

export const dedicationLights = pgTable(
  "dedication_lights",
  {
    accountId: text("account_id")
      .primaryKey()
      .references(() => accounts.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    name: text("name").notNull(),
    fromYear: integer("from_year"),
    toYear: integer("to_year"),
    litAt: bigint("lit_at", { mode: "number" }).notNull(),
    approvedAt: bigint("approved_at", { mode: "number" }),
    approvedBy: text("approved_by"),
  },
  (table) => [
    uniqueIndex("dedication_lights_id_idx").on(table.id),
    // The page's read: the approved first, newest lit first.
    index("dedication_lights_shared_idx").on(sql`(${table.approvedAt} is not null) desc`, table.litAt.desc()),
    // The admin's list: those awaiting a look, oldest first.
    index("dedication_lights_pending_idx").on(table.litAt).where(sql`${table.approvedAt} is null`),
  ],
);
