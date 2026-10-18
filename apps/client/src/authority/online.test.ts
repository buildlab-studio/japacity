import type { ClockView } from "@japacity/api";
import { content } from "@japacity/content";
import { worldClockAt } from "@japacity/sim";
import type { Id, PlayerView } from "@japacity/sim";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { abroadView, engineView } from "../shared/testing/fixtures";
import { BASE, fakeServer } from "../shared/testing/server";
import { fakeSockets } from "../shared/testing/socket";
import { goOnline, placeOf } from "./online";
import { remoteAuthority } from "./remote";
import { createGameStore } from "./store";

const NOW = 1_000_000;
const CLOCK: ClockView = { tick: 3, nextTickAt: NOW + 10_000, nextTurnAt: NOW + 5_000, morningAt: 0, world: worldClockAt(0) };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const reply = (view: PlayerView, clock: ClockView = CLOCK) => ({ body: { ok: true, view, lines: [], clock } });

/** A document's stand-in: its visibility set by the test, and its events heard. */
function fakePage() {
  const target = new EventTarget();
  let state: DocumentVisibilityState = "visible";
  const page = Object.defineProperty(target, "visibilityState", { get: () => state }) as EventTarget & { visibilityState: DocumentVisibilityState };
  const turn = (to: DocumentVisibilityState) => {
    state = to;
    target.dispatchEvent(new Event("visibilitychange"));
  };
  return { page, turn };
}

async function setUp(first: PlayerView = { ...engineView(), v: 2 }) {
  const server = fakeServer();
  server.answer("GET /api/view", reply(first));
  // A login wall here shows the card; the page's one reload for it is wall.test.ts's.
  const remote = remoteAuthority({ baseUrl: BASE, fetch: server.fetch, wall: { met: () => false, passed: () => undefined } });
  const store = createGameStore(remote, { life: remote, lifeAgain: false, wait: () => Promise.resolve() });
  const { open, opened } = fakeSockets();
  const focus = new EventTarget();
  const { page, turn } = fakePage();
  const stop = goOnline({ store, remote, open, random: () => 0, now: () => Date.now(), focus, page });
  await store.getState().refresh();
  const views = () => server.sent.filter((request) => request.path === "/api/view").length;
  return { server, store, opened, focus, turn, stop, views };
}

