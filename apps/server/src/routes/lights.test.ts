// The two lights' counts (docs/rules/account.md R-ACCOUNT-031): made from the
// stored totals, public, rounded, kept in the server's cache by the hour. Home
// and abroad are the lives being played as the nightly count last found them,
// and before its first run the lives started and the departures.
import { newState, time } from "@japacity/sim";
import type { CounterTotal } from "@japacity/store";
import { afterEach, describe, expect, test, vi } from "vitest";

import { call, testServer } from "../authority/authority.testing";
import { productionConfig, testConfig } from "../config";
import { LIGHTS_COUNTERS, LIVES_PLAYING, lightsOf, livesPlaying, roundToTen } from "../analytics/lights";
import { livesJob } from "../jobs/lives";
import { memoryLimiters } from "../limits/memory";
import type { ServerRejection } from "../types";
import { fakeEdge } from "./cache.testing";
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

/** The nightly count of lives on two days: the whole game's rows under `all`, and the regions' rows the lights never read. */
const PLAYING: CounterTotal[] = [
  row("2026-10-01", LIVES_PLAYING, 700, "all", "home"),
  row("2026-10-01", LIVES_PLAYING, 90, "all", "abroad"),
  row("2026-10-01", LIVES_PLAYING, 0, "all", "road"),
  row("2026-10-02", LIVES_PLAYING, 606, "NG", "home"),
  row("2026-10-02", LIVES_PLAYING, 606, "all", "home"),
  row("2026-10-02", LIVES_PLAYING, 3, "all", "road"),
  row("2026-10-02", LIVES_PLAYING, 84, "GB", "abroad"),
  row("2026-10-02", LIVES_PLAYING, 84, "all", "abroad"),
];

describe("the counts", () => {
  test("[R-ACCOUNT-031] given the nightly count of lives has run, then home and abroad are the lives being played on its last day, the whole game's rows alone, a life on the road at home; back is still the returns this month", () => {
    // Home 606 and 3 on the road, abroad 84; returned this month 16, as before.
    expect(livesPlaying([...TOTALS, ...PLAYING])).toEqual({ home: 609, abroad: 84 });
    expect(lightsOf({ totals: [...TOTALS, ...PLAYING], monthFrom: "2026-10-01" })).toEqual({ home: 610, abroad: 80, back: 20 });
  });

  test("[R-ACCOUNT-031] given the nightly count found no life, then home and abroad are 0, not the lives ever started", () => {
    const none = [row("2026-10-03", LIVES_PLAYING, 0, "all", "home"), row("2026-10-03", LIVES_PLAYING, 0, "all", "abroad"), row("2026-10-03", LIVES_PLAYING, 0, "all", "road")];
    expect(lightsOf({ totals: [...TOTALS, ...none], monthFrom: "2026-10-01" })).toEqual({ home: 0, abroad: 0, back: 20 });
  });

  test("[R-ACCOUNT-031] given the stored totals before the nightly count of lives has ever run, then abroad is every departure less every return, home every life started less those abroad, back the returns this month, each the whole game's and rounded to ten only at the end", () => {
    // Started 1200; departed 166; returned 25, of them 16 this month: abroad 141, home 1059.
    expect(livesPlaying(TOTALS)).toBeNull();
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

  test("[R-ACCOUNT-031] [R-ANALYTICS-012] given the route before the nightly count of lives and after its first run at 00:00, when the lights are asked for in each hour, then the reply falls back to the lives started until the count has run, then holds the lives being played, rounded to ten, in the same shape", async () => {
    vi.stubGlobal("caches", { default: fakeEdge() });
    const server = testServer();
    await server.deps.stores.counters.add(TOTALS);
    // Fifteen lives at home and six abroad.
    for (let at = 0; at < 21; at += 1) {
      const account = `account.${String(at)}`;
      const character = `character-${String(at)}`;
      await server.deps.stores.account.create({
        id: account,
        country: "NG",
        age: { passed: true, at: epoch, method: "declared" },
        createdAt: epoch,
        character: null,
        notifyBankFull: false,
        sendUsageCounts: true,
        state: "secured",
        username: account,
        usernameChangedAt: null,
        lastPlayedAt: epoch,
      });
      const fresh = newState("scenario.ada", `seed-${character}`, server.deps.contents.current);
      const state = at < 15 ? fresh : { ...fresh, place: { ...fresh.place, where: "abroad" as const, country: "country.uk" as const } };
      await server.deps.stores.player.create({ id: character, account, refilledAt: epoch, content: server.deps.contents.current.version, start: { base: state }, state });
      await server.deps.stores.account.setCharacter(account, character);
    }
    const day = Math.floor(epoch / time.DAY_MS) + 3;
    server.setNow(day * time.DAY_MS + 30 * time.MINUTE_MS);

    const before = await call<LightsReply>(server, "GET", "/api/lights", null);
    server.setNow((day + 1) * time.DAY_MS);
    await livesJob(server.deps);
    const after = await call<LightsReply>(server, "GET", "/api/lights", null);

    // Until the count has run, the lives started less the departures; then the 15 and 6 lives being played, rounded to ten. Back is this month's 16 returns either way.
    expect(before.body).toEqual({ ok: true, home: 1060, abroad: 140, back: 20 });
    expect(after.body).toEqual({ ok: true, home: 20, abroad: 10, back: 20 });
    expect(Object.keys(after.body).sort()).toEqual(Object.keys(before.body).sort());
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
