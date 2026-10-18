import type { State } from "@japacity/sim";
import type { AccountRow, LogRow, NewCharacter } from "@japacity/store";
import type { Sender } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { freshHandle } from "../pglite.testing";
import { pgAccountStore } from "./account";
import { pgDayLog } from "./daylog";
import { pgPlayerStores } from "./player";

const fresh = freshHandle();
const DAY = 86_400_000;
const START = 20_370 * DAY;

function character(id: string, account: string): NewCharacter {
  return { id, account, refilledAt: 0, content: "content-1", start: { scenario: "scenario.ada", seed: id, worldSeed: "world" }, state: { v: 0 } as unknown as State };
}

function logAt(id: string, v: number, at: number, sender: Sender = "player"): LogRow {
  return { character: id, v, tick: v, sender, command: { type: "turns/grant", count: 1, basedOn: v - 1 }, hash: `hash-${String(v)}`, at };
}

function account(id: string, country: string, createdAt: number): AccountRow {
  return { id, country, age: { passed: true, at: createdAt, method: "declared" }, createdAt, character: null, notifyBankFull: false, sendUsageCounts: true, state: "guest", username: id.replaceAll(/\W/g, "_"), usernameChangedAt: null, lastPlayedAt: createdAt };
}

describe("the counts by region in Postgres", () => {
  test("[R-ANALYTICS-013] [R-ANALYTICS-007] given player commands, a stand-in's and the authority's either side of a window, when the players are read, then each account is counted once in its region, the unknown one for a country left empty, and no id comes back", async () => {
    const handle = await fresh();
    const { player } = pgPlayerStores(handle);
    const accounts = pgAccountStore(handle);
    for (const [id, country] of [["account.a", "NG"], ["account.b", "NG"], ["account.c", "GB"], ["account.d", ""]] as const) await accounts.create(account(id, country, 0));
    for (const [id, owner] of [["char-a", "account.a"], ["char-b", "account.b"], ["char-c", "account.c"], ["char-d", "account.d"]] as const) await player.create(character(id, owner));
    const append = (id: string, rows: LogRow[]) => player.transact([id], () => ({ writes: { characters: [{ id, append: rows }] }, result: null }));
    await append("char-a", [logAt("char-a", 1, START), logAt("char-a", 2, START + 10), logAt("char-a", 3, START + 20)]);
    await append("char-b", [logAt("char-b", 1, START - 1), logAt("char-b", 2, START + 5, "stand-in"), logAt("char-b", 3, START + 6, "authority")]);
    await append("char-c", [logAt("char-c", 1, START + DAY - 1)]);
    await append("char-d", [logAt("char-d", 1, START + 1), logAt("char-d", 2, START + DAY)]);

    const found = await pgDayLog(handle).players(START, START + DAY);
    expect(found).toEqual([
      { region: "GB", count: 1 },
      { region: "NG", count: 1 },
      { region: "XX", count: 1 },
    ]);
    expect(JSON.stringify(found)).not.toContain("account.");
    expect(await pgDayLog(handle).players(START + DAY, START + 2 * DAY)).toEqual([{ region: "XX", count: 1 }]);
  });

  test("[R-ANALYTICS-008] given accounts made either side of a moment, when the accounts are read, then those made before it are counted by region", async () => {
    const handle = await fresh();
    const accounts = pgAccountStore(handle);
    for (const [id, country, at] of [["account.a", "NG", START - 5], ["account.b", "NG", START - 1], ["account.c", "GB", START - 1], ["account.d", "NG", START], ["account.e", "", 0]] as const) await accounts.create(account(id, country, at));

    expect(await pgDayLog(handle).accounts(START)).toEqual([
      { region: "GB", count: 1 },
      { region: "NG", count: 2 },
      { region: "XX", count: 1 },
    ]);
  });
});
