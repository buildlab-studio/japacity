// R-SERVER-035: writes come from the game's own page. The session
// cookie is `SameSite=Lax` (R-ACCOUNT-006), which stops another site's form,
// but not a page on another part of the same site, such as another subdomain.
// So a request that changes something and names an origin must name the
// game's own. A request that names none is not a browser's on another site's
// behalf and carries no one's cookie, so it goes on. The auth library's own
// routes check their origin themselves against the same address.
import type { ServerRejection } from "@japacity/api";
import type { MiddlewareHandler } from "hono";

/** The methods that only read. Everything else is a write. */
const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/** The auth library checks its own requests' origin against `trustedOrigins` (auth/auth.ts). */
const OWN_CHECK = "/api/auth/";

export const OTHER_SITE_DETAIL = "This request came from another site.";

/** True when a write with these headers is from somewhere other than `site`. */
export function fromElsewhere(site: string, headers: Headers): boolean {
  const origin = headers.get("origin");
  if (origin !== null) return origin !== site;
  // A browser that sends no origin still says where the request came from.
  return headers.get("sec-fetch-site") === "cross-site";
}

/** Refuses a write under /api/ whose origin is not `siteUrl`'s, before any route reads it. */
export function sameOriginWrites(siteUrl: string): MiddlewareHandler {
  const site = new URL(siteUrl).origin;
  return async (c, next) => {
    if (READS.has(c.req.method) || c.req.path.startsWith(OWN_CHECK) || !fromElsewhere(site, c.req.raw.headers)) {
      await next();
      return undefined;
    }
    return c.json<ServerRejection>({ ok: false, code: "not-legal", detail: OTHER_SITE_DETAIL }, 403);
  };
}
