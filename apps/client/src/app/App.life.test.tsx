// engine:first-download-has-budget, world:lazy-part-fails-softly: the life's screens are one part fetched apart from the start screen. While
// they come, the opening splash stands; a fetch that fails is made again after the view's pauses and then shows the connection card over
// the splash with Retry; a tab on an older build reloads once instead. They are fetched ahead when the page is idle, or at once for a
// player this browser has a life for, the place's scene following them in the same chain.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { App, lifeParts } from "./App";
import { createGameStore, VIEW_RETRY_MS } from "../authority/store";
import { staleGuard, type StaleGuard } from "../shared/net/stale";
import type { AccountApi } from "../shared/net/auth";
import { LIFE_MARK_KEY, PERSON_KEY, STALE_KEY } from "../shared/storage/storage";
import { engineView } from "../shared/testing/fixtures";
import { say } from "../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";

type LifeModule = typeof import("./Life");

/** The life's screens as a stand-in that draws one line, and how often its scene was fetched ahead. */
function lifeModule() {
  const scene = { asked: 0 };
  const module = {
    default: () => <p data-life>The life</p>,
    sceneAhead: () => {
      scene.asked += 1;
      return Promise.resolve();
    },
  } as unknown as LifeModule;
  return { module, scene };
}

/** A fetch of the life's screens that fails `failures` times, as a lost connection fails a dynamic import, then gives them. */
function flaky(failures: number) {
  const { module, scene } = lifeModule();
  let calls = 0;
  const load = () => {
    calls += 1;
    if (calls <= failures) return Promise.reject(new TypeError("Failed to fetch dynamically imported module"));
    return Promise.resolve(module);
  };
  return { load, calls: () => calls, scene };
}

/** A tab on the same build as the server's: a failure stays the soft one. */
const SAME_BUILD: StaleGuard = { failed: () => Promise.resolve(false), loaded: () => undefined };

/** The view pauses, each held until the test lets it pass. */
function heldPauses() {
  const waited: number[] = [];
  const held: (() => void)[] = [];
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      waited.push(ms);
      held.push(resolve);
    });
  return { waited, wait, pass: () => held.shift()?.() };
}

/** An account a signed-out visitor meets at the start screen: the age screen not yet asked. */
function signedOutAccount(): AccountApi {
  return { ageStatus: () => Promise.resolve("unasked"), declareAge: () => Promise.resolve("passed"), sendCode: () => Promise.resolve({ ok: true }), returnedFromGoogle: () => null } as unknown as AccountApi;
}

/** A life the server holds: the view comes at once. */
function lifeStore() {
  return createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("not sent")) });
}

/** A life still opening: the view never comes, so only the fetch ahead can ask for the life's screens. */
function openingStore() {
  return createGameStore({ view: () => new Promise(() => undefined), send: () => Promise.reject(new Error("not sent")) });
}

