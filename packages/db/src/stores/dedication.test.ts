import { suiteForDedicationStore } from "@japacity/store/contract";
import { expect, test } from "vitest";

import { freshHandle } from "../pglite.testing";
import { pgAccountStore } from "./account";
import { pgDedicationStore } from "./dedication";

const fresh = freshHandle();

async function stores() {
  const handle = await fresh();
  const accounts = pgAccountStore(handle);
  const account = async (id: string): Promise<void> => {
    const made = await accounts.create({
      id,
      country: "NG",
      age: { passed: true, at: 2_000, method: "declared" },
      createdAt: 2_000,
      character: null,
      notifyBankFull: false,
      sendUsageCounts: true,
      state: "guest",
      username: id.replace(/\W/gu, "_"),
      usernameChangedAt: null,
      lastPlayedAt: 2_000,
    });
    if (!made.ok) throw new Error(made.detail);
  };
  return { dedication: pgDedicationStore(handle), account, accounts };
}

suiteForDedicationStore(stores);

test("[R-SERVER-045] [R-ACCOUNT-033] given an account with a light, when the account is deleted, then its light goes with it by the foreign key", async () => {
  const { dedication, account, accounts } = await stores();
  await account("account.a");
  await account("account.b");
  await dedication.light({ account: "account.a", id: "light.a", name: "Mama Nkechi", from: null, to: null, litAt: 1_000 });
  await dedication.light({ account: "account.b", id: "light.b", name: "Uncle Tunde", from: null, to: null, litAt: 2_000 });
  await accounts.remove("account.a");
  expect(await dedication.mine("account.a")).toBeNull();
  expect(await dedication.shared(240)).toMatchObject({ count: 1, lights: [{ id: "light.b" }] });
});

test("[R-SERVER-045] given a light for an account that does not exist, then the database refuses it", async () => {
  const { dedication } = await stores();
  await expect(dedication.light({ account: "account.none", id: "light.x", name: "Nobody", from: null, to: null, litAt: 1_000 })).rejects.toThrow();
});
