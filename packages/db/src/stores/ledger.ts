import type { ByReason, DayRow, LedgerRows, LedgerStore } from "@japacity/store";
import { eq, sql } from "drizzle-orm";

import type { Handle } from "../handle";
import { oneConnection } from "../handle";
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

/** The ledger's reads and writes through one handle: the store's own, or a transaction's. */
function ledgerRows(handle: Handle): LedgerRows {
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

/**
 * R-SERVER-011: marks by character, and day totals one row per side, reason and currency. A transaction's work
 * is handed the rows on the transaction's own client, with a lock of their own (R-SERVER-002, decision 0006):
 * the handle's lock is held for the whole transaction and is never taken again inside it.
 */
export function pgLedgerStore(handle: Handle): LedgerStore {
  return {
    ...ledgerRows(handle),
    transaction: (work) => handle.transaction((tx) => work(ledgerRows(oneConnection(tx)))),
  };
}
