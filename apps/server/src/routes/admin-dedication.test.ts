// The lights list on the admin page (docs/rules/moderation.md R-MODERATION-021): the lights awaiting a look, oldest
// first, Approve and Refuse, each written to the admin log with the reason `dedication` (R-MODERATION-015).
import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { signUp, type TestServer, testServer } from "../authority/authority.testing";
import { productionConfig, testConfig } from "../config";
import { TEST_SIGNED_IN_WITH } from "../deps";
import { LOG_REASONS, REPORT_REASONS } from "../moderation/reports";
import { adminDedicationRoutes, DEDICATION_PENDING_PATH, type PendingLight } from "./admin-dedication";
import { DEDICATION_LIGHTS_PATH, type DedicationReply } from "./dedication";
import { fakeEdge } from "./cache.testing";

const { epoch } = productionConfig.clock;
const ADMIN = "account.admin";

async function ask<B>(server: { app: { request: (path: string, init: RequestInit) => Response | Promise<Response> } }, method: "GET" | "POST" | "PUT", path: string, account: string | null, body?: unknown, passkey = true): Promise<{ status: number; body: B }> {
  const headers: Record<string, string> = { "cf-connecting-ip": "203.0.113.9", [TEST_SIGNED_IN_WITH]: passkey ? "passkey" : "email" };
  if (account !== null) headers["x-test-account"] = account;
  if (body !== undefined) headers["content-type"] = "application/json";
  const reply = await server.app.request(path, body === undefined ? { method, headers } : { method, headers, body: JSON.stringify(body) });
  const text = await reply.text();
  return { status: reply.status, body: (text === "" || !text.startsWith("{") ? text : JSON.parse(text)) as B };
}

/** A server with an admin, two players who have each lit a light a minute apart, and a third with none. */
async function lit(): Promise<TestServer> {
  const server = testServer({ config: testConfig({ testing: { testLogin: true }, admin: { accounts: [ADMIN] } }) });
  server.setNow(epoch + time.DAY_MS);
  await signUp(server, "account.b", "ngozi_b");
  await signUp(server, "account.a", "tunde_a");
  await signUp(server, "account.c", "chidi_c");
  await ask(server, "PUT", "/api/dedication/light", "account.a", { name: "Mama Nkechi", from: 1951, to: 2024 });
  server.wait(time.MINUTE_MS);
  await ask(server, "PUT", "/api/dedication/light", "account.b", { name: "Uncle Tunde" });
  return server;
}

const pending = (server: TestServer, account = ADMIN) => ask<{ ok: true; lights: PendingLight[] }>(server, "GET", DEDICATION_PENDING_PATH, account);

