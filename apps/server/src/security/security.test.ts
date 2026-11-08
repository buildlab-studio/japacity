// The Worker's own guards: the headers on every
// reply, writes only from the game's page, bodies and commands of a bounded
// size, and the limits on the routes beyond the command and the view.
import type { ServerRejection } from "@japacity/api";
import { describe, expect, test } from "vitest";

import { harness, makeJar, SITE } from "../auth/auth.testing";
import { call, held, newLife, restMonth, send, signUp, testServer } from "../authority/authority.testing";
import { productionConfig, testConfig } from "../config";
import type { ServerConfig } from "../config";
import { memoryLimiters } from "../limits/memory";
import type { Rooms } from "../place/place.rooms";
import { placeSocketRoutes } from "../routes/place";
import { TOO_LARGE_DETAIL } from "./body";
import { DEFAULT_CACHE, SECURITY_HEADERS } from "./headers";
import { OTHER_SITE_DETAIL, fromElsewhere } from "./origin";

const ELSEWHERE = "https://another.japacity.test";

const { bodyBytes, adminBodyBytes, commandBytes } = productionConfig.limits;

function expectDressed(headers: Headers): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(headers.get(name)).toBe(value);
}

/** A test server whose limits count in memory against its own clock. */
function limitedServer(limits: Partial<ServerConfig["limits"]>) {
  const config = testConfig({ testing: { testLogin: true }, limits });
  const now = productionConfig.clock.epoch;
  return testServer({ config, now: () => now, limits: memoryLimiters(config.limits, () => now) });
}

/** A request through the test server's app with a raw body. */
async function raw(server: ReturnType<typeof testServer>, method: "POST" | "PUT", path: string, account: string | null, body: string, contentType = "application/json"): Promise<Response> {
  const headers: Record<string, string> = { "cf-connecting-ip": "203.0.113.9", "content-type": contentType };
  if (account !== null) headers["x-test-account"] = account;
  return server.app.request(path, { method, headers, body });
}

describe("the headers on every reply", () => {
  test("[server:security-headers-on-replies] given any reply, when it leaves the Worker, then it carries the content policy, nosniff, no framing and no referrer, and is not stored", async () => {
    const server = testServer();
    const health = await server.app.request("/api/health");
    expectDressed(health.headers);
    expect(health.headers.get("cache-control")).toBe(DEFAULT_CACHE);
    const missing = await server.app.request("/api/no-such-route");
    expect(missing.status).toBe(404);
    expectDressed(missing.headers);
  });

  test("[server:security-headers-on-replies] given any reply, when it leaves the Worker, then it asks for https only for two years over the host and its subdomains, and is not marked for the preload list", async () => {
    const server = testServer();
    for (const path of ["/api/health", "/api/no-such-route", "/api/world"]) {
      const reply = await server.app.request(path);
      expect({ path, hsts: reply.headers.get("strict-transport-security") }).toEqual({ path, hsts: "max-age=63072000; includeSubDomains" });
    }
    expect(SECURITY_HEADERS["strict-transport-security"]).not.toContain("preload");
  });

  test("[server:security-headers-on-replies] given a reply that names its own caching, when it leaves the Worker, then that caching is kept and the other headers are added", async () => {
    const server = testServer();
    const world = await call(server, "GET", "/api/world", null);
    expect(world.status).toBe(200);
    expect(world.headers.get("cache-control")).toMatch(/^public, max-age=\d+$/);
    expectDressed(world.headers);
  });

  test("[server:security-headers-on-replies] given a refusal from a limit, when it leaves the Worker, then it is dressed too", async () => {
    const server = limitedServer({ anonPer60s: 0 });
    const over = await call<ServerRejection>(server, "GET", "/api/world", null);
    expect(over.status).toBe(429);
    expectDressed(over.headers);
  });
});

