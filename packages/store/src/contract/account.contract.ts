import { describe, expect, test } from "vitest";

import type { AccountRow, AccountStore } from "../types";
import { must } from "./contract.testing";

function account(id: string, over: Partial<AccountRow> = {}): AccountRow {
  return {
    id,
    country: "NG",
    age: { passed: true, at: 2_000, method: "declared" },
    createdAt: 2_000,
    character: null,
    notifyBankFull: false,
    sendUsageCounts: true,
    state: "guest",
    username: id.replaceAll("-", "_"),
    usernameChangedAt: null,
    lastPlayedAt: 2_000,
    ...over,
  };
}

/** The contract every AccountStore keeps. `make` returns an empty store each time it is called. */
export function suiteForAccountStore(make: () => Promise<AccountStore>): void {
  describe("AccountStore contract", () => {
    test("[account:only-needed-data-kept] given a new account, when it is created and read, then it comes back exactly, and an unknown id is null", async () => {
      const store = await make();

      expect(must(await store.create(account("account-1")))).toEqual(account("account-1"));

      expect(await store.get("account-1")).toEqual(account("account-1"));
      expect(await store.get("account-2")).toBeNull();
    });

    test("[account:only-needed-data-kept] given a stored account, when it is created again, then it is refused with exists and the first is kept", async () => {
      const store = await make();
      must(await store.create(account("account-1")));

      const again = await store.create({ ...account("account-1"), country: "GB" });

      expect(again).toMatchObject({ ok: false, code: "exists" });
      expect((await store.get("account-1"))?.country).toBe("NG");
    });

    test("[account:one-character-per-account] given an account with a character, when a second character is set, then it is refused with one-character and the first is kept", async () => {
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

    test("[clock:full-bank-push-notification] given a new account, when the bank-full setting is turned on and off, then it reads back each time, and an unknown id is refused with missing", async () => {
      const store = await make();
      must(await store.create(account("account-1")));

      expect(must(await store.setNotify("account-1", true)).notifyBankFull).toBe(true);
      expect((await store.get("account-1"))?.notifyBankFull).toBe(true);
      expect(must(await store.setNotify("account-1", false)).notifyBankFull).toBe(false);
      expect((await store.get("account-1"))?.notifyBankFull).toBe(false);
      expect(await store.setNotify("account-unknown", true)).toMatchObject({ ok: false, code: "missing" });
    });

    test("[analytics:player-can-stop-usage-counts] given a new account, when the usage counts setting is turned off and on, then it reads back each time, and an unknown id is refused with missing", async () => {
      const store = await make();
      must(await store.create(account("account-1")));

      expect(must(await store.setUsageCounts("account-1", false)).sendUsageCounts).toBe(false);
      expect((await store.get("account-1"))?.sendUsageCounts).toBe(false);
      expect(must(await store.setUsageCounts("account-1", true)).sendUsageCounts).toBe(true);
      expect((await store.get("account-1"))?.sendUsageCounts).toBe(true);
      expect(await store.setUsageCounts("account-unknown", true)).toMatchObject({ ok: false, code: "missing" });
    });

    test("[account:deleted-data-removed-within-month] given an account with a character, when the character is cleared and the account removed, then nothing of it is read back", async () => {
      const store = await make();
      must(await store.create(account("account-1")));
      must(await store.setCharacter("account-1", "char-a"));

      expect(must(await store.setCharacter("account-1", null)).character).toBeNull();
      await store.remove("account-1");

      expect(await store.get("account-1")).toBeNull();
      expect(must(await store.create(account("account-1")))).toEqual(account("account-1"));
    });
    test("[account:username-and-unconfirmed-email] given a username held in other capitals, when a second account is created with it, then it is refused with conflict and the first keeps it", async () => {
      const store = await make();
      must(await store.create(account("account-1", { username: "Ada_Lagos" })));

      const second = await store.create(account("account-2", { username: "ada_LAGOS" }));

      expect(second).toMatchObject({ ok: false, code: "conflict" });
      expect(await store.get("account-2")).toBeNull();
      expect((await store.byUsername("ADA_lagos"))?.id).toBe("account-1");
      expect(await store.byUsername("nobody_here")).toBeNull();
    });

    test("[account:username-and-unconfirmed-email] given two accounts, when one changes its username, then a name the other holds is refused, its own in new capitals is taken, and the time is kept", async () => {
      const store = await make();
      must(await store.create(account("account-1", { username: "first_one" })));
      must(await store.create(account("account-2", { username: "second_one" })));

      expect(await store.setUsername("account-1", "SECOND_one", 5_000)).toMatchObject({ ok: false, code: "conflict" });
      const recased = must(await store.setUsername("account-1", "First_One", 6_000));
      const moved = must(await store.setUsername("account-1", "third_one", 7_000));

      expect(recased).toMatchObject({ username: "First_One", usernameChangedAt: 6_000 });
      expect(moved).toMatchObject({ username: "third_one", usernameChangedAt: 7_000 });
      expect((await store.byUsername("first_one"))).toBeNull();
      expect(must(await store.setUsername("account-2", "first_one", 8_000)).username).toBe("first_one");
      expect(await store.setUsername("account-unknown", "free_name", 9_000)).toMatchObject({ ok: false, code: "missing" });
    });

    test("[account:username-and-unconfirmed-email] [moderation:fixed-admin-actions] given an account that changed its username, when a name is set with no time, then the name is taken and the change time is cleared", async () => {
      const store = await make();
      must(await store.create(account("account-1", { username: "first_one" })));
      must(await store.setUsername("account-1", "second_one", 5_000));

      expect(must(await store.setUsername("account-1", "player_abc", null))).toMatchObject({ username: "player_abc", usernameChangedAt: null });
    });

    test("[account:guest-and-secured-states] given a guest, when it is secured, then it reads back secured and keeps everything else; an unknown id is refused with missing", async () => {
      const store = await make();
      must(await store.create(account("account-1")));
      must(await store.setCharacter("account-1", "char-a"));

      const secured = must(await store.secure("account-1"));

      expect(secured).toEqual({ ...account("account-1"), character: "char-a", state: "secured" });
      expect(await store.get("account-1")).toEqual(secured);
      expect(await store.secure("account-unknown")).toMatchObject({ ok: false, code: "missing" });
    });

    test("[account:idle-guests-cleaned-by-hand] given accounts last played at different times, when the idle guests before a time are read, then only guests played strictly before it come back, oldest first", async () => {
      const store = await make();
      must(await store.create(account("account-1", { lastPlayedAt: 1_000 })));
      must(await store.create(account("account-2", { lastPlayedAt: 3_000 })));
      must(await store.create(account("account-3", { lastPlayedAt: 500, state: "secured" })));
      must(await store.create(account("account-4", { lastPlayedAt: 2_999 })));

      const idle = await store.idleGuests(3_000);

      expect(idle.map((row) => row.id)).toEqual(["account-1", "account-4"]);
      expect(await store.idleGuests(1_000)).toEqual([]);
    });

    test("[city:board-line-and-ranking] [account:username-and-unconfirmed-email] given three accounts, one renamed, when the usernames of two of them and an unknown id are read at once, then each known account gives its username as it stands and the unknown id is left out", async () => {
      const store = await make();
      must(await store.create(account("account-1")));
      must(await store.create(account("account-2")));
      must(await store.create(account("account-3")));
      must(await store.setUsername("account-2", "Ada_Lagos", 4_000));

      const names = await store.usernames(["account-2", "account-1", "account-unknown", "account-1"]);

      expect([...names.entries()].sort()).toEqual([
        ["account-1", "account_1"],
        ["account-2", "Ada_Lagos"],
      ]);
      expect((await store.usernames([])).size).toBe(0);
    });

    test("[account:idle-guests-cleaned-by-hand] given a guest, when it is touched later and then earlier, then the later time stays; an unknown id is a no-op", async () => {
      const store = await make();
      must(await store.create(account("account-1", { lastPlayedAt: 1_000 })));

      await store.touch("account-1", 4_000);
      await store.touch("account-1", 3_000);
      await store.touch("account-unknown", 5_000);

      expect((await store.get("account-1"))?.lastPlayedAt).toBe(4_000);
      expect(await store.get("account-unknown")).toBeNull();
    });
  });
}