describe("the life's screens, fetched apart (world:lazy-part-fails-softly)", () => {
  test("[world:lazy-part-fails-softly] [engine:first-download-has-budget] given the life's screens fail to download once, when the life opens, then the opening splash stands with no card, and they are fetched again after the view's first pause and drawn", async () => {
    const life = flaky(1);
    const pauses = heldPauses();
    render(<App store={lifeStore()} life={lifeParts({ load: life.load, wait: pauses.wait, stale: SAME_BUILD })} />);
    await waitFor(() => expect(pauses.waited).toEqual(VIEW_RETRY_MS.slice(0, 1)));
    expect(document.querySelector("[data-opening] [data-waiting]")?.textContent).toContain(say("ui.loading"));
    expect(document.querySelector("[data-trouble]")).toBeNull();
    expect(document.querySelector("[data-life]")).toBeNull();
    pauses.pass();
    await screen.findByText("The life");
    expect(life.calls()).toBe(2);
    expect(document.querySelector("[data-opening]")).toBeNull();
  });

  test("[world:lazy-part-fails-softly] given the life's screens fail on every fetch the pauses allow, then the connection card shows over the opening splash, never the broken screen, and Retry fetches them at once and draws the life", async () => {
    const life = flaky(VIEW_RETRY_MS.length + 1);
    render(<App store={lifeStore()} life={lifeParts({ load: life.load, wait: () => Promise.resolve(), stale: SAME_BUILD })} />);
    const retry = await screen.findByRole("button", { name: say("ui.trouble.retry") });
    expect(life.calls()).toBe(VIEW_RETRY_MS.length + 1);
    expect(document.querySelector("[data-trouble]")?.getAttribute("data-trouble")).toBe("network");
    expect(document.querySelector("[data-trouble]")?.getAttribute("data-trouble-during")).toBe("part");
    expect(document.querySelectorAll("[data-trouble]")).toHaveLength(1);
    expect(document.querySelector("[data-opening]")).not.toBeNull();
    expect(document.querySelector("[data-broken]")).toBeNull();
    fireEvent.click(retry);
    await screen.findByText("The life");
    expect(life.calls()).toBe(VIEW_RETRY_MS.length + 2);
    expect(document.querySelector("[data-trouble]")).toBeNull();
  });

  test("[world:lazy-part-fails-softly] given a tab on an older build whose life's screens are gone from the server, when they fail after the pauses, then the page reloads once to the newer build and no card shows", async () => {
    const life = flaky(Number.MAX_SAFE_INTEGER);
    const storage = new Map<string, string>();
    let reloads = 0;
    const stale = staleGuard({
      storage: () => ({ getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => void storage.set(key, value), removeItem: (key) => void storage.delete(key) }),
      own: () => "aaa111",
      live: () => Promise.resolve("bbb222"),
      reload: () => {
        reloads += 1;
      },
    });
    render(<App store={lifeStore()} life={lifeParts({ load: life.load, wait: () => Promise.resolve(), stale })} />);
    await waitFor(() => expect(reloads).toBe(1));
    expect(life.calls()).toBe(VIEW_RETRY_MS.length + 1);
    expect(document.querySelector("[data-trouble]")).toBeNull();
    expect(document.querySelector("[data-opening]")).not.toBeNull();
  });

  test("[world:lazy-part-fails-softly] given the tab already reloaded once for a newer build, when the life's screens fail again, then it does not reload a second time and the connection card shows with Retry", async () => {
    const life = flaky(Number.MAX_SAFE_INTEGER);
    const storage = new Map<string, string>([[STALE_KEY, "1"]]);
    let reloads = 0;
    const stale = staleGuard({
      storage: () => ({ getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => void storage.set(key, value), removeItem: (key) => void storage.delete(key) }),
      own: () => "aaa111",
      live: () => Promise.resolve("bbb222"),
      reload: () => {
        reloads += 1;
      },
    });
    render(<App store={lifeStore()} life={lifeParts({ load: life.load, wait: () => Promise.resolve(), stale })} />);
    await screen.findByRole("button", { name: say("ui.trouble.retry") });
    expect(reloads).toBe(0);
  });

  test("[world:lazy-part-fails-softly] given the tab reloaded once for a newer build, when the life's screens then load, then the mark is cleared", async () => {
    const life = flaky(0);
    const storage = new Map<string, string>([[STALE_KEY, "1"]]);
    const stale = staleGuard({
      storage: () => ({ getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => void storage.set(key, value), removeItem: (key) => void storage.delete(key) }),
      own: () => "aaa111",
      live: () => Promise.resolve("aaa111"),
      reload: () => undefined,
    });
    render(<App store={lifeStore()} life={lifeParts({ load: life.load, stale })} />);
    await screen.findByText("The life");
    expect(storage.has(STALE_KEY)).toBe(false);
  });
});

