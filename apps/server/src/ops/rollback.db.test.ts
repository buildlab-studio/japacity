// The rollback tool against the database (server.md R-SERVER-008, R-SERVER-009,
// R-SERVER-010, R-SERVER-047): the command line's form with no
// flag, on Postgres (PGlite, the committed migrations), one character per run.
import { content } from "@japacity/content";
import { pgStores } from "@japacity/db";
import type { PgliteConnection } from "@japacity/db/pglite";
import { connectPglite } from "@japacity/db/pglite";
import type { FlatSave, State } from "@japacity/sim";
import { applyOverlay, hashState, offlineCalendar, stepWorld } from "@japacity/sim";
import { afterEach, describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import { rollbackCli } from "./cli";
import type { Database, OpenDatabase } from "./database";
import { databaseDeps, databaseFrom } from "./database";
import { createLife, life, playRows } from "./ops.testing";
import { storeSave } from "./memory";

const ID = "character.tunde";
const OTHER = "character.zainab";
const SAVE = life("tunde-borrower");
const at = (index: number) => productionConfig.clock.epoch + index;
/** Rules other than the deployed ones: the wellbeing drifts back faster each month. */
const otherRules = applyOverlay(content, { version: "other-rules", tuning: { quality: { wellbeingDrift: 5 } } });
const noFile = () => Promise.reject(new Error("The database form reads no file."));

const opened: PgliteConnection[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((connection) => connection.close()));
});

async function onPostgres(): Promise<{ deps: Database["deps"]; open: OpenDatabase; closed: () => number }> {
  const connection = await connectPglite();
  opened.push(connection);
  const deps = databaseDeps(pgStores(connection.handle), { current: content, previous: null }, () => 77);
  let closes = 0;
  const open = () =>
    Promise.resolve({
      deps,
      close: () => {
        closes += 1;
        return Promise.resolve();
      },
    });
  return { deps, open, closed: () => closes };
}

/** R-CLOCK-010: the stand-in world of every tick the save names, with its director's book, as Postgres keeps a tick. */
async function storeWorlds(deps: Database["deps"], save: FlatSave): Promise<void> {
  const upTo = Math.max(0, ...save.commands.map((entry) => entry.tick));
  let book = null;
  for (let tick = 0; tick <= upTo; tick += 1) {
    const stepped = stepWorld(book, save.worldSeed, content, offlineCalendar(tick), 1);
    book = stepped.book;
    await deps.stores.world.insertTick({ tick, world: stepped.world, book, content: content.version, hash: hashState(stepped.world) });
  }
}

/** The recorded life stored as `ID`, its first `upTo` commands logged as the server logs them under `rules`. */
async function stored(deps: Database["deps"], upTo = SAVE.commands.length, rules = content): Promise<State> {
  await storeWorlds(deps, SAVE);
  const start = await createLife(deps, ID, SAVE);
  const played = await playRows({ ...deps, contents: { current: rules, previous: null } }, ID, start, SAVE.commands.slice(0, upTo), { at });
  return played.state;
}

/** A row the server took that the simulation rejects: no draw runs in the stand-in world. */
async function appendRejected(deps: Database["deps"], state: State, v: number): Promise<void> {
  const row = { character: ID, v, tick: state.tick, sender: "player" as const, command: { type: "lottery/buy" as const, tickets: 1, basedOn: v - 1 }, hash: "taken-by-a-fault", at: at(0) };
  const written = await deps.stores.player.transact([ID], () => ({ writes: { characters: [{ id: ID, append: [row] }] }, result: null }));
  if (!written.ok) throw new Error(written.detail);
}

function parsed(lines: readonly string[]): unknown {
  return JSON.parse(lines[0] ?? "");
}

