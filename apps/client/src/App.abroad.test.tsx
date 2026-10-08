import type { PlayerView } from "@japacity/sim";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";
import { bootGame } from "./authority/boot";
import { SAVE_KEY } from "./authority/local";
import { createGameStore } from "./authority/store";
import { abroadView, fakeAuthority, recordedSave, richAbroadView } from "./shared/testing/fixtures";
import { say, words } from "./shared/words/text";
// Registers Testing Library's cleanup for this file.
import "./shared/testing/render";

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

async function tabNames(): Promise<string[]> {
  const nav = await screen.findByRole("navigation", { name: say("ui.tabs") });
  return within(nav)
    .getAllByRole("button")
    .map((button) => button.textContent);
}

async function showing(view: PlayerView) {
  const store = createGameStore(fakeAuthority(view));
  await store.getState().refresh();
  render(<App store={store} />);
  return store;
}

describe("the shell by where the character is", () => {
  test("[R-GATE-003] [R-CHAPTER-006] given Ada's recorded life up to the flight, when she boards, then the flight is a moment of its own, the send-off card follows it, and the shell turns to life abroad", async () => {
    const save = recordedSave("ada-careful");
    const beforeFlight = { ...save, commands: save.commands.slice(0, -1) };
    expect(save.commands.at(-1)?.command.type).toBe("route/depart");
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ save: beforeFlight, clock: { anchor: 0 } }));
    render(<App store={bootGame({ storage, fastClock: true })} />);

    expect(await tabNames()).toEqual(["month", "you", "money", "japa", "news"].map((tab) => say(`ui.tab.${tab}`)));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.route.depart") }));

    const moment = await screen.findByRole("dialog");
    expect(within(moment).getByText(words("line.route.departed", { route: "route.uk-masters" }))).toBeDefined();
    expect(moment.querySelector("[data-share-card]")).toBeNull();
    fireEvent.click(within(moment).getByRole("button", { name: /./ }));

    // R-CHAPTER-006: the send-off card comes after the flight's moment, before the tabs of life abroad.
    const card = await screen.findByRole("dialog", { name: words("chapter.send-off.title") });
    expect(card.querySelector("[data-share-card='send-off']")).not.toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: say("ui.report.close") }));

    expect(await tabNames()).toEqual(["month", "you", "money", "status", "home"].map((tab) => say(`ui.tab.${tab}`)));
    expect(screen.getByText(say("ui.place.way-home"))).toBeDefined();
    expect(screen.getByRole("heading", { name: say("ui.status.title") })).toBeDefined();
  });

  test("[R-STATUS-003] given the clock running abroad, then it shows above the tabs whichever tab is open", async () => {
    await showing(richAbroadView());
    const banner = screen.getAllByRole("alert").find((element) => element.hasAttribute("data-clock"));
    expect(banner).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.tab.home") }));
    expect(document.querySelector("[data-clock]")).not.toBeNull();
  });

  test("[R-ROAD-007] given the road, then one panel shows the chain's card and the exit, and nothing else: no tabs, no japacity", async () => {
    const base = abroadView();
    const view: PlayerView = {
      ...base,
      place: { where: "road", country: null, monthsHere: 1, returns: [], heldAbroad: null, fareHome: null },
      status: null,
      credit: null,
      japacity: { percent: 40, route: "route.uk-masters" },
      freeSlots: 0,
      setpiece: { entry: "setpiece.road-truth", asked: 0, total: 1, question: { id: "truth", answers: ["pay", "call-home", "exit"], allowed: ["pay", "call-home", "exit"], weak: [] } },
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
