# Contributing

A one-page map for a person joining the work. The rules for anyone changing code are in [`AGENTS.md`](AGENTS.md).

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md) (the Contributor Covenant 2.1). Report a breach to security@japacity.app.

## The skills

The way of working is written down as skills in [`.claude/skills/`](.claude/skills/). Each is a plain page, useful to a person as much as to an agent.

| Skill | Read it when |
|---|---|
| [`japacity-dev`](.claude/skills/japacity-dev/SKILL.md) | You are about to change anything: the order (rule, then test, then code), the check, the boundaries, whole-number money, the recorded lives and goldens, the words and the voice, branches and reports |
| [`japacity-play`](.claude/skills/japacity-play/SKILL.md) | You want to see the game played end to end on a phone, with pictures: `pnpm play --out <folder>` |
| [`japacity-shipped-lives`](.claude/skills/japacity-shipped-lives/SKILL.md) | Your change touches the rules, the content's shape or the database once players have lives on production: what breaks which lives, what carries them, the checks before a deploy |

## The folders

| Folder | Holds |
|---|---|
| `docs/rules/` | One page per kind. Every rule has a name (`turn:month-turns-on-empty-bank`: the page, then what the rule holds) and a test that cites it. `engine.md` is the contract |
| `docs/decisions/` | One short record per decision that changed the contract |
| `docs/design/` | Why the game is the way it is |
| `packages/sim/` | The simulation: pure, deterministic, whole numbers only |
| `packages/content/` | The game's entries and words, checked against the simulation's schemas |
| `packages/api/` | The HTTP contract between the client and the server: every route's request and reply, and the socket's messages |
| `packages/store/`, `packages/db/` | The storage interfaces with in-memory versions, and their database versions for the online game |
| `packages/model-kit/`, `models/` | The city's models and pictures, and their sources |
| `packages/brand/` | The game's colours and wordmark letters as data, for the teaser |
| `apps/client/` | The web client. `src/features/<kind>/` holds one kind's screens; `src/shared/` holds what features share; `src/cross-feature/` holds the tests that cut across features; `e2e/` holds the browser tests |
| `apps/server/` | The online authority, which also serves the client's build |
| `tools/` | The checks (`tools/check/`, with `all.ts` behind `pnpm check`), bless and record for the goldens (`tools/goldens/`), the asset tools, and the play driver (`tools/play/`) |
| `tests/` | Guard tests across the whole repository, such as the import boundaries, the shipped build and the lint rules |

## The loop, in five commands

```sh
pnpm install
pnpm exec vitest run <the test you are writing>
pnpm dev
pnpm play --life developer --months 3 --out /tmp/japacity-play
pnpm check
```

## Certify the DCO

