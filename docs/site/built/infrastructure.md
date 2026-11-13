# From the browser to Postgres

The online game runs on a few hosted services:

- A phone opens `japacity.app`. The game's own Worker serves the page and answers the API.
- The Worker reaches Postgres on Neon through Cloudflare Hyperdrive.
- Outside services do one job each: Turnstile checks for bots, Google signs people in, Cloudflare Email Service sends the email codes, and the browsers' push services carry the one notice the game sends.

There are two copies of all this, production and staging, which share nothing. This page covers how the pieces connect, how the two environments differ, how a deploy runs, and where each kind of secret is kept.

::: info Deploys and configuration
A merge to `main` deploys staging. A release tag `v*` deploys production once the `production` environment's reviewer approves the run (`.github/workflows/deploy-staging.yml` and `deploy-production.yml`, below). The check workflow runs with no secrets: quick checks on every push to a pull request, the full run in the merge queue (decision 0040). A fork cannot deploy this project. All configuration is in `apps/server/wrangler.jsonc`, read with [the server's rule page](../../rules/server.md) (server:production-and-staging for the two environments). Every value that belongs to one deployment is listed in [Run your own copy](./your-own-copy.md).
:::

## Overview

```mermaid
flowchart TD
  B["Phone browser"] -->|"https"| E["Cloudflare edge, japacity.app"]
  E --> GW["Game Worker on the Custom Domain"]
  GW --> AS["Static assets: the client build"]
  GW -->|"/api/*"| APP["Hono app"]
  APP --> H0["Hyperdrive GAME_DB, caching off"]
  APP -.->|"bound, unused"| H1["Hyperdrive CACHED_DB, caching on"]
  H0 --> N[("Neon Postgres, the environment's branch")]
  H1 -.-> N
  APP --> DO["Durable Objects: one per room of a place"]
  APP --> RL["Rate-limit bindings"]
  B -->|"widget"| TS["Cloudflare Turnstile"]
  APP -->|"verify the token"| TS
  B -->|"sign in"| GG["Google sign-in"]
  GG -->|"callback to /api/auth"| APP
  APP -->|"web push"| PS["The browser's push service"]
  PS --> B
```

## The game's Worker

One Worker serves the client's build and runs the API under `/api/` on the same origin.

- It answers `japacity.app` as its Custom Domain (staging: `staging.japacity.app`). It has no workers.dev address and no preview URLs.
- It needs the Node compatibility layer (`nodejs_compat`) for Better Auth and node-postgres.
- Its rate limits use Cloudflare's rate-limit bindings, which count per location (server:per-account-rate-limits, server:anonymous-limit-by-address, server:noisy-socket-closed and server:limits-are-approximate).
- Who is in a place is kept in Durable Objects, one per room.

[The server and the data](./server.md) covers the code.

## Hyperdrive: two configurations

The Worker never connects to Postgres directly. It opens one `pg` client per request through Cloudflare Hyperdrive, which keeps a pool of connections to the database, so each request's client is cheap to open. Each environment has two Hyperdrive configurations, bound under two names:

| Binding | Caching | Serves |
|---|---|---|
| `GAME_DB` | Off | Everything: game state, every store, the auth library, the jobs. A command must read what the last command wrote, so nothing here may be cached |
| `CACHED_DB` | On | Reads that may be slightly stale. By design only the world's ticks and the auth library may use it; nothing reads it |

::: warning Why caching is off for game state
Every command reads the character it is about to change and must see the last write, or the version check refuses it as stale. Decision 0006 and the server's rules keep every game read on the uncached configuration.
:::

## Postgres on Neon

Postgres 18 is hosted on Neon: one project with a branch per environment, production and staging. Each environment reaches only its own branch, through its own pair of Hyperdrive configurations, so staging cannot read or write production data. `neon.ts` at the repository root is the config file Neon's own tooling reads; it sets nothing.

