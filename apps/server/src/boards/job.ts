// The week's turn (city.md R-CITY-039): on the five-minute cron, every row
// whose week is behind the Lagos week saves its figure as the week's start.
// Idempotent: a second run in the same week moves nothing.
import type { ServerDeps } from "../deps";
import { TICKS_CRON } from "../jobs/ticks";
import { lagosWeek } from "./week";

/** R-CITY-039: runs on the five-minute cron only; answers how many rows it moved. */
export function boardsWeekJob(deps: Pick<ServerDeps, "stores" | "now">, cron: string): Promise<number> {
  if (cron !== TICKS_CRON) return Promise.resolve(0);
  return deps.stores.boards.turnWeek(lagosWeek(deps.now()));
}
