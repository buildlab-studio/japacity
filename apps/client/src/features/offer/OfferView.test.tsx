import { text } from "@japacity/content";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { OfferView } from "./OfferView";

describe("offers", () => {
  test("given no offers, then nobody is asking", async () => {
    await renderWithView(<OfferView />, engineView());
    expect(screen.getByText(say("ui.offer.none"))).toBeDefined();
  });

  test("given an offer with terms, then the title and body are content's words with the terms filled in", async () => {
    await renderWithView(<OfferView />, richView());
    expect(screen.getByRole("heading", { name: text["offer.land-buyer.title"]! })).toBeDefined();
    const body = text["offer.land-buyer.body"]!.replace("{price}", formatMoney(900_000_000, "NGN"));
    expect(screen.getByText(body)).toBeDefined();
    expect(screen.getByText(say("ui.offer.expires", { month: 12 }))).toBeDefined();
  });

  test("given an offer with signs, then each sign shown is in content's words", async () => {
    await renderWithView(<OfferView />, richView());
    expect(screen.getByText(text["offer.held-funds-agent.sign.cash-only"]!)).toBeDefined();
    expect(screen.getByText(text["offer.held-funds-agent.sign.my-guy"]!)).toBeDefined();
    expect(screen.queryByText(text["offer.held-funds-agent.sign.office"]!)).toBeNull();
  });

  test("given a plain choice, when it is clicked, then offer/choose is sent without an amount", async () => {
    const view = richView();
    const { authority } = await renderWithView(<OfferView />, view);
    fireEvent.click(screen.getByRole("button", { name: text["offer.land-buyer.choice.hold"]! }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "offer/choose", offer: "offer-7", choice: "hold", basedOn: view.v }]));
  });

  test("given a choice that picks an amount, when an amount is typed, then offer/choose carries it in kobo", async () => {
    const view = richView();
    const { authority } = await renderWithView(<OfferView />, view);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5000000" } });
    fireEvent.click(screen.getByRole("button", { name: text["offer.held-funds-agent.choice.take"]! }));
    await waitFor(() =>
      expect(authority.sent).toEqual([{ type: "offer/choose", offer: "offer-8", choice: "take", amount: 500_000_000, basedOn: view.v }]),
    );
  });

  test("given an amount above the offer's most, then it is held at the most", async () => {
    const view = richView();
    const { authority } = await renderWithView(<OfferView />, view);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "999999999" } });
    fireEvent.click(screen.getByRole("button", { name: text["offer.held-funds-agent.choice.take"]! }));
    await waitFor(() => expect(authority.sent[0]).toMatchObject({ amount: 4_000_000_000 }));
  });
});
