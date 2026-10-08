// The session reader every route is given (deps.ts `SessionReader`): the
// signed-in account from the session cookie, and whether that session was
// opened with a passkey (R-MODERATION-012), or null.
// https://better-auth.com/docs/concepts/session-management
// https://better-auth.com/docs/concepts/database#extending-core-schema
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

export function sessionReader(auth: Auth): SessionReader {
  return async (request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return session === null ? null : { account: session.user.id, passkey: session.session.signedInWith === "passkey" };
  };
}
