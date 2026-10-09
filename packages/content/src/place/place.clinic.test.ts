// The clinic as one workplace (world.md R-WORLD-002, R-WORLD-015): the nurse from sixteen
// works where the visa's TB test is taken, so its name, its line and its talk hold both sides, never the test alone.
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

const CLINIC = "place.tb-clinic";

function overheard(place: string): string[] {
  const lines: string[] = [];
  for (let n = 1; text[`${place}.overheard.${String(n)}`] !== undefined; n += 1) lines.push(text[`${place}.overheard.${String(n)}`] ?? "");
  return lines;
}

describe("the clinic", () => {
  test("[R-WORLD-002] [R-WORLD-015] given the clinic that stages both the TB test and the staff nurse's job, when its name and line are read, then the name is the clinic alone and the line holds the test and the ward", () => {
    expect(content.place[CLINIC]?.stages).toEqual(expect.arrayContaining(["activity.tb-test", "activity.job-nurse"]));
    expect(text[`${CLINIC}.name`]).toBe("the clinic");
    expect(text[`${CLINIC}.blurb`]).toBe("The TB test on one side, the ward on the other.");
  });

  test("[R-WORLD-002] [R-WORLD-015] given the clinic, when its talk is read, then the ward's is heard beside the test's", () => {
    const lines = overheard(CLINIC);
    expect(lines).toContain("Breathe in and hold. Thank you.");
    expect(lines).toContain("Ward three is short tonight.");
    expect(lines.filter((line) => /ward|matron|handover|nights/i.test(line)).length).toBeGreaterThanOrEqual(2);
  });
});
