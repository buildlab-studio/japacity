import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { ClockView } from "../shared/net/contract";
import { abroadView, engineView } from "../shared/testing/fixtures";
import { BASE, fakeServer } from "../shared/testing/server";
import { fakeSockets } from "../shared/testing/socket";
import { goOnline, placeOf } from "./online";
import { remoteAuthority } from "./remote";
import { createGameStore } from "./store";

const NOW = 1_000_000;
const CLOCK: ClockView = { tick: 3, nextTickAt: NOW + 10_000, nextTurnAt: NOW + 5_000 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const reply = (view: PlayerView, clock: ClockView = CLOCK) => ({ body: { ok: true, view, lines: [], clock } });

async function setUp(first: PlayerView = { ...engineView(), v: 2 }) {
  const server = fakeServer();
  server.answer("GET /api/view", reply(first));
  const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch });
  const store = createGameStore(remote, { life: remote, lifeAgain: false });
  const { open, opened } = fakeSockets();
  const focus = new EventTarget();
  const stop = goOnline({ store, remote, open, random: () => 0, now: () => Date.now(), focus });
  await store.getState().refresh();
  const views = () => server.sent.filter((request) => request.path === "/api/view").length;
  return { server, store, opened, focus, stop, views };
}

describe("going online", () => {
  test("[R-CLOCK-027] given the character at home, then one socket opens for home's hub place, from the same server", async () => {
    const { opened } = await setUp();
    const home = placeOf(engineView());
    expect(content.place[home as Id<"place">]?.hub).toBe(true);
    expect(opened.map((socket) => socket.url)).toEqual([`wss://play.test/api/place/${home}/socket`]);
  });

  test("[R-CLOCK-027] given the character moves abroad, then the old place's socket closes and the new one's opens", async () => {
    const { server, store, opened } = await setUp();
    const abroad = { ...abroadView(), v: 3 };
    server.answer("GET /api/view", reply(abroad));
    await store.getState().refresh();
    expect(opened).toHaveLength(2);
    expect(opened[0]?.closed).toBe(true);
    expect(opened[1]?.url).toBe(`wss://play.test/api/place/${placeOf(abroad)}/socket`);
    expect(content.place[placeOf(abroad) as Id<"place">]?.country).toBe(abroad.place.country);
  });

  test("[R-CLOCK-022] given the tab regains focus, then the view is fetched", async () => {
    const { focus, views } = await setUp();
    const before = views();
    focus.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(views()).toBe(before + 1));
  });

  test("[R-CLOCK-021] given a view nudge above the version held, then the view is fetched through an ordinary request", async () => {
    const { opened, views } = await setUp();
    const before = views();
    opened[0]?.push({ nudge: "view", v: 2 });
    expect(views()).toBe(before);
    opened[0]?.push({ nudge: "view", v: 3 });
    await vi.waitFor(() => expect(views()).toBe(before + 1));
  });

  test("[R-CLOCK-021] given a presence nudge, then the sample is fetched and kept", async () => {
    const { server, store, opened } = await setUp();
    const home = placeOf(engineView());
    server.answer(`GET /api/place/${home}`, { body: { place: home, others: [{ name: "Tunde", look: "a" }], today: [] } });
    opened[0]?.push({ nudge: "presence" });
    await vi.waitFor(() => expect(store.getState().presence?.others).toHaveLength(1));
  });

  test("[R-PAIR-011] given a messages nudge, then the store counts it so an open conversation fetches what is new, and no view is fetched", async () => {
    const { store, opened, views } = await setUp();
    const before = views();
    opened[0]?.push({ nudge: "messages" });
    opened[0]?.push({ nudge: "messages" });
    expect(store.getState().messageNudges).toBe(2);
    expect(views()).toBe(before);
  });

  test("[R-CLOCK-019] given the next tick at 10 seconds, then the world and the view are fetched when it comes and not before", async () => {
    const { server, store, views } = await setUp();
    server.answer("GET /api/world", { body: { tick: 4, world: { tick: 4 }, nextTickAt: NOW + 43_200_000 } });
    const before = views();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(server.sent.some((request) => request.path === "/api/world")).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(store.getState().world?.tick).toBe(4));
    await vi.waitFor(() => expect(views()).toBe(before + 1));
  });

  test("[R-CLOCK-023] given the player signs out, then the socket closes and does not come back", async () => {
    const { store, opened } = await setUp();
    store.getState().leave(null);
    expect(opened[0]?.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(opened).toHaveLength(1);
  });
});

describe("the socket's place, as the server's placeOfIn answers it", () => {
  test("[R-CLOCK-028] [R-CITY-013] given home, abroad in the UK and the road, then the socket's place is the hub the server answers for each", () => {
    const home = engineView();
    const abroad = abroadView();
    const road: PlayerView = { ...home, place: { ...home.place, where: "road", country: null } };
    expect(placeOf(home)).toBe("place.ojuelegba");
    expect(abroad.place.country).toBe("country.uk");
    expect(placeOf(abroad)).toBe("place.peckham");
    expect(placeOf(road)).toBe("place.road-night");
  });
});
