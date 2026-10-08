import { content } from "@japacity/content";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { remitQuote } from "../../shared/sim/remit";
import { abroadView, engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { RemitButton } from "../../shared/ui/RemitSheet";
import { WalletView } from "./WalletView";

describe("sending money home", () => {
  test("[R-ABROAD-008] given Ada abroad with dollars, when an amount is typed, then every channel shows what arrives in naira by the wallet's own quote", async () => {
    const view = abroadView();
    await renderWithView(<RemitButton />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.remit.title") }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText(say("ui.remit.amount", { currency: say("ui.currency.USD").toLowerCase() })), { target: { value: "100" } });
    const quote = remitQuote(view.rates, content.tuning.remit, "USD", 10_000);
    for (const channel of ["app", "bank", "informal"] as const) {
      const option = sheet.querySelector(`[data-channel="${channel}"]`) as HTMLElement;
      expect(within(option).getByText(say("ui.remit.arrives", { naira: formatMoney(quote[channel].naira, "NGN"), fee: formatMoney(quote[channel].fee, "USD") }))).toBeDefined();
    }
    // The channels differ, so the choice means something.
    expect(new Set(Object.values(quote).map((terms) => terms.naira)).size).toBe(3);
  });

  test("[R-ABROAD-006] given the bank channel picked, when it is sent, then wallet/remit carries the currency, the amount in cents and the channel", async () => {
    const view = abroadView();
    const { authority } = await renderWithView(<RemitButton />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.remit.title") }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText(say("ui.remit.amount", { currency: say("ui.currency.USD").toLowerCase() })), { target: { value: "150" } });
    fireEvent.click(within(sheet).getByLabelText(new RegExp(say("ui.remit.channel.bank"))));
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.remit.send") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "wallet/remit", currency: "USD", amount: 15_000, channel: "bank", basedOn: view.v }]));
  });

  test("[R-ABROAD-006] given more typed than the bank holds, then sending is not offered", async () => {
    const view = abroadView();
    await renderWithView(<RemitButton />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.remit.title") }));
    const sheet = await screen.findByRole("dialog");
    const tooMuch = String(view.pockets.USD.bank / 100 + 1);
    fireEvent.change(within(sheet).getByLabelText(say("ui.remit.amount", { currency: say("ui.currency.USD").toLowerCase() })), { target: { value: tooMuch } });
    expect(within(sheet).getByRole<HTMLButtonElement>("button", { name: say("ui.remit.send") }).disabled).toBe(true);
  });

  test("[R-ABROAD-001] given Ada in the UK, then the wallet offers to send money home and money abroad formats in its own currency", async () => {
    await renderWithView(<WalletView />, abroadView());
    expect(screen.getByRole("button", { name: say("ui.remit.title") })).toBeDefined();
    expect(formatMoney(150_000, "CAD")).toBe("CA$1,500");
    expect(formatMoney(150_000, "EUR")).toBe("€1,500");
  });

  test("given a life at home, then there is no way to send money home", async () => {
    await renderWithView(<WalletView />, engineView());
    expect(screen.queryByRole("button", { name: say("ui.remit.title") })).toBeNull();
  });
});
