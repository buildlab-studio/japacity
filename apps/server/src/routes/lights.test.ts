// The two lights' counts (docs/rules/account.md R-ACCOUNT-031): made from the
// stored totals, public, rounded, kept in the server's cache by the hour.
import { time } from "@japacity/sim";
import type { CounterTotal } from "@japacity/store";
import { afterEach, describe, expect, test, vi } from "vitest";

import { call, testServer } from "../authority/testing";
import { productionConfig, testConfig } from "../config";
import { LIGHTS_COUNTERS, lightsOf, roundToTen } from "../analytics/lights";
import { memoryLimiters } from "../limits/memory";
import type { ServerRejection } from "../types";
import { fakeEdge } from "./edge.testing";
import type { LightsReply } from "./lights";

const { epoch } = productionConfig.clock;

afterEach(() => {
  vi.unstubAllGlobals();
});

const row = (day: string, name: string, count: number, region = "NG", key = region): CounterTotal => ({ day, region, name, key, count });

/** A day's worth of the counters the lights read, and some they never read. */
const TOTALS: CounterTotal[] = [
  row("2026-09-20", LIGHTS_COUNTERS.started, 900),
  row("2026-09-20", LIGHTS_COUNTERS.started, 300, "GB"),
  row("2026-09-21", LIGHTS_COUNTERS.departed, 140),
  row("2026-09-21", LIGHTS_COUNTERS.departed, 26, "GB"),
  row("2026-09-30", LIGHTS_COUNTERS.returned, 9, "NG", "broke"),
  row("2026-10-02", LIGHTS_COUNTERS.returned, 12, "NG", "by-choice"),
  row("2026-10-03", LIGHTS_COUNTERS.returned, 4, "GB", "with-papers"),
  row("2026-10-03", "players/total", 5000),
  row("2026-10-03", "players/active", 700),
];

describe("the counts", () => {
  test("[R-ACCOUNT-031] given the stored totals, then abroad is every departure less every return, home every life started less those abroad, back the returns this month, each the whole game's and rounded to ten only at the end", () => {
    // Started 1200; departed 166; returned 25, of them 16 this month: abroad 141, home 1059.
    expect(lightsOf({ totals: TOTALS, monthFrom: "2026-10-01" })).toEqual({ home: 1060, abroad: 140, back: 20 });
  });

  test("[R-ACCOUNT-031] given counts at the edges of a ten, then a count is rounded to the nearest ten, a half up, and never below zero", () => {
    expect([0, 4, 5, 14, 15, 1059, -3].map(roundToTen)).toEqual([0, 0, 10, 10, 20, 1060, 0]);
  });

  test("[R-ACCOUNT-031] given more returns than departures, then abroad is 0 and home is every life started", () => {
    const totals = [row("2026-10-01", LIGHTS_COUNTERS.started, 30), row("2026-10-01", LIGHTS_COUNTERS.returned, 8, "NG", "removed")];
    expect(lightsOf({ totals, monthFrom: "2026-10-01" })).toEqual({ home: 30, abroad: 0, back: 10 });
  });
});

describe("GET /api/lights", () => {
  test("[R-ACCOUNT-031] [R-SERVER-039] [R-ANALYTICS-012] given the server's cache, when the lights are asked for twice in an hour by different people, then the counters are read once, the key is the hour alone, the reply is public counts only with no cookie, kept until the hour ends; the next hour is read again", async () => {
    const edge = fakeEdge();
    vi.stubGlobal("caches", { default: edge });
    const server = testServer();
    await server.deps.stores.counters.add(TOTALS);
    const reads = vi.spyOn(server.deps.stores.counters, "days");
    const sessions = vi.spyOn(server.deps, "session");
    const hour = Math.floor(epoch / time.HOUR_MS) + 2;
    server.setNow(hour * time.HOUR_MS + 25 * time.MINUTE_MS);

    const first = await call<LightsReply>(server, "GET", "/api/lights", "account-1");
    server.wait(10 * time.MINUTE_MS);
    const second = await call<LightsReply>(server, "GET", "/api/lights", null, undefined, "198.51.100.7");

    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ok: true, home: 1060, abroad: 140, back: 20 });
    expect(second.text).toBe(first.text);
    expect(reads).toHaveBeenCalledTimes(1);
    expect(sessions).not.toHaveBeenCalled();
    expect(first.headers.get("cache-control")).toBe(`public, max-age=${String(35 * 60)}`);
    expect(second.headers.get("cache-control")).toBe(`public, max-age=${String(25 * 60)}`);
    expect(first.headers.get("set-cookie")).toBeNull();
    expect(edge.stored.map((each) => each.key)).toEqual([`http://localhost/api/cache/1/lights/${String(hour)}`]);

    server.setNow((hour + 1) * time.HOUR_MS);
    expect((await call<LightsReply>(server, "GET", "/api/lights", null)).status).toBe(200);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  test("[R-ACCOUNT-031] [R-SERVER-026] given an address at the anonymous limit, when it asks once more, signed in or not, then it is refused 429 before any counter is read, and another address is answered", async () => {
    const config = testConfig({ testing: { testLogin: true }, limits: { anonPer60s: 2 } });
    const server = testServer({ config, now: () => epoch, limits: memoryLimiters(config.limits, () => epoch) });
    const reads = vi.spyOn(server.deps.stores.counters, "days");
    expect((await call(server, "GET", "/api/lights", null, undefined, "198.51.100.1")).status).toBe(200);
    expect((await call(server, "GET", "/api/lights", "account-1", undefined, "198.51.100.1")).status).toBe(200);
    const over = await call<ServerRejection>(server, "GET", "/api/lights", null, undefined, "198.51.100.1");
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ code: "rate-limited", retryAfter: 60 });
    expect(reads).toHaveBeenCalledTimes(2);
    expect((await call(server, "GET", "/api/lights", null, undefined, "198.51.100.2")).status).toBe(200);
  });
});
