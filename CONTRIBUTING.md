# Contributing

This page is a short guide for people joining the work. The rules for anyone changing code are in [`AGENTS.md`](AGENTS.md).

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md) (the Contributor Covenant 2.1). Report a breach to security@japacity.app.

## Skills

The working method is written down as skills in [`.claude/skills/`](.claude/skills/). Each is a plain page, as useful to a person as to an agent.

| Skill | Read it when |
|---|---|
| [`japacity-dev`](.claude/skills/japacity-dev/SKILL.md) | You are about to change anything. It covers the order (rule, then test, then code), the check, the import boundaries, whole-number money, the recorded lives and goldens, the words and the voice, branches and reports |
| [`japacity-play`](.claude/skills/japacity-play/SKILL.md) | You want to see the game played end to end on a phone, with pictures: `pnpm play --out <folder>` |
| [`japacity-shipped-lives`](.claude/skills/japacity-shipped-lives/SKILL.md) | Your change touches the rules, the content's shape or the database while players have lives on production. It covers what breaks which lives, what carries them over, and the checks before a deploy |

## Folders

| Folder | Holds |
|---|---|
| `docs/rules/` | One page per kind. Every rule has a name (`turn:month-turns-on-empty-bank`: the page, then what the rule holds) and a test that cites it. `engine.md` is the contract |
| `docs/decisions/` | One short record per decision that changed the contract |
| `docs/design/` | The reasons behind the game's design |
| `packages/sim/` | The simulation: pure, deterministic, whole numbers only |
| `packages/content/` | The game's entries and words, checked against the simulation's schemas |
| `packages/api/` | The HTTP contract between the client and the server: every route's request and reply, and the socket's messages |
| `packages/store/`, `packages/db/` | The storage interfaces with in-memory versions, and their database versions for the online game |
| `packages/model-kit/`, `models/` | The city's models and pictures, and their sources |
| `packages/brand/` | The game's colours and wordmark letters as data, for the teaser |
| `apps/client/` | The web client. `src/features/<kind>/` holds one kind's screens, `src/shared/` what features share, `src/cross-feature/` the tests that cut across features, and `e2e/` the browser tests |
| `apps/server/` | The online authority, which also serves the client's build |
| `tools/` | The checks (`tools/check/`, with `all.ts` behind `pnpm check`), bless and record for the goldens (`tools/goldens/`), the asset tools, and the play driver (`tools/play/`) |
| `tests/` | Guard tests for the whole repository, such as the import boundaries, the shipped build and the lint rules |

## Everyday commands

```sh
pnpm install
pnpm exec vitest run <the test you are writing>
pnpm dev
pnpm play --life developer --months 3 --out /tmp/japacity-play
pnpm check
```

## Pull requests

Every change reaches `main` through a pull request, the maintainer's included. Every merge is a squash merge.

**Title:** `type: Imperative phrase`, short. The type is a conventional commit type such as `feat`, `fix`, `docs`, `refactor`, `test` or `chore`. For example:

- `feat: Enable sending a new notification upon signup`
- `fix: Reject invalid login report`

**Description:** follow `.github/pull_request_template.md`: what and why, the changes, and how it was tested.

