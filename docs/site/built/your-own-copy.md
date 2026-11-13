# Run your own copy

The code is open, and you may run your own copy of the game under the licences in `LICENSES.md`. A copy needs its own operator, its own domain, its own database, its own keys and its own accounts. This page lists every value that belongs to one deployment and where it is changed, in the order you meet them. It names files, not values: whatever this project's own deployment uses is already in those files, and the secrets are in none of them.

::: info What stays out of the repository
Secrets live only in Cloudflare (`wrangler secret put`) and in GitHub's environments. Settings for one machine live in git-ignored files: `.env.local` at the root, `.dev.vars` beside the Worker's `wrangler.jsonc`, and `.neon`. The committed examples, `.env.example` and `apps/server/.dev.vars.example`, name every variable with a placeholder. `pnpm check:scrub` fails if an email address, a 32-hex id outside the server's `wrangler.jsonc`, a Turnstile key, a Google OAuth client, a Cloudflare account id or an admin account list is committed anywhere (`tools/check/scrub.ts` names each and where it may stand).
:::

To play on your own machine, none of this is needed: `pnpm dev` runs the offline game, and `pnpm dev:full` the whole online game with local values ([Working on it](./working.md)).

## 1. The operator

`packages/content/src/legal/legal.operator.ts` holds who runs the game: a name, a town and a country, and the one address for help and privacy requests. The terms of play and the privacy notice read it from there and from nowhere else. Replace all three with your own before anyone else plays your copy; the legal pages then name you.

## 2. The repository address and the official accounts

- `packages/content/src/legal/legal.repository.ts`: the public repository, which the Credits screen and the terms link to, and the addresses of `LICENSES.md` and the assets register built from it.
- `packages/content/src/share/share.data.ts`: the official accounts, one per platform, which the official accounts page lists. Set your own, or `null` where you have none.
- `apps/client/public/official/index.html`: the official accounts page itself.
- `.github/workflows/deploy-staging.yml` and `deploy-production.yml`: the guard `github.repository == '...'` names the repository the deploy jobs run in. Set your own, or the jobs never run.
- `.github/CODEOWNERS`: the GitHub account that reviews the protected files.

## 3. The domain and the routes

- `apps/server/wrangler.jsonc`: the game's Worker. `routes` (a Custom Domain) and `vars.SITE_URL` at the top level are production; `env.staging` has its own of each. `SITE_URL` must be a bare https origin, and its host becomes the passkeys' relying party, which can never change once a real passkey exists ([From the browser to Postgres](./infrastructure.md)).
- `packages/content/src/share/share.text.ts`: the address the share cards print.
- `tools/check/scrub.ts`: `OWN_DOMAINS`, the domain whose published addresses the scrub check lets through.
- The tests pin the shipped addresses (`apps/server/src/wrangler.test.ts` and others: search for the domain), so they change with the routes in the same pull request.

## 4. The database: Neon and Hyperdrive

- Make a Postgres 18 database with a branch (or a database) for each environment. Neon is what this project uses; any Postgres that Hyperdrive reaches works. Its connection strings go only in a git-ignored `.env.local` and into Hyperdrive, never into a file.
- The migrations in `packages/db/migrations/` are applied to each by `db:migrate` in `packages/db`, with the branch's direct connection string for the role that owns the schema (the migrator role; the role the Worker connects as through Hyperdrive cannot write the schema or drizzle's journal) in `DATABASE_URL_UNPOOLED`. Each deploy does it first (section 10); by hand, run `pnpm --filter @japacity/db db:migrate` from the root with that variable set before you build and deploy.
- Make two Hyperdrive configurations per environment with `wrangler hyperdrive create`: one with caching off (`GAME_DB`) and one with caching on (`CACHED_DB`). Write their ids into `hyperdrive` in `apps/server/wrangler.jsonc`: the top level for production and `env.staging` for staging. The production deploy refuses to run while a `REPLACE_WITH_` placeholder is left in the file. These ids are not secret: without your account's API token they open nothing.
- Set `placement.region` in `apps/server/wrangler.jsonc`, at the top level and in `env.staging`, to your database's cloud region in the form `aws:eu-west-2` (Neon's London region, this project's), so the Worker runs near the database (server:worker-placed-near-database). For a database outside AWS, GCP and Azure, Cloudflare's placement page offers `placement.host` instead.
- `neon.ts` at the root is the config Neon's own tooling reads. `.neon` (git-ignored) links one machine to one Neon project.

## 5. Turnstile

Make a Turnstile widget in your Cloudflare dashboard for each environment's host. Its two halves go to two places:

