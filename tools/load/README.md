# The load test

Does the authority, with its stores, take the viral peak's commands without falling over or getting anything wrong? The rules are `docs/rules/load.md`; the numbers live in `load.config.ts`.

Everything runs on your own machine. Nothing is deployed and no account is made anywhere else.

## What is here

| File | Does |
|---|---|
| `apps/server/wrangler.load.jsonc` | The load Worker: `apps/server/src/load.worker.ts` under `wrangler dev`, with the test sign-in, the fast clock, the memory stores and the server's rate limits |
| `load.config.ts` | `config.load`, the page's numbers; `scaled` for smaller runs; `planFor`, the numbers the generators read |
| `seed.ts` | load:seeded-test-accounts: accounts through the test sign-in, a character each through `POST /api/character`, played forward 0 to `warmTurns` months; writes `results/accounts.json` |
| `commands.k6.js` | load:constant-rate-command-mix, load:some-commands-sent-stale and load:peak-reads-reported-only: the two scenarios for k6 |
| `drive.ts` | The same scenarios from Node, for a run without k6. The gate is k6's (load:arrival-rate-generator) |
| `pick.js` | The seeded picks both generators share: account, kind, stale, which legal command, what a reply counts as |
| `pass.ts` | load:main-scenario-pass-thresholds: the pass rule |
| `verify.ts` | load:correctness-checked-after-run: every character replayed from its seed in Node, the ledger, the versions, the snapshots |
| `summary.ts`, `run.ts`, `run.sh` | load:connection-errors-counted-apart, load:run-summary-recorded: one run end to end, and its summary in `results/` |

The load Worker's own routes (`apps/server/src/routes/load.ts`) answer 404 unless `testing.testLogin` is on, and the production Worker never mounts them.

## Running it

k6 is a standalone tool, never a dependency of this repository (load:arrival-rate-generator): `brew install k6`.

```sh
# 1. The load Worker, in its own terminal. Its state lives in memory: restarting it, or editing a file it bundles, empties it.
cd apps/server && ./node_modules/.bin/wrangler dev -c wrangler.load.jsonc --port 8787 --log-level warn

# 2. Seed (from the repository root). --scale 10 is a tenth of the target.
pnpm tsx tools/load/seed.ts --scale 10

# 3. The main scenario, then the reads scenario (reported, not a gate). --tool node runs without k6.
tools/load/run.sh --scale 10
tools/load/run.sh --scale 10 --scenario reads

# Verification alone, at any time.
pnpm tsx tools/load/verify.ts
```

`--scale 1` is the full target: 100,000 accounts at 420 commands a second. The load Worker runs on the memory stores; production's are Postgres (decision 0006).

`wrangler dev` writes `apps/server/.wrangler/`, which git and the lint skip.

## What a local run shows (a tenth of the target, memory stores)

- Every command goes through the memory store's one lock and replays up to `snapshotEvery` rows, so the Worker serves one command at a time. Numbers taken while other work loads the machine measure the machine.
- At about 350 requests a second (the reads scenario), `wrangler dev`'s own proxy in front of the Worker drops connections ("Network connection lost" in its log), and the request fails as a 5xx or a failed read. That is the local runtime's limit, not the app's; the reads scenario is reported, not a gate (load:peak-reads-reported-only).
- The view rarely offers `obligation/pay`, `setpiece/answer` or a pair command, so most of those picks are sent as a month instead. The summary lists the kinds asked for and the kinds sent.

## When it runs

After any change to the command route, the storage interfaces, the database schema or the snapshot interval. Paste the summary from `results/` into that change's description.
