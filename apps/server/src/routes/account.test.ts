import { afterEach, describe, expect, test, vi } from "vitest";

import { harness, makeJar } from "../auth/testing";

afterEach(() => {
  vi.useRealTimers();
});

const START = Date.parse("2026-10-08T09:00:00Z");

describe("GET /api/account", () => {
  test("[R-ACCOUNT-015] [R-ACCOUNT-020] given a new account, when it reads its row, then it sees the country, the age method and no age date, and no character", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const reply = await h.call("/api/account", { jar });
    expect(reply.status).toBe(200);
    const body = await reply.json<{ ok: true; account: Record<string, unknown> }>();
    expect(body.account).toEqual({ id: account, country: "NG", age: { passed: true, method: "declared" }, createdAt: expect.any(Number) as number, character: null, sendUsageCounts: true, admin: false });
    const row = await h.deps.stores.account.get(account);
    expect(Object.keys(row ?? {}).sort()).toEqual(["age", "character", "country", "createdAt", "id", "notifyBankFull", "sendUsageCounts"]);
  });

  test("[R-ANALYTICS-006] given a new account, when it turns usage counts off and on with PUT /api/account, then the row and the reply follow, and a body of any other shape is refused with nothing changed", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const put = (json: unknown) => h.call("/api/account", { method: "PUT", jar, json });

    const off = await put({ sendUsageCounts: false });
    expect(off.status).toBe(200);
    expect(await off.json()).toMatchObject({ ok: true, account: { id: account, sendUsageCounts: false } });
    expect((await h.deps.stores.account.get(account))?.sendUsageCounts).toBe(false);
    for (const bad of [{ sendUsageCounts: "no" }, { sendUsageCounts: true, country: "GB" }, null]) expect((await put(bad)).status).toBe(400);
    expect((await h.deps.stores.account.get(account))?.country).toBe("NG");
    expect((await put({ sendUsageCounts: true })).status).toBe(200);
    expect((await h.deps.stores.account.get(account))?.sendUsageCounts).toBe(true);
    expect((await h.call("/api/account", { method: "PUT", jar: makeJar(), json: { sendUsageCounts: false } })).status).toBe(401);
  });

  test("[R-MODERATION-012] given an account on the admin list, when it reads its row, then it is marked admin only while its session was opened with a passkey; one off the list is not", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const other = await h.signUp("bola@example.com");
    h.deps.config.admin.accounts.push(account);
    expect(await (await h.call("/api/account", { jar })).json()).toMatchObject({ ok: true, account: { id: account, admin: false } });
    // routes/admin-passkey.test.ts opens such a session through the real passkey sign-in.
    for (const row of h.tables.session) row["signedInWith"] = "passkey";
    expect(await (await h.call("/api/account", { jar })).json()).toMatchObject({ ok: true, account: { id: account, admin: true } });
    expect(await (await h.call("/api/account", { jar: other.jar })).json()).toMatchObject({ ok: true, account: { id: other.account, admin: false } });
  });

  test("[R-ACCOUNT-015] given no session, when the row is read, then it answers signed-out", async () => {
    const reply = await harness().call("/api/account", { jar: makeJar() });
    expect(reply.status).toBe(401);
    expect(await reply.json()).toMatchObject({ code: "signed-out" });
  });
});

describe("DELETE /api/account", () => {
  test("[R-ACCOUNT-016] given a session signed in one millisecond inside the fresh window, when the account is deleted, then every session ends at once and it cannot sign in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const other = makeJar();
    for (const cookie of await (await h.helpers()).getCookies({ userId: account })) other.cookies.set(cookie.name, cookie.value);
    vi.setSystemTime(START + h.deps.config.account.deleteFreshMs - 1);
    const reply = await h.call("/api/account", { method: "DELETE", jar, ip: "192.0.2.50" });
    expect(reply.status).toBe(200);
    expect(await reply.json()).toMatchObject({ ok: true, dueAt: START + h.deps.config.account.deleteFreshMs - 1 + h.deps.config.account.deleteWithinDays * 86_400_000 });
    expect(h.tables.session).toHaveLength(0);
    expect((await h.call("/api/account", { jar: other })).status).toBe(401);
    const again = makeJar();
    const otp = await h.codeFor("ada@example.com", again, "192.0.2.51");
    const signIn = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar: again, ip: "192.0.2.52", json: { email: "ada@example.com", otp } });
    expect(signIn.status).toBe(403);
    expect(h.tables.user).toHaveLength(0);
  });

  test("[R-ACCOUNT-016] given a session signed in exactly the fresh window ago, when the account is deleted with no code, then it is refused and nothing is removed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    vi.setSystemTime(START + h.deps.config.account.deleteFreshMs);
    const reply = await h.call("/api/account", { method: "DELETE", jar });
    expect(reply.status).toBe(403);
    expect(await reply.json()).toMatchObject({ code: "not-fresh" });
    expect(h.tables.user).toHaveLength(1);
    expect(await h.deps.stores.deletion.due(Number.MAX_SAFE_INTEGER)).toEqual([]);
    expect(await h.deps.stores.account.get(account)).not.toBeNull();
  });

  test("[R-ACCOUNT-016] given a stale session, when the account is deleted with a fresh email code, then it is deleted; a wrong code is refused", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    const h = harness();
    const { jar } = await h.signUp("ada@example.com");
    vi.setSystemTime(START + h.deps.config.account.deleteFreshMs * 3);
    const otp = await h.codeFor("ada@example.com", jar, "192.0.2.60");
    const wrong = otp === "000000" ? "111111" : "000000";
    const refused = await h.call("/api/account", { method: "DELETE", jar, json: { code: wrong } });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "bad-code" });
    const reply = await h.call("/api/account", { method: "DELETE", jar, json: { code: otp } });
    expect(reply.status).toBe(200);
    expect(h.tables.user).toHaveLength(0);
    expect(h.tables.session).toHaveLength(0);
  });
});
