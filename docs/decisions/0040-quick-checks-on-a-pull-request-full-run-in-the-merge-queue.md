# 0040. Quick checks on a pull request, the full run in the merge queue

Status: Accepted

## Context

**The wait.**

- The check ran every unit test and every simulated-play file on each push to a pull request.
- On GitHub's standard runners that took 20 to 40 minutes. A pull request built by several pushes waited that long after each one.
- A newer push cancels the run in progress, so the runs do not pile up, but the wait after the last push stays.
- Standard runners cost nothing on a public repository. The price is the wait and the jobs a run holds at once.

**Most of that time does not test the change.**

- A change to the client reaches a few dozen of the nearly thousand unit test files.
- Simulated play, whole lives played month by month, is a third of the time on its own.

**Large projects keep the full suite for the moment before a merge.**

- The Rust compiler runs a small set of jobs on each push to a pull request, and the whole suite only on the merge commit.
- GitHub's merge queue runs a workflow on the `merge_group` event, against main with the change on top.

## Decision

**The quick tier, on every push to a pull request:**

- the Workers' generated types, typecheck, lint, the content version, the size budget, the dependency audit, the protected-tests check (decision 0039) and the secret scan;
- the unit tests the change can reach. Vitest's `--changed` runs a test when it imports, directly or not, a file changed since the merge base. It runs every test when a changed file matches `forceRerunTriggers` in `vitest.config.ts`: a `package.json`, the test config, the lockfile, the workspace, the Node version or a TypeScript config;
- the unit tests run in three parts on three runners (`--shard`), reported as the one `unit` check;
- simulated play does not run.

**The full tier, in the merge queue, on every push to main and by hand:**

- every unit test, in the same three parts;
- simulated play, one file to a runner, reported as the one `play` check;
- on a pull request the `play` job is skipped, which the rules count as passed.

**A pull request merges only through the merge queue.**

- Main's ruleset requires `check`, `unit`, `play` and `secrets`.
- The queue runs them on main with the change on top before it merges, so main takes nothing the full tier has not passed.
- Branches no longer have to be up to date with main before a merge, since the queue tests each change on the latest main.

**`pnpm check` is unchanged:** it runs everything locally, simulated play included.

## Consequences

- A push to a pull request waits for the quick tier: a few minutes for a change to the client, longer for a change to the simulation or the content, which nearly every test imports.
- A merge waits for the full tier once, in the queue. Its length is the slowest simulated-play file, `balance.golden`, about 18 minutes, which plays eight styles and reads its measures over all of them together.
- A test that reads a file without importing it (a workflow, a document, a fixture) is not picked by `--changed` when only that file changes. The queue's full run catches what the quick tier misses, before main.
- A failure found in the queue takes the pull request out of the queue and leaves main as it was. The fix is a new push to the pull request.
- Simulated play can run on a pull request's branch by hand: `gh workflow run check --ref <branch>`.

## Alternatives

- **Everything on every push,** as before. The simplest, and every push waited for the slowest file.
- **Only the files a path filter names,** the play jobs' earlier rule (play when the diff reaches the simulation or the content). Coarser than following imports, and it left the rest of the unit tests whole.
- **Skipping checks on a draft pull request.** It saves runs only while a pull request is a draft, and runs the whole suite after every push once it is not.
- **Larger runners.** Faster, but billed even on a public repository.
