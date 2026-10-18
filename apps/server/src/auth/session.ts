// The session reader every route is given (deps.ts `SessionReader`): the
// signed-in account from the session cookie, and whether that session has shown
// a user-verified passkey recently enough for the admin view
// (moderation:admin-view-for-admin-list), or null.
// A request's session is read once, however many of its gates and routes ask,
// and the cookies that read sets reach the browser on the reply
// (account:dead-cookie-expired-on-first-read, account:session-renewal-reaches-browser).
// https://better-auth.com/docs/concepts/session-management
// https://better-auth.com/docs/concepts/database#extending-core-schema
import { splitSetCookieHeader } from "better-auth/cookies";
import type { MiddlewareHandler } from "hono";

import { fromBase64Url } from "../bytes";
import type { ServerDeps, SessionReader } from "../deps";
import type { Auth } from "./auth";

/**
 * How a session was opened, kept on the library's session row as `signedInWith`. `passkey` is a passkey that checked the
 * person (its user-verified flag set); `passkey-unverified` one that only showed the phone was there.
 */
export type SignedInWith = "passkey" | "passkey-unverified" | "email-code" | "google" | "other";

/** The user-verified bit of an authenticator data's flags byte (WebAuthn Level 3, section 6.1). */
const USER_VERIFIED = 0x04;

/** The offset of the flags byte: after the 32-byte hash of the relying party id. */
const FLAGS_AT = 32;

/**
 * Whether a passkey assertion's authenticator data says the person was verified (a face, a fingerprint, a screen lock).
 * Read only once the library has verified the assertion's signature, which covers these bytes.
 */
export function userVerified(body: unknown): boolean {
  const data = (body as { response?: { response?: { authenticatorData?: unknown } } } | undefined)?.response?.response?.authenticatorData;
  if (typeof data !== "string") return false;
  try {
    return ((fromBase64Url(data)[FLAGS_AT] ?? 0) & USER_VERIFIED) !== 0;
  } catch {
    return false;
  }
}

/**
 * The library endpoint that opened a session, as the method it stands for, with the request's body for a passkey's
 * assertion. A passkey's registration is not a sign-in with it.
 */
export function signedInWith(path: string | undefined, body?: unknown): SignedInWith {
  if (path === "/passkey/verify-authentication") return userVerified(body) ? "passkey" : "passkey-unverified";
  if (path === "/sign-in/email-otp") return "email-code";
  if (path === "/sign-in/social" || path?.startsWith("/callback/") === true) return "google";
  return "other";
}

/**
 * moderation:admin-view-for-admin-list: a session has shown a passkey when a user-verified passkey opened it no more than
 * `config.admin.passkeyMs` ago. A step-up opens a new session from the passkey, so the session's own start is the
 * passkey's time.
 */
export function passkeyShown(session: { signedInWith?: unknown; createdAt: Date | string | number }, now: number, passkeyMs: number): boolean {
  if (session.signedInWith !== "passkey") return false;
  return now - new Date(session.createdAt).getTime() <= passkeyMs;
}

type Session = Awaited<ReturnType<SessionReader>>;

/** One request's read: its session, and the `Set-Cookie` lines the library wrote while reading it. */
interface Read {
  session: Session;
  cookies: string[];
}

/** Each request's read, by the request it was made for. */
const reads = new WeakMap<Request, Promise<Read>>();

/** What the reader judges a session by: the server's clock and the admin's passkey window. */
type Judge = Pick<ServerDeps, "now" | "config">;

async function readSession(auth: Auth, judge: Judge, request: Request): Promise<Read> {
  const { headers, response } = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
  const session = response === null ? null : { account: response.user.id, passkey: passkeyShown(response.session, judge.now(), judge.config.admin.passkeyMs) };
  return { session, cookies: splitSetCookieHeader(headers.get("set-cookie") ?? "") };
}

export function sessionReader(auth: Auth, judge: Judge): SessionReader {
  return async (request) => {
    let read = reads.get(request);
    if (read === undefined) {
      read = readSession(auth, judge, request);
      reads.set(request, read);
    }
    return (await read).session;
  };
}

/** A `Set-Cookie` line's cookie name. */
function cookieName(line: string): string {
  const pair = line.split(";")[0] ?? "";
  return pair.slice(0, Math.max(pair.indexOf("="), 0)).trim();
}

/**
 * account:dead-cookie-expired-on-first-read, account:session-renewal-reaches-browser: the cookies the request's
 * session read set (a dead session's cookie expired, a live one's renewed) go out on the reply, whatever its status.
 * A cookie the reply sets itself wins: a guest start or a sign-out after the read keeps its own.
 */
export function sessionCookies(): MiddlewareHandler {
  return async (c, next) => {
    const request = c.req.raw;
    await next();
    const read = reads.get(c.req.raw) ?? reads.get(request);
    if (read === undefined) return;
    const { cookies } = await read.catch(() => ({ cookies: [] as string[] }));
    if (cookies.length === 0) return;
    const own = new Set(c.res.headers.getSetCookie().map(cookieName));
    for (const line of cookies) if (!own.has(cookieName(line))) c.res.headers.append("set-cookie", line);
  };
}
