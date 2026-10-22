// The door in its sticker board dress (prologue:front-door-three-screens): a life's card
// swiped to the middle of the deck is the life picked, as a tap on it is, and the pager follows; the door's sky and its
// cards read in both paints, the night's navy from the world's clock as every surface over the world.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { ARCHETYPES } from "../../shared/front-door/archetypes";
import { say } from "../../shared/words/text";
import { FrontDoor } from "./FrontDoor";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";
import { DOOR_KEY } from "../../shared/storage/storage";

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  history.replaceState(null, "", "/");
});

function door(): void {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "dress-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <FrontDoor />
    </GameProvider>,
  );
}

const next = () => screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) });
const set = (element: Element, key: string, value: number): void => {
  Object.defineProperty(element, key, { configurable: true, value });
};

describe("the lives swiped", () => {
  test("[prologue:front-door-three-screens] given the lives' deck, when a card is swiped to the middle and the deck comes to rest, then that life is picked and kept, its routes show under the deck and the pager's dot moves to it", () => {
    door();
    fireEvent.click(next());
    vi.useFakeTimers();
    const deck = document.querySelector<HTMLElement>("[data-archetypes]")!;
    // The deck's geometry as a phone lays it out: cards 282 wide, 14 apart, in a strip 390 wide.
    [...deck.children].forEach((card, index) => {
      set(card, "offsetLeft", 54 + index * 296);
      set(card, "offsetWidth", 282);
    });
    set(deck, "clientWidth", 390);
    const third = ARCHETYPES[2]!;
    // The third card's middle under the strip's middle.
    deck.scrollLeft = 54 + 2 * 296 + 141 - 195;
    fireEvent.scroll(deck);
    expect(screen.getByRole("radio", { name: say(`prologue.archetype.${ARCHETYPES[0]!.id}.name`) }).getAttribute("aria-checked")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByRole("radio", { name: say(`prologue.archetype.${third.id}.name`) }).getAttribute("aria-checked")).toBe("true");
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: third.id, age: 0 });
    expect([...document.querySelectorAll("[data-door-pager] i")].findIndex((dot) => dot.hasAttribute("data-now"))).toBe(2);
    expect(document.querySelector("[data-tile-opens]")).not.toBeNull();
  });
});

describe("the door in both paints", () => {
  test("[prologue:front-door-three-screens] given the night paint, then every screen of the door stands on the sky that follows it, its cards and buttons in the layer's role colours, never a colour of their own", () => {
    for (const paint of ["day", "night"] as const) {
      history.replaceState(null, "", `/?paint=${paint}`);
      door();
      expect(document.documentElement.dataset["paint"]).toBe(paint);
      for (const stage of ["you", "life", "page"]) {
        const frame = document.querySelector<HTMLElement>("[data-door-frame]")!;
        expect({ paint, stage, gate: frame.dataset["gate"], sky: frame.className.includes("door-sky") }).toEqual({ paint, stage, gate: stage, sky: true });
        // The cards and the round buttons are the layer's own classes, which read the role tokens the paint switches.
        expect(frame.querySelectorAll(".door-card, .round-button, .pill-button, .press-button").length).toBeGreaterThan(1);
        expect(frame.querySelector("[style*='background: #'], [style*='color: #']")).toBeNull();
        if (stage !== "page") fireEvent.click(next());
      }
      cleanup();
      localStorage.clear();
    }
  });
});

describe("nothing behind the door", () => {
  test("[prologue:nothing-behind-the-door] given each screen of the door, the ready lives among them, then no scene stands behind it: no tailor's corner, no compound and no scrim, only the sky", () => {
    door();
    for (const stage of ["you", "life", "page"]) {
      expect(document.querySelector("[data-door-frame]")?.getAttribute("data-gate")).toBe(stage);
      for (const gone of ["[data-backdrop]", "[data-scrim]", "[data-front-scene]", "[data-turntable]", "canvas"]) expect({ stage, gone, there: document.querySelector(gone) !== null }).toEqual({ stage, gone, there: false });
      if (stage !== "page") fireEvent.click(next());
    }
  });
});
