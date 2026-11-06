// A count in words that opens a sentence starts with a capital (text:bands-not-figures): counts are said in words up to ten, and a
// filled word at the start of a line, or after a full stop, is written as a sentence's first word, wherever it is filled in.
import { describe, expect, test } from "vitest";

import { countWords } from "./count";
import { fill, say, words } from "./text";

describe("a filled count that opens a sentence", () => {
  test("[text:bands-not-figures] given the giver's toast, when a count in words opens a sentence, then it starts with a capital", () => {
    expect(countWords(2)).toBe("two");
    expect(say("chapter.brief.toast.more", { left: countWords(2) })).toBe("One don enter. Two more to go.");
    expect(words("chapter.brief.toast.more", { left: countWords(3) })).toBe("One don enter. Three more to go.");
    expect(fill("{count} left.", { count: "two" })).toBe("Two left.");
  });

  test("[text:bands-not-figures] given a count in words filled mid-sentence or into a fragment, when the line is said, then it stays in lower case", () => {
    expect(say("ui.time.years", { count: countWords(2) })).toBe("two years");
    expect(say("ui.for-months", { count: countWords(3) })).toBe("for three more months");
    expect(fill("You have {count} left.", { count: "two" })).toBe("You have two left.");
    expect(fill("Done. {count} left.", { count: "two" })).toBe("Done. Two left.");
  });
});
