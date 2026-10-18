// The client's side of adverts (docs/rules/advert.md): the hour's slots from
// the server, whether a slot may show at all, and the impression and tap
// counts, sent with the interface counters and never tied to the player.
import type { AdvertsReply } from "@japacity/api";
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import type { Api } from "../../shared/net/http";

/** The interface counters an advert sends (analytics.md R-ANALYTICS-002), keyed by the slot's id. */
export const ADVERT_COUNTERS = { impression: "advert/impression", tap: "advert/tap" } as const;

type AdvertCounter = (typeof ADVERT_COUNTERS)[keyof typeof ADVERT_COUNTERS];

/** Adds one to an interface counter. The analytics batch sends it. */
export type CountAdvert = (name: AdvertCounter, key: Id<"advert">) => void;

/**
 * R-ADVERT-003: whether any slot may show for this view. The view's flag
 * decides; an open set piece or a `noAdverts` chapter hides slots even if a
 * view arrived without it.
 */
export function advertsShown(view: PlayerView): boolean {
  if (!view.adverts || view.setpiece !== null || view.place.where === "road") return false;
  const chapter = view.chapter.current === null ? undefined : content.chapter[view.chapter.current];
  return chapter?.noAdverts !== true;
}

/** The hour's slots for a region, or null when the server could not be read: an empty board is never an error. */
export async function fetchAdverts(api: Api, region: string): Promise<AdvertsReply | null> {
  try {
    const reply = await api.get<AdvertsReply | { ok: false }>(`/api/adverts?region=${encodeURIComponent(region)}`);
    return reply.ok ? reply : null;
  } catch {
    return null;
  }
}

/** R-ADVERT-022: an impression counts at most once per slot in a session, a session being this page's life. */
const seenThisSession = new Set<string>();

/** Counts the slot's impression unless it was counted already; returns whether it counted. */
export function countImpression(count: CountAdvert, slot: Id<"advert">): boolean {
  if (seenThisSession.has(slot)) return false;
  seenThisSession.add(slot);
  count(ADVERT_COUNTERS.impression, slot);
  return true;
}

/** For tests: a fresh session. */
export function forgetImpressions(): void {
  seenThisSession.clear();
}