describe("the lights awaiting a look", () => {
  test("[R-MODERATION-021] given lights lit, when an admin reads the list, then each shows its name, years, the account's username and region and when lit, oldest first", async () => {
    const server = await lit();
    const reply = await pending(server);
    expect(reply.status).toBe(200);
    expect(reply.body.lights).toEqual([
      { account: "account.a", id: reply.body.lights[0]?.id, name: "Mama Nkechi", years: { from: 1951, to: 2024 }, username: "tunde_a", region: "NG", litAt: epoch + time.DAY_MS },
      { account: "account.b", id: reply.body.lights[1]?.id, name: "Uncle Tunde", years: { from: null, to: null }, username: "ngozi_b", region: "NG", litAt: epoch + time.DAY_MS + time.MINUTE_MS },
    ]);
  });

  test("[R-MODERATION-021] [R-SERVER-012] [R-MODERATION-012] given a player, or an admin without a passkey, when the list or a decision is asked for, then it does not exist for the player and is refused for the admin", async () => {
    const server = await lit();
    expect((await pending(server, "account.c")).status).toBe(404);
    expect((await ask(server, "POST", "/api/admin/dedication/account.a/approve", "account.c")).status).toBe(404);
    expect((await ask(server, "POST", "/api/admin/dedication/account.a/refuse", null)).status).toBe(404);
    expect((await ask(server, "GET", DEDICATION_PENDING_PATH, ADMIN, undefined, false)).status).toBe(403);
    expect((await server.deps.stores.dedication.mine("account.a"))?.approvedAt).toBeNull();
  });

  test("[R-MODERATION-021] [R-MODERATION-015] [R-ACCOUNT-033] given a light, when the admin approves it, then the name shows to everyone from the next read, it leaves the list, and the log holds the approval with the reason dedication", async () => {
    const server = await lit();
    const before = await ask<DedicationReply>(server, "GET", DEDICATION_LIGHTS_PATH, "account.c");
    expect(before.body.lights.every((light) => light.name === undefined)).toBe(true);
    const id = (await pending(server)).body.lights[0]?.id ?? "";
    const approved = await ask<{ ok: true; entry: string }>(server, "POST", "/api/admin/dedication/account.a/approve", ADMIN, { note: "a mother's name" });
    expect(approved.status).toBe(200);
    const after = await ask<DedicationReply>(server, "GET", DEDICATION_LIGHTS_PATH, "account.c");
    expect(after.body.lights[0]).toEqual({ id, name: "Mama Nkechi", years: { from: 1951, to: 2024 } });
    expect((await pending(server)).body.lights.map((light) => light.account)).toEqual(["account.b"]);
    const log = await server.deps.stores.moderationLog.list({ account: "account.a" });
    expect(log).toEqual([{ id: approved.body.entry, admin: ADMIN, at: server.deps.now(), item: id, action: "approve-light", params: { account: "account.a" }, reason: "dedication", note: "a mother's name" }]);
  });

  test("[R-MODERATION-021] [R-MODERATION-015] [R-ACCOUNT-033] given a light, when the admin refuses it, then it is put out of the count and the strings, the log holds the refusal, and the account may light again", async () => {
    const server = await lit();
    const id = (await pending(server)).body.lights[1]?.id ?? "";
    const refused = await ask<{ ok: true; entry: string }>(server, "POST", "/api/admin/dedication/account.b/refuse", ADMIN);
    expect(refused.status).toBe(200);
    const seen = await ask<DedicationReply>(server, "GET", DEDICATION_LIGHTS_PATH, "account.b");
    expect(seen.body.count).toBe(1);
    expect(seen.body.mine).toBeUndefined();
    expect(await server.deps.stores.moderationLog.list({ item: id })).toMatchObject([{ action: "refuse-light", reason: "dedication", params: { account: "account.b" }, admin: ADMIN }]);
    expect((await ask(server, "PUT", "/api/dedication/light", "account.b", { name: "Uncle Tunde" })).status).toBe(200);
    expect((await pending(server)).body.lights.map((light) => light.account)).toEqual(["account.a", "account.b"]);
  });

  test("[R-MODERATION-021] given an account with no light, when it is approved or refused, then it is refused unknown-id and nothing is logged", async () => {
    const server = await lit();
    for (const outcome of ["approve", "refuse"]) {
      const reply = await ask<{ code: string }>(server, "POST", `/api/admin/dedication/account.c/${outcome}`, ADMIN);
      expect(reply.status).toBe(404);
      expect(reply.body.code).toBe("unknown-id");
    }
    expect(await server.deps.stores.moderationLog.list({ account: "account.c" })).toEqual([]);
  });

  test("[R-MODERATION-021] [R-SERVER-045] given the shared part kept, when a light is approved or refused, then the kept part is let go", async () => {
    const server = await lit();
    const edge = fakeEdge();
    const routes = { app: adminDedicationRoutes(server.deps, edge) };
    await ask(routes, "POST", "/api/admin/dedication/account.a/approve", ADMIN);
    await ask(routes, "POST", "/api/admin/dedication/account.b/refuse", ADMIN);
    expect(edge.forgotten).toHaveLength(2);
  });

  test("[R-MODERATION-015] [R-MODERATION-021] given the log's reasons, then they are the report reasons and dedication, which no player may report under", () => {
    expect(LOG_REASONS).toEqual([...REPORT_REASONS, "dedication"]);
    expect(REPORT_REASONS).not.toContain("dedication");
  });
});
