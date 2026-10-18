import { content, olderContents } from "@japacity/content";
import type { Content, FlatSave, Overlay, State, World } from "@japacity/sim";
import { applyOverlay, checkInvariants, hashState, newState, offlineCalendar, replay, stepWorld, upgradeState, viewFor } from "@japacity/sim";
import { lifeSaves } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import { apply, contentNamed } from "./load";
import { contentsFor, withContentBefore } from "./overlay";
import type { TestServer } from "./authority.testing";
import { held, newLife, restMonth, send, signUp, testServer, view } from "./authority.testing";
import { transact } from "./transaction";

const { epoch, worldTickMs } = productionConfig.clock;
/** A stand-in older version, the current data under the name "0", and the worker's contents with it bundled (server:older-contents-bundled). */
const previous: Content = { ...content, version: "0" };
const bundled = withContentBefore(contentsFor(content, undefined), undefined, [previous]);
const dials: Overlay = { version: "dials-1", tuning: { director: { surgePerTick: 4 } } };

/** The stand-in worlds a recorded life was played on, stored as the server's ticks under an older content. */
async function storeWorlds(server: TestServer, worldSeed: string, upTo: number): Promise<World[]> {
  const worlds: World[] = [];
  let book = null;
  for (let tick = 0; tick <= upTo; tick += 1) {
    const stepped = stepWorld(book, worldSeed, previous, offlineCalendar(tick), 1);
    book = stepped.book;
    worlds.push(stepped.world);
    await server.deps.stores.world.insertTick({ tick, world: stepped.world, book, content: previous.version, hash: hashState(stepped) });
  }
  return worlds;
}

/** A recorded life stored as a character on an older content, every command logged at its own tick. */
async function storeLife(server: TestServer, save: FlatSave): Promise<{ id: string; worlds: World[] }> {
  const last = save.commands.at(-1)?.tick ?? 0;
  const worlds = await storeWorlds(server, save.worldSeed, last);
  server.setNow(epoch + last * worldTickMs);
  await signUp(server, "acc-1");
  const id = "character-golden";
  const state = newState(save.scenario, save.seed, previous);
  const start = { scenario: save.scenario, seed: save.seed, worldSeed: save.worldSeed };
  await server.deps.stores.player.create({ id, account: "acc-1", refilledAt: server.deps.now(), content: previous.version, start, state });
  await server.deps.stores.account.setCharacter("acc-1", id);
  server.deps.contents = { current: previous, previous: null };
  const stored = await transact(
    server.deps,
    [id],
    (lives) => {
      const live = lives[0];
      if (live === undefined) throw new Error("No character.");
      for (const entry of save.commands) {
        const world = worlds[entry.tick];
        if (world === undefined) throw new Error(`No world ${String(entry.tick)}.`);
        const result = apply(live, entry.command, entry.sender, world, server.deps.now(), server.deps.config.server.snapshotEvery);
        if (!result.ok) throw new Error(`${entry.command.type} rejected with ${result.code}.`);
      }
      return { ok: true, value: null };
    },
    { grant: false },
  );
  if (stored.kind !== "done") throw new Error(`The life was not stored: ${stored.kind}.`);
  return { id, worlds };
}

