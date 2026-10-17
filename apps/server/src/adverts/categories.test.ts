import { content } from "@japacity/content";
import type { Campaign } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import { campaignChecks, campaignRefusals, creativeFile } from "./campaign";
import type { CampaignDraft } from "./campaign";
import { BANNED, RESTRICTED, bannedHits } from "./categories";
import { pngOf } from "./testing";

const DRAFT: CampaignDraft = { advertiser: "advertiser-1", slots: ["advert.road-billboard"], regions: ["GB"], starts: 0, ends: 1, category: "general", place: null };
const CAMPAIGN: Campaign = { ...DRAFT, id: "campaign-1", slots: ["advert.road-billboard"], status: "pending" };

/** One plain sentence per banned category, written as an advertiser might. */
const SAMPLES: Record<string, string> = {
  loans: "Quick cash loan in five minutes.",
  gambling: "Place your bet tonight.",
  schemes: "Double your money with crypto.",
  "visa-guarantees": "Guaranteed visa for Canada.",
  "alcohol-tobacco": "Cold beer at the junction.",
  medicines: "Herbal cure for everything.",
  dating: "Meet singles on our dating line.",
  "politics-religion": "Vote for change on Saturday.",
  "weapons-counterfeit": "Replica watches, cheap.",
  "other-games": "Play our new game today.",
  impersonation: "Credit alert: your account has been paid.",
};

describe("the banned categories", () => {
  test("[R-ADVERT-015] given the page's banned list, when the data is read, then it has its eleven rows, each with words, and a sample for each", () => {
    expect(BANNED.map((category) => category.key)).toEqual(Object.keys(SAMPLES));
    expect(BANNED.every((category) => category.words.length > 0)).toBe(true);
  });

  for (const category of BANNED) {
    test(`[R-ADVERT-015] given the banned category ${category.key}, when a campaign declares it or a creative's text reads as it, then each is refused whatever it pays`, () => {
      expect(campaignRefusals(content, productionConfig.advert.regions, { ...DRAFT, category: category.key })).toEqual([`${category.key} is a banned category, refused whatever it pays (R-ADVERT-015).`]);
      const sample = SAMPLES[category.key] ?? "";
      expect(bannedHits(sample)).toContain(category.key);
      const measured = creativeFile(content, CAMPAIGN, { image: pngOf(1024, 512), text: sample, link: null });
      expect(measured.ok).toBe(false);
    });
  }

  test("[R-ADVERT-015] given plain words that only contain a banned word inside another, when they are screened, then nothing is hit", () => {
    expect(bannedHits("Better jollof, Gbagada.", "https://example.com/menu", "Fresh bread from the bakery.")).toEqual([]);
    expect(creativeFile(content, CAMPAIGN, { image: pngOf(1024, 512), text: "Better jollof, Gbagada.", link: "https://example.com/menu" }).ok).toBe(true);
  });

  test("[R-ADVERT-015] given a category on neither list, when a campaign declares it, then it is refused", () => {
    expect(campaignRefusals(content, productionConfig.advert.regions, { ...DRAFT, category: "anything" })).toEqual(["anything is not a category on the list (R-ADVERT-015, R-ADVERT-016)."]);
  });
});

describe("the restricted categories", () => {
  const CONDITIONS: Record<string, string[]> = {
    "immigration-advice": ["adviser-registered", "no-result-promise", "no-proof-of-funds"],
    "money-transfer": ["licensed-each-region", "no-credit-product"],
    education: ["accredited-institution", "no-charging-agent", "no-score-or-visa-promise"],
    travel: ["no-visa-claim"],
    telco: ["no-prize-or-promo"],
    "named-place": ["place-agreement"],
  };

  for (const category of RESTRICTED) {
    test(`[R-ADVERT-016] given the restricted category ${category.key}, when its campaign is checked, then it is taken for review and its approval needs its conditions recorded`, () => {
      const place = category.key === "named-place" ? { place: "place.yaba-hub" as const, name: "Realname Hub", sign: "REALNAME HUB" } : null;
      expect(campaignRefusals(content, productionConfig.advert.regions, { ...DRAFT, category: category.key, place })).toEqual([]);
      expect(campaignChecks({ ...CAMPAIGN, category: category.key })).toEqual(["registered-business", "category", ...(CONDITIONS[category.key] ?? ["missing from the test"])]);
    });
  }

  test("[R-ADVERT-016] given a named place outside the named-place category, or that category with no place, when the campaign is checked, then it is refused", () => {
    const reason = "A named place, and only a named place, is in the category named-place (R-ADVERT-016).";
    expect(campaignRefusals(content, productionConfig.advert.regions, { ...DRAFT, category: "named-place" })).toEqual([reason]);
    expect(campaignRefusals(content, productionConfig.advert.regions, { ...DRAFT, place: { place: "place.yaba-hub", name: "A", sign: "A" } })).toEqual([reason]);
  });
});
