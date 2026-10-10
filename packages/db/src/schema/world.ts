// R-CLOCK-010, R-LOTTERY-005 to 008, R-LOTTERY-015: the world's stored ticks and
// the lottery's draws. Neither a tick nor a ticket is ever rewritten.
import type { LotteryOdds, LotteryResult, World } from "@japacity/sim";
import type { DirectorBookRow } from "@japacity/store";
import { bigint, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

/** R-CLOCK-010, R-CLOCK-013: the first row for a tick is kept. */
export const worldTicks = pgTable("world_ticks", {
  tick: integer("tick").primaryKey(),
  world: jsonb("world").$type<World>().notNull(),
  book: jsonb("book").$type<DirectorBookRow>().notNull(),
  content: text("content").notNull(),
  hash: text("hash").notNull(),
});

/** R-LOTTERY-007, R-LOTTERY-012, R-LOTTERY-021: the commitments, odds and jackpot fixed when a draw opens; `closed_at`, the list and `result` are set once each. */
export const draws = pgTable("draws", {
  draw: integer("draw").primaryKey(),
  secret: text("secret").notNull(),
  fingerprint: text("fingerprint").notNull(),
  beaconRound: bigint("beacon_round", { mode: "number" }).notNull(),
  odds: jsonb("odds").$type<LotteryOdds>().notNull(),
  jackpot: bigint("jackpot", { mode: "number" }).notNull(),
  closedAt: bigint("closed_at", { mode: "number" }),
  list: jsonb("list").$type<string[]>(),
  listHash: text("list_hash"),
  result: jsonb("result").$type<LotteryResult>(),
});

/** R-LOTTERY-005: tickets numbered from 0 under the draw's row lock. */
export const drawTickets = pgTable(
  "draw_tickets",
  {
    draw: integer("draw")
      .notNull()
      .references(() => draws.draw),
    n: integer("n").notNull(),
    character: text("character").notNull(),
  },
  (table) => [primaryKey({ columns: [table.draw, table.n] })],
);
