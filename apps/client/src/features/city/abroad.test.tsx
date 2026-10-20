// The world after the flight (world:top-band-is-lively-pill, world:map-is-painted-lagos, world:one-country-at-a-time, world:street-talk-budget): the band in the
// country's money, the talk of the places abroad, and the map abroad as its list of stops. The scene
// itself needs WebGL and is not drawn here; the graduate's recorded life is flown and landed in London.
import { fireEvent, screen } from "@testing-library/react";
import type { PlayerView } from "@japacity/sim";
import { setPockets } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { abroadGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { City, type CityMapSlot } from "./City";

/** The graduate in the room abroad, with pounds in the bank and the naira still at home. */
function landed(): PlayerView {
  const game = abroadGame();
  setPockets(game, { GBP: 74_600 });
  return game.view();
}

const world = (extra: Partial<Parameters<typeof City>[0]> = {}) => <City world {...extra} />;

function band(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-band]");
  if (found === null) throw new Error("No band");
  return found;
}

describe("the band abroad", () => {
  test("[world:top-band-is-lively-pill] given the graduate landed in London with pounds and naira, when the world shows, then the band counts its pounds and not the naira", async () => {
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
  test("[world:map-is-painted-lagos] [world:one-country-at-a-time] given the graduate in London, when the map opens, then it lists the country's stops with the room as home, the other countries are shut for want of a visa, and only Lagos is not in this life yet", async () => {
    let handed: CityMapSlot | null = null;
    await renderWithView(
      world({
        cityMap: (props) => {
          handed = props;
          return <p data-map-slot />;
        },
      }),
      landed(),
    );
    fireEvent.click(screen.getByRole("button", { name: say("ui.world.map") }));
    const slot = handed as CityMapSlot | null;
    if (slot === null) throw new Error("The map was not handed its slot");
    const stops = slot.pins.map((pin) => pin.id);
    expect(stops).toContain("place.peckham");
    expect(stops).toContain("place.the-room");
    expect(slot.home).toBe("place.the-room");
    expect(slot.country).toMatchObject({ id: "country.uk", locked: null });
    expect(Object.fromEntries(slot.countries.map((choice) => [choice.id, choice.locked]))).toEqual({ lagos: "Not in this life yet", "country.uk": null, "country.uae": "No visa yet", "country.canada": "No visa yet", "country.italy": "No visa yet" });
  });
});
