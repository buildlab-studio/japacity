// What cooking and fetching water saved (docs/rules/obligation.md R-OBLIGATION-014), played on the
// real engine: the results tell each as its own story line in its own words, with the figure it took
// off the upkeep, while the money count keeps the upkeep as it was paid.
import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { act } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { bp } from "../../../../../packages/sim/src/engine/int";
import { slot } from "../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { moneyLines, storyLines } from "./month.results";
import { Results } from "./Results";

const { room } = content.tuning;

async function showResults(game: Game, lines: ReportLine[]) {
  const view = game.view();
  const { store } = await renderWithView(<Results place="Home" />, { ...view, report: { month: view.month, lines, japacityBefore: null, japacityAfter: null, attention: false } });
  act(() => store.setState({ reportOpen: true }));
}

function storyTexts(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[data-results-story] li")].map((row) => row.textContent);
}

describe("the room's basics on the results", () => {
  test("[R-OBLIGATION-014] given Ada cooking and fetching water in one month, when the results show, then each saving is its own story line in its own words with its figure, and neither is counted as money in", async () => {
    const game = newGame("scenario.ada");
    const due = game.view().obligations.find((owed) => owed.entry === "obligation.upkeep")?.due ?? 0;
    const { lines } = game.endTurn([slot("activity.cook-at-home"), slot("activity.fetch-water")]);
    expect(storyLines(lines).map((line) => line.key)).toEqual(expect.arrayContaining(["line.obligation.relief.cook-at-home", "line.obligation.relief.fetch-water"]));
    expect(moneyLines(lines).filter(({ line }) => line.key.startsWith("line.obligation.relief."))).toEqual([]);
    await showResults(game, lines);
    const told = storyTexts();
    expect(told).toContain(`Food, cooked at home: ${formatMoney(bp(due, room.cookedBp), "NGN")} less.`);
    expect(told).toContain(`Water, fetched yourself: ${formatMoney(bp(due, room.waterBp), "NGN")} less.`);
  });
});
