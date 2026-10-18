// R-ANALYTICS-008, R-ANALYTICS-011: the nightly job at 00:00 UTC, for the day
// that has just ended. It reads the command log and adds the day's game
// counters once: a second run for the same day adds nothing. R-ANALYTICS-013:
// with the counts by region it adds the numbers of numbers.ts too.
import { time } from "@japacity/sim";
import type { DayLog, NumbersLog, RegionCount } from "@japacity/store";

import type { ActiveLife } from "../analytics/nightly";
import { nightlyTotals } from "../analytics/nightly";
import { NO_REGION } from "../analytics/list";
import { numbersTotals } from "../analytics/numbers";
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

/** R-ANALYTICS-008: `players/weekly` and `players/monthly` reach back over this many days, the counted one included. */
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;

/** The reports open as the day ends, each by its reason and its reporter's region; no report or account goes further. */
async function openReports(deps: ServerDeps): Promise<{ reason: string; region: string }[]> {
  const open = await deps.stores.moderation.list("open");
  const found: { reason: string; region: string }[] = [];
  for (const report of open) {
    const reporter = await deps.stores.account.get(report.reporter);
    found.push({ reason: report.reason, region: reporter === null || reporter.country === "" ? NO_REGION : reporter.country });
  }
  return found;
}

/** Counts one UTC day; `numbers` reads the counts by region (R-ANALYTICS-013), and without it those counters are left out. */
export async function countDay(deps: ServerDeps, log: DayLog, day: number, numbers?: NumbersLog): Promise<CountersDay> {
  const start = time.dayStart(day);
  const end = time.dayStart(day + 1);
  const [characters, created] = await Promise.all([log.active(start, end), log.created(start, end)]);
  const none: RegionCount[] = [];
  const [weekly, monthly, accounts] =
    numbers === undefined ? [none, none, none] : await Promise.all([numbers.players(time.dayStart(day - WEEK_DAYS + 1), end), numbers.players(time.dayStart(day - MONTH_DAYS + 1), end), numbers.accounts(end)]);
  const active: ActiveLife[] = [];
  const skipped: CountersDay["skipped"] = [];
  for (const character of characters) {
    const life = await replayLife(deps, character, end);
    if (!life.ok) {
      skipped.push({ character, why: life.detail });
      continue;
    }
    active.push({ character, life: life.value, account: await deps.stores.account.get(life.value.account) });
  }
  const facts = { day, active, created };
  const totals = [...nightlyTotals(facts), ...numbersTotals({ ...facts, weekly, monthly, accounts, openReports: await openReports(deps) })];
  const added = await deps.stores.counters.addOnce(`nightly:${time.dayName(day)}`, totals);
  return { day: time.dayName(day), added, skipped };
}

export function countersJob(deps: ServerDeps, log: DayLog, numbers?: NumbersLog): Promise<CountersDay> {
  return countDay(deps, log, time.utcDay(deps.now()) - 1, numbers);
}
