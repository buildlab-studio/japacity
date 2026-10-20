import { applyOverlay, hashState, step, upgradeState } from "@japacity/sim";
import type { State } from "@japacity/sim";
import type { PlayerStore } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { testDeps } from "../app.testing";
import { productionConfig } from "../config";
import type { ServerDeps } from "../deps";
import { createLife, life, playRows, storeWorlds } from "./ops.testing";
import { rollbackApply, rollbackCheck } from "./rollback";

const ID = "character.tunde";
const SAVE = life("banker-borrower");
const at = (index: number) => productionConfig.clock.epoch + index;

async function stored(deps: ServerDeps, options: Partial<Parameters<typeof playRows>[4]> = {}, upTo = SAVE.commands.length): Promise<State> {
  await storeWorlds(deps, SAVE);
  const start = await createLife(deps, ID, SAVE);
  const played = await playRows(deps, ID, start, SAVE.commands.slice(0, upTo), { at, ...options });
  return played.state;
}

/** A row the server took that the simulation rejects: no draw runs in the stand-in world. */
async function appendRejected(deps: ServerDeps, state: State, v: number): Promise<void> {
  const row = { character: ID, v, tick: state.tick, sender: "player" as const, command: { type: "lottery/buy" as const, tickets: 1, basedOn: v - 1 }, hash: "taken-by-a-fault", at: at(0) };
  const written = await deps.stores.player.transact([ID], () => ({ writes: { characters: [{ id: ID, append: [row] }] }, result: null }));
  if (!written.ok) throw new Error(written.detail);
}

describe("the rollback check", () => {
  test("[server:rollback-check-finds-divergence] given a stored life whose every hash matches, when it is checked, then no version differs and nothing is written", async () => {
    const deps = testDeps();
    await stored(deps);
    const before = await deps.stores.player.load(ID);

    const checked = await rollbackCheck(deps, ID);

    expect(checked).toEqual({ ok: true, report: { character: ID, v: SAVE.commands.length, replayed: SAVE.commands.length, firstDiff: null, dropped: [] } });
    expect(await deps.stores.player.load(ID)).toEqual(before);
    expect(await deps.stores.audit.list(ID)).toEqual([]);
  });

  test("[server:rollback-check-finds-divergence] given one stored hash that differs, when the life is checked, then that version is reported as the first, the first row and the last row at the edges", async () => {
    for (const index of [0, 30, SAVE.commands.length - 1]) {
      const deps = testDeps();
      await stored(deps, { tamper: (row, at) => (at === index ? { ...row, hash: "written-by-a-fault" } : row) });

      const checked = await rollbackCheck(deps, ID);

      expect(checked.ok && checked.report.firstDiff).toEqual({ v: index + 1, stored: "written-by-a-fault", replayed: expect.any(String) as string });
      expect(checked.ok && checked.report.dropped).toEqual([]);
    }
  });

  test("[server:rollback-check-finds-divergence] given an unknown character or a tick with no stored world, when it is checked, then the check says why and replays nothing", async () => {
    const deps = testDeps();
    expect(await rollbackCheck(deps, "character.nobody")).toEqual({ ok: false, code: "missing", detail: "No character character.nobody." });

    const bare = testDeps();
    await storeWorlds(bare, { ...SAVE, commands: SAVE.commands.slice(0, 1) });
    const start = await createLife(bare, ID, SAVE);
    await playRows(bare, ID, start, SAVE.commands.slice(0, 1), { at });
    const row = { character: ID, v: 2, tick: 900, sender: "player" as const, command: { type: "turns/grant" as const, count: 1, basedOn: 1 }, hash: "x", at: at(1) };
    await bare.stores.player.transact([ID], () => ({ writes: { characters: [{ id: ID, append: [row] }] }, result: null }));
    expect(await rollbackCheck(bare, ID)).toMatchObject({ ok: false, code: "no-world" });
  });

  test("[server:rollback-check-finds-divergence] given a life in two segments, each under the content it names, when it is checked, then both replay and a fault in the second is found there", async () => {
    const base = testDeps();
    const overlaid = applyOverlay(base.contents.current, { version: "overlay-1" });
    for (const fault of [null, 50]) {
      const deps = testDeps({ contents: { current: overlaid, previous: base.contents.current } });
      const first = testDeps({ stores: deps.stores });
      await storeWorlds(first, SAVE);
      const start = await createLife(first, ID, SAVE);
      const half = await playRows(first, ID, start, SAVE.commands.slice(0, 40), { at });
      const carried = upgradeState(half.state, base.contents.current, overlaid);
      const segment = { character: ID, segment: 1, fromV: 40, content: overlaid.version, overlay: "overlay-1", start: { base: carried } };
      await deps.stores.player.transact([ID], () => ({
        writes: { characters: [{ id: ID, segment, snapshots: [{ character: ID, v: 40, segment: 1, content: overlaid.version, overlay: "overlay-1", state: carried }] }] },
        result: null,
      }));
      const rest = SAVE.commands.slice(40);
      const second = { ...deps, contents: { current: overlaid, previous: null } };
      await playRows(second, ID, carried, rest, { at, tamper: (row, index) => (index + 40 === fault ? { ...row, hash: "fault" } : row) });

      const checked = await rollbackCheck(deps, ID);

      expect(checked.ok && checked.report.replayed).toBe(SAVE.commands.length);
      expect(checked.ok && checked.report.firstDiff?.v).toBe(fault === null ? undefined : fault + 1);
    }
  });
});

