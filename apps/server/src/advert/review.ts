// The review's decisions (advert:named-person-approves-creatives, advert:changes-return-to-review, advert:reported-advert-pulled-at-once). Each approval and refusal is
// recorded with the reviewer, the time, the checks and the banned list's version.
import type { AdminAction, AdvertReview, Campaign, Creative, LogParams, StoreResult } from "@japacity/store";

import type { ServerDeps } from "../deps";
import { newId } from "../moderation/decide";
import { BANNED_LIST_VERSION } from "./categories";
import { campaignChecks, creativeChecks, missingChecks } from "./campaign";

type ReviewDeps = Pick<ServerDeps, "stores" | "now">;

export interface Decision {
  reviewer: string;
  checks: string[];
  note: string;
}

export type Decided<T> = StoreResult<T> | { ok: false; code: "unchecked"; detail: string; missing: string[] } | { ok: false; code: "not-pending"; detail: string };

/** The campaign's own review is recorded as version 0 of the campaign's id. */
const CAMPAIGN_VERSION = 0;

function record(deps: ReviewDeps, creative: string, version: number, decision: Decision, outcome: AdvertReview["outcome"]): Promise<void> {
  return deps.stores.adverts.addReview({ creative, version, reviewer: decision.reviewer, at: deps.now(), checks: [...decision.checks], bannedListVersion: BANNED_LIST_VERSION, outcome, note: decision.note });
}

/** advert:reviewer-checks-and-records: approves a pending or pulled campaign once every check it needs is recorded. */
export async function decideCampaign(deps: ReviewDeps, id: string, outcome: AdvertReview["outcome"], decision: Decision): Promise<Decided<Campaign>> {
  const campaign = await deps.stores.adverts.campaign(id);
  if (campaign === null) return { ok: false, code: "missing", detail: `No campaign ${id}.` };
  if (campaign.status !== "pending" && campaign.status !== "paused") return { ok: false, code: "not-pending", detail: `The campaign ${id} is ${campaign.status}, not waiting for review.` };
  const missing = outcome === "approved" ? missingChecks(campaignChecks(campaign), decision.checks) : [];
  if (missing.length > 0) return { ok: false, code: "unchecked", detail: `Not approved: the review has not recorded ${missing.join(", ")}.`, missing };
  await record(deps, id, CAMPAIGN_VERSION, decision, outcome);
  return deps.stores.adverts.setCampaignStatus(id, outcome === "approved" ? "approved" : "refused");
}

/** advert:named-person-approves-creatives, advert:changes-return-to-review: approves or refuses one pending version of a creative. Payment is never an input. */
export async function decideCreative(deps: ReviewDeps, id: string, version: number, outcome: AdvertReview["outcome"], decision: Decision): Promise<Decided<Creative>> {
  const creative = await deps.stores.adverts.creative(id, version);
  if (creative === null) return { ok: false, code: "missing", detail: `No version ${String(version)} of ${id}.` };
  if (creative.status !== "pending") return { ok: false, code: "not-pending", detail: `Version ${String(version)} of ${id} is ${creative.status}, not waiting for review.` };
  const missing = outcome === "approved" ? missingChecks(creativeChecks(creative), decision.checks) : [];
  if (missing.length > 0) return { ok: false, code: "unchecked", detail: `Not approved: the review has not recorded ${missing.join(", ")}.`, missing };
  await record(deps, id, version, decision, outcome);
  return deps.stores.adverts.setCreativeStatus(id, version, outcome);
}

/** advert:reported-advert-pulled-at-once: out of rotation at once, and back to review: the campaign is paused and its approved versions wait again. */
export async function pullCampaign(deps: Pick<ServerDeps, "stores">, id: string): Promise<StoreResult<Campaign>> {
  const paused = await deps.stores.adverts.setCampaignStatus(id, "paused");
  if (!paused.ok) return paused;
  for (const creative of await deps.stores.adverts.creatives(id)) {
    if (creative.status === "approved") await deps.stores.adverts.setCreativeStatus(creative.id, creative.version, "pending");
  }
  return paused;
}

/** The reason an advert decision is logged under, from the report reasons the admin log uses (moderation:admin-actions-logged-append-only). */
const ADVERT_LOG_REASON = "advert";

/** moderation:fixed-admin-actions, moderation:admin-actions-logged-append-only: an advert decision in the admin log, with the admin, the time, the item and its parameters. */
export async function logAdvertAction(
  deps: Pick<ServerDeps, "stores" | "now" | "randomBytes">,
  admin: string,
  action: Extract<AdminAction, "approve-advert" | "refuse-advert" | "pull-advert">,
  item: string,
  params: LogParams,
  note: string,
): Promise<void> {
  const entry = { id: newId(deps, "log"), admin, at: deps.now(), item, action, params, reason: ADVERT_LOG_REASON, ...(note === "" ? {} : { note }) };
  const written = await deps.stores.moderationLog.append(entry);
  if (!written.ok) throw new Error(`The log refused an entry: ${written.detail}`);
}
