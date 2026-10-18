// The dedication's routes (server:dedication-routes; account:name-a-light-for-yours): the lights everyone sees with
// the asker's own beside them, lighting one, putting it out, and the shared check's refusals.
import type { DedicationReply, ServerRejection } from "@japacity/api";
import { LIGHT_PROBLEMS, type LightProblem } from "@japacity/content";
import { time } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { signUp, type TestServer, testServer } from "../authority/authority.testing";
import { productionConfig, testConfig } from "../config";
import { memoryLimiters } from "../limits/memory";
import { type BadLight, DEDICATION_KEPT_MS, DEDICATION_LIGHT_PATH, DEDICATION_LIGHTS_PATH, DEDICATION_MOST, dedicationRoutes, serverYear } from "./dedication";
import { fakeEdge } from "./cache.testing";

const { epoch } = productionConfig.clock;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

interface Answer<B> {
  status: number;
  body: B;
  headers: Headers;
}

async function ask<B>(server: TestServer, method: "GET" | "PUT" | "DELETE", path: string, account: string | null, body?: unknown, ip = "203.0.113.9"): Promise<Answer<B>> {
  const headers: Record<string, string> = { "cf-connecting-ip": ip };
  if (account !== null) headers["x-test-account"] = account;
  if (body !== undefined) headers["content-type"] = "application/json";
  const reply = await server.app.request(path, body === undefined ? { method, headers } : { method, headers, body: typeof body === "string" ? body : JSON.stringify(body) });
  return { status: reply.status, body: (await reply.json()) as B, headers: reply.headers };
}

const lights = (server: TestServer, account: string | null) => ask<DedicationReply>(server, "GET", DEDICATION_LIGHTS_PATH, account);
const light = (server: TestServer, account: string | null, body: unknown) => ask<DedicationReply | BadLight | ServerRejection>(server, "PUT", DEDICATION_LIGHT_PATH, account, body);
const putOut = (server: TestServer, account: string | null) => ask<{ ok: boolean }>(server, "DELETE", DEDICATION_LIGHT_PATH, account);

/** A server at a known moment, with these accounts signed up (the first secured, the rest as asked). */
async function serverWith(...accounts: string[]): Promise<TestServer> {
  const server = testServer();
  server.setNow(epoch + time.DAY_MS);
  for (const account of accounts) await signUp(server, account, account.replace(/\W/gu, "_"), account.includes("guest") ? "guest" : "secured");
  return server;
}