A contribution from outside the project certifies the [Developer Certificate of Origin](https://developercertificate.org/) (DCO) in the pull request's description: you have the right to submit the change under the project's licences (see [LICENSES.md](LICENSES.md)).

## Every change goes through a pull request

Every change reaches `main` through a pull request, the maintainer's own included, and every merge is a squash merge. A change to a file `.github/CODEOWNERS` names needs the code owner's review when it comes from outside the project; the maintainer's own pull requests merge through the ruleset's pull-request bypass, since an author cannot approve their own, and still wait for the check. A pull request's title is a short conventional title (`type(scope): what`, for example `fix(map): keep names readable over roofs`), and its description follows `.github/pull_request_template.md`: what and why, the changes, how it was tested. Each pull request is set to merge by itself once the check passes:

```sh
gh pr merge --auto --squash
```

Merging to `main` deploys staging, and only staging; production waits for a release tag `v*` on the commit staging serves and the maintainer's approval. See "Branches and releases" below.

## Run the check

Before saying a change is done, run:

```sh
pnpm check
```

It runs the server's types, typecheck, lint, tests, simulated play, the rule-name check, the content version, the asset check, the size budget and the scrub check, in that order, and ends with `CHECK PASSED` or the step that failed. Paste the output in your pull request.

## Run the whole game locally

`pnpm dev` runs the offline game. To work on the online game, start Docker and run `pnpm dev:full`: Postgres and Mailpit in Docker Compose, the migrations, and the Worker serving the client at `https://localhost:8787`, with every email code in Mailpit's inbox at `http://localhost:8025`. The values come from `.env.example`; put your own in `.env.local`, never in a committed file. `pnpm test:browser:real` then plays the game against it. See "Running the whole thing locally" in `docs/site/built/working.md`.

## Tests, goldens and schemas are not edited to get a pass

If a test, a golden file or a schema disagrees with your change, stop and report it. Do not edit, delete, skip or loosen it to make the check pass. The same goes for `eslint.config.js` and `tools/rules-pending.json`.

CI enforces this. A pull request that modifies, deletes or renames a protected file fails unless a maintainer adds the `approved-test-change` label. The check (`.github/workflows/check.yml`) runs on every pull request and every push to `main`.

## Rules have names

New behaviour needs a named rule in `docs/rules/` and a test whose title cites it, for example `[status:expiry-lapses-or-moves-on] given ..., when ..., then ...`. `pnpm check:rules` fails when a rule has no test or a test cites an unknown rule.

## The screen catalog

`pnpm catalog` shoots every screen of the game as a player sees it on a phone (Pixel 7 size, three device pixels to each): the start screen and the door, each starting home, the room and every drawn place by day and by night, a thing's fan and sheets, the asks, the map and the ride, the phone and every app, a month's results and the morning, life abroad and its warnings, the send-off's beats and landings, the share cards, and the dedication. It reaches them the way the browser suite does, from the front door, from the recorded lives and through the development build's hooks, and it writes the pictures with an `index.html` contact sheet to `.catalog/<short commit>/` at the root of the main checkout, a folder git ignores, so every worktree writes to the same place. To write them elsewhere, set `CATALOG_DIR` to the folder itself, for example `CATALOG_DIR=/tmp/japacity-catalog pnpm catalog`; it is used as given, with no commit folder added. A screen it cannot reach stands on the sheet with the reason.

Run it after a set of changes is merged and before they are reviewed. Then look at every picture against `CHECKLIST.md` (copied beside them; its source is `apps/client/e2e/catalog/CHECKLIST.md`) and write `REVIEW.md` in the same folder: each fault with the picture's name, what is wrong and where in the code it likely is. The review fixes nothing; each fault becomes a change of its own.

It is a tool, not a test: it is the Playwright project `catalog` in `apps/client/playwright.config.ts`, with its files in `apps/client/e2e/catalog/`; `pnpm test:browser` leaves it out, and `pnpm check` never runs it. It uses the suite's ports (`E2E_PORT`, `E2E_ONLINE_PORT`); `CATALOG_WORKERS` sets how many lives are shot at once (three by default) and `CATALOG_SCALE` the device pixels (three by default; one is quicker while changing the catalog itself). A screen is added to `screens.ts`, where its place sets its number, and shot in `catalog.spec.ts`.

## The documentation site

The site in `docs/site` (VitePress, `pnpm docs:dev`) explains how the game is built and how it plays. It is kept with the code: a change that alters what a page says changes the page in the same branch, and `pnpm docs:build` must still build clean. The site links to the rule pages in `docs/rules/` and never copies them; they stay the source of truth. Its pictures come from the play driver at phone size and live small in `docs/site/public/pictures/`.

## Branches and releases

The maintainer applies these rules in GitHub's settings; the repository holds the files they rest on.

- `main` takes changes only through a pull request. Nobody pushes to it directly, the maintainer included.
- The check workflow must pass before a pull request merges.
- History stays linear (squash merges), force pushes are blocked, and `main` cannot be deleted.
- A change to a file in `.github/CODEOWNERS` (the lint config, `tests/`, the scrub check, `tools/repo.ts` with the checks' run guard, the Worker configs, the workflows, `packages/content/src/legal/`) from an outside contributor needs the maintainer's review, and a new commit dismisses an earlier approval. The maintainer's own pull requests merge through the ruleset's pull-request bypass, which waives that review alone.
- An outside contribution certifies the DCO in its description (above), and a change to a protected test, golden or schema needs the `approved-test-change` label.
- A merge to `main` deploys staging once the check passes on it (`.github/workflows/deploy-staging.yml`). Production deploys only from a release tag `v*`, or when the maintainer starts it by hand from `main`, only after the maintainer approves the run, and only the commit on `main` that staging serves (`.github/workflows/deploy-production.yml`). Each deploy migrates the database, snapshots every character, builds, deploys and checks that the deployment answers as the commit deployed. A deploy by hand from a checkout, in the same order (`apps/server/README.md`), is the fallback.
- The whole browser suite runs each night and when started by hand (`.github/workflows/browser.yml`), with no secrets; a pull request does not wait for it.
- A fork cannot deploy this project. The deploy jobs run only in `buildlab-studio/japacity`, their Cloudflare secrets live in this repository's `staging` and `production` environments, and a pull request from a fork runs the check with no secrets at all.

To run your own copy of the game, with your own domain, database and keys, read [Run your own copy](docs/site/built/your-own-copy.md).
