import type { DayLog, NumbersLog, RegionCount } from "@japacity/store";
import { and, eq, gte, lt, sql } from "drizzle-orm";

import type { Handle } from "../handle";
import { accounts, characters, commandLog } from "../schema";
import { toAccount } from "./account";

/**
 * analytics:store-holds-nothing-personal: a region is the finest place kept; an account with no
 * country, or gone, counts under the unknown one (`XX`, as the server names it).
 * Written as a literal so the grouping is the same expression as the column.
 */
const regionOf = sql<string>`coalesce(nullif(${accounts.country}, ''), 'XX')`;

/** Ordered by region, so a reply never depends on the database's own order. */
const byRegion = (rows: readonly RegionCount[]) => [...rows].sort((left, right) => byCodeUnit(left.region, right.region));

const byCodeUnit = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

/** analytics:nightly-game-counters: the day's characters and new accounts, read from the game's tables by an ordinary query; analytics:admin-stats-for-admins-only and analytics:session-split-by-command-gaps: the counts by region. */
export function pgDayLog(handle: Handle): DayLog & NumbersLog {
  return {
    active: (start, end) =>
      handle.read(async (db) => {
        const found = await db
          .selectDistinct({ character: commandLog.character })
          .from(commandLog)
          .where(and(gte(commandLog.at, start), lt(commandLog.at, end)));
        return found.map((row) => row.character).sort(byCodeUnit);
      }),

    created: (start, end) =>
      handle.read(async (db) => {
        const found = await db
          .select()
          .from(accounts)
          .where(and(gte(accounts.createdAt, start), lt(accounts.createdAt, end)));
        return found
          .map(toAccount)
          .sort((left, right) => byCodeUnit(left.id, right.id));
      }),

    // analytics:session-split-by-command-gaps: one query over the log by its time, joined to the account for its region only.
    players: (start, end) =>
      handle.read(async (db) => {
        const found = await db
          .select({ region: regionOf, count: sql<number>`count(distinct ${characters.account})::int` })
          .from(commandLog)
          .innerJoin(characters, eq(characters.id, commandLog.character))
          .leftJoin(accounts, eq(accounts.id, characters.account))
          .where(and(gte(commandLog.at, start), lt(commandLog.at, end), eq(commandLog.sender, "player")))
          .groupBy(regionOf);
        return byRegion(found.map((row) => ({ region: row.region, count: Number(row.count) })));
      }),

    accounts: (end) =>
      handle.read(async (db) => {
        const found = await db
          .select({ region: regionOf, count: sql<number>`count(*)::int` })
          .from(accounts)
          .where(lt(accounts.createdAt, end))
          .groupBy(regionOf);
        return byRegion(found.map((row) => ({ region: row.region, count: Number(row.count) })));
      }),
  };
}
