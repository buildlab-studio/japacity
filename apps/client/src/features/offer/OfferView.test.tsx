import { content, text } from "@japacity/content";
import type { OfferView as Offer, PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { byMonths, nameOf, say, words } from "../../shared/words/text";
import { OfferView } from "./OfferView";

describe("offers", () => {
  test("given no offers, then nobody is asking", async () => {
    await renderWithView(<OfferView />, engineView());
    expect(screen.getByText(say("ui.offer.none"))).toBeDefined();
  });

  test("given an offer with terms, then the title and body are content's words with the terms filled in", async () => {
    const view = richView();
    await renderWithView(<OfferView />, view);
    expect(screen.getByRole("heading", { name: text["offer.land-buyer.title"]! })).toBeDefined();
    const body = text["offer.land-buyer.body"]!.replace("{price}", formatMoney(900_000_000, "NGN"));
    expect(screen.getByText(body)).toBeDefined();
    expect(screen.getByText(say("ui.offer.expires", { when: byMonths(12, view.month) }))).toBeDefined();
  });

  test("[advice:scams-show-their-tells] given an offer with two signs, then the first shows at once in content's words, the other only after the free look, and a sign the offer did not open with never shows", async () => {
    await renderWithView(<OfferView />, richView());
    expect(screen.getByText(text["offer.held-funds-agent.sign.cash-only"]!)).toBeDefined();
    expect(screen.queryByText(text["offer.held-funds-agent.sign.my-guy"]!)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.offer.look") }));
    expect(screen.getByText(text["offer.held-funds-agent.sign.cash-only"]!)).toBeDefined();
    expect(screen.getByText(text["offer.held-funds-agent.sign.my-guy"]!)).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.offer.look") })).toBeNull();
    expect(screen.queryByText(text["offer.held-funds-agent.sign.office"]!)).toBeNull();
  });

  test("[advice:scams-show-their-tells] given the radio's pitch with all its signs, then one sign shows, the look costs nothing and sends nothing, and after it every sign shows", async () => {
    const view = richView();
    const radio = { id: "offer-radio", entry: "offer.road-radio" as Offer["entry"], openedMonth: view.month, expiresMonth: view.month + 2, terms: { deposit: 50_000_000 }, signs: ["too-cheap", "no-paper", "agency-warning"], choices: [{ id: "take", allowed: true, pick: null }, { id: "ignore", allowed: true, pick: null }] } as unknown as Offer;
    const { authority } = await renderWithView(<OfferView />, { ...view, offers: [radio] } as PlayerView);
    const card = document.querySelector("[data-ask='offer.road-radio']")!;
    expect([...card.querySelectorAll("[data-ask-sign]")].map((sign) => sign.getAttribute("data-ask-sign"))).toEqual(["too-cheap"]);
    const sent = authority.sent.length;
    fireEvent.click(screen.getByRole("button", { name: say("ui.offer.look") }));
    expect(authority.sent.length).toBe(sent);
    expect([...card.querySelectorAll("[data-ask-sign]")].map((sign) => sign.textContent?.replace("👀", ""))).toEqual(["too-cheap", "no-paper", "agency-warning"].map((sign) => text[`offer.road-radio.sign.${sign}`]));
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

describe("a job offer's warning", () => {
  test("[activity:side-job-holds-a-slot] [world:nudge-says-one-thing] given a nurse on the care route offered a side job, then the offer never says the job ends her months as a nurse; a main job elsewhere still does", async () => {
    const base = richView();
    const offer = base.offers[0];
    if (offer === undefined) throw new Error("No offer");
    const nurse = {
      ...base,
      job: { id: "activity.job-nurse" as const, months: 3, side: null, pay: null, sidePay: null },
      routes: [{ ...base.routes[0]!, id: "route.uk-care" as const, state: "heard" as const }],
    };
    const side = Object.values(content.activity).find((entry) => entry.slot === "side" && entry.hireBp !== null);
    const main = Object.values(content.activity).find((entry) => entry.slot === "main" && entry.hireBp !== null && entry.id !== "activity.job-nurse");
    if (side === undefined || main === undefined) throw new Error("No side or main job in content");
    await renderWithView(<OfferView />, { ...nurse, offers: [{ ...offer, terms: { ...offer.terms, job: side.id } }] });
    expect(document.querySelector("[data-offer-job-ends]")).toBeNull();
    document.body.innerHTML = "";
    await renderWithView(<OfferView />, { ...nurse, offers: [{ ...offer, terms: { ...offer.terms, job: main.id } }] });
    expect(document.querySelector("[data-offer-job-ends]")).not.toBeNull();
  });
});
