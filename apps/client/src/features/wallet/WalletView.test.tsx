import { text } from "@japacity/content";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { WalletView } from "./WalletView";

describe("money", () => {
  test("given a new life, then the naira pockets and both rates are shown as money", async () => {
    const view = engineView();
    await renderWithView(<WalletView />, view);
    expect(screen.getByText(formatMoney(view.pockets.NGN.bank, "NGN"))).toBeDefined();
    expect(screen.getByText(formatMoney(view.pockets.NGN.cash, "NGN"))).toBeDefined();
    expect(screen.getByText(formatMoney(view.rates.GBP.official, "NGN"))).toBeDefined();
    expect(screen.getByText(formatMoney(view.rates.USD.street, "NGN"))).toBeDefined();
    expect(screen.getByText(say("ui.wallet.allowance", { amount: formatMoney(view.bankAllowanceLeft, "USD") }))).toBeDefined();
  });

  test("given a queued conversion, then it shows what was paid and when it lands", async () => {
    await renderWithView(<WalletView />, richView());
    expect(screen.getByText(say("ui.wallet.queued.item", { paid: formatMoney(50_000_000, "NGN"), to: say("ui.currency.USD"), month: 13 }))).toBeDefined();
  });

  test("given the change money form, when it is filled and sent, then wallet/convert carries the amount in kobo", async () => {
    const view = engineView();
    const { authority } = await renderWithView(<WalletView />, view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.wallet.convert") }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText(say("ui.wallet.amount")), { target: { value: "50,000" } });
    fireEvent.click(within(sheet).getByLabelText(say("ui.wallet.via.aboki")));
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.wallet.send") }));
    await waitFor(() =>
      expect(authority.sent).toEqual([{ type: "wallet/convert", from: "NGN", to: "GBP", amount: 5_000_000, via: "aboki", basedOn: view.v }]),
    );
  });

  test("given the move form is rejected, then the rejection's words show in the form", async () => {
    const { authority } = await renderWithView(<WalletView />, engineView());
    authority.rejectNext({ code: "cannot-afford", detail: "" });
    fireEvent.click(screen.getByRole("button", { name: say("ui.wallet.move") }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.change(within(sheet).getByLabelText(say("ui.wallet.amount")), { target: { value: "1000" } });
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.wallet.send") }));
    expect((await within(sheet).findByRole("alert")).textContent).toContain(text["reject.cannot-afford"]);
    expect(authority.sent[0]).toMatchObject({ type: "wallet/move", currency: "NGN", amount: 100_000, to: "bank" });
  });
});
