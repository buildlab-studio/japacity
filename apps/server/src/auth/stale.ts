// R-ACCOUNT-021: a dead session cookie never stops a new sign-in. After every
// sign-in the auth library's anonymous link reads the session from the
// request's cookie to fold a guest in; a validly signed cookie whose session is
// gone makes it expire the session cookie the sign-in has just set, so the
// browser ends with none. The library never sees a cookie that opens nothing.
// https://better-auth.com/docs/plugins/anonymous
// https://better-auth.com/docs/concepts/cookies
import { stripSecureCookiePrefix } from "better-auth/cookies";
import type { MiddlewareHandler } from "hono";

import type { Auth } from "./auth";

/** The library's paths that open a session and run its anonymous link after: email code and Google's start, Google's return, the passkey sign-in. */
export const SIGN_IN_PATHS = ["/api/auth/sign-in/*", "/api/auth/callback/*", "/api/auth/passkey/verify-authentication"] as const;

/** The names of the library's session cookies as it names them, without the `__Secure-` or `__Host-` prefix. */
async function sessionCookieNames(auth: Auth): Promise<string[]> {
  const { sessionToken, sessionData, dontRememberToken, accountData } = (await auth.$context).authCookies;
  return [sessionToken, sessionData, dontRememberToken, accountData].map((cookie) => stripSecureCookiePrefix(cookie.name));
}

/** The `Cookie` header without the library's session cookies (chunked ones too), with or without the secure prefix; every other cookie as it came. */
function withoutSessionCookies(cookie: string, names: readonly string[]): { kept: string; dropped: boolean } {
  const pairs = cookie
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair !== "");
  const kept = pairs.filter((pair) => {
    const name = stripSecureCookiePrefix(pair.slice(0, Math.max(pair.indexOf("="), 0)).trim());
    return !names.some((own) => name === own || name.startsWith(`${own}.`));
  });
  return { kept: kept.join("; "), dropped: kept.length < pairs.length };
}

/** The headers without the library's session cookies, and whether any was there. */
async function stripped(auth: Auth, headers: Headers): Promise<{ headers: Headers; dropped: boolean }> {
  const out = new Headers(headers);
  const cookie = headers.get("cookie");
  if (cookie === null) return { headers: out, dropped: false };
  const { kept, dropped } = withoutSessionCookies(cookie, await sessionCookieNames(auth));
  // Kept even when empty: the library checks the origin of a write only when it carries a Cookie header,
  // so a request that came with cookies is checked as it would have been (https://better-auth.com/docs/reference/security).
  out.set("cookie", kept);
  return { headers: out, dropped };
}

/** The request's headers without the library's session cookies: for a request whose session is known to be dead. */
export async function headersWithoutSession(auth: Auth, headers: Headers): Promise<Headers> {
  return (await stripped(auth, headers)).headers;
}

/**
 * On the sign-in paths: a request whose session cookie opens no live session reaches the library without it.
 * A live session's cookie is left alone, so a guest still links the new way in to its life (R-ACCOUNT-023).
 * The read never refreshes the session, as the library's own read after a sign-in does not, and a failed read
 * fails the request rather than strip a cookie that may be live.
 */
export function dropDeadSession(auth: Auth): MiddlewareHandler {
  return async (c, next) => {
    const request = c.req.raw;
    const { headers, dropped } = await stripped(auth, request.headers);
    if (dropped && (await auth.api.getSession({ headers: request.headers, query: { disableRefresh: true } })) === null) {
      c.req.raw = new Request(request, { headers });
    }
    await next();
  };
}
