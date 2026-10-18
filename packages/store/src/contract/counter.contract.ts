import { describe, expect, test } from "vitest";

import type { CounterStore, CounterTotal } from "../analytics";

const row = (over: Partial<CounterTotal> = {}): CounterTotal => ({ day: "2026-10-10", region: "NG", name: "screen/opened", key: "wallet", count: 1, ...over });

/** The contract every CounterStore keeps. `make` returns an empty store each time it is called. */
export function suiteForCounterStore(make: () => Promise<CounterStore>): void {
  describe("CounterStore contract", () => {
    test("[analytics:rows-stored-as-day-totals] given rows added in several calls, when the days are read, then each day, region, name and key holds the sum and nothing else is kept", async () => {
      const store = await make();
      await store.add([row({ count: 3 }), row({ region: "GB", count: 2 })]);
      await store.add([row({ count: 4 }), row({ key: "route", count: 1 }), row({ day: "2026-10-11", count: 9 })]);

      expect(await store.days("2026-10-10", "2026-10-10")).toEqual([row({ region: "GB", count: 2 }), row({ key: "route", count: 1 }), row({ count: 7 })]);
      expect(await store.days("2026-10-09", "2026-10-11")).toHaveLength(4);
      expect(await store.days("2026-10-12", "2026-10-20")).toEqual([]);
    });

    test("[analytics:nightly-game-counters] given a run already added, when it is added again, then nothing is added the second time", async () => {
      const store = await make();
      expect(await store.addOnce("nightly:2026-10-10", [row({ name: "players/active", key: "NG", count: 5 })])).toBe(true);
      expect(await store.addOnce("nightly:2026-10-10", [row({ name: "players/active", key: "NG", count: 5 })])).toBe(false);
      expect(await store.addOnce("nightly:2026-10-11", [row({ name: "players/active", key: "NG", count: 1 })])).toBe(true);

      expect(await store.days("2026-10-10", "2026-10-10")).toEqual([row({ name: "players/active", key: "NG", count: 6 })]);
    });

    test("[analytics:rows-stored-as-day-totals] given a stored total, when the caller changes what it read, then the store is unchanged", async () => {
      const store = await make();
      await store.add([row({ count: 2 })]);
      const [read] = await store.days("2026-10-10", "2026-10-10");
      if (read !== undefined) read.count = 100;
      expect(await store.days("2026-10-10", "2026-10-10")).toEqual([row({ count: 2 })]);
    });
  });
}
