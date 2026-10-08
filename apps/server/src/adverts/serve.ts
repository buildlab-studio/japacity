// R-ADVERT-008: which campaign fills each slot, from the slot, the region and
// the hour alone. Everyone in a region sees the same campaign in a slot for the
// whole hour; nothing about the player is read.
import type { AdvertSlotEntry, Id } from "@japacity/sim";
import { hashString32, int, time } from "@japacity/sim";
import type { Campaign, Creative } from "@japacity/store";

import type { ServerDeps } from "../deps";
import { statusAt } from "./campaign";

export type AdvertsDeps = Pick<ServerDeps, "stores" | "contents">;

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

export interface AdvertsReply {
  ok: true;
  region: string;
  hour: number;
  /** When the next hour starts, in milliseconds since 1970. */
  until: number;
  slots: Partial<Record<Id<"advert">, ServedAdvert>>;
}

export function hourOf(at: number): number {
  return int.divFloor(at, time.HOUR_MS);
}

export function imagePath(creative: Creative): string {
  return `/api/adverts/image/${encodeURIComponent(creative.id)}/${String(creative.version)}`;
}

/** The newest approved version of each creative. Older approved versions stay until a newer one is approved (R-ADVERT-011). */
export function approvedCreatives(creatives: Creative[]): Creative[] {
  const newest = new Map<string, Creative>();
  for (const creative of creatives) {
    const held = newest.get(creative.id);
    if (creative.status === "approved" && (held === undefined || creative.version > held.version)) newest.set(creative.id, creative);
  }
  return [...newest.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function fits(creative: Creative, slot: AdvertSlotEntry): boolean {
  return creative.file.width === slot.width && creative.file.height === slot.height && creative.file.bytes <= slot.maxBytes;
}

interface Candidate {
  campaign: Campaign;
  creatives: Creative[];
}

/** The live campaigns for a region at a moment, each with its approved creatives, by campaign id. */
export async function liveCandidates(deps: AdvertsDeps, region: string, at: number): Promise<Candidate[]> {
  const live = (await deps.stores.adverts.campaigns()).filter((campaign) => statusAt(campaign, at) === "live" && campaign.regions.includes(region));
  const candidates: Candidate[] = [];
  for (const campaign of live) candidates.push({ campaign, creatives: approvedCreatives(await deps.stores.adverts.creatives(campaign.id)) });
  return candidates;
}

/** The reply with no slot filled: the hour and the region only. */
export function emptyReply(region: string, at: number): AdvertsReply {
  const hour = hourOf(at);
  return { ok: true, region, hour, until: (hour + 1) * time.HOUR_MS, slots: {} };
}

/** R-ADVERT-008: the hour's campaign per slot for a region. */
export async function servedAt(deps: AdvertsDeps, region: string, at: number): Promise<AdvertsReply> {
  const reply = emptyReply(region, at);
  const { hour } = reply;
  const candidates = await liveCandidates(deps, region, at);
  const names = new Map<string, string>();
  for (const slot of Object.values(deps.contents.current.advert).sort((a, b) => a.id.localeCompare(b.id))) {
    const fitting = candidates.flatMap(({ campaign, creatives }) => {
      const creative = campaign.slots.includes(slot.id) ? creatives.find((each) => fits(each, slot)) : undefined;
      return creative === undefined ? [] : [{ campaign, creative }];
    });
    if (fitting.length === 0) continue;
    const turn = hour + hashString32(slot.id);
    const chosen = fitting[turn - int.divFloor(turn, fitting.length) * fitting.length];
    if (chosen === undefined) continue;
    const { campaign, creative } = chosen;
    if (!names.has(campaign.advertiser)) names.set(campaign.advertiser, (await deps.stores.adverts.advertiser(campaign.advertiser))?.businessName ?? "");
    reply.slots[slot.id] = {
      campaign: campaign.id,
      creative: creative.id,
      version: creative.version,
      image: imagePath(creative),
      width: creative.file.width,
      height: creative.file.height,
      advertiser: names.get(campaign.advertiser) ?? "",
      text: creative.text,
      link: creative.link,
    };
  }
  return reply;
}
