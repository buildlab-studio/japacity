// The toasts' own words (docs/rules/text.md R-TEXT-008): one short line each, the shell's, never a paragraph.
import { describe, expect, test } from "vitest";

import { say } from "../../shared/words/text";
import { cityWords } from "./city.words";

describe("the toasts", () => {
  test("[R-TEXT-008] given the interface's own toasts, then each is one short line with no full stop inside or at its end", () => {
    const said = [cityWords("city.ride.turned-back"), say("ui.world.pay-back-paid"), say("ui.remit.sent"), say("ui.remit.sent-later"), say("ui.world.full"), say("ui.route.deposit-paid", { amount: "£1,000" })];
    for (const words of said) {
      expect(words).not.toMatch(/[.?]\s|\.$/);
      expect({ words, short: words.length <= 48 }).toEqual({ words, short: true });
    }
  });
});
