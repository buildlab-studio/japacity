// The offers in Jobs as the design's lists sit (its brief, section 1; world.md R-WORLD-018, R-WORLD-021): rows straight
// on the sheet divided by hairlines, no card and no radio circle for a row, the offer picked filled with the pick colour,
// and one main button at the foot that repeats the pick.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadGame, setPockets } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nameOf } from "../../../shared/words/text";
import { phoneWords } from "../phone.words";
import { Jobs } from "./Jobs";

const SHOP = "activity.job-uk-retail-part" as Id<"activity">;
const HUNT = "activity.job-hunt" as Id<"activity">;
const OTHER = "activity.job-teacher" as Id<"activity">;

/** Ada in the UK with the shop job offered, and a second offer beside it. */
function twoOffers() {
  const game = abroadGame();
  // Decision 0035: in the re-recorded life the hunt misses its first months, and landed with no pounds the unpaid dues
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
  test("[R-WORLD-018] [R-WORLD-021] given two offers, when Jobs opens, then they sit as rows on the sheet with no card and no radio circle, the first picked and filled with the pick colour, and one main button at the foot repeats it; picking the other moves the fill and the button's words", async () => {
    await renderWithView(<Jobs />, twoOffers());
    const rows = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("[data-job-offers] [role='radio']")];
    expect(rows()).toHaveLength(2);
    expect(document.querySelector("[data-job-offers] input")).toBeNull();
    expect(rows().map((row) => row.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    expect(rows()[0]!.className).toContain("bg-pick");
    expect(rows()[1]!.className).not.toContain("bg-pick");
    // The rows are divided by the sheet's hairline, never boxed one by one.
    expect(rows()[1]!.closest("li")?.className).toContain("border-sheet-line");
    expect(rows()[1]!.className).not.toMatch(/\bborder\b/);
    const main = (): HTMLElement => document.querySelector<HTMLElement>("[data-take-offer]")!;
    expect(main().className).toContain("btn-main");
    expect(main().textContent).toBe(`${phoneWords("phone.jobs.take")}${nameOf(SHOP)}`);
    fireEvent.click(rows()[1]!);
    expect(rows().map((row) => row.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    expect(main().textContent).toBe(`${phoneWords("phone.jobs.take")}${nameOf(OTHER)}`);
    expect(document.querySelectorAll(".btn-main")).toHaveLength(1);
  });
});
