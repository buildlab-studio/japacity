import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { countRejection } from "../../ops/rejections";
import { asAccount, testDeps } from "../../app.testing";
import { makeApp } from "../../app";
import { productionConfig, testConfig } from "../../config";
import { TEST_SIGNED_IN_WITH, testSession } from "../../deps";
import { ADMIN_PASSKEY_DETAIL } from "./admin";

const ADMIN = "account.owner";
const ROUTES = ["/api/admin/report?day=1", "/api/admin/alarms", "/api/admin/rejections", "/api/admin/rollback/character.nobody"];

function admin() {
  const config = testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN] } });
  return testDeps({ config, session: testSession(config) });
}

describe("the admin routes", () => {
  test("[server:ledger-alarm-lists-suspects] given a session not in the admin accounts or none at all, when any admin route is fetched, then it answers 404 exactly as a route that does not exist", async () => {
    const app = makeApp(admin());
    const missing = await app.request("/api/admin/nothing-here", asAccount(ADMIN));
    const body = await missing.text();
    expect(missing.status).toBe(404);
    for (const path of ROUTES) {
      for (const account of [null, "account.player"]) {
        const reply = await app.request(path, asAccount(account));
        expect(reply.status).toBe(404);
        expect(await reply.text()).toBe(body);
      }
    }
  });

  test("[server:ledger-alarm-lists-suspects] given the production config with no admin account, when the account an admin would use asks, then the page does not exist", async () => {
    const config = testConfig({ testing: { testLogin: true } });
    const app = makeApp(testDeps({ config, session: testSession(config) }));
    expect(productionConfig.admin.accounts).toEqual([]);
    expect((await app.request("/api/admin/alarms", asAccount(ADMIN))).status).toBe(404);
  });

  test("[server:ledger-alarm-lists-suspects] given an admin account, when each route is fetched, then it answers", async () => {
    const app = makeApp(admin());
    for (const path of ROUTES) expect((await app.request(path, asAccount(ADMIN))).status).toBe(200);
    expect(await (await app.request("/api/admin/alarms", asAccount(ADMIN))).json()).toEqual({ ok: true, alarms: [] });
    expect(await (await app.request("/api/admin/rollback/character.nobody", asAccount(ADMIN))).json()).toEqual({ ok: false, code: "missing", detail: "No character character.nobody." });
  });

  test("[moderation:admin-view-for-admin-list] given an admin whose test session says it was opened by email code, when any admin route of any area is asked, then it is refused as not-legal; the same admin with a passkey session is answered", async () => {
    const app = makeApp(admin());
    const areas = [...ROUTES, "/api/admin/analytics", "/api/admin/adverts/campaigns", "/api/admin/moderation/queue", "/api/admin/switches", "/api/admin/nothing-here"];
    for (const path of areas) {
      const reply = await app.request(path, { headers: { "x-test-account": ADMIN, [TEST_SIGNED_IN_WITH]: "email-code" } });
      expect({ path, status: reply.status, body: await reply.json() }).toEqual({ path, status: 403, body: { ok: false, code: "not-legal", detail: ADMIN_PASSKEY_DETAIL } });
    }
    const posted = await app.request("/api/admin/switches", { method: "POST", headers: { "x-test-account": ADMIN, [TEST_SIGNED_IN_WITH]: "email-code", "content-type": "application/json" }, body: JSON.stringify({ name: "adverts", on: false, reason: "test" }) });
    expect(posted.status).toBe(403);
    for (const path of areas.slice(0, -1)) expect({ path, status: (await app.request(path, { headers: { "x-test-account": ADMIN, [TEST_SIGNED_IN_WITH]: "passkey" } })).status }).toEqual({ path, status: 200 });
  });

  test("[server:daily-money-report] given a day's totals, when the report is fetched, then it is that day's row; with no day it is the day that has just ended; a day that is not a whole number is refused", async () => {
    const deps = admin();
    const today = time.utcDay(deps.now());
    await deps.stores.ledger.addDay(today - 1, { salary: { NGN: 5 } }, { rent: { GBP: 2 } });
    await deps.stores.ledger.addDay(today, { gig: { NGN: 1 } }, {});
    const app = makeApp(deps);

    expect(await (await app.request(`/api/admin/report?day=${String(today)}`, asAccount(ADMIN))).json()).toEqual({ ok: true, report: { day: today, created: { gig: { NGN: 1 } }, destroyed: {} } });
    expect(await (await app.request("/api/admin/report", asAccount(ADMIN))).json()).toEqual({ ok: true, report: { day: today - 1, created: { salary: { NGN: 5 } }, destroyed: { rent: { GBP: 2 } } } });
    expect(time.dayStart(today)).toBeLessThanOrEqual(deps.now());
    for (const bad of ["-1", "1.5", "x", ""]) expect((await app.request(`/api/admin/report?day=${bad}`, asAccount(ADMIN))).status).toBe(400);
  });

  test("[server:rejections-write-nothing] given rejections counted by code, when the admin reads them, then each code shows how many", async () => {
    const app = makeApp(admin());
    const read = async () => (await (await app.request("/api/admin/rejections", asAccount(ADMIN))).json<{ counts: Record<string, number> }>()).counts;
    const before = await read();

    countRejection("stale");
    countRejection("stale");
    countRejection("rate-limited");

    const after = await read();
    expect((after.stale ?? 0) - (before.stale ?? 0)).toBe(2);
    expect((after["rate-limited"] ?? 0) - (before["rate-limited"] ?? 0)).toBe(1);
  });
});
