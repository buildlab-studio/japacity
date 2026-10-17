// What the Worker reads that no configuration lists, merged into the bindings `wrangler types` generates
// (worker-configuration.d.ts, from wrangler.jsonc; run `pnpm check:types` after changing that file). The
// secrets are set once per environment with `wrangler secret put`; the optional values are the overlay's and
// the local stack's, unset on every deployment. Both the handlers and `env` from `cloudflare:workers` (the
// Workers tests) read this one type.
declare namespace Cloudflare {
  interface Env {
    /** R-SERVER-016: secrets of the deployment, set once with `wrangler secret put`. */
    WORLD_SEED: string;
    /** R-MODERATION-018: the salt of the banned identities' hashes. */
    BAN_SALT: string;
    /** R-LOTTERY-008: the HMAC key of the draw's ticket tokens. */
    DRAW_TOKEN_KEY: string;
    /** R-SERVER-018: the private overlay; unset, the public defaults run the game. */
    OVERLAY?: string;
    /** Secrets set with `wrangler secret put` (R-ACCOUNT-001, 013). */
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    TURNSTILE_SECRET_KEY: string;
    /** R-SERVER-012: the admin accounts, comma-separated account ids, a Worker secret set once per environment; unset, the admin page does not exist. */
    ADMIN_ACCOUNTS?: string;
    /** R-CLOCK-031: the VAPID pair, base64url, and the address the push services can reach the game's operator at. No notice is sent without all three. */
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
    /** R-ACCOUNT-014, R-SERVER-038: `mailpit` on the local stack only; unset on every deployment, which sends through MAIL (decision 0031). */
    MAIL_TRANSPORT?: string;
    /** Mailpit's address on this machine, for MAIL_TRANSPORT=mailpit. */
    MAILPIT_URL?: string;
  }
}
