// world:back-closes-topmost on the map: Back and Escape close a ride's sheet before the map, and a ride under way is not
// closed by Back.
import { content } from "@japacity/content";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { type BackStack, createBack } from "../../shared/back/back";
import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { nameOf } from "../../shared/words/text";
import type { CountryChoice } from "../../shared/world/contract";
import { Map } from "./Map";
import { mapPins } from "./pins";

const LAGOS: CountryChoice = { id: "lagos", name: "Lagos", locked: null };
const HOME = "place.family-house";
const TO = "place.tejuosho-market";
let stack: BackStack;

beforeEach(() => {
  history.replaceState(null, "", "/");
  stack = createBack(window);
});

afterEach(() => stack.dispose());

function depth(): number {
  const value = (history.state as Record<string, unknown> | null)?.japacityBack;
  return typeof value === "number" ? value : 0;
}

function pins() {
  const view = engineView();
  const places = Object.values(content.place).filter((place) => place.where === view.place.where);
  return mapPins({ places, here: "place.ojuelegba", home: HOME, homeSpot: { latE3: 6507, lonE3: 3359 }, been: [], built: new Set(places.map((place) => place.id)), name: nameOf });
}

async function openMap(onClose: () => void) {
  return renderWithView(<Map pins={pins()} country={LAGOS} countries={[LAGOS]} drawing={false} pickFirst={TO} onGo={() => undefined} onClose={onClose} onRide={() => true} />, engineView());
}

const has = (selector: string) => document.querySelector(selector) !== null;

describe("the map and Back", () => {
  test("[world:back-closes-topmost] given the map open on a stop with its ride's sheet, when Back is pressed twice, then the sheet closes and then the map", async () => {
    const onClose = vi.fn();
    await openMap(onClose);
    await waitFor(() => expect(depth()).toBe(2));
    expect(has(`[data-ride-sheet="${TO}"]`)).toBe(true);
    act(() => history.back());
    await waitFor(() => expect(has("[data-ride-sheet]")).toBe(false));
    expect(onClose).not.toHaveBeenCalled();
    act(() => history.back());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("[world:back-closes-topmost] given the map open on a stop, when Escape is pressed twice, then the sheet closes and then the map", async () => {
    const onClose = vi.fn();
    await openMap(onClose);
    await waitFor(() => expect(depth()).toBe(2));
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(has("[data-ride-sheet]")).toBe(false));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("[world:back-closes-topmost] given a ride under way, when Back is pressed, then the ride goes on and the map stays", async () => {
    const onClose = vi.fn();
    await openMap(onClose);
    await waitFor(() => expect(depth()).toBe(2));
    fireEvent.click(document.querySelector<HTMLElement>("[data-ride-main]")!);
    await waitFor(() => expect(has("[data-ride]")).toBe(true));
    act(() => history.back());
    await waitFor(() => expect(depth()).toBe(2));
    expect(has("[data-ride]")).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(has("[data-ride]")).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});
