// The adverts a player sees (advert:one-labelled-still-image, advert:tap-opens-advert-card, advert:campaign-chosen-without-player-data).
import type { Id } from "@japacity/sim";

/** What the client needs to draw one slot and its card (advert:one-labelled-still-image, advert:tap-opens-advert-card). */
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
