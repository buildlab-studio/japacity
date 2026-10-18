import { content } from "@japacity/content";
import type { NumbersLog } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { utcDay } from "../admin/day";
import { testDeps } from "../app.testing";
import { makeApp } from "../app";
import { testConfig } from "../config";
import { testSession } from "../deps";
import { dayName } from "../analytics/day";
import type { StatsReply } from "../analytics/stats.contract";
import { STATS_KEYS } from "../analytics/stats.contract";
import { adminStatsRoutes } from "./admin-stats";

const ADMIN = "account.owner";
const { minShown } = content.tuning.analytics;

/** The command log as the route reads it: everyone online in Nigeria, two in Ghana, and what it was asked. */
function log(asked: [number, number][]): NumbersLog {
  return {
    players: (start, end) => {
      asked.push([start, end]);
      return Promise.resolve([
        { region: "GH", count: 2 },
        { region: "NG", count: minShown + 4 },
      ]);
    },
    accounts: () => Promise.resolve([]),
  };
}

function app(asked: [number, number][] = []) {
  const config = testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN] } });
  const deps = testDeps({ config, session: testSession(config) });
  return { deps, app: makeApp(deps).route("/api/admin", adminStatsRoutes(deps, log(asked))) };
}

const as = (account: string | null): RequestInit => (account === null ? {} : { headers: { "x-test-account": account } });

describe("GET /api/admin/stats", () => {
  test("[R-ANALYTICS-012] [R-MODERATION-012] given a session that is not an admin's, or none, when the numbers are fetched, then they do not exist", async () => {
    const { app: served } = app();
    const missing = await (await served.request("/api/admin/nothing-here", as(ADMIN))).text();
    for (const account of [null, "account.player"]) {
      const reply = await served.request("/api/admin/stats", as(account));
      expect(reply.status).toBe(404);
      expect(await reply.text()).toBe(missing);
    }
  });

  test("[R-ANALYTICS-012] [R-ANALYTICS-013] [R-ANALYTICS-010] given an admin, when the numbers are fetched, then the frozen sections come back, online now is read live over the last five minutes and today so far, and a small region is hidden", async () => {
    const asked: [number, number][] = [];
    const { deps, app: served } = app(asked);
    const today = utcDay(deps.now());
    await deps.stores.counters.add([{ day: dayName(today - 1), region: "NG", name: "players/total", key: "NG", count: 120 }]);

    const reply = await served.request("/api/admin/stats", as(ADMIN));
    expect(reply.status).toBe(200);
    const body = await reply.json<StatsReply>();
    expect(body.ok).toBe(true);
    expect(Object.keys(body.stats)).toEqual([...STATS_KEYS]);
    expect(body.stats.now.online).toEqual({ all: minShown + 6, regions: { GH: { fewerThan: minShown }, NG: minShown + 4 } });
    expect(body.stats.totals.players).toEqual({ all: 120, regions: { NG: 120 } });
    const now = deps.now();
    expect(asked).toEqual(expect.arrayContaining([[now - 5 * 60_000, now + 1], [today * 86_400_000, now + 1]]));
  });
});
