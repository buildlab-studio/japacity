// Where the life is in Papers (place:view-shows-place-and-returns, place:return-home-paid-or-assisted; return:return-record-in-words): the country and
// the months here, the fare home as the view gives it with what it takes, and the times
// the life came home, newest first, in words with no month number (world:top-band-is-a-pill). The way home itself is the
// bag's Go home (features/city/acts/goHome.place.test.ts).
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { within } from "@testing-library/react";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { abroadGame, abroadView, decemberAbroadGame, engineView } from "../../../shared/testing/fixtures";
import { nairaForFee } from "../../../shared/words/cost";
import { formatMoney } from "../../../shared/words/format";
import { monthsAgo, nameOf, say, sayCount } from "../../../shared/words/text";
import { openPapers } from "../phone.testing";

const UK = content.country["country.uk"]!;

function placeCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>("[data-papers-place]");
  if (card === null) throw new Error("No place in Papers.");
  return card;
}

describe("where you are, in Papers", () => {
  test("[place:view-shows-place-and-returns] given the graduate just landed, then the country and the months here show and no return is on record", async () => {
    const view = abroadView();
    await openPapers(view, "London");
    const card = within(placeCard());
    expect(card.getByText(say("ui.place.in.country.uk"))).toBeDefined();
    expect(card.getByText(sayCount("ui.place.months-here", view.place.monthsHere, { months: view.place.monthsHere }))).toBeDefined();
    expect(card.queryByRole("list", { name: say("ui.place.returns") })).toBeNull();
  });

  test("[place:view-shows-place-and-returns] given a new life at home with nothing on record, then Papers shows no place", async () => {
    await openPapers(engineView(), "London");
    expect(document.querySelector("[data-papers]")).not.toBeNull();
    expect(document.querySelector("[data-papers-place]")).toBeNull();
  });

  test("[place:return-home-paid-or-assisted] given the graduate abroad with no pounds and naira enough, then the fare shows with what it takes from naira", async () => {
    const game = abroadGame();
    setPockets(game, { NGN: 500_000_000 });
    const view = game.view();
    expect(view.pockets.GBP.bank + view.pockets.GBP.cash).toBeLessThan(UK.fare);
    await openPapers(view, "London");
    const fare = within(placeCard().querySelector<HTMLElement>("[data-papers-fare]")!);
    expect(fare.getByText(say("ui.place.fare", { fare: formatMoney(UK.fare, "GBP") }))).toBeDefined();
    expect(fare.getByText(say("ui.place.fare-naira", { naira: formatMoney(nairaForFee(view, "GBP", UK.fare), "NGN") }))).toBeDefined();
  });

  test("[place:return-home-paid-or-assisted] given the graduate landed with dollars but neither pounds nor naira enough for the fare, then it is told to change money first", async () => {
    const game = abroadGame();
    setPockets(game, { NGN: 0, GBP: 0, USD: 500000 });
    const view = game.view();
    expect(view.place.wayHome).toMatchObject({ paidFrom: null, shape: null });
    await openPapers(view, "London");
    expect(within(placeCard()).getByText(say("ui.place.fare-short", { fare: formatMoney(UK.fare, "GBP"), naira: formatMoney(nairaForFee(view, "GBP", UK.fare), "NGN") }))).toBeDefined();
  });

  test("[place:view-shows-place-and-returns] given December abroad, then the fare shown is the view's, the December factor in it, with the off-peak fare beside it", async () => {
    // The journey calendar makes the month of the flight a December, whichever month the recorded life flies in.
    const view = decemberAbroadGame().view();
    expect(view.place.fareHome!.amount).toBeGreaterThan(UK.fare);
    await openPapers(view, "London");
    const card = within(placeCard());
    expect(card.getByText(say("ui.place.fare", { fare: formatMoney(view.place.fareHome!.amount, "GBP") }))).toBeDefined();
    expect(card.getByText(say("ui.place.fare-december-now", { fare: formatMoney(UK.fare, "GBP") }))).toBeDefined();
  });

  test("[return:return-record-in-words] given two returns on record, then each reads in words, newest first, with no month number", async () => {
    const view: PlayerView = {
      ...engineView(),
      month: 60,
      place: {
        where: "home",
        country: null,
        monthsHere: 4,
        returns: [
          { month: 50, shape: "with-papers", country: "country.uk" },
          { month: 30, shape: "broke", country: "country.uk" },
        ],
        heldAbroad: "status.uk-settled",
        fareHome: null, fareBp: 10000, wayHome: null,
      },
    };
    await openPapers(view, "London");
    const items = within(within(placeCard()).getByRole("list", { name: say("ui.place.returns") })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      say("phone.papers.return", { when: monthsAgo(50, 60), country: nameOf("country.uk"), shape: say("ui.place.shape.with-papers") }),
      say("phone.papers.return", { when: monthsAgo(30, 60), country: nameOf("country.uk"), shape: say("ui.place.shape.broke") }),
    ]);
    for (const item of items) expect(item.textContent).not.toMatch(/\bmonth \d/i);
    expect(within(placeCard()).getByText(say("ui.place.token", { status: nameOf("status.uk-settled") }))).toBeDefined();
  });

  test("[place:view-shows-place-and-returns] given a return from the road on record, then it reads as from the road", async () => {
    const base = abroadView();
    const view: PlayerView = { ...base, place: { ...base.place, returns: [{ month: 20, shape: "assisted", country: null }] } };
    await openPapers(view, "London");
    expect(within(placeCard()).getByText(say("phone.papers.return", { when: monthsAgo(20, view.month), country: say("ui.place.road-name"), shape: say("ui.place.shape.assisted") }))).toBeDefined();
  });
});
