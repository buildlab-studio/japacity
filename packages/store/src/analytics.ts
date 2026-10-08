// The analytics store (docs/rules/analytics.md): totals by day, region, name
// and key, and nothing else. A row never names an account, a session or a
// character (R-ANALYTICS-005, R-ANALYTICS-007).
import type { AccountRow } from "./types";

/** R-ANALYTICS-005: one stored total. `day` is the UTC date as `YYYY-MM-DD`; `region` the account's country code. */
export interface CounterTotal {
  day: string;
  region: string;
  name: string;
  key: string;
  count: number;
}

/** R-ANALYTICS-005: only totals. Each method adds to or reads them; nothing removes one. */
export interface CounterStore {
  /** Adds each row's count to the stored total for its day, region, name and key. */
  add: (rows: readonly CounterTotal[]) => Promise<void>;
  /**
   * R-ANALYTICS-008: adds the rows once for the named run, such as the nightly
   * job for one day. True when added; false, adding nothing, when the run had already added.
   */
  addOnce: (run: string, rows: readonly CounterTotal[]) => Promise<boolean>;
  /** The totals of every day from `from` to `to`, both included, ordered by day, region, name and key. */
  days: (from: string, to: string) => Promise<CounterTotal[]>;
}

/**
 * R-ANALYTICS-008: what the nightly job needs from the game's own tables,
 * read only. The characters and accounts it names are read through the
 * player and account stores.
 */
export interface DayLog {
  /** The characters with at least one log row whose `at` falls in [start, end), in id order. */
  active: (start: number, end: number) => Promise<string[]>;
  /** The accounts created in [start, end), in id order. */
  created: (start: number, end: number) => Promise<AccountRow[]>;
}
