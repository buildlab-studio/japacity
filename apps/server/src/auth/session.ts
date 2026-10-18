// The session reader every route is given (deps.ts `SessionReader`): the
// signed-in account from the session cookie, and whether that session was
// opened with a passkey (moderation:admin-view-for-admin-list), or null.
// A request's session is read once, however many of its gates and routes ask,
// and the cookies that read sets reach the browser on the reply
// (account:dead-cookie-expired-on-first-read, account:session-renewal-reaches-browser).
// https://better-auth.com/docs/concepts/session-management
// https://better-auth.com/docs/concepts/database#extending-core-schema
import { splitSetCookieHeader } from "better-auth/cookies";
import type { MiddlewareHandler } from "hono";

import type { SessionReader } from "../deps";
import type { Auth } from "./auth";

/** How a session was opened, kept on the library's session row as `signedInWith`. */
export type SignedInWith = "passkey" | "email-code" | "google" | "other";

/** The library endpoint that opened a session, as the method it stands for. A passkey's registration is not a sign-in with it. */
export function signedInWith(path: string | undefined): SignedInWith {
  if (path === "/passkey/verify-authentication") return "passkey";
  if (path === "/sign-in/email-otp") return "email-code";
  if (path === "/sign-in/social" || path?.startsWith("/callback/") === true) return "google";
  return "other";
}

type Session = Awaited<ReturnType<SessionReader>>;

/** One request's read: its session, and the `Set-Cookie` lines the library wrote while reading it. */
interface Read {
  session: Session;
  cookies: string[];
}

/** Each request's read, by the request it was made for. */
const reads = new WeakMap<Request, Promise<Read>>();

async function readSession(auth: Auth, request: Request): Promise<Read> {
  const { headers, response } = await auth.api.getSession({ headers: request.headers, returnHeaders: true });
  const session = response === null ? null : { account: response.user.id, passkey: response.session.signedInWith === "passkey" };
  return { session, cookies: splitSetCookieHeader(headers.get("set-cookie") ?? "") };
}

export function sessionReader(auth: Auth): SessionReader {
  return async (request) => {
    let read = reads.get(request);
    if (read === undefined) {
      read = readSession(auth, request);
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
