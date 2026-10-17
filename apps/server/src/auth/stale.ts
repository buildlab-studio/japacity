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
function withoutSessionCookies(cookie: string, names: readonly string[]): string {
  return cookie
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => {
      const name = stripSecureCookiePrefix(pair.slice(0, Math.max(pair.indexOf("="), 0)).trim());
      return pair !== "" && !names.some((own) => name === own || name.startsWith(`${own}.`));
    })
    .join("; ");
}

/** The request's headers without the library's session cookies: for a request whose session is known to be dead. */
export async function headersWithoutSession(auth: Auth, headers: Headers): Promise<Headers> {
  const cookie = headers.get("cookie");
  const out = new Headers(headers);
  if (cookie === null) return out;
  const kept = withoutSessionCookies(cookie, await sessionCookieNames(auth));
  if (kept === "") out.delete("cookie");
  else out.set("cookie", kept);
  return out;
}

/**
 * On the sign-in paths: a request whose session cookie opens no live session reaches the library without it.
 * A live session's cookie is left alone, so a guest still links the new way in to its life (R-ACCOUNT-023).
 */
export function dropDeadSession(auth: Auth): MiddlewareHandler {
  return async (c, next) => {
    const request = c.req.raw;
    const headers = await headersWithoutSession(auth, request.headers);
    if (headers.get("cookie") !== request.headers.get("cookie") && (await auth.api.getSession({ headers: request.headers })) === null) {
      c.req.raw = new Request(request, { headers });
    }
    await next();
  };
}
