// The "Find work" sheet for a trader from sixteen: her chapter opens on the settlement and
// lists her own steps, never the graduate's service year. Real content, real draws.
import { text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { answersInOrder, archetypeOf, presetAnswer } from "../../shared/frontdoor/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { sixteenPath } from "../../shared/words/sixteen";
import { ChapterView } from "./ChapterView";

const FIRST_CHAPTER = "chapter.find-your-feet";

/** A trader from the tile on the first seed whose master settled her. */
function settledTraderView() {
  const trader = archetypeOf("trader")!;
  for (let at = 0; at < 30; at += 1) {
    const game = newGame("scenario.prologue", `trader-${String(at)}`);
    for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
      const prologue = game.view().prologue!;
      const answer = presetAnswer(trader, prologue) ?? answersInOrder(trader, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
      game.accept({ type: "prologue/choose", step: prologue.step, answer: answer! });
    }
    // A month of living costs, so the sheet is read with the settlement already under its full sum.
    game.endTurn([{ activity: "activity.ask-around", param: null }]);
    if (sixteenPath(game.view()) === "capital") return game.view();
  }
  throw new Error("No settled trader in thirty seeds.");
}

describe("the trader's chapter sheet", () => {
  test("[activity:trader-opens-own-shop] [prologue:tile-path-open-from-start] [chapter:items-are-live-requirements] given a trader with the settlement a month in, when her chapter sheet opens, then it opens on the settlement, lists her steps in her words, and never says the service year", async () => {
    const view = settledTraderView();
    await renderWithView(<ChapterView />, view);
    expect(screen.getByText(text[`${FIRST_CHAPTER}.open.prologue.capital`]!)).toBeDefined();
    for (const item of view.chapter.items) expect(screen.getByText(text[`${FIRST_CHAPTER}.item.${item.id}.capital`]!)).toBeDefined();
    expect(document.body.textContent).not.toMatch(/service year|allowance/i);
  });

  test("[activity:trader-opens-own-shop] [chapter:items-are-live-requirements] given a fixed life, when its chapter sheet opens, then it opens on the life's own line", async () => {
    const view = newGame("scenario.tunde").view();
    await renderWithView(<ChapterView />, view);
    expect(screen.getByText(text[`${FIRST_CHAPTER}.open.tunde`]!)).toBeDefined();
    expect(screen.getByText(text[`${FIRST_CHAPTER}.item.job`]!)).toBeDefined();
  });
});
