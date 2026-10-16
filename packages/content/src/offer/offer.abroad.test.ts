// Which asks abroad count as news for Until news (docs/rules/world.md R-WORLD-028): the small ones that
// need no answer this month are marked `news: false` and lapse by themselves (R-OFFER-005); a money
// ask, the family's, the status clocks and the credit file stay news.
import type { OfferEntry } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content } from "../index";

const entries: OfferEntry[] = Object.values(content.offer);
const small = entries.filter((entry) => entry.news === false);

describe("the small asks abroad", () => {
  test("[R-WORLD-028] given the offers in content, then the market finds on the street abroad are the small asks, and nothing else is", () => {
    // Calgary's and Castel Volturno's finds joined the UK's and the UAE's on their pattern (16 Oct 2026, design page 15).
    expect(small.map((entry) => entry.id).sort()).toEqual(["offer.street-find-ca", "offer.street-find-it", "offer.street-find-uae", "offer.street-find-uk"]);
  });

  test("[R-WORLD-028] given every small ask, then it is met only abroad and no answer to it costs anything", () => {
    for (const entry of small) {
      expect(entry.where).toBe("abroad");
      expect(entry.group).toBe("life");
      const debits = entry.choices.flatMap((choice) => choice.effects).filter((effect) => effect.type === "money/take" || effect.type === "money/pay-fee");
      expect(debits).toEqual([]);
    }
  });

  test("[R-WORLD-028] given the family's asks, the money asks, the job, the status and the credit file's asks, then none is a small ask", () => {
    const kept = entries.filter((entry) => ["family", "money", "job", "abroad", "return", "road"].includes(entry.group));
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.filter((entry) => entry.news === false)).toEqual([]);
  });

  test("[R-OFFER-005] [R-WORLD-028] given every small ask, then it lapses by itself in a month: into nothing, or into a choice of its own", () => {
    for (const entry of small) {
      expect(entry.expiresAfter).toBe(1);
      expect([null, ...entry.choices.map((choice) => choice.id)]).toContain(entry.onExpire);
    }
  });
});
