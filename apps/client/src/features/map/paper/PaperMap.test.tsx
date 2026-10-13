// The folding map on the screen (docs/rules/world.md R-WORLD-015, R-WORLD-017): it opens on the right card, the strip
// unfolds it, a pin of the open map folds it back on that pin's card, a sticker picks its stop, and the route takes its
// channel.
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nameOf } from "../../../shared/words/text";
import type { CountryChoice } from "../../../shared/world/contract";
import { Map } from "../Map";
import { tileOf } from "../../../shared/tiles/tiles.data";
import { mapPins, type MapPin } from "../pins";
import { FOLD_MS } from "./fold";
// Loaded here, so the map screen's own lazy load of it settles at once.
import "./PaperMap";

afterEach(() => {
  vi.useRealTimers();
});

const PUBLIC = join(import.meta.dirname, "..", "..", "..", "..", "public", "assets", "places");
const BUILT = new Set(
  readdirSync(PUBLIC)
    .map((folder) => Object.values(content.place).find((place) => place.assets === folder)?.id)
    .filter((id): id is NonNullable<typeof id> => id !== undefined),
);
const HOME = "place.family-house";
const LAGOS: CountryChoice = { id: "lagos", name: "Lagos", locked: null };

function pinsAt(here: string): MapPin[] {
  const places = Object.values(content.place).filter((place) => place.where === "home");
  return mapPins({ places, here, home: HOME, homeSpot: { latE3: 6507, lonE3: 3359 }, been: [], built: BUILT, name: nameOf });
}

