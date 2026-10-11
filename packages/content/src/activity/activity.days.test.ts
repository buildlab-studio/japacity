import { describe, expect, test } from "vitest";

import { content } from "../index";

describe("the time a now-act spends", () => {
  test("[R-ACTIVITY-018] given every now-act that is not a purchase, when content is built, then each spends between a morning and a week", () => {
    let seen = 0;
    for (const entry of Object.values(content.activity)) {
      if (entry.when !== "now" || entry.purchase === true) continue;
      seen += 1;
      const halfDays = entry.halfDays ?? 0;
      expect(halfDays >= 1 && halfDays <= 10, `${entry.id} spends ${String(halfDays)}`).toBe(true);
    }
    expect(seen).toBeGreaterThan(40);
  });

  test("[R-ACTIVITY-018] given a purchase or a month-act, when content is built, then it spends no time", () => {
    expect(content.activity["activity.play-lotto"]?.halfDays).toBeUndefined();
    expect(content.activity["activity.interview-prep"]?.halfDays).toBeUndefined();
  });

  test("[R-ACTIVITY-018] given the passport office and the cooking corner, when content is built, then the office takes a weekend and cooking a morning", () => {
    expect(content.activity["activity.get-passport"]?.halfDays).toBe(4);
    expect(content.activity["activity.cook-at-home"]?.halfDays).toBe(1);
  });
});
