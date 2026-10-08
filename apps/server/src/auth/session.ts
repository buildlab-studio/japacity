// The session reader every route is given (deps.ts `SessionReader`): the
// signed-in account from the session cookie, or null.
// https://better-auth.com/docs/concepts/session-management
import type { SessionReader } from "../deps";
import type { Auth } from "./auth";

export function sessionReader(auth: Auth): SessionReader {
  return async (request) => {
    const session = await auth.api.getSession({ headers: request.headers });
    return session === null ? null : { account: session.user.id };
  };
}
