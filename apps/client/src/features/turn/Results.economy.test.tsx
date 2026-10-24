// The economy's months on the results (world:month-end-results-sheet): the yearly pay review and the free path's certificate,
// played on the real engine and the real content, each told in one line the month it happens.
import type { Id } from "@japacity/sim";
import { slot } from "@japacity/sim/testing";
import type { Game } from "@japacity/sim/testing";
import { act, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { words } from "../../shared/words/text";
import { Results } from "./Results";

const FREE_PATH: Id<"activity"> = "activity.learn-free";

async function storeOf(game: Game): Promise<GameStore> {
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  return store;
}

/** One month through the store as the Month sheet sends it: these acts planned, the rest rest. */
async function month(store: GameStore, game: Game, picks: Id<"activity">[] = []): Promise<void> {
  if (game.state.turn.banked < 1) game.grant(1);
  await store.getState().refresh();
  act(() => store.getState().clearPlan());
  for (const pick of picks) expect(store.getState().addToPlan(slot(pick))).toBe(true);
  await act(async () => {
    await store.getState().endMonth();
  });
  act(() => store.setState({ moments: [], reportOpen: true }));
}

/** The results of the month just ended, and their story rows as they read. */
function results(store: GameStore): string[] {
  const { unmount } = render(
    <GameProvider store={store}>
      <Results place="Yaba" />
    </GameProvider>,
  );
  const rows = [...document.querySelectorAll("[data-results-story] li")].map((row) => row.textContent ?? "");
  unmount();
  return rows;
}

describe("the pay review on the results", () => {
  test("[activity:naira-pay-reviewed-yearly] [world:month-end-results-sheet] given the nurse's pay on record, when the months turn to its review, then that month's results say the new pay in one line", async () => {
    const game = newGame("scenario.nurse");
    const store = await storeOf(game);
    let told: string[] = [];
    for (let turned = 0; turned < 14; turned += 1) {
      await month(store, game);
      const reviewed = store.getState().view?.report.lines.find((line) => line.key === "line.activity.reviewed");
      if (reviewed === undefined) continue;
      told = results(store);
      expect(told).toContain(words("line.activity.reviewed", reviewed.params));
      return;
    }
    throw new Error(`No review came in 14 months: ${told.join(" | ")}`);
  });
});

describe("the free path's certificate on the results", () => {
  test("[activity:free-path-keeps-a-streak] [world:month-end-results-sheet] given the free path played month after month, when the fifth month in a row ends, then the results say the certificate", async () => {
    const game = newGame("scenario.graduate");
    const store = await storeOf(game);
    for (let played = 1; played <= 5; played += 1) {
      await month(store, game, [FREE_PATH]);
      const rows = results(store);
      if (played < 5) expect(rows).not.toContain(words("line.activity.certificate"));
      else expect(rows).toContain(words("line.activity.certificate"));
    }
  });
});
