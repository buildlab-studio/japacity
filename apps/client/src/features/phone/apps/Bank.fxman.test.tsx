// The FX man's sheet (docs/rules/world.md R-WORLD-006): it said "After, you hold
// ₦791,419 and £615" over a button "₦0 left", because its line counted the bank and the cash while the FX man is paid
// in cash. The line and the button read the same money, what is held to pay with where the act is paid, and what is
// left of it is said once, on the button. Real content, a real life at home.
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, setPockets } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { changeQuote } from "../../../shared/words/cost";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { phoneWords } from "../phone.words";
import { Bank } from "./Bank";

function card(): HTMLElement {
  const main = document.querySelector<HTMLElement>("[data-ask-main]");
  const dialog = main?.closest<HTMLElement>("[role='dialog']") ?? main?.parentElement?.parentElement ?? null;
  if (dialog === null) throw new Error("No card is open.");
  return dialog;
}

/** Tunde at home with naira in the bank and in cash, and a few pounds in hand. */
function heldAtHome(): PlayerView {
  const game = newGame("scenario.tunde");
  setPockets(game, { NGN: 120_000_000 });
  const view = game.view();
  return { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, bank: 80_000_000, cash: 40_000_000 }, GBP: { ...view.pockets.GBP, bank: 5_000, cash: 2_000 } } };
}

async function changeAllWithTheFxMan(view: PlayerView): Promise<void> {
  await renderWithView(<Bank opening="change" />, view);
  fireEvent.click(screen.getByRole("radio", { name: say("ui.wallet.via.aboki") }));
  fireEvent.click(screen.getByRole("radio", { name: phoneWords("phone.bank.all") }));
  fireEvent.click(document.querySelector<HTMLElement>('[data-go="change"]')!);
}

describe("the FX man's sheet reads the cash he is paid from", () => {
  test("[R-WORLD-006] given naira in the bank and in cash, when all the cash is changed into pounds with the FX man, then the button says no naira left and the line never names the naira the bank still holds", async () => {
    const view = heldAtHome();
    await changeAllWithTheFxMan(view);
    const told = card().textContent ?? "";
    expect(told).toContain(say("ui.world.left", { amount: formatMoney(0, "NGN") }));
    // What the bank holds is not what the FX man is paid from: the line never says it.
    expect(told).not.toContain(formatMoney(view.pockets.NGN.bank, "NGN"));
    // What is left of the naira is said once, on the button.
    expect(told.split(formatMoney(0, "NGN")).length - 1).toBe(1);
  });

  test("[R-WORLD-006] given the same change, when its line is read, then the pounds after are the cash in hand with what he counts out", async () => {
    const view = heldAtHome();
    await changeAllWithTheFxMan(view);
    const told = card().textContent ?? "";
    const { got } = changeQuote(view, "NGN", "GBP", view.pockets.NGN.cash, "aboki");
    expect(told).toContain(say("ui.wallet.change.after.aboki", { to: formatMoney(view.pockets.GBP.cash + got.amount, "GBP") }));
    expect(told).not.toContain(formatMoney(view.pockets.GBP.bank + view.pockets.GBP.cash + got.amount, "GBP"));
  });
});
