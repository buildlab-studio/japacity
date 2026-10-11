// R-SERVER-012: the admin's reads run against the players' database, so each statement of an
// admin read stops after ADMIN_STATEMENT_MS (Postgres `SET LOCAL statement_timeout` in a transaction of its own,
// `boundedHandle` in @japacity/db), and a report that heavy is answered to the admin as a plain refusal: the game
// is never slowed by one, and the admin page is never shown a server failure for it.
import { STATEMENT_TIMED_OUT } from "@japacity/db";

import { causes } from "../log";
import type { ServerRejection } from "../types";

/** The longest one statement of an admin read may run: a working value of a few seconds. */
export const ADMIN_STATEMENT_MS = 5_000;

export const ADMIN_TIMEOUT_DETAIL = `The report took longer than ${String(ADMIN_STATEMENT_MS / 1000)} seconds, so the database stopped it to keep the game quick. Ask for a shorter range, or try again later.`;

const ADMIN_PREFIX = "/api/admin/";

/** An admin read: a GET (or HEAD) under /api/admin/. Its statements run under the timeout. */
export function adminRead(request: Request): boolean {
  return (request.method === "GET" || request.method === "HEAD") && new URL(request.url).pathname.startsWith(ADMIN_PREFIX);
}

/** True when an admin route's failure is Postgres stopping a statement at the timeout (SQLSTATE 57014). */
export function adminReadTimedOut(path: string, error: unknown): boolean {
  if (!path.startsWith(ADMIN_PREFIX)) return false;
  return causes(error).some((link) => typeof link === "object" && link !== null && "code" in link && link.code === STATEMENT_TIMED_OUT);
}

/** The refusal an admin sees for it. */
export function adminTimeoutRefusal(): ServerRejection {
  return { ok: false, code: "not-possible", detail: ADMIN_TIMEOUT_DETAIL };
}
