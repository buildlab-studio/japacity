// The savings circle in the Bank's Lately (world:phone-holds-what-phones-hold): a share
// paid in reads as the circle, never as going out, and the pot as the circle paying you, never as a gift.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, openOffer } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { words } from "../../../shared/words/text";
import { latelyLines } from "./Bank";

describe("the savings circle in the Bank", () => {
  test("[world:phone-holds-what-phones-hold] given Tunde in the circle, when the month of the pot ends, then Lately says the circle's share and the circle paying him, never going out or a gift", () => {
    const game = newGame("scenario.banker");
    const circle = openOffer(game, "offer.join-ajo");
    game.accept({ type: "offer/choose", offer: circle.id, choice: "join" });
    let potMonth: ReportLine[] | null = null;
    for (let month = 0; month < 10 && potMonth === null; month += 1) {
      if (game.state.turn.banked < 1) game.grant(content.tuning.turn.cap);
      const lines = game.endTurn().lines;
      if (lines.some((line) => line.key === "line.obligation.pot")) potMonth = lines;
    }
    if (potMonth === null) throw new Error("The pot did not come within ten months.");
    const pot = potMonth.find((line) => line.key === "line.obligation.pot");
    const share = content.obligation["obligation.ajo"]?.amount ?? 0;
    const bank = latelyLines({ report: { month: 0, lines: potMonth, japacityBefore: null, japacityAfter: null, attention: false } }, [], []).map((line) => words(line.key, line.params));
    expect(bank).toContain(words(pot?.key ?? "", pot?.params));
    expect(bank).toContain(`Savings circle: ${formatMoney(share, "NGN")}.`);
    expect(bank.some((line) => line.startsWith("A gift lands") || line.startsWith("Spent going out"))).toBe(false);
  });
});
