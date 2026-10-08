// R-SERVER-030, R-SERVER-031: the switch row, one row only (`id` is always 1),
// and the log of every change to it, append-only, `n` rising. The board
// switches (city.md R-CITY-039) keep the switch names as their keys.
import type { SettingChange } from "@japacity/store";
import { sql } from "drizzle-orm";
import { bigint, boolean, check, integer, jsonb, pgTable, smallint, text } from "drizzle-orm/pg-core";

export const switches = pgTable(
  "switches",
  {
    id: smallint("id").primaryKey().default(1),
    signups: boolean("signups").notNull().default(true),
    lottery: boolean("lottery").notNull().default(true),
    adverts: boolean("adverts").notNull().default(true),
    partnerPlay: boolean("partner_play").notNull().default(true),
    "boards.this-week.everyone": boolean("boards_this_week_everyone").notNull().default(true),
    "boards.this-week.friends": boolean("boards_this_week_friends").notNull().default(true),
    "boards.all-time.everyone": boolean("boards_all_time_everyone").notNull().default(true),
    "boards.all-time.friends": boolean("boards_all_time_friends").notNull().default(true),
    "boards.joined-week": boolean("boards_joined_week").notNull().default(false),
    placeTargets: jsonb("place_targets").$type<Record<string, number>>().notNull().default({}),
    computerAfterMonths: integer("computer_after_months"),
    topUpTickets: integer("top_up_tickets"),
  },
  (table) => [check("switches_one_row", sql`${table.id} = 1`)],
);

export const switchLog = pgTable("switch_log", {
  n: bigint("n", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  at: bigint("at", { mode: "number" }).notNull(),
  admin: text("admin").notNull(),
  reason: text("reason").notNull(),
  change: jsonb("change").$type<SettingChange>().notNull(),
});
