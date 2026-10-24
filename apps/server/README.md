# The server

The authority for every character online (`docs/rules/server.md`), the clock and the world on a schedule (`docs/rules/clock.md`), accounts (`docs/rules/account.md`), the draw (`docs/rules/lottery.md`). Hono on Cloudflare Workers; the stack is pinned in `docs/decisions/0006-the-online-stack.md`.

- `ServerCode`, `ServerRejection`, `ClockView` and `ServerReply` are in `packages/api/src/reply.ts`, with every route's request and reply (decision 0027). `src/config.ts`: every number the pages put in config, the advert regions, the test switches. `src/dependencies.ts`: what a route is given. Only the maintainer changes these two.
- `src/app.ts`: `makeApp(deps)` mounts the routes. `src/index.ts`: the Worker, its bindings and the scheduled handler; `src/worker.ts`: each request's database client (opened on first use) and the app over it; `src/log.ts`: the one log line (server:shared-observability-block); `src/security/fail.ts`: the answer to a failure (server:no-platform-error-page).
- Tests run on Node with in-memory stores: `pnpm vitest run --project server`. The tests that need the Workers runtime (`*.workers.test.ts`, the place object's among them) run in it through the Cloudflare Vitest plugin: `pnpm vitest run --project server-workers`.
- `wrangler.jsonc` holds both environments' Hyperdrive ids. An id is not a secret: the connection string lives inside the Hyperdrive configuration.
- One Worker is the whole game: it serves the client's build (`../client/dist`) as static assets and runs its own code only for `/api/*`, so the page and the API share one origin, the cookies stay first party and there is no CORS. Build the client before a deploy or `wrangler dev`. Staging differs (server:production-and-staging): its Worker runs first for every path and serves the client's files itself through the `ASSETS` binding, so it can mark every reply noindex; a page or a file still opens no database client.
- Accounts (`src/auth/`, `src/account/`, `src/routes/{auth,age,account}.ts`, `src/scheduled/deletion.ts`): Better Auth 1.7 with email codes, Google and passkeys; the age screen and the bot check at `POST /api/age`; deletion at `DELETE /api/account`, finished by the daily job.
- Backups (account:backups-never-restore-deleted): no restore brings a deleted account back into play. After any restore, re-run every deletion whose audit row (`deletions`, by account hash) was recorded since the backup was taken, before the server takes requests.

## The guest clean-up

account:idle-guests-cleaned-by-hand. Guest lives are never removed by a schedule. The operator runs this tool by hand, when they decide to. From the repository root:

```sh
# List the guest accounts with no play for 90 days. Nothing is changed.
DATABASE_URL=postgres://... pnpm guests:clean --idle-days 90

# The same list, then remove them.
DATABASE_URL=postgres://... pnpm guests:clean --idle-days 90 --apply
```

- Without `--idle-days` it uses the setting `account.guestIdleDays` (90, a working number).
- A guest counts as idle when its last play (`lastPlayedAt`: its start, its new life, or its last command) is strictly more than that many days ago.
- Secured accounts are never listed and never removed.
- `--apply` removes each listed guest through the same removal as a player's own deletion (account:deleted-data-removed-within-month): the deletion is recorded with its audit hash, due at once, and the deletion job removes the account, its sessions, its character and every save and log row. The last line says how many deletions completed, which includes any other deletion already due that day.
- It needs nothing but `DATABASE_URL`. It sends no email and signs no cookie.

The work is in `src/account/clean.ts`, tested on the memory stores in `clean.test.ts` beside it; `src/account/clean.main.ts` is the entry.

## The addresses

| | Production | Staging |
|---|---|---|
| `SITE_URL` | `https://japacity.app` | `https://staging.japacity.app` |
| Worker, route | `japacity-server`, Custom Domain `japacity.app` | `japacity-server-staging` (`--env staging`), Custom Domain `staging.japacity.app` |
| Passkeys' relying party id (account:passkey-needs-signed-in-session) | `japacity.app` | `staging.japacity.app` |
| Turnstile widget's hostname (account:bot-check-on-guest-creation) | `japacity.app` | `staging.japacity.app` |
| Google OAuth redirect URI | `https://japacity.app/api/auth/callback/google` | `https://staging.japacity.app/api/auth/callback/google` |
| Invite links | `https://japacity.app/invite/<code>` | `https://staging.japacity.app/invite/<code>` |
| Crons (clock:cron-stores-missing-ticks, server:production-and-staging) | `*/5 * * * *` (no `TICK_CRON`) and `0 0 * * *` | `*/30 * * * *` (its `TICK_CRON`, standing for the five-minute one) and `0 0 * * *` |
| Search engines (server:production-and-staging) | the platform serves the files; no tag | `NOINDEX`: `X-Robots-Tag` on every reply, `/robots.txt` disallows all |
| workers.dev address, preview URLs | off | off, written again in its own block |

`SITE_URL` is the only address the server trusts: Better Auth's `baseURL` and its one trusted origin, the passkeys' relying party (its host, from `relyingPartyOf` in `src/auth/auth.ts`, which refuses an address that is not a bare https origin), the bot check's host and the origin check on writes. A passkey is bound to its relying party id for good, so neither id may change once a real passkey exists. `japacity.com`, `www.japacity.com`, `www.japacity.app` and `staging.japacity.com` only redirect (redirect rules on those zones).

## Steps in the accounts

- server:spending-alerts: the bill has no cap, so set spending alerts in the Cloudflare account, for example at $50 and $200 a month.
- Set the admin's own account id as the Worker secret `ADMIN_ACCOUNTS` of each environment to open the admin page (server:ledger-alarm-lists-suspects): `pnpm exec wrangler secret put ADMIN_ACCOUNTS` from this folder, and again with `--env staging`, typing the id at wrangler's prompt. Every deploy keeps it; `wrangler.jsonc` and the workflows never name it. Without it the page does not exist for anyone.
- Deploys run from GitHub: staging after every merge to `main` whose check passed, production on a release tag `v*` once the `production` environment's reviewer approves the run (`.github/workflows/deploy-*.yml`), each with the wrangler version `package.json` pins. Each deploy migrates the environment's database first, then builds the client, then deploys the Worker; the GitHub environment's `DATABASE_URL_UNPOOLED` secret is that branch's direct string for the migrator role, never the app role's (server:migration-before-deploy). By hand, in the same order: from the repository root, with the branch's migrator string in `DATABASE_URL_UNPOOLED` (as `.env.local` holds it after `neon link`; `set -a; . ./.env.local; set +a`), run `pnpm --filter @japacity/db db:migrate`; only if it succeeded, build the client for the address it will run on, with `VITE_SERVER_URL` set to that address; then `pnpm exec wrangler deploy` (production) or `pnpm exec wrangler deploy --env staging` from this folder. A migration only adds, since the Worker still running serves beside it until the new one is up.
- The page has two content policies in `apps/client/public/_headers` (server:csp-reports-to-own-origin). `Content-Security-Policy` is enforced; `Content-Security-Policy-Report-Only` is the same policy made stricter (Trusted Types, inline styles only by the build's hashes) and only reports. Both report to `POST /api/csp-report`. The counter `client/csp-blocked` keys each report by `enforce` or `report`, its directive and the kind of thing blocked.
  1. Read the reports: the Worker's logs filtered on `"event":"csp-report"`, and `client/csp-blocked`. An `enforce` row is something the page was refused; a kind of `extension` is a visitor's browser extension and needs nothing.
  2. Something the game needs that was refused: add its source to that directive in both policies, with the reason in the comment above them, and deploy.
  3. To roll back at once: rename `Content-Security-Policy` to `Content-Security-Policy-Report-Only` and deploy. The platform joins the two report-only lines into two policies on one header; a browser then refuses nothing and both still report.
  4. When a week of `report` rows is quiet, the stricter policy takes the enforced one's place: its line renamed to `Content-Security-Policy`, the old line removed. Deploy staging, play it through once on a phone (the bot check, the models, the beacon, signing in), then production.
- Every value that belongs to one deployment, for anyone running their own copy: `docs/site/built/your-own-copy.md`.
