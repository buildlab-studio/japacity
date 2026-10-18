// The analytics store (docs/rules/analytics.md): totals by day, region, name
// and key, and nothing else. A row never names an account, a session or a
// character (analytics:rows-stored-as-day-totals, analytics:store-holds-nothing-personal).
import type { AccountRow } from "./types";

/** analytics:rows-stored-as-day-totals: one stored total. `day` is the UTC date as `YYYY-MM-DD`; `region` the account's country code. */
export interface CounterTotal {
  day: string;
  region: string;
  name: string;
  key: string;
  count: number;
}

/** analytics:rows-stored-as-day-totals: only totals. Each method adds to or reads them; nothing removes one. */
export interface CounterStore {
  /** Adds each row's count to the stored total for its day, region, name and key. */
  add: (rows: readonly CounterTotal[]) => Promise<void>;
  /**
   * analytics:nightly-game-counters: adds the rows once for the named run, such as the nightly
   * job for one day. True when added; false, adding nothing, when the run had already added.
   */
  addOnce: (run: string, rows: readonly CounterTotal[]) => Promise<boolean>;
  /** The totals of every day from `from` to `to`, both included, ordered by day, region, name and key. */
  days: (from: string, to: string) => Promise<CounterTotal[]>;
}

/**
 * analytics:nightly-game-counters: what the nightly job needs from the game's own tables,
 * read only. The characters and accounts it names are read through the
 * player and account stores.
 */
export interface DayLog {
  /** The characters with at least one log row whose `at` falls in [start, end), in id order. */
  active: (start: number, end: number) => Promise<string[]>;
  /** The accounts created in [start, end), in id order. */
  created: (start: number, end: number) => Promise<AccountRow[]>;
}

/** analytics:nightly-game-counters, analytics:session-split-by-command-gaps: a number of accounts in one region. `region` is the account's country, `XX` when it has none or is gone. */
export interface RegionCount {
  region: string;
  count: number;
}

/**
 * analytics:nightly-game-counters, analytics:admin-stats-for-admins-only, analytics:session-split-by-command-gaps: counts the
 * nightly job and the admin's live figures read from the game's own tables,
 * read only. Each answers counts by region and never an account.
 */
export interface NumbersLog {
  /** The distinct accounts with at least one command their player sent whose `at` falls in [start, end), by region. */
  players: (start: number, end: number) => Promise<RegionCount[]>;
  /** The accounts created before `end`, by region. */
  accounts: (end: number) => Promise<RegionCount[]>;
}
