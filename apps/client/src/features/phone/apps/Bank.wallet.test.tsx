// The wallet in the Bank (abroad-money:foreign-currencies-join-wallet, abroad-money:remit-sends-money-home, abroad-money:remit-quote-is-shared; wallet:monthly-fx-allowance). The pockets, the two
// rates, a change, a move, what is on its way, sending money home
// and the naira the family's requests are paid from are the Bank's, each assertion against the Bank's own element.
import { content, text } from "@japacity/content";
import type { ForeignCurrency, PlayerView } from "@japacity/sim";
import { remitQuote } from "@japacity/sim";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView, richView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { formatMoney, formatOne, formatRate } from "../../../shared/words/format";
import { inMonths, say } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";
import { Bank } from "./Bank";

/** The share the Bank offers first: a quarter, in whole units. */
const quarterOf = (pocket: number) => Math.floor(Math.floor(pocket / 4) / 100) * 100;

/** The money the send chooser opens on: the country's own where the bank abroad holds it, else the first foreign money held. */
function sentFirst(view: PlayerView): ForeignCurrency {
  const held = (["GBP", "USD", "CAD", "EUR", "AED"] as const).filter((currency) => currency in view.pockets && view.pockets[currency].bank > 0);
  const first = held[0];
  if (first === undefined) throw new Error("No foreign money in a bank.");
  return first;
}

function radio(group: string, name: string): HTMLElement {
  return within(screen.getByRole("radiogroup", { name: group })).getByRole("radio", { name });
}

describe("money in the Bank", () => {
  test("given a new life, then the naira pockets show, the bank rate is whole naira and the FX man's rate keeps its kobo", async () => {
    const view = engineView();
    await renderWithView(<Bank opening="change" />, view);
    const balance = document.querySelector<HTMLElement>('[data-bank-balance="NGN"]')?.textContent ?? "";
    expect(balance).toContain(formatMoney(view.pockets.NGN.bank, "NGN"));
    expect(balance).toContain(formatMoney(view.pockets.NGN.cash, "NGN"));
    // Naira into pounds at the bank: the bank's rate in whole naira.
    expect(document.querySelector('[data-rate="bank"]')?.textContent).toBe(say("phone.bank.rate.bank", { one: formatOne("GBP"), rate: formatMoney(view.rates.GBP.official, "NGN") }));
    expect(formatMoney(view.rates.GBP.official, "NGN")).not.toMatch(/\./);
    // Naira into dollars with the FX man: his rate to the kobo.
    fireEvent.click(radio(say("phone.bank.where"), say("ui.wallet.via.aboki")));
    fireEvent.click(radio(say("phone.bank.into"), say("ui.currency.USD")));
    expect(document.querySelector('[data-rate="aboki"]')?.textContent).toBe(say("phone.bank.rate.aboki", { one: formatOne("USD"), rate: formatRate(view.rates.USD.street, "NGN") }));
    expect(formatRate(view.rates.USD.street, "NGN")).toMatch(/\.\d\d$/);
    // wallet:monthly-fx-allowance: at home the bank's limit for the month is said where a change at the bank is chosen.
    fireEvent.click(radio(say("phone.bank.where"), say("ui.wallet.via.bank")));
    expect(document.querySelector("[data-bank-limit]")).not.toBeNull();
  });

  test("given a queued conversion, then it shows what was paid and when it lands, as months away", async () => {
    const view = richView();
    await renderWithView(<Bank />, view);
    const item = view.queued[0]!;
    expect(document.querySelector("[data-bank-queued]")?.textContent).toContain(say("phone.bank.queued.item", { paid: formatMoney(50_000_000, "NGN"), to: say("ui.currency.USD"), when: inMonths(item.readyMonth, view.month) }));
  });

  test("given Change money with the FX man, when it is confirmed, then wallet/convert carries the amount in kobo", async () => {
    const view = engineView();
    const { authority } = await renderWithView(<Bank opening="change" />, view);
    fireEvent.click(radio(say("phone.bank.where"), say("ui.wallet.via.aboki")));
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="change"]')!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    const amount = quarterOf(view.pockets.NGN.cash);
    expect(amount).toBeGreaterThan(0);
    await waitFor(() => expect(authority.sent).toEqual([{ type: "wallet/convert", from: "NGN", to: "GBP", amount, via: "aboki", basedOn: view.v }]));
  });

  test("given Move money refused, then the refusal's words show on the phone and the move sent was naira into the bank", async () => {
    const view = engineView();
    const { authority } = await renderWithView(<PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 10, 6, 30)} talk={null} />, view);
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="bank"]')!);
    fireEvent.click(screen.getByRole("button", { name: say("ui.wallet.move") }));
    authority.rejectNext({ code: "cannot-afford", detail: "" });
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="move"]')!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    expect((await screen.findByRole("alert")).textContent).toContain(text["reject.cannot-afford"]);
    expect(authority.sent[0]).toMatchObject({ type: "wallet/move", currency: "NGN", amount: quarterOf(view.pockets.NGN.cash), to: "bank" });
  });
});

