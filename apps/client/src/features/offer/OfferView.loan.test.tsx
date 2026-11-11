// The study lender's card (route:education-loan-pays-the-school): what it pays the university for the amount picked, the lender's fee added
// to the loan and the fee to process, and that nothing is charged while the course runs, all in pounds and in words before the tap.
import { content } from "@japacity/content";
import type { Game } from "@japacity/sim/testing";
import { offeredSeed, readyLife, toApplied } from "@japacity/sim/testing";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { openOffer } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/person";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { OfferView } from "./OfferView";

const LOAN = "offer.education-loan";

/** A ready life with Northgate's deposit paid and its visa applied for, the lender's offer open. */
function lent(): { game: Game; max: number; min: number; fee: number } {
  const game = readyLife(content, { seed: offeredSeed(content), quiet: true });
  toApplied(game);
  const offer = openOffer(game, LOAN);
  return { game, max: Number(offer.terms.max), min: Number(offer.terms.min), fee: Number(offer.terms.fee) };
}

const card = () => document.querySelector(`[data-ask="${LOAN}"]`);

describe("the study lender's card", () => {
  test("[route:education-loan-pays-the-school] given the lender's offer, when its card shows, then the amount is picked in pounds between the floor and the tuition left, and the body says them in pounds", async () => {
    const { game, max, min, fee } = lent();
    await renderWithGame(<OfferView />, game);
    const shown = card()?.textContent ?? "";
    expect(shown).toContain(say("ui.offer.bounds", { min: formatMoney(min, "GBP"), max: formatMoney(max, "GBP") }));
    expect(shown).toContain(formatMoney(fee, "GBP"));
    expect(shown).not.toContain("₦");
  });

  test("[route:education-loan-pays-the-school] given an amount picked, when the card shows, then it says what goes to the university, what is owed with the lender's fee, and that charges start only after the course", async () => {
    const { game, min } = lent();
    await renderWithGame(<OfferView />, game);
    const input = card()?.querySelector<HTMLInputElement>('input[type="number"]');
    if (input === null || input === undefined) throw new Error("No amount to pick.");
    const picked = min * 3;
    fireEvent.change(input, { target: { value: String(picked / 100) } });
    const owed = picked + Math.floor((picked * content.tuning.route.loanFeeBp) / 10_000);
    expect(screen.getByText(say("ui.offer.loan.pays", { amount: formatMoney(picked, "GBP"), owed: formatMoney(owed, "GBP") }))).toBeDefined();
    expect(card()?.querySelector("[data-loan-starts]")?.textContent).toBe(say("ui.offer.loan.starts", { years: 15 }));
  });
});

describe("the amount's help (world:field-says-its-state)", () => {
  test("[world:field-says-its-state] given the lender's offer, when its card shows, then what the amount may be stands under the label as help in the quiet ink with no icon, over the slider and the box, which it describes", async () => {
    const { game, max, min } = lent();
    await renderWithGame(<OfferView />, game);
    const box = card()!.querySelector<HTMLInputElement>("input[type='number']")!;
    const help = document.getElementById(box.getAttribute("aria-describedby") ?? "")!;
    expect(help.textContent).toBe(say("ui.offer.bounds", { min: formatMoney(min, "GBP"), max: formatMoney(max, "GBP") }));
    expect(help.className.split(" ")).toContain("text-text-2");
    expect(help.className).not.toMatch(/font-bold/);
    expect(help.querySelector("svg")).toBeNull();
    const label = card()!.querySelector(`label[for='${box.id}']`)!;
    const slider = card()!.querySelector("input[type='range']")!;
    const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(label, help) && follows(help, slider) && follows(slider, box)).toBe(true);
  });
});
