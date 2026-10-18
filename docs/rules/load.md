# The load test on this machine

> Rests on `../design/04-where-things-live.md` section 5 (at a viral peak of 100,000 players online the database handles about 420 commands a second, one transaction each; Lagos to London is about 100 ms; the full character is written only every 20 commands or so), `server.md` and `../decisions/0006-the-online-stack.md` (the local authority, the local database, replay and the stored hash).
> Kind: `load`, a tool. Nothing is deployed and no account is created anywhere but this machine.

The load test asks one question: does the authority, with its database, take the viral peak's commands without falling over or getting anything wrong? It runs on one laptop, so it proves the code and the schema hold up, not what the hosted bill will be. It is run after any change to the command route, the storage interfaces, the database schema or the snapshot interval.

## Rules: what is simulated

**load:runs-against-local-stack** The test runs against the local authority as `server.md` runs it for development (the server package under the local Workers runtime) and the local database `0006-the-online-stack.md` chooses, on this machine, with nothing in between that the hosted build would not also have.

**load:seeded-test-accounts** Before the run, a seeding script creates `config.load.accounts` test accounts through the server's own test sign-in, each with a character started from the scenario fixtures and played forward a random number of turns between 0 and `config.load.warmTurns`, so snapshots and command logs of every length exist. `config.load.pairShareBp` of the accounts are joined in pairs (`pair.md`).

**load:constant-rate-command-mix** The main scenario sends commands at a constant arrival rate of `config.load.commandsPerSecond` for `config.load.minutes` after a one-minute ramp. Each request is one legal command for a random seeded account, built from that account's current view, in this mix: `turn/end` 50%, `offer/choose` 15%, `wallet/convert` 10%, `obligation/pay` 10%, `setpiece/answer` 10%, and a command touching a pair 5%. Working values.

**load:some-commands-sent-stale** `config.load.staleShareBp` of commands are sent deliberately stale (an old `basedOn`), so the rejection path is under load too.

**load:peak-reads-reported-only** A second scenario, run after the first, adds the reads of the full peak (heartbeats, view fetches and world fetches) to reach `config.load.requestsPerSecond` in total. It is reported but not a gate, because the load generator and the server share this one machine, and at that rate the machine measures itself as much as the code.

**load:fixed-seed-repeatable-run** The test runs from a script in `tools/load/` with a fixed seed for the account picks and the command mix, so two runs send the same commands in the same order.

## Rules: the tool

**load:arrival-rate-generator** The load generator is k6, as a standalone binary installed outside the repository, using its `constant-arrival-rate` executor. An arrival-rate model keeps sending at the target rate when the server slows down, as a crowd does; a tool that holds a fixed number of connections sends less as the server slows and hides the slowdown. k6 is never a dependency of the repository and its licence (AGPL-3.0) does not reach our code. Without k6, `tools/load/drive.ts` sends the same scenarios from Node for the smaller runs, and the gate stays k6's. The other fallback is autocannon (MIT, an npm package) at a fixed rate, which is not installed.

**load:connection-errors-counted-apart** The script raises the file descriptor limit for its own shell and uses keep-alive connections, and reports the count of connection errors separately from server errors, so an exhausted port range on the laptop is never read as a server failure.

## Rules: what passes

**load:main-scenario-pass-thresholds** The main scenario passes only when all of these hold, measured at the load generator:

