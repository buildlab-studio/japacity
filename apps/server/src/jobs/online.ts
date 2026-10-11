// R-ANALYTICS-013: online now and the day's peak. Online now is
// one query over the command log: the accounts whose player sent an accepted
// command in the last `ONLINE_MINUTES`, by region; no table holds it. The
// five-minute tick samples it and keeps each region's highest sample of the
// UTC day as `players/online-peak`, key `peak`, and the whole game's highest
// under the region `all` (WHOLE_GAME).
import { ONLINE_MINUTES } from "@japacity/content";
import { time } from "@japacity/sim";
import type { CounterTotal, NumbersLog, RegionCount } from "@japacity/store";

import { utcDay } from "../admin/day";
import { dayName } from "../analytics/day";
import { WHOLE_GAME } from "../analytics/list";
import type { ServerDeps } from "../deps";
import { TICKS_CRON } from "./ticks";

const PEAK = "players/online-peak";

/** The players online at `now`: a command in [now - ONLINE_MINUTES, now]. */
export function onlineAt(log: Pick<NumbersLog, "players">, now: number): Promise<RegionCount[]> {
  return log.players(now - ONLINE_MINUTES * time.MINUTE_MS, now + 1);
}

/**
 * Raises each region's peak to the sample where the sample is higher. The
 * store only adds, so the rise is added; two samples taken at once could add
 * twice, and the tick runs once a cron.
 */
export async function samplePeak(deps: Pick<ServerDeps, "stores" | "now">, sample: readonly RegionCount[]): Promise<CounterTotal[]> {
  const day = dayName(utcDay(deps.now()));
  const held = new Map((await deps.stores.counters.days(day, day)).filter((row) => row.name === PEAK).map((row) => [row.region, row.count]));
  const whole = sample.reduce((sum, each) => sum + each.count, 0);
  const rises = [...sample.filter((each) => each.region !== WHOLE_GAME), { region: WHOLE_GAME, count: whole }].flatMap(({ region, count }) => {
    const rise = count - (held.get(region) ?? 0);
    return rise > 0 ? [{ day, region, name: PEAK, key: "peak", count: rise }] : [];
  });
  if (rises.length > 0) await deps.stores.counters.add(rises);
  return rises;
}

/** Runs on the five-minute cron only; answers the sample it took. */
export async function onlineJob(deps: ServerDeps, log: Pick<NumbersLog, "players">, cron: string): Promise<RegionCount[]> {
  if (cron !== TICKS_CRON) return [];
  const sample = await onlineAt(log, deps.now());
  await samplePeak(deps, sample);
  return sample;
}
