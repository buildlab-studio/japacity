// What the gate reads that its configuration does not list, merged into the bindings `wrangler types` generates
// (worker-configuration.d.ts, from wrangler.jsonc; run `pnpm check:types` after changing that file). Both the
// handler and `env` from `cloudflare:workers` (the Workers tests) read this one type.
declare namespace Cloudflare {
  interface Env {
    /** Also the code in the invite link. Set with `wrangler secret put GATE_SECRET`. Unset or empty, the gate admits nobody. */
    GATE_SECRET: string;
  }
}