describe("sending money home from the Bank", () => {
  test("[abroad-money:remit-quote-is-shared] given Ada abroad with money in a bank there, when an amount is set, then every channel shows what arrives in naira by the wallet's own quote", async () => {
    const view = abroadView();
    await renderWithView(<Bank opening="send" />, view);
    const currency = sentFirst(view);
    const quote = remitQuote(view.rates, content.tuning.remit, currency, quarterOf(view.pockets[currency].bank));
    for (const channel of ["app", "bank", "informal"] as const) {
      const option = document.querySelector<HTMLElement>(`[data-channel="${channel}"]`)!;
      expect(option.querySelector("[data-arrives]")?.textContent).toBe(say("ui.remit.arrives", { naira: formatMoney(quote[channel].naira, "NGN"), fee: formatMoney(quote[channel].fee, currency) }));
    }
    // The channels differ, so the choice means something.
    expect(new Set(Object.values(quote).map((terms) => terms.naira)).size).toBe(3);
  });

  test("[abroad-money:remit-sends-money-home] given the bank channel picked, when it is sent, then wallet/remit carries the currency, the amount in cents and the channel", async () => {
    const view = abroadView();
    const { authority } = await renderWithView(<Bank opening="send" />, view);
    const currency = sentFirst(view);
    fireEvent.click(document.querySelector<HTMLElement>('[data-channel="bank"]')!);
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="send"]')!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    await waitFor(() => expect(authority.sent).toEqual([{ type: "wallet/remit", currency, amount: quarterOf(view.pockets[currency].bank), channel: "bank", basedOn: view.v }]));
  });

  test("[abroad-money:remit-sends-money-home] given the most the chooser offers, then it is what the bank holds and never more; with nothing in a bank abroad, sending is not offered", async () => {
    const view = abroadView();
    const { authority } = await renderWithView(<Bank opening="send" />, view);
    const currency = sentFirst(view);
    fireEvent.click(radio(say("phone.bank.how-much"), say("phone.bank.all")));
    fireEvent.click(document.querySelector<HTMLElement>('[data-go="send"]')!);
    fireEvent.click(document.querySelector<HTMLElement>("[data-ask-main]")!);
    await waitFor(() => expect(authority.sent[0]).toMatchObject({ type: "wallet/remit", currency, amount: view.pockets[currency].bank }));
    cleanup();

    const empty = Object.fromEntries(Object.entries(view.pockets).map(([money, pocket]) => [money, money === "NGN" ? pocket : { ...pocket, bank: 0 }])) as PlayerView["pockets"];
    await renderWithView(<Bank opening="send" />, { ...view, pockets: empty });
    expect(document.querySelector('[data-chooser="send"]')?.textContent).toBe(say("ui.remit.nothing"));
    expect(document.querySelector('[data-go="send"]')).toBeNull();
  });

  test("[abroad-money:foreign-currencies-join-wallet] given Ada in the UK, then the Bank offers to send money home and money abroad formats in its own currency", async () => {
    await renderWithView(<Bank />, abroadView());
    expect(screen.getByRole("button", { name: say("ui.remit.title") })).toBeDefined();
    expect(formatMoney(150_000, "CAD")).toBe("CA$1,500");
    expect(formatMoney(150_000, "EUR")).toBe("€1,500");
  });

  test("given a life at home, then the Bank has no way to send money home", async () => {
    await renderWithView(<Bank />, engineView());
    expect(screen.queryByRole("button", { name: say("ui.remit.title") })).toBeNull();
  });
});

describe("the family from abroad, in the Bank", () => {
  test("[abroad-money:remit-sends-money-home] given Ada abroad, then the naira at home that requests are paid from shows, with the way to send more", async () => {
    const view = abroadView();
    await renderWithView(<Bank />, view);
    const family = document.querySelector<HTMLElement>("[data-family]")!;
    expect(within(family).getByText(say("ui.family.naira", { bank: formatMoney(view.pockets.NGN.bank, "NGN"), cash: formatMoney(view.pockets.NGN.cash, "NGN") }))).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.remit.title") })).toBeDefined();
  });

  test("given a life at home, then the family card does not show", async () => {
    await renderWithView(<Bank />, engineView());
    expect(document.querySelector("[data-family]")).toBeNull();
    expect(screen.queryByText(say("ui.family.title"))).toBeNull();
  });
});
