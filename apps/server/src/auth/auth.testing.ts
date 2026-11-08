// The account tests' harness: the app with the auth library on the memory
// adapter, the test server's config (account:stand-ins-test-sign-in), a cookie jar, and
// stand-ins for Turnstile and the email send. Never imported by the Worker.
// https://better-auth.com/docs/plugins/test-utils
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
import { content } from "@japacity/content";
import type { TestHelpers } from "better-auth/plugins";
import { splitSetCookieHeader } from "better-auth/cookies";
import type { Hono } from "hono";
import { vi } from "vitest";

import { CODE_ACTION, TURNSTILE_ACTION, TURNSTILE_TEST } from "../account/turnstile";
import { makeApp } from "../app";
import { seededBytes } from "../app.testing";
import { testConfig } from "../config";
import type { ServerConfig } from "../config";
import { memoryStores, openLimiters } from "../dependencies";
import type { Limiters, ServerDeps, Stores } from "../dependencies";
import { makeAuth } from "./auth";
import type { Auth, AuthKeys, AuthNotice, OtpMessage } from "./auth";
import { memoryAuthAdapter, memoryAuthTables } from "./memory";
import type { AuthTables } from "./memory";
import { sessionReader } from "./session";

export const SITE = "https://japacity.test";
export const SECRET = "test-secret-that-is-long-enough-for-the-library-0123456789";
const STUB_SITEVERIFY = "https://turnstile.stub/siteverify";
const SEND_PATH = "/api/auth/email-otp/send-verification-otp";

/** The token the stand-in reads as solved by a widget rendered for the code send (account:bot-check-on-code-send); the dummy token stands for the guest start's. */
export const CODE_TOKEN = `${TURNSTILE_TEST.dummyToken}.code`;

/**
 * Cloudflare's three test secrets, answered as Cloudflare documents them, a pass naming `hostname` as where the
 * token was solved and `action` as the widget's action: the code send's for `CODE_TOKEN`, the guest start's for any other
 * (account:bot-check-on-guest-creation, account:bot-check-on-code-send), unless a test names one.
 */
