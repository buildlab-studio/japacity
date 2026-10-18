import type { CounterStore, CounterTotal } from "../analytics";
import { copy } from "./copy.memory";

const keyOf = (row: CounterTotal) => JSON.stringify([row.day, row.region, row.name, row.key]);

function order(left: CounterTotal, right: CounterTotal): number {
  for (const field of ["day", "region", "name", "key"] as const) {
    if (left[field] < right[field]) return -1;
    if (left[field] > right[field]) return 1;
  }
  return 0;
}

/** analytics:rows-stored-as-day-totals: totals by day, region, name and key. */
export function memoryCounterStore(): CounterStore {
  const totals = new Map<string, CounterTotal>();
  const runs = new Set<string>();

  function add(rows: readonly CounterTotal[]): void {
    for (const row of rows) {
      const key = keyOf(row);
      const held = totals.get(key);
      totals.set(key, { day: row.day, region: row.region, name: row.name, key: row.key, count: (held?.count ?? 0) + row.count });
    }
  }

  return {
    add: (rows) => {
      add(rows);
      return Promise.resolve();
    },
    addOnce: (run, rows) => {
      if (runs.has(run)) return Promise.resolve(false);
      runs.add(run);
      add(rows);
      return Promise.resolve(true);
    },
    days: (from, to) => Promise.resolve(copy([...totals.values()].filter((row) => row.day >= from && row.day <= to).sort(order))),
  };
}
