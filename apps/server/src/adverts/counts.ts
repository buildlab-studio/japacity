// R-ADVERT-020 to 022: impressions and taps reach the advert store only as
// daily totals per slot, campaign and region. They arrive among the interface
// counters (analytics.md R-ANALYTICS-002), keyed by slot, and are given to the
// campaign the slot showed in that region that hour. No account is passed in.
import type { Id } from "@japacity/sim";
import type { AdvertCount } from "@japacity/store";

import { utcDay } from "../admin/day";
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
  const day = utcDay(at);
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
