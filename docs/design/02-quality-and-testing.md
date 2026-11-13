# Quality and testing

## Context and scope

How the game keeps bugs out, and how each feature's intent is written down where people and coding agents can find it. The commands are in `../../AGENTS.md`; this page says why the checks are the ones they are. The facts behind the tool choices, and the evidence on agents and tests, are in [research note 10](../research/10-testing-tools-and-agents.md).

## Goals and non-goals

**Goals.**

- The machine catches bugs, cheapest check first.
- Any life, and any bug, can be replayed exactly.
- Every rule has a name, and every name has a test.
- A coding agent cannot get a pass by changing the tests.

**Non-goals.** A coverage target; scenarios in a separate language for people who do not write code; mutation testing (not set up).

## 1. Determinism

**The simulation is deterministic.** The same starting state, commands and seed always give the same result (engine:same-inputs-same-result). Everything else on this page rests on this.

| Rule | How it is enforced |
|---|---|
| The simulation package cannot read the clock, make its own random numbers, or touch the network or the screen | A lint rule that fails the build |
| Money is whole numbers of the smallest unit. The simulation uses no fractions and no floating-point maths functions, which can give different results in a browser and on the server | The same lint rule |
| The client never simulates. It holds a view, sends commands and shows the server's reply (server:client-never-predicts) | The view function, and a test that the view holds no hidden field (engine:view-holds-no-hidden-field) |
| The world's state and the tick are passed in | Function signatures |
| Random numbers come from named streams, one per subsystem: for a life, the job hunt, offers, the visa, fraud, the street and the rest; for the world, the eras, the shocks and the rates. Each draw is taken by position (decision 0003) | A single random-number module, and a test that the streams are independent |
| The server and the in-browser development authority run the same simulation | One package, imported by both |

What this gives:

- **A save is a list of segments.** Each segment names its content version, starts from the scenario and seed or from a base state, and lists the commands after it (server:save-is-list-of-segments, decision 0004). A bug report and a regression test have the same form.
- Any bug can be replayed exactly.
- The server plays every command itself, one transaction each (server:one-command-one-transaction), and can rebuild any life from the commands it accepted.
- Thousands of simulated lives can run on the real content.

## 2. Rule names and tests

Every rule on a rule page has a name: the page, a colon, and a short slug of what the rule says. A test cites the rule's name and states the rule as a sentence.

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

- a rule in the docs has no test and is not on the pending list (`tools/rules-pending.json`), or
- a test cites a name that does not exist.

To find out what a feature was meant to do, find the rule's name, read its sentence, and read its test.

Each decision gets a short record of its own in `../decisions/`; that folder's README says how they are written.

## 3. Test layers

Cheapest first. Each layer catches what the one before cannot.

| # | Layer | What it asserts | Example | Runs in |
|---|---|---|---|---|
| 0 | Types and lint | Strict types. The simulation cannot read the clock or make its own random numbers | The build fails if the simulation imports a date function | `pnpm check` |
| 1 | Data checks | Every content row fits its schema, and every id it mentions exists (engine:content-checked-before-play) | Every route's status id resolves. Every currency is declared | `pnpm check` |
| 2 | Rule tests | At least one sentence-named test per rule | status:lost-job-starts-clock above | `pnpm check` |
| 3 | Invariants, by property tests | Random command sequences on the real content, checking what must hold in every state | Same inputs, same result. The view holds no hidden field. The state is plain data. The ledger balances in each currency. Qualities stay in range. A player is never stuck | `pnpm check` |
| 4 | Golden replays | A stored save reproduces the stored result, turn by turn. Changed only by `pnpm bless`, with the difference reviewed | `graduate-abroad`, `banker-abroad`, `developer-abroad` and the others in `packages/sim/src/goldens/` | `pnpm check` |
| 5 | Simulated players | Many lives played by simple strategies with different habits (careful, borrower, risky, honest at home), with assertions on single runs and on all runs together | Some strategy reaches a grant from every fixed life. A clean file faces a refusal chance between 3% and 15% (route:visa-refusal-chance). No strategy is ever stuck (engine:player-never-stuck) | `pnpm check` (its `test:play` step) |
| 6 | Server replay | Each log row carries the state's hash. The server rebuilds a life from the commands it accepted and reports the first version that differs (server:log-rows-hash-state, server:rollback-check-finds-divergence) | A stored life whose hashes all match shows no difference | `pnpm check` |
| 7 | Screens | Key screens show what the view says | A route's page shows one step for each item on its checklist | `pnpm check` |
| 8 | Browser | The 43 specs in `apps/client/e2e`, on a phone and a laptop. Also the `real` project, against the whole local stack, and the `catalog` project, which shoots every screen | Start at the front door, live a month, close and resume, reach the send-off | `pnpm test:browser`, `pnpm test:browser:real`, `pnpm catalog`. The suite also runs nightly and by hand in CI (`.github/workflows/browser.yml`) |
| 9 | Mutation | Break the simulation on purpose. The number of breaks no test notices must not rise | | Not set up |

`pnpm check` (`tools/check/all.ts`) runs these steps in order and stops at the first failure: `check:types`, `typecheck`, `lint`, `test`, `test:play`, `check:rules`, `check:version`, `check:assets`, `check:size`, `check:scrub`. The browser tests are not part of it.

**Every bug gets a test before its fix**: first the failing test that shows the bug, then the fix.

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

The ten rules are in `../../AGENTS.md`, and `.claude/skills/japacity-dev/` holds the working order. Instructions alone do not stop an agent editing a test to get a pass, so each rule is enforced by a check where possible:

| Rule | Enforced by |
|---|---|
| Never edit, delete, skip or loosen a test, golden, schema or lint rule to get a pass | `pnpm check:protected` fails a pull request that deletes a test file, leaves a test file with fewer tests or assertions, changes a golden or grows the pending list, unless it carries the `approved-test-change` label (decision 0039). Lint refuses skipped, focused and commented-out tests. Review covers the rest |
| A bug fix starts with a failing test | Review |
| New behaviour needs a named rule and a test that cites it | `pnpm check:rules` |
| The simulation stays pure | Lint |
| Goldens change only through `pnpm bless` | `pnpm check:protected` |
| Run the full check before saying done | Review |
| Never weaken an assertion, never commit a focused or skipped test | Lint |
| If a rule page and a test disagree, stop and report | `../../AGENTS.md` |
| Determinism, the ledger's reasons, and the command and view types change only with a decision record | Review |
| Stay in the folders the task names | Review |

## 6. Alternatives considered

| Instead of | The game does | Why |
|---|---|---|
| Scenarios in feature files (Cucumber) | Sentence-named tests in the ordinary runner | Cucumber's own creator advises against it when only programmers write the scenarios |
| A spec-driven toolkit | Rule pages and the rule-name check | No evidence of better outcomes, and reviewers found such toolkits heavy for small work |
| A coverage target | A test per rule, invariants and replays | Coverage says a line ran, not that a rule holds |
| A random-number library | The simulation's own counted draws | Draws by position replay exactly across versions (decision 0003) |
| The client running the simulation to show results early | The client shows the command as sent until the reply | Almost every turn draws on a hidden stream, so a prediction would often be wrong (server:client-never-predicts) |