/** A copy of `value` without the named keys. */
function without(value: object, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

describe("old saves", () => {
  test.each(Object.entries(lifeSaves))(
    "[server:save-is-list-of-segments] [server:newer-content-upgrades-state] [server:older-contents-bundled] given the golden life %s stored under an older content, when its view is fetched under the current one, then its end state is upgraded, checked and made the base of a new segment in that one transaction",
    async (_name, save) => {
      const server = testServer();
      const { id, worlds } = await storeLife(server, save);
      const ended = replay({ ...save, content: previous.version }, previous, (tick) => worlds[tick] as World).state;
      const upgraded = upgradeState(ended, previous, content);
      expect(checkInvariants(upgraded, content)).toEqual([]);

      server.deps.contents = bundled;
      const reply = await view(server, "acc-1");
      if (!reply.body.ok) throw new Error(reply.body.detail);
      const stored = await held(server, id);
      expect(previous.version).not.toBe(content.version);
      expect(stored.segments.map((segment) => [segment.segment, segment.content, segment.fromV])).toEqual([
        [0, previous.version, 0],
        [1, content.version, ended.v],
      ]);
      expect(stored.segments[1]?.start).toEqual({ base: upgraded });
      expect(stored.snapshot).toMatchObject({ segment: 1, v: ended.v, content: content.version });
      expect(stored.snapshot.state).toEqual(upgraded);
      const tick = (await server.deps.stores.world.tick(save.commands.at(-1)?.tick ?? 0))?.world;
      if (tick === undefined) throw new Error("No world.");
      expect(reply.body.view).toEqual(viewFor({ state: upgraded, world: tick, content }));

      await view(server, "acc-1");
      expect((await held(server, id)).segments).toHaveLength(2);
    },
    30_000,
  );

  test("[server:overlay-change-opens-segment] [engine:state-is-plain-data] given a character under the public content, when an overlay is deployed and the player sends a command, then a new segment naming the overlay opens in the same transaction and the command is its first row", async () => {
    const server = testServer();
    const id = await newLife(server, "acc-1");
    for (let v = 0; v < 3; v += 1) await send(server, "acc-1", restMonth({ v }));
    const overlaid = applyOverlay(content, dials);
    server.deps.contents = { current: overlaid, previous: content };
    const reply = await send(server, "acc-1", restMonth({ v: 3 }));
    expect(reply.body.ok).toBe(true);
    const stored = await held(server, id);
    expect(stored.segments.map((segment) => [segment.segment, segment.content, segment.overlay, segment.fromV])).toEqual([
      [0, content.version, undefined, 0],
      [1, content.version, "dials-1", 3],
    ]);
    expect(stored.snapshot).toMatchObject({ segment: 1, v: 3, overlay: "dials-1" });
    expect(stored.tail.map((row) => row.v)).toEqual([4]);
    expect((await view(server, "acc-1")).body.ok).toBe(true);
  });

  test("[server:newer-content-upgrades-state] [server:rejections-write-nothing] given a character on an older content, when its command is rejected, then the upgrade is not written either", async () => {
    const server = testServer();
    server.deps.contents = { current: previous, previous: null };
    const id = await newLife(server, "acc-1");
    server.deps.contents = { current: content, previous };
    const reply = await send(server, "acc-1", restMonth({ v: 5 }));
    expect(reply.body).toMatchObject({ ok: false, code: "stale" });
    expect((await held(server, id)).segments).toHaveLength(1);
  });

  test("[server:newer-content-upgrades-state] [server:upgrade-state-is-pure] [server:older-contents-bundled] given a character stored under an older content by the code before schema 4 (no spent half-days, no offers rolled, no body), when its view is fetched under the current one, then the new segment's base has them filled as a new life starts them, at schema 4, and the invariants hold", async () => {
    const server = testServer();
    await storeWorlds(server, "golden-world", 0);
    server.setNow(epoch);
    await signUp(server, "acc-1");
    const id = "character-schema-3";
    const fresh = newState("scenario.tunde", "seed-3", previous);
    const turn = without(fresh.turn, ["spent"]);
    const offer = without(fresh.offer, ["rolled", "rolledMonth"]);
    const quality = without(fresh.quality, ["quality.belly", "quality.energy"]);
    const older = { ...fresh, schema: 3, turn, offer, quality } as unknown as State;
    const start = { scenario: fresh.scenario, seed: fresh.seed, worldSeed: "golden-world" };
    await server.deps.stores.player.create({ id, account: "acc-1", refilledAt: server.deps.now(), content: previous.version, start, state: older });
    await server.deps.stores.account.setCharacter("acc-1", id);
    server.deps.contents = bundled;
    const reply = await view(server, "acc-1");
    if (!reply.body.ok) throw new Error(reply.body.detail);
    const stored = await held(server, id);
    expect(stored.segments.map((segment) => segment.content)).toEqual([previous.version, content.version]);
    const base = stored.snapshot.state;
    expect(base.schema).toBe(4);
    expect(base.turn.spent).toBe(0);
    expect([base.offer.rolled, base.offer.rolledMonth]).toEqual([0, 0]);
    const now = newState("scenario.tunde", "seed-3", content);
    expect([base.quality["quality.belly"], base.quality["quality.energy"]]).toEqual([now.quality["quality.belly"], now.quality["quality.energy"]]);
    expect(base).toEqual(now);
    expect(checkInvariants(base, content)).toEqual([]);
  });

  test("[server:older-contents-bundled] [server:overlay-change-opens-segment] given the worker's contents with an older version, with and without an overlay, when a segment names the current or the older version, then each is bundled under its own overlay", () => {
    const plain = withContentBefore(contentsFor(content, undefined), undefined, [previous]);
    expect(contentNamed(plain, content.version, undefined)).toBe(content);
    expect(contentNamed(plain, previous.version, undefined)).toBe(previous);
    const overlaid = withContentBefore(contentsFor(content, JSON.stringify(dials)), JSON.stringify(dials), [previous]);
    expect(contentNamed(overlaid, content.version, "dials-1")).toBe(overlaid.current);
    expect(contentNamed(overlaid, content.version, undefined)).toBe(content);
    expect(contentNamed(overlaid, previous.version, undefined)).toBe(previous);
    expect(contentNamed(overlaid, previous.version, "dials-1")).toEqual(applyOverlay(previous, dials));
    expect(() => contentNamed(plain, "unknown", undefined)).toThrow(/bundles no content unknown/);
  });

  test("[server:older-contents-bundled] [server:overlay-change-opens-segment] given an overlay naming a number an older content lacks, when the worker's contents are built, then that older content is bundled as it shipped and not under the overlay", () => {
    const director = Object.fromEntries(Object.entries(content.tuning.director).filter(([key]) => key !== "surgePerTick"));
    const narrower = { ...content, version: "0", tuning: { ...content.tuning, director } } as unknown as Content;
    const overlaid = withContentBefore(contentsFor(content, JSON.stringify(dials)), JSON.stringify(dials), [narrower]);
    expect(contentNamed(overlaid, "0", undefined)).toBe(narrower);
    expect(() => contentNamed(overlaid, "0", "dials-1")).toThrow(/bundles no content 0 under overlay dials-1/);
  });

  test("[server:older-contents-bundled] given content version 1, the first, when the worker's contents are built, then no older version is bundled and only the current is named", () => {
    expect(content.version).toBe("1");
    expect(olderContents).toEqual([]);
    const worker = withContentBefore(contentsFor(content, undefined), undefined);
    expect(worker).toEqual({ current: content, previous: null });
    expect(contentNamed(worker, "1", undefined)).toBe(content);
    expect(() => contentNamed(worker, "0", undefined)).toThrow(/bundles no content 0/);
  });
});
