// The public replies in the server's cache (docs/rules/server.md R-SERVER-039,
// clock.md R-CLOCK-019), with a stand-in for `caches.default`.
import { int, time } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { call, testServer } from "../authority/testing";
import type { TestServer } from "../authority/testing";
import { productionConfig } from "../config";
import type { Limiter } from "../deps";
import { openLimiters } from "../deps";
import type { WorldReply } from "../types";
import { catchUp } from "../world/ticks";
import { drawRoute } from "./draw";
import type { DrawReply } from "./draw";
import { edgeKey, throughEdge } from "./edge";
import { brokenEdge, fakeEdge } from "./edge.testing";
import type { FakeEdge } from "./edge.testing";

const { epoch, worldTickMs } = productionConfig.clock;

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A server whose Worker runtime has `edge` (a stand-in for the server's cache) as `caches.default`, with ticks 0 to 3 stored. */
async function behindEdge(edge: FakeEdge | typeof brokenEdge, over: Parameters<typeof testServer>[0] = {}): Promise<TestServer> {
  vi.stubGlobal("caches", { default: edge });
  const server = testServer(over);
  await catchUp(server.deps, 3);
  return server;
}

function maxAgeTo(until: number, now: number): string {
  return `public, max-age=${String(int.divCeil(until - now, time.SECOND_MS))}`;
}

describe("the world through the cache", () => {
  test("[R-CLOCK-019] [R-SERVER-039] given caches.default, when the world is fetched twice in one tick, then the tick is read from the database once and the second reply is the first, for the seconds left; the next tick is read again", async () => {
    const edge = fakeEdge();
    const server = await behindEdge(edge);
    const reads = vi.spyOn(server.deps.stores.world, "tick");
    server.setNow(epoch + worldTickMs + 5);
    const first = await call<WorldReply>(server, "GET", "/api/world", null);
    server.wait(90 * time.SECOND_MS);
    const second = await call<WorldReply>(server, "GET", "/api/world", "account.other", undefined, "198.51.100.7");
    expect(reads).toHaveBeenCalledTimes(1);
    expect(second.status).toBe(200);
    expect(second.text).toBe(first.text);
    expect(second.headers.get("content-type")).toBe(first.headers.get("content-type"));
    expect(first.headers.get("cache-control")).toBe(maxAgeTo(epoch + 2 * worldTickMs, epoch + worldTickMs + 5));
    expect(second.headers.get("cache-control")).toBe(maxAgeTo(epoch + 2 * worldTickMs, epoch + worldTickMs + 5 + 90 * time.SECOND_MS));

    server.setNow(epoch + 2 * worldTickMs);
    const next = await call<WorldReply>(server, "GET", "/api/world", null);
    expect(reads).toHaveBeenCalledTimes(2);
    expect(next.body.tick).toBe(2);
    expect(next.body.world).toEqual((await server.deps.stores.world.tick(2))?.world);
  });

  test("[R-SERVER-039] [R-SERVER-015] given players with different accounts, addresses, cookies and queries, when each fetches the world, then every key is the game's origin and the tick alone, and what is stored is public JSON with no cookie", async () => {
    const edge = fakeEdge();
    const server = await behindEdge(edge);
    server.setNow(epoch + worldTickMs);
    await call<WorldReply>(server, "GET", "/api/world", null);
    await call<WorldReply>(server, "GET", "/api/world", "account.ada", undefined, "198.51.100.1");
    await server.app.request("/api/world?fresh=1", { headers: { cookie: "session=abc", "cf-connecting-ip": "198.51.100.2" } });
    const key = edgeKey("http://localhost", ["world", 1]);
    expect(key).toBe("http://localhost/api/cache/1/world/1");
    expect(edge.asked).toEqual([key, key, key]);
    expect(edge.stored).toHaveLength(1);
    expect(edge.stored[0]?.key).toBe(key);
    const headers = edge.stored[0]?.headers ?? {};
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["cache-control"]).toBe(`public, max-age=${String(worldTickMs / time.SECOND_MS)}`);
    expect(headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(edge.stored)).not.toMatch(/account|198\.51|session|test-world-seed/);
  });

  test("[R-SERVER-039] [R-SERVER-025] given a limit that refuses, when the world is fetched, then it is refused 429 before the cache is asked", async () => {
    const edge = fakeEdge();
    const refuse: Limiter = { limit: () => Promise.resolve({ success: false }) };
    const server = await behindEdge(edge, { limits: { ...openLimiters, anon60s: refuse, reads60s: refuse } });
    expect((await call(server, "GET", "/api/world", null)).status).toBe(429);
    expect((await call(server, "GET", "/api/world", "account.ada")).status).toBe(429);
    expect(edge.asked).toEqual([]);
  });

  test("[R-SERVER-039] given a cache that fails at every call, as behind Cloudflare Access, when the world is fetched, then each reply is made from the database and is the reply made with no cache", async () => {
    const server = await behindEdge(brokenEdge);
    const reads = vi.spyOn(server.deps.stores.world, "tick");
    const first = await call<WorldReply>(server, "GET", "/api/world", null);
    const second = await call<WorldReply>(server, "GET", "/api/world", null);
    vi.unstubAllGlobals();
    const bare = testServer();
    await catchUp(bare.deps, 3);
    const without = await call<WorldReply>(bare, "GET", "/api/world", null);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(reads).toHaveBeenCalledTimes(2);
    expect(second.text).toBe(without.text);
    expect(second.headers.get("cache-control")).toBe(without.headers.get("cache-control"));
  });
});

