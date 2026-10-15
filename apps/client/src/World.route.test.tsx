// The deposit and the plane in the world (docs/rules/world.md R-WORLD-005, R-WORLD-006; route.md; chapter.md R-CHAPTER-006):
// the bank's counter carries Pay the deposit for the university that made an offer, and the airport's gate Board the plane
// once a visa is granted; the counter opens its card and its one button sends the command, and the gate opens the
// send-off scene, whose third beat sends the flight (chapter.md R-CHAPTER-012). Moved from the old month page's route
// card (features/route/RouteView), whose buttons sent the same commands. The scene is a stand-in that hands the city the
// taps a player makes; the place files are the ones the game ships.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { PlayerView } from "@japacity/sim";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { richView } from "./shared/testing/fixtures";
import { renderWithView } from "./shared/testing/render";
import { say } from "./shared/words/text";
import { City } from "./features/city/City";
import { pressFanAct } from "./features/city/fan/fan.testing";
import { sendOff } from "./shared/world/sendOff";


// The scene is the stand-in that opens a tapped thing's fan beside it and walks at once (R-WORLD-034).
vi.mock("./features/city/CityScene", async () => ({ default: (await import("./features/city/fan/fan.testing")).StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("./shared/three/manifest", async (original) => {
  const real = await original<typeof import("./shared/three/manifest")>();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const assets = path.join(import.meta.dirname, "..", "public", "assets");
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
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
  window.localStorage.clear();
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}

describe("the deposit and the plane in the world", () => {
  test("[R-WORLD-006] given a school offer and no deposit, when the bank's counter is asked to pay the deposit, then route/pay-deposit names the school", async () => {
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.olokun-office"]));
    // Enough in the naira bank for the deposit, so the card's one button is open (a short balance shuts it, R-WORLD-006).
    const rich = richView();
    const view: PlayerView = { ...rich, pockets: { ...rich.pockets, NGN: { ...rich.pockets.NGN, bank: 9_000_000_000 } } };
    const { authority } = await renderWithView(<City world />, view);
    await pressFanAct("counter", "deposit");
    const card = await screen.findByRole("dialog");
    expect(within(card).getByRole("heading").textContent).toBe(say("ui.route.pay-deposit"));
    expect(found("[data-ask-main]").getAttribute("data-short")).toBeNull();
    fireEvent.click(found("[data-ask-main]"));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "route/pay-deposit", route: "route.uk-masters", school: "school.northgate", basedOn: view.v }]));
  });

  test("[R-CHAPTER-006] [R-CHAPTER-012] given a granted visa, when the airport's gate is asked to board, then the send-off scene opens in place of a card, and its gate's Board the plane sends route/depart once", async () => {
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.airport-lagos"]));
    const rich = richView();
    const view: PlayerView = { ...rich, routes: rich.routes.map((route) => ({ ...route, state: "granted" })) };
    const { authority } = await renderWithView(<City world />, view);
    await pressFanAct("gate", "depart");
    await waitFor(() => found("[data-send-off='departures']"), { timeout: 5000 });
    expect(document.querySelector("[data-ask-main]")).toBeNull();
    expect(authority.sent).toEqual([]);
    for (let tap = 0; tap < 3; tap += 1) fireEvent.click(found("[data-so-go='step']"));
    fireEvent.click(await waitFor(() => found("[data-so-go='take']"), { timeout: 4000 }));
    expect(authority.sent).toEqual([]);
    fireEvent.click(found("[data-so-go='board']"));
    await waitFor(() => expect(authority.sent).toEqual([{ type: "route/depart", route: "route.uk-masters", basedOn: view.v }]));
    await waitFor(() => found("[data-send-off='plane']"));
    act(() => sendOff.getState().close());
  });
});
