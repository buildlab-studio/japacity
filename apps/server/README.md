# The server

The server is the authority for every character online (`docs/rules/server.md`). It runs the clock and the world on a schedule (`docs/rules/clock.md`) and holds accounts (`docs/rules/account.md`) and the draw (`docs/rules/lottery.md`). It is Hono on Cloudflare Workers; the stack is pinned in `docs/decisions/0006-the-online-stack.md`.

## Layout

| File | What it holds |
|---|---|
| `packages/api/src/reply.ts` | `ServerCode`, `ServerRejection`, `ClockView` and `ServerReply`; the other files in `packages/api/src/` hold every route's request and reply (decision 0027) |
| `src/config.ts` | Every number the rule pages put in config, the advert regions, the test switches. Only the maintainer changes it |
| `src/dependencies.ts` | What a route is given. Only the maintainer changes it |
| `src/app.ts` | `makeApp(deps)`, which mounts the routes |
| `src/index.ts` | The Worker, its bindings and the scheduled handler |
| `src/worker.ts` | Each request's database client (opened on first use) and the app over it |
| `src/log.ts` | The one log line (server:shared-observability-block) |
| `src/security/fail.ts` | The answer to a failure (server:no-platform-error-page) |

Accounts live in `src/auth/`, `src/account/`, `src/routes/{auth,age,account}.ts` and `src/scheduled/deletion.ts`:

- Better Auth 1.7 with email codes, Google and passkeys.
- The age screen and the bot check at `POST /api/age`.
- Deletion at `DELETE /api/account`, finished by the daily job.

## Tests

