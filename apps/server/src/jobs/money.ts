// R-SERVER-011, R-SERVER-012: the daily job at 00:00 UTC, for the day that has
// just ended. It reports, raises what it finds, and takes no other action.
import { forgetBefore } from "../admin/active";
import { raiseAlarms } from "../admin/alarm";
import { utcDay } from "../admin/day";
import type { MoneyDay } from "../admin/money";
import { drawAlarms, moneyReport } from "../admin/money";
import type { ServerDeps } from "../deps";

/** The cron in `wrangler.jsonc` that runs this job. */
export const MONEY_CRON = "0 0 * * *";

export async function moneyJob(deps: ServerDeps): Promise<MoneyDay> {
  const day = utcDay(deps.now()) - 1;
  const report = await moneyReport(deps, day);
  const alarms = [...report.alarms, ...(await drawAlarms(deps, day))];
  await raiseAlarms(deps, alarms);
  forgetBefore(deps, day + 1);
  return { ...report, alarms };
}
