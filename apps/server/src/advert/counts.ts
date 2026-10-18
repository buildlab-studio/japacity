// R-ADVERT-020 to 022: impressions and taps reach the advert store only as
// daily totals per slot, campaign and region. They arrive among the interface
// counters (analytics.md R-ANALYTICS-002), keyed by slot, and are given to the
// campaign the slot showed in that region that hour. No account reaches the
// store; one account's share of a day is capped before the rows get here.
import type { Id } from "@japacity/sim";
import { time } from "@japacity/sim";
import type { AdvertCount, AdvertStore } from "@japacity/store";

import { sha256Hex } from "../auth/hooks";
import type { ServerConfig } from "../config";
import type { AdvertsDeps } from "./serve";
import { servedAt } from "./serve";

/** The interface counters an advert sends, each keyed by the slot's id. */
export const ADVERT_COUNTERS = { impression: "advert/impression", tap: "advert/tap" } as const;

export interface CounterRow {
  name: string;
  key: string;
  count: number;
}

/** Adds the advert rows of one batch and returns how many it used; any other row is left to the analytics counters. */
export async function addAdvertCounters(deps: AdvertsDeps, region: string, at: number, rows: CounterRow[]): Promise<number> {
  const ours = rows.filter((row) => (row.name === ADVERT_COUNTERS.impression || row.name === ADVERT_COUNTERS.tap) && Number.isSafeInteger(row.count) && row.count > 0);
  if (ours.length === 0) return 0;
  const served = await servedAt(deps, region, at);
  const day = time.utcDay(at);
  const counts: AdvertCount[] = [];
  for (const row of ours) {
    const slot = row.key as Id<"advert">;
    const showing = served.slots[slot];
    if (showing === undefined) continue;
    const impression = row.name === ADVERT_COUNTERS.impression;
    counts.push({ day, slot, campaign: showing.campaign, region, impressions: impression ? row.count : 0, taps: impression ? 0 : row.count });
  }
  await deps.stores.adverts.addCounts(counts);
  return counts.length;
}

/**
 * What each account has had counted today, by a hash of the account and the
 * day, the slot and the counter. Kept in the isolate's memory, as the batch
 * limit of R-ANALYTICS-004 is, so like the rate limits it holds per isolate
 * and not exactly (R-SERVER-028).
 */
const countedToday = new WeakMap<AdvertStore, { day: number; used: Map<string, number> }>();

/**
 * R-ADVERT-020: an account adds at most `advert.countsPerAccountDay` impressions
 * and taps to one slot in a UTC day. The rows past it are dropped here; the
 * batch is still accepted. Other rows pass untouched.
 */
export async function withinAccountDay(deps: Pick<AdvertsDeps, "stores"> & { config: Pick<ServerConfig, "advert"> }, account: string, at: number, rows: CounterRow[]): Promise<CounterRow[]> {
  const day = time.utcDay(at);
  let held = countedToday.get(deps.stores.adverts);
  if (held?.day !== day) {
    held = { day, used: new Map() };
    countedToday.set(deps.stores.adverts, held);
  }
  const sender = await sha256Hex(`advert:${String(day)}:${account}`);
  const { impressions, taps } = deps.config.advert.countsPerAccountDay;
  const kept: CounterRow[] = [];
  for (const row of rows) {
    const cap = row.name === ADVERT_COUNTERS.impression ? impressions : row.name === ADVERT_COUNTERS.tap ? taps : null;
    if (cap === null || !Number.isSafeInteger(row.count) || row.count <= 0) {
      kept.push(row);
      continue;
    }
    const key = `${sender}|${row.key}|${row.name}`;
    const used = held.used.get(key) ?? 0;
    const count = Math.min(row.count, cap - used);
    if (count <= 0) continue;
    held.used.set(key, used + count);
    kept.push({ ...row, count });
  }
  return kept;
}
