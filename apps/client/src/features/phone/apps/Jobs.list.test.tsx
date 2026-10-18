// The offers in Jobs in the lively dress (world.md R-WORLD-018, R-WORLD-021): each offer a
// card with its picture, no radio circle, the offer picked ringed in yellow, and one yellow button at the foot that
// repeats the pick.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { fireEvent } from "@testing-library/react";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { abroadGame } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nameOf, say } from "../../../shared/words/text";
import { Jobs } from "./Jobs";

const SHOP = "activity.job-uk-retail-part" as Id<"activity">;
const HUNT = "activity.job-hunt" as Id<"activity">;
const OTHER = "activity.job-teacher" as Id<"activity">;

/** Ada in the UK with the shop job offered, and a second offer beside it. */
function twoOffers() {
  const game = abroadGame();
  // Decision 0013: in the re-recorded life the hunt misses its first months, and landed with no pounds the unpaid dues
  // would take her student status, and the shop job with it, before an offer comes. So each month's pound dues are
  // covered before she hunts, and she stays a student who may work part time.
  for (let month = 0; month < 24 && !game.view().offers.some((offer) => offer.terms.job === SHOP); month += 1) {
    setPockets(game, { GBP: game.view().obligations.reduce((sum, owed) => sum + owed.due, 0) });
    game.endTurn([{ activity: HUNT, param: SHOP }]);
  }
  const view = game.view();
  const shop = view.offers.find((offer) => offer.terms.job === SHOP);
  if (shop === undefined || content.activity[OTHER] === undefined) throw new Error("No offer to copy.");
  return { ...view, offers: [shop, { ...shop, id: "offer-second", terms: { ...shop.terms, job: OTHER } }] };
}

describe("the offers in Jobs", () => {
  test("[R-WORLD-018] [R-WORLD-021] given two offers, when Jobs opens, then each is a card with the job's picture and no radio circle, the first picked and ringed, its pay as a green chip, and one yellow button at the foot repeats it; picking the other moves the ring and the button's words", async () => {
    await renderWithView(<Jobs />, twoOffers());
    const rows = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("[data-job-offers] [role='radio']")];
    expect(rows()).toHaveLength(2);
    expect(document.querySelector("[data-job-offers] input")).toBeNull();
    expect(rows().map((row) => row.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    // A card each, the picked one ringed, never a hairline row filled with the pick colour.
    const card = (row: HTMLElement): HTMLElement | null => row.querySelector("[data-lively-card]");
    expect(rows().map((row) => card(row)?.getAttribute("data-picked") ?? null)).toEqual(["true", null]);
    expect(card(rows()[0]!)?.className).toContain("phone-picked");
    expect(card(rows()[1]!)?.className).not.toContain("phone-picked");
    expect(rows().map((row) => row.querySelector("[data-tile]")?.getAttribute("data-tile"))).toEqual([SHOP, OTHER]);
    expect(rows().every((row) => row.querySelector("[data-money-chip]") !== null)).toBe(true);
    const main = (): HTMLElement => document.querySelector<HTMLElement>("[data-take-offer]")!;
    expect(main().className).toContain("press-button");
    expect(main().textContent).toBe(`${say("phone.jobs.take")}·${nameOf(SHOP)}`);
    fireEvent.click(rows()[1]!);
    expect(rows().map((row) => row.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    expect(rows().map((row) => card(row)?.getAttribute("data-picked") ?? null)).toEqual([null, "true"]);
    expect(main().textContent).toBe(`${say("phone.jobs.take")}·${nameOf(OTHER)}`);
    expect(document.querySelectorAll("[data-press-button]")).toHaveLength(1);
  });
});
