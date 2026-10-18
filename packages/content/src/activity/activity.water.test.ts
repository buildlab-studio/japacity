// The fish racks at Makoko (activity:fish-racks-at-makoko): work at hand, so a hunt for
// them is almost never "not this time", and the place answers in the racks' own words, not a manager taking a CV.
import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { RACKS } from "./activity.water.data";

describe("the racks as work at hand", () => {
  test("[activity:fish-racks-at-makoko] given the racks, when their hire chance is read, then it is the bar every hunt stops at (activity:job-hunt-lands-offer), so a month's hunt there is rarely refused", () => {
    expect(content.activity[RACKS]?.hireBp).toBe(content.tuning.quality.hireMaxBp);
    expect(content.tuning.quality.hireMaxBp).toBe(9500);
  });

  test("[activity:fish-racks-at-makoko] given a hunt asked at the racks, when the place answers, then the racks have a line of their own, with no CV and no manager, and the hunt's line for other jobs is left as it was", () => {
    const own = text["line.activity.job-hunt.now.job-fish-racks"] ?? "";
    expect(own).not.toBe("");
    expect(own).not.toMatch(/CV|manager|\{/);
    expect(text["line.activity.job-hunt.now"]).toContain("{param}");
  });
});
