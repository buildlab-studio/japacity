# Quality and testing

## Context and scope

How the game keeps bugs out, and how every feature's intent is written down where both people and coding agents find it. The commands are in `../../AGENTS.md`; this page says why the checks are the ones they are. The facts behind the tool choices and the evidence on agents and tests are in [research note 10](../research/10-testing-tools-and-agents.md).

## Goals and non-goals

**Goals.**

- Bugs are caught by the machine, cheapest check first.
- Any life, and any bug, can be replayed exactly.
- Every rule has a name, and every name has a test.
- A coding agent cannot get a pass by changing the tests.

**Non-goals.** A coverage target; scenarios in a separate language for people who do not write code; mutation testing (not set up).

## 1. The one design choice everything rests on

**The simulation is deterministic.** Given the same starting state, the same commands and the same seed, it always produces the same result (engine:same-inputs-same-result).

| Rule | How it is enforced |
|---|---|
| The simulation package cannot read the clock, make its own random numbers, or touch the network or the screen | A lint rule that fails the build |
| Money is whole numbers of the smallest unit. The simulation uses no fractions and no floating-point maths functions, which can differ between a browser and the server | The same lint rule |
| The client never simulates. It holds a view, sends commands and shows the server's reply (server:client-never-predicts) | The view function, and a test that the view holds no hidden field (engine:view-holds-no-hidden-field) |
| The world's state and the tick are passed in | Function signatures |
| Random numbers come from named streams, one per subsystem: for a life the job hunt, offers, the visa, fraud, the street and the rest; for the world the eras, the shocks and the rates. Each is drawn by position (decision 0003) | A single random-number module. A test checks the streams are independent |
| The server and the in-browser development authority run the same simulation package | One package, imported by both |

**What this buys:**

- **A save is a list of segments**, each naming its content version and starting from the scenario and seed or from a base state, with its commands after it (server:save-is-list-of-segments, decision 0004). So is a bug report. So is a regression test.
- Any bug can be replayed exactly.
- The server plays every command itself, one transaction each (server:one-command-one-transaction), and can rebuild any life from the commands it accepted.
- Thousands of simulated lives can run on the real content.

## 2. Rules have names, and tests cite them

Every rule on a rule page gets a name: the page, a colon and a short slug of what it holds. Tests name the rule and state it as a sentence.

On the rule page (`../rules/status.md`, shortened):

> **status:lost-job-starts-clock** On a `one-employer` status, losing the job (the effect `activity/end-job`, whatever its cause) starts the clock: `clock` is set to the entry's `clockMonths`.

In the test (`packages/sim/src/activity/activity.abroad.test.ts`):

```ts
test("[ladders:sponsor-job-ties-status] [status:lost-job-starts-clock] given a sponsored care worker, when the job is quit, then the status clock starts, and the job is not taken up again while it runs", () => {
  const game = careWorker();
  game.endTurn();
  game.accept({ type: "activity/quit" });
  expect(game.state.status.current).toMatchObject({ entry: SPONSORED, clock: content.status[SPONSORED]!.clockMonths });
  game.endTurn();
  expect(game.state.activity.job).toBeNull();
});
```

`pnpm check:rules` fails if:

- a rule in the docs has no test and is not on the pending list, or
- a test cites a name that does not exist.

This is the answer to "what was this feature meant to do?" for a person or an agent a year from now: find the name, read the sentence, read the test.

Decisions get a record too: one short file per decision in `../decisions/`, whose README says how they are written.

## 3. The layers

Cheapest first. Each layer catches what the one before cannot.

