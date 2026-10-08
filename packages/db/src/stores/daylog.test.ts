import type { State } from "@japacity/sim";
import type { AccountRow, LogRow, NewCharacter } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { freshHandle } from "../testing";
import { pgAccountStore } from "./account";
import { pgDayLog } from "./daylog";
import { pgPlayerStores } from "./player";

const fresh = freshHandle();
const DAY = 86_400_000;
const START = 20_370 * DAY;

function character(id: string): NewCharacter {
  return { id, account: `account.${id}`, refilledAt: 0, content: "content-1", start: { scenario: "scenario.ada", seed: id, worldSeed: "world" }, state: { v: 0 } as unknown as State };
}

function logAt(id: string, v: number, at: number): LogRow {
  return { character: id, v, tick: v, sender: "player", command: { type: "turns/grant", count: 1, basedOn: v - 1 }, hash: `hash-${String(v)}`, at };
}

function account(id: string, createdAt: number): AccountRow {
  return { id, country: "NG", age: { passed: true, at: createdAt, method: "declared" }, createdAt, character: null };
}

describe("the day's log in Postgres", () => {
  test("[R-ANALYTICS-008] given log rows either side of a day's bounds, when the day is read, then only characters with a row inside it are named, once each", async () => {
    const handle = await fresh();
    const { player } = pgPlayerStores(handle);
    for (const id of ["char-b", "char-a", "char-c"]) await player.create(character(id));
    const append = (id: string, rows: LogRow[]) => player.transact([id], () => ({ writes: { characters: [{ id, append: rows }] }, result: null }));
    await append("char-a", [logAt("char-a", 1, START - 1), logAt("char-a", 2, START)]);
    await append("char-b", [logAt("char-b", 1, START + DAY - 1), logAt("char-b", 2, START + DAY - 1)]);
    await append("char-c", [logAt("char-c", 1, START + DAY)]);

    expect(await pgDayLog(handle).active(START, START + DAY)).toEqual(["char-a", "char-b"]);
  });

  test("[R-ANALYTICS-008] given accounts made either side of a day's bounds, when the day is read, then only those made inside it are listed", async () => {
    const handle = await fresh();
    const accounts = pgAccountStore(handle);
    for (const [id, at] of [["account.z", START], ["account.a", START + DAY - 1], ["account.before", START - 1], ["account.after", START + DAY]] as const) await accounts.create(account(id, at));

    expect((await pgDayLog(handle).created(START, START + DAY)).map((row) => row.id)).toEqual(["account.a", "account.z"]);
  });
});