async function open(props: { here?: string; step?: string | null; pickFirst?: string | null } = {}): Promise<void> {
  await renderWithView(<Map pins={pinsAt(props.here ?? "place.ojuelegba")} country={LAGOS} countries={[LAGOS]} drawing={false} onGo={() => undefined} onClose={() => undefined} home={HOME} step={props.step ?? null} pickFirst={props.pickFirst ?? null} />, engineView());
  // The painted map is its own chunk: wait for it to come in.
  for (let tries = 0; tries < 200 && document.querySelector("[data-paper-map]") === null; tries += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

const current = (): string | undefined => document.querySelector<HTMLElement>('[data-card][data-current="true"]')?.dataset.card;
const phase = (): string | undefined => document.querySelector<HTMLElement>("[data-paper-map]")?.dataset.fold;

describe("the folding map", () => {
  test("[R-WORLD-015] given the player in Ojuelegba, when the map opens, then it opens folded on Ojuelegba's card, the strip at the top with the pager under the cards; with a step live it opens on the step's neighbourhood", async () => {
    await open();
    expect(phase()).toBe("folded");
    expect(current()).toBe("ojuelegba");
    expect(document.querySelector("[data-strip]")).not.toBeNull();
    expect(document.querySelectorAll("[data-pager] i")).toHaveLength(9);
    expect(document.querySelector("[data-strip-here]")).not.toBeNull();
    expect(document.querySelector("[data-strip-home]")).not.toBeNull();
    expect(document.querySelector("[data-strip-step]")).toBeNull();
  });

  test("[R-WORLD-015] given a step live at the passport office, when the map opens, then it opens on the island's card, the step's sticker ringed and named, and the strip carries the step's yellow dot", async () => {
    await open({ step: "place.passport-office" });
    expect(current()).toBe("island");
    expect(document.querySelector("[data-strip-step]")).not.toBeNull();
    const sticker = document.querySelector<HTMLElement>('[data-card="island"] [data-pin="place.passport-office"]');
    expect(sticker?.dataset.ring).toBe("step");
    expect(sticker?.querySelector("[data-name]")?.getAttribute("data-name")).toBe("step");
  });

  test("[R-WORLD-015] [R-WORLD-017] given a sticker on the card, when it is tapped, then its stop is picked with the ride sheet at the foot; in the same neighbourhood the route draws on the card", async () => {
    await open({ here: "place.family-house" });
    expect(current()).toBe("surulere");
    fireEvent.click(document.querySelector('[data-card="surulere"] [data-pin="place.national-stadium"]') as HTMLElement);
    expect(document.querySelector('[data-ride-sheet="place.national-stadium"]')).not.toBeNull();
    expect(window.__map?.channel).toBe("card");
    expect(document.querySelector('[data-card="surulere"] [data-route-line]')).not.toBeNull();
    expect(document.querySelector("[data-strip] [data-route-line]")).toBeNull();
    // The picked sticker is ringed and named.
    expect(document.querySelector<HTMLElement>('[data-card="surulere"] [data-pin="place.national-stadium"]')?.dataset.ring).toBe("picked");
    // A stop in another neighbourhood: the route crosses the city on the strip.
    fireEvent.click(document.querySelector('[data-card="surulere"] [data-pin="place.bode-thomas"]') as HTMLElement);
    expect(window.__map?.channel).toBe("strip");
    expect(document.querySelector("[data-strip] [data-route-line]")).not.toBeNull();
  });

  test("[R-WORLD-015] [R-WORLD-017] given the nudge's step elsewhere, when the map opens with that stop picked, then it opens on the stop's card with its sheet, and the route across the city draws on the strip", async () => {
    await open({ pickFirst: "place.passport-office" });
    expect(current()).toBe("island");
    expect(document.querySelector('[data-ride-sheet="place.passport-office"]')).not.toBeNull();
    expect(window.__map?.channel).toBe("strip");
    expect(document.querySelector("[data-strip] [data-route-line]")).not.toBeNull();
    expect(document.querySelector('[data-card="island"] [data-route-line]')).toBeNull();
  });

  test("[R-WORLD-015] given the map folded, when the strip is tapped, then the map unfolds and settles open within the fold's time, with the cards out of the way; a pin of the open map folds it back on that pin's card with the stop picked", async () => {
    vi.useFakeTimers();
    await open();
    fireEvent.click(document.querySelector("[data-strip]") as HTMLElement);
    expect(phase()).toBe("opening");
    expect(document.querySelector("[data-open-map]")).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(FOLD_MS + 300);
    });
    expect(phase()).toBe("open");
    expect(document.querySelector<HTMLElement>("[data-track]")?.style.pointerEvents).toBe("none");
    // The open map takes the card's rule: each place once, its sticker the pin.
    expect(document.querySelectorAll('[data-open-map] [data-pin="place.ojuelegba"]')).toHaveLength(1);
    // While open, a route across the city would draw on the open map.
    fireEvent.click(document.querySelector('[data-open-map] [data-pin="place.passport-office"]') as HTMLElement);
    expect(phase()).toBe("closing");
    expect(window.__map?.card).toBe("island");
    expect(document.querySelector('[data-ride-sheet="place.passport-office"]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(FOLD_MS + 300);
    });
    expect(phase()).toBe("folded");
    expect(current()).toBe("island");
    expect(document.querySelector("[data-open-map]")).toBeNull();
    expect(window.__map?.channel).toBe("strip");
  });

  test("[R-WORLD-015] given the map open with a stop picked across the city, when the route's channel is read, then it draws on the open map", async () => {
    vi.useFakeTimers();
    await open({ pickFirst: "place.passport-office" });
    fireEvent.click(document.querySelector("[data-strip]") as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(FOLD_MS + 300);
    });
    expect(window.__map?.channel).toBe("open");
    expect(document.querySelector("[data-open-map] [data-route-line]")).not.toBeNull();
    expect(document.querySelector("[data-open-map] [data-route-danfo]")).not.toBeNull();
  });

  test("[R-WORLD-015] given the map folded, when the strip is dragged down short and let go, then it folds back; dragged far, it opens", async () => {
    await open();
    const strip = document.querySelector("[data-strip]") as HTMLElement;
    fireEvent.pointerDown(strip, { pointerId: 1, clientY: 40 });
    fireEvent.pointerMove(strip, { pointerId: 1, clientY: 80 });
    expect(document.querySelector("[data-open-map]")).not.toBeNull();
    fireEvent.pointerUp(strip, { pointerId: 1, clientY: 80 });
    expect(phase()).toBe("folded");
    expect(document.querySelector("[data-open-map]")).toBeNull();
    fireEvent.pointerDown(strip, { pointerId: 2, clientY: 40 });
    fireEvent.pointerMove(strip, { pointerId: 2, clientY: 300 });
    fireEvent.pointerUp(strip, { pointerId: 2, clientY: 300 });
    expect(phase()).toBe("opening");
  });

  test("[R-WORLD-015] given the stops, when the map shows them, then each stands once as its own sticker on its card, with no pole or board, and a screen reader has them as a list", async () => {
    await open();
    expect(document.querySelectorAll('[data-card="ojuelegba"] [data-pin="place.ojuelegba"]')).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Stops" })).toBeTruthy();
    expect(document.querySelector('[data-pin="place.ojuelegba"]')?.getAttribute("aria-label")).toBe("Ojuelegba");
  });

  test("[R-WORLD-015] given the passport office and Ojuelegba, when their stickers stand on the map, then each has a picture of its own: a counter with the flag flying behind it, and the flyover", async () => {
    expect(tileOf("place.passport-office")).toEqual({ model: "prop_bank-counter" });
    expect(tileOf("place.ojuelegba")).toEqual({ model: "bld_flyover-span" });
    await open({ step: "place.passport-office" });
    expect(document.querySelector('[data-card="island"] [data-pin="place.passport-office"] [data-picture]')?.getAttribute("data-picture")).toBe("prop_bank-counter+flag");
  });
});
