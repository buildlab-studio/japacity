import { time } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { productionConfig, testConfig } from "../config";
import { banIdentities, emailIdentity } from "../moderation/identities";
import { setSwitch } from "../switches/switches";
import { makeAuth, relyingPartyOf } from "./auth";
import { EMAIL_DAY_WINDOW_MS, EMAIL_LIMIT_WINDOW_MS, pruneLimitRows } from "./hooks";
import { memoryAuthAdapter } from "./memory";
import { GOOGLE_PROFILE, SITE, harness, makeJar, stubGoogle } from "./auth.testing";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function json(reply: Response): Promise<Record<string, unknown>> {
  return reply.json<Record<string, unknown>>();
}

describe("signing in", () => {
  test("[R-ACCOUNT-001] given the password sign-in left off, when its routes are called, then every one refuses and no account is made", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    const body = { email: "ada@example.com", password: "a long enough password", name: "Ada" };
    for (const path of ["/api/auth/sign-up/email", "/api/auth/sign-in/email"]) {
      const reply = await h.call(path, { method: "POST", jar, json: body });
      expect(reply.status).toBeGreaterThanOrEqual(400);
      expect(reply.headers.get("set-cookie") ?? "").not.toContain("session_token");
    }
    expect(h.tables.user).toHaveLength(0);
  });

  test("[R-ACCOUNT-001] [R-ACCOUNT-020] [R-ACCOUNT-023] given a guest, when Google secures it, then the guest's own account holds the subject id and email and no name or photo", async () => {
    const h = harness();
    const { jar, account } = await h.guest();
    const start = await h.call("/api/auth/sign-in/social", { method: "POST", jar, json: { provider: "google", callbackURL: "/" } });
    expect(start.status).toBe(200);
    const url = new URL(String((await json(start))["url"]));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(`${SITE}/api/auth/callback/google`);
    stubGoogle({ sub: "google-subject-1", email: "ada@example.com" }, GOOGLE_PROFILE);
    const back = await h.call(`/api/auth/callback/google?code=stub-code&state=${url.searchParams.get("state") ?? ""}`, { jar });
    expect(back.status).toBe(302);
    expect(h.tables.user).toEqual([expect.objectContaining({ id: account, email: "ada@example.com", name: "", isAnonymous: false })]);
    expect(h.tables.user[0]?.["image"] ?? "").toBe("");
    expect(h.tables.account).toEqual([expect.objectContaining({ userId: account, providerId: "google", accountId: "google-subject-1" })]);
    const me = await h.call("/api/account", { jar });
    expect(await json(me)).toMatchObject({ ok: true, account: { id: account, state: "secured" } });
  });

  test("[R-ACCOUNT-001] given an account made by email code, when Google signs in with the same verified email, then it is linked to the same account", async () => {
    const h = harness();
    const { account } = await h.signUp("ada@example.com");
    const jar = makeJar();
    const start = await h.call("/api/auth/sign-in/social", { method: "POST", jar, ip: "203.0.113.9", json: { provider: "google", callbackURL: "/" } });
    const state = new URL(String((await json(start))["url"])).searchParams.get("state") ?? "";
    stubGoogle({ sub: "google-subject-2", email: "ada@example.com" }, GOOGLE_PROFILE);
    await h.call(`/api/auth/callback/google?code=stub-code&state=${state}`, { jar });
    expect(h.tables.user).toHaveLength(1);
    expect(h.tables.account).toEqual([expect.objectContaining({ userId: account, providerId: "google" })]);
  });

  test("[R-MODERATION-018] given a banned email, when it signs up by code after passing the screen, then no account or row is made, and another email still can", async () => {
    const h = harness();
    await banIdentities(h.deps, [emailIdentity("Bad@Example.com")]);
    const jar = makeJar();
    await h.passAge(jar);
    const otp = await h.codeFor("bad@example.com", jar);
    const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, json: { email: "bad@example.com", otp } });
    expect(reply.status).toBe(403);
    expect(await json(reply)).toMatchObject({ code: "not-possible" });
    expect(h.tables.user).toHaveLength(0);
    expect((await h.signUp("good@example.com")).account).not.toBe("");
  });

  test("[R-MODERATION-018] given a banned Google subject, when it signs in with a new email or links to an existing account, then the method is refused", async () => {
    const h = harness();
    await banIdentities(h.deps, ["google:google-subject-9"]);
    await h.signUp("ada@example.com");
    for (const email of ["new@example.com", "ada@example.com"]) {
      const jar = makeJar();
      await h.passAge(jar);
      const start = await h.call("/api/auth/sign-in/social", { method: "POST", jar, json: { provider: "google", callbackURL: "/" } });
      const state = new URL(String((await json(start))["url"])).searchParams.get("state") ?? "";
      stubGoogle({ sub: "google-subject-9", email }, GOOGLE_PROFILE);
      await h.call(`/api/auth/callback/google?code=stub-code&state=${state}`, { jar });
      vi.unstubAllGlobals();
      expect((await h.call("/api/account", { jar })).status).toBe(401);
    }
    expect(h.tables.account.filter((method) => method.providerId === "google")).toEqual([]);
  });

  test("[R-MODERATION-014] given an account suspended for a day, when it signs in by code, then no session is made until the day is over", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-08T09:00:00Z");
    vi.setSystemTime(start);
    const h = harness();
    const { account } = await h.signUp("ada@example.com");
    await h.deps.stores.moderationLog.append({ id: "log.suspend", admin: "account.owner", at: start, item: "report.1", action: "suspend", params: { account, days: 1 }, reason: "scam" });
    const signIn = async () => {
      const jar = makeJar();
      const otp = await h.codeFor("ada@example.com", jar, `198.51.100.${String(Date.now() % 200)}`);
      const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, ip: `198.51.100.${String(Date.now() % 200)}`, json: { email: "ada@example.com", otp } });
      return { reply, jar };
    };

    vi.setSystemTime(start + time.DAY_MS - 1);
    const refused = await signIn();
    expect(await json(refused.reply)).toMatchObject({ code: "not-possible" });
    expect((await h.call("/api/account", { jar: refused.jar })).status).toBe(401);

    vi.setSystemTime(start + time.DAY_MS);
    const allowed = await signIn();
    expect(allowed.reply.status).toBe(200);
    expect((await h.call("/api/account", { jar: allowed.jar })).status).toBe(200);
  });

  test("[R-SERVER-031] given an age pass taken while sign-ups were on, when the switch goes off and the guest life is started, then it is refused switched-off and no account is made", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    await setSwitch(h.deps, "signups", false, "account.owner", "full");
    const reply = await h.startGuest(jar);
    expect(reply.status).toBe(503);
    expect(await json(reply)).toMatchObject({ code: "switched-off" });
    expect(h.tables.user).toHaveLength(0);
  });

  test("[R-ACCOUNT-002] given a code sent, when it is read back, then it is 6 digits and the reply did not wait on the send", async () => {
    let release: () => void = () => undefined;
    const h = harness({ sendOtp: () => new Promise<void>((resolve) => (release = resolve)) });
    const jar = makeJar();
    const code = await h.codeFor("ada@example.com", jar);
    expect(code).toMatch(/^\d{6}$/);
    expect(h.background).toHaveLength(1);
    let settled = false;
    void h.background[0]?.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await h.background[0];
    expect(settled).toBe(true);
  });

  test("[R-ACCOUNT-002] [R-ACCOUNT-005] given a code sent, when the database is read, then it holds only the code's hash, and the code as sent still signs in", async () => {
    const h = harness();
    const { jar } = await h.guest();
    const otp = await h.codeFor("ada@example.com", jar);
    const rows = h.tables.verification.filter((row) => String(row["identifier"]).startsWith("sign-in-otp-"));
    expect(rows).toHaveLength(1);
    expect(String(rows[0]?.["value"])).not.toContain(otp);
    const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, json: { email: "ada@example.com", otp } });
    expect(reply.status).toBe(200);
  });

  test("[R-ACCOUNT-002] given a second code sent to one email, when the codes are stored, then the new one replaces the old", async () => {
    const h = harness();
    const { jar } = await h.guest();
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() });
    const first = await h.codeFor("ada@example.com", jar, "198.51.100.1");
    // The library finds the newest code by its creation time; two in one millisecond tie.
    vi.setSystemTime(Date.now() + 1000);
    const second = await h.codeFor("ada@example.com", jar, "198.51.100.2");
    const old = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, ip: "198.51.100.3", json: { email: "ada@example.com", otp: first } });
    expect(first === second || old.status === 400).toBe(true);
    const current = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, ip: "198.51.100.4", json: { email: "ada@example.com", otp: second } });
    expect(current.status).toBe(200);
  });

  test("[R-ACCOUNT-002] given a code, when it is used exactly 5 minutes after the send, then it works; a millisecond later it has expired", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-10-08T09:00:00Z");
    const h = harness();
    const expiresInMs = h.deps.config.auth.otp.expiresIn * 1000;
    const results: string[] = [];
    for (const [email, late] of [["on-time@example.com", 0], ["late@example.com", 1]] as const) {
      vi.setSystemTime(start);
      const { jar } = await h.guest(makeJar(), { ip: `198.51.100.${String(30 + late)}` });
      const otp = await h.codeFor(email, jar, `198.51.100.${String(10 + late)}`);
      vi.setSystemTime(start + expiresInMs + late);
      const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, ip: `198.51.100.${String(20 + late)}`, json: { email, otp } });
      const code = (await json(reply))["code"];
      results.push(`${String(reply.status)} ${typeof code === "string" ? code : ""}`);
    }
    expect(results).toEqual(["200 ", "400 OTP_EXPIRED"]);
  });

  test("[R-ACCOUNT-002] given three wrong tries, when the right code is checked a fourth time, then it is refused", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    const otp = await h.codeFor("ada@example.com", jar);
    const wrong = otp === "000000" ? "111111" : "000000";
    for (const ip of ["192.0.2.1", "192.0.2.2", "192.0.2.3"]) {
      const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, ip, json: { email: "ada@example.com", otp: wrong } });
      expect(reply.status).toBe(400);
    }
    const fourth = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, ip: "192.0.2.4", json: { email: "ada@example.com", otp } });
    expect(fourth.status).toBe(403);
    expect(await json(fourth)).toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
    expect(h.tables.user).toHaveLength(0);
  });

  test("[R-ACCOUNT-003] given no session, when a passkey's registration is asked for, then it is refused; with a session the relying party is the game's domain", async () => {
    const h = harness();
    const refused = await h.call("/api/auth/passkey/generate-register-options", { jar: makeJar() });
    expect(refused.status).toBe(401);
    const { jar } = await h.signUp("ada@example.com");
    const options = await h.call("/api/auth/passkey/generate-register-options", { jar });
    expect(options.status).toBe(200);
    expect(await json(options)).toMatchObject({ rp: { id: new URL(SITE).hostname, name: "Japacity" } });
  });

  test("[R-ACCOUNT-003] given a SITE_URL that is a bare https origin, when the relying party is taken from it, then it is exactly its host", () => {
    expect(relyingPartyOf("https://japacity.app")).toBe("japacity.app");
    expect(relyingPartyOf("https://staging.japacity.app")).toBe("staging.japacity.app");
    expect(relyingPartyOf(SITE)).toBe(new URL(SITE).hostname);
  });

  test("[R-ACCOUNT-003] given a SITE_URL that is not https or carries a path, a query or a trailing slash, when the relying party is asked for, then it throws and no auth instance is made", () => {
    for (const siteUrl of ["http://japacity.app", "https://japacity.app/", "https://japacity.app/play", "https://japacity.app/?x=1", "https://japacity.app/#top", "ftp://japacity.app", "japacity.app"]) {
      expect(() => relyingPartyOf(siteUrl)).toThrow();
    }
    const h = harness();
    expect(() => makeAuth(h.deps, memoryAuthAdapter(), { ...h.keys, siteUrl: "https://japacity.app/play" })).toThrow();
  });

  test("[R-ACCOUNT-004] given the methods built, when a text-message code is asked for, then no such route exists", async () => {
    const h = harness();
    for (const path of ["/api/auth/phone-number/send-otp", "/api/auth/sign-in/phone-number"]) {
      const reply = await h.call(path, { method: "POST", json: { phoneNumber: "+2348000000000" } });
      expect(reply.status).toBe(404);
    }
  });

  test("[R-ACCOUNT-005] given the production config, when the instance is made, then it holds no test utilities and captures no code", async () => {
    const keys = harness().keys;
    const production = await makeAuth({ ...harness().deps, config: productionConfig }, memoryAuthAdapter(), keys).$context;
    expect(production.options.plugins?.map((plugin) => plugin.id)).not.toContain("test-utils");
    expect((production as unknown as { test?: unknown }).test).toBeUndefined();
    const testing = await makeAuth({ ...harness().deps, config: testConfig({ testing: { captureOtp: true } }) }, memoryAuthAdapter(), keys).$context;
    expect(testing.options.plugins?.map((plugin) => plugin.id)).toContain("test-utils");
  });

  test("[R-ACCOUNT-006] given a sign-in, when its session cookie is set, then it is HttpOnly, Secure and SameSite=Lax", async () => {
    const h = harness();
    const { jar } = await h.guest();
    const otp = await h.codeFor("ada@example.com", jar);
    const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar, json: { email: "ada@example.com", otp } });
    const line = (reply.headers.get("set-cookie") ?? "").split(/,(?=\s*__Secure-)/).find((part) => part.includes("session_token")) ?? "";
    expect(line).toContain("HttpOnly");
    expect(line).toContain("Secure");
    expect(line).toContain("SameSite=Lax");
  });

  test("[R-ACCOUNT-006] given an account signed in twice, when it removes a passkey, then every session ends", async () => {
    const h = harness();
    const { jar, account } = await h.signUp("ada@example.com");
    const other = makeJar();
    for (const cookie of (await (await h.helpers()).getCookies({ userId: account }))) other.cookies.set(cookie.name, cookie.value);
    expect((await h.call("/api/account", { jar: other })).status).toBe(200);
    h.tables.passkey.push({ id: "passkey-1", userId: account, publicKey: "key", credentialID: "credential-1", counter: 0, deviceType: "singleDevice", backedUp: false, createdAt: new Date() });
    const removed = await h.call("/api/auth/passkey/delete-passkey", { method: "POST", jar, json: { id: "passkey-1" } });
    expect(removed.status).toBe(200);
    expect(h.tables.session).toHaveLength(0);
    expect((await h.call("/api/account", { jar })).status).toBe(401);
    expect((await h.call("/api/account", { jar: other })).status).toBe(401);
  });
});

