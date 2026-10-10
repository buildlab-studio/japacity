// Bills in a month no instalment is taken (docs/rules/world.md R-WORLD-019, R-WORLD-002; the seventh
// review's note): tuition said "Taken at the month's end." in months when none was taken. It now says
// when the next one comes, as months away.
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { ABROAD_POCKETS, abroadGame, gameAuthority, newGame, setPockets } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { PhoneApps } from "../PhoneApps";

const TUITION = "obligation.tuition";

async function billsOf(game: ReturnType<typeof abroadGame>): Promise<string> {
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  const { unmount } = render(
    <GameProvider store={store}>
      <PhoneApps onClose={() => undefined} area="Peckham" now={() => new Date(2026, 9, 9, 12, 5)} talk={null} />
    </GameProvider>,
  );
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="bills"]')!);
  const bill = [...document.querySelectorAll<HTMLElement>("[data-bill]")].find((node) => node.textContent?.includes("Tuition") === true)?.textContent ?? "";
  unmount();
  return bill;
}

describe("a bill taken every few months", () => {
  test("[R-WORLD-019] given tuition taken every three months abroad, when Bills is read the month after one was taken, then it says the next instalment comes in 2 months, not that one is taken this month", async () => {
    const game = abroadGame();
    setPockets(game, { ...ABROAD_POCKETS, GBP: 10_000_000 });
    const dueOf = (): number | undefined => game.view().obligations.find((owed) => owed.entry === TUITION)?.due;
    expect(dueOf()).toBeDefined();
    // Play on to a month with an instalment due, then the month after it.
    for (let guard = 0; guard < 4 && (dueOf() ?? 0) === 0; guard += 1) game.endTurn([]);
    expect(dueOf()).toBeGreaterThan(0);
    expect(await billsOf(game)).toContain("Taken at the month's end.");
    game.endTurn([]);
    expect(dueOf()).toBe(0);
    const bill = await billsOf(game);
    expect(bill).toContain("Next instalment in 2 months.");
    expect(bill).not.toContain("Taken at the month's end.");
  });

  test("[R-HOME-010] [R-OBLIGATION-015] given the room's year of rent paid on the move, when Bills is read in the months between, then the rent's bill says when the next year is taken, never that it is taken at the month's end", async () => {
    const game = newGame();
    setPockets(game, { NGN: 5_000_000_00 });
    game.accept({ type: "home/move", to: "place.compound-room" });
    const rentBill = async (): Promise<string> => {
      const store = createGameStore(gameAuthority(game));
      await store.getState().refresh();
      const { unmount } = render(
        <GameProvider store={store}>
          <PhoneApps onClose={() => undefined} area="Ojuelegba" now={() => new Date(2026, 9, 9, 12, 5)} talk={null} />
        </GameProvider>,
      );
      fireEvent.click(document.querySelector<HTMLElement>('[data-app="bills"]')!);
      const said = document.querySelector<HTMLElement>('[data-bill][data-due="false"]')?.textContent ?? "";
      unmount();
      return said;
    };
    expect(await rentBill()).toContain("Next year's rent in 11 months.");
    for (let at = 0; at < 10; at += 1) {
      setPockets(game, { NGN: 5_000_000_00 });
      game.endTurn([]);
    }
    expect(await rentBill()).toContain("Next year's rent next month.");
    expect(await rentBill()).not.toContain("Taken at the month's end.");
  });
});
