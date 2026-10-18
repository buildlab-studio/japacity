import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { DeletionStore } from "../types";
import { must } from "./contract.testing";

function deletion(account: string, dueAt = 31 * time.DAY_MS) {
  return { account, accountHash: `hash-of-${account}`, requestedAt: time.DAY_MS, dueAt };
}

/** The contract every DeletionStore keeps. `make` returns an empty store each time it is called. */
export function suiteForDeletionStore(make: () => Promise<DeletionStore>): void {
  describe("DeletionStore contract", () => {
    test("[R-ACCOUNT-017] given a request due on day 31, when deletions due are listed, then it is not listed a moment before and is listed from that moment on", async () => {
      const store = await make();
      must(await store.request(deletion("account-1")));

      expect(await store.due(31 * time.DAY_MS - 1)).toEqual([]);
      expect(await store.due(31 * time.DAY_MS)).toEqual([
        { account: "account-1", accountHash: "hash-of-account-1", requestedAt: time.DAY_MS, dueAt: 31 * time.DAY_MS, completedAt: null },
      ]);
      expect(await store.due(40 * time.DAY_MS)).toHaveLength(1);
    });

    test("[R-ACCOUNT-017] given a pending request, when it is requested again, then it is listed once and keeps its first day", async () => {
      const store = await make();
      must(await store.request(deletion("account-1")));

      const again = must(await store.request({ ...deletion("account-1", 50 * time.DAY_MS), requestedAt: 2 * time.DAY_MS }));

      expect(again).toMatchObject({ requestedAt: time.DAY_MS, dueAt: 31 * time.DAY_MS });
      expect(await store.due(60 * time.DAY_MS)).toHaveLength(1);
    });

    test("[R-ACCOUNT-017] given requests due on different days, when they are listed, then the earliest comes first", async () => {
      const store = await make();
      must(await store.request(deletion("account-late", 33 * time.DAY_MS)));
      must(await store.request(deletion("account-early", 31 * time.DAY_MS)));
      must(await store.request(deletion("account-middle", 32 * time.DAY_MS)));

      const due = await store.due(40 * time.DAY_MS);

      expect(due.map((row) => row.account)).toEqual(["account-early", "account-middle", "account-late"]);
    });

    test("[R-ACCOUNT-018] given a due deletion, when it is completed, then it is gone from the list and only its hash and dates are kept", async () => {
      const store = await make();
      must(await store.request(deletion("account-1")));

      const done = must(await store.complete("account-1", 31 * time.DAY_MS + 5));

      const kept = { account: null, accountHash: "hash-of-account-1", requestedAt: time.DAY_MS, dueAt: 31 * time.DAY_MS, completedAt: 31 * time.DAY_MS + 5 };
      expect(done).toEqual(kept);
      expect(await store.due(60 * time.DAY_MS)).toEqual([]);
      expect(await store.find("hash-of-account-1")).toEqual(kept);
      expect(await store.find("hash-of-nobody")).toBeNull();
      expect(await store.complete("account-1", 32 * time.DAY_MS)).toMatchObject({ ok: false, code: "missing" });
    });
  });
}
