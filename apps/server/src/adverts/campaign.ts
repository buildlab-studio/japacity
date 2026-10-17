// What a campaign and a creative must be before a person reviews them, and what
// a review must record (R-ADVERT-004, 005, 010 to 012, 015 to 019). Plain
// functions over the content and the advert regions; the routes store the result.
import type { Content, Id, PlaceEntry } from "@japacity/sim";
import type { Campaign, CampaignStatus, Creative, CreativeFile, NamedPlace } from "@japacity/store";

import { bannedHits, categoryKind, conditionsOf } from "./categories";
import { imageFacts } from "./image";

/** The advert region for a country's code: the code when it is listed, `default` for any other (R-ADVERT-008). */
export function advertRegion(regions: readonly string[], asked: string | null | undefined): string {
  const code = (asked ?? "").toUpperCase();
  return code !== "" && code !== "DEFAULT" && regions.includes(code) ? code : "default";
}

/** The status at a moment: an approved campaign is live between its dates and ended after them. */
export function statusAt(campaign: Campaign, at: number): CampaignStatus {
  if (campaign.status !== "approved" && campaign.status !== "live") return campaign.status;
  if (at >= campaign.ends) return "ended";
  return at >= campaign.starts ? "live" : "approved";
}

export interface CampaignDraft {
  advertiser: string;
  slots: string[];
  regions: string[];
  starts: number;
  ends: number;
  category: string;
  place: NamedPlace | null;
}

const LINE = /^[^\r\n]+$/;

/** R-ADVERT-017 to 019: why a real name may not go on this place, or nothing. */
export function namingRefusals(content: Content, named: NamedPlace): string[] {
  const place: PlaceEntry | undefined = content.place[named.place];
  if (place === undefined) return [`${named.place} is not a place (R-ADVERT-017).`];
  const refusals: string[] = [];
  if (place.nameKind === "institution") refusals.push(`${place.id} is an institution and never takes a real name (R-ADVERT-019).`);
  if (place.nameKind === "stylised" || place.where === "road") refusals.push(`${place.id} is stylised and never takes a real name (R-CITY-023).`);
  if (place.nameKind === "public") refusals.push(`${place.id} is a public place under its own name; only a private place takes a business's name (R-ADVERT-017).`);
  const frauds = place.stages.filter((id) => (content.offer[id as Id<"offer">]?.fraudBp ?? 0) > 0);
  if (frauds.length > 0) refusals.push(`${place.id} stages ${frauds.join(", ")}, which can be a fraud, and a named place hosts no bad event (R-ADVERT-018).`);
  if (!LINE.test(named.name) || !LINE.test(named.sign)) refusals.push("The real name and the sign are each one line (R-ADVERT-017).");
  return refusals;
}

/** Why a campaign cannot be taken for review, or nothing. */
export function campaignRefusals(content: Content, regions: readonly string[], draft: CampaignDraft): string[] {
  const refusals: string[] = [];
  if (draft.slots.length === 0) refusals.push("A campaign names at least one slot (R-ADVERT-001).");
  for (const slot of draft.slots) if (content.advert[slot as Id<"advert">] === undefined) refusals.push(`${slot} is not an advert slot (R-ADVERT-001).`);
  if (new Set(draft.slots).size !== draft.slots.length) refusals.push("A slot is named twice (R-ADVERT-001).");
  if (draft.regions.length === 0) refusals.push("A campaign names at least one region (R-ADVERT-008).");
  for (const region of draft.regions) if (!regions.includes(region)) refusals.push(`${region} is not a region of the table (R-ADVERT-021).`);
  if (!Number.isSafeInteger(draft.starts) || !Number.isSafeInteger(draft.ends) || draft.starts >= draft.ends) refusals.push("A campaign starts before it ends, in whole milliseconds (R-ADVERT-020).");
  const kind = categoryKind(draft.category);
  switch (kind) {
    case "banned":
      refusals.push(`${draft.category} is a banned category, refused whatever it pays (R-ADVERT-015).`);
      break;
    case "unknown":
      refusals.push(`${draft.category} is not a category on the list (R-ADVERT-015, R-ADVERT-016).`);
      break;
    case "restricted":
    case "general":
      break;
    default: {
      const never: never = kind;
      refusals.push(`Unknown category kind ${String(never)}.`);
    }
  }
  if ((draft.place === null) !== (draft.category !== "named-place")) refusals.push("A named place, and only a named place, is in the category named-place (R-ADVERT-016).");
  if (draft.place !== null) {
    refusals.push(...namingRefusals(content, draft.place));
    const hits = bannedHits(draft.place.name, draft.place.sign);
    if (hits.length > 0) refusals.push(`The name reads as the banned ${hits.join(", ")} (R-ADVERT-015).`);
  }
  return refusals;
}

