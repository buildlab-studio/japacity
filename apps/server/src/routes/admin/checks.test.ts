import { CHECK_NAMES } from "@japacity/api";
import { describe, expect, test } from "vitest";

import { asAccount, testDeps } from "../../app.testing";
import { makeApp } from "../../app";
import { testConfig } from "../../config";
import { testSession } from "../../dependencies";
import { noteDiverged } from "../../ops/alarm";
import { evaluateChecks } from "../../ops/checks";
import { memoryReportQueue } from "../../moderation/reports";

const ADMIN = "account.owner";

function admin() {
  const config = testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN] } });
  return testDeps({ config, session: testSession(config) });
}

const post = (account: string | null, body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body), headers: { ...(account === null ? {} : { "x-test-account": account }), "content-type": "application/json" } });

describe("the check routes", () => {
  test("[admin:checks-have-three-states] given an admin, when the checks are fetched, then every check answers with its state, value, limit, since, what it found and its history; to anyone else the route does not exist", async () => {
    const deps = admin();
    const app = makeApp(deps);
    const reply = await app.request("/api/admin/checks", asAccount(ADMIN));
    expect(reply.status).toBe(200);
    const body = await reply.json<{ ok: true; checks: { check: string; state: string; value: number | null; limit: number; since: number | null; found: unknown; history: unknown[] }[] }>();
    expect(body.checks.map((check) => check.check)).toEqual([...CHECK_NAMES]);
    for (const check of body.checks) expect(check).toMatchObject({ state: "no-data", limit: 0, since: null, history: [] });
    for (const account of [null, "account.player"]) expect((await app.request("/api/admin/checks", asAccount(account))).status).toBe(404);
  });

  test("[admin:check-handled-with-reason] given a check in alarm, when the admin handles it with a reason, then it answers OK with the admin and the reason in its history; without a reason, with an unknown check, or when it is not in alarm, it is refused", async () => {
    const deps = admin();
    const app = makeApp(deps);
    await noteDiverged(deps, "character.a", 2);
    await evaluateChecks(deps, { reports: memoryReportQueue({}) }, null);

    expect((await app.request("/api/admin/checks/diverged-lives/handle", post(ADMIN, { reason: "  " }))).status).toBe(400);
    expect((await app.request("/api/admin/checks/nothing/handle", post(ADMIN, { reason: "Looked." }))).status).toBe(400);
    expect((await app.request("/api/admin/checks/money-suspects/handle", post(ADMIN, { reason: "Looked." }))).status).toBe(409);

    const reply = await app.request("/api/admin/checks/diverged-lives/handle", post(ADMIN, { reason: "Replayed and rolled back." }));
    expect(reply.status).toBe(200);
    expect(await reply.json()).toMatchObject({ ok: true, checks: [{ check: "diverged-lives", state: "ok", history: [{ state: "ok", admin: ADMIN, reason: "Replayed and rolled back." }, { state: "alarm" }] }] });
    expect((await app.request("/api/admin/checks/diverged-lives/handle", post(null, { reason: "Looked." }))).status).toBe(404);
  });
});