describe("writes only from the game's own page", () => {
  test("[server:same-origin-writes-only] given a write that names another site as its origin, when it reaches the Worker, then it is refused 403 before the route reads it, and nothing is kept", async () => {
    const h = harness();
    const { jar } = await h.signUp("ada@example.test");
    const before = await h.deps.stores.feedback.list(10);
    const reply = await h.call("/api/feedback", { method: "POST", jar, headers: { origin: ELSEWHERE }, json: { text: "hello", build: "1", screen: "city", mode: "low" } });
    expect(reply.status).toBe(403);
    expect(await reply.json()).toEqual({ ok: false, code: "not-legal", detail: OTHER_SITE_DETAIL });
    expect(await h.deps.stores.feedback.list(10)).toEqual(before);
  });

  test("[server:same-origin-writes-only] given the same write from the game's own origin, or from no browser at all, when it reaches the Worker, then the route answers it", async () => {
    const h = harness();
    const { jar } = await h.signUp("ada@example.test");
    const own = await h.call("/api/feedback", { method: "POST", jar, headers: { origin: SITE }, json: { text: "hello", build: "1", screen: "city", mode: "low" } });
    expect(own.status).toBe(200);
    const plain = await h.call("/api/feedback", { method: "POST", jar, json: { text: "again", build: "1", screen: "city", mode: "low" } });
    expect(plain.status).toBe(200);
  });

  test("[server:same-origin-writes-only] given a read from another site, when it reaches the Worker, then it is answered as any read is", async () => {
    const h = harness();
    const reply = await h.call("/api/age", { method: "GET", jar: makeJar(), headers: { origin: ELSEWHERE } });
    expect(reply.status).toBe(200);
  });

  test("[server:same-origin-writes-only] given the origin headers a browser sends, when they are judged, then only another origin, or no origin with a cross-site fetch, is from elsewhere", () => {
    const site = new URL(SITE).origin;
    expect(fromElsewhere(site, new Headers({ origin: SITE }))).toBe(false);
    expect(fromElsewhere(site, new Headers({ origin: ELSEWHERE }))).toBe(true);
    expect(fromElsewhere(site, new Headers({ origin: "null" }))).toBe(true);
    expect(fromElsewhere(site, new Headers({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(fromElsewhere(site, new Headers({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(fromElsewhere(site, new Headers())).toBe(false);
  });
});

describe("bodies and commands of a bounded size", () => {
  test("[server:body-size-limits] given a body over the player limit, when it is sent to the command route, then it is refused 413 and nothing is stepped or logged", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    const before = await held(server, character);
    const reply = await raw(server, "POST", "/api/command", "acc-1", JSON.stringify({ basedOn: 0, command: { type: "turn/end", slots: [], pad: "x".repeat(bodyBytes) } }));
    expect(reply.status).toBe(413);
    expect(await reply.json()).toEqual({ ok: false, code: "not-legal", detail: TOO_LARGE_DETAIL });
    expect(await held(server, character)).toEqual(before);
  });

  test("[server:body-size-limits] given a beacon over the player limit, when it is sent to the counters, then the answer is still 204", async () => {
    const server = testServer();
    await signUp(server, "acc-1");
    const reply = await raw(server, "POST", "/api/counters", "acc-1", "x".repeat(bodyBytes + 1), "text/plain");
    expect(reply.status).toBe(204);
  });

  test("[server:body-size-limits] given an admin route, when a body over the player limit is sent, then it reaches the admin gate rather than the size refusal", async () => {
    const server = testServer();
    await signUp(server, "acc-1");
    const reply = await raw(server, "POST", "/api/admin/adverts/advertisers", "acc-1", JSON.stringify({ pad: "x".repeat(bodyBytes) }));
    expect(reply.status).toBe(404);
  });

  test("[server:body-size-limits] given bodies of exactly the player limit and one byte over, when each is sent to the command route, then the first reaches the route and the second is refused 413", async () => {
    const server = testServer();
    await newLife(server, "acc-1");
    const at = await raw(server, "POST", "/api/command", "acc-1", "x".repeat(bodyBytes));
    expect(at.status).toBe(400);
    const over = await raw(server, "POST", "/api/command", "acc-1", "x".repeat(bodyBytes + 1));
    expect(over.status).toBe(413);
  });

  test("[server:body-size-limits] given bodies of exactly the admin limit and one byte over, when each is sent to an admin route, then the first reaches the admin gate and the second is refused 413", async () => {
    const server = testServer();
    await signUp(server, "acc-1");
    const at = await raw(server, "POST", "/api/admin/adverts/advertisers", "acc-1", "x".repeat(adminBodyBytes));
    expect(at.status).toBe(404);
    const over = await raw(server, "POST", "/api/admin/adverts/advertisers", "acc-1", "x".repeat(adminBodyBytes + 1));
    expect(over.status).toBe(413);
    expect(await over.json()).toEqual({ ok: false, code: "not-legal", detail: TOO_LARGE_DETAIL });
  });

  test("[server:command-size-limit] given a command whose JSON is over the logged limit, when it is sent, then it is refused not-legal and nothing is logged, while the same month without the padding is played", async () => {
    const server = testServer();
    const character = await newLife(server, "acc-1");
    const before = await held(server, character);
    const padded = { ...restMonth({ v: 0 }), note: "x".repeat(commandBytes) };
    const refused = await call<ServerRejection>(server, "POST", "/api/command", "acc-1", { command: padded, basedOn: 0 });
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe("not-legal");
    expect(await held(server, character)).toEqual(before);
    expect((await send(server, "acc-1", restMonth({ v: 0 }))).body.ok).toBe(true);
  });
});

describe("the limits on the other routes", () => {
  test("[server:per-account-rate-limits] given an account at its read limit, when it asks for a place's people, its standing or a socket, then each is answered 429 with a retry in 60 seconds", async () => {
    const server = limitedServer({ readsPer60s: 0 });
    // The socket route is mounted by index.ts with the place objects; nothing past the limit is reached here.
    server.app.route("/", placeSocketRoutes(server.deps, { rooms: {} as Rooms, placeOf: () => Promise.resolve(null), profileOf: () => Promise.resolve(null) }));
    await newLife(server, "acc-1");
    for (const path of ["/api/place/place.family-house", "/api/moderation/standing", "/api/place/place.family-house/socket"]) {
      const over = await call<ServerRejection>(server, "GET", path, "acc-1");
      expect({ path, status: over.status }).toEqual({ path, status: 429 });
      expect(over.body).toMatchObject({ code: "rate-limited", retryAfter: 60 });
    }
  });

  test("[server:per-account-rate-limits] given an account at its command limit, when it sends feedback or an appeal, then each is answered 429 and nothing is kept", async () => {
    const server = limitedServer({ commandsPer10s: 0 });
    await signUp(server, "acc-1");
    const feedback = await call<ServerRejection>(server, "POST", "/api/feedback", "acc-1", { text: "hello", build: "1", screen: "city", mode: "low" });
    const appeal = await call<ServerRejection>(server, "POST", "/api/moderation/appeal", "acc-1", { action: "entry-1" });
    expect([feedback.status, appeal.status]).toEqual([429, 429]);
    expect(feedback.body).toMatchObject({ code: "rate-limited", retryAfter: 10 });
    expect(await server.deps.stores.feedback.list(10)).toEqual([]);
  });

  test("[server:anonymous-limit-by-address] given an address at its limit, when it sends the age screen with no session, then it is refused by its address before the date or the bot check is read", async () => {
    const config = testConfig({ testing: { captureOtp: true }, limits: { anonPer60s: 1 } });
    const now = productionConfig.clock.epoch;
    const h = harness({ config, limits: memoryLimiters(config.limits, () => now) });
    const first = await h.call("/api/age", { method: "GET", jar: makeJar(), ip: "198.51.100.4" });
    expect(first.status).toBe(200);
    const over = await h.call("/api/age", { method: "POST", jar: makeJar(), ip: "198.51.100.4", json: { dateOfBirth: "not a date" } });
    expect(over.status).toBe(429);
    expect(await over.json()).toMatchObject({ code: "rate-limited", retryAfter: 60 });
  });

  test("[server:per-account-rate-limits] given a signed-in account at its read limit, when it reads its own account, then it is answered 429", async () => {
    const config = testConfig({ testing: { captureOtp: true }, limits: { readsPer60s: 0 } });
    const now = productionConfig.clock.epoch;
    const h = harness({ config, limits: memoryLimiters(config.limits, () => now) });
    const { jar } = await h.signUp("ada@example.test");
    const over = await h.call("/api/account", { method: "GET", jar });
    expect(over.status).toBe(429);
  });
});
