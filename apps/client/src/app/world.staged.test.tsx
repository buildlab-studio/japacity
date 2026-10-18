// The staged wins in the world (docs/rules/luck.md R-LUCK-008; world.md R-WORLD-008): a month whose lines carry a big one
// tells it first, in the corner, and the results open once it has passed; a month with none opens its results at once.
// The scene is a stand-in that hands the city the taps a player makes.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { engineView } from "../shared/testing/fixtures";
import { renderWithView } from "../shared/testing/render";
import { words } from "../shared/words/text";
import { linesNow } from "../shared/world/Lines";
import { Results } from "../features/turn/Results";
import { City, RESULTS_BEAT_MS } from "../features/city/City";


// The scene is the stand-in that opens a tapped thing's fan beside it and walks at once (R-WORLD-034).
vi.mock("../features/city/CityScene", async () => ({ default: (await import("../features/city/fan/fan.testing")).StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../shared/three/manifest", async (original) => {
  const real = await original<typeof import("../shared/three/manifest")>();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const assets = path.join(import.meta.dirname, "..", "..", "public", "assets");
  return {
    ...real,
    loadManifest: () => Promise.resolve({ files: {} }),
    loadJson: (_manifest: unknown, under: string) => {
      const file = path.join(assets, under);
      return Promise.resolve(fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown) : null);
    },
  };
});

beforeEach(() => {
  // The city draws its place only where the device can (City.tsx canDraw); the scene itself is the stand-in above.
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
  window.localStorage.clear();
});


const SALARY: ReportLine = {
  key: "line.activity.salary",
  params: { job: "activity.job-teacher", amount: { currency: "NGN", amount: 7_500_000 } },
  tone: "good",
  attention: false,
  counts: [],
  big: true,
};

const PLAIN: ReportLine = { key: "line.activity.played", params: { activity: "activity.rest" }, tone: "plain", attention: false, counts: [] };

function reported(lines: ReportLine[]): PlayerView {
  return { ...engineView(), report: { month: 1, lines, japacityBefore: null, japacityAfter: null, attention: false } };
}

/** What the corner tells, the world's channel for a big line (R-WORLD-008), read from its store. */
const corner = (): string[] => linesNow().lines.map((said) => said.text);

describe("the staged wins in the world", () => {
  test("[R-LUCK-008] given a month whose lines carry a big one, when it ends, then the big line is told on its own before the results open", async () => {
    const { authority, store } = await renderWithView(<City world results={(place) => <Results place={place} />} />, reported([PLAIN, SALARY]));
    await waitFor(() => expect(document.querySelector("[data-stand-in-scene]")).not.toBeNull(), { timeout: 3000 });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    authority.linesNext([PLAIN, SALARY]);
    await act(() => store.getState().endMonth());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESULTS_BEAT_MS + 1500);
    });
    expect(corner()).toContain(words(SALARY.key, SALARY.params));
    expect(store.getState().moments).toHaveLength(1);
    expect(document.querySelector("[data-world-sheet='results']")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(store.getState().moments).toEqual([]);
    expect(document.querySelector("[data-world-sheet='results']")).not.toBeNull();
  });

  test("[R-LUCK-008] given a month with no big line, then the results open at once, with nothing staged", async () => {
    const { authority, store } = await renderWithView(<City world results={(place) => <Results place={place} />} />, reported([PLAIN]));
    await waitFor(() => expect(document.querySelector("[data-stand-in-scene]")).not.toBeNull(), { timeout: 3000 });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    authority.linesNext([PLAIN]);
    await act(() => store.getState().endMonth());
    expect(store.getState().moments).toEqual([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESULTS_BEAT_MS + 1500);
    });
    expect(document.querySelector("[data-world-sheet='results']")).not.toBeNull();
  });
});

