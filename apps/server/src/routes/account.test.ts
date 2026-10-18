import type { AccountReply } from "@japacity/api";
import { time } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { harness, makeJar, withGoogle } from "../auth/auth.testing";
import type { Harness, Jar } from "../auth/auth.testing";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function accountOf(h: Harness, jar: Jar): Promise<{ text: string; reply: AccountReply }> {
  const text = await (await h.call("/api/account", { jar })).text();
  return { text, reply: JSON.parse(text) as AccountReply };
}

describe("the ways back in (GET /api/account's ways)", () => {
  test("[R-ACCOUNT-027] [R-ACCOUNT-020] given a guest, a life kept by a code and a life kept with Google, when each reads its row, then ways names the Google address where Google is linked, the code's address and the passkeys held, and a guest has none", async () => {
    const h = harness();
    const guest = await h.guest();
    expect((await accountOf(h, guest.jar)).reply).toMatchObject({ ok: true, account: { state: "guest", ways: { google: null, email: null, passkeys: 0 } } });

    const byCode = await h.signUp("bola@example.com");
    expect((await accountOf(h, byCode.jar)).reply).toMatchObject({ ok: true, account: { id: byCode.account, ways: { google: null, email: "bola@example.com", passkeys: 0 } } });

    const kept = await h.guest();
    expect((await withGoogle(h, kept.jar, { sub: "google-ada", email: "ada@example.com" })).searchParams.get("error")).toBeNull();
    const read = await accountOf(h, kept.jar);
    expect(read.reply).toMatchObject({ ok: true, account: { id: kept.account, state: "secured", ways: { google: "ada@example.com", email: "ada@example.com", passkeys: 0 } } });

    // Passkeys are counted from the library's own rows (the registration itself is proved in auth.test.ts).
    h.tables.passkey.push({ id: "passkey-1", userId: kept.account, publicKey: "public-key", credentialID: "credential-1", counter: 0, deviceType: "singleDevice", backedUp: false, createdAt: new Date() });
    expect((await accountOf(h, kept.jar)).reply).toMatchObject({ ok: true, account: { ways: { google: "ada@example.com", email: "ada@example.com", passkeys: 1 } } });
  });

  test("[R-ACCOUNT-027] [R-ACCOUNT-020] given a life kept with Google, when its row is read, then ways holds the three fields alone: no token, no Google subject, no key", async () => {
    const h = harness();
    const kept = await h.guest();
    await withGoogle(h, kept.jar, { sub: "google-subject-secret", email: "ada@example.com" });
    h.tables.passkey.push({ id: "passkey-1", userId: kept.account, publicKey: "public-key-secret", credentialID: "credential-secret", counter: 0, deviceType: "singleDevice", backedUp: false, createdAt: new Date() });
    const { text, reply } = await accountOf(h, kept.jar);
    if (!reply.ok) throw new Error(reply.detail);
    expect(Object.keys(reply.account.ways).sort()).toEqual(["email", "google", "passkeys"]);
    for (const secret of ["google-subject-secret", "google-access-token", "google-refresh-token", "public-key-secret", "credential-secret", "eyJ"]) expect(text).not.toContain(secret);
  });
});

describe("another way in to the same account (R-ACCOUNT-023)", () => {
  test("[R-ACCOUNT-023] given a life kept with Google, when a code is sent to that Google address from another browser and typed, then it opens the same account and its life, and no account is made", async () => {
    const h = harness();
    const kept = await h.guest();
    await withGoogle(h, kept.jar, { sub: "google-ada", email: "ada@example.com" });
    const users = h.tables.user.length;

    const elsewhere = makeJar();
    const otp = await h.codeFor("ada@example.com", elsewhere);
    const signed = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar: elsewhere, json: { email: "ada@example.com", otp } });
    expect(signed.status).toBe(200);

    expect((await accountOf(h, elsewhere)).reply).toMatchObject({ ok: true, account: { id: kept.account, state: "secured", ways: { google: "ada@example.com", email: "ada@example.com" } } });
    expect(h.tables.user).toHaveLength(users);
  });

  test("[R-ACCOUNT-023] given a life kept by a code, when Google with that same verified address signs in from another browser, then it opens the same account, and from then Google is one of its ways", async () => {
    const h = harness();
    const byCode = await h.signUp("ada@example.com");
    const users = h.tables.user.length;

    const elsewhere = makeJar();
    expect((await withGoogle(h, elsewhere, { sub: "google-ada", email: "ada@example.com" })).searchParams.get("error")).toBeNull();

    expect((await accountOf(h, elsewhere)).reply).toMatchObject({ ok: true, account: { id: byCode.account, ways: { google: "ada@example.com", email: "ada@example.com", passkeys: 0 } } });
    expect((await accountOf(h, byCode.jar)).reply).toMatchObject({ ok: true, account: { id: byCode.account, ways: { google: "ada@example.com" } } });
    expect(h.tables.user).toHaveLength(users);
  });

  test("[R-ACCOUNT-023] [R-ACCOUNT-001] given an address no life is kept with, when a code to it is typed at the door, then it opens nothing and makes no account", async () => {
    const h = harness();
    await h.signUp("ada@example.com");
    const users = h.tables.user.length;
    const jar = makeJar();
    const otp = await h.codeFor("nobody@example.com", jar);
    const signed = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, json: { email: "nobody@example.com", otp } });
    expect(signed.status).toBe(403);
    expect(await signed.json()).toMatchObject({ code: "no-account" });
    expect(h.tables.user).toHaveLength(users);
    expect((await h.call("/api/account", { jar })).status).toBe(401);
  });
});

const START = Date.parse("2026-10-08T09:00:00Z");

describe("GET /api/account", () => {
  test("[R-ACCOUNT-015] [R-ACCOUNT-020] given a new account, when it reads its row, then it sees the country, the age method and no age date, and no character", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const reply = await h.call("/api/account", { jar });
    expect(reply.status).toBe(200);
    const body = await reply.json<{ ok: true; account: Record<string, unknown> }>();
    expect(body.account).toEqual({
      id: account,
      country: "NG",
      age: { passed: true, method: "declared" },
      createdAt: expect.any(Number) as number,
      character: null,
      sendUsageCounts: true,
      admin: false,
      state: "secured",
      username: "player_1",
      renameFrom: 0,
      ways: { google: null, email: "ada@example.com", passkeys: 0 },
    });
    const row = await h.deps.stores.account.get(account);
    expect(Object.keys(row ?? {}).sort()).toEqual(["age", "character", "country", "createdAt", "id", "lastPlayedAt", "notifyBankFull", "sendUsageCounts", "state", "username", "usernameChangedAt"]);
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
    // routes/admin/passkey.test.ts opens such a session through the real passkey sign-in.
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
    expect(await reply.json()).toMatchObject({ ok: true, dueAt: START + h.deps.config.account.deleteFreshMs - 1 + h.deps.config.account.deleteWithinDays * time.DAY_MS });
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
