// The money sheets say what you get (docs/rules/world.md R-WORLD-006),
// on Ada's recorded life just landed in London: Change money says the pounds that come before the
// change is confirmed, and what is held in both monies after; Send money home lists the channels
// with their cost and speed, an amount with its rate and the naira that lands, and a card whose
// button says the amount, sends at once and says what is left in pounds.
import { content } from "@japacity/content";
import { remitQuote } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { recordedGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatBp, formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { Bank } from "./Bank";
import { askCard as card, sent } from "../phone.testing";

describe("Change money says what you get", () => {
  test("[R-WORLD-006] [R-WALLET-004] given Ada just landed with dollars, when all of them are set to change into pounds at the bank, then the card says the pounds she gets, the figure the engine gives, and what she holds in both monies after: the pounds in the bank on the line, the dollars left on the button", async () => {
    const game = recordedGame("ada-careful");
    const view = game.view();
    await renderWithView(<Bank />, view);
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-held="USD"]')!).getByRole("button"));
    fireEvent.click(screen.getByRole("radio", { name: say("phone.bank.all") }));
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="change"]')!);
    const told = card().textContent ?? "";

    const dollars = view.pockets.USD.bank;
    const poundsBefore = view.pockets.GBP.bank + view.pockets.GBP.cash;
    game.accept({ type: "wallet/convert", from: "USD", to: "GBP", amount: dollars, via: "bank" });
    const poundsAfter = game.view().pockets.GBP.bank + game.view().pockets.GBP.cash;
    const got = poundsAfter - poundsBefore;
    expect(got).toBeGreaterThan(0);
    expect(told).toContain(`You get ${formatMoney(got, "GBP")}.`);
    // Both monies after: the pounds in the bank on the line, the dollars left on the button, each said once.
    expect(told).toContain(say("ui.wallet.change.after.bank", { to: formatMoney(game.view().pockets.GBP.bank, "GBP") }));
    expect(told).toContain(say("ui.world.left", { amount: formatMoney(0, "USD") }));
    expect(told).toContain(formatMoney(Math.floor((dollars * content.tuning.wallet.bankChargeBp) / 10_000), "USD"));
  });
});

describe("Send money home", () => {
  test("[R-WORLD-006] [R-ABROAD-006] given Ada just landed, when Send money home opens in the Bank, then each channel says what it costs and how fast it lands, and the amount says its rate and the naira that lands", async () => {
    const view = recordedGame("ada-careful").view();
    await renderWithView(<Bank />, view);
    fireEvent.click(document.querySelector<HTMLElement>('[data-bank-act="send"]')!);
    const chooser = document.querySelector<HTMLElement>('[data-chooser="send"]');
    expect(chooser).not.toBeNull();
    const channels = [...(chooser?.querySelectorAll<HTMLElement>("[data-channel]") ?? [])];
    expect(channels.map((row) => row.getAttribute("data-channel"))).toEqual(["app", "bank", "informal"]);
    expect(channels[0]?.textContent).toContain("Lands today");
    expect(channels[1]?.textContent).toContain("Lands next month");
    expect(channels[1]?.textContent).toContain(formatBp(content.tuning.remit.bankFeeBp));
    expect(channels[2]?.textContent).toContain(formatBp(content.tuning.remit.informalLossBp));
    const quarter = Math.floor(view.pockets.GBP.bank / 4 / 100) * 100;
    const naira = remitQuote(view.rates, content.tuning.remit, "GBP", quarter).app.naira;
    const quote = chooser?.querySelector("[data-send-quote]")?.textContent ?? "";
    expect(quote).toContain(`${formatMoney(naira, "NGN")} lands at home`);
    expect(quote).toContain(formatMoney(100, "GBP"));
  });

  test("[R-WORLD-006] [R-ABROAD-006] given a quarter of the pounds by app, when the card opens and is confirmed, then its button says Send and the amount with what is left in pounds, and the money goes at once", async () => {
    const view = recordedGame("ada-careful").view();
    const { authority } = await renderWithView(<Bank />, view);
    fireEvent.click(document.querySelector<HTMLElement>('[data-bank-act="send"]')!);
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="send"]')!);
    const quarter = Math.floor(view.pockets.GBP.bank / 4 / 100) * 100;
    const main = document.querySelector<HTMLElement>("[data-ask-main]");
    expect(main?.textContent).toContain(say("ui.remit.go", { amount: formatMoney(quarter, "GBP") }));
    expect(main?.textContent).toContain(formatMoney(view.pockets.GBP.bank + view.pockets.GBP.cash - quarter, "GBP"));
    expect(main?.textContent).not.toContain(say("ui.world.counts-at-end"));
    expect(card().textContent).toContain("today");
    fireEvent.click(main!);
    await waitFor(() => expect(sent(authority)).toEqual([{ type: "wallet/remit", currency: "GBP", amount: quarter, channel: "app" }]));
  });

  test("[R-WORLD-006] [R-ABROAD-006] given the bank's transfer picked, when the card opens, then its line says the naira lands next month", async () => {
    const view = recordedGame("ada-careful").view();
    await renderWithView(<Bank />, view);
    fireEvent.click(document.querySelector<HTMLElement>('[data-bank-act="send"]')!);
    fireEvent.click(document.querySelector<HTMLElement>('[data-channel="bank"]')!);
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="send"]')!);
    const quarter = Math.floor(view.pockets.GBP.bank / 4 / 100) * 100;
    const naira = remitQuote(view.rates, content.tuning.remit, "GBP", quarter).bank.naira;
    expect(card().textContent).toContain(`${formatMoney(naira, "NGN")} lands in the bank at home next month`);
  });
});

describe("the Bank's foot and an open chooser", () => {
  test("[R-WORLD-019] given Send money home opened abroad, when its ways stand, then the foot's buttons come after the last way and never stand over it; closed, the foot stands at the screen's foot again", async () => {
    // The trap: Through someone cut under the foot's two buttons, with no sign it scrolls.
    const game = recordedGame("ada-careful");
    await renderWithView(<Bank opening="send" />, game.view());
    const foot = document.querySelector<HTMLElement>("[data-bank-foot]")!;
    const ways = [...document.querySelectorAll<HTMLElement>("[data-channel]")];
    expect(ways.length).toBe(3);
    expect(ways.at(-1)!.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(foot.className).not.toContain("sticky");
    fireEvent.click(document.querySelector<HTMLElement>('[data-bank-act="send"]')!);
    expect(document.querySelector('[data-chooser="send"]')).toBeNull();
    expect(document.querySelector<HTMLElement>("[data-bank-foot]")!.className).toContain("sticky");
  });
});
