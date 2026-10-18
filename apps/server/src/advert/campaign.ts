// What a campaign and a creative must be before a person reviews them, and what
// a review must record (advert:one-labelled-still-image, advert:tap-opens-advert-card, advert:named-person-approves-creatives, advert:changes-return-to-review, advert:reviewer-checks-and-records, advert:banned-categories-refused, advert:restricted-categories-need-conditions, advert:real-name-only-by-agreement, advert:sponsored-place-hosts-no-harm and advert:institutions-never-take-real-names). Plain
// functions over the content and the advert regions; the routes store the result.
import type { Content, Id, PlaceEntry } from "@japacity/sim";
import type { Campaign, CampaignStatus, Creative, CreativeFile, NamedPlace } from "@japacity/store";

import { bannedHits, categoryKind, conditionsOf } from "./categories";
import { imageFacts } from "./image";

/** The advert region for a country's code: the code when it is listed, `default` for any other (advert:campaign-chosen-without-player-data). */
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

/** advert:real-name-only-by-agreement, advert:sponsored-place-hosts-no-harm and advert:institutions-never-take-real-names: why a real name may not go on this place, or nothing. */
function namingRefusals(content: Content, named: NamedPlace): string[] {
  const place: PlaceEntry | undefined = content.place[named.place];
  if (place === undefined) return [`${named.place} is not a place (advert:real-name-only-by-agreement).`];
  const refusals: string[] = [];
  if (place.nameKind === "institution") refusals.push(`${place.id} is an institution and never takes a real name (advert:institutions-never-take-real-names).`);
  if (place.nameKind === "stylised" || place.where === "road") refusals.push(`${place.id} is stylised and never takes a real name (city:road-places-are-stylised).`);
  if (place.nameKind === "public") refusals.push(`${place.id} is a public place under its own name; only a private place takes a business's name (advert:real-name-only-by-agreement).`);
  const frauds = place.stages.filter((id) => (content.offer[id as Id<"offer">]?.fraudBp ?? 0) > 0);
  if (frauds.length > 0) refusals.push(`${place.id} stages ${frauds.join(", ")}, which can be a fraud, and a named place hosts no bad event (advert:sponsored-place-hosts-no-harm).`);
  if (!LINE.test(named.name) || !LINE.test(named.sign)) refusals.push("The real name and the sign are each one line (advert:real-name-only-by-agreement).");
  return refusals;
}

/** Why a campaign cannot be taken for review, or nothing. */
export function campaignRefusals(content: Content, regions: readonly string[], draft: CampaignDraft): string[] {
  const refusals: string[] = [];
  if (draft.slots.length === 0) refusals.push("A campaign names at least one slot (advert:adverts-only-in-slots).");
  for (const slot of draft.slots) if (content.advert[slot as Id<"advert">] === undefined) refusals.push(`${slot} is not an advert slot (advert:adverts-only-in-slots).`);
  if (new Set(draft.slots).size !== draft.slots.length) refusals.push("A slot is named twice (advert:adverts-only-in-slots).");
  if (draft.regions.length === 0) refusals.push("A campaign names at least one region (advert:campaign-chosen-without-player-data).");
  for (const region of draft.regions) if (!regions.includes(region)) refusals.push(`${region} is not a region of the table (advert:advertisers-get-daily-counts-only).`);
  if (!Number.isSafeInteger(draft.starts) || !Number.isSafeInteger(draft.ends) || draft.starts >= draft.ends) refusals.push("A campaign starts before it ends, in whole milliseconds (advert:advertiser-records-stored).");
  const kind = categoryKind(draft.category);
  switch (kind) {
    case "banned":
      refusals.push(`${draft.category} is a banned category, refused whatever it pays (advert:banned-categories-refused).`);
      break;
    case "unknown":
      refusals.push(`${draft.category} is not a category on the list (advert:banned-categories-refused, advert:restricted-categories-need-conditions).`);
      break;
    case "restricted":
    case "general":
      break;
    default: {
      const never: never = kind;
      refusals.push(`Unknown category kind ${String(never)}.`);
    }
  }
  if ((draft.place === null) !== (draft.category !== "named-place")) refusals.push("A named place, and only a named place, is in the category named-place (advert:restricted-categories-need-conditions).");
  if (draft.place !== null) {
    refusals.push(...namingRefusals(content, draft.place));
    const hits = bannedHits(draft.place.name, draft.place.sign);
    if (hits.length > 0) refusals.push(`The name reads as the banned ${hits.join(", ")} (advert:banned-categories-refused).`);
  }
  return refusals;
}

