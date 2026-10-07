import { content } from "@japacity/content";
import type { Command, Content, Save } from "@japacity/sim";
import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { localAuthority, SAVE_KEY } from "./local";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

function storedSave(storage: ReturnType<typeof memoryStorage>): Save {
  const raw = storage.items.get(SAVE_KEY);
  if (raw === undefined) throw new Error("Nothing was saved.");
  return (JSON.parse(raw) as { save: Save }).save;
}

const seeds = () => {
  let n = 0;
  return () => `seed-${String((n += 1))}`;
};

const endTurn = (v: number): Command => ({ type: "turn/end", slots: [], basedOn: v });

describe("the local authority", () => {
  test("given a new life, when a month is ended, then the month and the world tick both move on by one", async () => {
    const storage = memoryStorage();
    const authority = localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 });
    expect(authority.start).toEqual({ kind: "new" });

    const before = await authority.view();
    expect(before.month).toBe(0);
    const reply = await authority.send(endTurn(before.v));
    if (!reply.ok) throw new Error(`Rejected: ${reply.code}`);
    expect(reply.view.month).toBe(1);
    expect(reply.view.turns.banked).toBe(before.turns.banked - 1);
    expect(reply.view.report?.month).toBe(1);

    const second = await authority.send(endTurn(reply.view.v));
    if (!second.ok) throw new Error(`Rejected: ${second.code}`);
    const ticks = storedSave(storage).commands.map((entry) => entry.tick);
    expect(ticks).toEqual([0, 1]);
  });

  test("given a saved life, when the page reloads, then the same life comes back from the save", async () => {
    const storage = memoryStorage();
    const first = localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 });
    let view = await first.view();
    for (let month = 0; month < 3; month += 1) {
      const reply = await first.send(endTurn(view.v));
      if (!reply.ok) throw new Error(`Rejected: ${reply.code}`);
      view = reply.view;
    }

    const reloaded = localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 });
    expect(reloaded.start).toEqual({ kind: "loaded" });
    expect(await reloaded.view()).toEqual(view);

    // The world tick carries on from where it was, not from zero.
    const next = await reloaded.send(endTurn(view.v));
    expect(next.ok).toBe(true);
    expect(storedSave(storage).commands.at(-1)?.tick).toBe(3);
  });

  test("given a save for another content version, when the page loads, then a new life starts and says why", async () => {
    const storage = memoryStorage();
    const old = localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 });
    const view = await old.view();
    await old.send(endTurn(view.v));

    const newer: Content = { ...content, version: `${content.version}-next` };
    const authority = localAuthority({ fastClock: false, storage, content: newer, makeSeed: seeds(), now: () => 0 });
    expect(authority.start).toEqual({ kind: "replaced", why: "other-content" });
    expect((await authority.view()).month).toBe(0);
    expect(storedSave(storage).content).toBe(newer.version);
  });

  test("given a save that is not JSON, when the page loads, then a new life starts and says the save was unreadable", () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_KEY, "{not json");
    const authority = localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 });
    expect(authority.start).toEqual({ kind: "replaced", why: "unreadable" });
  });

  test("given a player command to grant turns, when it is sent, then it is rejected as not yours", async () => {
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: seeds() });
    const view = await authority.view();
    const reply = await authority.send({ type: "turns/grant", count: 5, basedOn: view.v });
    expect(reply).toMatchObject({ ok: false, code: "not-yours" });
  });

  test("given the real clock, when two hours pass with the bank below the cap, then one turn is granted", async () => {
    let clock = 0;
    const authority = localAuthority({ fastClock: false, storage: null, makeSeed: seeds(), now: () => clock });
    const start = await authority.view();
    const reply = await authority.send(endTurn(start.v));
    if (!reply.ok) throw new Error(`Rejected: ${reply.code}`);
    expect(reply.view.turns.banked).toBe(start.turns.cap - 1);

    clock += time.TURN_REFILL_MS - 1;
    expect((await authority.view()).turns.banked).toBe(start.turns.cap - 1);
    clock += 1;
    expect((await authority.view()).turns.banked).toBe(start.turns.cap);
  });

  test("given the real clock and a full bank, when days pass, then nothing is banked beyond the cap", async () => {
    let clock = 0;
    const authority = localAuthority({ fastClock: false, storage: null, makeSeed: seeds(), now: () => clock });
    const start = await authority.view();
    clock += time.BANK_REFILLS_IN_MS;
    const later = await authority.view();
    expect(later.turns.banked).toBe(start.turns.cap);
    // Time spent full is not saved up: spending a turn now earns nothing back at once.
    const reply = await authority.send(endTurn(later.v));
    if (!reply.ok) throw new Error(`Rejected: ${reply.code}`);
    expect(reply.view.turns.banked).toBe(start.turns.cap - 1);
  });

  test("given the fast clock, when the bank runs dry, then it is refilled without waiting", async () => {
    const authority = localAuthority({ fastClock: true, storage: null, makeSeed: seeds(), now: () => 0 });
    let view = await authority.view();
    const cap = view.turns.cap;
    for (let month = 0; month < cap; month += 1) {
      const reply = await authority.send(endTurn(view.v));
      if (!reply.ok) throw new Error(`Rejected at month ${String(month)}: ${reply.code}`);
      view = reply.view;
    }
    expect(view.month).toBe(cap);
    expect(view.turns.banked).toBe(cap);
  });

  test("given a new life is asked for, when it starts, then the old life is gone and the new scenario is played", async () => {
    const storage = memoryStorage();
    const authority = localAuthority({ fastClock: true, storage, makeSeed: seeds(), now: () => 0 });
    const view = await authority.view();
    await authority.send(endTurn(view.v));
    const other = Object.keys(content.scenario)[1] as Save["scenario"];
    const fresh = await authority.newLife(other);
    expect(fresh.scenario).toBe(other);
    expect(fresh.month).toBe(0);
    expect(storedSave(storage).commands).toEqual([]);
  });
});