describe("the sign-in limits", () => {
  test("[R-ACCOUNT-014] given code sends from one address, when one more than the limit is sent in 60 seconds, then it is refused and the count is in the database", async () => {
    const h = harness();
    const limit = h.deps.config.auth.limits.otpSendPer60s;
    const statuses: number[] = [];
    for (let n = 0; n <= limit; n++) {
      const reply = await h.call("/api/auth/email-otp/send-verification-otp", { method: "POST", ip: "198.51.100.50", json: { email: `player-${String(n)}@example.com`, type: "sign-in" } });
      statuses.push(reply.status);
    }
    expect(statuses).toEqual([...Array.from({ length: limit }, () => 200), 429]);
    expect(h.tables.rateLimit.some((row) => String(row["key"]).startsWith("198.51.100.50"))).toBe(true);
  });

  test("[R-ACCOUNT-014] given code sends to one email from many addresses, when one more than the limit is sent in 60 seconds, then it is refused", async () => {
    const h = harness();
    const limit = h.deps.config.auth.limits.otpSendPer60s;
    const statuses: number[] = [];
    for (let n = 0; n <= limit; n++) {
      const reply = await h.call("/api/auth/email-otp/send-verification-otp", { method: "POST", ip: `198.51.100.${String(60 + n)}`, json: { email: "Ada@Example.com", type: "sign-in" } });
      statuses.push(reply.status);
    }
    expect(statuses).toEqual([...Array.from({ length: limit }, () => 200), 429]);
    expect(JSON.stringify(h.tables.rateLimit)).not.toContain("example.com");
  });

  test("[R-ACCOUNT-014] given code sends to one email spaced past the minute limit, when one more than the daily cap is sent within a day, then it is refused, and a day after the first it is sent again", async () => {
    let now = Date.UTC(2026, 9, 10, 9, 0, 0);
    const h = harness({ now: () => now });
    const { otpSendPerDay } = h.deps.config.auth.limits;
    const send = async (n: number) => (await h.call("/api/auth/email-otp/send-verification-otp", { method: "POST", ip: `198.51.100.${String(100 + n)}`, json: { email: "ada@example.com", type: "sign-in" } })).status;
    const first = now;
    const statuses: number[] = [];
    for (let n = 0; n <= otpSendPerDay; n++) {
      statuses.push(await send(n));
      now += EMAIL_LIMIT_WINDOW_MS;
    }
    expect(statuses).toEqual([...Array.from({ length: otpSendPerDay }, () => 200), 429]);
    // The daily row outlives the prune of the minute rows.
    await pruneLimitRows((await h.auth.$context).adapter, now);
    expect(await send(otpSendPerDay + 1)).toBe(429);
    now = first + EMAIL_DAY_WINDOW_MS - 1;
    expect(await send(otpSendPerDay + 2)).toBe(429);
    now = first + EMAIL_DAY_WINDOW_MS;
    expect(await send(otpSendPerDay + 3)).toBe(200);
    expect(JSON.stringify(h.tables.rateLimit)).not.toContain("example.com");
  });

  test("[R-ACCOUNT-014] given code checks from one address, when a fourth comes within 10 seconds, then it is refused", async () => {
    const h = harness();
    const statuses: number[] = [];
    for (let n = 0; n < 4; n++) {
      const reply = await h.call("/api/auth/sign-in/email-otp", { method: "POST", ip: "198.51.100.90", json: { email: `p${String(n)}@example.com`, otp: "123456" } });
      statuses.push(reply.status);
    }
    expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true);
    expect(statuses[3]).toBe(429);
  });
});
