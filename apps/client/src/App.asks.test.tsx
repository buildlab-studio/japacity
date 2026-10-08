// Nothing is asked of the player before the early win (docs/rules/guides.md
// R-GUIDE-015): the share card and its button wait in the shell until the
// store's flag is up, and then show as they always did.
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "./App";
import { createGameStore, type GameStore } from "./authority/store";
import { makeCounters, type CounterRow } from "./shared/analytics/counters";
import { countInto } from "./shared/analytics/start";
import { engineView, fakeAuthority } from "./shared/testing/fixtures";
import "./shared/testing/render";
import { cardKey } from "./shared/ui/stage";
import { say } from "./shared/words/text";
import { onTheClassicPage } from "./shared/testing/classic";

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

function sent(): CounterRow[] {
  counters.flush();
  return bodies.flatMap((body) => (JSON.parse(body) as { rows: CounterRow[] }).rows);
}

const DRAW_WIN: NonNullable<PlayerView["card"]> = { kind: "draw-win", route: null, percent: null, months: 2, standing: 0, topActivities: [], chapter: null, name: null };

function withCard(): PlayerView {
  return { ...engineView("scenario.tunde"), card: DRAW_WIN };
}

async function playing(view: PlayerView, earlyWin: boolean): Promise<GameStore> {
  const store = createGameStore(fakeAuthority(view));
  await store.getState().refresh();
  store.setState({ earlyWin });
  render(<App store={store} />);
  await waitFor(() => expect(document.querySelector("main[data-where]")).not.toBeNull());
  return store;
}

const shareButtons = () => document.querySelectorAll("[data-share-button]");
const cardTiles = () => document.querySelectorAll("[data-card-tile]");

// The old month page these tests drive opens only with ?classic (R-WORLD-024).
onTheClassicPage();

describe("the share card waits for the early win", () => {
  test("[R-GUIDE-015] given a card due before the early win, when the shell shows, then neither the card, its tile nor its share button is on screen, and no ask is counted", async () => {
    const store = await playing(withCard(), false);
    expect(store.getState().earlyWin).toBe(false);
    expect(cardTiles()).toHaveLength(0);
    expect(shareButtons()).toHaveLength(0);
    expect(screen.queryByText(say("share.draw-win.ready"))).toBeNull();
    expect(sent().filter((row) => row.name.startsWith("ask/"))).toEqual([]);
  });

  test("[R-GUIDE-015] given a card held back, then it is put aside as closed, so a scene after it is not kept waiting", async () => {
    const store = await playing(withCard(), false);
    await waitFor(() => expect(store.getState().cardClosed).toBe(cardKey(DRAW_WIN)));
  });

  test("[R-GUIDE-015] given a card held back, when the early win is shown, then its tile shows and opens the card with its share button", async () => {
    const store = await playing(withCard(), false);
    act(() => store.setState({ earlyWin: true }));
    expect(await screen.findByText(say("share.draw-win.ready"))).toBeDefined();
    expect(cardTiles()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: say("ui.card.open") }));
    await waitFor(() => expect(shareButtons()).toHaveLength(1));
  });

  test("[R-GUIDE-015] given the early win already shown, when a card is due, then it opens on its own with its share button, as before", async () => {
    await playing(withCard(), true);
    await waitFor(() => expect(shareButtons()).toHaveLength(1));
  });
});
