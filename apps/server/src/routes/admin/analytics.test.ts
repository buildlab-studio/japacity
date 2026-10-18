import type { Dashboard } from "@japacity/api";
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { utcDay } from "../../ops/day";
import { asAccount as as, testDeps } from "../../app.testing";
import { makeApp } from "../../app";
import { testConfig } from "../../config";
import { testSession } from "../../deps";
import { dayName } from "../../analytics/day";

const ADMIN = "account.owner";
const { minShown } = content.tuning.analytics;

function admin() {
  const config = testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN] } });
  return testDeps({ config, session: testSession(config) });
}

describe("GET /api/admin/analytics", () => {
  test("[R-ANALYTICS-009] [R-SERVER-012] given a session that is not an admin's, or none, when the dashboard is fetched, then it does not exist", async () => {
    const app = makeApp(admin());
    const missing = await (await app.request("/api/admin/nothing-here", as(ADMIN))).text();
    for (const account of [null, "account.player"]) {
      const reply = await app.request("/api/admin/analytics", as(account));
      expect(reply.status).toBe(404);
      expect(await reply.text()).toBe(missing);
    }
  });

  test("[R-ANALYTICS-009] [R-ANALYTICS-010] given stored totals, when an admin fetches a day, then the window ends on that day and a key under the smallest number is hidden", async () => {
    const deps = admin();
    const today = utcDay(deps.now());
    await deps.stores.counters.add([
      { day: dayName(today), region: "NG", name: "screen/opened", key: "wallet", count: minShown - 1 },
      { day: dayName(today), region: "NG", name: "screen/opened", key: "route", count: minShown + 5 },
      { day: dayName(today + 1), region: "NG", name: "screen/opened", key: "route", count: 99 },
    ]);
    const app = makeApp(deps);

    const reply = await app.request(`/api/admin/analytics?day=${dayName(today)}`, as(ADMIN));
    expect(reply.status).toBe(200);
    const { dashboard } = await reply.json<{ ok: true; dashboard: Dashboard }>();
    expect(dashboard.day).toBe(dayName(today));
    expect(dashboard.counters.map((row) => [row.key, row.count])).toEqual([
      ["route", minShown + 5],
      ["wallet", { fewerThan: minShown }],
    ]);

    const fallback = await (await app.request("/api/admin/analytics", as(ADMIN))).json<{ dashboard: Dashboard }>();
    expect(fallback.dashboard.day).toBe(dayName(today));
    for (const bad of ["2026-13-01", "2026-02-30", "yesterday", "", "20261010"]) expect((await app.request(`/api/admin/analytics?day=${bad}`, as(ADMIN))).status).toBe(400);
  });
});
