// What the page reads that its configuration does not list, merged into the bindings `wrangler types` generates
// (worker-configuration.d.ts, from wrangler.jsonc; run `pnpm check:types` after changing that file).
declare namespace Cloudflare {
  interface Env {
    /** Bound only while the waitlist is on; wrangler.jsonc keeps both bindings commented out. */
    DB?: D1Database | undefined;
    JOIN_LIMIT?: RateLimit | undefined;
  }
}
