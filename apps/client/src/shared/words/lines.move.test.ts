// The move to Makoko told once, with its rent (home:move-home-once-a-month, world:month-end-results-sheet): never
// "Living costs: ₦25,000." for the move and again at the month's end on the results and the Bank, and never News
// with only "Home is Makoko now."
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { applyEffects } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { nowLineWords } from "./acts";
import { formatMoney } from "./format";
import { moneyLines } from "./money";
import { newsLines } from "./told";
import { nameOf } from "./text";

const MAKOKO = "place.makoko" as const;
const rent = content.tuning.home.makokoUpkeep;
/** What the move says: where home is now and what it costs a month. */
const MOVED = `Home is ${nameOf(MAKOKO)} now: ${formatMoney(rent, "NGN")} a month.`;

function told(lines: readonly ReportLine[]): string[] {
  return moneyLines(lines).map(({ line, sign }) => `${sign > 0 ? "+" : "-"} ${nowLineWords(line)}`);
}

describe("the move to Makoko, told once", () => {
  test("[home:move-home-once-a-month] [world:month-end-results-sheet] given Tunde moves to Makoko from the phone, when the month ends, then the results' money says the move once with its rent, no living costs come again at the month's end, and News says the same line once", () => {
    const game = newGame("scenario.tunde");
    const mid = game.accept({ type: "home/move", to: MAKOKO }).lines;
    const end = game.endTurn().lines;
    const money = told([...mid, ...end]);
    expect(money.filter((said) => said === `- ${MOVED}`)).toHaveLength(1);
    expect(money.filter((said) => said.includes(formatMoney(rent, "NGN")))).toEqual([`- ${MOVED}`]);
    const news = newsLines(mid, end, game.view()).map((line) => nowLineWords(line));
    expect(news.filter((said) => said.startsWith(`Home is ${nameOf(MAKOKO)}`))).toEqual([MOVED]);
    expect(news.join(" ")).not.toContain("line.obligation");
  });

  test("[home:move-home-once-a-month] [home:taken-in-after-eviction] given a guest's where-next answered makoko, when the month's lines are told, then the rent the answer paid is the move's line", () => {
    const game = newGame("scenario.tunde");
    applyEffects(game, [{ type: "offer/open", offer: "offer.where-next" }]);
    const offer = game.view().offers.find((candidate) => candidate.entry === "offer.where-next");
    if (offer === undefined) throw new Error("Where next did not open.");
    const mid = game.accept({ type: "offer/choose", offer: offer.id, choice: "makoko" }).lines;
    expect(told(mid)).toEqual([`- ${MOVED}`]);
  });

  test("[home:move-home-once-a-month] given Tunde in Makoko moving back to the family house, when the lines are told, then the move says only where home is: no money moved", () => {
    const game = newGame("scenario.tunde");
    game.accept({ type: "home/move", to: MAKOKO });
    game.endTurn();
    const back = game.accept({ type: "home/move", to: "place.family-house" }).lines;
    expect(told(back)).toEqual([]);
    expect(newsLines(back, [], game.view()).map((line) => nowLineWords(line))).toContain(`Home is ${nameOf("place.family-house")} now.`);
  });
});
