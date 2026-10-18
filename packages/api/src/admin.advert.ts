// The admin routes of the advert queue (advert:named-person-approves-creatives, advert:changes-return-to-review, advert:reviewer-checks-and-records, advert:submissions-never-auto-post and advert:reported-advert-pulled-at-once). The rows are the
// store's, named here for the client.
import type { AdvertCount, AdvertReview, Advertiser, Campaign, CampaignStatus, Creative } from "@japacity/store";

import type { AdminRefusal } from "./admin";

export type { AdvertCount, AdvertReview, Advertiser, Campaign, CampaignStatus, Creative };

/** A version as the campaigns reply lists it: with the checks its approval needs (advert:reviewer-checks-and-records). */
export type ReviewedCreative = Creative & { checks: string[] };

/** One row of `GET /api/admin/adverts/campaigns`. */
export interface CampaignRow {
  campaign: Campaign;
  advertiser: Advertiser | null;
  /** advert:reviewer-checks-and-records: the checks the campaign's approval needs. */
  checks: string[];
  creatives: ReviewedCreative[];
  reviews: AdvertReview[];
  counts: AdvertCount[];
}

/** The body of an approve or a refuse. */
export interface ReviewBody {
  checks: string[];
  note: string;
}

export type CampaignsReply = { ok: true; campaigns: CampaignRow[] } | AdminRefusal;
export type CampaignReply = { ok: true; campaign: Campaign } | AdminRefusal;
export type CreativeReply = { ok: true; creative: Creative } | AdminRefusal;
export type RecheckReply = { ok: true; failing: string[]; pulled: boolean } | AdminRefusal;
