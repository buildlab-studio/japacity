// The nudge on landing (docs/rules/world.md R-WORLD-003): when the month's
// news is in abroad and the month's dues pass the country's money held, the nudge's report line says
// the gap, and a tap on it opens the Bank, where the way to close it waits.
import { describe, expect, test } from "vitest";

import { recordedGame, setPockets } from "../../shared/testing/fixtures";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { nudgeOf } from "./nudge";

/** Ada landed in London with the family's send-off answered, as the review played it: nothing asks but the month's news. */
function landed(): Game {
  const game = recordedGame("ada-careful");
  // Each open offer answered with its last choice, the one that says no (the send-off's skip, the ajo's no).
  for (const offer of game.view().offers) game.accept({ type: "offer/choose", offer: offer.id, choice: offer.choices.at(-1)?.id ?? "skip" });
  return game;
}

describe("the nudge on the month's dues abroad", () => {
  test("[R-WORLD-003] given Ada landed in London with the month's news in and £4,687 due against £1,124 held, when the nudge is chosen, then its report line says the gap and is about the money", () => {
    const view = landed().view();
    expect(view.offers).toEqual([]);
    expect(view.chapter.items.every((item) => item.met)).toBe(true);
    const nudge = nudgeOf(view);
    expect(nudge).toEqual({ key: "ui.nudge.dues", params: { due: formatMoney(468_667, "GBP"), held: formatMoney(view.pockets.GBP.bank, "GBP") }, about: "dues" });
    expect(say(nudge.key, nudge.params)).toBe("Only £1,124 held for £4,687 due this month");
  });

  test("[R-WORLD-003] given the pounds held cover the month's dues, when the nudge is chosen, then it is the month's news as before", () => {
    const game = landed();
    const due = game.view().obligations.reduce((sum, owed) => sum + owed.due, 0);
    setPockets(game, { GBP: due });
    expect(nudgeOf(game.view())).toEqual({ key: "ui.nudge.report", about: "report" });
  });

  test("[R-WORLD-003] given the gap's nudge, then it is one sentence of at most eight words", () => {
    const words = say("ui.nudge.dues", { due: "£4,687", held: "£1,124" });
    expect(words.split(/\s+/).length).toBeLessThanOrEqual(8);
    expect(words.split(". ")).toHaveLength(1);
  });
});