export interface CreativeDraft {
  image: Uint8Array;
  text: string;
  link: string | null;
}

/** R-ADVERT-005: one `https` link, with no sign-in details in it. */
function linkRefusals(link: string | null): string[] {
  if (link === null) return [];
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return [`${link} is not a link (R-ADVERT-005).`];
  }
  if (url.protocol !== "https:") return ["The link is https (R-ADVERT-005)."];
  if (url.username !== "" || url.password !== "") return ["The link carries no sign-in details (R-ADVERT-005)."];
  return [];
}

/** The slot sizes a campaign's image could fill. */
function slotsOf(content: Content, campaign: Campaign) {
  return campaign.slots.flatMap((id) => {
    const slot = content.advert[id];
    return slot === undefined ? [] : [slot];
  });
}

/** The measured file, or the reasons it is not an advert for this campaign (R-ADVERT-004). */
export function creativeFile(content: Content, campaign: Campaign, draft: CreativeDraft): { ok: true; file: CreativeFile } | { ok: false; refusals: string[] } {
  const refusals: string[] = [];
  const facts = imageFacts(draft.image);
  if (facts === null) refusals.push("The image is not a PNG, JPEG or WebP (R-ADVERT-004).");
  else if (facts.animated) refusals.push("The image moves; an advert is one still image (R-ADVERT-004).");
  if (facts !== null && !facts.animated) {
    const sized = slotsOf(content, campaign).filter((slot) => slot.width === facts.width && slot.height === facts.height);
    if (sized.length === 0) refusals.push(`The image is ${String(facts.width)} by ${String(facts.height)}, the size of none of the campaign's slots (R-ADVERT-004).`);
    for (const slot of sized) {
      if (draft.image.length > slot.maxBytes) refusals.push(`The image is ${String(draft.image.length)} bytes, over ${slot.id}'s limit of ${String(slot.maxBytes)} (R-ADVERT-004).`);
    }
  }
  if (!LINE.test(draft.text)) refusals.push("The text is one line (R-ADVERT-005).");
  if (/https?:|www\./i.test(draft.text)) refusals.push("The text carries no link; the one link is its own field (R-ADVERT-005).");
  refusals.push(...linkRefusals(draft.link));
  const hits = bannedHits(draft.text, draft.link ?? "");
  if (hits.length > 0) refusals.push(`The advert reads as the banned ${hits.join(", ")} (R-ADVERT-015).`);
  if (refusals.length > 0 || facts === null) return { ok: false, refusals };
  return { ok: true, file: { format: facts.format, width: facts.width, height: facts.height, bytes: draft.image.length } };
}

/** R-ADVERT-012, R-ADVERT-016, R-ADVERT-017: what a reviewer records before a campaign is approved. */
export function campaignChecks(campaign: Campaign): string[] {
  const checks = ["registered-business", "category", ...conditionsOf(campaign.category)];
  // Every advertiser shown in Nigeria brings the regulator's approval: the page does not say whether all need it, so all do.
  if (campaign.regions.includes("NG")) checks.push("regulator-approval");
  return checks;
}

/** R-ADVERT-004 to 006, R-ADVERT-012: what a reviewer records before a creative is approved. */
export function creativeChecks(creative: Creative): string[] {
  return ["format", "not-game-like", "text", ...(creative.link === null ? [] : ["link-domain"])];
}

/** The checks a review is missing. */
export function missingChecks(required: string[], made: string[]): string[] {
  return required.filter((check) => !made.includes(check));
}