describe("the draw through the cache", () => {
  async function drawPage(server: TestServer, draw: number): Promise<{ status: number; text: string; headers: Headers }> {
    const reply = await drawRoute(server.deps).request(`/api/draw/${String(draw)}`, { headers: { "cf-connecting-ip": "203.0.113.9" } });
    return { status: reply.status, text: await reply.text(), headers: reply.headers };
  }

  test("[R-SERVER-039] [R-LOTTERY-007] given an open draw, when its page is fetched within the minute, then the draw is read once and the second reply has the seconds left; after the minute it is read again", async () => {
    const edge = fakeEdge();
    const server = await behindEdge(edge);
    await server.deps.stores.world.putDraw({ draw: 1, secret: "s", fingerprint: "f", beaconRound: 1, odds: server.deps.contents.current.tuning.lottery.odds, jackpot: 1 });
    const reads = vi.spyOn(server.deps.stores.world, "draw");
    const first = await drawPage(server, 1);
    server.wait(20 * time.SECOND_MS);
    const second = await drawPage(server, 1);
    expect(reads).toHaveBeenCalledTimes(1);
    expect(second.text).toBe(first.text);
    expect((JSON.parse(second.text) as DrawReply).fingerprint).toBe("f");
    expect(first.headers.get("cache-control")).toBe("public, max-age=60");
    expect(second.headers.get("cache-control")).toBe("public, max-age=40");
    expect(edge.asked[0]).toBe(edgeKey("http://localhost", ["draw", 1]));

    server.wait(40 * time.SECOND_MS);
    await drawPage(server, 1);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  test("[R-SERVER-039] given no such draw, when its page is fetched twice, then each is 404 from the database and nothing is stored", async () => {
    const edge = fakeEdge();
    const server = await behindEdge(edge);
    const reads = vi.spyOn(server.deps.stores.world, "draw");
    expect((await drawPage(server, 9)).status).toBe(404);
    expect((await drawPage(server, 9)).status).toBe(404);
    expect(reads).toHaveBeenCalledTimes(2);
    expect(edge.stored).toEqual([]);
  });
});

describe("the cache itself", () => {
  test("[R-SERVER-039] given a stored reply whose moment has passed, when it is asked for, then it is made again and stored again, even if the cache still holds it", async () => {
    const edge = fakeEdge();
    let made = 0;
    const make = () => {
      made += 1;
      return Promise.resolve({ body: `{"n":${String(made)}}`, type: "application/json", freshUntil: made * 10 * time.SECOND_MS });
    };
    const key = edgeKey("https://japacity.app", ["test", 1]);
    expect((await throughEdge(edge, key, 0, make)).maxAge).toBe(10);
    expect(await throughEdge(edge, key, 9 * time.SECOND_MS + 1, make)).toMatchObject({ maxAge: 1 });
    expect(made).toBe(1);
    expect(await throughEdge(edge, key, 10 * time.SECOND_MS, make)).toMatchObject({ body: '{"n":2}', maxAge: 10 });
    expect(made).toBe(2);
    expect(edge.stored.map((each) => each.key)).toEqual([key, key]);
    expect(await throughEdge(edge, key, 15 * time.SECOND_MS, make)).toMatchObject({ maxAge: 5 });
    expect(made).toBe(2);
  });

  test("[R-SERVER-039] given no cache, as in Node and the browser tests, when a reply is asked for, then it is made every time", async () => {
    let made = 0;
    const make = () => Promise.resolve({ body: String((made += 1)), type: "text/plain", freshUntil: 60 * time.SECOND_MS });
    await throughEdge(null, "https://japacity.app/x", 0, make);
    await throughEdge(null, "https://japacity.app/x", 0, make);
    expect(made).toBe(2);
  });
});
