// What the Worker reads that no configuration lists, merged into the bindings `wrangler types` generates
// (worker-configuration.d.ts, from wrangler.jsonc; run `pnpm check:types` after changing that file). The
// secrets are set once per environment with `wrangler secret put`; the optional values are the overlay's and
// the local stack's, unset on every deployment. Both the handlers and `env` from `cloudflare:workers` (the
// Workers tests) read this one type.
declare namespace Cloudflare {
  interface Env {
    /** server:hidden-values-made-once: secrets of the deployment, set once with `wrangler secret put`. */
    WORLD_SEED: string;
    /** moderation:ban-survives-as-hash: the salt of the banned identities' hashes. */
    BAN_SALT: string;
    /** lottery:ticket-list-frozen-anonymously: the HMAC key of the draw's ticket tokens. */
    DRAW_TOKEN_KEY: string;
    /** server:public-defaults-run-the-game: the private overlay; unset, the public defaults run the game. */
    OVERLAY?: string;
    /** Secrets set with `wrangler secret put` (account:sign-in-without-secret, account:bot-check-on-guest-creation). */
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    TURNSTILE_SECRET_KEY: string;
    /** server:ledger-alarm-lists-suspects: the admin accounts, comma-separated account ids, a Worker secret set once per environment; unset, the admin page does not exist. */
    ADMIN_ACCOUNTS?: string;
    /** clock:full-bank-push-notification: the VAPID pair, base64url, and the address the push services can reach the game's operator at. No notice is sent without all three. */
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
    /** account:sign-in-routes-rate-limited, server:production-and-staging: `mailpit` on the local stack only; unset on every deployment, which sends through MAIL (decision 0007). */
    MAIL_TRANSPORT?: string;
    /** Mailpit's address on this machine, for MAIL_TRANSPORT=mailpit. */
    MAILPIT_URL?: string;
  }
}