describe("the rollback correction", () => {
  test("[server:rollback-apply-one-account] given a stored hash that differs, when the correction is applied, then the replayed state is the base of a new segment at the next version and the old rows go to the audit store", async () => {
    const deps = testDeps({ now: () => 77 });
    const honest = await stored(deps, { tamper: (row, index) => (index === 30 ? { ...row, hash: "written-by-a-fault" } : row) });
    const before = await deps.stores.player.load(ID);
    const log = await deps.stores.player.log(ID, 0);
    const v = SAVE.commands.length;

    const applied = await rollbackApply(deps, ID);

    expect(applied).toMatchObject({ ok: true, corrected: true, segment: 1, v: v + 1, audit: 1 });
    const after = await deps.stores.player.load(ID);
    expect(after?.character).toMatchObject({ v: v + 1, segment: 1 });
    expect(after?.segments).toHaveLength(1);
    expect(after?.snapshot.state).toEqual({ ...honest, v: v + 1 });
    expect(after?.tail).toEqual([]);
    expect(await deps.stores.player.log(ID, 0)).toEqual([]);
    const [audit] = await deps.stores.audit.list(ID);
    expect(audit).toMatchObject({ character: ID, why: "rollback", at: 77, segments: before?.segments, log, snapshots: [before?.snapshot] });
    expect(await rollbackCheck(deps, ID)).toMatchObject({ ok: true, report: { firstDiff: null, replayed: 0 } });
  });

  test("[server:rollback-apply-one-account] given a corrected character, when the client sends its next command on the version it saw, then it is stale", async () => {
    const deps = testDeps();
    await stored(deps, { tamper: (row, index) => (index === 3 ? { ...row, hash: "fault" } : row) });
    await rollbackApply(deps, ID);
    const after = await deps.stores.player.load(ID);
    const world = await deps.stores.world.tick(after?.snapshot.state.tick ?? 0);
    if (after === null || world === null) throw new Error("The corrected character is stored.");

    const sent = step(after.snapshot.state, { type: "turns/grant", count: 1, basedOn: SAVE.commands.length }, world.world, deps.contents.current, "authority");

    expect(sent).toMatchObject({ ok: false, code: "stale" });
  });

  test("[server:rollback-apply-one-account] given a logged command the simulation now rejects, in the middle or at the end, when the correction is applied, then it is dropped and listed and every other command is kept", async () => {
    const middle = testDeps();
    const head = await stored(middle, {}, 30);
    await appendRejected(middle, head, 31);
    const played = await playRows(middle, ID, head, SAVE.commands.slice(30), { at, shift: 1 });

    const corrected = await rollbackApply(middle, ID);

    expect(corrected).toMatchObject({ ok: true, corrected: true, v: SAVE.commands.length + 2 });
    expect(corrected.ok && corrected.report.dropped).toEqual([{ v: 31, type: "lottery/buy", code: "not-legal", detail: expect.any(String) as string }]);
    expect(corrected.ok && corrected.report.firstDiff?.v).toBe(31);
    const after = await middle.stores.player.load(ID);
    expect(hashState({ ...after?.snapshot.state, v: played.state.v })).toBe(hashState(played.state));

    const end = testDeps();
    const whole = await stored(end);
    await appendRejected(end, whole, SAVE.commands.length + 1);
    const last = await rollbackApply(end, ID);
    expect(last.ok && last.report.dropped.map((each) => each.v)).toEqual([SAVE.commands.length + 1]);
    expect((await end.stores.player.load(ID))?.snapshot.state).toEqual({ ...whole, v: SAVE.commands.length + 2 });
  });

  test("[server:rollback-apply-one-account] given a life with no difference, when the correction is applied, then nothing is written", async () => {
    const deps = testDeps();
    await stored(deps);
    const before = await deps.stores.player.load(ID);

    expect(await rollbackApply(deps, ID)).toMatchObject({ ok: true, corrected: false });
    expect(await deps.stores.player.load(ID)).toEqual(before);
    expect(await deps.stores.audit.list(ID)).toEqual([]);
  });

  test("[server:rollback-apply-one-account] given a command committed between the check and the lock, when the correction is applied, then it writes nothing and asks to be run again", async () => {
    const deps = testDeps();
    const state = await stored(deps, { tamper: (row, index) => (index === 3 ? { ...row, hash: "fault" } : row) }, SAVE.commands.length - 1);
    const real = deps.stores.player;
    const racing: PlayerStore = {
      ...real,
      transact: async (ids, work) => {
        racing.transact = real.transact;
        await playRows(deps, ID, state, SAVE.commands.slice(-1), { at });
        return real.transact(ids, work);
      },
    };
    const raced = { ...deps, stores: { ...deps.stores, player: racing } };

    expect(await rollbackApply(raced, ID)).toMatchObject({ ok: false, code: "moved-on" });
    expect(await deps.stores.audit.list(ID)).toEqual([]);
    expect((await deps.stores.player.load(ID))?.character).toMatchObject({ v: SAVE.commands.length, segment: 0 });
  });

  test("[server:no-mass-rollback] given two characters, when one is corrected, then the other's rows are not touched", async () => {
    const deps = testDeps();
    await stored(deps, { tamper: (row, index) => (index === 3 ? { ...row, hash: "fault" } : row) });
    const other = "character.zainab";
    const zainab = life("developer-remote");
    await storeWorlds(deps, zainab);
    const start = await createLife(deps, other, zainab);
    await playRows(deps, other, start, zainab.commands.slice(0, 10), { at, tamper: (row, index) => (index === 2 ? { ...row, hash: "fault" } : row) });
    const untouched = await deps.stores.player.load(other);

    await rollbackApply(deps, ID);

    expect(await deps.stores.player.load(other)).toEqual(untouched);
    expect(await deps.stores.audit.list(other)).toEqual([]);
    expect(rollbackApply.length).toBe(2);
    expect(rollbackCheck.length).toBe(2);
  });
});