| Check | Threshold |
|---|---|
| Commands sent against the target | at least 99% of `commandsPerSecond` times the duration (k6's dropped iterations under 1%) |
| Time per command, 95th percentile | `config.load.p95Ms` or less |
| Time per command, 99th percentile | `config.load.p99Ms` or less |
| Server errors (5xx) | none |
| Unexpected rejections | under `config.load.unexpectedBp`; a stale command's `stale` rejection is expected and not counted |
| Connection errors on the laptop | reported; a run with any is repeated before it counts |

**load:correctness-checked-after-run** After the main scenario the script checks correctness, and the run fails on any miss: every account touched replays from its seed and command log to the hash the server stored (`server.md`'s replay check); every money ledger transaction sums to zero; no account has two commands accepted at the same version; every pair touched has its two rows at consistent versions, locked in sorted id order (`../design/04-where-things-live.md` section 7); and the share of commands that wrote a full snapshot is within one point of 1 in `server.md`'s snapshot interval.

**load:run-summary-recorded** The run writes a summary (the thresholds, the measured values, the machine, the tool and runtime versions, the database's size before and after, bytes written per command, and the run's seed) to `tools/load/results/` and the change that adds or changes the test pastes it into its description. Raw output is not committed.

## The machine it was sized on

Read with `sysctl` and `ulimit` on 8 Oct 2026: Apple M3 Max, 14 cores, 36 GB of memory. Open files per shell 1,048,576; per process 138,240. Ephemeral ports 49152 to 65535 (16,384). Neither k6, autocannon nor pgbench is installed.

## Numbers

| Setting | Value | Source | Held in |
|---|---|---|---|
| Commands a second at the viral peak | 420 | a viral peak, `../design/04-where-things-live.md` section 5 | `config.load.commandsPerSecond` |
| All requests a second at the peak | 3,500 | working value for a viral peak, of which 420 are commands | `config.load.requestsPerSecond` |
| Test accounts | 100,000 | online at a viral peak, `../design/04-where-things-live.md` section 5 | `config.load.accounts` |
| Turns played before the run, at most | 60 | working value | `config.load.warmTurns` |
| Accounts in pairs | 10% | working value | `config.load.pairShareBp` = 1000 |
| Stale commands | 1% | working value | `config.load.staleShareBp` = 100 |
| Main scenario length | 10 minutes | working value | `config.load.minutes` |
| p95 per command | 100 ms | working value: locally there is no Lagos to London trip, and the 100 ms of network the design allows sits on top | `config.load.p95Ms` |
| p99 per command | 250 ms | working value | `config.load.p99Ms` |
| Unexpected rejections | under 0.1% | working value | `config.load.unexpectedBp` = 10 |
| k6 | v2.3.0, released 21 Sep 2026, AGPL-3.0 | GitHub releases | the run's summary |
| autocannon (fallback) | 8.0.0, MIT, 1.2 million downloads a week | npm registry | not installed |

These live in `tools/load/load.config.ts` (`config.load`), not in the game's content.

## Sources

All read 8 Oct 2026.

- [k6 releases: v2.3.0](https://github.com/grafana/k6/releases/tag/v2.3.0)
- [k6: the constant arrival rate executor](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/)
- [k6: thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
- [npm registry: autocannon](https://registry.npmjs.org/autocannon/latest) and [weekly downloads](https://api.npmjs.org/downloads/point/last-week/autocannon)
- [Cloudflare: local development for Workers](https://developers.cloudflare.com/workers/testing/local-development/)
- [PostgreSQL: pgbench](https://www.postgresql.org/docs/current/pgbench.html), for a database-only baseline if the main scenario fails and the cause must be split

## Not verified

- Whether the in-process database `0006-the-online-stack.md` may choose can take 420 transactions a second on one connection. If it cannot, that is a finding about the test setup, and a local Postgres install takes its place.
- How the local Workers runtime's throughput compares with the hosted edge. The test proves the code and schema, not the hosted capacity.

## Contract

The simulation's `types.ts` holds nothing of it. The tool:

- `tools/load/load.config.ts` exporting `LoadConfig { accounts; warmTurns; pairShareBp; staleShareBp; commandsPerSecond; requestsPerSecond; minutes; p95Ms; p99Ms; unexpectedBp; seed }`.
- `tools/load/seed.ts` (accounts and characters through the server's test sign-in), `tools/load/commands.k6.js` (the two scenarios), `tools/load/verify.ts` (load:correctness-checked-after-run), `tools/load/results/` git-ignored apart from a README.
- From the server: the load Worker's own routes (`apps/server/src/routes/load.ts`), which read an account's current view for building legal commands and answer only when the server runs locally.
