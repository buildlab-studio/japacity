// The phone's home card (docs/rules/home.md R-HOME-007), on the real engine: where the character
// lives, the monthly charge, the move with its reason when it is shut, and a guest's host. The
// risk of the water is said once, plainly.
import { content } from "@japacity/content";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { applyEffects } from "../../../../../../packages/sim/src/route/route.journey";
import { applyOverlay } from "../../../../../../packages/sim/src/engine/overlay";
import type { Game } from "../../../../../../packages/sim/src/testing/play";
import { start } from "../../../../../../packages/sim/src/testing/play";
import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { gameAuthority, newGame, setPockets } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { PhoneApps } from "../PhoneApps";
import { phoneWords } from "../phone.words";

const RISK = phoneWords("phone.home.risk");
const RENT = content.tuning.home.makokoUpkeep;
const ADA_UPKEEP = content.scenario["scenario.ada"]!.obligations.find((owed) => owed.obligation === "obligation.upkeep")!.amount;

async function openBills(game: Game): Promise<{ card: () => HTMLElement | null; unmount: () => void }> {
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  const { unmount } = render(
    <GameProvider store={store}>
      <PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 9, 12, 5)} talk={null} />
    </GameProvider>,
  );
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="bills"]')!);
  return { card: () => document.querySelector<HTMLElement>("[data-home-card]"), unmount };
}

function moveButton(to: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(`[data-home-move="${to}"]`);
}

function times(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("the home card", () => {
  test("[R-HOME-007] given Ada at the family house with money, when Bills opens, then the card says where she lives and its charge, offers the move to Makoko with its first month's rent, and says the risk once", async () => {
    const game = newGame();
    setPockets(game, { NGN: 500_000_00 });
    const { card, unmount } = await openBills(game);
    const said = card()?.textContent ?? "";
    expect(said).toContain(phoneWords("phone.home.place.place.family-house"));
    expect(said).toContain(formatMoney(ADA_UPKEEP, "NGN"));
    expect(moveButton("place.makoko")?.disabled).toBe(false);
    expect(moveButton("place.makoko")?.textContent).toContain(formatMoney(RENT, "NGN"));
    expect(moveButton("place.family-house")).toBeNull();
    expect(times(said, RISK)).toBe(1);
    unmount();
  });

  test("[R-HOME-007] given Ada moving to Makoko from the card, when she confirms, then she lives there, the card shows Makoko's charge and the risk once, and the move back is shut for this month with its reason", async () => {
    const game = newGame();
    setPockets(game, { NGN: 500_000_00 });
    const { card, unmount } = await openBills(game);
    fireEvent.click(moveButton("place.makoko")!);
    const confirm = document.querySelector<HTMLButtonElement>("[data-ask-main]");
    expect(confirm?.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirm!);
      await Promise.resolve();
    });
    expect(game.state.home.place).toBe("place.makoko");
    const said = card()?.textContent ?? "";
    expect(said).toContain(phoneWords("phone.home.place.place.makoko"));
    expect(said).toContain(formatMoney(RENT, "NGN"));
    expect(times(said, RISK)).toBe(1);
    expect(moveButton("place.family-house")?.disabled).toBe(true);
    expect(said).toContain(phoneWords("phone.home.shut.moved"));
    unmount();
  });

  test("[R-HOME-007] given Ada short of the first month's rent, when Bills opens, then the move to Makoko is shut and says what it needs", async () => {
    const game = newGame();
    setPockets(game, { NGN: RENT - 100 });
    const { card, unmount } = await openBills(game);
    expect(moveButton("place.makoko")?.disabled).toBe(true);
    expect(card()?.textContent).toContain(phoneWords("phone.home.shut.short", { amount: { currency: "NGN", amount: RENT } }));
    unmount();
  });

  test("[R-HOME-007] given Ada taken in after the settlement was cleared, when Bills opens, then the card says who took her in and for how long, and that no rent is charged", async () => {
    const game = start({ content: applyOverlay(content, { version: "test-card-evicted", tuning: { home: { evictionBp: 10000 } } }), scenario: "scenario.ada" });
    setPockets(game, { NGN: 500_000_00 });
    game.accept({ type: "home/move", to: "place.makoko" });
    game.endTurn();
    const offer = game.view().offers.find((open) => open.entry === "offer.taken-in")!;
    game.accept({ type: "offer/choose", offer: offer.id, choice: "someone" });
    const { card, unmount } = await openBills(game);
    const said = card()?.textContent ?? "";
    expect(said).toContain("Your sibling in Lagos");
    expect(said).toContain("3 more months");
    expect(said).toContain(phoneWords("phone.home.charge.none"));
    unmount();
  });

  test("[R-HOME-007] given Ada abroad, when Bills opens, then no home card shows: the home is Lagos", async () => {
    const game = newGame();
    applyEffects(game, [{ type: "place/move", to: "abroad", country: "country.uk" }]);
    const { card, unmount } = await openBills(game);
    expect(card()).toBeNull();
    unmount();
  });
});
