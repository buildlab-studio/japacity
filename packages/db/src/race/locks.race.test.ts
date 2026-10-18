// Two real connections racing for one row, which PGlite's single connection
// cannot show. Run with `DATABASE_URL=postgres://... pnpm vitest run --project db-race`
// against a database kept for these tests: every table is emptied before each test.
import { fileURLToPath } from "node:url";

import type { PairStore, PlayerStore, StoreResult, Work } from "@japacity/store";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { type Connection, connect } from "../connect";
import { pgPlayerStores } from "../stores/player";

const MIGRATIONS = fileURLToPath(new URL("../../migrations", import.meta.url));

// Fails the run, never skips it, when there is no database to race on.
const DATABASE_URL = process.env.DATABASE_URL ?? "";
if (DATABASE_URL === "") throw new Error("db-race needs DATABASE_URL set to a Postgres 18 database kept for these tests; it empties every table.");

/** A third connection that watches the other two and empties the tables. */
const watcher = new Client({ connectionString: DATABASE_URL });
let opened: Connection[] = [];

beforeAll(async () => {
  await watcher.connect();
  await migrate(drizzle({ client: watcher }), { migrationsFolder: MIGRATIONS });
});

afterAll(async () => {
  await watcher.end();
});

beforeEach(async () => {
  const found = await watcher.query<{ name: string }>("select quote_ident(tablename) as name from pg_tables where schemaname = 'public'");
  await watcher.query(`truncate ${found.rows.map((row) => row.name).join(", ")} restart identity cascade`);
});

afterEach(async () => {
  await Promise.all(opened.map((connection) => connection.close()));
  opened = [];
});

/** A player store and its pair store on their own connection. */
async function storesOnTheirOwn(): Promise<{ player: PlayerStore; pair: PairStore }> {
  const connection = await connect(DATABASE_URL);
  opened.push(connection);
  return pgPlayerStores(connection.handle);
}

async function storeOnItsOwn(): Promise<PlayerStore> {
  return (await storesOnTheirOwn()).player;
}

