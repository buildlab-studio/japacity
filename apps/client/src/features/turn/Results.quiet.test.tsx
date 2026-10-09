// The results after an Until news run (docs/rules/world.md R-WORLD-028), and the chapter's months
// full again (R-WORLD-027), on the real engine and the real content.
import { content } from "@japacity/content";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { abroadGame, gameAuthority, newGame } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say, words } from "../../shared/words/text";
import { localCurrency, quietLine } from "./month.results";
import { Results } from "./Results";
import { turnWords } from "./turn.words";

describe("the results after a run", () => {
  test("[R-WORLD-028] given a run with a quiet month, when the results open, then each quiet month is one line saying what was kept and that nothing else moved, above the full results of the month that stopped it", async () => {
    const game = newGame("scenario.tunde", "seed-0");
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    store.getState().addToPlan({ activity: "activity.get-transcript", param: null });
    await store.getState().endMonth();
    await store.getState().untilNews();
    const { quiet, view } = store.getState();
    if (view === null) throw new Error("No view");
    expect(quiet).toHaveLength(1);
    render(
      <GameProvider store={store}>
        <Results place="Yaba" />
      </GameProvider>,
    );
    const rows = document.querySelectorAll("[data-quiet-line]");
    expect(rows).toHaveLength(1);
    const local = localCurrency(view);
    const told = quietLine(quiet[0] ?? [], local);
    if (told.kept === null) throw new Error("The working month kept nothing");
    expect(told.kept).toBeGreaterThan(0);
    const kept = turnWords("turn.results.quiet-kept", { amount: formatMoney(told.kept, local) });
    const rest = told.moved === null ? turnWords("turn.results.quiet-still") : words(told.moved.key, told.moved.params);
    expect(rows[0]?.textContent).toContain(`${kept} ${rest}`);
    // The month that stopped the run is told in full below the quiet line.
    const section = document.querySelector("[data-results-quiet]");
    const full = document.querySelector("[data-results-kept]");
    if (section === null || full === null) throw new Error("No results");
    expect(section.compareDocumentPosition(full) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("[R-WORLD-028] given a month ended with End month, then the results show no quiet months", async () => {
    const game = newGame("scenario.tunde", "seed-0");
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    await store.getState().untilNews();
    await store.getState().endMonth();
    expect(store.getState().quiet).toEqual([]);
  });

  test("[R-WORLD-027] [R-TURN-004] given a month that closes a chapter, when the results open, then they say the months are full again", async () => {
    const game = abroadGame();
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    await store.getState().endMonth();
    const view = store.getState().view;
    expect(view?.report?.lines.some((line) => line.key === "line.chapter.closed")).toBe(true);
    expect(view?.turns.banked).toBe(content.tuning.turn.cap);
    render(
      <GameProvider store={store}>
        <Results place="Home" />
      </GameProvider>,
    );
    expect(document.querySelector("[data-results-months-full]")?.textContent).toBe(say("ui.months.full-again", { count: content.tuning.turn.cap }));
  });
});
