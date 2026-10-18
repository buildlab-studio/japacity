# Quality and testing

> Layers 0 to 8 are set up; layer 9, mutation testing, is not.
> Purpose: bugs are caught by the machine, and every feature's intent is written down where both people and coding agents will find it.

## 1. The one design choice everything rests on

**The simulation is deterministic.** Given the same starting state, the same list of actions, and the same seed, it always produces the same result.

| Rule | How it is enforced |
|---|---|
| The simulation package cannot read the clock, generate its own random numbers, or touch the network or the screen | A lint rule that fails the build |
| Money is whole numbers of the smallest unit. The simulation uses no floating-point maths functions, which can differ between a browser and the server | The same lint rule |
| The client simulates only what the player can see. Anything that depends on hidden state is decided by the server | The per-player view function, and a test that the view holds no hidden field |
| The current time and the world's state are passed in | Function signatures |
| Random numbers come from named streams, one per subsystem: news, offers, events, rates | A single random-number module. A test checks the streams are independent |
| The client and the server run the same simulation package | One package, imported by both |

**What this buys:**

- **A save is a seed plus a list of actions.** So is a bug report. So is a regression test.
- Any bug can be replayed exactly.
- The server can check a client by replaying its actions.
- Thousands of simulated lives can run overnight.

## 2. Rules have names, and tests cite them

Every rule on a rule page gets a name: the page, a colon and a short slug of what it holds. Tests name the rule and state it as a sentence.

On the rule page:

> **status:expiry-lapses-or-moves-on** A sponsored worker who loses the job has two turns to find a new sponsor. After that, status lapses.

In the test:

```ts
test("[status:expiry-lapses-or-moves-on] given a sponsored worker, when the job ends and two turns pass with no new sponsor, then status lapses", () => {
  const start = scenario("sponsored-carer-uk");
  const end = play(start, [jobLost(), endTurn(), endTurn()]);
  expect(end.character.status).toBe("lapsed");
});
```

A script in CI fails the build if:

- a rule in the docs has no test, or
- a test cites a name that does not exist.

This is the answer to "what was this feature meant to do?" for a person or an agent a year from now: find the name, read the sentence, read the test.

**Decisions get a record too.** A short file per decision in `docs/decisions/`, saying what was chosen and why. Accepted records are replaced by new ones, never edited.

## 3. The layers

Cheapest first. Each layer catches what the one before cannot.

| # | Layer | What it asserts | Example for this game | Runs |
|---|---|---|---|---|
| 0 | Types and lint | Strict types. The simulation package cannot read the clock or make its own random numbers | The build fails if the simulation imports a date function | `pnpm check` |
| 1 | Data checks | Every content row fits its schema, and every id it mentions exists | Every route's status id resolves. Every obligation has a grace period. Every currency is declared | `pnpm check` |
| 2 | Rule tests | One sentence-named test per rule | status:expiry-lapses-or-moves-on above. "A closed window accepts no new application" | `pnpm check` |
| 3 | Always-true rules | Thousands of random action sequences, checking what must hold in every state | Money is only created or destroyed through listed sources and sinks. Japacity is always between 0 and 100. No reachable state has zero legal actions. Banked turns never exceed the cap. Save then load gives the same state | `pnpm check` |
| 4 | Golden replays | A stored seed and action list must reproduce the stored result, turn by turn. Updated only by one "bless" command, with the difference reviewed | "The nurse: Lagos to Manchester in 36 turns". "The school leaver who takes the offer" | `pnpm check` |
| 5 | Simulated players | Thousands of lives by simple bots with different habits. Asserts on distributions | A careful saver reaches the send-off within 36 turns in at least 80% of runs. Under 5% of careful runs end in unrecoverable debt. No route is taken by more than 40% of bots. No route is never reachable | `pnpm check` |
| 6 | Server replay | The server replays the client's action list. Any mismatch is rejected, with the first turn that differs | A tampered save is refused. Client and server agree on every golden replay | `pnpm check` |
| 7 | Screens | Key screens show what the simulation says | The checklist crosses out exactly the met requirements | `pnpm check` |
| 8 | Browser | Three to five full flows | Start, play the prologue, play a turn, close and resume, reach the send-off | `pnpm test:browser` |
| 9 | Mutation | Break the simulation on purpose. The number of breaks no test notices must not rise | | Not set up |

**Every bug gets a test before its fix**: the seed and action list that showed it, added to layer 4.

## 4. Tools

All mainstream. Weekly downloads in late September 2026. Version pins are in `AGENTS.md`: Vitest stays on 4.1 and TypeScript on 6.0.

| Job | Tool | Weekly downloads |
|---|---|---|
| Test runner | Vitest | 142m |
| Schemas for data and the API | Zod | 387m |
| Always-true rules and random sequences | fast-check | 59m |
| Browser tests | Playwright | 86m |
| Screen tests | Testing Library | 73m |
| Mutation (not set up) | Stryker | 3m |

Random numbers come from the simulation's own module (decision 0003), not from a library.

**Not used:** Cucumber and feature files (its creator advises against them when only programmers write the scenarios), spec-driven toolkits (no evidence of better outcomes, and reviewers found them heavy), and coverage targets.

## 5. Rules for coding agents

Evidence says agents edit or delete tests to get a pass in a large share of cases, and that asking them not to is not enough. Making tests read-only works. So each rule below is enforced by CI where it can be.

| # | Rule | Enforced by |
|---|---|---|
| 1 | Do not edit, delete, skip, or loosen an existing test, golden file, schema or lint rule to get a pass | `pnpm check:protected` fails a pull request that changes tests, goldens, schemas or the lint config without the `approved-test-change` label |
| 2 | A bug fix starts with a failing test, committed before the fix | Review |
| 3 | New behaviour needs a named rule on the rule page and a test that cites it | The traceability script |
| 4 | The simulation package stays pure | Lint |
| 5 | Golden files change only through the bless command, and the change is summarised | CI checks the label |
| 6 | Before saying done, run the full check command and paste the output | Review |
| 7 | Never weaken an assertion, and never commit a focused or skipped test | Lint |
| 8 | If the rule and the tests disagree, stop and report | The instruction file |
| 9 | Changes to determinism, the ledger's reasons, or the command and view types need a decision record | Review |
| 10 | Stay in the folders the task names; anything else needed goes in the report | Review |

The instruction file for agents (`../../AGENTS.md`) stays short: the commands, these ten rules, and where the design pages are.