export interface CreativeDraft {
  image: Uint8Array;
  text: string;
  link: string | null;
}

/** advert:tap-opens-advert-card: one `https` link, with no sign-in details in it. */
function linkRefusals(link: string | null): string[] {
  if (link === null) return [];
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return [`${link} is not a link (advert:tap-opens-advert-card).`];
  }
  if (url.protocol !== "https:") return ["The link is https (advert:tap-opens-advert-card)."];
  if (url.username !== "" || url.password !== "") return ["The link carries no sign-in details (advert:tap-opens-advert-card)."];
  return [];
}

/** The slot sizes a campaign's image could fill. */
function slotsOf(content: Content, campaign: Campaign) {
  return campaign.slots.flatMap((id) => {
    const slot = content.advert[id];
    return slot === undefined ? [] : [slot];
  });
}

/** The measured file, or the reasons it is not an advert for this campaign (advert:one-labelled-still-image). */
export function creativeFile(content: Content, campaign: Campaign, draft: CreativeDraft): { ok: true; file: CreativeFile } | { ok: false; refusals: string[] } {
  const refusals: string[] = [];
  const facts = imageFacts(draft.image);
  if (facts === null) refusals.push("The image is not a PNG, JPEG or WebP (advert:one-labelled-still-image).");
  else if (facts.animated) refusals.push("The image moves; an advert is one still image (advert:one-labelled-still-image).");
  if (facts !== null && !facts.animated) {
    const sized = slotsOf(content, campaign).filter((slot) => slot.width === facts.width && slot.height === facts.height);
    if (sized.length === 0) refusals.push(`The image is ${String(facts.width)} by ${String(facts.height)}, the size of none of the campaign's slots (advert:one-labelled-still-image).`);
    for (const slot of sized) {
      if (draft.image.length > slot.maxBytes) refusals.push(`The image is ${String(draft.image.length)} bytes, over ${slot.id}'s limit of ${String(slot.maxBytes)} (advert:one-labelled-still-image).`);
    }
  }
  if (!LINE.test(draft.text)) refusals.push("The text is one line (advert:tap-opens-advert-card).");
  if (/https?:|www\./i.test(draft.text)) refusals.push("The text carries no link; the one link is its own field (advert:tap-opens-advert-card).");
  refusals.push(...linkRefusals(draft.link));
  const hits = bannedHits(draft.text, draft.link ?? "");
  if (hits.length > 0) refusals.push(`The advert reads as the banned ${hits.join(", ")} (advert:banned-categories-refused).`);
  if (refusals.length > 0 || facts === null) return { ok: false, refusals };
  return { ok: true, file: { format: facts.format, width: facts.width, height: facts.height, bytes: draft.image.length } };
}

/** advert:reviewer-checks-and-records, advert:restricted-categories-need-conditions, advert:real-name-only-by-agreement: what a reviewer records before a campaign is approved. */
export function campaignChecks(campaign: Campaign): string[] {
  const checks = ["registered-business", "category", ...conditionsOf(campaign.category)];
  // Every advertiser shown in Nigeria brings the regulator's approval: the page does not say whether all need it, so all do.
  if (campaign.regions.includes("NG")) checks.push("regulator-approval");
  return checks;
}

/** advert:one-labelled-still-image, advert:tap-opens-advert-card, advert:adverts-never-mimic-the-game, advert:reviewer-checks-and-records: what a reviewer records before a creative is approved. */
export function creativeChecks(creative: Creative): string[] {
  return ["format", "not-game-like", "text", ...(creative.link === null ? [] : ["link-domain"])];
}

/** The checks a review is missing. */
export function missingChecks(required: string[], made: string[]): string[] {
  return required.filter((check) => !made.includes(check));
}