- The site key is public: it is in the page. It goes into the client's build as `VITE_TURNSTILE_SITE_KEY`, from the GitHub environment's variables.
- The secret key goes into the Worker: `wrangler secret put TURNSTILE_SECRET_KEY` (add `--env staging` for staging).

The local stack uses Cloudflare's always-pass test keys, which `.env.example` holds.

## 6. Google sign-in and the email codes

Make an OAuth client in Google's console for each environment, with `https://<your host>/api/auth/callback/google` as its redirect address. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Worker secrets. Google sign-in does not work on the local stack; sign in with an email code there.

The email codes and notices go through Cloudflare Email Service, which needs the Workers Paid plan and no secret. Onboard a sending subdomain of your domain for Email Sending in your Cloudflare dashboard, then put your sender in two places, and your reply address in `REPLY_TO` beside it: `SENDER` in `apps/server/src/mail/mail.ts`, and `allowed_sender_addresses` of the `MAIL` binding in `apps/server/wrangler.jsonc`, at the top level and in `env.staging`. Its test holds the two equal. Without the binding the Worker sends no mail.

## 7. Web Analytics

Cloudflare Web Analytics counts page views with no cookie. Add your site in your Cloudflare dashboard and take its site token:

- For the game: `VITE_ANALYTICS_TOKEN` in the GitHub environment's variables. Empty, the page carries no beacon.

## 8. The admin accounts

The admin page is open only to the accounts in the Worker secret `ADMIN_ACCOUNTS`: comma-separated account ids, each from a session that has shown its passkey (server:ledger-alarm-lists-suspects, moderation:admin-view-for-admin-list). No file names it and no deploy passes it, so no account id is ever committed or shown in the dashboard as a plain variable, and a copy starts with no admin. It is set once per environment.

1. Deploy, sign up, and add a passkey to your account.
2. Read your account id: open `https://<your host>/api/account` in the same browser while signed in; it is the reply's `account.id`.
3. From `apps/server`, run `pnpm exec wrangler secret put ADMIN_ACCOUNTS` (add `--env staging` for staging) and give the id when wrangler asks (several ids are separated by commas). Never type it on the command line itself. The secret takes effect at once, as a new version of the Worker, and every later deploy keeps it.

To change the list, put the secret again; to close the page to everyone, `pnpm exec wrangler secret delete ADMIN_ACCOUNTS`. On the local stack, write `ADMIN_ACCOUNTS` with your local account's id in `.env.local`.

## 9. The Worker secrets

Each environment has its own set, made once and set with `wrangler secret put <NAME>` from `apps/server` (add `--env staging` for staging). A staging secret is never a production one. `apps/server/.dev.vars.example` lists them with what each is for.

| Secret | What it is | How to make it |
|---|---|---|
| `WORLD_SEED` | The shared world's seed (server:hidden-values-made-once). Made once at the first deploy and never changed | `openssl rand -hex 32` |
| `BAN_SALT` | The salt of the banned identities' hashes | `openssl rand -hex 32` |
| `DRAW_TOKEN_KEY` | The key that signs the draw's ticket tokens | `openssl rand -hex 32` |
| `BETTER_AUTH_SECRET` | The auth library's signing secret | `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in | Section 6 |
| `TURNSTILE_SECRET_KEY` | The bot check's secret half | Section 5 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | The bank-full notice's web push pair and your `mailto:` address. Without all three no notice is sent | Any web push tool makes the pair |

Before the first deploy, set spending alerts in your Cloudflare account (server:spending-alerts). The bill has no cap.

## 10. GitHub: the environments and the deploys

The workflows deploy from GitHub once you have set them up; until then they deploy nothing and fail nothing.

- `.github/workflows/check.yml` runs the quick checks on every push to a pull request, and every unit test and simulated play in the merge queue and on every push to `main`, with no secrets. Turn on the merge queue in `main`'s ruleset and require `check`, `unit`, `play` and `secrets`, so a pull request merges only after the full run (decision 0040).
- `.github/workflows/deploy-staging.yml` deploys staging after every push to `main` whose check passed, and deploys the commit the check passed. It waits for `check.yml` to finish (a `workflow_run` trigger) and does nothing when the check failed or was cancelled.
- `.github/workflows/deploy-production.yml` deploys production on a release tag `v*`, or when started by hand from `main`, and only a commit on `main` that staging serves: it first reads staging's `japacity-build` meta at `STAGING_URL` and stops when the commit differs.
- `.github/workflows/browser.yml` runs the whole browser suite each night and when started by hand, with no secrets.

