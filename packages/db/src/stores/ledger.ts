import type { ByReason, DayRow, LedgerStore } from "@japacity/store";
import { eq, sql } from "drizzle-orm";

import type { Handle } from "../handle";
import { ledgerDays, ledgerMarks } from "../schema";

type Side = "created" | "destroyed";

function rowsOf(day: number, side: Side, amounts: ByReason): (typeof ledgerDays.$inferInsert)[] {
  const rows: (typeof ledgerDays.$inferInsert)[] = [];
  for (const [reason, byCurrency] of Object.entries(amounts)) {
    for (const [currency, amount] of Object.entries(byCurrency ?? {})) {
      if (amount !== undefined) rows.push({ day, side, reason, currency, amount });
    }
  }
  return rows;
}

/** R-SERVER-011: marks by character, and day totals one row per side, reason and currency. */
export function pgLedgerStore(handle: Handle): LedgerStore {
  return {
    mark: (character) =>
      handle.read(async (db) => {
        const [row] = await db.select().from(ledgerMarks).where(eq(ledgerMarks.character, character));
        return row === undefined ? null : { character: row.character, day: row.day, totals: row.totals };
      }),

    setMark: (character, totals, day) =>
      handle.read(async (db) => {
        await db.insert(ledgerMarks).values({ character, day, totals }).onConflictDoUpdate({ target: ledgerMarks.character, set: { day, totals } });
      }),

    addDay: (day, created, destroyed) =>
      handle.read(async (db) => {
        const rows = [...rowsOf(day, "created", created), ...rowsOf(day, "destroyed", destroyed)];
        if (rows.length === 0) return;
        await db
          .insert(ledgerDays)
          .values(rows)
          .onConflictDoUpdate({
            target: [ledgerDays.day, ledgerDays.side, ledgerDays.reason, ledgerDays.currency],
            set: { amount: sql`${ledgerDays.amount} + excluded.amount` },
          });
      }),

    day: (day) =>
      handle.read(async (db) => {
        const found = await db.select().from(ledgerDays).where(eq(ledgerDays.day, day));
        const row: DayRow = { day, created: {}, destroyed: {} };
        for (const each of found) {
          const sideOf: Record<string, Partial<Record<string, number>>> = row[each.side];
          (sideOf[each.reason] ??= {})[each.currency] = each.amount;
        }
        return row;
      }),

    dropMark: (character) =>
      handle.read(async (db) => {
        await db.delete(ledgerMarks).where(eq(ledgerMarks.character, character));
      }),
  };
}
