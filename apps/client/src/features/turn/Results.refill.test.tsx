// The calendar full again between months (docs/rules/world.md R-WORLD-027): the pages ran
// down to 2, 1, then came back to 24 with no word anywhere. The results say it, as they say a chapter's refill.
import { content } from "@japacity/content";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { Results } from "./Results";

describe("the pages full again on the results", () => {
  test("[R-WORLD-027] [R-TURN-004] given a month ended and the pages come back to the most since, when the results show, then they say the pages are full again, in pages to play", async () => {
    const game = newGame("scenario.tunde", "refill-0");
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    await store.getState().endMonth();
    expect(store.getState().view?.report?.lines.some((line) => line.key === "line.chapter.closed")).toBe(false);
    expect(store.getState().view?.turns.banked).toBeLessThan(content.tuning.turn.cap);
    game.grant(content.tuning.turn.cap);
    await store.getState().refresh();
    // The month's staged moments pass first; the results come after them.
    for (let guard = 0; guard < 10 && store.getState().moments.length > 0; guard += 1) store.getState().nextMoment();
    render(
      <GameProvider store={store}>
        <Results place="Home" />
      </GameProvider>,
    );
    const said = document.querySelector("[data-results-months-full]")?.textContent;
    expect(said).toBe(say("ui.months.refilled", { count: content.tuning.turn.cap }));
    expect(said).toBe("Your pages are full again: 24 to play.");
  });

  test("[R-WORLD-027] given a month ended with pages still to come, when the results show, then they say nothing of the calendar", async () => {
    const game = newGame("scenario.tunde", "refill-1");
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    await store.getState().endMonth();
    for (let guard = 0; guard < 10 && store.getState().moments.length > 0; guard += 1) store.getState().nextMoment();
    render(
      <GameProvider store={store}>
        <Results place="Home" />
      </GameProvider>,
    );
    expect(document.querySelector("[data-results-months-full]")).toBeNull();
  });
});
