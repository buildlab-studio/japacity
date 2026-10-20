// Bills, Pay now on the held funds (world:one-action-one-sheet, world:phone-holds-what-phones-hold), played on the
// real engine: the funds go back from the locked pocket, so the slip's
// "after" is the naira the character keeps, never "₦0 left", and once paid the view (and the band
// that reads it) counts after the payment.
import { applyEffects } from "@japacity/sim/testing";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { gameAuthority, newGame } from "../../../shared/testing/fixtures";
import "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { bandMoney } from "../../../shared/world/Band";
import { PhoneApps } from "../PhoneApps";

const HELD = 1_119_311_000;

async function graduateHolding() {
  const game = newGame("scenario.graduate");
  applyEffects(game, [{ type: "obligation/open", obligation: "obligation.held-funds", principal: HELD }]);
  const held = game.view().obligations.find((owed) => owed.entry === "obligation.held-funds");
  if (held === undefined) throw new Error("No held funds opened.");
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  render(
    <GameProvider store={store}>
      <PhoneApps onClose={() => undefined} area="Ikeja" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} />
    </GameProvider>,
  );
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="bills"]')!);
  return { game, store, held };
}

describe("Bills, the held funds paid back", () => {
  test("[world:one-action-one-sheet] [world:phone-holds-what-phones-hold] given held funds open, when Pay now's slip opens, then what is left after is the naira the character keeps, not nothing", async () => {
    const { game, held } = await graduateHolding();
    fireEvent.click(document.querySelector<HTMLElement>(`[data-pay="${held.id}"]`)!);
    const naira = game.view().pockets.NGN;
    const after = document.querySelector("[data-ask-after]")?.textContent ?? "";
    expect(after).toContain(say("ui.world.left", { amount: formatMoney(naira.bank + naira.cash, "NGN") }));
    expect(after).not.toContain(say("ui.world.left", { amount: formatMoney(0, "NGN") }));
    expect(document.querySelector<HTMLButtonElement>("[data-ask-main]")?.disabled).toBe(false);
  });

  test("[world:one-action-one-sheet] [world:phone-holds-what-phones-hold] given the held funds paid back, when the reply comes, then the view counts after the payment: nothing locked, the bill gone, and the band reads the new pockets", async () => {
    const { game, store, held } = await graduateHolding();
    fireEvent.click(document.querySelector<HTMLElement>(`[data-pay="${held.id}"]`)!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    await waitFor(() => expect(store.getState().view?.pockets.NGN.locked).toBe(0));
    const view = store.getState().view!;
    expect(view.obligations.some((owed) => owed.entry === "obligation.held-funds")).toBe(false);
    expect(bandMoney(view).money).toBe(game.view().pockets.NGN.bank + game.view().pockets.NGN.cash);
    await waitFor(() => expect(document.querySelector(`[data-bill="${held.id}"]`)).toBeNull());
  });
});
