// A person's words, never words that explain the system (text:bands-not-figures, text:voice-by-surface): never "The
// lift wore off.", "Every free thing is planned", "Funds covered for a month, and now", "Next page on its way" or the
// computer mark shouted as "NOT A PLAYER".
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { markTag } from "../features/city/scene/mark";
import { say } from "../shared/words/text";

/** Lines that read as the system talking, kept out of every table. */
const GONE = ["The lift wore off.", "Every free thing is planned", "Funds covered for a month, and now", "Next page on its way", "Next page any minute now"];

describe("a person's words, never the system's", () => {
  test("[text:bands-not-figures] [text:voice-by-surface] given lines that could read as the system talking, when they are said, then each is a person's words, and none of the system's phrasings is left in any table", () => {
    expect(say("line.quality.told.quality.wellbeing.drift.above")).toBe("The good mood from last month passed.");
    expect(say("ui.activity.full")).toBe("Your free time is full this month");
    expect(say("route.uk-masters.item.held")).toBe("Funds held a full month, and still there");
    const all = Object.values(text);
    for (const old of GONE) expect(all.filter((line) => line.includes(old))).toEqual([]);
  });

  test("[text:bands-not-figures] [person:computer-candidates-labelled] given a person the game plays, when their name's chip carries the mark, then it says Not a player quietly, in a person's case, never in capitals", () => {
    const tag = markTag("computer");
    expect(tag.textContent).toBe("Not a player");
    expect(tag.className).not.toMatch(/\buppercase\b/);
    expect(tag.className).not.toMatch(/text-\[(10|11)px\]/);
  });
});
