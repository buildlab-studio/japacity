import { describe, expect, test } from "vitest";

import type { PresenceMember, PresenceStore } from "../types";

function member(account: string, place = "place.market"): PresenceMember {
  return { account, name: `Name ${account}`, look: `look-${account}`, place, joinedAt: 1_000 };
}

async function fill(store: PresenceStore, count: number, place = "place.market") {
  for (let i = 0; i < count; i++) await store.join(place, `socket-${String(i)}`, member(`account-${String(i)}`, place));
}

const SEEDS = [0, 1, 7, 12_345, 2_147_483_647];

/** The contract every PresenceStore keeps. `make` returns an empty store each time it is called. */
export function suiteForPresenceStore(make: () => Promise<PresenceStore>): void {
  describe("PresenceStore contract", () => {
    test("[clock:attachments-rebuild-presence] given a member who joined, when the place is sampled, then the member is shown exactly as joined", async () => {
      const store = await make();
      await store.join("place.market", "socket-1", member("account-1"));

      expect(await store.sample("place.market", 20, null, 0)).toEqual([member("account-1")]);
      expect(await store.sample("place.other", 20, null, 0)).toEqual([]);
    });

    test("[clock:moving-switches-place-socket] given a member who joined, when the socket leaves, then the member is gone from the place at once", async () => {
      const store = await make();
      await store.join("place.market", "socket-1", member("account-1"));
      await store.join("place.market", "socket-2", member("account-2"));

      await store.leave("place.market", "socket-1");
      await store.leave("place.market", "socket-unknown");

      expect(await store.sample("place.market", 20, null, 0)).toEqual([member("account-2")]);
    });

    test("[clock:moving-switches-place-socket] given a member who moved, when both places are sampled, then the member is only in the new one", async () => {
      const store = await make();
      await store.join("place.market", "socket-1", member("account-1"));

      await store.leave("place.market", "socket-1");
      await store.join("place.church", "socket-9", member("account-1", "place.church"));

      expect(await store.sample("place.market", 20, null, 0)).toEqual([]);
      expect(await store.sample("place.church", 20, null, 0)).toEqual([member("account-1", "place.church")]);
    });

    test("[clock:presence-is-a-sample] given 12 members, when samples of every size from 0 to 13 are drawn, then none is longer than asked, none repeats a member and none shows the asker", async () => {
      const store = await make();
      await fill(store, 12);

      for (const seed of SEEDS) {
        for (let n = 0; n <= 13; n++) {
          const sample = await store.sample("place.market", n, "account-3", seed);
          const accounts = sample.map((shown) => shown.account);

          expect(sample.length).toBe(Math.min(n, 11));
          expect(new Set(accounts).size).toBe(accounts.length);
          expect(accounts).not.toContain("account-3");
        }
      }
    });

    test("[clock:presence-is-a-sample] given one account on two sockets, when the place is sampled, then it is shown once, and still once after one socket leaves", async () => {
      const store = await make();
      await store.join("place.market", "socket-a", member("account-1"));
      await store.join("place.market", "socket-b", member("account-1"));
      await store.join("place.market", "socket-c", member("account-2"));

      const both = await store.sample("place.market", 20, null, 0);
      await store.leave("place.market", "socket-a");
      const one = await store.sample("place.market", 20, null, 0);

      expect(both.map((shown) => shown.account).sort()).toEqual(["account-1", "account-2"]);
      expect(one.map((shown) => shown.account).sort()).toEqual(["account-1", "account-2"]);
    });

    test("[clock:presence-is-a-sample] given more members than the sample, when it is drawn with different seeds, then the samples are not all the same", async () => {
      const store = await make();
      await fill(store, 30);

      const samples = new Set<string>();
      for (const seed of SEEDS) {
        const sample = await store.sample("place.market", 5, null, seed);
        samples.add(sample.map((shown) => shown.account).sort().join(","));
      }

      expect(samples.size).toBeGreaterThan(1);
    });
  });
}
