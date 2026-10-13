import type { PlayerView } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { App } from "./App";
import { bootGame } from "./authority/boot";
import { SAVE_KEY } from "./authority/local";
import { createGameStore } from "./authority/store";
import { abroadView, fakeAuthority, recordedSave, richAbroadView } from "./shared/testing/fixtures";
import { say, words } from "./shared/words/text";
import type { Act, Thing } from "./shared/world/contract";
// Registers Testing Library's cleanup for this file.
import { found } from "./shared/testing/render";

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

type Pick = { kind: "act"; thing: Thing; act: Act };

// The world's scene is a stand-in that hands the city the taps a player makes on the things of the place file the game ships.
vi.mock("./features/city/CityScene", () => ({
  default: ({ things, onPick }: { things?: Thing[]; onPick: (pick: Pick) => void }) => (
    <div data-stand-in-scene>
      {(things ?? []).flatMap((thing) =>
        thing.acts.map((one) => <button key={`${thing.id}:${one.id}`} type="button" data-stand-in-act={`${thing.id}:${one.id}`} onClick={() => onPick({ kind: "act", thing, act: one })} />),
      )}
    </div>
  ),
}));

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

async function showing(view: PlayerView) {
  const store = createGameStore(fakeAuthority(view));
  await store.getState().refresh();
  render(<App store={store} />);
  return store;
}

describe("the shell by where the character is", () => {
  test("[R-GATE-003] [R-CHAPTER-006] given Ada's recorded life up to the flight, when she boards, then the flight is a moment of its own, the send-off card follows it, and the world turns to life abroad", async () => {
    const save = recordedSave("ada-careful");
    const beforeFlight = { ...save, commands: save.commands.slice(0, -1) };
    expect(save.commands.at(-1)?.command.type).toBe("route/depart");
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ save: beforeFlight, clock: { anchor: 0 } }));
    // The world draws its place here (City.tsx canDraw); the scene is the stand-in above, at the family house where her bag is.
    Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
    try {
      const store = bootGame({ storage, fastClock: true });
      render(<App store={store} />);

      // R-SHARE-001: the decision day card of the month before is still due, so it opens first and is closed.
      const granted = await screen.findByRole("dialog", { name: words("share.granted.title") }, { timeout: 10000 });
      expect(granted.querySelector("[data-share-card='granted']")).not.toBeNull();
      fireEvent.click(within(granted).getByRole("button", { name: say("ui.report.close") }));

      // The world is the game (R-WORLD-001): the band, the two thumbs, no tabs; she boards from her packed bag.
      await waitFor(() => expect(document.querySelector("[data-band]")).not.toBeNull());
      expect(document.querySelector("[data-tab]")).toBeNull();
      fireEvent.click(await waitFor(() => found('[data-stand-in-act="bag:pack"]'), { timeout: 5000 }));
      fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.route.depart")}`) }));

      // The flight is a moment of its own (R-MOMENT-001: landing abroad), with no share card in it.
      const moment = await screen.findByRole("dialog", { name: say("moment.landed.kicker") }, { timeout: 10000 });
      expect(moment.querySelector("[data-moment-card='landed']")).not.toBeNull();
      expect(moment.querySelector("[data-share-card]")).toBeNull();
      fireEvent.click(within(moment).getByRole("button", { name: say("moment.close") }));

      // R-CHAPTER-006: the send-off card comes after the flight's moment, before life abroad.
      const card = await screen.findByRole("dialog", { name: words("chapter.send-off.title") }, { timeout: 10000 });
      expect(card.querySelector("[data-share-card='send-off']")).not.toBeNull();
      fireEvent.click(within(card).getByRole("button", { name: say("ui.report.close") }));

      // Life abroad: the world opens abroad, and the phone's Japa holds the status she lives on.
      await waitFor(() => expect(store.getState().view?.place.where).toBe("abroad"));
      const status = store.getState().view?.status?.entry ?? null;
      expect(status).not.toBeNull();
      fireEvent.click(await waitFor(() => found("[data-thumb='phone']")));
      fireEvent.click(await waitFor(() => found('[data-app="japa"]')));
      expect(await waitFor(() => found(`[data-japa-visa="${status ?? ""}"]`))).toBeDefined();
    } finally {
      vi.restoreAllMocks();
      Reflect.deleteProperty(window, "WebGL2RenderingContext");
      window.localStorage.clear();
    }
  }, 30000);

  test("[R-STATUS-003] given the clock running abroad, then it shows on the phone's home and above every app, whichever app is open", async () => {
    await showing(richAbroadView());
    // The world is the game (R-WORLD-001): the old page's tabs are the phone's apps (R-WORLD-018).
    fireEvent.click(await waitFor(() => found("[data-thumb='phone']"), { timeout: 10_000 }));
    const banner = await waitFor(() => screen.getAllByRole("alert").find((element) => element.hasAttribute("data-clock") && element.closest("[data-phone-warnings]") !== null)!);
    expect(banner).toBeDefined();
    fireEvent.click(await waitFor(() => found('[data-app="bank"]')));
    expect(await waitFor(() => found('[data-app-screen="bank"] > [data-clock]'))).toBeDefined();
  });

  test("[R-ROAD-007] given the road, then one panel shows the chain's card and the exit, and nothing else: no tabs, no japacity", async () => {
    const base = abroadView();
    const view: PlayerView = {
      ...base,
      place: { where: "road", country: null, monthsHere: 1, returns: [], heldAbroad: null, fareHome: null, fareBp: 10000, wayHome: null },
      status: null,
      credit: null,
      japacity: { percent: 40, route: "route.uk-masters" },
      freeSlots: 0,
      setpiece: { entry: "setpiece.road-truth", asked: 0, total: 1, question: { id: "truth", answers: ["pay", "call-home", "exit"], allowed: ["pay", "call-home", "exit"], weak: [], followUp: false } },
      report: null,
    };
    await showing(view);
    expect(screen.queryByRole("navigation", { name: say("ui.tabs") })).toBeNull();
    expect(screen.queryByLabelText(say("ui.japacity.title"))).toBeNull();
    expect(screen.queryByText("40%")).toBeNull();
    expect(screen.getByText(words("setpiece.road-truth.q.truth"))).toBeDefined();
    const exit = screen.getByRole("button", { name: words("setpiece.road-truth.a.truth.exit") });
    expect(exit.getAttribute("data-exit")).toBe("true");
    expect(screen.getByText(say("ui.road.exit-help"))).toBeDefined();
    expect(screen.queryByText(say("ui.wallet.title"))).toBeNull();
    expect(screen.queryByText(say("ui.route.title"))).toBeNull();
  });
});
