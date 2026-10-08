import type { CounterStore, CounterTotal } from "@japacity/store";
import { and, asc, gte, lte, sql } from "drizzle-orm";

import type { Handle, Queries } from "../handle";
import { counterRuns, counterTotals } from "../schema";

/** Rows with the same day, region, name and key folded into one, since one upsert may not touch a row twice. */
function folded(rows: readonly CounterTotal[]): CounterTotal[] {
  const byKey = new Map<string, CounterTotal>();
  for (const row of rows) {
    const key = JSON.stringify([row.day, row.region, row.name, row.key]);
    const held = byKey.get(key);
    byKey.set(key, { day: row.day, region: row.region, name: row.name, key: row.key, count: (held?.count ?? 0) + row.count });
  }
  return [...byKey.values()];
}

async function addTo(db: Queries, rows: readonly CounterTotal[]): Promise<void> {
  const values = folded(rows);
  if (values.length === 0) return;
  await db
    .insert(counterTotals)
    .values(values)
    .onConflictDoUpdate({
      target: [counterTotals.day, counterTotals.region, counterTotals.name, counterTotals.key],
      set: { count: sql`${counterTotals.count} + excluded.count` },
    });
}

/** R-ANALYTICS-005, R-ANALYTICS-008: totals in the analytics schema, and the runs that added them. */
export function pgCounterStore(handle: Handle): CounterStore {
  return {
    add: (rows) => handle.transaction((tx) => addTo(tx, rows)),

    addOnce: (run, rows) =>
      handle.transaction(async (tx) => {
        const [made] = await tx.insert(counterRuns).values({ run }).onConflictDoNothing().returning();
        if (made === undefined) return false;
        await addTo(tx, rows);
        return true;
      }),

    days: (from, to) =>
      handle.read(async (db) => {
        // Ordered by code unit, as the memory store orders.
        const found = await db
          .select()
          .from(counterTotals)
          .where(and(gte(counterTotals.day, from), lte(counterTotals.day, to)))
          .orderBy(
            asc(sql`${counterTotals.day} collate "C"`),
            asc(sql`${counterTotals.region} collate "C"`),
            asc(sql`${counterTotals.name} collate "C"`),
            asc(sql`${counterTotals.key} collate "C"`),
          );
        return found.map((row) => ({ day: row.day, region: row.region, name: row.name, key: row.key, count: row.count }));
      }),
  };
}
