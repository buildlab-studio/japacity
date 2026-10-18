import { describe, expect, test } from "vitest";

import { pairIds, pairKey } from "../keys";
import type { PairStore, PlayerStore, StoreResult, Writes } from "../types";
import { logRow, must, newCharacter } from "./contract.testing";

export interface PairStores {
  player: PlayerStore;
  pair: PairStore;
}

const KEY = "char-a~char-b";

async function write(stores: PairStores, ids: readonly string[], writes: Writes): Promise<StoreResult<null>> {
  return stores.player.transact(ids, () => ({ writes, result: null }));
}

async function withThree(make: () => Promise<PairStores>): Promise<PairStores> {
  const stores = await make();
  for (const id of ["char-a", "char-b", "char-c"]) must(await stores.player.create(newCharacter(id)));
  return stores;
}

/** The contract every PairStore keeps, beside the PlayerStore whose transactions write it. */
export function suiteForPairStore(make: () => Promise<PairStores>): void {
  describe("PairStore contract", () => {
    test("[pair:one-record-per-two] given two character ids in either order, when the pair key is made, then it is the two sorted and joined by a tilde", () => {
      expect(pairKey("char-b", "char-a")).toBe(KEY);
      expect(pairKey("char-a", "char-b")).toBe(KEY);
      expect(pairKey("char-a", "char-Z")).toBe("char-Z~char-a");
      expect(pairIds(KEY)).toEqual({ a: "char-a", b: "char-b" });
      expect(pairIds("char-b~char-a")).toBeNull();
      expect(pairIds("char-a")).toBeNull();
      expect(() => pairKey("char-a", "char-a")).toThrow();
    });

    test("[pair:only-server-writes-record] given a transaction holding both characters, when it puts a new record, then the record reads back at version 1 and the next transaction is given it", async () => {
      const stores = await withThree(make);

      must(await write(stores, ["char-b", "char-a"], { pairs: [{ key: KEY, expectedV: 0, record: { stage: "connected" } }] }));

      expect(await stores.pair.get(KEY)).toEqual({ key: KEY, a: "char-a", b: "char-b", v: 1, record: { stage: "connected" } });
      expect(await stores.pair.get("char-a~char-c")).toBeNull();
      const given = must(await stores.player.transact(["char-a", "char-b", "char-c"], (rows) => ({ writes: {}, result: rows.pairs })));
      expect(given).toEqual([{ key: KEY, a: "char-a", b: "char-b", v: 1, record: { stage: "connected" } }]);
    });

    test("[pair:one-record-per-two] given a stored record, when a put comes at an old version or makes it again, then it is refused as stale and the record is kept", async () => {
      const stores = await withThree(make);
      must(await write(stores, ["char-a", "char-b"], { pairs: [{ key: KEY, expectedV: 0, record: { stage: "connected" } }] }));
      must(await write(stores, ["char-a", "char-b"], { pairs: [{ key: KEY, expectedV: 1, record: { stage: "courting" } }] }));

      const old = await write(stores, ["char-a", "char-b"], { pairs: [{ key: KEY, expectedV: 1, record: { stage: "ended" } }] });
      const second = await write(stores, ["char-a", "char-b"], { pairs: [{ key: KEY, expectedV: 0, record: { stage: "ended" } }] });
      const ahead = await write(stores, ["char-a", "char-b"], { pairs: [{ key: KEY, expectedV: 3, record: { stage: "ended" } }] });

      for (const result of [old, second, ahead]) expect(result).toMatchObject({ ok: false, code: "stale" });
      expect(await stores.pair.get(KEY)).toMatchObject({ v: 2, record: { stage: "courting" } });
    });

    test("[pair:only-server-writes-record] given a transaction holding only one of the two, when it puts their record, then it is refused with not-held and nothing in it is written", async () => {
      const stores = await withThree(make);

      const result = await write(stores, ["char-a", "char-c"], {
        characters: [{ id: "char-a", append: [logRow("char-a", 1)] }],
        pairs: [{ key: KEY, expectedV: 0, record: { stage: "connected" } }],
      });

      expect(result).toMatchObject({ ok: false, code: "not-held" });
      expect(await stores.pair.get(KEY)).toBeNull();
      expect((await stores.player.load("char-a"))?.character.v).toBe(0);
    });

    test("[pair:one-record-per-two] given a key that is not two sorted ids, when it is put, then it is refused and nothing is written", async () => {
      const stores = await withThree(make);

      const reversed = await write(stores, ["char-a", "char-b"], { pairs: [{ key: "char-b~char-a", expectedV: 0, record: {} }] });
      const twice = await write(stores, ["char-a", "char-b"], {
        pairs: [
          { key: KEY, expectedV: 0, record: { n: 1 } },
          { key: KEY, expectedV: 0, record: { n: 2 } },
        ],
      });

      expect(reversed).toMatchObject({ ok: false, code: "bad-write" });
      expect(twice).toMatchObject({ ok: false, code: "bad-write" });
      expect(await stores.pair.get(KEY)).toBeNull();
      expect(await stores.pair.get("char-b~char-a")).toBeNull();
    });

    test("[account:deleted-data-removed-within-month] given records of three characters, when one character is removed, then its records go and the others stay", async () => {
      const stores = await withThree(make);
      must(
        await write(stores, ["char-a", "char-b", "char-c"], {
          pairs: [
            { key: KEY, expectedV: 0, record: { n: 1 } },
            { key: "char-a~char-c", expectedV: 0, record: { n: 2 } },
            { key: "char-b~char-c", expectedV: 0, record: { n: 3 } },
          ],
        }),
      );

      await stores.player.remove("char-a");

      expect(await stores.pair.get(KEY)).toBeNull();
      expect(await stores.pair.get("char-a~char-c")).toBeNull();
      expect(await stores.pair.get("char-b~char-c")).toMatchObject({ v: 1, record: { n: 3 } });
    });

    test("[moderation:reports-hold-cited-records] given a record a report holds and one it does not, when one of their characters is removed, then the held record stays unchanged and the other goes", async () => {
      const stores = await withThree(make);
      must(
        await write(stores, ["char-a", "char-b", "char-c"], {
          pairs: [
            { key: KEY, expectedV: 0, record: { n: 1, held: true } },
            { key: "char-a~char-c", expectedV: 0, record: { n: 2, held: false } },
          ],
        }),
      );

      await stores.player.remove("char-a");

      expect(await stores.pair.get(KEY)).toEqual({ key: KEY, a: "char-a", b: "char-b", v: 1, record: { n: 1, held: true } });
      expect(await stores.pair.get("char-a~char-c")).toBeNull();
      expect(await stores.player.load("char-a")).toBeNull();
    });
  });
}