**DCO:** a contribution from outside the project certifies the [Developer Certificate of Origin](https://developercertificate.org/) (DCO) in the pull request's description: you have the right to submit the change under the project's licences (see [LICENSES.md](LICENSES.md)).

**Review:** a change from outside the project to a file named in `.github/CODEOWNERS` needs the code owner's review. The maintainer's own pull requests merge through the ruleset's pull-request bypass, since an author cannot approve their own, and still wait for the checks.

**Checks and merging** (decision 0040). The check workflow, `.github/workflows/check.yml`, runs in two tiers:

- **Quick checks, on every push to a pull request:** the Workers' generated types, typecheck, lint, the content version, the size budget, the dependency audit, the protected-tests check, the secret scan, and the unit tests the change can reach. Simulated play does not run.
- **Full suite, in the merge queue:** every unit test and simulated play, run on `main` with the change on top. It also runs on every push to `main` and when started by hand.

Once the quick checks pass, the pull request joins the merge queue, which merges it only if the full suite passes. On GitHub that is the "Merge when ready" button. From the command line:

```sh
gh pr merge --auto
```

To run simulated play on a branch before it is queued, start the check by hand: `gh workflow run check --ref <branch>`.

A merge to `main` deploys staging, and only staging. Production waits for a release tag `v*` on the commit staging serves and the maintainer's approval. See [Branches and releases](#branches-and-releases).

## The check

Before you say a change is done, run:

```sh
pnpm check
```

It runs, in order: the Workers' generated types, typecheck, lint, tests, simulated play, the rule-name check, the content version, the asset check, the size budget and the scrub check. It ends with `CHECK PASSED` or names the step that failed. Paste the output in your pull request.

## Running the online game locally

`pnpm dev` runs the offline game. For the online game, start Docker and run `pnpm dev:full`. It starts Postgres and Mailpit in Docker Compose, runs the migrations, and has the Worker serve the client at `https://localhost:8787`. Every email code lands in Mailpit's inbox at `http://localhost:8025`. The settings come from `.env.example`: put your own values in `.env.local`, never in a committed file. `pnpm test:browser:real` then plays the game against it. Details are in [`docs/site/built/working.md`](docs/site/built/working.md).

## Never edit tests, goldens or schemas to get a pass

If a test, a golden file or a schema disagrees with your change, stop and report it. Do not edit, delete, skip or loosen it to make the check pass. The same applies to `eslint.config.js` and `tools/rules-pending.json`.

Changing a test together with the behaviour it describes is normal work. CI stops a change that takes a check away (decision 0039). A pull request fails unless a maintainer adds the `approved-test-change` label when it:

- deletes a test file;
- leaves a test file with fewer tests or fewer assertions;
- changes a golden file;
- grows `tools/rules-pending.json`.

Skipped, focused and commented-out tests fail lint.

## Rule names

New behaviour needs a named rule in `docs/rules/` and a test whose title cites it, for example `[status:expiry-lapses-or-moves-on] given ..., when ..., then ...`. `pnpm check:rules` fails when a rule has no test or a test cites an unknown rule.

## The screen catalog

`pnpm catalog` takes a picture of every screen of the game as a player sees it on a phone (Pixel 7 size, three device pixels to each CSS pixel). It covers the start screen and the door, each starting home, the room and every drawn place by day and by night, a thing's fan and sheets, the asks, the map and the ride, the phone and every app, a month's results and the morning, life abroad and its warnings, the send-off's steps and landings, the share cards, and the dedication. It reaches them the way the browser suite does: from the front door, from the recorded lives and through the development build's hooks.

**Where the pictures go:** `.catalog/<short commit>/` at the root of the main checkout, with an `index.html` contact sheet. Git ignores the folder, and every worktree writes to the same place. To write elsewhere, set `CATALOG_DIR` to the folder itself, for example `CATALOG_DIR=/tmp/japacity-catalog pnpm catalog`. It is used as given, with no commit folder added. A screen the catalog cannot reach is shown on the sheet with the reason.

**When and how to review:** run it after a set of changes is merged and before they are reviewed. Look at every picture against `CHECKLIST.md` (copied beside the pictures; its source is `apps/client/e2e/catalog/CHECKLIST.md`). Write `REVIEW.md` in the same folder, listing each fault with the picture's name, what is wrong and where in the code it probably is. The review fixes nothing; each fault becomes its own change.

**How it runs:** it is a tool, not a test. It is the Playwright project `catalog` in `apps/client/playwright.config.ts`, with its files in `apps/client/e2e/catalog/`. `pnpm test:browser` leaves it out and `pnpm check` never runs it. It uses the browser suite's ports (`E2E_PORT`, `E2E_ONLINE_PORT`). `CATALOG_WORKERS` sets how many lives are shot at once (default three). `CATALOG_SCALE` sets the device pixels (default three; one is quicker while you work on the catalog itself). To add a screen, list it in `screens.ts` (its position sets its number) and shoot it in `catalog.spec.ts`.

## The documentation site

The site in `docs/site` (VitePress, `pnpm docs:dev`) explains how the game is built and how it plays. It is kept with the code: a change that alters what a page says updates the page in the same branch, and `pnpm docs:build` must still build cleanly. The site links to the rule pages in `docs/rules/` and never copies them; the rule pages stay the source of truth. Its pictures come from the play driver at phone size and are kept small in `docs/site/public/pictures/`.

## Branches and releases

The maintainer applies these rules in GitHub's settings; the repository holds the files they rely on.

- `main` takes changes only through a pull request. Nobody pushes to it directly, the maintainer included.
- The check workflow's `check`, `unit`, `play` and `secrets` checks must pass. A pull request merges only through the merge queue, which runs the full suite on `main` with the change on top. Branches do not need to be up to date with `main` before a merge.
- History stays linear (squash merges), force pushes are blocked, and `main` cannot be deleted.
- A change from an outside contributor to a file listed in `.github/CODEOWNERS` needs the maintainer's review. Those files are the lint config, `tests/`, the scrub check, `tools/repo.ts` (the checks' run guard), the Worker configs, everything in `.github/` and `packages/content/src/legal/`. A new commit dismisses an earlier approval. The maintainer's own pull requests merge through the ruleset's pull-request bypass, which waives that review only.
- An outside contribution certifies the DCO in its description (see [Pull requests](#pull-requests)). A change that takes away a test, an assertion or a golden needs the `approved-test-change` label.
- A push to `main` deploys staging once the check passes on it (`.github/workflows/deploy-staging.yml`). Production deploys only from a release tag `v*`, or when the maintainer starts it by hand from `main`, only after the maintainer approves the run, and only the commit on `main` that staging serves (`.github/workflows/deploy-production.yml`). Each deploy migrates the database, snapshots every character, builds, deploys, and checks that the deployment answers as the deployed commit. Deploying by hand from a checkout, in the same order (`apps/server/README.md`), is the fallback.
- The whole browser suite runs each night and when started by hand (`.github/workflows/browser.yml`), with no secrets. A pull request does not wait for it.
- A fork cannot deploy this project. The deploy jobs run only in `buildlab-studio/japacity`, their Cloudflare secrets live in this repository's `staging` and `production` environments, and a pull request from a fork runs the check with no secrets.

To run your own copy of the game, with your own domain, database and keys, read [Run your own copy](docs/site/built/your-own-copy.md).
