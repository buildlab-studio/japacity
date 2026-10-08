import { content } from "@japacity/content";
import type { Content, DirectorBook, Id } from "@japacity/sim";
import { hashState, stepWorld } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { call, testServer } from "../authority/testing";
import { productionConfig, testConfig } from "../config";
import { ticksJob, TICKS_CRON } from "../jobs/ticks";
import type { WorldReply } from "../types";
import { catchUp, lagosCalendar, makeTick } from "./ticks";

const { epoch, worldTickMs } = productionConfig.clock;
const DECEMBER: Id<"var"> = "var.season-december";
const scale = content.tuning.director.onlineTickScale;

describe("the world's stored ticks", () => {
  test("[R-CLOCK-011] given no stored tick, when tick 0 and tick 1 are made, then tick 0 is the world seed's alone and tick 1 steps from the stored book", async () => {
    const server = testServer();
    expect(await catchUp(server.deps, 1)).toEqual([0, 1]);
    const zero = stepWorld(null, "test-world-seed", content, lagosCalendar(epoch), scale);
    const one = stepWorld(zero.book, "test-world-seed", content, lagosCalendar(epoch + worldTickMs), scale);
    const stored = [await server.deps.stores.world.tick(0), await server.deps.stores.world.tick(1)];
    expect(stored.map((row) => row?.world)).toEqual([zero.world, one.world]);
    expect(stored[1]?.book).toEqual(one.book);
  });

  test("[R-CLOCK-010] given stored ticks, when they are read back, then each holds the world, the book after it, the content and the hash of both, and a second catch-up rewrites none", async () => {
    const server = testServer();
    await catchUp(server.deps, 3);
    const before = await Promise.all([0, 1, 2, 3].map((tick) => server.deps.stores.world.tick(tick)));
    for (const row of before) {
      if (row === null) throw new Error("A tick is missing.");
      expect(row.hash).toBe(hashState({ world: row.world, book: row.book }));
      expect(row.content).toBe(content.version);
      expect((row.book as DirectorBook).tick).toBe(row.tick);
    }
    expect(await catchUp(server.deps, 3)).toEqual([]);
    expect(await Promise.all([0, 1, 2, 3].map((tick) => server.deps.stores.world.tick(tick)))).toEqual(before);
  });

  test("[R-CLOCK-015] given the content's online scale, when ticks are made, then the director runs at that scale and not at 1", async () => {
    const server = testServer();
    await catchUp(server.deps, 0);
    const stored = await server.deps.stores.world.tick(0);
    const scaled = stepWorld(null, "test-world-seed", content, lagosCalendar(epoch), scale).world;
    const unscaled = stepWorld(null, "test-world-seed", content, lagosCalendar(epoch), 1).world;
    expect(scale).toBeGreaterThan(1);
    expect(stored?.world.era).toEqual(scaled.era);
    expect(stored?.world.era).not.toEqual(unscaled.era);
  });

  test("[R-CLOCK-012] given the job on its cron after three missed runs, when it runs, then every tick up to the current one is stored in order; on another cron it stores none", async () => {
    const server = testServer();
    await catchUp(server.deps, 1);
    server.setNow(epoch + 4 * worldTickMs + 1);
    expect(await ticksJob(server.deps, "0 0 * * *")).toEqual([]);
    expect(await ticksJob(server.deps, TICKS_CRON)).toEqual([2, 3, 4]);
    expect((await server.deps.stores.world.latest())?.tick).toBe(4);
    expect(await server.deps.stores.world.tick(5)).toBeNull();
  });

  test("[R-CLOCK-013] given two catch-ups racing on the same store, when both finish, then every tick was stored once and equals the tick one writer alone makes", async () => {
    const server = testServer();
    const [first, second] = await Promise.all([catchUp(server.deps, 6), catchUp(server.deps, 6)]);
    expect([...(first ?? []), ...(second ?? [])].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const alone = testServer();
    await catchUp(alone.deps, 6);
    for (let tick = 0; tick <= 6; tick += 1) {
      expect(await server.deps.stores.world.tick(tick)).toEqual(await alone.deps.stores.world.tick(tick));
    }
  });

  test("[R-CLOCK-013] given no stored tick, when a request comes at tick 3, then the server makes ticks 0 to 3 before it answers, and none after", async () => {
    const server = testServer();
    server.setNow(epoch + 3 * worldTickMs + 10);
    const reply = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(reply.body.tick).toBe(3);
    expect((await server.deps.stores.world.latest())?.tick).toBe(3);
  });

  test("[R-CLOCK-014] given the Lagos midnight that opens and closes December, when the calendar is read either side, then December holds from 23:00 UTC on 30 November to 22:59:59.999 UTC on 31 December", () => {
    const opens = Date.UTC(2026, 10, 30, 23, 0, 0);
    const closes = Date.UTC(2026, 11, 31, 23, 0, 0);
    expect(lagosCalendar(opens - 1)).toEqual({ december: false });
    expect(lagosCalendar(opens)).toEqual({ december: true });
    expect(lagosCalendar(closes - 1)).toEqual({ december: true });
    expect(lagosCalendar(closes)).toEqual({ december: false });
  });

  test("[R-CLOCK-014] given an epoch one tick before Lagos December opens, when ticks 0 and 1 are made, then the season variable is 0 and then 1", async () => {
    const opens = Date.UTC(2026, 10, 30, 23, 0, 0);
    const server = testServer({ config: testConfig({ clock: { epoch: opens - worldTickMs } }) });
    await catchUp(server.deps, 1);
    expect((await server.deps.stores.world.tick(0))?.world.vars[DECEMBER]).toBe(0);
    expect((await server.deps.stores.world.tick(1))?.world.vars[DECEMBER]).toBe(1);
  });

  test("[R-CLOCK-016] given ticks stored under one content, when a new content is deployed, then the stored ticks stay and the next tick names the new content and steps on from the stored book", async () => {
    const older: Content = { ...content, version: "m0.0" };
    const server = testServer({ contents: { current: older, previous: null } });
    await catchUp(server.deps, 2);
    const kept = await server.deps.stores.world.tick(2);
    const deployed = { ...server.deps, contents: { current: content, previous: older } };
    expect(await catchUp(deployed, 3)).toEqual([3]);
    expect(await server.deps.stores.world.tick(2)).toEqual(kept);
    const next = await server.deps.stores.world.tick(3);
    expect(next?.content).toBe(content.version);
    expect(next).toEqual(await makeTick(deployed, kept));
  });

  test("[R-CLOCK-010] given the draw is not yet run by this server, when a tick is made, then its world carries no lottery", async () => {
    const server = testServer();
    expect((await makeTick(server.deps, null)).world.lottery).toBeNull();
  });
});

describe("the world route", () => {
  test("[R-CLOCK-018] [R-SERVER-015] given stored ticks, when the world is fetched, then it is the current tick's world alone, with no book and no later tick", async () => {
    const server = testServer();
    await catchUp(server.deps, 4);
    server.setNow(epoch + 2 * worldTickMs + 5);
    const reply = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ tick: 2, world: (await server.deps.stores.world.tick(2))?.world, nextTickAt: epoch + 3 * worldTickMs });
    expect(Object.keys(reply.body).sort()).toEqual(["nextTickAt", "tick", "world"]);
    expect(reply.text).not.toContain("test-world-seed");
    expect(reply.text).not.toContain('"book"');
    expect(reply.text).not.toContain('"erasRun"');
  });

  test("[R-CLOCK-019] given the start of a tick and its last ms, when the world is fetched, then it is cached publicly until the next tick", async () => {
    const server = testServer();
    const start = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(start.headers.get("cache-control")).toBe(`public, max-age=${String(12 * 60 * 60)}`);
    server.setNow(epoch + worldTickMs - 1);
    const last = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(last.headers.get("cache-control")).toBe("public, max-age=1");
  });
});
