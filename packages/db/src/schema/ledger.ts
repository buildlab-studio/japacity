// R-SERVER-011: each character's wallet totals at its last mark, and the money
// made and destroyed on each UTC day, one row per side, reason and currency so
// that concurrent additions are a single upsert each.
import type { WalletSlice } from "@japacity/sim";
import { bigint, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const ledgerMarks = pgTable("ledger_marks", {
  character: text("character").primaryKey(),
  day: integer("day").notNull(),
  totals: jsonb("totals").$type<WalletSlice["totals"]>().notNull(),
});

export const ledgerDays = pgTable(
  "ledger_days",
  {
    day: integer("day").notNull(),
    side: text("side").$type<"created" | "destroyed">().notNull(),
    reason: text("reason").notNull(),
    currency: text("currency").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.side, table.reason, table.currency] })],
);
