// Ending a life (account.md R-ACCOUNT-030): locally the save and the kept person go, nothing is written again until a
// new life is chosen, and the next one starts on a roll of its own; online the account's own route ends it; either
// way the store drops what the device kept of the life and opens the front door.
import type { Save } from "@japacity/sim";
import { lifeStart } from "@japacity/sim";
import { afterEach, describe, expect, test } from "vitest";

import { DAYS_KEY } from "../shared/days/days.store";
import { engineView } from "../shared/testing/fixtures";
import { BASE, fakeServer } from "../shared/testing/server";
import { TRAIL_KEY } from "../features/prologue/years";
import { forgetLife, LIFE_KEYS } from "./ended";
import { localAuthority, SAVE_KEY } from "./local";
import { keepPerson, PERSON_KEY, readPerson } from "./person";
import { remoteAuthority } from "./remote";
import { createGameStore, MONTH_KEY } from "./store";

afterEach(() => {
  localStorage.clear();
});

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

const seeds = () => {
  let n = 0;
  return () => `seed-${String((n += 1))}`;
};

function seedOf(storage: ReturnType<typeof memoryStorage>): string | null {
  const raw = storage.items.get(SAVE_KEY);
  if (raw === undefined) return null;
  return lifeStart((JSON.parse(raw) as { save: Save }).save)?.seed ?? null;
}

describe("ending a life on this device", () => {
  test("[R-ACCOUNT-030] given a local life and its kept person, when the life ends, then the save and the person are gone, nothing is written while the door is open, a reload opens the door, and the next life starts on a seed of its own", async () => {
    const storage = memoryStorage();
    const makeSeed = seeds();
    const authority = localAuthority({ fastClock: true, storage, makeSeed, now: () => 0 });
    keepPerson({ look: "chr_ada", name: "Bisi", archetype: null }, storage);
    await authority.newLife("scenario.ada");
    const old = seedOf(storage);
    expect(old).not.toBeNull();

    expect(await authority.endLife()).toBe(true);

    expect(storage.items.has(SAVE_KEY)).toBe(false);
    expect(readPerson(storage)).toBeNull();
    await authority.view();
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    expect(localAuthority({ fastClock: true, storage, makeSeed, now: () => 0 }).start).toEqual({ kind: "new" });

    await authority.newLife("scenario.ada");
    expect(seedOf(storage)).not.toBeNull();
    expect(seedOf(storage)).not.toBe(old);
  });

  test("[R-ACCOUNT-030] given what a life keeps beside its save, then the keys forgotten hold the person, the month, the days and the years' trail as their own modules name them, and the device's settings stay", () => {
    expect(LIFE_KEYS).toEqual(expect.arrayContaining([PERSON_KEY, MONTH_KEY, DAYS_KEY, TRAIL_KEY]));
    for (const key of LIFE_KEYS) localStorage.setItem(key, "kept");
    localStorage.setItem("japacity.theme", "danfo");
    localStorage.setItem("japacity.sound.muted", "1");

    forgetLife();

    for (const key of LIFE_KEYS) expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem("japacity.theme")).toBe("danfo");
    expect(localStorage.getItem("japacity.sound.muted")).toBe("1");
  });

  test("[R-ACCOUNT-030] given a store over a local life, when the life is ended, then the view is gone, the door opens, the device keeps nothing of the life, and the page is asked to load afresh once", async () => {
    const authority = localAuthority({ fastClock: true, makeSeed: seeds(), now: () => 0 });
    let afresh = 0;
    const store = createGameStore(authority, { life: authority, afterLifeEnded: () => (afresh += 1) });
    keepPerson({ look: "chr_ada", name: "Bisi", archetype: null });
    await store.getState().chooseLife("scenario.ada");
    localStorage.setItem(MONTH_KEY, "{}");
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull();

    expect(await store.getState().endLife?.()).toBe(true);

    const state = store.getState();
    expect(state.view).toBeNull();
    expect(state.choosingLife).toBe(true);
    expect(state.busy).toBe(false);
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
    expect(localStorage.getItem(PERSON_KEY)).toBeNull();
    expect(localStorage.getItem(MONTH_KEY)).toBeNull();
    expect(afresh).toBe(1);
  });

  test("[R-ACCOUNT-030] given a store whose authority cannot end a life, then it offers no end", () => {
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: seeds(), now: () => 0 });
    expect(createGameStore(authority).getState().endLife).toBeNull();
  });
});

describe("ending a life online", () => {
  function setUp() {
    const server = fakeServer();
    const remote = remoteAuthority({ baseUrl: `${BASE}/`, fetch: server.fetch, now: () => 0, wait: () => Promise.resolve() });
    return { server, remote };
  }

  test("[R-ACCOUNT-030] given a character, when the life is ended, then it posts to /api/character/end and forgets the version it held", async () => {
    const { server, remote } = setUp();
    server.answer("POST /api/character", { body: { ok: true, view: engineView(), lines: [], clock: { tick: 0, nextTickAt: 1, nextTurnAt: null } } });
    await remote.newLife("scenario.ada");
    expect(remote.held()).not.toBeNull();
    server.answer("POST /api/character/end", { body: { ok: true } });

    expect(await remote.endLife()).toBe(true);

    expect(server.sent.at(-1)).toMatchObject({ method: "POST", path: "/api/character/end" });
    expect(remote.held()).toBeNull();
  });

  test("[R-ACCOUNT-030] given the server answers no-character, then the life counts as ended; given another refusal, then it does not", async () => {
    const { server, remote } = setUp();
    server.answer("POST /api/character/end", { status: 404, body: { ok: false, code: "no-character", detail: "none" } });
    expect(await remote.endLife()).toBe(true);
    server.answer("POST /api/character/end", { status: 409, body: { ok: false, code: "not-possible", detail: "no" } });
    expect(await remote.endLife()).toBe(false);
  });
});
