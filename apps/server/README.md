# The server

The server is the authority for every character online (`docs/rules/server.md`). It runs the clock and the world on a schedule (`docs/rules/clock.md`) and holds accounts (`docs/rules/account.md`) and the draw (`docs/rules/lottery.md`). It is Hono on Cloudflare Workers; the stack is pinned in `docs/decisions/0006-the-online-stack.md`.

This README is for whoever runs the server: its files, its tests, and the jobs done by hand. How it is hosted is [From the browser to Postgres](../../docs/site/built/infrastructure.md); how the code works is [The server and the data](../../docs/site/built/server.md).

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

One Worker is the whole game. It serves the client's build (`../client/dist`) as static assets and runs its own code only for `/api/*`, so build the client before a deploy or `wrangler dev`. Staging serves the files through the Worker instead (server:production-and-staging).

## Backups

After any restore, and before the server takes requests, re-run every deletion whose audit row (`deletions`, by account hash) was recorded since the backup was taken (account:backups-never-restore-deleted).

## The guest clean-up

No schedule removes guest lives (account:idle-guests-cleaned-by-hand). The operator runs this tool by hand, from the repository root:

```sh
# List the guest accounts with no play for 90 days. Nothing is changed.
DATABASE_URL=postgres://... pnpm guests:clean --idle-days 90

# The same list, then remove them.
DATABASE_URL=postgres://... pnpm guests:clean --idle-days 90 --apply
```

- Without `--idle-days` it uses the setting `account.guestIdleDays`.
- A guest is idle when its last play (`lastPlayedAt`: its start, its new life, or its last command) is strictly more than that many days ago.
- Secured accounts are never listed or removed.
- `--apply` removes each listed guest the same way as a player's own deletion (account:deleted-data-removed-within-month): the deletion is recorded with its audit hash and due at once, and the deletion job removes the account, its sessions, its character and every save and log row. The last line gives the number of deletions completed, which includes any other deletion already due that day.
- It needs only `DATABASE_URL`. It sends no email and signs no cookie.

The code is `src/account/clean.ts`, tested on the memory stores in `clean.test.ts` beside it. The entry point is `src/account/clean.main.ts`.

## The addresses

Each environment's Worker, address, crons and the other values that differ between production and staging are in [Production and staging](../../docs/site/built/infrastructure.md#production-and-staging).

## Steps in the accounts

- server:spending-alerts: the bill has no cap, so set spending alerts in the Cloudflare account, for example at $50 and $200 a month.
- **Admin page** (server:ledger-alarm-lists-suspects): the Worker secret `ADMIN_ACCOUNTS` in each environment, set by hand with `pnpm exec wrangler secret put ADMIN_ACCOUNTS` from this folder (again with `--env staging`). Without it the page does not exist for anyone. How to find the account id, and how to change or remove the list: section 8 of [Run your own copy](../../docs/site/built/your-own-copy.md).
- **Deploys** run from GitHub (`.github/workflows/deploy-*.yml`): what each environment deploys and when is server:production-and-staging, and the order of a deploy is server:migration-before-deploy.
- **Deploying by hand** is the fallback, and how each environment's first deploy is made. Keep the order of server:migration-before-deploy, each step only if the one before succeeded:
  1. From the repository root, with the branch's migrator string in `DATABASE_URL_UNPOOLED` (as `.env.local` holds it after `neon link`; `set -a; . ./.env.local; set +a`), run `pnpm --filter @japacity/db db:migrate`.
  2. Run `pnpm snapshot:all` from a worktree of the commit the environment is running (its page's `japacity-build` meta). A database with no character, as at a first deploy, needs no run (server:snapshot-before-deploy).
  3. Build the client for the address it will run on, with `VITE_SERVER_URL` set to that address.
  4. From this folder run `pnpm exec wrangler deploy` (production) or `pnpm exec wrangler deploy --env staging`.
  5. Check that the root answers 200, `/api/health` answers ok and the page's `japacity-build` meta carries the commit deployed.
- **Content policies**: the page has an enforced policy and a stricter one that only reports, both in `apps/client/public/_headers` (server:csp-reports-to-own-origin). The counter `client/csp-blocked` keys each report by `enforce` or `report`, its directive and the kind of thing blocked. To look after them:
  1. Read the reports: the Worker's logs filtered on `"event":"csp-report"`, and `client/csp-blocked`. An `enforce` row is something the page refused. A kind of `extension` is a visitor's browser extension and needs nothing.
  2. If something the game needs was refused, add its source to that directive in both policies, with the reason in the comment above them, and deploy.
  3. To roll back at once, rename `Content-Security-Policy` to `Content-Security-Policy-Report-Only` and deploy. The platform joins the two report-only lines into two policies on one header, so a browser refuses nothing and both still report.
  4. When a week of `report` rows is quiet, the stricter policy replaces the enforced one: rename its line to `Content-Security-Policy` and remove the old line. Deploy staging, play it through once on a phone (the bot check, the models, the beacon, signing in), then production.
- Every value that belongs to one deployment, for anyone running their own copy: `docs/site/built/your-own-copy.md`.
