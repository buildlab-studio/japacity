import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView, engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nairaForFee } from "../../shared/words/cost";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say, sayCount } from "../../shared/words/text";
import { FamilyView } from "./FamilyView";
import { PlaceView } from "./PlaceView";
import { wayHome } from "../../shared/words/wayHome";

const UK = content.country["country.uk"]!;

describe("where you are and the way home", () => {
  test("[R-PLACE-009] given Ada just landed, then the country and the months here show and no return is on record", async () => {
    const view = abroadView();
    await renderWithView(<PlaceView />, view);
    expect(screen.getByText(say("ui.place.in.country.uk"))).toBeDefined();
    expect(screen.getByText(sayCount("ui.place.months-here", view.place.monthsHere, { months: view.place.monthsHere }))).toBeDefined();
    expect(screen.queryByRole("list", { name: say("ui.place.returns") })).toBeNull();
  });

  test("[R-PLACE-009] given a new life at home with nothing on record, then the panel does not show", async () => {
    await renderWithView(<PlaceView />, engineView());
    expect(screen.queryByText(say("ui.place.title"))).toBeNull();
  });

  test("[R-PLACE-004] given Ada abroad with no pounds and naira enough, then the fare shows with what it takes from naira, and going home sends return/home", async () => {
    const base = abroadView();
    expect(base.pockets.GBP.bank + base.pockets.GBP.cash).toBeLessThan(UK.fare);
    const view: PlayerView = { ...base, pockets: { ...base.pockets, NGN: { bank: 500_000_000, cash: 0, locked: 0 } } };
    const { authority } = await renderWithView(<PlaceView />, view);
    const card = screen.getByText(say("ui.place.way-home")).closest("[data-way-home]") as HTMLElement;
    expect(within(card).getByText(say("ui.place.fare", { fare: formatMoney(UK.fare, "GBP") }))).toBeDefined();
    expect(within(card).getByText(say("ui.place.fare-naira", { naira: formatMoney(nairaForFee(view, "GBP", UK.fare), "NGN") }))).toBeDefined();
    fireEvent.click(within(card).getByRole("button", { name: say("ui.place.go") }));
    fireEvent.click(within(card).getByRole("button", { name: say("ui.place.go-yes") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "return/home", basedOn: view.v }]));
  });

  test("[R-PLACE-005] given Ada on a student visa with pounds for the fare and savings besides, and naira at home no more than the broke line, then the return she would make today reads by choice, before it happens, with no capital to add to the standing", async () => {
    const base = abroadView();
    const view: PlayerView = {
      ...base,
      pockets: { ...base.pockets, GBP: { bank: 200_000, cash: 0, locked: 0 }, NGN: { bank: content.tuning.place.brokeLine, cash: 0, locked: 0 } },
    };
    expect(wayHome(view)).toMatchObject({ paidFrom: "local", shape: "by-choice" });
    await renderWithView(<PlaceView />, view);
    expect(screen.getByText(say("ui.place.shape-now.by-choice"))).toBeDefined();
    expect(screen.getByText(say("ui.place.standing", { change: String(content.tuning.return.standing["by-choice"]) }))).toBeDefined();
  });

  test("[R-PLACE-004] given no status and nothing to pay the fare with, then the assisted return is the way home", async () => {
    const base = abroadView();
    const empty = { bank: 0, cash: 0, locked: 0 };
    const view: PlayerView = {
      ...base,
      status: null,
      pockets: { NGN: empty, GBP: empty, USD: empty, CAD: empty, AED: empty, EUR: empty },
    };
    expect(wayHome(view)).toMatchObject({ paidFrom: null, shape: "assisted" });
    const { authority } = await renderWithView(<PlaceView />, view);
    expect(screen.getByText(say("ui.place.assisted-why"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.place.go-assisted") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.place.go-yes") }));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "return/home", basedOn: view.v }]));
  });

  test("[R-PLACE-004] given Ada landed with dollars but neither pounds nor naira enough for the fare, then she is told to change money first", async () => {
    // The recorded life moves as the content does, so the pockets are pinned here: dollars only.
    const base = abroadView();
    const empty = { bank: 0, cash: 0, locked: 0 };
    const view: PlayerView = { ...base, pockets: { ...base.pockets, NGN: empty, GBP: empty, USD: { bank: 500000, cash: 0, locked: 0 } } };
    expect(wayHome(view)).toMatchObject({ paidFrom: null, shape: null });
    await renderWithView(<PlaceView />, view);
    expect(screen.getByText(say("ui.place.fare-short", { fare: formatMoney(UK.fare, "GBP"), naira: formatMoney(nairaForFee(view, "GBP", UK.fare), "NGN") }))).toBeDefined();
  });

  test("[R-PLACE-004] given a status held and no money for the fare, then there is no way home today and no button", async () => {
    const base = abroadView();
    const empty = { bank: 0, cash: 0, locked: 0 };
    const view: PlayerView = { ...base, pockets: { NGN: empty, GBP: empty, USD: empty, CAD: empty, AED: empty, EUR: empty } };
    await renderWithView(<PlaceView />, view);
    expect(screen.getByText(say("ui.place.no-way"))).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.place.go") })).toBeNull();
  });

  test("[R-RETURN-001] given two returns on record, then each reads in words, newest first", async () => {
    const view: PlayerView = {
      ...engineView(),
      place: {
        where: "home",
        country: null,
        monthsHere: 4,
        returns: [
          { month: 50, shape: "with-papers", country: "country.uk" },
          { month: 30, shape: "broke", country: "country.uk" },
        ],
        heldAbroad: "status.uk-settled",
        fareHome: null,
      },
    };
    await renderWithView(<PlaceView />, view);
    const items = within(screen.getByRole("list", { name: say("ui.place.returns") })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      say("ui.place.return-item", { month: 51, country: nameOf("country.uk"), shape: say("ui.place.shape.with-papers") }),
      say("ui.place.return-item", { month: 31, country: nameOf("country.uk"), shape: say("ui.place.shape.broke") }),
    ]);
    expect(screen.getByText(say("ui.place.token", { status: nameOf("status.uk-settled") }))).toBeDefined();
  });
});

describe("the family from abroad", () => {
  test("[R-ABROAD-006] given Ada abroad, then the naira at home that requests are paid from shows, with the way to send more", async () => {
    const view = abroadView();
    await renderWithView(<FamilyView />, view);
    expect(screen.getByText(say("ui.family.naira", { bank: formatMoney(view.pockets.NGN.bank, "NGN"), cash: formatMoney(view.pockets.NGN.cash, "NGN") }))).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.remit.title") })).toBeDefined();
  });

  test("given a life at home, then the family panel does not show", async () => {
    await renderWithView(<FamilyView />, engineView());
    expect(screen.queryByText(say("ui.family.title"))).toBeNull();
  });
});