/** Waits until `count` sessions other than the watcher are blocked on a lock. */
async function blockedOnLocks(count: number): Promise<void> {
  for (let tries = 0; tries < 200; tries++) {
    const found = await watcher.query<{ waiting: string }>(
      "select count(*) as waiting from pg_stat_activity where wait_event_type = 'Lock' and datname = current_database() and pid <> pg_backend_pid()",
    );
    if (Number(found.rows[0]?.waiting ?? 0) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`No ${String(count)} session was blocked on a lock within five seconds.`);
}

/** A promise and the function that settles it. */
function gate(): { opened: Promise<void>; open: () => void } {
  let open = () => undefined as void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

function newCharacter(id: string) {
  return {
    id,
    account: `account-of-${id}`,
    refilledAt: 1_000,
    content: "content-1",
    start: { scenario: "scenario.graduate" as const, seed: `seed-${id}`, worldSeed: "world-seed" },
    state: { character: id } as never,
  };
}

function logRow(character: string, v: number) {
  return { character, v, tick: 10 + v, sender: "authority" as const, command: { basedOn: v - 1, type: "turns/grant" as const, count: 1 }, hash: `hash-${String(v)}`, at: 5_000 + v };
}

function must<T>(result: StoreResult<T>): T {
  if (!result.ok) throw new Error(`Expected the store to accept, and it refused with ${result.code}: ${result.detail}`);
  return result.value;
}

/** Appends one row to each named character on top of the version it reads. */
const appendToEach: Work<string[]> = (rows) => ({
  writes: { characters: rows.characters.map((held) => ({ id: held.character.id, append: [logRow(held.character.id, held.character.v + 1)] })) },
  result: rows.characters.map((held) => held.character.id),
});

describe("PlayerStore locks between two connections", () => {
  test("[server:one-command-one-transaction] given two connections sending a command based on version 0 to one character, when the first holds the row, then the second waits and is refused as stale", async () => {
    const first = await storeOnItsOwn();
    const second = await storeOnItsOwn();
    must(await first.create(newCharacter("char-a")));
    const hold = gate();
    const holding = gate();

    const firstDone = first.transact(["char-a"], async () => {
      holding.open();
      await hold.opened;
      return { writes: { characters: [{ id: "char-a", append: [logRow("char-a", 1)] }] }, result: "first" };
    });
    await holding.opened;
    let secondSaw = -1;
    const secondDone = second.transact(["char-a"], (rows) => {
      secondSaw = rows.characters[0]?.character.v ?? -1;
      return { writes: { characters: [{ id: "char-a", append: [{ ...logRow("char-a", 1), hash: "second" }] }] }, result: "second" };
    });
    await blockedOnLocks(1);
    hold.open();

    expect(must(await firstDone)).toBe("first");
    expect(await secondDone).toMatchObject({ ok: false, code: "stale" });
    expect(secondSaw).toBe(1);
    expect(await first.log("char-a", 0)).toEqual([logRow("char-a", 1)]);
  });

  test("[server:paired-rows-locked-in-order] given a transaction asking for two ids high id first, when the higher row is held elsewhere, then it already holds the lower row while it waits", async () => {
    const first = await storeOnItsOwn();
    const second = await storeOnItsOwn();
    must(await first.create(newCharacter("char-a")));
    must(await first.create(newCharacter("char-b")));
    const hold = gate();
    const holding = gate();

    const firstDone = first.transact(["char-b"], async (rows, stores) => {
      holding.open();
      await hold.opened;
      return appendToEach(rows, stores);
    });
    await holding.opened;
    const secondDone = second.transact(["char-b", "char-a"], appendToEach);
    await blockedOnLocks(1);

    await expect(watcher.query("select id from characters where id = 'char-a' for update nowait")).rejects.toThrow();
    hold.open();

    expect(must(await firstDone)).toEqual(["char-b"]);
    expect(must(await secondDone)).toEqual(["char-a", "char-b"]);
  });

  test("[server:paired-rows-locked-in-order] given two connections locking the same two ids in opposite orders, when they run at once many times, then every transaction completes without a deadlock", async () => {
    const first = await storeOnItsOwn();
    const second = await storeOnItsOwn();
    must(await first.create(newCharacter("char-a")));
    must(await first.create(newCharacter("char-b")));
    const rounds = 25;

    for (let round = 0; round < rounds; round++) {
      const results = await Promise.all([first.transact(["char-a", "char-b"], appendToEach), second.transact(["char-b", "char-a"], appendToEach)]);
      for (const result of results) expect(must(result)).toEqual(["char-a", "char-b"]);
    }

    expect((await first.load("char-a"))?.character.v).toBe(2 * rounds);
    expect((await second.load("char-b"))?.character.v).toBe(2 * rounds);
  });
});

describe("PairStore writes between two connections", () => {
  test("[pair:one-record-per-two] given two connections making the same pair record at version 0, when both commit, then one is kept and the other is refused as stale", async () => {
    const { player: first, pair } = await storesOnTheirOwn();
    const second = await storeOnItsOwn();
    must(await first.create(newCharacter("char-a")));
    must(await first.create(newCharacter("char-b")));
    const put = (stage: string) => ({ writes: { pairs: [{ key: "char-a~char-b", expectedV: 0, record: { stage } }] }, result: stage });

    const results = await Promise.all([first.transact(["char-a", "char-b"], () => put("first")), second.transact(["char-b", "char-a"], () => put("second"))]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([expect.objectContaining({ ok: false, code: "stale" })]);
    const kept = results[0]?.ok === true ? "first" : "second";
    expect(await pair.get("char-a~char-b")).toEqual({ key: "char-a~char-b", a: "char-a", b: "char-b", v: 1, record: { stage: kept } });
  });
});
