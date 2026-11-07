// The client's side of adverts (docs/rules/advert.md): the hour's slots from
// the server, whether a slot may show at all, and the impression and tap
// counts, sent with the interface counters and never tied to the player.
import type { AdvertsReply, ServerRejection } from "@japacity/api";
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import { type Api, retryAfterMs } from "../../shared/net/http";

/** The interface counters an advert sends (analytics:client-sends-interface-counts), keyed by the slot's id. */
export const ADVERT_COUNTERS = { impression: "advert/impression", tap: "advert/tap" } as const;

type AdvertCounter = (typeof ADVERT_COUNTERS)[keyof typeof ADVERT_COUNTERS];

/** Adds one to an interface counter. The analytics batch sends it. */
export type CountAdvert = (name: AdvertCounter, key: Id<"advert">) => void;

/**
 * advert:no-adverts-on-protected-screens: whether any slot may show for this view. The view's flag
 * decides; an open set piece or a `noAdverts` chapter hides slots even if a
 * view arrived without it.
 */
export function advertsShown(view: PlayerView): boolean {
  if (!view.adverts || view.setpiece !== null || view.place.where === "road") return false;
  const chapter = view.chapter.current === null ? undefined : content.chapter[view.chapter.current];
  return chapter?.noAdverts !== true;
}

/**
 * What a read of the hour's slots came to: the hour's `reply`; `off`, nothing to show (the adverts switch off, or any other
 * answer the server gave), asked again after `retryMs`; or `refused`, no answer (over the read limit, the server unreachable),
 * which keeps the last good reply and asks again after `retryMs`. An empty board is never an error.
 */
export type AdvertsRead = { kind: "reply"; reply: AdvertsReply } | { kind: "off" | "refused"; retryMs: number };

/** How long a read that gave no hour waits before it is asked again, when the server names no wait. */
const RETRY_MS = 60_000;

/** The hour's slots for a region. */
export async function fetchAdverts(api: Api, region: string): Promise<AdvertsRead> {
  try {
    const reply = await api.get<AdvertsReply | ServerRejection>(`/api/adverts?region=${encodeURIComponent(region)}`);
    if (reply.ok) return { kind: "reply", reply };
    const retryMs = reply.retryAfter === undefined ? RETRY_MS : retryAfterMs(reply);
    return { kind: reply.code === "rate-limited" ? "refused" : "off", retryMs };
  } catch {
    return { kind: "refused", retryMs: RETRY_MS };
  }
}

/**
 * The pictures drawn in this page's life, each held so a slot drawn again (the phone's home after an app, a place walked back
 * into) shows it from the page's memory and does not ask the server for it again (server:per-account-rate-limits).
 */
const pictures = new Map<string, HTMLImageElement>();

export function holdPicture(src: string): void {
  if (pictures.has(src) || typeof Image === "undefined") return;
  const picture = new Image();
  picture.src = src;
  pictures.set(src, picture);
}

/** advert:impression-counted-when-seen: an impression counts at most once per slot in a session, a session being this page's life. */
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
