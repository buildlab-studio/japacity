// The Bank's change of money at home (wallet:monthly-fx-allowance, wallet:amounts-whole-and-positive; world:one-action-one-sheet,
// world:phone-holds-what-phones-hold). The bank sells foreign money only up to the month's limit, so the chips offer only what it will take,
// the limit's remainder first, the limit is said before the button, and any refusal shows beside the button, never
// "That amount will not work" at the top of the phone, scrolled away. Played on the real engine.
import { content, text } from "@japacity/content";
import { int, type PlayerView } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { gameAuthority, newGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";
import { Bank, bankLimit, latelyMoney } from "./Bank";
import { sent } from "../phone.testing";

/** The banker at home with ₦2,110,450 in the bank. */
function heldAtHome() {
  const game = newGame("scenario.banker");
  setPockets(game, { NGN: 211_045_000 });
  return game;
}

function chips(): string[] {
  const group = screen.getByRole("radiogroup", { name: say("phone.bank.how-much") });
  return [...group.querySelectorAll('[role="radio"]')].map((radio) => radio.textContent ?? "");
}

describe("the Bank's change at home, within the month's limit", () => {
  test("[wallet:monthly-fx-allowance] given the month's limit, when the most the Bank offers is changed, then the bank takes it, and one naira more is refused", () => {
    const game = heldAtHome();
    const limit = bankLimit(game.view(), "NGN", "GBP");
    expect(limit).not.toBeNull();
    expect(limit!).toBeGreaterThan(0);
    expect(limit! % 100).toBe(0);
    const over = game.send({ type: "wallet/convert", from: "NGN", to: "GBP", amount: limit! + 100, via: "bank" });
    expect(over).toMatchObject({ ok: false, code: "bad-amount" });
    expect(game.send({ type: "wallet/convert", from: "NGN", to: "GBP", amount: limit!, via: "bank" }).ok).toBe(true);
    // The limit spent, the Bank offers nothing more at the bank this month.
    expect(bankLimit(game.view(), "NGN", "GBP")).toBe(0);
  });

  test("[wallet:monthly-fx-allowance] given money changed abroad, for naira, or with the FX man, when the limit is read, then none binds", () => {
    const view = heldAtHome().view();
    expect(bankLimit(view, "GBP", "NGN")).toBeNull();
    expect(bankLimit({ ...view, bankAllowanceLeft: null }, "NGN", "GBP")).toBeNull();
  });

  test("[wallet:monthly-fx-allowance] [world:phone-holds-what-phones-hold] given ₦2,110,450 in the bank, when naira into pounds at the bank is chosen, then the limit is the first chip and the one picked, a quarter and a half the bank would refuse are not offered, and the limit is said in plain words before the button", async () => {
    // A month the dollar squeeze has cut the bank's limit (the news's own figure).
    const squeeze = Math.min(
      ...Object.values(content.news)
        .flatMap((entry) => [...(entry.director?.adds ?? []), ...entry.standIn.sets])
        .filter((change) => change.var === "var.fx-bank-allowance")
        .map((change) => change.value),
    );
    const view = { ...heldAtHome().view(), bankAllowanceLeft: squeeze };
    const limit = bankLimit(view, "NGN", "GBP")!;
    // A quarter and a half are both past what the bank will sell this month.
    expect(Math.floor(view.pockets.NGN.bank / 4 / 100) * 100).toBeGreaterThan(limit);
    await renderWithView(<Bank opening="change" />, view);
    expect(chips()).toEqual([say("phone.bank.limit")]);
    const chooser = document.querySelector<HTMLElement>('[data-chooser="change"]')!;
    const said = chooser.querySelector<HTMLElement>("[data-bank-limit]");
    expect(said?.textContent).toBe(say("phone.bank.limit.line", { amount: formatMoney(limit, "NGN") }));
    const go = chooser.querySelector<HTMLElement>('[data-go="change"]')!;
    // Said before the button.
    expect(said!.compareDocumentPosition(go) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(go.textContent).toBe(say("phone.bank.go", { amount: formatMoney(limit, "NGN") }));
  });

  test("[wallet:monthly-fx-allowance] given a pocket whose quarter fits the limit, when the change opens, then the limit comes first, the quarter stays the one picked, and only shares under the limit are offered", async () => {
    const game = newGame("scenario.banker");
    const limit = bankLimit(game.view(), "NGN", "GBP")!;
    // A pocket three times the limit: a quarter fits, a half and all of it do not.
    setPockets(game, { NGN: limit * 3 });
    await renderWithView(<Bank opening="change" />, game.view());
    expect(chips()).toEqual([say("phone.bank.limit"), say("phone.bank.quarter")]);
    expect(screen.getByRole("radio", { name: say("phone.bank.quarter") }).getAttribute("aria-checked")).toBe("true");
  });

  test("[wallet:aboki-trades-at-street-rate] given the FX man, when the change opens, then no limit is said and every share is offered", async () => {
    const game = newGame("scenario.banker");
    setPockets(game, { NGN: 211_045_000 });
    game.accept({ type: "wallet/move", currency: "NGN", amount: 100_000_000, to: "cash" });
    await renderWithView(<Bank opening="change" />, game.view());
    fireEvent.click(screen.getByRole("radio", { name: say("ui.wallet.via.aboki") }));
    expect(chips()).toEqual(["quarter", "half", "all"].map((share) => say(`phone.bank.${share}`)));
    expect(document.querySelector("[data-bank-limit]")).toBeNull();
  });

  test("[wallet:monthly-fx-allowance] [world:phone-holds-what-phones-hold] given a month whose limit has only cents left, too few to buy one whole pound, when the change opens at the bank, then the limit counts as spent: no chip, the FX man's way said, never a change for nothing", async () => {
    // Twelve US cents of the allowance left: ₦191 that would buy nine pence.
    const view = { ...heldAtHome().view(), bankAllowanceLeft: 12 };
    expect(bankLimit(view, "NGN", "GBP")).toBe(0);
    await renderWithView(<Bank opening="change" />, view);
    expect(document.querySelector("[data-bank-limit]")?.textContent).toBe(say("phone.bank.limit.none"));
    expect(document.querySelector('[data-go="change"]')).toBeNull();
  });

  test("[wallet:monthly-fx-allowance] given a limit left that buys more than one whole pound, when it is read, then the bank still offers it, and the line says what is left this month", async () => {
    const base = heldAtHome().view();
    // The cents one pound costs at the bank, its charge on top: the smallest remainder still worth a change.
    const pound = int.convertMinor(100, "GBP", "USD", { GBP: base.rates.GBP.official, USD: base.rates.USD.official, CAD: base.rates.CAD.official, AED: base.rates.AED.official, EUR: base.rates.EUR.official });
    const view = { ...base, bankAllowanceLeft: pound * 2 };
    const limit = bankLimit(view, "NGN", "GBP")!;
    expect(limit).toBeGreaterThan(0);
    await renderWithView(<Bank opening="change" />, view);
    expect(document.querySelector("[data-bank-limit]")?.textContent).toBe(say("phone.bank.limit.line", { amount: formatMoney(limit, "NGN") }));
  });

  test("[world:one-action-one-sheet] given the bank's limit spent this month, when the change opens at the bank, then it says so and the FX man's way, with no button", async () => {
    const game = heldAtHome();
    game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: bankLimit(game.view(), "NGN", "GBP")!, via: "bank" });
    await renderWithView(<Bank opening="change" />, game.view());
    expect(document.querySelector("[data-bank-limit]")?.textContent).toBe(say("phone.bank.limit.none"));
    expect(document.querySelector('[data-go="change"]')).toBeNull();
  });

  test("[world:one-action-one-sheet] [wallet:amounts-whole-and-positive] given a change the engine refuses, when Change it is tapped, then the refusal shows beside the button in the chooser, not at the top of the phone", async () => {
    const view: PlayerView = heldAtHome().view();
    const { authority } = await renderWithView(<PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 10, 6, 30)} talk={null} />, view);
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="bank"]')!);
    fireEvent.click(screen.getByRole("button", { name: say("ui.wallet.convert") }));
    authority.rejectNext({ code: "bad-amount", detail: "That is over the limit this month." });
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="change"]')!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    await waitFor(() => expect(sent(authority)).toHaveLength(1));
    const chooser = document.querySelector<HTMLElement>('[data-chooser="change"]')!;
    await waitFor(() => expect(chooser.querySelector("[data-refused]")).not.toBeNull());
    const refused = chooser.querySelector<HTMLElement>("[data-refused]")!;
    expect(refused.textContent).toBe(text["reject.bad-amount"] ?? "");
    // Beside the button that sent it, and said once: not again at the top of the phone.
    expect(chooser.querySelector('[data-go="change"]')!.compareDocumentPosition(refused) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1);
    // A new pick clears it.
    fireEvent.click(screen.getByRole("radio", { name: say("ui.wallet.via.aboki") }));
    expect(chooser.querySelector("[data-refused]")).toBeNull();
  });

  test("[world:one-action-one-sheet] given Move money, bank out as cash, when its card opens, then the button says it happens now and the line says the cash is in hand now, and the cash is spendable at once", async () => {
    const game = heldAtHome();
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    render(
      <GameProvider store={store}>
        <Bank opening="move" />
      </GameProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: say("phone.bank.to-cash") }));
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="move"]')!);
    const main = document.querySelector<HTMLElement>("[data-ask-main]")!;
    expect(main.textContent).toContain(say("ui.world.now"));
    expect(main.textContent).not.toContain(say("ui.world.counts-at-end"));
    const quarter = Math.floor(game.view().pockets.NGN.bank / 4 / 100) * 100;
    expect(document.body.textContent).toContain(say("phone.bank.move.line.cash", { amount: formatMoney(quarter, "NGN") }));
    const cashBefore = game.view().pockets.NGN.cash;
    await act(async () => {
      fireEvent.click(main);
      await Promise.resolve();
    });
    await waitFor(() => expect(store.getState().view?.pockets.NGN.cash).toBe(cashBefore + quarter));
  });

  test("[world:phone-holds-what-phones-hold] [wallet:aboki-trades-at-street-rate] given naira changed into pounds with the FX man this month, when Lately is read, then it shows the pounds in and the naira out, each in its own money, as the results do", () => {
    const game = heldAtHome();
    game.accept({ type: "wallet/move", currency: "NGN", amount: 100_000_000, to: "cash" });
    const told = game.accept({ type: "wallet/convert", from: "NGN", to: "GBP", amount: 100_000_000, via: "aboki" });
    const lately = latelyMoney({ report: null }, [], told.lines);
    expect(lately.map(({ sign, currency }) => [sign, currency])).toEqual([
      [1, "GBP"],
      [-1, "NGN"],
    ]);
    expect(lately[1]?.amount).toBe(100_000_000);
  });
});