| # | Layer | What it asserts | Example | Runs |
|---|---|---|---|---|
| 0 | Types and lint | Strict types. The simulation cannot read the clock or make its own random numbers | The build fails if the simulation imports a date function | `pnpm check` |
| 1 | Data checks | Every content row fits its schema, and every id it mentions exists (engine:content-checked-before-play) | Every route's status id resolves. Every currency is declared | `pnpm check` |
| 2 | Rule tests | One sentence-named test or more per rule | status:lost-job-starts-clock above | `pnpm check` |
| 3 | Invariants checked by property tests | Random command sequences on the real content, checking what must hold in every state | Same inputs, same result. The view holds no hidden field. The state is plain data. The ledger balances in each currency. Qualities stay in range. A player is never stuck | `pnpm check` |
| 4 | Golden replays | A stored save must reproduce the stored result, turn by turn. Updated only by `pnpm bless`, with the difference reviewed | `graduate-abroad`, `banker-abroad`, `developer-abroad` and the others in `packages/sim/src/goldens/` | `pnpm check` |
| 5 | Simulated players | Many lives played by simple strategies with different habits (careful, borrower, risky, honest at home). Asserts on what every run and the runs together show | Some strategy reaches a grant from every fixed life. A clean file faces a refusal chance between 3% and 15% (route:visa-refusal-chance). No strategy is ever stuck (engine:player-never-stuck) | `pnpm check` |
| 6 | Server replay | Each log row carries the state's hash. The server rebuilds a life from the commands it accepted and reports the first version that differs (server:log-rows-hash-state, server:rollback-check-finds-divergence) | A stored life whose every hash matches shows no difference | `pnpm check` |
| 7 | Screens | Key screens show what the view says | A route's page shows one step for each item of its checklist | `pnpm check` |
| 8 | Browser | The 34 specs in `apps/client/e2e` on a phone and a laptop, plus the `real` project against the whole local stack and the `catalog` project | Start at the front door, live a month, close and resume, reach the send-off | `pnpm test:browser` |
| 9 | Mutation | Break the simulation on purpose. The number of breaks no test notices must not rise | | Not set up |

**Every bug gets a test before its fix**: the failing test that shows it, then the fix.

## 4. Tools

All mainstream. The version pins and their traps are in `../../AGENTS.md`.

| Job | Tool |
|---|---|
| Test runner | Vitest |
| Schemas for data and the API | Zod |
| Invariants and random sequences | fast-check, through `@fast-check/vitest` |
| Browser tests | Playwright |
| Screen tests | Testing Library |

Random numbers come from the simulation's own module (decision 0003), not from a library.

## 5. Rules for coding agents

The ten rules are in `../../AGENTS.md`, and `.claude/skills/japacity-dev/` holds the working order. Instructions alone do not stop an agent editing a test to get a pass, so each rule is enforced by a check where it can be:

| Rule | Enforced by |
|---|---|
| Never edit, delete, skip or loosen a test, golden, schema or lint rule to get a pass | `pnpm check:protected` fails a pull request that changes a protected file without the `approved-test-change` label |
| A bug fix starts with a failing test | Review |
| New behaviour needs a named rule and a test that cites it | `pnpm check:rules` |
| The simulation stays pure | Lint |
| Goldens change only through `pnpm bless` | `pnpm check:protected` |
| Run the full check before saying done | Review |
| Never weaken an assertion, never commit a focused or skipped test | Lint |
| If a rule page and a test disagree, stop and report | `../../AGENTS.md` |
| Determinism, the ledger's reasons and the command and view types change only with a decision record | Review |
| Stay in the folders the task names | Review |

## 6. Alternatives considered

| Instead of | The game does | Why |
|---|---|---|
| Scenarios in feature files (Cucumber) | Sentence-named tests in the ordinary runner | Its own creator advises against it when only programmers write the scenarios |
| A spec-driven toolkit | Rule pages and the rule-name check | No evidence of better outcomes, and reviewers found them heavy for small work |
| A coverage target | A test per rule, invariants and replays | Coverage says a line ran, not that a rule holds |
| A random-number library | The simulation's own counted draws | Draws by position replay exactly across versions (decision 0003) |
| The client running the simulation to show results early | The client shows the command as sent until the reply | Almost every turn draws on a hidden stream, so a prediction would often be wrong (server:client-never-predicts) |
