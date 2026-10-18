import { content, text } from "@japacity/content";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, openOffer, recordedGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say, sayCount, words } from "../../shared/words/text";
import { OfferView } from "./OfferView";

const health = content.tuning.health;

describe("illness and the days lost, before the choice", () => {
  test("[R-HEALTH-007] [R-HEALTH-002] given the illness offer from the engine, then both prices are in its words and on its buttons before the choice", async () => {
    const game = newGame();
    const offer = openOffer(game, "offer.illness");
    await renderWithView(<OfferView />, game.view());
    const hospital = formatMoney(health.hospital, "NGN");
    const chemist = formatMoney(health.chemist, "NGN");
    expect(screen.getByText(words("offer.illness.body", { hospital: { currency: "NGN", amount: health.hospital }, chemist: { currency: "NGN", amount: health.chemist } }))).toBeDefined();
    expect(offer.terms).toEqual({ hospital: health.hospital, chemist: health.chemist });
    const thisMonth = say("ui.offer.lock", { slots: sayCount("ui.offer.lock.slots", 1, { count: 1 }), when: sayCount("ui.offer.lock.when", 1, { count: 1 }) });
    expect(screen.getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.illness.choice.hospital"]!, amount: `${hospital}, ${thisMonth}` }) })).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.illness.choice.chemist"]!, amount: chemist }) })).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.illness.choice.ignore"]!, amount: thisMonth }) })).toBeDefined();
  });

  test("[R-HEALTH-006] given a court date abroad, then its one choice says it holds a slot this month", async () => {
    // Ada's long life abroad, a year before its end: sponsored in the UK, where a court date can come (her careful life's cut now ends a student month with a parcel of offers waiting, and lapses soon after).
    const game = recordedGame("ada-abroad", 12);
    expect(game.view().place.where).toBe("abroad");
    // The court date comes over a loan still owed abroad: what a repossessed car leaves behind.
    viewAfter(game, [{ type: "obligation/open", obligation: "obligation.car-shortfall", principal: 120_000 }]);
    openOffer(game, "offer.court-date");
    await renderWithView(<OfferView />, game.view());
    const next = say("ui.offer.lock", { slots: sayCount("ui.offer.lock.slots", 1, { count: 1 }), when: say("ui.offer.lock.next") });
    expect(screen.getByRole("button", { name: say("ui.offer.choice-cost", { choice: text["offer.court-date.choice.attend"]!, amount: next }) })).toBeDefined();
  });});
