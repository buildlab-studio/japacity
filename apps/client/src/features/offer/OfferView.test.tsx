import { content, text } from "@japacity/content";
import type { OfferView as Offer, PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say, words } from "../../shared/words/text";
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

  test("given a job offer, then the card names the job and its pay", async () => {
    const offer: Offer = {
      id: "offer-1",
      entry: "offer.job",
      openedMonth: 2,
      expiresMonth: 4,
      terms: { job: "activity.job-teacher" },
      signs: [],
      choices: [
        { id: "accept", allowed: true, pick: null },
        { id: "decline", allowed: true, pick: null },
      ],
    };
    const view: PlayerView = { ...engineView(), offers: [offer] };
    await renderWithView(<OfferView />, view);
    const pay = content.activity["activity.job-teacher"]?.pay;
    if (pay === null || pay === undefined || typeof pay.amount !== "number") throw new Error("The teacher job has no pay.");
    expect(screen.getByText(say("ui.offer.job", { job: nameOf("activity.job-teacher"), amount: formatMoney(pay.amount, pay.currency) }))).toBeDefined();
  });

  test("given a choice that costs money, then its button shows the amount", async () => {
    const offer: Offer = {
      id: "offer-2",
      entry: "offer.fuel-scarcity",
      openedMonth: 2,
      expiresMonth: 3,
      terms: {},
      signs: [],
      choices: [
        { id: "pay", allowed: true, pick: null },
        { id: "trek", allowed: true, pick: null },
      ],
    };
    await renderWithView(<OfferView />, { ...engineView(), offers: [offer] });
    expect(screen.getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.fuel-scarcity.choice.pay"]!, amount: formatMoney(3_000_000, "NGN") }) })).toBeDefined();
    expect(screen.getByRole("button", { name: text["offer.fuel-scarcity.choice.trek"]! })).toBeDefined();
  });

  test("given a choice is made, then what it moved is shown", async () => {
    const { authority } = await renderWithView(<OfferView />, richView());
    const moved = { key: "line.quality.loss", params: { quality: "quality.wellbeing", amount: 7, value: 60 }, tone: "bad" as const, attention: false, counts: [] };
    authority.linesNext([moved]);
    fireEvent.click(screen.getByRole("button", { name: text["offer.land-buyer.choice.hold"]! }));
    const status = await screen.findByRole("status");
    expect(status.textContent).toContain(say("ui.offer.outcome"));
    expect(status.textContent).toContain(words(moved.key, moved.params));
  });
});
