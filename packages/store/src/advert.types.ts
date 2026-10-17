// Adverts on the server (docs/rules/adverts.md, Contract): advertisers,
// campaigns, creatives with their reviews, and the daily counts. Nothing here
// names a player (R-ADVERT-020).
import type { Id } from "@japacity/sim";

import type { StoreResult } from "./types";

/** An advert region (adverts.md R-ADVERT-008): a country's code, or `default`. */
export type RegionCode = string;

/** R-ADVERT-020: the advertiser as a business, with one contact. */
export interface Advertiser {
  id: string;
  businessName: string;
  registration: { country: string; number: string };
  contactName: string;
  contactEmail: string;
}

/** `live` and `ended` are read from the dates at a moment; the stored status is never moved by the clock. */
export type CampaignStatus = "pending" | "approved" | "live" | "paused" | "ended" | "refused";

/** R-ADVERT-017: the real name and sign a campaign puts on a private place. */
export interface NamedPlace {
  place: Id<"place">;
  name: string;
  sign: string;
}

export interface Campaign {
  id: string;
  advertiser: string;
  slots: Id<"advert">[];
  regions: RegionCode[];
  /** Milliseconds since 1970; shown from `starts` up to, not including, `ends`. */
  starts: number;
  ends: number;
  status: CampaignStatus;
  // the page's Campaign has no category or named place; R-ADVERT-015 to 017 need both on record.
  category: string;
  place: NamedPlace | null;
}

/** R-ADVERT-004: what the image is, measured from its bytes, never taken from the sender. */
export interface CreativeFile {
  format: "png" | "jpeg" | "webp";
  width: number;
  height: number;
  bytes: number;
}

/** `pending` waits for review; a pulled advert goes back to `pending` (R-ADVERT-014). */
export type CreativeStatus = "pending" | "approved" | "refused";

/** One version of a creative. A change is a new version with the same id (R-ADVERT-011). */
export interface Creative {
  id: string;
  campaign: string;
  file: CreativeFile;
  text: string;
  link: string | null;
  version: number;
  status: CreativeStatus;
}

/** R-ADVERT-010: who looked, when, what they checked and under which banned list. */
export interface AdvertReview {
  creative: string;
  version: number;
  reviewer: string;
  at: number;
  checks: string[];
  bannedListVersion: string;
  outcome: "approved" | "refused";
  note: string;
}

/** R-ADVERT-020: a whole UTC day's counts for one slot, campaign and region. `day` is days since 1970. */
export interface AdvertCount {
  day: number;
  slot: Id<"advert">;
  campaign: string;
  region: RegionCode;
  impressions: number;
  taps: number;
}

export interface AdvertStore {
  /** Refused with `exists` for a known id. */
  addAdvertiser: (row: Advertiser) => Promise<StoreResult<Advertiser>>;
  advertiser: (id: string) => Promise<Advertiser | null>;
  /** Refused with `exists` for a known id and `missing` for an unknown advertiser. */
  addCampaign: (row: Campaign) => Promise<StoreResult<Campaign>>;
  campaign: (id: string) => Promise<Campaign | null>;
  /** Every campaign, by id. */
  campaigns: () => Promise<Campaign[]>;
  /** Refused with `missing` for an unknown campaign. */
  setCampaignStatus: (id: string, status: CampaignStatus) => Promise<StoreResult<Campaign>>;
  /**
   * Stores a version and its image. Refused with `missing` for an unknown campaign, `exists` for a
   * stored version, `conflict` when the id belongs to another campaign, and `stale` unless the version
   * is one past the creative's latest (1 for a new one).
   */
  addCreative: (row: Creative, image: Uint8Array) => Promise<StoreResult<Creative>>;
  /** A campaign's creatives, every version, by id then version. */
  creatives: (campaign: string) => Promise<Creative[]>;
  creative: (id: string, version: number) => Promise<Creative | null>;
  /** Refused with `missing` for an unknown version. */
  setCreativeStatus: (id: string, version: number, status: CreativeStatus) => Promise<StoreResult<Creative>>;
  image: (id: string, version: number) => Promise<Uint8Array | null>;
  /** Append-only: a review is never changed or removed. */
  addReview: (row: AdvertReview) => Promise<void>;
  /** A creative's reviews, every version, in the order they were added. */
  reviews: (creative: string) => Promise<AdvertReview[]>;
  /** Adds each row to its day's totals for the slot, campaign and region. */
  addCounts: (rows: AdvertCount[]) => Promise<void>;
  /** A campaign's totals, by day, slot and region. */
  counts: (campaign: string) => Promise<AdvertCount[]>;
}
