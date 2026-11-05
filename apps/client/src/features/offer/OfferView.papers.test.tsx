import { text } from "@japacity/content";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { openOffer, newGame } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/person";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { OfferView } from "./OfferView";

const PAPERS = "offer.papers-marriage";

describe("the papers offer", () => {
  test("[person:papers-marriage-offer] given the papers offer open, then it reads as any offer, with its fee in naira on the take button and its warning signs from content", async () => {
    const game = newGame("scenario.banker");
    const offer = openOffer(game, PAPERS);
    const fee = offer.terms.fee as number;
    const { authority } = await renderWithGame(<OfferView />, game);
    const shown = screen.getByRole("heading", { name: text[`${PAPERS}.title`]! }).closest("li")!;
    expect(within(shown).getByText(text[`${PAPERS}.body`]!.replace("{fee}", formatMoney(fee, "NGN")))).toBeDefined();
    // advice:scams-show-their-tells: the first sign shows at once, the rest after the free look.
    if (offer.signs.length > 1) fireEvent.click(within(shown).getByRole("button", { name: say("ui.offer.look") }));
    for (const sign of offer.signs) expect(within(shown).getByText(text[`${PAPERS}.sign.${sign}`]!)).toBeDefined();
    const take = within(shown).getByRole("button", { name: say("ui.offer.choice-cost", { choice: text[`${PAPERS}.choice.take`]!, amount: formatMoney(fee, "NGN") }) });
    fireEvent.click(within(shown).getByRole("button", { name: text[`${PAPERS}.choice.walk-away`]! }));
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "offer/choose", choice: "walk-away" }));
    expect(take).toBeDefined();
  });
});
