// The account tests' harness: the app with the auth library on the memory
// adapter, the test server's config (R-ACCOUNT-005), a cookie jar, and
// stand-ins for Turnstile and the email send. Never imported by the Worker.
// https://better-auth.com/docs/plugins/test-utils
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
import { content } from "@japacity/content";
import type { TestHelpers } from "better-auth/plugins";
import { splitSetCookieHeader } from "better-auth/cookies";
import type { Hono } from "hono";

import { TURNSTILE_TEST } from "../account/turnstile";
import { makeApp } from "../app";
import { testConfig } from "../config";
import type { ServerConfig } from "../config";
import { memoryStores, openLimiters } from "../deps";
import type { Limiters, ServerDeps, Stores } from "../deps";
import { makeAuth } from "./auth";
import type { Auth, AuthKeys, OtpMessage } from "./auth";
import { memoryAuthAdapter, memoryAuthTables } from "./memory";
import type { AuthTables } from "./memory";
import { sessionReader } from "./session";

export const SITE = "https://japacity.test";
export const SECRET = "test-secret-that-is-long-enough-for-the-library-0123456789";
export const STUB_SITEVERIFY = "https://turnstile.stub/siteverify";

/** Cloudflare's three test secrets, answered as Cloudflare documents them, a pass naming `hostname` as where the token was solved. */
export function turnstileStub(hostname: string): typeof fetch {
  return async (_input, init) => {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { secret?: string; response?: string };
    const answer = (success: boolean, codes: string[]) => new Response(JSON.stringify({ success, "error-codes": codes, ...(success ? { hostname } : {}) }), { headers: { "content-type": "application/json" } });
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
  background: Promise<unknown>[];
  helpers: () => Promise<TestHelpers>;
  /** A request to the app as a browser from `country` at `ip`, carrying the jar's cookies and keeping the ones it sets. */
  call: (path: string, init?: RequestInit & { jar?: Jar; country?: string; ip?: string; json?: unknown }) => Promise<Response>;
  /** The age screen passed with a date of birth from 1990 and the dummy Turnstile token. */
  passAge: (jar: Jar, over?: { dateOfBirth?: string; country?: string; token?: string }) => Promise<Response>;
  /** Sends a code to `email` and returns it as the test utilities captured it. */
  codeFor: (email: string, jar: Jar, ip?: string) => Promise<string>;
  /** A whole sign-up by email code; the jar ends signed in. Returns the account id. */
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
  /** The server's clock; the machine's unless a test moves it. */
  now?: () => number;
}

export function harness(options: HarnessOptions = {}): Harness {
  const config = options.config ?? testConfig({ testing: { captureOtp: true } });
  const sent: OtpMessage[] = [];
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
    turnstile: { secretKey: options.turnstileSecret ?? TURNSTILE_TEST.passSecret, siteVerifyUrl: STUB_SITEVERIFY, fetch: turnstileStub(options.turnstileHost ?? new URL(SITE).hostname) },
    sendOtp:
      options.sendOtp ??
      ((message) => {
        sent.push(message);
        return Promise.resolve();
      }),
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

  const passAge: Harness["passAge"] = (jar, over = {}) =>
    call("/api/age", {
      method: "POST",
      jar,
      country: over.country ?? "NG",
      headers: { "x-captcha-response": over.token ?? TURNSTILE_TEST.dummyToken },
      json: { dateOfBirth: over.dateOfBirth ?? "1990-05-17" },
    });

  const codeFor: Harness["codeFor"] = async (email, jar, ip) => {
    const reply = await call("/api/auth/email-otp/send-verification-otp", { method: "POST", jar, ...(ip === undefined ? {} : { ip }), json: { email, type: "sign-in" } });
    if (reply.status !== 200) throw new Error(`The code send answered ${reply.status}: ${await reply.text()}`);
    const code = (await helpers()).getOTP?.(email.toLowerCase());
    if (code === undefined) throw new Error(`No code was captured for ${email}.`);
    return code;
  };

  const signUp: Harness["signUp"] = async (email, jar = makeJar(), country = "NG") => {
    const age = await passAge(jar, { country });
    if (age.status !== 200) throw new Error(`The age screen answered ${age.status}: ${await age.text()}`);
    const otp = await codeFor(email, jar);
    const reply = await call("/api/auth/sign-in/email-otp", { method: "POST", jar, country, json: { email, otp } });
    if (reply.status !== 200) throw new Error(`Sign-in answered ${reply.status}: ${await reply.text()}`);
    const body = await reply.json<{ user: { id: string } }>();
    return { jar, account: body.user.id };
  };

  return { deps, auth, keys, app, tables, sent, background, helpers, call, passAge, codeFor, signUp };
}
