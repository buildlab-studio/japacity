// The shell's own lines told in the bottom corner (text:show-then-tell, world:street-talk-budget): one short line
// each, a fact and never a paragraph; full sentences in the corner belong to the world (Mama's oranges), not the shell.
import { describe, expect, test } from "vitest";

import { say } from "../../shared/words/text";
import { cityWords } from "./city.words";

describe("the shell's told lines", () => {
  test("[text:show-then-tell] given the interface's own lines told in the corner, then each is one short line with no full stop inside or at its end", () => {
    const said = [cityWords("city.ride.turned-back"), say("ui.world.pay-back-paid"), say("ui.remit.sent"), say("ui.remit.sent-later"), say("ui.world.full"), say("ui.route.deposit-paid", { amount: "£1,000" }), cityWords("city.told.light-paid")];
    for (const words of said) {
      expect(words).not.toMatch(/[.?]\s|\.$/);
      expect({ words, short: words.length <= 48 }).toEqual({ words, short: true });
    }
  });
});
