import { afterEach, describe, expect, test, vi } from "vitest";

import { productionConfig, testConfig } from "../config";
import { makeAuth } from "./auth";
import { memoryAuthAdapter } from "./memory";
import { SITE, harness, makeJar } from "./testing";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function json(reply: Response): Promise<Record<string, unknown>> {
  return reply.json<Record<string, unknown>>();
}

function unsignedJwt(claims: Record<string, unknown>): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${part({ alg: "none", typ: "JWT" })}.${part(claims)}.`;
}

/** Google's token endpoint answered by the test, with an id token for one fixed identity. */
function stubGoogle(identity: { sub: string; email: string }) {
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith("https://oauth2.googleapis.com/token")) return real(input, init);
    const idToken = unsignedJwt({ ...identity, email_verified: true, name: "A Real Name", picture: "https://photos.example/face.jpg", iss: "https://accounts.google.com" });
    return Promise.resolve(Response.json({ access_token: "google-access", id_token: idToken, token_type: "Bearer", expires_in: 3600 }));
  });
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

  test("[R-ACCOUNT-001] [R-ACCOUNT-020] given a player who passed the screen, when Google signs them in, then an account is made with the subject id and email and no name or photo", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    const start = await h.call("/api/auth/sign-in/social", { method: "POST", jar, json: { provider: "google", callbackURL: "/" } });
    expect(start.status).toBe(200);
    const url = new URL(String((await json(start))["url"]));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(`${SITE}/api/auth/callback/google`);
    stubGoogle({ sub: "google-subject-1", email: "ada@example.com" });
    const back = await h.call(`/api/auth/callback/google?code=stub-code&state=${url.searchParams.get("state") ?? ""}`, { jar });
    expect(back.status).toBe(302);
    expect(h.tables.user).toEqual([expect.objectContaining({ email: "ada@example.com", name: "", image: "" })]);
    expect(h.tables.account).toEqual([expect.objectContaining({ providerId: "google", accountId: "google-subject-1" })]);
    const me = await h.call("/api/account", { jar });
    expect(me.status).toBe(200);
  });

  test("[R-ACCOUNT-001] given an account made by email code, when Google signs in with the same verified email, then it is linked to the same account", async () => {
    const h = harness();
    const { account } = await h.signUp("ada@example.com");
    const jar = makeJar();
    const start = await h.call("/api/auth/sign-in/social", { method: "POST", jar, ip: "203.0.113.9", json: { provider: "google", callbackURL: "/" } });
    const state = new URL(String((await json(start))["url"])).searchParams.get("state") ?? "";
    stubGoogle({ sub: "google-subject-2", email: "ada@example.com" });
    await h.call(`/api/auth/callback/google?code=stub-code&state=${state}`, { jar });
    expect(h.tables.user).toHaveLength(1);
    expect(h.tables.account).toEqual([expect.objectContaining({ userId: account, providerId: "google" })]);
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

  test("[R-ACCOUNT-002] given a second code sent to one email, when the codes are stored, then the new one replaces the old", async () => {
    const h = harness();
    const jar = makeJar();
    await h.passAge(jar);
    const first = await h.codeFor("ada@example.com", jar, "198.51.100.1");
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
      const jar = makeJar();
      await h.passAge(jar);
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
    const jar = makeJar();
    await h.passAge(jar);
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
