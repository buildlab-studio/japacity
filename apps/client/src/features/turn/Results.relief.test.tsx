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
import { chargedLivingGame, newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { moneyLines, STORY_MAX, storyLines } from "./month.results";
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
    // Decision 0013 (R-HOME-012): at home nothing of the living is charged as the month turns, so there is nothing for the
    // chores to take off and the results tell no relief.
    const lived = newGame("scenario.ada").endTurn([slot("activity.cook-at-home"), slot("activity.fetch-water")]).lines;
    expect(lived.filter((line) => line.key.startsWith("line.obligation.relief."))).toEqual([]);
    // The relief's own lines are tested on the living charged whole, as the simulation's relief tests do.
    const game = chargedLivingGame("scenario.ada");
    const due = game.view().obligations.find((owed) => owed.entry === "obligation.upkeep")?.due ?? 0;
    expect(due).toBeGreaterThan(0);
    const { lines } = game.endTurn([slot("activity.cook-at-home"), slot("activity.fetch-water")]);
    expect(storyLines(lines).map((line) => line.key)).toEqual(expect.arrayContaining(["line.obligation.relief.cook-at-home", "line.obligation.relief.fetch-water"]));
    expect(moneyLines(lines).filter(({ line }) => line.key.startsWith("line.obligation.relief."))).toEqual([]);
    await showResults(game, lines);
    const told = storyTexts();
    expect(told).toContain(`Food, cooked at home: ${formatMoney(bp(due, room.cookedBp), "NGN")} less.`);
    expect(told).toContain(`Water, fetched yourself: ${formatMoney(bp(due, room.waterBp), "NGN")} less.`);
  });

  test("[R-WORLD-008] [R-OBLIGATION-014] given the nurse's busy month (a page read, a paper asked for, a chapter closed, an offer) with food cooked and water fetched, when the results show, then both chores keep their own lines after the month's events", async () => {
    // The nurse's 25y 3m: the month's events filled the story and the water's line fell off the end.
    // Decision 0013 (R-HOME-012): the chores' relief is told only where the living is charged, so the month is played
    // with the living charged whole, as the simulation's relief tests do.
    const game = chargedLivingGame("scenario.ngozi", "seed-2");
    game.endTurn([slot("activity.meetup")]);
    const due = game.view().obligations.find((owed) => owed.entry === "obligation.upkeep")?.due ?? 0;
    const { lines } = game.endTurn([
      { activity: "activity.look-into-route", param: "route.uk-care" },
      slot("activity.get-transcript"),
      slot("activity.cook-at-home"),
      slot("activity.fetch-water"),
    ]);
    const story = storyLines(lines);
    const events = story.filter((line) => !line.key.startsWith("line.obligation.relief."));
    expect(events).toHaveLength(STORY_MAX);
    expect(story.slice(STORY_MAX).map((line) => line.key)).toEqual(["line.obligation.relief.cook-at-home", "line.obligation.relief.fetch-water"]);
    await showResults(game, lines);
    const told = storyTexts();
    expect(told.slice(-2)).toEqual([
      `Food, cooked at home: ${formatMoney(bp(due, room.cookedBp), "NGN")} less.`,
      `Water, fetched yourself: ${formatMoney(bp(due, room.waterBp), "NGN")} less.`,
    ]);
  });
});
