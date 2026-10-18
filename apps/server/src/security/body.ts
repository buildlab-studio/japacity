// The largest body each route reads (R-SERVER-036).
// Every body a player sends is a few hundred bytes; the counters' batch is at
// most 16 KB (analytics.md R-ANALYTICS-003) and a beacon at most 64 KiB. The
// admin pages upload advert images as base64, at most 200 KB before encoding
// (adverts.md R-ADVERT-004). A larger body is refused before it is read. The
// two sizes are `limits.bodyBytes` and `limits.adminBodyBytes` in config.ts.
import type { ServerRejection } from "@japacity/api";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";

import type { ServerConfig } from "../config";

/** The counters' route always answers 204, whatever it dropped (R-ANALYTICS-003). */
const COUNTERS = "/api/counters";
const ADMIN = "/api/admin/";

export const TOO_LARGE_DETAIL = "The request body is too large.";

/** R-SERVER-036: refuses a body over its route's limit with 413, or 204 on the counters' route. */
export function bodyLimits(limits: Pick<ServerConfig["limits"], "bodyBytes" | "adminBodyBytes">): MiddlewareHandler {
  const limitOf = (max: number): MiddlewareHandler =>
    bodyLimit({
      maxSize: max,
      onError: (c) => (c.req.path === COUNTERS ? c.body(null, 204) : c.json<ServerRejection>({ ok: false, code: "not-legal", detail: TOO_LARGE_DETAIL }, 413)),
    });
  const player = limitOf(limits.bodyBytes);
  const admin = limitOf(limits.adminBodyBytes);
  return (c, next) => (c.req.path.startsWith(ADMIN) ? admin(c, next) : player(c, next));
}
