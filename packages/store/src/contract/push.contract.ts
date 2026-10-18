import { describe, expect, test } from "vitest";

import type { PushStore, PushSubscriptionJson } from "../types";

function device(endpoint: string, mark = "1"): PushSubscriptionJson {
  return { endpoint: `https://push.example.test/${endpoint}`, keys: { p256dh: `p256dh-${mark}`, auth: `auth-${mark}` } };
}

/** The contract every PushStore keeps. `make` returns an empty store each time it is called. */
export function suiteForPushStore(make: () => Promise<PushStore>): void {
  describe("PushStore contract", () => {
    test("[clock:full-bank-push-notification] given two devices of one account and one of another, when each account is read, then it gets only its own, in endpoint order", async () => {
      const store = await make();
      await store.subscribe("account-1", device("b"));
      await store.subscribe("account-1", device("a"));
      await store.subscribe("account-2", device("c"));

      expect(await store.forAccount("account-1")).toEqual([device("a"), device("b")]);
      expect(await store.forAccount("account-2")).toEqual([device("c")]);
      expect(await store.forAccount("account-3")).toEqual([]);
    });

    test("[clock:full-bank-push-notification] given a stored endpoint, when it is subscribed again by another account with new keys, then one row is kept, under the new account", async () => {
      const store = await make();
      await store.subscribe("account-1", device("a"));

      await store.subscribe("account-2", device("a", "2"));

      expect(await store.forAccount("account-1")).toEqual([]);
      expect(await store.forAccount("account-2")).toEqual([device("a", "2")]);
    });

    test("[clock:full-bank-push-notification] given two accounts, when one unsubscribes its own device and another's, then only its own goes", async () => {
      const store = await make();
      await store.subscribe("account-1", device("a"));
      await store.subscribe("account-2", device("b"));

      await store.unsubscribe("account-1", device("a").endpoint);
      await store.unsubscribe("account-1", device("b").endpoint);
      await store.unsubscribe("account-1", device("unknown").endpoint);

      expect(await store.forAccount("account-1")).toEqual([]);
      expect(await store.forAccount("account-2")).toEqual([device("b")]);
    });

    test("[account:deleted-data-removed-within-month] given an account with two devices, when it is forgotten, then none is left and another account keeps its own", async () => {
      const store = await make();
      await store.subscribe("account-1", device("a"));
      await store.subscribe("account-1", device("b"));
      await store.subscribe("account-2", device("c"));

      await store.forget("account-1");

      expect(await store.forAccount("account-1")).toEqual([]);
      expect(await store.forAccount("account-2")).toEqual([device("c")]);
    });

    test("[clock:full-bank-push-notification] given a stored device, when the caller changes what it read, then the stored row does not change", async () => {
      const store = await make();
      await store.subscribe("account-1", device("a"));

      const [read] = await store.forAccount("account-1");
      if (read !== undefined) read.keys.auth = "changed";

      expect(await store.forAccount("account-1")).toEqual([device("a")]);
    });
  });
}
