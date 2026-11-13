# Contributing

How to take part: pull requests, their titles and descriptions, the DCO, review, the branch rules and the licences. The rules for anyone changing code are in [`AGENTS.md`](AGENTS.md). The commands, the check, CI and how work lands are in [Working on it](docs/site/built/working.md), and [Where each fact lives](docs/site/built/working.md#where-each-fact-lives) says which page owns what.

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md) (the Contributor Covenant 2.1). Report a breach to security@japacity.app.

## Skills

The working method is written down as skills in [`.claude/skills/`](.claude/skills/). Each is a plain page, as useful to a person as to an agent.

| Skill | Read it when |
|---|---|
| [`japacity-dev`](.claude/skills/japacity-dev/SKILL.md) | You are about to change anything. It covers the order (rule, then test, then code), the import boundaries, whole-number money, the recorded lives and goldens, the words and the voice, branches and reports |
| [`japacity-play`](.claude/skills/japacity-play/SKILL.md) | You want to see the game played end to end on a phone, with pictures: `pnpm play --out <folder>` |
| [`japacity-shipped-lives`](.claude/skills/japacity-shipped-lives/SKILL.md) | Your change touches the rules, the content's shape or the database while players have lives on production. It covers what breaks which lives, what carries them over, and the checks before a deploy |

## Getting started

```sh
pnpm install
pnpm dev
pnpm exec vitest run <the test you are writing>
pnpm check
```

`pnpm dev` runs the offline game; `pnpm dev:full` runs the whole online game on your machine. Every command, the requirements and the local stack are in [Working on it](docs/site/built/working.md). The folders and what each holds are in [the workspace table](docs/site/built/index.md#the-workspace). To see every screen as a player does before a review, run the screen catalog, `pnpm catalog` ([The screen catalog](docs/site/built/working.md#the-screen-catalog)).

## Pull requests

Every change reaches `main` through a pull request, the maintainer's included. Every merge is a squash merge.

**Title:** `type: Imperative phrase`, short. The type is a conventional commit type such as `feat`, `fix`, `docs`, `refactor`, `test` or `chore`. For example:

- `feat: Enable sending a new notification upon signup`
- `fix: Reject invalid login report`

**Description:** follow `.github/pull_request_template.md`: what and why, the changes, and how it was tested. Paste the last lines of `pnpm check`.

**DCO:** a contribution from outside the project certifies the [Developer Certificate of Origin](https://developercertificate.org/) (DCO) in the pull request's description: you have the right to submit the change under the project's licences (see [Licences](#licences)).

**Review:** a change from outside the project to a file named in `.github/CODEOWNERS` needs the code owner's review (see [Branches and releases](#branches-and-releases)).

**Checks and merging:** each push to the pull request runs CI's quick tier. Once it passes, the pull request joins the merge queue (GitHub's "Merge when ready", or `gh pr merge --auto`), which merges it only if the full tier, simulated play included, passes on `main` with the change on top. What each tier runs is in [The check in CI](docs/site/built/working.md#the-check-in-ci).

A merge to `main` deploys staging only. When each environment deploys is server:production-and-staging, on [the server rules](docs/rules/server.md).

## Tests, goldens and rule names

- New behaviour needs a named rule in `docs/rules/` and a test whose title cites it, for example `[status:expiry-lapses-or-moves-on] given ..., when ..., then ...`. Only the maintainer adds rules; ask for one in your pull request. How the rule-name check works is in [Rules and tests](docs/site/built/working.md#rules-and-tests).
- If a test, a golden file or a schema disagrees with your change, stop and report it. Do not edit, delete, skip or loosen it to make the check pass. The same applies to `eslint.config.js` and `tools/rules-pending.json`.
- Changing a test together with the behaviour it describes is normal work. CI fails a pull request that takes a check away unless a maintainer adds the `approved-test-change` label (decision 0039).

## The documentation site

The site in `docs/site` explains how the game is built and how it plays. It is kept with the code: a change that alters what a page says updates the page in the same branch, and `pnpm docs:build` must still build cleanly. The site links to the rule pages in `docs/rules/` and never copies them. Its pictures come from the play driver at phone size and are kept small in `docs/site/public/pictures/`.

## Branches and releases

The maintainer applies these rules in GitHub's settings; the repository holds the files they rely on.

- `main` takes changes only through a pull request and the merge queue. Nobody pushes to it directly, the maintainer included. The checks it requires are listed in [The check in CI](docs/site/built/working.md#the-check-in-ci).
- History stays linear (squash merges), force pushes are blocked, and `main` cannot be deleted.
- A change from an outside contributor to a file listed in `.github/CODEOWNERS` needs the maintainer's review. Those files are the lint config, `tests/`, the scrub check, `tools/repo.ts` (the checks' run guard), the Worker configs, everything in `.github/` and `packages/content/src/legal/`. A new commit dismisses an earlier approval. The maintainer's own pull requests merge through the ruleset's pull-request bypass, since an author cannot approve their own: it waives that review only, and they still wait for the checks.
- An outside contribution certifies the DCO in its description (see [Pull requests](#pull-requests)). A change that takes away a test, an assertion or a golden needs the `approved-test-change` label.
- Deploys follow server:production-and-staging ([the server rules](docs/rules/server.md)); [Deploying](docs/site/built/infrastructure.md#deploying) says how they are set up. A fork cannot deploy this project, and a pull request from a fork runs the check with no secrets.

To run your own copy of the game, with your own domain, database and keys, read [Run your own copy](docs/site/built/your-own-copy.md).

## Licences

A contribution is made under the licence of the part it changes: code under MIT, docs under CC BY 4.0, game content and the project's own art and audio under CC BY-SA 4.0. The name and the logo are reserved. [LICENSES.md](LICENSES.md) has the full table and the marks of others, and [NOTICES.md](NOTICES.md) lists the open source packages the game ships.
