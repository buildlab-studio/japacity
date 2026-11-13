# The load test

The load test checks that the authority, with its stores, takes the peak's commands without falling over or getting anything wrong. It is for whoever changes the command route or the stores. The rules are [`docs/rules/load.md`](../../docs/rules/load.md); the numbers are in `load.config.ts`.

Everything runs on your own machine. Nothing is deployed and no account is made anywhere else.

## Files

| File | What it does |
|---|---|
| `apps/server/wrangler.load.jsonc` | The load Worker: `apps/server/src/load.worker.ts` under `wrangler dev`, with the test sign-in, the fast clock, the memory stores and the server's rate limits |
| `load.config.ts` | `config.load`, the rule page's numbers; `scaled` for smaller runs; `planFor`, the numbers the generators read |
| `seed.ts` | load:seeded-test-accounts: makes accounts through the test sign-in and a character each through `POST /api/character`, plays each forward 0 to `warmTurns` months, and writes `results/accounts.json` |
| `commands.k6.js` | load:constant-rate-command-mix, load:some-commands-sent-stale and load:peak-reads-reported-only: the two scenarios for k6 |
| `drive.ts` | The same scenarios from Node, for a run without k6. The gate is k6's run (load:arrival-rate-generator) |
| `pick.js` | The seeded picks both generators share: account, kind, stale or not, which legal command, what a reply counts as |
| `pass.ts` | load:main-scenario-pass-thresholds: the pass rule |
| `verify.ts` | load:correctness-checked-after-run: replays every character from its seed in Node, and checks the ledger, the versions and the snapshots |
| `summary.ts`, `run.ts`, `run.sh` | load:connection-errors-counted-apart, load:run-summary-recorded: one run end to end, and its summary in `results/` |
| `codes.ts` | The emailed sign-in code under load, measured apart from the commands; its header gives the command and the Worker it needs |
| `http.ts` | The requests to the load Worker from Node, for the seeder, the driver and the verifier |

The load Worker's own routes (`apps/server/src/routes/load.ts`) answer 404 unless `testing.testLogin` is on, and the production Worker never mounts them.

## Running it

k6 is a standalone tool, never a dependency of this repository (load:arrival-rate-generator). Install it with `brew install k6`.

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

- `run.sh` also takes `--minutes`, `--base` and `--no-verify` (see the usage line in `run.ts`).
- `--scale 1` is the full target: `config.load.accounts` accounts at `config.load.commandsPerSecond` (the Numbers table of [the load rules](../../docs/rules/load.md)).
- The load Worker runs on the memory stores; production's stores are Postgres (decision 0006).
- `wrangler dev` writes `apps/server/.wrangler/`, which git and the lint ignore.

## Limits of a local run

At a tenth of the target, on the memory stores:

- Every command goes through the memory store's one lock and replays up to `snapshotEvery` rows, so the Worker serves one command at a time. Numbers taken while other work loads the machine measure the machine.
- At about 350 requests a second (the reads scenario), `wrangler dev`'s own proxy in front of the Worker drops connections ("Network connection lost" in its log), and the request fails as a 5xx or a failed read. That is the local runtime's limit, not the app's. The reads scenario is reported, not a gate (load:peak-reads-reported-only).
- The view rarely offers `obligation/pay`, `setpiece/answer` or a pair command, so most of those picks are sent as a month instead. The summary lists the kinds asked for and the kinds sent.

## When to run it

After any change to the command route, the storage interfaces, the database schema or the snapshot interval. Paste the summary from `results/` into that change's description.
