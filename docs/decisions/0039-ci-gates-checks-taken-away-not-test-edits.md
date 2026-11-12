# 0039. CI gates a check taken away, not a test edited

Status: Accepted

## Context

Most of the code here is written by coding agents, and their pull requests go out under the maintainer's account, which skips code owner review. An agent that cannot make a test pass has a quick way out: delete the test, drop an assertion or rewrite a golden until the run goes green. Instructions in `AGENTS.md` alone do not stop that, and a reviewer can read past it.

A test also changes for good reasons, and often: a test describes behaviour, so when the behaviour changes on purpose, a renamed function, a reworded message or a dependency that answers differently, the test changes with it. A gate on every edit to a test fires on ordinary work, the label becomes a habit, and a habit protects nothing.

## Decision

- **The label is asked for only when a change takes a check away.** `pnpm check:protected` (`tools/check/protected.ts`) runs on every pull request and fails, unless a maintainer adds the `approved-test-change` label, when:
  - a test file is deleted, or renamed to a name that is not a test;
  - a test file ends with fewer tests (`test(` and `it(` calls, a table counting once) or fewer assertions (`expect(` calls) than it had at the merge base; commented-out lines do not count;
  - a golden file changes, since goldens change only through `pnpm bless`;
  - `tools/rules-pending.json` gains a name.
- **Everything else is free.** An edit that keeps a file's tests and assertions, a new test file and a copied one, schemas, the lint config, the engine's types, the rule pages and the check tools pass without the label.
- **Lint covers the rest of the ways round.** `eslint.config.js` refuses focused, skipped, todo and commented-out tests.
- **Review reads what no count can.** An assertion made looser with its count unchanged, a matcher swapped for a weaker one, or a table row dropped from a `test.each` is for the reviewer.

## Consequences

- A pull request that moves a behaviour and its test together passes the check with no one's word, as most do.
- Splitting a test file in two leaves the first with fewer tests, so it asks for the label even though nothing was lost. Saying so with the label is the price.
- The lint config and the check tools are no longer gated by the label. `.github/CODEOWNERS` still names them for review on a pull request from outside.
- The counts are read from the source text, not the test runner, so a test built by a helper function is counted where the helper is called with `test(`, not per case it makes.

## Alternatives

- **The label on any change to a test, golden, schema, the lint config or the check tools.** It caught everything and was asked for on ordinary work, so it was given without reading.
- **No check: review and lint alone,** as most projects do. It is the lightest, but with agents writing the code and the maintainer's own pull requests skipping code owner review, a deleted test would rest on someone noticing it in the diff.
- **Code owner review on every test file.** The maintainer's pull requests skip it, so it guards outside contributions only.
- **Mutation testing,** which changes the code and expects a test to fail. It measures the tests' strength best, but costs a run many times the length of the suite on every pull request.
