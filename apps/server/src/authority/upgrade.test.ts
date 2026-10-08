import { content } from "@japacity/content";
import type { Content, FlatSave, Overlay, World } from "@japacity/sim";
import { applyOverlay, checkInvariants, hashState, newState, offlineCalendar, replay, stepWorld, upgradeState, viewFor } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { lifeSaves } from "../../../../packages/sim/src/goldens/lives.data";
import { productionConfig } from "../config";
import { upgradeCharacter } from "./command";
import { apply } from "./load";
import type { TestServer } from "./testing";
import { held, newLife, restMonth, send, signUp, testServer, view } from "./testing";
import { transact } from "./transaction";

const { epoch, worldTickMs } = productionConfig.clock;
const previous: Content = { ...content, version: "m0.0" };
const dials: Overlay = { version: "dials-1", tuning: { director: { surgePerTick: 4 } } } as Overlay;

/** The stand-in worlds a recorded life was played on, stored as the server's ticks under the previous content. */
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

/** A recorded life stored as a character on the previous content, every command logged at its own tick. */
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

describe("old saves", () => {
  test.each(Object.entries(lifeSaves))(
    "[R-SERVER-020] [R-SERVER-021] [R-SERVER-023] given the golden life %s stored under the previous content, when its view is fetched under the current one, then its end state is upgraded, checked and made the base of a new segment in that one transaction",
    async (_name, save) => {
      const server = testServer();
      const { id, worlds } = await storeLife(server, save);
      const ended = replay({ ...save, content: previous.version }, previous, (tick) => worlds[tick] as World).state;
      const upgraded = upgradeState(ended, previous, content);
      expect(checkInvariants(upgraded, content)).toEqual([]);

      server.deps.contents = { current: content, previous };
      const reply = await view(server, "acc-1");
      if (!reply.body.ok) throw new Error(reply.body.detail);
      const stored = await held(server, id);
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

  test("[R-SERVER-024] [R-ENGINE-010] given a character under the public content, when an overlay is deployed and the player sends a command, then a new segment naming the overlay opens in the same transaction and the command is its first row", async () => {
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

  test("[R-SERVER-021] [R-SERVER-005] given a character on the previous content, when its command is rejected, then the upgrade is not written either", async () => {
    const server = testServer();
    server.deps.contents = { current: previous, previous: null };
    const id = await newLife(server, "acc-1");
    server.deps.contents = { current: content, previous };
    const reply = await send(server, "acc-1", restMonth({ v: 5 }));
    expect(reply.body).toMatchObject({ ok: false, code: "stale" });
    expect((await held(server, id)).segments).toHaveLength(1);
  });

  test("[R-SERVER-023] given a character still on the previous content, when the sweep upgrades it, then a new segment is written and no turn is granted", async () => {
    const server = testServer();
    server.deps.contents = { current: previous, previous: null };
    const id = await newLife(server, "acc-1");
    await send(server, "acc-1", restMonth({ v: 0 }));
    server.deps.contents = { current: content, previous };
    server.wait(10 * productionConfig.clock.turnRefillMs);
    const outcome = await upgradeCharacter(server.deps, id);
    expect(outcome.kind).toBe("done");
    const stored = await held(server, id);
    expect(stored.segments.map((segment) => segment.content)).toEqual([previous.version, content.version]);
    expect(stored.tail).toEqual([]);
    expect(stored.snapshot.state.turn.banked).toBe(content.tuning.turn.cap - 1);
  });
});
