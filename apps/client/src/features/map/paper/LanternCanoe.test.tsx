// The lantern canoe on the open map of Lagos (docs/rules/world.md R-WORLD-036): where it is moored and what it is not,
// how it is drawn by day and at night, its second lantern, its stillness, and its tap, which opens the dedication page
// the shell hands in and folds nothing.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { forgetDedication, setDedicationServer } from "../../../shared/dedication/lights";
import type { Api } from "../../../shared/net/http";
import { engineView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { nameOf } from "../../../shared/words/text";
import type { CountryChoice } from "../../../shared/world/contract";
import { Map, type MapDedication } from "../Map";
import { mapPins, type MapPin } from "../pins";
import { groundOf } from "./draw";
import { FOLD_MS } from "./fold";
import { BRIDGE_NAME_PATH, DECOR, FERRY_LINE, LAND, LANTERN_CANOE, LANTERN_CANOE_CLEAR, ROADS } from "./geometry";
import { CANOE_HIT } from "./LanternCanoe";
import { inside, nearLine, scatter } from "./scatter";
import { placeStops } from "./stops";
// Loaded here, so the map screen's own lazy load of it settles at once.
import "./PaperMap";

afterEach(() => {
  vi.useRealTimers();
  forgetDedication();
});

const HOME = "place.family-house";
const LAGOS: CountryChoice = { id: "lagos", name: "Lagos", locked: null };
const ABROAD: CountryChoice = { id: "country.uk", name: "United Kingdom", locked: null };
const [CX, CY] = LANTERN_CANOE.at;

function pins(): MapPin[] {
  const places = Object.values(content.place).filter((place) => place.where === "home");
  return mapPins({ places, here: "place.ojuelegba", home: HOME, homeSpot: { latE3: 6507, lonE3: 3359 }, been: [], built: new Set(), name: nameOf });
}

/** A stand-in for the shell's fill that a test can read back: one warm colour at the alpha asked for. */
const glow = (alpha: number) => `rgba(255, 200, 100, ${alpha.toFixed(2)})`;

/** The map as the shell hands it, with a stand-in for the dedication page that says whether it is open. */
async function open(country: CountryChoice = LAGOS): Promise<{ opened: boolean[] }> {
  const opened: boolean[] = [];
  const dedication: MapDedication = {
    page: (shown, onClose) => {
      opened.push(shown);
      return shown ? (
        <button type="button" onClick={onClose} data-page-stand-in>
          page
        </button>
      ) : null;
    },
    glow,
  };
  await renderWithView(<Map pins={pins()} country={country} countries={[LAGOS, ABROAD]} drawing={false} onGo={() => undefined} onClose={() => undefined} home={HOME} dedication={dedication} />, engineView());
  for (let tries = 0; tries < 200 && country.id === "lagos" && document.querySelector("[data-paper-map]") === null; tries += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return { opened };
}

function unfold(): void {
  fireEvent.click(document.querySelector("[data-strip]") as HTMLElement);
  act(() => {
    vi.advanceTimersByTime(FOLD_MS + 300);
  });
}

const canoe = () => document.querySelector<HTMLElement>("[data-canoe]");

describe("where the canoe is moored", () => {
  test("[R-WORLD-036] given the paper, then the canoe is on the open lagoon, water on every side for a long way, north-east of the Third Mainland Bridge's middle", () => {
    expect(Object.values(LAND).some((ring) => inside(ring, LANTERN_CANOE.at))).toBe(false);
    // Water on every side at the open zoom: no land within 80 paper units, about 75 screen pixels.
    for (const [dx, dy] of [[80, 0], [-80, 0], [0, 80], [0, -80], [56, 56], [-56, 56], [56, -56], [-56, -56]] as const) {
      expect(Object.values(LAND).some((ring) => inside(ring, [CX + dx, CY + dy]))).toBe(false);
    }
    const bridge = ROADS.find((road) => road.bridge === "third-mainland")?.points ?? [];
    const middle = bridge[Math.floor(bridge.length / 2)] ?? [0, 0];
    expect(CX).toBeGreaterThan(middle[0]);
    expect(CY).toBeLessThan(middle[1]);
  });

  test("[R-WORLD-036] given the canoe, then no ride crosses it: it is far from the ferry's line, every road and bridge, and every stop, and it is neither a stop nor decor", () => {
    expect(nearLine(LANTERN_CANOE.at, FERRY_LINE, 120)).toBe(false);
    for (const road of ROADS) expect(nearLine(LANTERN_CANOE.at, road.points, 60)).toBe(false);
    expect(nearLine(LANTERN_CANOE.at, BRIDGE_NAME_PATH, 40)).toBe(false);
    const stops = placeStops(pins().map((pin) => ({ id: pin.id, state: pin.state, position: pin.position })));
    for (const stop of stops) expect(Math.hypot(stop.at[0] - CX, stop.at[1] - CY)).toBeGreaterThan(60);
    expect(DECOR.some((item) => item.at[0] === CX && item.at[1] === CY)).toBe(false);
  });

  test("[R-WORLD-036] given the scatter, then it keeps clear of the canoe: no wave is drawn over it", () => {
    const ground = groundOf();
    expect(ground.clear).toContainEqual([CX, CY, LANTERN_CANOE_CLEAR]);
    for (const [x, y] of scatter(ground).waves) expect(Math.hypot(x - CX, y - CY)).toBeGreaterThanOrEqual(LANTERN_CANOE_CLEAR);
  });
});

describe("the canoe on the map", () => {
  test("[R-WORLD-036] given the map folded, then neither the strip nor the cards draw the canoe; unfolded, the open map draws one, named for a screen reader, with one lantern and the probe's point apart from the stops", async () => {
    vi.useFakeTimers();
    await open();
    expect(canoe()).toBeNull();
    unfold();
    expect(document.querySelectorAll("[data-canoe]")).toHaveLength(1);
    expect(document.querySelector("[data-open-map] [data-canoe]")).not.toBeNull();
    expect(document.querySelector("[data-strip] [data-canoe], [data-track] [data-canoe]")).toBeNull();
    expect(screen.getByRole("button", { name: "A canoe with a lantern" })).toBe(canoe());
    expect(canoe()?.dataset.lanterns).toBe("1");
    expect(canoe()?.querySelector("[data-lantern='stern']")).toBeNull();
    expect(window.__map?.canoe).toEqual(LANTERN_CANOE.at);
    expect(window.__map?.stops.some((stop) => stop.at[0] === CX && stop.at[1] === CY)).toBe(false);
  });

  test("[R-WORLD-036] given the canoe, when it is tapped, then the dedication page the shell hands in opens, the map stays open with no stop picked, and closing the page leaves the map as it was", async () => {
    vi.useFakeTimers();
    const { opened } = await open();
    unfold();
    expect(opened.at(-1)).toBe(false);
    fireEvent.pointerDown(canoe() as HTMLElement);
    fireEvent.pointerUp(canoe() as HTMLElement);
    fireEvent.click(canoe() as HTMLElement);
    expect(opened.at(-1)).toBe(true);
    expect(document.querySelector("[data-paper-map]")?.getAttribute("data-fold")).toBe("open");
    expect(document.querySelector("[data-ride-sheet]")).toBeNull();
    fireEvent.click(document.querySelector("[data-page-stand-in]") as HTMLElement);
    expect(opened.at(-1)).toBe(false);
    expect(document.querySelector("[data-paper-map]")?.getAttribute("data-fold")).toBe("open");
  });

  test("[R-WORLD-036] [R-WORLD-021] given the canoe, then its glow is the fill the shell hands in, a small one by day, the light on the water under the night paint, and its hit area is at least 44 px", async () => {
    vi.useFakeTimers();
    await open();
    unfold();
    const glows = [...(canoe()?.querySelectorAll<HTMLElement>("[data-canoe-glow]") ?? [])];
    expect(glows.map((layer) => layer.dataset.canoeGlow)).toEqual(["day", "night", "heart"]);
    expect(glows.map((layer) => layer.style.background)).toEqual(["rgba(255, 200, 100, 0.55)", "rgba(255, 200, 100, 0.85)", "rgba(255, 200, 100, 0.85)"]);
    expect(CANOE_HIT).toBeGreaterThanOrEqual(44);
    const css = readFileSync(join(import.meta.dirname, "paper.css"), "utf8");
    expect(css).toMatch(/\.paper-canoe \{[^}]*width: 44px; height: 44px;[^}]*scale\(var\(--inv, 1\)\)/u);
    // The night's light shows only under the night paint, over the paper's own night.
    expect(css).toMatch(/\.paper-canoe-night \{[^}]*opacity: 0;/u);
    expect(css).toMatch(/\[data-paint="night"\] \.paper-canoe-night \{ opacity: 1; \}/u);
  });

  test("[R-WORLD-036] [R-WORLD-023] given the lantern's glow, then it breathes by opacity alone and holds still under reduced motion", () => {
    const css = readFileSync(join(import.meta.dirname, "paper.css"), "utf8");
    const frames = /@keyframes paper-breathe \{([^}]*\}[^}]*)\}/u.exec(css)?.[1] ?? "";
    expect(frames).toContain("opacity");
    expect([...frames.matchAll(/([a-z-]+):/gu)].map((found) => found[1])).toEqual(["opacity", "opacity"]);
    expect(css).toMatch(/\.paper-canoe-breath \{[^}]*animation: paper-breathe 4s/u);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.paper-canoe-breath \{ animation: none; \}/u);
  });

  test("[R-WORLD-036] [R-ACCOUNT-033] given the account's own light lit, then the canoe carries a second lantern at its stern", async () => {
    const reply = { ok: true, count: 3, lights: [{ id: "light.a" }], mine: { id: "light.a", name: "Mama Nkechi", years: { from: null, to: null }, approved: false } };
    setDedicationServer({ get: () => Promise.resolve(reply) } as unknown as Api);
    vi.useFakeTimers();
    await open();
    await act(async () => {
      await Promise.resolve();
    });
    unfold();
    expect(canoe()?.dataset.lanterns).toBe("2");
    expect(canoe()?.querySelector("[data-lantern='stern']")).not.toBeNull();
  });

  test("[R-WORLD-036] given a country abroad, then there is no lagoon and no canoe", async () => {
    await open(ABROAD);
    expect(document.querySelector("[data-paper-map]")).toBeNull();
    expect(canoe()).toBeNull();
  });
});
