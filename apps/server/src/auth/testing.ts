// The account tests' harness: the app with the auth library on the memory
// adapter, the test server's config (R-ACCOUNT-005), a cookie jar, and
// stand-ins for Turnstile and the email send. Never imported by the Worker.
// https://better-auth.com/docs/plugins/test-utils
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
import { content } from "@japacity/content";
import type { TestHelpers } from "better-auth/plugins";
import { splitSetCookieHeader } from "better-auth/cookies";
import type { Hono } from "hono";

import { TURNSTILE_ACTION, TURNSTILE_TEST } from "../account/turnstile";
import { makeApp } from "../app";
import { testConfig } from "../config";
import type { ServerConfig } from "../config";
import { memoryStores, openLimiters } from "../deps";
import type { Limiters, ServerDeps, Stores } from "../deps";
import { makeAuth } from "./auth";
import type { Auth, AuthKeys, AuthNotice, OtpMessage } from "./auth";
import { memoryAuthAdapter, memoryAuthTables } from "./memory";
import type { AuthTables } from "./memory";
import { sessionReader } from "./session";

export const SITE = "https://japacity.test";
export const SECRET = "test-secret-that-is-long-enough-for-the-library-0123456789";
export const STUB_SITEVERIFY = "https://turnstile.stub/siteverify";

/**
 * Cloudflare's three test secrets, answered as Cloudflare documents them, a pass naming `hostname` as where the
 * token was solved and `action` as the widget's action (R-ACCOUNT-013: the guest start's, unless a test names another).
 */
export function turnstileStub(hostname: string, action: string = TURNSTILE_ACTION): typeof fetch {
  return async (_input, init) => {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { secret?: string; response?: string };
    const answer = (success: boolean, codes: string[]) => new Response(JSON.stringify({ success, "error-codes": codes, ...(success ? { hostname, action } : {}) }), { headers: { "content-type": "application/json" } });
    if (body.secret === TURNSTILE_TEST.passSecret) return Promise.resolve(answer(true, []));
    if (body.secret === TURNSTILE_TEST.spentSecret) return Promise.resolve(answer(false, ["timeout-or-duplicate"]));
    return Promise.resolve(answer(false, ["invalid-input-response"]));
  };
}

/** A browser's cookies across requests. */
export interface Jar {
  cookies: Map<string, string>;
  take: (reply: Response) => Response;
  header: () => string;
}

export function makeJar(): Jar {
  const cookies = new Map<string, string>();
  return {
    cookies,
    take: (reply) => {
      for (const line of splitSetCookieHeader(reply.headers.get("set-cookie") ?? "")) {
        const [pair = "", ...attributes] = line.split(";");
        const at = pair.indexOf("=");
        const name = pair.slice(0, at).trim();
        const value = pair.slice(at + 1).trim();
        const gone = value === "" || attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute));
        if (gone) cookies.delete(name);
        else cookies.set(name, value);
      }
      return reply;
    },
    header: () => [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
  };
}

export interface Harness {
  deps: ServerDeps;
  auth: Auth;
  keys: AuthKeys;
  app: Hono;
  tables: AuthTables;
  sent: OtpMessage[];
  /** The notices sent to accounts' emails (R-ACCOUNT-003). */
  notices: AuthNotice[];
  background: Promise<unknown>[];
  helpers: () => Promise<TestHelpers>;
  /** A request to the app as a browser from `country` at `ip`, carrying the jar's cookies and keeping the ones it sets. */
  call: (path: string, init?: RequestInit & { jar?: Jar; country?: string; ip?: string; json?: unknown }) => Promise<Response>;
  /** The age screen passed with a date of birth from 1990. */
  passAge: (jar: Jar, over?: { dateOfBirth?: string; country?: string }) => Promise<Response>;
  /** `POST /api/guest` with the dummy Turnstile token; the jar holds the guest's session when it answers 200. */
  startGuest: (jar: Jar, over?: { username?: string; country?: string; ip?: string; token?: string }) => Promise<Response>;
  /** The age screen and the guest start; the jar ends signed in as the guest. Returns the account id. */
  guest: (jar?: Jar, over?: { username?: string; country?: string; ip?: string }) => Promise<{ jar: Jar; account: string }>;
  /** Secures the jar's guest with a code sent to `email`; returns the sign-in's reply. */
  secureByCode: (jar: Jar, email: string, ip?: string) => Promise<Response>;
  /** Sends a code to `email` and returns it as the stand-in for the send was given it. */
  codeFor: (email: string, jar: Jar, ip?: string) => Promise<string>;
  /** A guest secured by an email code; the jar ends signed in. Returns the account id. */
  signUp: (email: string, jar?: Jar, country?: string) => Promise<{ jar: Jar; account: string }>;
}

export interface HarnessOptions {
  config?: ServerConfig;
  /** The stores and the auth library's adapter, for a run on Postgres; the memory ones otherwise. */
  stores?: Stores;
  adapter?: Parameters<typeof makeAuth>[1];
  sendOtp?: (message: OtpMessage) => Promise<void>;
  turnstileSecret?: string;
  /** The limits; open unless a test counts them. */
  limits?: Limiters;
  /** The host the Turnstile stand-in says a passed token was solved on; the site's own unless a test names another. */
  turnstileHost?: string;
  /** The action the Turnstile stand-in says a passed token was made for; the guest start's unless a test names another. */
  turnstileAction?: string;
  /** The server's clock; the machine's unless a test moves it. */
  now?: () => number;
}

