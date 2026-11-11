// The figures the sections make from the dashboard's daily rows and counters (admin:period-is-today-7-or-30,
// admin:titles-and-values): a series a day, a period's sum against the previous period's, and a counter's sum over the
// window. A sum leaves hidden days out and says so, so a hidden count is never guessed.
import type { Dashboard, DailyRow, Shown, ShownTotal, Stats, StatsPeriod } from "@japacity/api";

import type { Period } from "./admin.ui";

export type DailyField = "players" | "newPlayers" | "turnsEnded";

const WEEK = 7;

const number = (count: Shown): number | null => (typeof count === "number" ? count : null);

/** One value a day, oldest first; null where the server hid the count. */
export function dailySeries(rows: readonly DailyRow[], field: DailyField): (number | null)[] {
  return rows.map((row) => number(row[field]));
}

function sum(values: readonly (number | null)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (value === null) return null;
    total += value;
  }
  return total;
}

/** admin:period-is-today-7-or-30: the period's figure and the previous period's from the daily rows, each null where a day is hidden or the rows do not reach. */
export function periodChange(rows: readonly DailyRow[], field: DailyField, period: Period): { now: number | null; before: number | null } {
  const values = dailySeries(rows, field);
  const last = values.length - 1;
  if (period === "today") return { now: values[last] ?? null, before: values[last - 1] ?? null };
  if (period === "last7") {
    const now = values.slice(last - WEEK, last);
    const before = values.slice(last - 2 * WEEK, last - WEEK);
    return { now: now.length === WEEK ? sum(now) : null, before: before.length === WEEK ? sum(before) : null };
  }
  return { now: null, before: null };
}

export function periodOf(stats: Stats, period: Period): StatsPeriod {
  return period === "today" ? stats.today : period === "last7" ? stats.last7 : stats.last30;
}

export interface CounterSum {
  /** The shown counts added up. */
  total: number;
  /** True when a hidden count was left out. */
  partial: boolean;
  /** True when no row matched at all. */
  empty: boolean;
}

/** A counter's shown totals over the window, by the keys `test` admits. */
export function counterSum(counters: readonly ShownTotal[], name: string, test: (key: string) => boolean = () => true): CounterSum {
  let total = 0;
  let partial = false;
  let empty = true;
  for (const row of counters) {
    if (row.name !== name || !test(row.key)) continue;
    empty = false;
    const count = number(row.count);
    if (count === null) partial = true;
    else total += count;
  }
  return { total, partial, empty };
}

/** A counter's sums by key over the window, largest first. */
export function counterByKey(counters: readonly ShownTotal[], name: string, keyOf: (key: string) => string | null = (key) => key): { key: string; sum: CounterSum }[] {
  const keys = new Set<string>();
  for (const row of counters) {
    if (row.name !== name) continue;
    const key = keyOf(row.key);
    if (key !== null) keys.add(key);
  }
  return [...keys].map((key) => ({ key, sum: counterSum(counters, name, (raw) => keyOf(raw) === key) })).sort((one, two) => two.sum.total - one.sum.total);
}

/** The latest day's count of a counter by key: for a counter that is a snapshot each night, not a flow. */
export function latestByKey(counters: readonly ShownTotal[], name: string): { day: string; byKey: Map<string, Shown> } | null {
  const rows = counters.filter((row) => row.name === name);
  if (rows.length === 0) return null;
  const day = rows.map((row) => row.day).sort().at(-1) ?? "";
  const byKey = new Map<string, Shown>();
  for (const row of rows) {
    if (row.day !== day) continue;
    const held = byKey.get(row.key);
    const count = number(row.count);
    if (held === undefined) byKey.set(row.key, row.count);
    else if (typeof held === "number" && count !== null) byKey.set(row.key, held + count);
  }
  return { day, byKey };
}

/** The dashboard's window as the three labels of a chart: the first day, the middle one, the last. */
export function windowLabels(dashboard: Dashboard, label: (day: string) => string): [string, string, string] {
  const days = dashboard.daily.map((row) => row.day);
  const first = days[0] ?? dashboard.from;
  const middle = days[Math.floor(days.length / 2)] ?? first;
  const last = days.at(-1) ?? dashboard.day;
  return [label(first), label(middle), label(last)];
}
