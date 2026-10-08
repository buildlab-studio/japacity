import { describe, expect, test } from "vitest";

import type { DeletionStore } from "../types";
import { must } from "./fixtures";

const DAY = 86_400_000;

function deletion(account: string, dueAt = 31 * DAY) {
  return { account, accountHash: `hash-of-${account}`, requestedAt: DAY, dueAt };
}

/** The contract every DeletionStore keeps. `make` returns an empty store each time it is called. */
export function suiteForDeletionStore(make: () => Promise<DeletionStore>): void {
  describe("DeletionStore contract", () => {
    test("[R-ACCOUNT-017] given a request due on day 31, when deletions due are listed, then it is not listed a moment before and is listed from that moment on", async () => {
      const store = await make();
      must(await store.request(deletion("account-1")));

      expect(await store.due(31 * DAY - 1)).toEqual([]);
      expect(await store.due(31 * DAY)).toEqual([
        { account: "account-1", accountHash: "hash-of-account-1", requestedAt: DAY, dueAt: 31 * DAY, completedAt: null },
      ]);
      expect(await store.due(40 * DAY)).toHaveLength(1);
    });

    test("[R-ACCOUNT-017] given a pending request, when it is requested again, then it is listed once and keeps its first day", async () => {
      const store = await make();
      must(await store.request(deletion("account-1")));

      const again = must(await store.request({ ...deletion("account-1", 50 * DAY), requestedAt: 2 * DAY }));

      expect(again).toMatchObject({ requestedAt: DAY, dueAt: 31 * DAY });
      expect(await store.due(60 * DAY)).toHaveLength(1);
    });

    test("[R-ACCOUNT-017] given requests due on different days, when they are listed, then the earliest comes first", async () => {
      const store = await make();
      must(await store.request(deletion("account-late", 33 * DAY)));
      must(await store.request(deletion("account-early", 31 * DAY)));
      must(await store.request(deletion("account-middle", 32 * DAY)));

      const due = await store.due(40 * DAY);

      expect(due.map((row) => row.account)).toEqual(["account-early", "account-middle", "account-late"]);
    });

    test("[R-ACCOUNT-018] given a due deletion, when it is completed, then it is gone from the list and only its hash and dates are kept", async () => {
      const store = await make();
      must(await store.request(deletion("account-1")));

      const done = must(await store.complete("account-1", 31 * DAY + 5));

      const kept = { account: null, accountHash: "hash-of-account-1", requestedAt: DAY, dueAt: 31 * DAY, completedAt: 31 * DAY + 5 };
      expect(done).toEqual(kept);
      expect(await store.due(60 * DAY)).toEqual([]);
      expect(await store.find("hash-of-account-1")).toEqual(kept);
      expect(await store.find("hash-of-nobody")).toBeNull();
      expect(await store.complete("account-1", 32 * DAY)).toMatchObject({ ok: false, code: "missing" });
    });
  });
}
