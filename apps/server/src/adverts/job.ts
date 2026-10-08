// R-ADVERT-014: on the world's five-minute cron, every approved campaign that
// starts before the next run has its links rechecked; one that fails is pulled.
import { time } from "@japacity/sim";

import type { ServerDeps } from "../deps";
import { TICKS_CRON } from "../jobs/ticks";
import type { Fetcher } from "./links";
import { failingLinks } from "./links";
import { pullCampaign } from "./review";

/** The cron's period: a campaign starting within it is checked by this run and no other. */
export const RECHECK_WINDOW_MS = 5 * time.MINUTE_MS;

/** Returns the campaigns this run pulled. */
export async function advertLinksJob(deps: Pick<ServerDeps, "stores" | "now">, cron: string, fetcher: Fetcher): Promise<string[]> {
  if (cron !== TICKS_CRON) return [];
  const now = deps.now();
  const pulled: string[] = [];
  for (const campaign of await deps.stores.adverts.campaigns()) {
    if (campaign.status !== "approved" || campaign.starts < now || campaign.starts >= now + RECHECK_WINDOW_MS) continue;
    if ((await failingLinks(deps, fetcher, campaign.id)).length === 0) continue;
    if ((await pullCampaign(deps, campaign.id)).ok) pulled.push(campaign.id);
  }
  return pulled;
}
