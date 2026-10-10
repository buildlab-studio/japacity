// The headers every reply of the Worker carries.
// The Worker answers JSON, the advert images and, from the auth library, one
// plain error page with inline styles, so the policy allows nothing else.
// The socket's upgrade is passed through untouched: its reply comes from the
// place object and is not the Worker's to change.
import type { MiddlewareHandler } from "hono";

/** RFC 6455: the status of a socket's upgrade. */
const SWITCHING_PROTOCOLS = 101;

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
};

/** A reply that says nothing of its caching is stored nowhere: most replies here are one player's. */
export const DEFAULT_CACHE = "no-store";

function dress(headers: Headers): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (!headers.has("cache-control")) headers.set("cache-control", DEFAULT_CACHE);
}

/** Sets the headers on the reply once the route has answered. A reply with headers that cannot change is copied first. */
export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    if (c.res.status === SWITCHING_PROTOCOLS) return;
    try {
      dress(c.res.headers);
    } catch {
      const copy = new Response(c.res.body, c.res);
      dress(copy.headers);
      c.res = copy;
    }
  };
}
