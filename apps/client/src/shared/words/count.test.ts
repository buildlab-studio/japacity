// Counts as a person says them (docs/rules/text.md R-TEXT-005), as the Calendar's free time says
// what is left: words up to ten, figures above, and never a slot total.
import { describe, expect, test } from "vitest";

import { freeTimeWords } from "../../features/turn/turn.words";
import { countWords } from "./count";

describe("counts in words", () => {
  test("[R-TEXT-005] given free time left beside what is started, when the line is said, then the count is a word and no slot total shows", () => {
    expect(freeTimeWords(1, 3)).toBe("Free time: two left");
    expect(freeTimeWords(1, 2)).toBe("Free time: one left");
    expect(freeTimeWords(1, 3)).not.toMatch(/\d| of /);
    expect(countWords(10)).toBe("ten");
    expect(countWords(11)).toBe("11");
  });
});