```mermaid
flowchart LR
  subgraph NP["Neon project"]
    PB[("production branch")]
    SB[("staging branch")]
  end
  PW["japacity-server"] --> PH["Production Hyperdrive pair"] --> PB
  SW["japacity-server-staging"] --> SH["Staging Hyperdrive pair"] --> SB
```

Migrations:

- The schema reaches a branch through the migrations in `packages/db/migrations/`. The set starts from one file, `0000_japacity.sql`, and grows one migration at a time.
- `db:migrate` in `packages/db` applies them with the branch's direct connection string for the migrator role, which owns the schema.
- Every deploy migrates first, before the client is built and the Worker deployed, with that string as the environment's `DATABASE_URL_UNPOOLED` secret in GitHub (server:migration-before-deploy). A migration therefore only adds, so the Worker still running keeps working beside it.
- On a machine the string is kept in a git-ignored local file. It never enters the repository.

::: details Where the connection strings are
Both blocks of `apps/server/wrangler.jsonc` name their two Hyperdrive configurations by id. Neither block holds a connection string: that is stored inside the Hyperdrive configuration itself.
:::

## Production and staging

Both deployments come from one `apps/server/wrangler.jsonc`: production at the top level, staging under `env.staging`, deployed with `--env staging`. Staging sits behind Cloudflare Access. An environment does not inherit vars, bindings or the route, so staging repeats each of its own.

| | Production | Staging |
|---|---|---|
| Worker | `japacity-server` | `japacity-server-staging` |
| Host and `SITE_URL` | `japacity.app` | `staging.japacity.app` |
| Passkeys' relying party id | `japacity.app` | `staging.japacity.app` |
| Turnstile host accepted | `japacity.app` | `staging.japacity.app` |
| Tick cron | Every 5 minutes | Every 30 minutes, through its `TICK_CRON` var, so its database can sleep |
| Daily cron | 00:00 UTC | 00:00 UTC |
| Static files | Served by the platform before the Worker | Served by the Worker through its `ASSETS` binding, so every reply can be marked |
| Search engines | No tag | `NOINDEX`: `X-Robots-Tag` on every reply and a `/robots.txt` that disallows all |
| Rate-limit namespaces | Its own | Its own, so two Workers never share one count |
| Database, secrets, passkeys | Its own | Its own; nothing shared |

`SITE_URL` is the one address the server trusts. Better Auth's base address and trusted origin, the passkeys' relying party, the bot check's host and the origin check on writes all come from it. A passkey is bound to its relying party id permanently, so neither host may change once a real passkey exists.

## Deploying

A deploy has two steps per environment: build the client for the address it will run at, then deploy the Worker that serves that build.

```mermaid
flowchart TD
  B["Build the client with VITE_SERVER_URL set to the environment's address"]
  B --> C{"Which environment?"}
  C -->|"production"| D["wrangler deploy, from apps/server"]
  C -->|"staging"| E["wrangler deploy --env staging, from apps/server"]
  D --> F["The Worker serves the new build at japacity.app"]
  E --> G["The Worker serves the new build at staging.japacity.app"]
```

The build:

- The client's build reads `VITE_SERVER_URL`. With it set, the client talks to that server. A production build without it refuses to start a local game unless explicitly told to (engine:browser-authority-for-dev-only).
- It also reads `VITE_TURNSTILE_SITE_KEY`, the public half of the Turnstile pair, which is in the page, and the optional `VITE_ANALYTICS_TOKEN`.
- A build for players (every mode except development, staging included) ships no source maps; drops every `debugger` statement and every console call except `console.error` and `console.info`; leaves out the development addresses and their code; and writes the licences of the libraries it bundles to `licenses.txt` beside the page. Nothing is obfuscated beyond minifying (`apps/client/vite/shipping.plugin.ts`, read from `apps/client/vite.config.ts`).

The workflows:

