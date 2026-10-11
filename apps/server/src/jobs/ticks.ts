// The world's scheduled job (docs/rules/clock.md R-CLOCK-012): every five
// minutes, every tick from the last stored one up to the current tick.
import { time } from "@japacity/sim";

import { tickAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import { catchUp } from "../world/ticks";

/** The cron of the world's ticks in `wrangler.jsonc`. */
export const TICKS_CRON = "*/5 * * * *";

/**
 * R-CLOCK-012, R-SERVER-038: a deployment may tick on a slower cron (its
 * `TICK_CRON`). Every job keyed on the five-minute cron is handed that cron
 * when the deployment's own tick cron fires, so the jobs run unchanged at the
 * slower pace; any other cron, the daily one among them, is handed on as it is.
 */
export function jobCron(cron: string, tickCron: string = TICKS_CRON): string {
  return cron === tickCron ? TICKS_CRON : cron;
}

/**
 * R-ADVERT-014: the period of a deployment's tick cron in milliseconds, a whole number of minutes.
 * Only the form every tick cron takes is read: every N minutes, N dividing an hour ("*" "/N" then four "*"), so the
 * runs fall on the multiples of the period counted from 00:00 UTC; any other form is refused rather than guessed.
 */
export function tickPeriodMs(tickCron: string): number {
  const every = /^\*\/([1-9][0-9]?) \* \* \* \*$/.exec(tickCron)?.[1];
  const minutes = every === undefined ? 0 : Number(every);
  if (minutes === 0 || 60 % minutes !== 0) throw new Error(`The tick cron must run every N minutes, N dividing an hour: ${tickCron}`);
  return minutes * time.MINUTE_MS;
}

/** R-CLOCK-012: runs on its own cron only; returns the ticks this run stored. */
export function ticksJob(deps: ServerDeps, cron: string): Promise<number[]> {
  if (cron !== TICKS_CRON) return Promise.resolve([]);
  return catchUp(deps, tickAt(deps.config.clock, deps.now()));
}
