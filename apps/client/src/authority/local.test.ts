import { content } from "@japacity/content";
import type { Command, Content, Id, Save } from "@japacity/sim";
import { lastSegment, lifeStart, savedCommands, time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { localAuthority, SAVE_KEY } from "./local";
import { PERSON_KEY } from "../shared/frontdoor/person";
import { memoryStorage } from "../shared/testing/storage";

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
    await authority.newLife("scenario.ada");

    const before = await authority.view();
    expect(before.month).toBe(0);
    const reply = await authority.send(endTurn(before.v));
    if (!reply.ok) throw new Error(`Rejected: ${reply.code}`);
    expect(reply.view.month).toBe(1);
    expect(reply.view.turns.banked).toBe(before.turns.banked - 1);
    expect(reply.view.report?.month).toBe(1);

    const second = await authority.send(endTurn(reply.view.v));
    if (!second.ok) throw new Error(`Rejected: ${second.code}`);
    const ticks = savedCommands(storedSave(storage)).map((entry) => entry.tick);
    expect(ticks).toEqual([0, 1]);
  });

  test("[R-PROLOGUE-009] given no save, when the authority starts and is read, then nothing is written until a life is chosen, so a reload brings the front door back", async () => {
    const storage = memoryStorage();
    const authority = localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 });
    expect(authority.start).toEqual({ kind: "new" });
    await authority.view();
    expect(storage.items.has(SAVE_KEY)).toBe(false);
    const again = localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 });
    expect(again.start).toEqual({ kind: "new" });
    await again.newLife("scenario.ada");
    expect(storage.items.has(SAVE_KEY)).toBe(true);
    expect(localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 }).start).toEqual({ kind: "loaded" });
  });

  test("given a saved life, when the page reloads, then the same life comes back from the save", async () => {
    const storage = memoryStorage();
    const first = localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 });
    await first.newLife("scenario.ada");
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
    expect(savedCommands(storedSave(storage)).at(-1)?.tick).toBe(3);
  });

  test("given a save for another content version, when the page loads, then a new life starts and says why", async () => {
    const storage = memoryStorage();
    const old = localAuthority({ fastClock: false, storage, makeSeed: seeds(), now: () => 0 });
    await old.newLife("scenario.ada");
    const view = await old.view();
    await old.send(endTurn(view.v));

    const newer: Content = { ...content, version: `${content.version}-next` };
    const authority = localAuthority({ fastClock: false, storage, content: newer, makeSeed: seeds(), now: () => 0 });
    expect(authority.start).toEqual({ kind: "replaced", why: "other-content" });
    expect((await authority.view()).month).toBe(0);
    expect(lastSegment(storedSave(storage)).content).toBe(newer.version);
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
    const other = Object.keys(content.scenario)[1] as Id<"scenario">;
    const fresh = await authority.newLife(other);
    expect(fresh.scenario).toBe(other);
    expect(fresh.month).toBe(0);
    expect(savedCommands(storedSave(storage))).toEqual([]);
  });
});

describe("a life from sixteen through a tile, where a life may be started over", () => {
  const PROLOGUE = "scenario.prologue" as Id<"scenario">;
  const keepTile = (storage: ReturnType<typeof memoryStorage>, archetype: string | null) => storage.setItem(PERSON_KEY, JSON.stringify({ look: "chr_ada", name: "Ada", archetype }));
  const seedOf = (storage: ReturnType<typeof memoryStorage>) => lifeStart(storedSave(storage))?.seed;

  test("[R-PROLOGUE-011] given a named seed, when a new life is started on it, then the life is on that seed and its world on a fresh one", async () => {
    const storage = memoryStorage();
    const authority = localAuthority({ fastClock: true, storage, makeSeed: seeds(), now: () => 0 });
    keepTile(storage, "trader");
    await authority.newLife(PROLOGUE, "named-seed");
    expect(lifeStart(storedSave(storage))).toMatchObject({ scenario: PROLOGUE, seed: "named-seed" });
    expect(lifeStart(storedSave(storage))?.worldSeed).not.toBe("named-seed");
  });

  test("[R-PROLOGUE-011] given the trader's tile kept beside the save, when lives from sixteen are started again and again, then each starts on a seed named from the drawn one, and after the subjects the card lets him learn a trade", async () => {
    const storage = memoryStorage();
    const authority = localAuthority({ fastClock: true, storage, makeSeed: seeds(), now: () => 0 });
    keepTile(storage, "trader");
    const tried: string[] = [];
    for (let life = 0; life < 12; life += 1) {
      let view = await authority.newLife(PROLOGUE);
      const seed = seedOf(storage) ?? "";
      expect(seed).toMatch(/^seed-\d+-[0-7]$/);
      tried.push(seed);
      for (const [step, answer] of [["draw", "begin"], ["subjects", "commercial"]] as const) {
        const reply = await authority.send({ type: "prologue/choose", step, answer, basedOn: view.v });
        if (!reply.ok) throw new Error(`Rejected: ${reply.code}`);
        view = reply.view;
      }
      expect(view.prologue?.step).toBe("after-school");
      expect({ seed, apprentice: view.prologue?.answers.find((answer) => answer.id === "apprentice")?.allowed }).toEqual({ seed, apprentice: true });
    }
    // The first seed alone would have shut the trade for some of them.
    expect(tried.some((seed) => !seed.endsWith("-0"))).toBe(true);
  });

  test("[R-PROLOGUE-011] given no tile kept, or a ready life, when a new life is started, then it keeps the seed drawn for it", async () => {
    const storage = memoryStorage();
    const authority = localAuthority({ fastClock: true, storage, makeSeed: seeds(), now: () => 0 });
    keepTile(storage, null);
    await authority.newLife(PROLOGUE);
    expect(seedOf(storage)).toMatch(/^seed-\d+$/);
    keepTile(storage, "trader");
    await authority.newLife("scenario.ada");
    expect(seedOf(storage)).toMatch(/^seed-\d+$/);
  });
});
