// The world after the flight (docs/rules/world.md R-WORLD-002, 015, 016, 026): the band in the
// country's money, the talk of the places abroad, and the map abroad as its list of stops. The scene
// itself needs WebGL and is not drawn here; Ada's recorded life is flown and landed in London.
import { fireEvent, screen, within } from "@testing-library/react";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { abroadGame, setPockets } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { Map } from "../map/Map";
import { City } from "./City";

/** Ada in the room abroad, with pounds in the bank and the naira still at home. */
function landed(): PlayerView {
  const game = abroadGame();
  setPockets(game, { GBP: 74_600 });
  return game.view();
}

const world = (extra: Partial<Parameters<typeof City>[0]> = {}) => <City world month={<p data-month-body>month</p>} {...extra} />;

function band(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-band]");
  if (found === null) throw new Error("No band");
  return found;
}

describe("the band abroad", () => {
  test("[R-WORLD-002] given Ada landed in London with pounds and naira, when the world shows, then the band counts her pounds and not the naira", async () => {
    const view = landed();
    expect(view.pockets.NGN.bank).toBeGreaterThan(0);
    await renderWithView(world(), view);
    const counter = band().querySelector<HTMLElement>("[data-counter]");
    expect(counter?.dataset.counter).toBe(String(74_600));
    expect(counter?.textContent).toBe(formatMoney(74_600, "GBP"));
    expect(band().textContent).not.toContain(formatMoney(view.pockets.NGN.bank, "NGN"));
  });
});

describe("the map abroad", () => {
  test("[R-WORLD-015] [R-WORLD-016] given Ada in London, when the map opens, then it lists the country's stops with the room as home, the other countries are shut for want of a visa, and only Lagos is not in this life yet", async () => {
    await renderWithView(world({ cityMap: (props) => <Map {...props} /> }), landed());
    fireEvent.click(screen.getByRole("button", { name: say("ui.world.map") }));
    const stops = within(screen.getByRole("list", { name: "Stops" }))
      .getAllByRole("button")
      .map((button) => button.dataset.stop);
    expect(stops).toContain("place.peckham");
    expect(stops).toContain("place.the-room");
    expect(stops.filter((stop) => stop?.startsWith("place.") !== true)).toEqual([]);
    fireEvent.click(document.querySelector<HTMLElement>("[data-country]")!);
    const reasons: Record<string, string> = Object.fromEntries([...document.querySelectorAll<HTMLElement>("[data-country-option]")].map((row) => [row.dataset.countryOption ?? "", row.lastElementChild?.textContent ?? ""]));
    expect(reasons).toEqual({ lagos: "Not in this life yet", "country.uk": "You are here", "country.uae": "No visa yet", "country.canada": "No visa yet", "country.italy": "No visa yet" });
  });
});