- On Node with in-memory stores: `pnpm vitest run --project server`.
- The tests that need the Workers runtime (`*.workers.test.ts`, the place object's among them) run in it through the Cloudflare Vitest plugin: `pnpm vitest run --project server-workers`.

## How the Worker serves the game

- One Worker is the whole game. It serves the client's build (`../client/dist`) as static assets and runs its own code only for `/api/*`. The page and the API share one origin, so the cookies stay first party and there is no CORS. Build the client before a deploy or `wrangler dev`.
- Staging differs (server:production-and-staging): its Worker runs first for every path and serves the client's files itself through the `ASSETS` binding, so it can mark every reply noindex. A page or a file still opens no database client.
- `wrangler.jsonc` holds both environments' Hyperdrive ids. An id is not a secret: the connection string lives inside the Hyperdrive configuration.

## Backups

account:backups-never-restore-deleted: no restore brings a deleted account back into play. After any restore, and before the server takes requests, re-run every deletion whose audit row (`deletions`, by account hash) was recorded since the backup was taken.

## The guest clean-up

account:idle-guests-cleaned-by-hand. No schedule removes guest lives. The operator runs this tool by hand, from the repository root:

```sh
# List the guest accounts with no play for 90 days. Nothing is changed.
DATABASE_URL=postgres://... pnpm guests:clean --idle-days 90

# The same list, then remove them.
DATABASE_URL=postgres://... pnpm guests:clean --idle-days 90 --apply
```

- Without `--idle-days` it uses the setting `account.guestIdleDays` (90, a working number).
- A guest is idle when its last play (`lastPlayedAt`: its start, its new life, or its last command) is strictly more than that many days ago.
- Secured accounts are never listed or removed.
- `--apply` removes each listed guest the same way as a player's own deletion (account:deleted-data-removed-within-month): the deletion is recorded with its audit hash and due at once, and the deletion job removes the account, its sessions, its character and every save and log row. The last line gives the number of deletions completed, which includes any other deletion already due that day.
- It needs only `DATABASE_URL`. It sends no email and signs no cookie.

The code is `src/account/clean.ts`, tested on the memory stores in `clean.test.ts` beside it. The entry point is `src/account/clean.main.ts`.

## The addresses

| | Production | Staging |
|---|---|---|
| `SITE_URL` | `https://japacity.app` | `https://staging.japacity.app` |
| Worker, route | `japacity-server`, Custom Domain `japacity.app` | `japacity-server-staging` (`--env staging`), Custom Domain `staging.japacity.app` |
| Passkeys' relying party id (account:passkey-needs-signed-in-session) | `japacity.app` | `staging.japacity.app` |
| Turnstile widget's hostname (account:bot-check-on-guest-creation) | `japacity.app` | `staging.japacity.app` |
| Google OAuth redirect URI | `https://japacity.app/api/auth/callback/google` | `https://staging.japacity.app/api/auth/callback/google` |
| Invite links | `https://japacity.app/invite/<code>` | `https://staging.japacity.app/invite/<code>` |
| Crons (clock:cron-stores-missing-ticks, server:production-and-staging) | `*/5 * * * *` (no `TICK_CRON`) and `0 0 * * *` | `*/30 * * * *` (its `TICK_CRON`, standing in for the five-minute one) and `0 0 * * *` |
| Search engines (server:production-and-staging) | the platform serves the files; no tag | `NOINDEX`: `X-Robots-Tag` on every reply, `/robots.txt` disallows all |
| workers.dev address, preview URLs | off | off, set again in its own block |

`SITE_URL` is the only address the server trusts. It is used as:

- Better Auth's `baseURL` and its one trusted origin;
- the passkeys' relying party (its host, from `relyingPartyOf` in `src/auth/auth.ts`, which refuses an address that is not a bare https origin);
- the bot check's host;
- the origin checked on writes.

A passkey is bound to its relying party id for good, so neither id may change once a real passkey exists. `japacity.com`, `www.japacity.com`, `www.japacity.app` and `staging.japacity.com` only redirect (redirect rules on those zones).

## Steps in the accounts

- server:spending-alerts: the bill has no cap, so set spending alerts in the Cloudflare account, for example at $50 and $200 a month.
- **Admin page** (server:ledger-alarm-lists-suspects): set the admin's own account id as the Worker secret `ADMIN_ACCOUNTS` in each environment. From this folder run `pnpm exec wrangler secret put ADMIN_ACCOUNTS`, then again with `--env staging`, and type the id at wrangler's prompt. Every deploy keeps it; `wrangler.jsonc` and the workflows never name it. Without it the page does not exist for anyone.
- **Deploys** run from GitHub (`.github/workflows/deploy-*.yml`), each with the wrangler version `package.json` pins:
  - Staging deploys after every push to `main` whose check passed.
  - Production deploys on a release tag `v*` on the commit staging serves, once the `production` environment's reviewer approves the run. The run stops first unless its commit is on `main` and is the commit in staging's `japacity-build` meta (server:production-and-staging).
  - Each deploy, in order: migrates the environment's database; snapshots every character from the commit the environment is running (server:snapshot-before-deploy); builds the client; deploys the Worker; then checks, up to six times five seconds apart, that the root answers 200, `/api/health` answers ok and the page's meta carries the commit deployed.
  - The GitHub environment's `DATABASE_URL_UNPOOLED` secret is that branch's direct string for the migrator role, never the app role's (server:migration-before-deploy).
- **Deploying by hand** (the fallback), in the same order, each step only if the one before succeeded:
  1. From the repository root, with the branch's migrator string in `DATABASE_URL_UNPOOLED` (as `.env.local` holds it after `neon link`; `set -a; . ./.env.local; set +a`), run `pnpm --filter @japacity/db db:migrate`.
  2. Run `pnpm snapshot:all` from a worktree of the commit the environment is running (its page's `japacity-build` meta).
  3. Build the client for the address it will run on, with `VITE_SERVER_URL` set to that address.
  4. From this folder run `pnpm exec wrangler deploy` (production) or `pnpm exec wrangler deploy --env staging`.
  5. Check the root, `/api/health` and the meta as the workflows do.

  A migration only adds, because the old Worker keeps serving beside it until the new one is up.
- **Content policies** (server:csp-reports-to-own-origin): the page has two, in `apps/client/public/_headers`. `Content-Security-Policy` is enforced. `Content-Security-Policy-Report-Only` is the same policy made stricter (Trusted Types, inline styles only by the build's hashes) and only reports. Both report to `POST /api/csp-report`. The counter `client/csp-blocked` keys each report by `enforce` or `report`, its directive and the kind of thing blocked.
  1. Read the reports: the Worker's logs filtered on `"event":"csp-report"`, and `client/csp-blocked`. An `enforce` row is something the page refused. A kind of `extension` is a visitor's browser extension and needs nothing.
  2. If something the game needs was refused, add its source to that directive in both policies, with the reason in the comment above them, and deploy.
  3. To roll back at once, rename `Content-Security-Policy` to `Content-Security-Policy-Report-Only` and deploy. The platform joins the two report-only lines into two policies on one header, so a browser refuses nothing and both still report.
  4. When a week of `report` rows is quiet, the stricter policy replaces the enforced one: rename its line to `Content-Security-Policy` and remove the old line. Deploy staging, play it through once on a phone (the bot check, the models, the beacon, signing in), then production.
- Every value that belongs to one deployment, for anyone running their own copy: `docs/site/built/your-own-copy.md`.
