// Words that explained the system become a person's words (text.md R-TEXT-005, R-TEXT-007): "The lift
// wore off.", "Every free thing is planned", "Funds covered for a month, and now", "Next page on its way" and the
// computer mark shouted as "NOT A PLAYER".
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { markTag } from "../../features/city/mark";
import { say } from "./text";
import { uiText } from "./ui";

/** Lines that read as the system talking, kept out of every table. */
const GONE = ["The lift wore off.", "Every free thing is planned", "Funds covered for a month, and now", "Next page on its way", "Next page any minute now"];

describe("a person's words, never the system's", () => {
  test("[R-TEXT-005] [R-TEXT-007] given lines that could read as the system talking, when they are said, then each is a person's words, and none of the system's phrasings is left in any table", () => {
    expect(say("line.quality.told.quality.wellbeing.drift.above")).toBe("The good mood from last month passed.");
    expect(say("ui.activity.full")).toBe("Your free time is full this month");
    expect(say("route.uk-masters.item.held")).toBe("Funds held a full month, and still there");
    const all = Object.values({ ...text, ...uiText });
    for (const old of GONE) expect(all.filter((line) => line.includes(old))).toEqual([]);
  });

  test("[R-TEXT-005] [R-PEOPLE-009] given a person the game plays, when their name's chip carries the mark, then it says Not a player quietly, in a person's case, never in capitals", () => {
    const tag = markTag("computer");
    expect(tag.textContent).toBe("Not a player");
    expect(tag.className).not.toMatch(/\buppercase\b/);
    expect(tag.className).not.toMatch(/text-\[(10|11)px\]/);
  });
});
