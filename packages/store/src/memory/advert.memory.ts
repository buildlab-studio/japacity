import type { AdvertCount, AdvertReview, AdvertStore, Advertiser, Campaign, Creative } from "../advert.types";
import { accept, copy, refuse } from "./copy.memory";

function versionKey(id: string, version: number): string {
  return `${id}#${String(version)}`;
}

function countKey(row: AdvertCount): string {
  return [String(row.day), row.slot, row.campaign, row.region].join("|");
}

function byCount(a: AdvertCount, b: AdvertCount): number {
  return a.day - b.day || a.slot.localeCompare(b.slot) || a.region.localeCompare(b.region);
}

/** R-ADVERT-020: adverts in maps; reviews in an array that only grows. */
export function memoryAdvertStore(): AdvertStore {
  const advertisers = new Map<string, Advertiser>();
  const campaigns = new Map<string, Campaign>();
  const creatives = new Map<string, Creative>();
  const images = new Map<string, Uint8Array>();
  const reviews: AdvertReview[] = [];
  const counts = new Map<string, AdvertCount>();

  const latest = (id: string): number => Math.max(0, ...[...creatives.values()].filter((row) => row.id === id).map((row) => row.version));

  return {
    addAdvertiser: (row) => {
      if (advertisers.has(row.id)) return Promise.resolve(refuse("exists", `The advertiser ${row.id} exists.`));
      advertisers.set(row.id, copy(row));
      return Promise.resolve(accept(row));
    },
    advertiser: (id) => Promise.resolve(copy(advertisers.get(id) ?? null)),

    addCampaign: (row) => {
      if (campaigns.has(row.id)) return Promise.resolve(refuse("exists", `The campaign ${row.id} exists.`));
      if (!advertisers.has(row.advertiser)) return Promise.resolve(refuse("missing", `No advertiser ${row.advertiser}.`));
      campaigns.set(row.id, copy(row));
      return Promise.resolve(accept(row));
    },
    campaign: (id) => Promise.resolve(copy(campaigns.get(id) ?? null)),
    campaigns: () => Promise.resolve(copy([...campaigns.values()].sort((a, b) => a.id.localeCompare(b.id)))),
    setCampaignStatus: (id, status) => {
      const row = campaigns.get(id);
      if (row === undefined) return Promise.resolve(refuse("missing", `No campaign ${id}.`));
      const next = { ...row, status };
      campaigns.set(id, copy(next));
      return Promise.resolve(accept(next));
    },

    addCreative: (row, image) => {
      if (!campaigns.has(row.campaign)) return Promise.resolve(refuse("missing", `No campaign ${row.campaign}.`));
      const key = versionKey(row.id, row.version);
      if (creatives.has(key)) return Promise.resolve(refuse("exists", `The creative ${row.id} has a version ${String(row.version)}.`));
      const owner = [...creatives.values()].find((each) => each.id === row.id);
      if (owner !== undefined && owner.campaign !== row.campaign) return Promise.resolve(refuse("conflict", `The creative ${row.id} belongs to ${owner.campaign}.`));
      if (row.version !== latest(row.id) + 1) return Promise.resolve(refuse("stale", `The next version of ${row.id} is ${String(latest(row.id) + 1)}.`));
      creatives.set(key, copy(row));
      images.set(key, image.slice());
      return Promise.resolve(accept(row));
    },
    creatives: (campaign) =>
      Promise.resolve(copy([...creatives.values()].filter((row) => row.campaign === campaign).sort((a, b) => a.id.localeCompare(b.id) || a.version - b.version))),
    creative: (id, version) => Promise.resolve(copy(creatives.get(versionKey(id, version)) ?? null)),
    setCreativeStatus: (id, version, status) => {
      const key = versionKey(id, version);
      const row = creatives.get(key);
      if (row === undefined) return Promise.resolve(refuse("missing", `No version ${String(version)} of ${id}.`));
      const next = { ...row, status };
      creatives.set(key, copy(next));
      return Promise.resolve(accept(next));
    },
    image: (id, version) => Promise.resolve(images.get(versionKey(id, version))?.slice() ?? null),

    addReview: (row) => {
      reviews.push(copy(row));
      return Promise.resolve();
    },
    reviews: (creative) => Promise.resolve(copy(reviews.filter((row) => row.creative === creative))),

    addCounts: (rows) => {
      for (const row of rows) {
        const key = countKey(row);
        const held = counts.get(key);
        counts.set(key, held === undefined ? copy(row) : { ...held, impressions: held.impressions + row.impressions, taps: held.taps + row.taps });
      }
      return Promise.resolve();
    },
    counts: (campaign) => Promise.resolve(copy([...counts.values()].filter((row) => row.campaign === campaign).sort(byCount))),
  };
}
