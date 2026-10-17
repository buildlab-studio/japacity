import { describe, expect, test } from "vitest";

import type { WorldStore, WorldTickRow } from "../types";
import { DRAW_ODDS, lotteryResult, must, world } from "./fixtures";

function tickRow(tick: number, mark = 0): WorldTickRow {
  return {
    tick,
    world: world(tick, mark),
    book: { era: "era.calm", passes: { "news.sample": 1 }, mark },
    content: "content-1",
    hash: `hash-${String(tick)}-${String(mark)}`,
  };
}

const DRAW = { draw: 4, secret: "11".repeat(32), fingerprint: "22".repeat(32), beaconRound: 900, odds: DRAW_ODDS, jackpot: 20_000_000 };

/** The contract every WorldStore keeps. `make` returns an empty store each time it is called. */
export function suiteForWorldStore(make: () => Promise<WorldStore>): void {
  describe("WorldStore contract", () => {
    test("[R-CLOCK-010] given stored ticks, when one is read, then it comes back exactly, and a tick not stored is null", async () => {
      const store = await make();
      expect(await store.insertTick(tickRow(0))).toBe(true);
      expect(await store.insertTick(tickRow(1))).toBe(true);

      expect(await store.tick(1)).toEqual(tickRow(1));
      expect(await store.tick(0)).toEqual(tickRow(0));
      expect(await store.tick(2)).toBeNull();
    });

    test("[R-CLOCK-013] given a stored tick, when a second row for the same tick is inserted, then it is ignored and the first is kept", async () => {
      const store = await make();
      expect(await store.insertTick(tickRow(5, 1))).toBe(true);

      expect(await store.insertTick(tickRow(5, 2))).toBe(false);

      expect(await store.tick(5)).toEqual(tickRow(5, 1));
    });

    test("[R-CLOCK-013] given two writers making the same tick at once, when both insert, then exactly one row is stored", async () => {
      const store = await make();

      const inserted = await Promise.all([store.insertTick(tickRow(3, 1)), store.insertTick(tickRow(3, 2))]);

      expect(inserted.filter(Boolean)).toHaveLength(1);
      const kept = inserted[0] === true ? tickRow(3, 1) : tickRow(3, 2);
      expect(await store.tick(3)).toEqual(kept);
    });

    test("[R-CLOCK-012] given no ticks, then latest is null; given ticks stored out of order, then latest is the highest", async () => {
      const store = await make();
      expect(await store.latest()).toBeNull();

      for (const tick of [0, 2, 1]) await store.insertTick(tickRow(tick));

      expect(await store.latest()).toEqual(tickRow(2));
    });

    test("[R-LOTTERY-007] given a draw put once, when it is read, then it is open with no result, and the same commitments again change nothing", async () => {
      const store = await make();

      const stored = must(await store.putDraw(DRAW));
      const again = must(await store.putDraw({ ...DRAW }));

      expect(stored).toEqual({ ...DRAW, closedAt: null, list: null, listHash: null, result: null });
      expect(again).toEqual(stored);
      expect(await store.draw(4)).toEqual(stored);
      expect(await store.draw(5)).toBeNull();
    });

    test("[R-LOTTERY-007] given a stored draw, when it is put with another secret, fingerprint, round, odds or jackpot, then it is refused and the first is kept", async () => {
      const store = await make();
      must(await store.putDraw(DRAW));

      for (const changed of [
        { secret: "33".repeat(32) },
        { fingerprint: "44".repeat(32) },
        { beaconRound: 901 },
        { jackpot: 20_000_001 },
        { odds: { ...DRAW_ODDS, jackpotCap: 38_000_001 } },
        { odds: { ...DRAW_ODDS, forcedWinWeeks: 4 } },
      ]) {
        expect(await store.putDraw({ ...DRAW, ...changed })).toMatchObject({ ok: false, code: "conflict" });
      }
      expect(await store.draw(4)).toEqual({ ...DRAW, closedAt: null, list: null, listHash: null, result: null });
    });

    test("[R-LOTTERY-005] given purchases from two characters, when tickets are added, then they are numbered from 0 in the order they were committed", async () => {
      const store = await make();
      must(await store.putDraw(DRAW));

      expect(must(await store.addTickets(4, "char-b", 2))).toEqual([0, 1]);
      expect(must(await store.addTickets(4, "char-a", 1))).toEqual([2]);
      expect(must(await store.addTickets(4, "char-b", 3))).toEqual([3, 4, 5]);

      expect(await store.tickets(4)).toEqual([
        { draw: 4, n: 0, character: "char-b" },
        { draw: 4, n: 1, character: "char-b" },
        { draw: 4, n: 2, character: "char-a" },
        { draw: 4, n: 3, character: "char-b" },
        { draw: 4, n: 4, character: "char-b" },
        { draw: 4, n: 5, character: "char-b" },
      ]);
      expect(await store.tickets(5)).toEqual([]);
    });

    test("[R-LOTTERY-005] given purchases at once, when they are added, then no number is given twice and none is skipped", async () => {
      const store = await make();
      must(await store.putDraw(DRAW));

      const given = await Promise.all(["char-a", "char-b", "char-c", "char-d"].map((id) => store.addTickets(4, id, 2)));

      expect(given.flatMap(must).sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    test("[R-LOTTERY-005] given a draw not stored or a count under 1, when tickets are added, then it is refused and nothing is added", async () => {
      const store = await make();
      must(await store.putDraw(DRAW));

      expect(await store.addTickets(9, "char-a", 1)).toMatchObject({ ok: false, code: "missing" });
      expect(await store.addTickets(4, "char-a", 0)).toMatchObject({ ok: false, code: "bad-write" });
      expect(await store.addTickets(4, "char-a", 1.5)).toMatchObject({ ok: false, code: "bad-write" });
      expect(await store.tickets(4)).toEqual([]);
    });

    test("[R-LOTTERY-008] given a frozen draw, when tickets are added or it is frozen again, then the list and its close do not change", async () => {
      const store = await make();
      must(await store.putDraw(DRAW));
      must(await store.addTickets(4, "char-a", 2));

      const frozen = must(await store.freeze(4, 70_000));
      const late = await store.addTickets(4, "char-b", 1);
      const again = must(await store.freeze(4, 80_000));

      expect(frozen).toEqual([
        { draw: 4, n: 0, character: "char-a" },
        { draw: 4, n: 1, character: "char-a" },
      ]);
      expect(late).toMatchObject({ ok: false, code: "closed" });
      expect(again).toEqual(frozen);
      expect(await store.tickets(4)).toEqual(frozen);
      expect((await store.draw(4))?.closedAt).toBe(70_000);
      expect(await store.freeze(9, 70_000)).toMatchObject({ ok: false, code: "missing" });
    });

    test("[R-LOTTERY-021] given a draw put, when it is read, then it carries no house top-up, as decision 0016 has none", async () => {
      const store = await make();
      must(await store.putDraw(DRAW));
      expect(Object.keys((await store.draw(4)) ?? {})).not.toContain("topUpTickets");
    });

    test("[R-LOTTERY-021] [R-LOTTERY-012] given draws put with their odds and jackpot, when they are read, then each keeps the odds and jackpot it opened with, a forced win included", async () => {
      const store = await make();
      const later = { ...DRAW_ODDS, smallPerMillion: 90_000, forcedWinWeeks: 6 };
      must(await store.putDraw(DRAW));
      must(await store.putDraw({ ...DRAW, draw: 5, odds: later, jackpot: 20_002_500 }));

      expect(await store.draw(4)).toMatchObject({ odds: DRAW_ODDS, jackpot: 20_000_000 });
      expect(await store.draw(5)).toMatchObject({ odds: later, jackpot: 20_002_500 });
    });

    test("[R-LOTTERY-008] given a draw, when its list is set before the freeze, after it, the same again and another, then only the first after the freeze is kept", async () => {
      const store = await make();
      must(await store.putDraw(DRAW));
      const list = ["0011223344556677", "8899aabbccddeeff"];

      const early = await store.setList(4, list, "aa".repeat(32));
      must(await store.freeze(4, 70_000));
      const set = must(await store.setList(4, list, "aa".repeat(32)));
      const same = must(await store.setList(4, [...list], "aa".repeat(32)));
      const other = await store.setList(4, [...list].reverse(), "bb".repeat(32));

      expect(early).toMatchObject({ ok: false, code: "open" });
      expect(set).toEqual({ ...DRAW, closedAt: 70_000, list, listHash: "aa".repeat(32), result: null });
      expect(same).toEqual(set);
      expect(other).toMatchObject({ ok: false, code: "conflict" });
      expect(await store.draw(4)).toEqual(set);
      expect(await store.setList(9, list, "aa".repeat(32))).toMatchObject({ ok: false, code: "missing" });
    });

    test("[R-LOTTERY-008] given an empty draw, when its empty list is set after the freeze, then it is kept as an empty list", async () => {
      const store = await make();
      must(await store.putDraw(DRAW));
      must(await store.freeze(4, 70_000));

      expect(must(await store.setList(4, [], "cc".repeat(32)))).toMatchObject({ list: [], listHash: "cc".repeat(32) });
    });

    test("[R-LOTTERY-015] given a draw, when its result is set before the freeze, after it, and again, then only the first after the freeze is kept", async () => {
      const store = await make();
      must(await store.putDraw(DRAW));

      const early = await store.setResult(4, lotteryResult(4));
      must(await store.freeze(4, 70_000));
      const set = must(await store.setResult(4, lotteryResult(4)));
      const again = await store.setResult(4, { ...lotteryResult(4), count: 99 });

      expect(early).toMatchObject({ ok: false, code: "open" });
      expect(set).toEqual({ ...DRAW, closedAt: 70_000, list: null, listHash: null, result: lotteryResult(4) });
      expect(again).toMatchObject({ ok: false, code: "conflict" });
      expect(await store.draw(4)).toEqual(set);
      expect(await store.setResult(9, lotteryResult(9))).toMatchObject({ ok: false, code: "missing" });
    });
  });
}
