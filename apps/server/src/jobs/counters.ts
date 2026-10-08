// R-ANALYTICS-008, R-ANALYTICS-011: the nightly job at 00:00 UTC, for the day
// that has just ended. It reads the command log and adds the day's game
// counters once: a second run for the same day adds nothing.
import type { DayLog } from "@japacity/store";

import { dayStart, utcDay } from "../admin/day";
import { dayName } from "../analytics/day";
import type { ActiveLife } from "../analytics/nightly";
import { nightlyTotals } from "../analytics/nightly";
import { replayLife } from "../analytics/replay";
import type { ServerDeps } from "../deps";

/** The cron in `wrangler.jsonc` that runs this job. */
export const COUNTERS_CRON = "0 0 * * *";

export interface CountersDay {
  day: string;
  /** False when the day had been counted already. */
  added: boolean;
  /** The characters the job could not replay, and why. */
  skipped: { character: string; why: string }[];
}

/** Counts one UTC day. */
export async function countDay(deps: ServerDeps, log: DayLog, day: number): Promise<CountersDay> {
  const start = dayStart(day);
  const end = dayStart(day + 1);
  const [characters, created] = await Promise.all([log.active(start, end), log.created(start, end)]);
  const active: ActiveLife[] = [];
  const skipped: CountersDay["skipped"] = [];
  for (const character of characters) {
    const life = await replayLife(deps, character);
    if (!life.ok) {
      skipped.push({ character, why: life.detail });
      continue;
    }
    active.push({ character, life: life.value, account: await deps.stores.account.get(life.value.account) });
  }
  const totals = nightlyTotals({ day, active, created });
  const added = await deps.stores.counters.addOnce(`nightly:${dayName(day)}`, totals);
  return { day: dayName(day), added, skipped };
}

export function countersJob(deps: ServerDeps, log: DayLog): Promise<CountersDay> {
  return countDay(deps, log, utcDay(deps.now()) - 1);
}