describe("GET /api/dedication/lights", () => {
  test("[server:dedication-routes] given no light at all, when anyone asks, then the reply is a count of none and no lights, with no mine", async () => {
    const server = await serverWith("account.a");
    expect((await lights(server, null)).body).toEqual({ ok: true, count: 0, lights: [] });
    expect((await lights(server, "account.a")).body).toEqual({ ok: true, count: 0, lights: [] });
  });

  test("[server:dedication-routes] [account:name-a-light-for-yours] given lights, then each is an opaque id that is never the account's, the name and years only once approved, and mine the asker's own in full", async () => {
    const server = await serverWith("account.a", "account.b");
    await light(server, "account.a", { name: "Mama Nkechi", from: 1951, to: 2024 });
    server.wait(1_000);
    await light(server, "account.b", { name: "Uncle Tunde" });
    const seenByB = (await lights(server, "account.b")).body;
    expect(seenByB.count).toBe(2);
    for (const each of seenByB.lights) {
      expect(Object.keys(each)).toEqual(["id"]);
      expect(each.id).not.toContain("account");
    }
    expect(seenByB.mine).toEqual({ id: seenByB.lights[0]?.id, name: "Uncle Tunde", years: { from: null, to: null }, approved: false });

    await server.deps.stores.dedication.approve("account.a", "account.admin", server.deps.now());
    const after = (await lights(server, "account.b")).body;
    expect(after.lights[0]).toEqual({ id: after.lights[0]?.id, name: "Mama Nkechi", years: { from: 1951, to: 2024 } });
    expect(after.lights[0]?.id).toMatch(/^light\./u);
    expect(after.lights[1]).toEqual({ id: seenByB.mine?.id });
    const mine = (await lights(server, "account.a")).body.mine;
    expect(mine).toEqual({ id: after.lights[0]?.id, name: "Mama Nkechi", years: { from: 1951, to: 2024 }, approved: true });
  });

  test("[server:dedication-routes] given an approved light with no years, then it carries its name and no years", async () => {
    const server = await serverWith("account.a");
    await light(server, "account.a", { name: "Mama Nkechi" });
    await server.deps.stores.dedication.approve("account.a", "account.admin", server.deps.now());
    const [only] = (await lights(server, null)).body.lights;
    expect(only).toEqual({ id: only?.id, name: "Mama Nkechi" });
  });

  test("[server:dedication-routes] given more lights than the cap, then at most 240 are listed, the approved first newest first, then the rest newest first, and the count is the true number", async () => {
    const server = await serverWith();
    const { dedication } = server.deps.stores;
    for (let at = 0; at < DEDICATION_MOST + 5; at += 1) await dedication.light({ account: `account.${String(at)}`, id: `light.${String(at).padStart(3, "0")}`, name: `Light ${String(at)}`, from: null, to: null, litAt: epoch + at });
    await dedication.approve("account.3", "account.admin", epoch);
    await dedication.approve("account.7", "account.admin", epoch);
    const reply = (await lights(server, null)).body;
    expect(DEDICATION_MOST).toBe(240);
    expect(reply.count).toBe(245);
    expect(reply.lights).toHaveLength(240);
    expect(reply.lights.slice(0, 4).map((each) => each.name ?? each.id)).toEqual(["Light 7", "Light 3", "light.244", "light.243"]);
    // The oldest unapproved fall off the end of the list, never out of the count.
    expect(reply.lights.at(-1)?.id).toBe("light.006");
  });

  test("[server:dedication-routes] given 240 lights and then 241, then 240 are listed each time and the count follows", async () => {
    const server = await serverWith();
    for (let at = 0; at < DEDICATION_MOST; at += 1) await server.deps.stores.dedication.light({ account: `account.${String(at)}`, id: `light.${String(at)}`, name: "A", from: null, to: null, litAt: epoch + at });
    expect((await lights(server, null)).body).toMatchObject({ count: 240 });
    expect((await lights(server, null)).body.lights).toHaveLength(240);
    await server.deps.stores.dedication.light({ account: "account.last", id: "light.last", name: "A", from: null, to: null, litAt: epoch + 999 });
    const reply = (await lights(server, null)).body;
    expect(reply.count).toBe(241);
    expect(reply.lights).toHaveLength(240);
  });

  test("[server:dedication-routes] [server:public-replies-cached] given the server's cache, when the lights are asked for twice in a window by different people, then the store's list is read once, the key names nothing of the asker, mine is read fresh each time, and nothing is kept by the browser", async () => {
    const edge = fakeEdge();
    const server = await serverWith("account.a", "account.b");
    const app = dedicationRoutes(server.deps, edge);
    const via = { ...server, app } as unknown as TestServer;
    await light(via, "account.a", { name: "Mama Nkechi" });
    const reads = vi.spyOn(server.deps.stores.dedication, "shared");
    const mines = vi.spyOn(server.deps.stores.dedication, "mine");
    const window = Math.floor(server.deps.now() / DEDICATION_KEPT_MS);

    const first = await lights(via, "account.a");
    server.wait(60_000);
    const second = await lights(via, "account.b");
    const third = await lights(via, null);
    expect(reads).toHaveBeenCalledTimes(1);
    expect(mines).toHaveBeenCalledTimes(2);
    expect(first.body.mine?.name).toBe("Mama Nkechi");
    expect(second.body.mine).toBeUndefined();
    expect(third.body).toEqual({ ok: true, count: 1, lights: [{ id: first.body.mine?.id }] });
    expect(edge.stored.map((each) => each.key)).toEqual([`http://localhost/api/cache/1/dedication/${String(window)}`]);
    for (const reply of [first, second, third]) expect(reply.headers.get("cache-control")).toBe("private, no-store");

    // Five minutes on, a new window is read again.
    server.setNow((window + 1) * DEDICATION_KEPT_MS);
    await lights(via, null);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  test("[server:dedication-routes] [account:name-a-light-for-yours] given the shared part kept, when a light is lit or put out, then the kept part is let go and every other account sees the change at once", async () => {
    const edge = fakeEdge();
    const server = await serverWith("account.a", "account.b");
    const via = { ...server, app: dedicationRoutes(server.deps, edge) } as unknown as TestServer;
    expect((await lights(via, "account.b")).body.count).toBe(0);
    await light(via, "account.a", { name: "Mama Nkechi" });
    expect(edge.forgotten).toHaveLength(1);
    expect((await lights(via, "account.b")).body.count).toBe(1);
    await putOut(via, "account.a");
    expect(edge.forgotten).toHaveLength(2);
    expect((await lights(via, "account.b")).body.count).toBe(0);
  });

  test("[server:dedication-routes] [server:anonymous-limit-by-address] given an address at the anonymous limit, when it asks with no session, then it is refused 429 before anything is read", async () => {
    const config = testConfig({ testing: { testLogin: true }, limits: { anonPer60s: 1 } });
    const server = testServer({ config, now: () => epoch, limits: memoryLimiters(config.limits, () => epoch) });
    const reads = vi.spyOn(server.deps.stores.dedication, "shared");
    expect((await lights(server, null)).status).toBe(200);
    expect((await lights(server, null)).status).toBe(429);
    expect(reads).toHaveBeenCalledTimes(1);
  });
});

describe("PUT and DELETE /api/dedication/light", () => {
  test("[server:dedication-routes] [account:name-a-light-for-yours] given a signed-in account, when it lights a light, then the reply is its own light in full and the light is kept with the account", async () => {
    const server = await serverWith("account.a");
    const reply = await light(server, "account.a", { name: "  Mama   Nkechi ", from: 1951, to: 2024 });
    expect(reply.status).toBe(200);
    const id = (reply.body as DedicationReply).mine?.id;
    expect(id).toMatch(/^light\./u);
    expect(reply.body).toEqual({ ok: true, mine: { id, name: "Mama Nkechi", years: { from: 1951, to: 2024 }, approved: false } });
    expect(reply.headers.get("cache-control")).toBe("private, no-store");
    expect(await server.deps.stores.dedication.mine("account.a")).toMatchObject({ name: "Mama Nkechi", from: 1951, to: 2024, litAt: server.deps.now(), approvedAt: null });
  });

  test("[server:dedication-routes] [account:social-needs-secured-account] [account:name-a-light-for-yours] given a guest, when it lights a light, then it is taken: a guest's session will do; secured, the account keeps its light", async () => {
    const server = await serverWith("account.guest");
    expect((await light(server, "account.guest", { name: "Mama Nkechi" })).status).toBe(200);
    expect((await server.deps.stores.account.secure("account.guest")).ok).toBe(true);
    expect((await lights(server, "account.guest")).body.mine?.name).toBe("Mama Nkechi");
  });

  test("[server:dedication-routes] [account:name-a-light-for-yours] given an approved light, when the account lights again, then the new one replaces it, one per account, with a new id and its approval cleared", async () => {
    const server = await serverWith("account.a");
    const first = (await light(server, "account.a", { name: "Mama Nkechi" })).body as DedicationReply;
    await server.deps.stores.dedication.approve("account.a", "account.admin", server.deps.now());
    const second = (await light(server, "account.a", { name: "Uncle Tunde", to: 1990 })).body as DedicationReply;
    expect(second.mine).toMatchObject({ name: "Uncle Tunde", years: { from: null, to: 1990 }, approved: false });
    expect(second.mine?.id).not.toBe(first.mine?.id);
    expect((await lights(server, null)).body).toEqual({ ok: true, count: 1, lights: [{ id: second.mine?.id }] });
  });

  test("[server:dedication-routes] [account:name-a-light-for-yours] given a light, when it is put out, then it is gone and the account may light again", async () => {
    const server = await serverWith("account.a");
    await light(server, "account.a", { name: "Mama Nkechi" });
    const out = await putOut(server, "account.a");
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ ok: true });
    expect((await lights(server, "account.a")).body).toEqual({ ok: true, count: 0, lights: [] });
    expect((await putOut(server, "account.a")).status).toBe(200);
    expect((await light(server, "account.a", { name: "Mama Nkechi" })).status).toBe(200);
  });

  test("[server:dedication-routes] given no session, when a light is lit or put out, then it is refused signed-out and nothing is kept", async () => {
    const server = await serverWith();
    expect(await light(server, null, { name: "Mama Nkechi" })).toMatchObject({ status: 401, body: { ok: false, code: "signed-out" } });
    expect(await putOut(server, null)).toMatchObject({ status: 401, body: { ok: false, code: "signed-out" } });
    expect(await light(server, "account.nobody", { name: "Mama Nkechi" })).toMatchObject({ status: 401, body: { ok: false, code: "signed-out" } });
    expect((await server.deps.stores.dedication.shared(240)).count).toBe(0);
  });

  test("[server:dedication-routes] [account:name-a-light-for-yours] given a light the shared check refuses, then it is refused bad-light with that problem, for each problem at its edge, and nothing is kept", async () => {
    const server = await serverWith("account.a");
    const year = serverYear(server.deps.now());
    const bodies: Record<LightProblem, unknown> = {
      "name-empty": { name: "   " },
      "name-words": { name: "One two three four five" },
      "name-characters": { name: "a".repeat(41) },
      "first-year": { name: "Mama", from: 1899 },
      "last-year": { name: "Mama", to: year + 1 },
      "last-before": { name: "Mama", from: 2000, to: 1999 },
    };
    expect(Object.keys(bodies).sort()).toEqual([...LIGHT_PROBLEMS].sort());
    for (const problem of LIGHT_PROBLEMS) {
      const refused = await light(server, "account.a", bodies[problem]);
      expect(refused.status).toBe(400);
      expect(refused.body).toMatchObject({ ok: false, code: "bad-light", problems: [problem] });
    }
    // The edges on the other side are taken.
    expect((await light(server, "account.a", { name: "One two three four", from: 1900, to: year })).status).toBe(200);
    expect((await light(server, "account.a", { name: "a".repeat(40) })).status).toBe(200);
    await putOut(server, "account.a");
    expect(await light(server, "account.a", "not json")).toMatchObject({ status: 400, body: { code: "bad-light", problems: ["name-empty"] } });
    expect((await server.deps.stores.dedication.shared(240)).count).toBe(0);
  });

  test("[server:dedication-routes] [server:anonymous-limit-by-address] given an account at its limit, when it lights once more, then it is refused 429 before anything is kept", async () => {
    const config = testConfig({ testing: { testLogin: true }, limits: { commandsPer10s: 1 } });
    const server = testServer({ config, now: () => epoch, limits: memoryLimiters(config.limits, () => epoch) });
    await signUp(server, "account.a");
    expect((await light(server, "account.a", { name: "Mama Nkechi" })).status).toBe(200);
    const over = await light(server, "account.a", { name: "Uncle Tunde" });
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ code: "rate-limited" });
    expect((await putOut(server, "account.a")).status).toBe(429);
    expect((await server.deps.stores.dedication.mine("account.a"))?.name).toBe("Mama Nkechi");
  });

  test("[account:two-lights-and-wink-lines] [server:dedication-routes] given the counts route, then it is /api/lights and answers the two lights alone", async () => {
    const server = await serverWith("account.a");
    await light(server, "account.a", { name: "Mama Nkechi" });
    const counts = await server.app.request("/api/lights", { headers: { "cf-connecting-ip": "203.0.113.9" } });
    expect(Object.keys(await counts.json<object>()).sort()).toEqual(["abroad", "back", "home", "ok"]);
  });
});
