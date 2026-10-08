// The world's scheduled job (docs/rules/clock.md R-CLOCK-012): every five
// minutes, every tick from the last stored one up to the current tick.
import { tickAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import { catchUp } from "../world/ticks";

/** The cron of the world's ticks in `wrangler.jsonc`. */
export const TICKS_CRON = "*/5 * * * *";

/** R-CLOCK-012: runs on its own cron only; returns the ticks this run stored. */
export function ticksJob(deps: ServerDeps, cron: string): Promise<number[]> {
  if (cron !== TICKS_CRON) return Promise.resolve([]);
  return catchUp(deps, tickAt(deps.config.clock, deps.now()));
}
