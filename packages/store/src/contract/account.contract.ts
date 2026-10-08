import { describe, expect, test } from "vitest";

import type { AccountRow, AccountStore } from "../types";
import { must } from "./fixtures";

function account(id: string): AccountRow {
  return { id, country: "NG", age: { passed: true, at: 2_000, method: "declared" }, createdAt: 2_000, character: null };
}

/** The contract every AccountStore keeps. `make` returns an empty store each time it is called. */
export function suiteForAccountStore(make: () => Promise<AccountStore>): void {
  describe("AccountStore contract", () => {
    test("[R-ACCOUNT-020] given a new account, when it is created and read, then it comes back exactly, and an unknown id is null", async () => {
      const store = await make();

      expect(must(await store.create(account("account-1")))).toEqual(account("account-1"));

      expect(await store.get("account-1")).toEqual(account("account-1"));
      expect(await store.get("account-2")).toBeNull();
    });

    test("[R-ACCOUNT-020] given a stored account, when it is created again, then it is refused with exists and the first is kept", async () => {
      const store = await make();
      must(await store.create(account("account-1")));

      const again = await store.create({ ...account("account-1"), country: "GB" });

      expect(again).toMatchObject({ ok: false, code: "exists" });
      expect((await store.get("account-1"))?.country).toBe("NG");
    });

    test("[R-ACCOUNT-015] given an account with a character, when a second character is set, then it is refused with one-character and the first is kept", async () => {
      const store = await make();
      must(await store.create(account("account-1")));

      expect(must(await store.setCharacter("account-1", "char-a")).character).toBe("char-a");
      const second = await store.setCharacter("account-1", "char-b");
      const same = must(await store.setCharacter("account-1", "char-a"));

      expect(second).toMatchObject({ ok: false, code: "one-character" });
      expect(same.character).toBe("char-a");
      expect((await store.get("account-1"))?.character).toBe("char-a");
      expect(await store.setCharacter("account-unknown", "char-c")).toMatchObject({ ok: false, code: "missing" });
    });

    test("[R-ACCOUNT-017] given an account with a character, when the character is cleared and the account removed, then nothing of it is read back", async () => {
      const store = await make();
      must(await store.create(account("account-1")));
      must(await store.setCharacter("account-1", "char-a"));

      expect(must(await store.setCharacter("account-1", null)).character).toBeNull();
      await store.remove("account-1");

      expect(await store.get("account-1")).toBeNull();
      expect(must(await store.create(account("account-1")))).toEqual(account("account-1"));
    });
  });
}
