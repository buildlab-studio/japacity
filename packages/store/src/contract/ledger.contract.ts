import { describe, expect, test } from "vitest";

import type { LedgerStore } from "../types";

const TOTALS = { in: { salary: { NGN: 9_000_000 } }, out: { upkeep: { NGN: 4_000_000 }, rent: { GBP: 80_000 } } };

/** The contract every LedgerStore keeps. `make` returns an empty store each time it is called. */
export function suiteForLedgerStore(make: () => Promise<LedgerStore>): void {
  describe("LedgerStore contract", () => {
    test("[R-SERVER-011] given no mark, then the mark is null; given a mark set, then it reads back exactly", async () => {
      const store = await make();
      expect(await store.mark("char-a")).toBeNull();

      await store.setMark("char-a", TOTALS, 20_369);

      expect(await store.mark("char-a")).toEqual({ character: "char-a", day: 20_369, totals: TOTALS });
      expect(await store.mark("char-b")).toBeNull();
    });

    test("[R-SERVER-011] given a mark, when a new one is set, then it replaces the old and is never added to it", async () => {
      const store = await make();
      await store.setMark("char-a", TOTALS, 20_369);

      const later = { in: { salary: { NGN: 12_000_000 } }, out: {} };
      await store.setMark("char-a", later, 20_370);

      expect(await store.mark("char-a")).toEqual({ character: "char-a", day: 20_370, totals: later });
    });

    test("[R-SERVER-011] given amounts added to one day in several parts, when the day is read, then each reason and currency holds the sum", async () => {
      const store = await make();

      await store.addDay(20_369, { salary: { NGN: 100 }, gig: { NGN: 5 } }, { upkeep: { NGN: 40 } });
      await store.addDay(20_369, { salary: { NGN: 250, GBP: 3 } }, { upkeep: { NGN: 2 }, rent: { GBP: 7 } });
      await store.addDay(20_370, { salary: { NGN: 1 } }, {});

      expect(await store.day(20_369)).toEqual({
        day: 20_369,
        created: { salary: { NGN: 350, GBP: 3 }, gig: { NGN: 5 } },
        destroyed: { upkeep: { NGN: 42 }, rent: { GBP: 7 } },
      });
      expect(await store.day(20_370)).toEqual({ day: 20_370, created: { salary: { NGN: 1 } }, destroyed: {} });
    });

    test("[R-SERVER-011] given amounts added at once, when the day is read, then none is lost", async () => {
      const store = await make();

      await Promise.all([1, 2, 3, 4, 5].map((n) => store.addDay(20_369, { salary: { NGN: n } }, { upkeep: { NGN: 10 * n } })));

      expect(await store.day(20_369)).toEqual({ day: 20_369, created: { salary: { NGN: 15 } }, destroyed: { upkeep: { NGN: 150 } } });
    });

    test("[R-SERVER-011] given a day with nothing added, when it is read, then its totals are empty", async () => {
      const store = await make();

      expect(await store.day(20_000)).toEqual({ day: 20_000, created: {}, destroyed: {} });
    });

    test("[R-ACCOUNT-017] given a mark, when it is dropped, then it is gone and the day totals stay", async () => {
      const store = await make();
      await store.setMark("char-a", TOTALS, 20_369);
      await store.addDay(20_369, { salary: { NGN: 100 } }, {});

      await store.dropMark("char-a");

      expect(await store.mark("char-a")).toBeNull();
      expect((await store.day(20_369)).created).toEqual({ salary: { NGN: 100 } });
    });
  });
}
