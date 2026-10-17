// Where the life is in Papers (docs/rules/place.md R-PLACE-009, R-PLACE-004; return.md R-RETURN-001): the country and
// the months here, the fare home as the view gives it with what it takes, and the times
// the life came home, newest first, in words with no month number (world.md R-WORLD-002). The way home itself is the
// bag's Go home (features/city/goHome.place.test.ts).
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadGame, abroadView, decemberAbroadGame, engineView, setPockets } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nairaForFee } from "../../../shared/words/cost";
import { formatMoney } from "../../../shared/words/format";
import { monthsAgo, nameOf, say, sayCount } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";
import { phoneWords } from "../phone.words";

const UK = content.country["country.uk"]!;

async function openPapers(view: PlayerView) {
  const rendered = await renderWithView(<PhoneApps onClose={() => undefined} area="London" now={() => new Date(2026, 9, 11, 12, 0)} talk={null} />, view);
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="papers"]')!);
  return rendered;
}

function placeCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>("[data-papers-place]");
  if (card === null) throw new Error("No place in Papers.");
  return card;
}

describe("where you are, in Papers", () => {
  test("[R-PLACE-009] given Ada just landed, then the country and the months here show and no return is on record", async () => {
    const view = abroadView();
    await openPapers(view);
    const card = within(placeCard());
    expect(card.getByText(say("ui.place.in.country.uk"))).toBeDefined();
    expect(card.getByText(sayCount("ui.place.months-here", view.place.monthsHere, { months: view.place.monthsHere }))).toBeDefined();
    expect(card.queryByRole("list", { name: say("ui.place.returns") })).toBeNull();
  });

  test("[R-PLACE-009] given a new life at home with nothing on record, then Papers shows no place", async () => {
    await openPapers(engineView());
    expect(document.querySelector("[data-papers]")).not.toBeNull();
    expect(document.querySelector("[data-papers-place]")).toBeNull();
  });

  test("[R-PLACE-004] given Ada abroad with no pounds and naira enough, then the fare shows with what it takes from naira", async () => {
    const game = abroadGame();
    setPockets(game, { NGN: 500_000_000 });
    const view = game.view();
    expect(view.pockets.GBP.bank + view.pockets.GBP.cash).toBeLessThan(UK.fare);
    await openPapers(view);
    const fare = within(placeCard().querySelector<HTMLElement>("[data-papers-fare]")!);
    expect(fare.getByText(say("ui.place.fare", { fare: formatMoney(UK.fare, "GBP") }))).toBeDefined();
    expect(fare.getByText(say("ui.place.fare-naira", { naira: formatMoney(nairaForFee(view, "GBP", UK.fare), "NGN") }))).toBeDefined();
  });

  test("[R-PLACE-004] given Ada landed with dollars but neither pounds nor naira enough for the fare, then she is told to change money first", async () => {
    const game = abroadGame();
    setPockets(game, { NGN: 0, GBP: 0, USD: 500000 });
    const view = game.view();
    expect(view.place.wayHome).toMatchObject({ paidFrom: null, shape: null });
    await openPapers(view);
    expect(within(placeCard()).getByText(say("ui.place.fare-short", { fare: formatMoney(UK.fare, "GBP"), naira: formatMoney(nairaForFee(view, "GBP", UK.fare), "NGN") }))).toBeDefined();
  });

  test("[R-PLACE-009] given December abroad, then the fare shown is the view's, the December factor in it, with the off-peak fare beside it", async () => {
    // The journey calendar makes the month of the flight a December, whichever month the recorded life flies in.
    const view = decemberAbroadGame().view();
    expect(view.place.fareHome!.amount).toBeGreaterThan(UK.fare);
    await openPapers(view);
    const card = within(placeCard());
    expect(card.getByText(say("ui.place.fare", { fare: formatMoney(view.place.fareHome!.amount, "GBP") }))).toBeDefined();
    expect(card.getByText(say("ui.place.fare-december-now", { fare: formatMoney(UK.fare, "GBP") }))).toBeDefined();
  });

  test("[R-RETURN-001] given two returns on record, then each reads in words, newest first, with no month number", async () => {
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
    await openPapers(view);
    const items = within(within(placeCard()).getByRole("list", { name: say("ui.place.returns") })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      phoneWords("phone.papers.return", { when: monthsAgo(50, 60), country: nameOf("country.uk"), shape: say("ui.place.shape.with-papers") }),
      phoneWords("phone.papers.return", { when: monthsAgo(30, 60), country: nameOf("country.uk"), shape: say("ui.place.shape.broke") }),
    ]);
    for (const item of items) expect(item.textContent).not.toMatch(/\bmonth \d/i);
    expect(within(placeCard()).getByText(say("ui.place.token", { status: nameOf("status.uk-settled") }))).toBeDefined();
  });

  test("[R-PLACE-009] given a return from the road on record, then it reads as from the road", async () => {
    const base = abroadView();
    const view: PlayerView = { ...base, place: { ...base.place, returns: [{ month: 20, shape: "assisted", country: null }] } };
    await openPapers(view);
    expect(within(placeCard()).getByText(phoneWords("phone.papers.return", { when: monthsAgo(20, view.month), country: say("ui.place.road-name"), shape: say("ui.place.shape.assisted") }))).toBeDefined();
  });
});