export function harness(options: HarnessOptions = {}): Harness {
  const config = options.config ?? testConfig({ testing: { captureOtp: true } });
  const sent: OtpMessage[] = [];
  const notices: AuthNotice[] = [];
  const background: Promise<unknown>[] = [];
  const tables = memoryAuthTables();
  let seed = 7;
  const base: ServerDeps = {
    config,
    stores: options.stores ?? memoryStores(),
    contents: { current: content, previous: null },
    secrets: { worldSeed: "test-world-seed", banSalt: "test-ban-salt", drawTokenKey: "test-draw-token-key" },
    limits: options.limits ?? openLimiters,
    session: () => Promise.resolve(null),
    now: options.now ?? (() => Date.now()),
    randomBytes: (count) => Uint8Array.from({ length: count }, () => (seed = (seed * 48271) % 2147483647) & 255),
  };
  const keys: AuthKeys = {
    secret: SECRET,
    siteUrl: SITE,
    google: { clientId: "test-google-client", clientSecret: "test-google-secret" },
    turnstile: { secretKey: options.turnstileSecret ?? TURNSTILE_TEST.passSecret, siteVerifyUrl: STUB_SITEVERIFY, fetch: turnstileStub(options.turnstileHost ?? new URL(SITE).hostname, options.turnstileAction) },
    // R-ACCOUNT-005: every code is kept as it is sent, the only place a test can read it.
    sendOtp: (message) => {
      sent.push(message);
      return options.sendOtp?.(message) ?? Promise.resolve();
    },
    sendNotice: (notice) => {
      notices.push(notice);
      return Promise.resolve();
    },
    background: (promise) => {
      background.push(promise);
    },
  };
  const auth = makeAuth(base, options.adapter ?? memoryAuthAdapter(tables), keys);
  const deps: ServerDeps = { ...base, session: sessionReader(auth) };
  const app = makeApp(deps, { auth, keys });

  const call: Harness["call"] = async (path, init = {}) => {
    const { jar, country = "NG", ip = "203.0.113.7", json, ...rest } = init;
    const headers = new Headers(rest.headers);
    headers.set("cf-ipcountry", country);
    headers.set("cf-connecting-ip", ip);
    if (jar !== undefined && jar.cookies.size > 0) headers.set("cookie", jar.header());
    if (json !== undefined) headers.set("content-type", "application/json");
    const reply = await app.request(`${SITE}${path}`, { ...rest, headers, ...(json === undefined ? {} : { body: JSON.stringify(json) }) });
    return jar === undefined ? reply : jar.take(reply);
  };

  const helpers = async () => (await auth.$context as unknown as { test: TestHelpers }).test;

  const passAge: Harness["passAge"] = (jar, over = {}) => call("/api/age", { method: "POST", jar, country: over.country ?? "NG", json: { dateOfBirth: over.dateOfBirth ?? "1990-05-17" } });

  let named = 0;
  const startGuest: Harness["startGuest"] = (jar, over = {}) => {
    named += 1;
    return call("/api/guest", {
      method: "POST",
      jar,
      country: over.country ?? "NG",
      ...(over.ip === undefined ? {} : { ip: over.ip }),
      headers: { "x-captcha-response": over.token ?? TURNSTILE_TEST.dummyToken },
      json: { username: over.username ?? `player_${String(named)}` },
    });
  };

  const guest: Harness["guest"] = async (jar = makeJar(), over = {}) => {
    const age = await passAge(jar, { country: over.country ?? "NG" });
    if (age.status !== 200) throw new Error(`The age screen answered ${age.status}: ${await age.text()}`);
    const reply = await startGuest(jar, over);
    if (reply.status !== 200) throw new Error(`The guest start answered ${reply.status}: ${await reply.text()}`);
    const body = await reply.json<{ account: { id: string } }>();
    return { jar, account: body.account.id };
  };

  const codeFor: Harness["codeFor"] = async (email, jar, ip) => {
    const reply = await call("/api/auth/email-otp/send-verification-otp", { method: "POST", jar, ...(ip === undefined ? {} : { ip }), json: { email, type: "sign-in" } });
    if (reply.status !== 200) throw new Error(`The code send answered ${reply.status}: ${await reply.text()}`);
    const code = sent.findLast((message) => message.email.toLowerCase() === email.toLowerCase())?.otp;
    if (code === undefined) throw new Error(`No code was sent to ${email}.`);
    return code;
  };

  const secureByCode: Harness["secureByCode"] = async (jar, email, ip) => {
    const otp = await codeFor(email, jar, ip);
    return call("/api/auth/sign-in/email-otp", { method: "POST", jar, ...(ip === undefined ? {} : { ip }), json: { email, otp } });
  };

  const signUp: Harness["signUp"] = async (email, jar = makeJar(), country = "NG") => {
    const { account } = await guest(jar, { country });
    const reply = await secureByCode(jar, email);
    if (reply.status !== 200) throw new Error(`Securing answered ${reply.status}: ${await reply.text()}`);
    return { jar, account };
  };

  return { deps, auth, keys, app, tables, sent, notices, background, helpers, call, passAge, startGuest, guest, secureByCode, codeFor, signUp };
}
