import { content, text } from "@japacity/content";
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, openOffer, recordedGame, recordedSave, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say, words } from "../../shared/words/text";
import { OfferView } from "./OfferView";
import { moneyTerms, offerParams } from "./terms";

/**
 * How far back in Ada's recorded life a school's offer is held while the study window is open. Restated for
 * R-ACTIVITY-015: the life was re-cut with its now-acts sent at once and is longer, so the offer is held 103 to 121
 * commands back (it was 84); the middle is taken.
 */
/** The first cut of the recording, counted from its end, at which the scholarship round can open with a school's offer held: found, since the recording moves as content does. */
function scholarshipDrop(): number {
  const save = recordedSave("ada-careful");
  for (let drop = 1; drop < save.commands.length; drop += 1) {
    const game = recordedGame("ada-careful", drop);
    if (!game.view().routes.some((route) => route.schools.some((school) => school.state === "offer"))) continue;
    const opened = viewAfter(game, [{ type: "offer/open", offer: "offer.scholarship-round" }]).offers.some((item) => item.entry === "offer.scholarship-round");
    if (opened) return drop;
  }
  throw new Error("No cut of Ada's life opens the scholarship round with a school's offer held.");
}
const SCHOLARSHIP_DROP = scholarshipDrop();

/** The card of the one offer open, by its title. */
function cardOf(entry: string): HTMLElement {
  const card = screen.getByRole("heading", { name: words(`${entry}.title`) }).closest("li");
  if (card === null) throw new Error(`No card for ${entry}.`);
  return card;
}

/** No brace left unfilled, no kobo on money, no raw object. */
function expectClean(card: HTMLElement): void {
  expect(card.textContent).not.toMatch(/\{[A-Za-z]|\[object Object\]|[₦£$]\d[\d,]*\.\d/);
}

describe("the luck offers and the offers abroad, from the engine", () => {
  test("[R-LUCK-002] given the whip-round opened for Ada, then its words and both choices show, and what it pays is money in naira", async () => {
    const game = newGame();
    const offer = openOffer(game, "offer.whip-round");
    expect(moneyTerms("offer.whip-round").get("rescue")).toBe("NGN");
    expect(offerParams(offer)).toEqual({ rescue: { currency: "NGN", amount: content.tuning.luck.rescue } });
    await renderWithView(<OfferView />, game.view());
    const card = cardOf("offer.whip-round");
    expect(within(card).getByText(words("offer.whip-round.body", offerParams(offer)))).toBeDefined();
    expect(within(card).getByRole("button", { name: text["offer.whip-round.choice.accept"]! })).toBeDefined();
    expect(within(card).getByRole("button", { name: text["offer.whip-round.choice.decline"]! })).toBeDefined();
    expectClean(card);
  });

  test("[R-LUCK-007] given the telco promo, then claiming it shows the fee it takes and never the prize, and its signs are content's words", async () => {
    const game = newGame();
    const offer = openOffer(game, "offer.telco-promo");
    await renderWithView(<OfferView />, game.view());
    const card = cardOf("offer.telco-promo");
    expect(within(card).getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.telco-promo.choice.claim"]!, amount: formatMoney(200_000, "NGN") }) })).toBeDefined();
    expect(card.textContent).not.toContain(formatMoney(content.tuning.luck.promo, "NGN"));
    for (const sign of offer.signs) expect(within(card).getByText(text[`offer.telco-promo.sign.${sign}`]!)).toBeDefined();
    expectClean(card);
  });

  test("[R-LUCK-010] given the scholarship round on Ada's life with a school's offer held, then it shows in content's words with nothing to pay", async () => {
    const game = recordedGame("ada-careful", SCHOLARSHIP_DROP);
    const offer = openOffer(game, "offer.scholarship-round");
    await renderWithView(<OfferView />, game.view());
    const card = cardOf("offer.scholarship-round");
    expect(within(card).getByText(words("offer.scholarship-round.body", offerParams(offer)))).toBeDefined();
    expect(within(card).getByRole("button", { name: text["offer.scholarship-round.choice.accept"]! })).toBeDefined();
    expectClean(card);
  });

  test("[R-ABROAD-007] given a family request opened abroad, then {cost} fills from the item's own terms, scaled for a relative abroad, in naira", async () => {
    const game = recordedGame("ada-careful");
    const offer = openOffer(game, "offer.roof");
    const home = content.offer["offer.roof"]!.terms.cost as number;
    expect(offer.terms.cost).toBeGreaterThan(home);
    await renderWithView(<OfferView />, game.view());
    const card = cardOf("offer.roof");
    expect(card.textContent).toContain(formatMoney(offer.terms.cost as number, "NGN"));
    expect(card.textContent).not.toContain(formatMoney(home, "NGN"));
    expectClean(card);
  });

  test("given a sponsor's offer, then its salary is in pounds, the currency of the route it records the sponsor on", async () => {
    const entry = content.offer["offer.sponsor-trust"]!;
    const salary = entry.terms.salary as number;
    const offer = { id: "offer-1", entry: entry.id, openedMonth: 0, expiresMonth: 2, terms: { salary }, signs: [], choices: [{ id: "take", allowed: true, pick: null }] };
    expect(offerParams(offer)).toEqual({ salary: { currency: "GBP", amount: salary } });
    await renderWithView(<OfferView />, { ...newGame().view(), offers: [offer] });
    const card = cardOf("offer.sponsor-trust");
    expect(card.textContent).toContain(formatMoney(salary, "GBP"));
    expectClean(card);
  });
});
