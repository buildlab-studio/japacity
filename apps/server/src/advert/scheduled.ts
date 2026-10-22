// advert:reported-advert-pulled-at-once: on the deployment's tick cron (every five minutes, or its TICK_CRON), every approved campaign that
// starts before the next run has its links rechecked; one that fails is pulled.
import { int } from "@japacity/sim";

import type { ServerDeps } from "../dependencies";
import { TICKS_CRON } from "../scheduled/ticks";
import type { Fetcher } from "./links";
import { failingLinks } from "./links";
import { pullCampaign } from "./review";

/**
 * advert:reported-advert-pulled-at-once: the window a run rechecks, from the firing it stands for up to the next one. The cron
 * fires on the multiples of `periodMs` from 00:00 UTC; a run is late or early by a minute at most (Cloudflare's
 * stated accuracy), under half of any tick period over two minutes (every deployment's is five or thirty), so
 * rounding its clock to the nearest multiple gives the firing it stands for. The windows of
 * successive firings meet end to start, so each start falls in exactly one: no campaign is rechecked by two runs and
 * none falls between them, whatever the drift. A campaign that started since the firing, before the late run
 * reached it, is still in that firing's window.
 */
export function recheckWindow(now: number, periodMs: number): { from: number; until: number } {
  const from = int.divFloor(now + int.divFloor(periodMs, 2), periodMs) * periodMs;
  return { from, until: from + periodMs };
}

/** Returns the campaigns this run pulled. `periodMs`: the deployment's tick period (`tickPeriodMs`). */
export async function advertLinksJob(deps: Pick<ServerDeps, "stores" | "now">, cron: string, fetcher: Fetcher, periodMs: number): Promise<string[]> {
  if (cron !== TICKS_CRON) return [];
  const { from, until } = recheckWindow(deps.now(), periodMs);
  const pulled: string[] = [];
  for (const campaign of await deps.stores.adverts.campaigns()) {
    if (campaign.status !== "approved" || campaign.starts < from || campaign.starts >= until) continue;
    if ((await failingLinks(deps, fetcher, campaign.id)).length === 0) continue;
    if ((await pullCampaign(deps, campaign.id)).ok) pulled.push(campaign.id);
  }
  return pulled;
}
