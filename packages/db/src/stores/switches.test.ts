import { suiteForSwitchStore } from "@japacity/store/contract";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { switchLog } from "../schema";
import { freshHandle } from "../pglite.testing";
import { pgSwitchStore } from "./switches";

const fresh = freshHandle();

suiteForSwitchStore(async () => {
  const handle = await fresh();
  return pgSwitchStore(handle);
});

describe("the switch log's table", () => {
  test("[server:switch-log-insert-only] given a logged switch, when an update or a delete is run on the table itself, then the database refuses both and the entry is unchanged", async () => {
    const handle = await fresh();
    const store = pgSwitchStore(handle);
    await store.set("signups", false, "account.admin", "a flood", 1_000);
    const [entry] = await store.log();
    if (entry === undefined) throw new Error("The switch was not logged.");

    await expect(handle.read((db) => db.update(switchLog).set({ reason: "nothing" }).where(eq(switchLog.n, entry.n)))).rejects.toThrow();
    await expect(handle.read((db) => db.delete(switchLog).where(eq(switchLog.n, entry.n)))).rejects.toThrow();
    expect(await store.log()).toEqual([entry]);
  });
});
