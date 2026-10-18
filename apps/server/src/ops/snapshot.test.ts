// Every character snapshotted before a deploy (server:snapshot-before-deploy), on
// Postgres (PGlite, the committed migrations), through the same tool the
// deploy runs, with the stores a command uses.
import { content } from "@japacity/content";
import type { PgliteConnection } from "@japacity/db/pglite";
import type { Content } from "@japacity/sim";
import { upgradeState } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { withContentBefore } from "../authority/overlay";
import type { TestServer } from "../authority/authority.testing";
import { held, newLife, restMonth, send, testServer, view } from "../authority/authority.testing";
import { freshDatabases, postgresStores } from "../postgres.testing";
import type { OpenDatabase } from "./database";
import { databaseFrom, workerContents } from "./database";
import { snapshotAll, snapshotCli } from "./snapshot";

/** A stand-in older version, the current data under the name "0", and the worker's contents with it bundled (server:older-contents-bundled). */
const previous: Content = { ...content, version: "0" };
const bundled = withContentBefore(workerContents(undefined), undefined, [previous]);
/** The tables a snapshot writes; every other table must come out as it went in. */
const CHARACTER_TABLES = new Set(["characters", "segments", "snapshots"]);

const database = freshDatabases();

async function onPostgres(): Promise<{ server: TestServer; connection: PgliteConnection; open: OpenDatabase }> {
  const connection = await database();
  const server = testServer({ stores: postgresStores(connection) });
  return { server, connection, open: () => Promise.resolve({ deps: server.deps, close: () => Promise.resolve() }) };
}

/** A character for `account` with `months` months rested; its stored version. */
async function lived(server: TestServer, account: string, months: number): Promise<{ id: string; v: number }> {
  const id = await newLife(server, account);
  let v = 0;
  for (let month = 0; month < months; month += 1) {
    const reply = await send(server, account, restMonth({ v }));
    if (!reply.body.ok) throw new Error(`Rejected with ${reply.body.code}: ${reply.body.detail}`);
    v = reply.body.view.v;
  }
  return { id, v };
}

/** Every table but the character tables, each as one digest of its rows. */
async function otherTables(connection: PgliteConnection): Promise<Record<string, string>> {
  const tables = await connection.client.query<{ name: string }>("select tablename as name from pg_tables where schemaname = 'public' order by tablename");
  const digests: Record<string, string> = {};
  for (const { name } of tables.rows) {
    if (CHARACTER_TABLES.has(name)) continue;
    const found = await connection.client.query<{ digest: string | null }>(`select md5(string_agg(t::text, ',' order by t::text)) as digest from "${name}" t`);
    digests[name] = found.rows[0]?.digest ?? "empty";
  }
  return digests;
}

