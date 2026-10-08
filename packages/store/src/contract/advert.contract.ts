import { describe, expect, test } from "vitest";

import type { AdvertCount, AdvertReview, AdvertStore, Advertiser, Campaign, Creative } from "../advert.types";

const ADVERTISER: Advertiser = {
  id: "advertiser-1",
  businessName: "Mama Put Kitchen",
  registration: { country: "NG", number: "RC-1234567" },
  contactName: "A. Contact",
  contactEmail: "contact@example.com",
};

function campaign(id: string, over: Partial<Campaign> = {}): Campaign {
  return {
    id,
    advertiser: ADVERTISER.id,
    slots: ["advert.road-billboard", "advert.phone-tile"],
    regions: ["NG", "GB"],
    starts: 1_000,
    ends: 9_000,
    status: "pending",
    category: "local-business",
    place: null,
    ...over,
  };
}

function creative(id: string, version: number, over: Partial<Creative> = {}): Creative {
  return {
    id,
    campaign: "campaign-1",
    file: { format: "png", width: 1024, height: 512, bytes: 3 },
    text: "Jollof on the island.",
    link: "https://example.com/menu",
    version,
    status: "pending",
    ...over,
  };
}

function review(version: number, outcome: AdvertReview["outcome"]): AdvertReview {
  return { creative: "creative-1", version, reviewer: "account.owner", at: 5_000 + version, checks: ["registered-business", "link-domain"], bannedListVersion: "2026-10-08", outcome, note: "" };
}

function count(day: number, slot: AdvertCount["slot"], impressions: number, taps: number, region = "NG"): AdvertCount {
  return { day, slot, campaign: "campaign-1", region, impressions, taps };
}

async function seeded(make: () => Promise<AdvertStore>): Promise<AdvertStore> {
  const store = await make();
  await store.addAdvertiser(ADVERTISER);
  await store.addCampaign(campaign("campaign-1"));
  return store;
}