Each deploy runs in this order: install, migrate the environment's database (`pnpm --filter @japacity/db db:migrate` with its `DATABASE_URL_UNPOOLED`), snapshot every character from the commit the environment is running, read from its page's `japacity-build` meta (`pnpm snapshot:all` in a worktree of that commit, server:snapshot-before-deploy), build the client, deploy the Worker, then check that the root answers 200, `/api/health` answers ok and the meta carries the commit deployed. A first deploy has no page to read the live commit from, so the snapshot stops it: make the first deploy of each environment by hand (`apps/server/README.md`). The snapshot, the build and the deploy run only if the migration succeeded, so a Worker never runs against a schema behind it (server:migration-before-deploy). A migration therefore only adds: the Worker still running keeps serving beside the new schema until the new Worker is up, so a column or table is removed only in a later migration, once no deployed Worker reads it.

Each deploy job runs only in the repository its guard names, in a GitHub environment of the same name (`staging`, `production`). Make both environments in the repository's settings, and give each:

| Kind | Name | Holds |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | The environment's own API token, as below |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account id |
| Secret | `DATABASE_URL_UNPOOLED` | The environment's database branch, its direct (unpooled) connection string for the migrator role that owns the schema, never the app role's (section 4) |
| Secret | `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | Staging's Cloudflare Access service token, in both environments: staging's deploy reads its own page through it, and production's reads staging's. Unset, no Access header is sent |
| Variable | `VITE_SERVER_URL` | The environment's address, the same as its `SITE_URL` |
| Variable | `VITE_TURNSTILE_SITE_KEY` | Section 5 |
| Variable | `VITE_ANALYTICS_TOKEN` | Section 7. Optional |
| Variable | `STAGING_URL` | `production` only: staging's address, where production's deploy reads the commit staging serves |

The admin accounts are not a GitHub secret: they are the Worker's own (section 8).

Give `production` a required reviewer, so no production deploy starts without approval, and limit each environment's deployment branches: `staging` to `main`, `production` to `main` and the tags `v*`. A deploy job whose environment has no Cloudflare token stops at its first step with a notice and skips the rest. Once the Cloudflare pair is set, a missing `DATABASE_URL_UNPOOLED` is an error at the migrate step, and nothing is built or deployed. Both deploys run the wrangler version `apps/server/package.json` pins (`wranglerVersion` in each workflow; `tests/workflows.test.ts` keeps them equal).

### The API token

Make one token per GitHub environment, so a staging token never deploys production and either can be revoked alone. Cloudflare's "Workers roles and permissions" page (read 11 Oct 2026) names what a deploy needs. In the dashboard, Manage account, Account API tokens, Create Token, Create Custom Token:

| Permission | Scope | Why |
|---|---|---|
| Account, Workers, the `Editor` role (the older name of the same permission is Account, Workers Scripts, Edit) | Your one account, the Workers product scope | Uploads and deploys the Worker, its files and its versions, and runs `wrangler secret put` |
| Zone, Workers Routes, Write | The one zone the environment's Custom Domain is on, and no other | Lets a deploy add, change or remove the environment's Custom Domain; Cloudflare asks for it on every affected zone |

Nothing else: Hyperdrive, the rate limits and the place objects are bindings, and deploying a Worker with bindings needs no permission on the bound resources. Custom Domains do not support per-Worker roles, so the `Editor` role is given at the Workers product scope, not to the one Worker. Set an expiry (an end date under the token's TTL) of at most a year and write the date down; a deploy with an expired token fails at its wrangler step and changes nothing. Creating a new Worker needs the `Admin` role, so make each Worker once by hand (`pnpm exec wrangler deploy`, signed in as yourself) before the token's first deploy.

A fork of this repository cannot deploy this project: its jobs are skipped by the guard, and it never sees this repository's environments. To deploy from your fork, change the guard to your repository and set up your own environments as above.

## 11. The page's content policy

`apps/client/public/_headers` gives the page two content policies (server:csp-reports-to-own-origin). `Content-Security-Policy` is enforced: the browser refuses anything it does not allow. `Content-Security-Policy-Report-Only` beside it is the same policy made stricter (Trusted Types, and inline styles only by the hashes the build writes in); it refuses nothing and reports what it would have refused. Both report to `/api/csp-report` on your own host, which logs one line per report and counts it. The report addresses are paths, so the file needs no change for your domain. If your copy loads anything from another host, add that host to the directive that needs it in both policies. To stop enforcing, rename `Content-Security-Policy` to `Content-Security-Policy-Report-Only`: both then only report.