describe("going online", () => {
  test("[clock:moving-switches-place-socket] given the character at home, then one socket opens for home's hub place, from the same server", async () => {
    const { opened } = await setUp();
    const home = placeOf(engineView());
    expect(content.place[home as Id<"place">]?.hub).toBe(true);
    expect(opened.map((socket) => socket.url)).toEqual([`wss://play.test/api/place/${home}/socket`]);
  });

  test("[clock:moving-switches-place-socket] given the character moves abroad, then the old place's socket closes and the new one's opens", async () => {
    const { server, store, opened } = await setUp();
    const abroad = { ...abroadView(), v: 3 };
    server.answer("GET /api/view", reply(abroad));
    await store.getState().refresh();
    expect(opened).toHaveLength(2);
    expect(opened[0]?.closed).toBe(true);
    expect(opened[1]?.url).toBe(`wss://play.test/api/place/${placeOf(abroad)}/socket`);
    expect(content.place[placeOf(abroad) as Id<"place">]?.country).toBe(abroad.place.country);
  });

  test("[clock:nudges-are-best-effort] given the tab regains focus, then the view is fetched", async () => {
    const { focus, views } = await setUp();
    const before = views();
    focus.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(views()).toBe(before + 1));
  });

  test("[engine:browser-authority-for-dev-only] given the page shown again from the back-forward cache, then the view is read again once, and the clock and the month's plan survive", async () => {
    const { server, store, focus, views } = await setUp();
    store.getState().setSlot(0, { activity: "activity.learn-tech", param: null });
    const plan = store.getState().plan;
    const later: ClockView = { ...CLOCK, tick: 4 };
    server.answer("GET /api/view", reply({ ...engineView(), v: 2 }, later));
    const before = views();
    focus.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    await vi.waitFor(() => expect(views()).toBe(before + 1));
    await vi.waitFor(() => expect(store.getState().clock?.tick).toBe(4));
    expect(store.getState().plan).toEqual(plan);
  });

  test("[engine:browser-authority-for-dev-only] given the tab turns visible after the phone slept, then the view is read again; turning hidden reads nothing", async () => {
    const { turn, views } = await setUp();
    const before = views();
    turn("hidden");
    await vi.advanceTimersByTimeAsync(10);
    expect(views()).toBe(before);
    turn("visible");
    await vi.waitFor(() => expect(views()).toBe(before + 1));
  });

  test("[engine:browser-authority-for-dev-only] given the browser left and come back with focus, pageshow and visible at once, then one request reads the view", async () => {
    const { focus, turn, views } = await setUp();
    const before = views();
    focus.dispatchEvent(new Event("focus"));
    focus.dispatchEvent(new Event("pageshow"));
    turn("visible");
    await vi.advanceTimersByTimeAsync(10);
    expect(views()).toBe(before + 1);
  });

  test("[engine:browser-authority-for-dev-only] [account:session-is-secure-cookie] given the session lost while away (the wall's redirect), when the page comes back, then the card says so and the life on screen stays", async () => {
    const { server, store, focus } = await setUp();
    server.answer("GET /api/view", () => Promise.resolve({ status: 302, body: "", headers: { "content-type": "text/html" } }));
    focus.dispatchEvent(new Event("pageshow"));
    await vi.waitFor(() => expect(store.getState().trouble).toEqual({ kind: "wall", during: "view" }));
    expect(store.getState().view?.v).toBe(2);
  });

  test("[clock:nudge-triggers-ordinary-fetch] given a view nudge above the version held, then the view is fetched through an ordinary request", async () => {
    const { opened, views } = await setUp();
    const before = views();
    opened[0]?.push({ nudge: "view", v: 2 });
    expect(views()).toBe(before);
    opened[0]?.push({ nudge: "view", v: 3 });
    await vi.waitFor(() => expect(views()).toBe(before + 1));
  });

  test("[clock:nudge-triggers-ordinary-fetch] given a presence nudge, then the sample is fetched and kept", async () => {
    const { server, store, opened } = await setUp();
    const home = placeOf(engineView());
    server.answer(`GET /api/place/${home}`, { body: { place: home, others: [{ name: "Tunde", look: "a" }], today: [] } });
    opened[0]?.push({ nudge: "presence" });
    await vi.waitFor(() => expect(store.getState().presence?.others).toHaveLength(1));
  });

  test("[pair:conversation-phrases-stored] given a messages nudge, then the store counts it so an open conversation fetches what is new, and no view is fetched", async () => {
    const { store, opened, views } = await setUp();
    const before = views();
    opened[0]?.push({ nudge: "messages" });
    opened[0]?.push({ nudge: "messages" });
    expect(store.getState().messageNudges).toBe(2);
    expect(views()).toBe(before);
  });

  test("[clock:world-fetch-is-jittered] given the next tick at 10 seconds, then the world and the view are fetched when it comes and not before", async () => {
    const { server, store, views } = await setUp();
    server.answer("GET /api/world", { body: { tick: 4, world: { tick: 4 }, nextTickAt: NOW + 43_200_000 } });
    const before = views();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(server.sent.some((request) => request.path === "/api/world")).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(store.getState().world?.tick).toBe(4));
    await vi.waitFor(() => expect(views()).toBe(before + 1));
  });

  test("[clock:sockets-reconnect-with-backoff] given the player signs out, then the socket closes and does not come back", async () => {
    const { store, opened } = await setUp();
    store.getState().leave(null);
    expect(opened[0]?.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(opened).toHaveLength(1);
  });
});

describe("the socket's place, as the server's placeOfIn answers it", () => {
  test("[clock:presence-is-a-sample] [city:ojuelegba-is-the-hub] given home, abroad in the UK and the road, then the socket's place is the hub the server answers for each", () => {
    const home = engineView();
    const abroad = abroadView();
    const road: PlayerView = { ...home, place: { ...home.place, where: "road", country: null } };
    expect(placeOf(home)).toBe("place.ojuelegba");
    expect(abroad.place.country).toBe("country.uk");
    expect(placeOf(abroad)).toBe("place.peckham");
    expect(placeOf(road)).toBe("place.road-night");
  });
});
