import type { ServerRejection } from "@japacity/api";
import { describe, expect, test } from "vitest";

import { call, held, newLife, restMonth, send, testServer, view } from "../authority/authority.testing";
import { productionConfig, testConfig } from "../config";
import type { ServerConfig } from "../config";
import type { Limiter } from "../deps";
import { memoryLimiter, memoryLimiters } from "./memory";

const { epoch } = productionConfig.clock;

/** A test server that counts its limits in memory against its own clock. */
function limitedServer(limits: Partial<ServerConfig["limits"]>) {
  const config = testConfig({ testing: { testLogin: true }, limits });
  let now = epoch;
  const server = testServer({ config, now: () => now, limits: memoryLimiters(config.limits, () => now) });
  return { ...server, wait: (ms: number) => (now += ms) };
}

describe("the counting limiter", () => {
  test("[server:limits-are-approximate] given a limit of 2 in 10 s, when one key calls three times and another once, then only the first key's third call is refused, and the window opens again after 10 s", async () => {
    let now = epoch;
    const limiter: Limiter = memoryLimiter(2, 10_000, () => now);
    const calls = [await limiter.limit({ key: "a" }), await limiter.limit({ key: "a" }), await limiter.limit({ key: "a" }), await limiter.limit({ key: "b" })];
    expect(calls.map((each) => each.success)).toEqual([true, true, false, true]);
    now += 9_999;
    expect((await limiter.limit({ key: "a" })).success).toBe(false);
    now += 1;
    expect((await limiter.limit({ key: "a" })).success).toBe(true);
  });
});

describe("the limits over the routes", () => {
  test("[server:per-account-rate-limits] given an account at its 10-second command limit, when it sends one more, then it is answered 429 rate-limited with a retry in 10 seconds and nothing is stepped or logged", async () => {
    const server = limitedServer({ commandsPer10s: 2 });
    const character = await newLife(server, "acc-1");
    const first = await send(server, "acc-1", restMonth({ v: 0 }));
    expect(first.body.ok).toBe(true);
    const before = await held(server, character);
    const over = await send(server, "acc-1", restMonth({ v: 1 }));
    expect(over.status).toBe(429);
    expect(over.body).toEqual({ ok: false, code: "rate-limited", detail: expect.any(String) as string, retryAfter: 10 });
    expect(await held(server, character)).toEqual(before);
    server.wait(10_000);
    expect((await send(server, "acc-1", restMonth({ v: 1 }))).body.ok).toBe(true);
  });

  test("[server:per-account-rate-limits] given an account at its 60-second command limit, when it sends one more, then the retry is 60 seconds", async () => {
    const server = limitedServer({ commandsPer10s: 100, commandsPer60s: 3 });
    await newLife(server, "acc-1");
    for (let v = 0; v < 2; v += 1) expect((await send(server, "acc-1", restMonth({ v }))).body.ok).toBe(true);
    const over = await send(server, "acc-1", restMonth({ v: 2 }));
    expect(over.status).toBe(429);
    expect((over.body as ServerRejection).retryAfter).toBe(60);
  });

  test("[server:per-account-rate-limits] given an account at its read limit, when it fetches the view or the world once more, then both are refused with a retry in 60 seconds while another account still reads", async () => {
    const server = limitedServer({ readsPer60s: 2 });
    await newLife(server, "acc-1");
    await newLife(server, "acc-2");
    expect((await view(server, "acc-1")).status).toBe(200);
    expect((await call(server, "GET", "/api/world", "acc-1")).status).toBe(200);
    const overView = await view(server, "acc-1");
    const overWorld = await call<ServerRejection>(server, "GET", "/api/world", "acc-1");
    expect([overView.status, overWorld.status]).toEqual([429, 429]);
    expect(overWorld.body).toMatchObject({ code: "rate-limited", retryAfter: 60 });
    expect((await view(server, "acc-2")).status).toBe(200);
  });

  test("[server:anonymous-limit-by-address] given requests with no session, when one address passes its limit, then it is refused by its cf-connecting-ip and another address is not", async () => {
    const server = limitedServer({ anonPer60s: 2 });
    const from = (ip: string) => call<ServerRejection>(server, "GET", "/api/world", null, undefined, ip);
    expect([(await from("198.51.100.1")).status, (await from("198.51.100.1")).status]).toEqual([200, 200]);
    const over = await from("198.51.100.1");
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ code: "rate-limited", retryAfter: 60 });
    expect((await from("198.51.100.2")).status).toBe(200);
    const command = await call<ServerRejection>(server, "POST", "/api/command", null, { command: restMonth({ v: 0 }), basedOn: 0 }, "198.51.100.1");
    expect(command.status).toBe(429);
  });
});
