// R-SERVER-040: no failure escapes to the platform's own error page. A
// request that throws is answered in JSON the client can read,
// `{ ok: false, code: "unavailable" }`, with the security headers, and the
// failure is logged once (R-SERVER-039). The status says whether trying again
// may help: 503 with `Retry-After` when the database or an upstream did not
// answer, 500 when the server itself is wrong.
import type { Context } from "hono";

import { causes, errorCode, logFailure } from "../log";
import { DEFAULT_CACHE, SECURITY_HEADERS } from "./headers";

/** Seconds a client waits before it tries again after a 503 of this kind. */
export const RETRY_AFTER_SECONDS = 5;

export type FailureStatus = 500 | 503;

/**
 * SQLSTATE classes that mean the database could not do the work now, not that the statement was wrong:
 * 08 connection exception, 40 transaction rollback (a serialization failure or a deadlock), 53 insufficient
 * resources, 57 operator intervention (a shutdown, a statement timeout), 58 system error.
 */
const TRY_AGAIN_CLASSES = new Set(["08", "40", "53", "57", "58"]);
/** A socket that did not connect or was cut. */
const SOCKET_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);
/** What pg says when the connection ends under a statement. */
const CUT_OFF = /^Connection terminated|not queryable|timeout exceeded when trying to connect/i;

/**
 * 503 when the database or an upstream did not answer: the connection was refused (`DatabaseUnavailable`
 * from `@japacity/db`), a socket code, pg's words for a cut connection, or a SQLSTATE of a class above.
 * 500 for everything else, a Postgres error about the statement itself included: trying again would not help.
 */
export function failureStatus(error: unknown): FailureStatus {
  const code = errorCode(error);
  if (code !== undefined) {
    if (SOCKET_CODES.has(code)) return 503;
    if (/^[0-9A-Z]{5}$/.test(code)) return TRY_AGAIN_CLASSES.has(code.slice(0, 2)) ? 503 : 500;
  }
  for (const link of causes(error)) {
    if (!(link instanceof Error)) continue;
    if (link.name === "DatabaseUnavailable" || CUT_OFF.test(link.message)) return 503;
  }
  return 500;
}

const DETAIL: Record<FailureStatus, string> = {
  503: "The game's server could not reach its database. Try again shortly.",
  500: "Something broke on the game's server.",
};

/**
 * The body of a failure. Not one of the game's refusals (`ServerCode`): nothing the player did is refused, and the
 * client shows its trouble card for it (engine.md R-ENGINE-015).
 */
export interface ServerFailure {
  ok: false;
  code: "unavailable";
  detail: string;
  /** Seconds, on a 503 only. */
  retryAfter?: number;
}

/** The reply's body for a failure of this status. */
export function unavailable(status: FailureStatus): ServerFailure {
  return { ok: false, code: "unavailable", detail: DETAIL[status], ...(status === 503 ? { retryAfter: RETRY_AFTER_SECONDS } : {}) };
}

/** R-SERVER-040: the reply for a failure, with the security headers of R-SERVER-034, `no-store`, and `Retry-After` on a 503. */
export function failureReply(status: FailureStatus): Response {
  const headers = new Headers({ ...SECURITY_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": DEFAULT_CACHE });
  if (status === 503) headers.set("retry-after", String(RETRY_AFTER_SECONDS));
  return new Response(JSON.stringify(unavailable(status)), { status, headers });
}

/**
 * What the Worker hands the app as its bindings for one request (worker.ts): whether the request's database
 * refused the connection or dropped it. The auth library catches a database's failure and throws its own error
 * without the cause, so the error alone cannot always say.
 */
export interface FailureBindings {
  databaseUnavailable?: () => boolean;
}

/**
 * R-SERVER-040: `app.onError`. A failure inside a route: logged, then answered 503 when the request's database
 * refused or dropped its connection, or by `failureStatus` otherwise.
 */
export function onAppError(error: Error, c: Context): Response {
  const bindings = c.env as FailureBindings | undefined;
  const status = bindings?.databaseUnavailable?.() === true ? 503 : failureStatus(error);
  logFailure({ what: "request", method: c.req.method, path: c.req.path, status, error });
  return failureReply(status);
}

/**
 * R-SERVER-040: a request's whole answer. A failure that escapes it (one before or outside the app: the
 * database client, the auth library's set-up, the files on staging) is logged and answered 503, since the
 * app's own failures are answered inside it.
 */
export async function answered(request: Request, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    logFailure({ what: "request", method: request.method, path: request.url, status: 503, error });
    return failureReply(503);
  }
}
