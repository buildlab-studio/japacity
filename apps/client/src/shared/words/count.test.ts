// Counts as a person says them (docs/rules/text.md R-TEXT-005): words up to ten, figures above.
import { describe, expect, test } from "vitest";

import { countWords } from "./count";

describe("counts in words", () => {
  test("[R-TEXT-005] given a count, when it is said, then it is a word up to ten and a figure above", () => {
    expect(countWords(1)).toBe("one");
    expect(countWords(2)).toBe("two");
    expect(countWords(10)).toBe("ten");
    expect(countWords(11)).toBe("11");
  });
});
