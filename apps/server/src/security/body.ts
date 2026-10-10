// The largest body each route reads. Every body a
// player sends is a few hundred bytes; the counters' batch is at most 16 KB
// (analytics.md R-ANALYTICS-003) and a beacon at most 64 KiB. The admin pages
// upload advert images as base64, at most 200 KB before encoding (adverts.md
// R-ADVERT-004). A larger body is refused before it is read.
// the two numbers would sit in config.ts, which the lead owns.
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";

import type { ServerRejection } from "../types";

export const PLAYER_BODY_BYTES = 64 * 1024;
export const ADMIN_BODY_BYTES = 1024 * 1024;

/** The counters' route always answers 204, whatever it dropped (R-ANALYTICS-003). */
const COUNTERS = "/api/counters";
const ADMIN = "/api/admin/";

export const TOO_LARGE_DETAIL = "The request body is too large.";

/** Refuses a body over its route's limit with 413, or 204 on the counters' route. */
export function bodyLimits(): MiddlewareHandler {
  const limitOf = (max: number): MiddlewareHandler =>
    bodyLimit({
      maxSize: max,
      onError: (c) => (c.req.path === COUNTERS ? c.body(null, 204) : c.json<ServerRejection>({ ok: false, code: "not-legal", detail: TOO_LARGE_DETAIL }, 413)),
    });
  const player = limitOf(PLAYER_BODY_BYTES);
  const admin = limitOf(ADMIN_BODY_BYTES);
  return (c, next) => (c.req.path.startsWith(ADMIN) ? admin(c, next) : player(c, next));
}