- `deploy-staging.yml` starts when the `check` workflow completes on a push to `main` (a `workflow_run` trigger), runs only if that check passed, and deploys the commit the check passed.
- `deploy-production.yml` runs on a `v*` tag or by hand from `main`. It first stops unless its commit is on `main` and is the commit staging serves (server:production-and-staging).
- Each runs only in this repository, in a GitHub environment of the same name. The environment holds the Cloudflare token and account id as secrets and the build's addresses and keys as variables; `production` waits for its reviewer's approval. An environment without its Cloudflare secrets stops the job at its first step with a notice and deploys nothing.
- Each migrates the database first (server:migration-before-deploy), then snapshots every character from the commit the environment is running (server:snapshot-before-deploy), then builds the client and deploys the Worker, and finally checks that the root, `/api/health` and the page's build meta answer as the commit deployed.
- Both run the wrangler version `apps/server/package.json` pins.

The admin accounts (server:ledger-alarm-lists-suspects) are the Worker secret `ADMIN_ACCOUNTS`, set once per environment with `wrangler secret put` and kept by every deploy. Neither `wrangler.jsonc` nor a workflow names it, so no account id is in a committed file.

::: danger Before the first deploy
The bill has no cap, so spending alerts are set in the Cloudflare account before anything is deployed (server:spending-alerts). Whoever holds the account sets them; no code can.
:::

## Secrets

No secret value is ever written in the repository: not in a config file, a doc or a commit. Each environment has its own set; a staging secret is never a production one.

| Secret | What it is | Where it is kept |
|---|---|---|
| `WORLD_SEED` | The shared world's seed, made once at the first deploy (server:hidden-values-made-once) | A Worker secret, set with `wrangler secret put` |
| `BAN_SALT` | The salt of the banned identities' one-way hashes | A Worker secret |
| `DRAW_TOKEN_KEY` | The key that signs the draw's anonymous ticket tokens | A Worker secret |
| `BETTER_AUTH_SECRET` | The auth library's signing secret for sessions | A Worker secret |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The game's OAuth client for Google sign-in | Created in Google's console with the environment's callback address; copied into Worker secrets |
| `TURNSTILE_SECRET_KEY` | The private half of the Turnstile pair, used to verify tokens | The widget is made in Cloudflare; the secret half is a Worker secret, the site key goes into the client's build |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | The web push pair, and the contact address push services may use | Worker secrets. Without all three, no notice is sent. The public key is served to the client at `/api/notify/key` |
| The database role's connection string | How Hyperdrive reaches the environment's Neon branch | Inside the Hyperdrive configuration, in Cloudflare. The Worker reads it from its binding and never sees it in config |

::: tip Local files stay local
Local runs read their settings from git-ignored files: `.dev.vars` for `wrangler dev`, `.env.local` and similar for the client and the database tools, and `.neon` for the Neon link. The root `.gitignore` keeps them out. Never commit one, and never paste a value from one into a page, an issue or a commit message.
:::

## Bots, sign-in, push and email

- **Turnstile.** The client shows Cloudflare's Turnstile widget once, when a guest life is created. The server posts the token to Turnstile's verify endpoint and accepts a pass only when it was solved on its own host (account:bot-check-on-guest-creation).
- **Google sign-in.** The browser goes to Google and returns to `/api/auth/callback/google` on the same host, where Better Auth finishes the sign-in.
- **Web push.** When a character's bank fills while its player is away, the five-minute job sends one web push to each device that agreed, through the push service that device's browser named when it subscribed (clock:full-bank-push-notification). Devices are kept in `push_subscriptions` only while the setting is on.
- **Email.** The email codes and account notices go out through Cloudflare Email Service: the `send_email` binding `MAIL`, allowed one sender, `game@mail.japacity.app`, with replies to `hello@japacity.app` (account:sign-in-routes-rate-limited, decision 0007). It needs no secret. A deployment without the binding sends no email.
