// The adverts a player sees (advert.md R-ADVERT-004, 005, 008).
import type { Id } from "@japacity/sim";

/** What the client needs to draw one slot and its card (R-ADVERT-004, R-ADVERT-005). */
export interface ServedAdvert {
  campaign: string;
  creative: string;
  version: number;
  /** The path of the approved image on this server. */
  image: string;
  width: number;
  height: number;
  advertiser: string;
  text: string;
  link: string | null;
}

/** `GET /api/adverts`: the campaign in each slot for the region and the hour. */
export interface AdvertsReply {
  ok: true;
  region: string;
  hour: number;
  /** When the next hour starts, in milliseconds since 1970. */
  until: number;
  slots: Partial<Record<Id<"advert">, ServedAdvert>>;
}