describe("the life's screens, fetched ahead (world:lazy-part-fails-softly)", () => {
  const idle: (() => void)[] = [];
  let saveData = false;

  beforeEach(() => {
    idle.length = 0;
    saveData = false;
    Object.assign(window, {
      requestIdleCallback: (run: () => void) => idle.push(run),
      cancelIdleCallback: () => undefined,
    });
    Object.defineProperty(navigator, "connection", { configurable: true, get: () => ({ saveData }) });
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem(PERSON_KEY);
    localStorage.removeItem(LIFE_MARK_KEY);
    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");
    Reflect.deleteProperty(navigator, "connection");
  });

  const keepPerson = () => localStorage.setItem(PERSON_KEY, JSON.stringify({ look: "person_ada", name: "Ada", archetype: null }));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  test("[world:lazy-part-fails-softly] given a browser with a kept life, when the page opens, then the life's screens are fetched at once, before the page is idle, and the place's scene follows them in the same chain", async () => {
    keepPerson();
    const life = flaky(0);
    render(<App store={openingStore()} life={lifeParts({ load: life.load, stale: SAME_BUILD })} />);
    await waitFor(() => expect(life.calls()).toBe(1));
    await waitFor(() => expect(life.scene.asked).toBe(1));
    expect(idle).toHaveLength(0);
  });

  test("[world:lazy-part-fails-softly] given a browser with a kept life and the player saving data, when the page opens, then the life's screens are still fetched at once, since the life opens on them", async () => {
    keepPerson();
    saveData = true;
    const life = flaky(0);
    render(<App store={openingStore()} life={lifeParts({ load: life.load, stale: SAME_BUILD })} />);
    await waitFor(() => expect(life.calls()).toBe(1));
  });

  test("[world:lazy-part-fails-softly] given a browser where a life opened last and no person kept, when the page opens, then the life's screens are fetched at once, before the page is idle, and the place's scene follows them", async () => {
    localStorage.setItem(LIFE_MARK_KEY, "1");
    const life = flaky(0);
    render(<App store={openingStore()} life={lifeParts({ load: life.load, stale: SAME_BUILD })} />);
    await waitFor(() => expect(life.calls()).toBe(1));
    await waitFor(() => expect(life.scene.asked).toBe(1));
    expect(idle).toHaveLength(0);
  });

  test("[world:lazy-part-fails-softly] given a stale mark and no person kept, when the page opens online and the view is still coming, then the start screen's frame stands, never the opening splash, while the life's screens are fetched", async () => {
    localStorage.setItem(LIFE_MARK_KEY, "1");
    const life = flaky(0);
    const store = createGameStore({ view: () => new Promise(() => undefined), send: () => Promise.reject(new Error("not sent")) }, { account: signedOutAccount() });
    render(<App store={store} life={lifeParts({ load: life.load, stale: SAME_BUILD })} />);
    await waitFor(() => expect(life.calls()).toBe(1));
    expect(document.querySelector("[data-opening]")).toBeNull();
  });

  test("[world:lazy-part-fails-softly] given a stale mark and a signed-out account, when the page opens, then the start screen shows with Play, never the opening splash, and the life's screens were downloaded once and not drawn", async () => {
    localStorage.setItem(LIFE_MARK_KEY, "1");
    const life = flaky(0);
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("not sent")) }, { account: signedOutAccount() });
    store.getState().leave(null);
    render(<App store={store} life={lifeParts({ load: life.load, stale: SAME_BUILD })} />);
    expect(await screen.findByRole("button", { name: say("ui.account.start.play") })).toBeDefined();
    await settle();
    expect(life.calls()).toBe(1);
    expect(document.querySelector("[data-opening]")).toBeNull();
    expect(document.querySelector("[data-life]")).toBeNull();
  });

  test("[world:lazy-part-fails-softly] given a browser with no life, when the page opens, then nothing is fetched until the page is idle, and then the life's screens and the scene are", async () => {
    const life = flaky(0);
    render(<App store={openingStore()} life={lifeParts({ load: life.load, stale: SAME_BUILD })} />);
    await settle();
    expect(life.calls()).toBe(0);
    expect(idle.length).toBeGreaterThan(0);
    for (const run of idle.splice(0)) run();
    await waitFor(() => expect(life.calls()).toBe(1));
    await waitFor(() => expect(life.scene.asked).toBe(1));
  });

  test("[world:lazy-part-fails-softly] given a browser with no life and the player saving data, when the page opens and is idle, then nothing is fetched ahead", async () => {
    saveData = true;
    const life = flaky(0);
    render(<App store={openingStore()} life={lifeParts({ load: life.load, stale: SAME_BUILD })} />);
    await settle();
    for (const run of idle.splice(0)) run();
    await settle();
    expect(life.calls()).toBe(0);
  });
});
