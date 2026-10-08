// The seams between the pieces: the screens, the share button, the asks and
// the usage setting feeding the interface counters, and the city's graphics
// mode reaching the feedback form.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "./App";
import { createGameStore } from "./authority/store";
import { ShareButton } from "./features/card/ShareCard";
import { countAsk } from "./features/notify/ask";
import { UsageCounts } from "./features/account/Settings";
import { countInto } from "./shared/analytics/start";
import { makeCounters, type CounterRow } from "./shared/analytics/counters";
import { graphicsMode, setGraphicsMode } from "./shared/graphics/mode";
import type { AccountApi } from "./shared/net/auth";
import { abroadView, engineView, fakeAuthority } from "./shared/testing/fixtures";
import "./shared/testing/render";
import { say } from "./shared/words/text";

vi.mock("./shared/card/render", () => ({ renderCard: () => Promise.resolve({ ok: true, blob: new Blob(["card"], { type: "image/png" }), bytes: 4 }) }));

let bodies: string[] = [];
let counters = makeCounters({ send: (body) => bodies.push(body) });
let restore: () => void = () => undefined;

beforeEach(() => {
  bodies = [];
  counters = makeCounters({ send: (body) => bodies.push(body) });
  restore = countInto(counters);
});

afterEach(() => {
  restore();
});

/** What the counters would send now. */
function sent(): CounterRow[] {
  counters.flush();
  return bodies.flatMap((body) => (JSON.parse(body) as { rows: CounterRow[] }).rows);
}

async function playing(view: PlayerView = engineView("scenario.tunde")) {
  const store = createGameStore(fakeAuthority(view));
  await store.getState().refresh();
  render(<App store={store} />);
  return store;
}

describe("the interface counters", () => {
  test("[R-ANALYTICS-002] given the shell, when tabs are opened, then each opening counts its screen once, keyed by the feature that leads it", async () => {
    await playing();
    const nav = await screen.findByRole("navigation", { name: say("ui.tabs") });
    fireEvent.click(within(nav).getByRole("button", { name: say("ui.tab.people") }));
    fireEvent.click(within(nav).getByRole("button", { name: say("ui.tab.money") }));
    fireEvent.click(within(nav).getByRole("button", { name: say("ui.tab.people") }));
    const screens = sent().filter((row) => row.name === "screen/opened");
    expect(screens).toEqual(
      expect.arrayContaining([
        { name: "screen/opened", key: "turn", count: 1 },
        { name: "screen/opened", key: "people", count: 2 },
        { name: "screen/opened", key: "wallet", count: 1 },
      ]),
    );
  });

  test("[R-ANALYTICS-002] given a card to share, when the share button is pressed and the card goes, then share/pressed and share/completed count for its kind", async () => {
    const card = { kind: "send-off" as const, route: "route.uk-masters" as const, percent: 82, months: 35, standing: 61, topActivities: [], chapter: null, name: null };
    const saved: File[] = [];
    render(<ShareButton card={card} scenario="scenario.tunde" device={{ canShare: undefined, share: undefined, save: (file) => saved.push(file) }} />);
    fireEvent.click(screen.getByRole("button", { name: say("share.button.save") }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(sent()).toEqual([
      { name: "share/pressed", key: "send-off", count: 1 },
      { name: "share/completed", key: "send-off", count: 1 },
    ]);
  });

  test("[R-ANALYTICS-011] given the bank-full ask shown and taken after the early win, then the interface counters hold notify:after for each", () => {
    countAsk("ask/shown", "notify", "after");
    countAsk("ask/accepted", "notify", "after");
    expect(sent()).toEqual([
      { name: "ask/shown", key: "notify:after", count: 1 },
      { name: "ask/accepted", key: "notify:after", count: 1 },
    ]);
  });

  test("[R-ANALYTICS-006] given the account's usage counts on, when the player turns them off, then the account keeps it and the counters drop what they hold and count nothing more", async () => {
    const kept: boolean[] = [];
    const account = { usageCounts: () => Promise.resolve(true), setUsageCounts: (on: boolean) => (kept.push(on), Promise.resolve(true)) } as unknown as AccountApi;
    render(<UsageCounts account={account} />);
    const box = await screen.findByRole("checkbox", { name: say("ui.account.usage") });
    await waitFor(() => expect(box).toHaveProperty("disabled", false));
    expect(box).toHaveProperty("checked", true);
    counters.count("screen/opened", "news");
    fireEvent.click(box);
    await waitFor(() => expect(box).toHaveProperty("checked", false));
    expect(kept).toEqual([false]);
    counters.count("screen/opened", "news");
    expect(sent()).toEqual([]);
  });

  test("[R-ANALYTICS-006] given an account that turned the counters off, when its settings open, then the switch shows off and nothing is counted", async () => {
    const account = { usageCounts: () => Promise.resolve(false), setUsageCounts: () => Promise.resolve(true) } as unknown as AccountApi;
    render(<UsageCounts account={account} />);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: say("ui.account.usage") })).toHaveProperty("checked", false));
    counters.count("screen/opened", "news");
    expect(sent()).toEqual([]);
  });
});

describe("the graphics mode", () => {
  test("[R-MODERATION-020] given the city on screen, then the mode it runs in is the one feedback reads", async () => {
    setGraphicsMode("high");
    await playing(abroadView());
    await act(async () => {
      await Promise.resolve();
    });
    // jsdom reports no fine pointer, so the city starts as a phone does.
    expect(graphicsMode()).toBe("low");
  });
});

describe("the city behind the road", () => {
  test("[R-CITY-012] given the character on the road, when the shell shows the road screen, then the city stands behind its panel at a stylised place", async () => {
    const base = engineView("scenario.tunde");
    await playing({ ...base, place: { ...base.place, where: "road" } });
    const city = document.querySelector<HTMLElement>("[data-road] [data-city]");
    if (city === null) throw new Error("No city on the road screen.");
    const shown = content.place[city.dataset.city as keyof typeof content.place];
    expect(shown?.nameKind).toBe("stylised");
  });
});