describe("the rollback tool on the database", () => {
  test("[R-SERVER-008] given a clean character on Postgres, when the check is run with no flag, then it reports no difference, writes nothing, closes its connection and exits 0", async () => {
    const { deps, open, closed } = await onPostgres();
    await stored(deps);
    const before = await deps.stores.player.load(ID);

    const result = await rollbackCli(["check", ID], noFile, open);

    expect(result.exit).toBe(0);
    expect(parsed(result.lines)).toEqual({ ok: true, report: { character: ID, v: SAVE.commands.length, replayed: SAVE.commands.length, firstDiff: null, dropped: [] } });
    expect(await deps.stores.player.load(ID)).toEqual(before);
    expect(await deps.stores.audit.list(ID)).toEqual([]);
    expect(closed()).toBe(1);
  });

  test("[R-SERVER-008] given a character whose log was written under other rules, when the check is run on the database, then it reports the first version that differs and writes nothing", async () => {
    const { deps, open } = await onPostgres();
    await stored(deps, SAVE.commands.length, otherRules);
    const before = await deps.stores.player.load(ID);

    const result = await rollbackCli(["check", ID], noFile, open);

    // The first version the deployed rules log another hash at, found by playing the same life under them in memory.
    const deployed = await storeSave(databaseDeps({}, { current: content, previous: null }), ID, SAVE);
    const logged = await deps.stores.player.log(ID, 0);
    const first = logged.find((row, index) => row.hash !== deployed.rows[index]?.hash);
    expect(first).toBeDefined();
    expect(result.exit).toBe(0);
    expect(parsed(result.lines)).toMatchObject({ ok: true, report: { firstDiff: { v: first?.v, stored: first?.hash } } });
    expect(await deps.stores.player.load(ID)).toEqual(before);
  });

  test("[R-SERVER-009] [R-SERVER-010] given a logged command the simulation now rejects and a second character, when apply is run on the database, then the command is dropped and listed, a new segment opens at the next version, the old rows go to the audit table and the other character is untouched", async () => {
    const { deps, open } = await onPostgres();
    const head = await stored(deps, 30);
    await appendRejected(deps, head, 31);
    const played = await playRows(deps, ID, head, SAVE.commands.slice(30), { at, shift: 1 });
    const zainab = life("zainab-remote");
    await storeWorlds(deps, zainab);
    const start = await createLife(deps, OTHER, zainab);
    await playRows(deps, OTHER, start, zainab.commands.slice(0, 10), { at, tamper: (row, index) => (index === 2 ? { ...row, hash: "fault" } : row) });
    const before = await deps.stores.player.load(ID);
    const log = await deps.stores.player.log(ID, 0);
    const untouched = await deps.stores.player.load(OTHER);
    const v = SAVE.commands.length + 1;

    const result = await rollbackCli(["apply", ID], noFile, open);

    expect(result.exit).toBe(0);
    expect(parsed(result.lines)).toMatchObject({ ok: true, corrected: true, segment: 1, v: v + 1, report: { dropped: [{ v: 31, type: "lottery/buy", code: "not-legal" }], firstDiff: { v: 31 } } });
    const after = await deps.stores.player.load(ID);
    expect(after?.character).toMatchObject({ v: v + 1, segment: 1 });
    expect(after?.segments.map((segment) => [segment.segment, segment.fromV])).toEqual([[1, v + 1]]);
    expect(after?.snapshot.state).toEqual({ ...played.state, v: v + 1 });
    expect(after?.tail).toEqual([]);
    const [audit] = await deps.stores.audit.list(ID);
    expect(audit).toMatchObject({ character: ID, why: "rollback", at: 77, segments: before?.segments, log, snapshots: [before?.snapshot] });
    expect(await deps.stores.player.load(OTHER)).toEqual(untouched);
    expect(await deps.stores.audit.list(OTHER)).toEqual([]);
    expect(parsed((await rollbackCli(["check", ID], noFile, open)).lines)).toMatchObject({ ok: true, report: { firstDiff: null, replayed: 0 } });
  });

  test("[R-SERVER-008] [R-SERVER-009] given no DATABASE_URL_UNPOOLED, when check or apply is run with no flag, then it refuses plainly with its usage and exits 2", async () => {
    for (const action of ["check", "apply"]) {
      const result = await rollbackCli([action, ID], noFile, databaseFrom({ DATABASE_URL: "postgres://the-app-role@example.invalid/game" }));
      expect(result.exit).toBe(2);
      expect(result.lines[0]).toContain("DATABASE_URL_UNPOOLED");
      expect(result.lines[1]).toMatch(/^Usage: pnpm rollback check\|apply <character>/);
    }
    expect((await rollbackCli(["check", ID, "--elsewhere", "x"], noFile, null)).exit).toBe(2);
  });
});
