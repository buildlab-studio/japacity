// The Bank's last month counts a job's pay told in its own words (wallet:passbook-against-plan-cost, activity:catch-drawn-each-month):
// the crew's share, led by the catch's word on the results, is money in beside the nets' pay. Played on the real engine.
import { content } from "@japacity/content";
import { type Game, playPrologueBy, start } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { Bank } from "./Bank";

/** The child of the water's tile: commerce at school, work after it, the counter's savings, and the room on the lagoon. */
const WATER = ["begin", "commercial", "work", "save", "makoko"];

function credited(lines: readonly { key: string; params: Record<string, unknown> }[], keys: readonly string[]): number {
  return lines.filter((line) => keys.includes(line.key)).reduce((sum, line) => sum + (line.params["amount"] as { amount: number }).amount, 0);
}

describe("the crew's share in the Bank", () => {
  test("[wallet:passbook-against-plan-cost] [activity:catch-drawn-each-month] given a month third in Sewanu's canoe with the nets beside it, when the Bank opens, then last month's money in is the catch's share and the nets' pay together", async () => {
    const game: Game = start({ content, scenario: "scenario.prologue", seed: "bank-catch-1" });
    playPrologueBy(game, WATER);
    game.accept({ type: "activity/now", activity: "activity.ask-fisherman", param: null });
    const offer = game.view().offers.find((each) => each.entry === "offer.canoe-place");
    if (offer === undefined) throw new Error("Sewanu offered no place.");
    game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
    game.accept({ type: "activity/now", activity: "activity.take-net-work", param: null });
    game.grant(game.content.tuning.turn.cap);
    const { lines } = game.endTurn();
    // The wallet's own lines of the month's pay: the share as salary, the nets as side work.
    const paid = credited(lines, ["line.wallet.salary", "line.wallet.gig"]);
    expect(paid).toBeGreaterThan(credited(lines, ["line.wallet.gig"]));
    const view = game.view();
    await renderWithView(<Bank />, view);
    const chip = document.querySelector<HTMLElement>('[data-last-month-chip="in"]');
    expect(chip?.textContent).toBe(say("passbook.in", { amount: formatMoney(paid, "NGN") }));
  });
});