describe("the snapshot of every character before a deploy", () => {
  test("[server:snapshot-before-deploy] [server:rollback-apply-one-account] given two characters on Postgres, when every character is snapshotted, then each has a new segment at the next version with its state as the base and an empty tail, a command on the old version is stale, and the next on the new version is accepted in the new segment", async () => {
    const { server, connection, open } = await onPostgres();
    const ada = await lived(server, "acc-1", 3);
    const bisi = await lived(server, "acc-2", 1);
    const seen = (await view(server, "acc-1")).body;
    const others = await otherTables(connection);

    const result = await snapshotCli([], open);

    expect(result.exit).toBe(0);
    expect(result.lines.slice(0, 2).sort()).toEqual([`${ada.id} v ${String(ada.v)} to v ${String(ada.v + 1)} snapshotted`, `${bisi.id} v ${String(bisi.v)} to v ${String(bisi.v + 1)} snapshotted`].sort());
    expect(result.lines[2]).toBe("2 characters: 2 snapshotted, 0 already, 0 diverged, 0 failed.");
    expect(await otherTables(connection)).toEqual(others);
    for (const { id, v } of [ada, bisi]) {
      const after = await held(server, id);
      expect(after.character).toMatchObject({ v: v + 1, segment: 1 });
      expect(after.segments.map((segment) => [segment.segment, segment.content, segment.fromV])).toEqual([
        [0, content.version, 0],
        [1, content.version, v + 1],
      ]);
      expect(after.segments[1]?.start).toEqual({ base: after.snapshot.state });
      expect(after.snapshot).toMatchObject({ segment: 1, v: v + 1, content: content.version });
      expect(after.snapshot.state.v).toBe(v + 1);
      expect(after.tail).toEqual([]);
    }
    const now = (await view(server, "acc-1")).body;
    if (!seen.ok || !now.ok) throw new Error("The views were refused.");
    expect({ ...now.view, v: seen.view.v }).toEqual(seen.view);

    expect((await send(server, "acc-1", restMonth({ v: ada.v }))).body).toMatchObject({ ok: false, code: "stale" });
    const next = await send(server, "acc-1", restMonth({ v: ada.v + 1 }));
    expect(next.body).toMatchObject({ ok: true, view: { v: ada.v + 2 } });
    const played = await held(server, ada.id);
    expect(played.segments).toHaveLength(2);
    expect(played.tail.map((row) => [row.v, row.command.basedOn])).toEqual([[ada.v + 2, ada.v + 1]]);
  });

  test("[server:snapshot-before-deploy] [server:log-rows-hash-state] given one character whose last logged hash no longer replays, when every character is snapshotted, then it is skipped, listed and left as it was, the others are done, and the tool ends non-zero", async () => {
    const { server, connection, open } = await onPostgres();
    const ada = await lived(server, "acc-1", 2);
    const bad = await lived(server, "acc-2", 2);
    const chidi = await lived(server, "acc-3", 1);
    await connection.client.query("update command_log set hash = $1 where character = $2 and v = $3", ["written-under-other-rules", bad.id, bad.v]);
    const untouched = await held(server, bad.id);

    const result = await snapshotCli([], open);

    expect(result.exit).toBe(1);
    expect(result.lines).toContain(`${bad.id} v ${String(bad.v)} to v ${String(bad.v)} diverged: Version ${String(bad.v)} replays to another hash.`);
    expect(result.lines).toContain(`${ada.id} v ${String(ada.v)} to v ${String(ada.v + 1)} snapshotted`);
    expect(result.lines).toContain(`${chidi.id} v ${String(chidi.v)} to v ${String(chidi.v + 1)} snapshotted`);
    expect(result.lines).toContain("3 characters: 2 snapshotted, 0 already, 1 diverged, 0 failed.");
    expect(await held(server, bad.id)).toEqual(untouched);
    expect(await server.deps.stores.audit.list(bad.id)).toEqual([]);
  });

  test("[server:snapshot-before-deploy] given every character snapshotted, when the tool runs again, then nothing is written and each is listed as already done", async () => {
    const { server, connection, open } = await onPostgres();
    const ada = await lived(server, "acc-1", 2);
    const bisi = await lived(server, "acc-2", 0);
    expect((await snapshotCli([], open)).exit).toBe(0);
    const first = [await held(server, ada.id), await held(server, bisi.id)];
    const others = await otherTables(connection);

    const again = await snapshotCli([], open);

    expect(again.exit).toBe(0);
    expect(again.lines).toContain(`${ada.id} v ${String(ada.v + 1)} to v ${String(ada.v + 1)} already`);
    expect(again.lines).toContain(`${bisi.id} v 1 to v 1 already`);
    expect(again.lines).toContain("2 characters: 0 snapshotted, 2 already, 0 diverged, 0 failed.");
    expect([await held(server, ada.id), await held(server, bisi.id)]).toEqual(first);
    expect(await otherTables(connection)).toEqual(others);
  });

  test("[server:snapshot-before-deploy] [server:newer-content-upgrades-state] given characters snapshotted under an older content, when the current content is deployed and a view is fetched, then the snapshot's segment is upgraded into a new one as any load does, and the next command is accepted", async () => {
    const { server, open } = await onPostgres();
    server.deps.contents = { current: previous, previous: null };
    const ada = await lived(server, "acc-1", 2);
    expect((await snapshotCli([], open)).exit).toBe(0);
    const snapped = await held(server, ada.id);
    expect(snapped.segments.at(-1)).toMatchObject({ segment: 1, content: previous.version, fromV: ada.v + 1 });

    server.deps.contents = bundled;
    const reply = await view(server, "acc-1");

    expect(reply.body.ok).toBe(true);
    const upgraded = await held(server, ada.id);
    expect(upgraded.segments.map((segment) => [segment.segment, segment.content, segment.fromV])).toEqual([
      [0, previous.version, 0],
      [1, previous.version, ada.v + 1],
      [2, content.version, ada.v + 1],
    ]);
    expect(upgraded.segments[2]?.start).toEqual({ base: upgradeState(snapped.snapshot.state, previous, content) });
    expect((await send(server, "acc-1", restMonth({ v: ada.v + 1 }))).body).toMatchObject({ ok: true, view: { v: ada.v + 2 } });
  });

  test("[server:snapshot-before-deploy] given a character under a content this tool does not bundle, when every character is snapshotted, then it is listed as failed, nothing of it is written and the others are done", async () => {
    const { server, open } = await onPostgres();
    server.deps.contents = { current: previous, previous: null };
    const old = await lived(server, "acc-1", 1);
    server.deps.contents = { current: content, previous: null };
    const ada = await lived(server, "acc-2", 1);
    const untouched = await held(server, old.id);

    const result = await snapshotCli([], open);

    expect(result.exit).toBe(1);
    expect(result.lines).toContain(`${old.id} v ${String(old.v)} to v ${String(old.v)} failed: The server bundles no content ${previous.version} under overlay none.`);
    expect(result.lines).toContain(`${ada.id} v ${String(ada.v)} to v ${String(ada.v + 1)} snapshotted`);
    expect(await held(server, old.id)).toEqual(untouched);
  });

  test("[server:snapshot-before-deploy] given more characters than one page of rows, when every character is snapshotted a page at a time, then each is done once, in id order", async () => {
    const { server } = await onPostgres();
    const ids = [(await lived(server, "acc-1", 1)).id, (await lived(server, "acc-2", 1)).id, (await lived(server, "acc-3", 1)).id].sort();

    const done = await snapshotAll(server.deps, undefined, 2);

    expect(done.map((one) => [one.id, one.outcome])).toEqual(ids.map((id) => [id, "snapshotted"]));
  });

  test("[server:snapshot-before-deploy] given no DATABASE_URL_UNPOOLED, or arguments the tool does not take, when the snapshot is run, then it refuses with its usage and connects to nothing", async () => {
    expect(databaseFrom({})).toBeNull();
    expect(databaseFrom({ DATABASE_URL_UNPOOLED: "" })).toBeNull();
    const missing = await snapshotCli([], databaseFrom({}));
    expect(missing.exit).toBe(2);
    expect(missing.lines[0]).toContain("DATABASE_URL_UNPOOLED");
    expect(missing.lines[1]).toMatch(/^Usage: pnpm snapshot:all/);
    let asked = false;
    const extra = await snapshotCli(["character.x"], () => {
      asked = true;
      return Promise.reject(new Error("never opened"));
    });
    expect(extra.exit).toBe(2);
    expect(asked).toBe(false);
  });
});
