import { describe, expect, test } from "vitest";

import type { DedicationStore, NewDedicationLight } from "../dedication";

/** A store and the way to make an account it may hold a light for (a database's light names an account that exists). */
export interface DedicationStores {
  dedication: DedicationStore;
  account: (id: string) => Promise<void>;
}

const lit = (account: string, id: string, litAt: number, name = `Light of ${account}`): NewDedicationLight => ({ account, id, name, from: null, to: null, litAt });

/** The contract every DedicationStore keeps. `make` returns an empty store each time it is called. */
export function suiteForDedicationStore(make: () => Promise<DedicationStores>): void {
  async function stores(...accounts: string[]): Promise<DedicationStore> {
    const made = await make();
    for (const account of accounts) await made.account(account);
    return made.dedication;
  }

  describe("DedicationStore contract", () => {
    test("[server:dedication-routes] given an empty store, then there are no lights, no account has one and none awaits a look", async () => {
      const store = await stores("account.a");
      expect(await store.shared(240)).toEqual({ count: 0, lights: [] });
      expect(await store.mine("account.a")).toBeNull();
      expect(await store.pending()).toEqual([]);
      expect(await store.putOut("account.a")).toBe(false);
    });

    test("[server:dedication-routes] [account:name-a-light-for-yours] given a light lit, then it is kept with the account in full, unapproved", async () => {
      const store = await stores("account.a");
      const light = await store.light({ account: "account.a", id: "light.1", name: "Mama Nkechi", from: 1951, to: 2024, litAt: 1_000 });
      const kept = { account: "account.a", id: "light.1", name: "Mama Nkechi", from: 1951, to: 2024, litAt: 1_000, approvedAt: null, approvedBy: null };
      expect(light).toEqual(kept);
      expect(await store.mine("account.a")).toEqual(kept);
      expect(await store.shared(240)).toEqual({ count: 1, lights: [kept] });
    });

    test("[server:dedication-routes] [account:name-a-light-for-yours] given an approved light, when the account lights again, then the new light stands in its place, one per account, and its approval is cleared", async () => {
      const store = await stores("account.a");
      await store.light(lit("account.a", "light.1", 1_000, "Mama Nkechi"));
      await store.approve("account.a", "account.admin", 2_000);
      const again = await store.light({ account: "account.a", id: "light.2", name: "Uncle Tunde", from: null, to: 1990, litAt: 3_000 });
      expect(again).toMatchObject({ id: "light.2", name: "Uncle Tunde", to: 1990, approvedAt: null, approvedBy: null });
      expect((await store.shared(240)).count).toBe(1);
      expect((await store.mine("account.a"))?.name).toBe("Uncle Tunde");
      expect((await store.pending()).map((light) => light.id)).toEqual(["light.2"]);
    });

    test("[server:dedication-routes] [moderation:dedication-lights-await-approval] given lights, then the approved come first, newest lit first, then the rest newest lit first, and the count is every light whatever is listed", async () => {
      const store = await stores("account.a", "account.b", "account.c", "account.d", "account.e");
      await store.light(lit("account.a", "light.a", 1_000));
      await store.light(lit("account.b", "light.b", 2_000));
      await store.light(lit("account.c", "light.c", 3_000));
      await store.light(lit("account.d", "light.d", 4_000));
      await store.light(lit("account.e", "light.e", 4_000));
      await store.approve("account.a", "account.admin", 9_000);
      await store.approve("account.c", "account.admin", 9_000);
      expect((await store.shared(240)).lights.map((light) => light.id)).toEqual(["light.c", "light.a", "light.d", "light.e", "light.b"]);
      const capped = await store.shared(3);
      expect(capped.count).toBe(5);
      expect(capped.lights.map((light) => light.id)).toEqual(["light.c", "light.a", "light.d"]);
    });

    test("[moderation:dedication-lights-await-approval] given lights, then those awaiting a look are listed oldest lit first; approved, a light leaves the list with its admin and time", async () => {
      const store = await stores("account.a", "account.b", "account.c");
      await store.light(lit("account.b", "light.b", 2_000));
      await store.light(lit("account.a", "light.a", 1_000));
      await store.light(lit("account.c", "light.c", 3_000));
      expect((await store.pending()).map((light) => light.id)).toEqual(["light.a", "light.b", "light.c"]);
      const approved = await store.approve("account.b", "account.admin", 5_000);
      expect(approved).toMatchObject({ ok: true, value: { id: "light.b", approvedAt: 5_000, approvedBy: "account.admin" } });
      expect((await store.pending()).map((light) => light.id)).toEqual(["light.a", "light.c"]);
      expect(await store.mine("account.b")).toMatchObject({ approvedAt: 5_000, approvedBy: "account.admin" });
    });

    test("[moderation:dedication-lights-await-approval] given no light, when it is approved, then it is refused missing and nothing is written", async () => {
      const store = await stores("account.a");
      expect(await store.approve("account.a", "account.admin", 5_000)).toMatchObject({ ok: false, code: "missing" });
      expect(await store.shared(240)).toEqual({ count: 0, lights: [] });
    });

    test("[server:dedication-routes] [account:name-a-light-for-yours] given a light, when it is put out, then it is gone from the account, the list and the count, and others stay", async () => {
      const store = await stores("account.a", "account.b");
      await store.light(lit("account.a", "light.a", 1_000));
      await store.light(lit("account.b", "light.b", 2_000));
      expect(await store.putOut("account.a")).toBe(true);
      expect(await store.mine("account.a")).toBeNull();
      expect(await store.shared(240)).toMatchObject({ count: 1, lights: [{ id: "light.b" }] });
      expect(await store.putOut("account.a")).toBe(false);
    });

    test("[server:dedication-routes] given most of zero, then the count stands and no light is listed", async () => {
      const store = await stores("account.a");
      await store.light(lit("account.a", "light.a", 1_000));
      expect(await store.shared(0)).toEqual({ count: 1, lights: [] });
    });
  });
}