function turnstileStub(hostname: string, named?: string): typeof fetch {
  return async (_input, init) => {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { secret?: string; response?: string };
    const action = named ?? (body.response === CODE_TOKEN ? CODE_ACTION : TURNSTILE_ACTION);
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
  /** The notices sent to accounts' emails (account:passkey-needs-signed-in-session). */
  notices: AuthNotice[];
  background: Promise<unknown>[];
  helpers: () => Promise<TestHelpers>;
  /**
   * A request to the app as a browser from `country` at `ip`, carrying the jar's cookies and keeping the ones it sets. A code send
   * carries `bot` as the bot check's token, as the game's forms do (account:bot-check-on-code-send): the code widget's pass unless a test names another, or null for none.
   */
  call: (path: string, init?: RequestInit & { jar?: Jar; country?: string; ip?: string; json?: unknown; bot?: string | null }) => Promise<Response>;
  /** The age screen passed with a date of birth from 1990. */
  passAge: (jar: Jar, over?: { dateOfBirth?: string; country?: string }) => Promise<Response>;
  /** `POST /api/guest` with the dummy Turnstile token; the jar holds the guest's session when it answers 200. */
  startGuest: (jar: Jar, over?: { username?: string; country?: string; ip?: string; token?: string }) => Promise<Response>;
  /** The age screen and the guest start; the jar ends signed in as the guest. Returns the account id. */
  guest: (jar?: Jar, over?: { username?: string; country?: string; ip?: string }) => Promise<{ jar: Jar; account: string }>;
  /** Secures the jar's guest with a code sent to `email`; returns the sign-in's reply. */
  secureByCode: (jar: Jar, email: string, ip?: string) => Promise<Response>;
  /** Sends a code to `email` and returns it as the stand-in for the send was given it, whether or not an account uses the address. */
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
  // Woken when the stand-in for the send is given a code, so a request waits for its background send to reach it, even one that never settles.
  let woken: (() => void)[] = [];
  const tables = memoryAuthTables();
  const base: ServerDeps = {
    config,
    stores: options.stores ?? memoryStores(),
    contents: { current: content, previous: null },
    secrets: { worldSeed: "test-world-seed", banSalt: "test-ban-salt", drawTokenKey: "test-draw-token-key" },
    limits: options.limits ?? openLimiters,
    session: () => Promise.resolve(null),
    now: options.now ?? (() => Date.now()),
    randomBytes: seededBytes(7),
  };
  const keys: AuthKeys = {
    secret: SECRET,
    siteUrl: SITE,
    google: { clientId: "test-google-client", clientSecret: "test-google-secret" },
    turnstile: { secretKey: options.turnstileSecret ?? TURNSTILE_TEST.passSecret, siteVerifyUrl: STUB_SITEVERIFY, fetch: turnstileStub(options.turnstileHost ?? new URL(SITE).hostname, options.turnstileAction) },
    // account:stand-ins-test-sign-in: every code is kept as it is sent, the only place a test can read it.
    sendOtp: (message) => {
      sent.push(message);
      for (const wake of woken) wake();
      woken = [];
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
  const deps: ServerDeps = { ...base, session: sessionReader(auth, base) };
  const app = makeApp(deps, { auth, keys });

  const call: Harness["call"] = async (path, init = {}) => {
    const { jar, country = "NG", ip = "203.0.113.7", json, bot = CODE_TOKEN, ...rest } = init;
    const headers = new Headers(rest.headers);
    if (path === SEND_PATH && bot !== null && !headers.has("x-captcha-response")) headers.set("x-captcha-response", bot);
    headers.set("cf-ipcountry", country);
    headers.set("cf-connecting-ip", ip);
    if (jar !== undefined && jar.cookies.size > 0) headers.set("cookie", jar.header());
    if (json !== undefined) headers.set("content-type", "application/json");
    const before = background.length;
    const reply = await app.request(`${SITE}${path}`, { ...rest, headers, ...(json === undefined ? {} : { body: JSON.stringify(json) }) });
    // The request's background work, as a Worker's `waitUntil` runs it, has reached the send or finished before the test reads it.
    const behind = background.slice(before);
    if (behind.length > 0) await Promise.race([Promise.allSettled(behind), new Promise<void>((wake) => woken.push(wake))]);
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

/** Who Google says signed in. */
export interface GoogleIdentity {
  sub: string;
  email: string;
}

/** A JWT with no signature: the server takes Google's id token from Google's own token endpoint, which a test answers. */
export function unsignedJwt(claims: Record<string, unknown>): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${part({ alg: "none", typ: "JWT" })}.${part(claims)}.`;
}

/** What Google's token endpoint answers: the id token's claims past the identity, and the tokens beside it. */
export interface GoogleAnswer {
  claims: Record<string, unknown>;
  tokens: Record<string, unknown>;
}

/** Google sharing the person's name and photo, which an account never keeps (account:only-needed-data-kept). */
export const GOOGLE_PROFILE: GoogleAnswer = { claims: { name: "A Real Name", picture: "https://photos.example/face.jpg" }, tokens: { access_token: "google-access" } };

/** Google sending an access token and a refresh token, which no reply ever shows. */
export const GOOGLE_TOKENS: GoogleAnswer = { claims: {}, tokens: { access_token: "google-access-token", refresh_token: "google-refresh-token" } };

/** Google's token endpoint answered by the test, with an id token for one fixed identity; every other fetch goes out as it would. */
export function stubGoogle(identity: GoogleIdentity, answer: GoogleAnswer): void {
  const real = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith("https://oauth2.googleapis.com/token")) return real(input, init);
    const idToken = unsignedJwt({ ...identity, email_verified: true, ...answer.claims, iss: "https://accounts.google.com" });
    return Promise.resolve(Response.json({ ...answer.tokens, id_token: idToken, token_type: "Bearer", expires_in: 3600 }));
  });
}

export interface GoogleRoundTrip {
  /** Where Google's callback sends the page on a success; the client's own mark unless a test names another. */
  callbackURL?: string;
  /** What Google answers; tokens and no profile unless a test names another. */
  answer?: GoogleAnswer;
  /** Runs once Google is stubbed, before the callback. */
  between?: () => void;
}

/** Google's whole round trip from the jar's browser, its token endpoint answered here. Returns the callback's reply. */
export async function googleCallback(h: Harness, jar: Jar, identity: GoogleIdentity, way: GoogleRoundTrip = {}): Promise<Response> {
  const start = await h.call("/api/auth/sign-in/social", { method: "POST", jar, json: { provider: "google", callbackURL: way.callbackURL ?? "/?google=in", errorCallbackURL: "/" } });
  const state = new URL(String((await start.json<{ url: string }>()).url)).searchParams.get("state") ?? "";
  stubGoogle(identity, way.answer ?? GOOGLE_TOKENS);
  way.between?.();
  const back = await h.call(`/api/auth/callback/google?code=stub-code&state=${state}`, { jar });
  vi.unstubAllGlobals();
  return back;
}

/** Google's whole round trip from the jar's browser. Returns where the callback sent it. */
export async function withGoogle(h: Harness, jar: Jar, identity: GoogleIdentity, way: GoogleRoundTrip = {}): Promise<URL> {
  const back = await googleCallback(h, jar, identity, way);
  return new URL(back.headers.get("location") ?? "/", SITE);
}