/** The contract every AdvertStore keeps. `make` returns an empty store each time it is called. */
export function suiteForAdvertStore(make: () => Promise<AdvertStore>): void {
  describe("AdvertStore contract", () => {
    test("[R-ADVERT-020] given an advertiser and a campaign, when they are read back, then they are as stored, and a second with the same id or an unknown advertiser is refused", async () => {
      const store = await seeded(make);
      expect(await store.advertiser(ADVERTISER.id)).toEqual(ADVERTISER);
      expect(await store.advertiser("nobody")).toBeNull();
      expect(await store.campaign("campaign-1")).toEqual(campaign("campaign-1"));
      expect(await store.addAdvertiser(ADVERTISER)).toMatchObject({ ok: false, code: "exists" });
      expect(await store.addCampaign(campaign("campaign-1"))).toMatchObject({ ok: false, code: "exists" });
      expect(await store.addCampaign(campaign("campaign-2", { advertiser: "nobody" }))).toMatchObject({ ok: false, code: "missing" });
      const named = campaign("campaign-0", { place: { place: "place.yaba-hub", name: "Real Name", sign: "REAL NAME" } });
      expect(await store.addCampaign(named)).toEqual({ ok: true, value: named });
      expect((await store.campaigns()).map((row) => row.id)).toEqual(["campaign-0", "campaign-1"]);
    });

    test("[R-ADVERT-020] given a campaign, when its status is set, then it reads back so, and an unknown campaign is refused", async () => {
      const store = await seeded(make);
      expect(await store.setCampaignStatus("campaign-1", "paused")).toEqual({ ok: true, value: campaign("campaign-1", { status: "paused" }) });
      expect((await store.campaign("campaign-1"))?.status).toBe("paused");
      expect(await store.setCampaignStatus("campaign-9", "paused")).toMatchObject({ ok: false, code: "missing" });
    });

    test("[R-ADVERT-011] given a creative, when a change is stored, then it is the next version beside the first, each with its own image, and no version is skipped or stored twice", async () => {
      const store = await seeded(make);
      expect(await store.addCreative(creative("creative-1", 1), new Uint8Array([1, 2, 3]))).toEqual({ ok: true, value: creative("creative-1", 1) });
      expect(await store.addCreative(creative("creative-1", 3), new Uint8Array([9]))).toMatchObject({ ok: false, code: "stale" });
      expect(await store.addCreative(creative("creative-1", 1), new Uint8Array([9]))).toMatchObject({ ok: false, code: "exists" });
      expect(await store.addCreative(creative("creative-1", 2, { text: "Changed." }), new Uint8Array([4, 5]))).toMatchObject({ ok: true });
      expect(await store.addCreative(creative("creative-9", 1, { campaign: "campaign-9" }), new Uint8Array([1]))).toMatchObject({ ok: false, code: "missing" });
      expect((await store.creatives("campaign-1")).map((row) => [row.id, row.version, row.text])).toEqual([
        ["creative-1", 1, "Jollof on the island."],
        ["creative-1", 2, "Changed."],
      ]);
      expect([...((await store.image("creative-1", 1)) ?? [])]).toEqual([1, 2, 3]);
      expect([...((await store.image("creative-1", 2)) ?? [])]).toEqual([4, 5]);
      expect(await store.image("creative-1", 3)).toBeNull();
      expect(await store.creative("creative-1", 2)).toEqual(creative("creative-1", 2, { text: "Changed." }));
    });

    test("[R-ADVERT-011] given a creative of one campaign, when another campaign stores the same id, then it is refused", async () => {
      const store = await seeded(make);
      await store.addCampaign(campaign("campaign-2"));
      await store.addCreative(creative("creative-1", 1), new Uint8Array([1]));
      expect(await store.addCreative(creative("creative-1", 2, { campaign: "campaign-2" }), new Uint8Array([1]))).toMatchObject({ ok: false, code: "conflict" });
    });

    test("[R-ADVERT-010] given a version, when its status is set, then only that version changes, and an unknown version is refused", async () => {
      const store = await seeded(make);
      await store.addCreative(creative("creative-1", 1), new Uint8Array([1]));
      await store.addCreative(creative("creative-1", 2), new Uint8Array([2]));
      expect(await store.setCreativeStatus("creative-1", 1, "approved")).toEqual({ ok: true, value: creative("creative-1", 1, { status: "approved" }) });
      expect((await store.creatives("campaign-1")).map((row) => row.status)).toEqual(["approved", "pending"]);
      expect(await store.setCreativeStatus("creative-1", 7, "approved")).toMatchObject({ ok: false, code: "missing" });
    });

    test("[R-ADVERT-010] given reviews, when they are listed, then they come back in the order they were added, whole, and a caller's change to one does not reach the store", async () => {
      const store = await seeded(make);
      const first = review(1, "refused");
      await store.addReview(first);
      await store.addReview(review(2, "approved"));
      await store.addReview({ ...review(1, "approved"), creative: "creative-2" });
      first.checks.push("changed");
      const listed = await store.reviews("creative-1");
      expect(listed).toEqual([review(1, "refused"), review(2, "approved")]);
      listed[0]?.checks.pop();
      expect(await store.reviews("creative-1")).toEqual([review(1, "refused"), review(2, "approved")]);
    });

    test("[R-ADVERT-020] given counts for the same day, slot, campaign and region, when they are added, then they sum into one row, and other keys stay apart", async () => {
      const store = await seeded(make);
      await store.addCounts([count(20_000, "advert.road-billboard", 3, 1), count(20_000, "advert.phone-tile", 2, 0)]);
      await store.addCounts([count(20_000, "advert.road-billboard", 4, 2), count(20_001, "advert.road-billboard", 1, 0), count(20_000, "advert.road-billboard", 1, 0, "GB")]);
      await store.addCounts([{ ...count(20_000, "advert.road-billboard", 5, 5), campaign: "campaign-2" }]);
      expect(await store.counts("campaign-1")).toEqual([
        count(20_000, "advert.phone-tile", 2, 0),
        count(20_000, "advert.road-billboard", 1, 0, "GB"),
        count(20_000, "advert.road-billboard", 7, 3),
        count(20_001, "advert.road-billboard", 1, 0),
      ]);
      expect(await store.counts("campaign-9")).toEqual([]);
    });
  });
}
