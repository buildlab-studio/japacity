// R-SERVER-011, R-SERVER-012: the daily job at 00:00 UTC, for the day that has
// just ended. It reports, raises what it finds, and takes no other action.
import type { DayLog } from "@japacity/store";

import { activeOn, forgetBefore } from "../ops/active";
import { raiseAlarms } from "../ops/alarm";
import { dayStart, utcDay } from "../ops/day";
import type { MoneyDay } from "../ops/money";
import { drawAlarms, moneyReport } from "../ops/money";
import type { ServerDeps } from "../deps";

/** The cron in `wrangler.jsonc` that runs this job. */
export const MONEY_CRON = "0 0 * * *";

/** `log` reads the day's characters from the command log; without it, the isolate's list from `markAfterCommit`. */
export async function moneyJob(deps: ServerDeps, log?: Pick<DayLog, "active">): Promise<MoneyDay> {
  const day = utcDay(deps.now()) - 1;
  const active = log === undefined ? activeOn(deps, day) : await log.active(dayStart(day), dayStart(day + 1));
  const report = await moneyReport(deps, day, active);
  const alarms = [...report.alarms, ...(await drawAlarms(deps, day))];
  await raiseAlarms(deps, alarms);
  forgetBefore(deps, day + 1);
  return { ...report, alarms };
}
