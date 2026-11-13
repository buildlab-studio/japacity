---
name: japacity-dev
description: "How a change is made in the Japacity repository. Use before changing any code, content, words or test here: rules first, then the test that cites the rule, then the code; the check and its steps; the import boundaries; the simulation's whole-number rule; the recorded lives and goldens; the words and the voice; and the branch, worktree and report way of working."
---

# Making a change in Japacity

Japacity is a browser life-sim about leaving Nigeria. The simulation is pure and deterministic. Every rule has a name, and every rule name has a test. `AGENTS.md` at the root holds the rules for changing code; this skill gives the order of work. Read all of `AGENTS.md` before your first change.

## Order of work: rule, test, code

1. **Find the rule.** Rules live in `docs/rules/<kind>.md`, one paragraph each, starting with the rule's name in bold: `**turn:month-turns-on-empty-bank** ...`. A name is the page's file name, a colon, and a short slug of what the rule holds. `docs/rules/engine.md` is the contract every kind is built against: read it first. Its types are in `packages/sim/src/engine/types.ts`.
2. **No rule, no change.** New behaviour needs a named rule. Only the maintainer adds rules and edits rule pages. If you need a rule, stop and ask for it in your report, with the wording you propose. If a rule page and a test disagree, or a rule cannot be built as written, stop and report it. Never quietly pick one side.
3. **Write the test that cites the rule**, beside the code, and see it fail first. The title starts with the rule's name in brackets, then given, when, then:
   ```ts
   test("[turn:month-turns-on-empty-bank] given no turn banked, when the turn is ended, then the month turns", () => { ... });
   ```
   - A rule with numbers gets a test at each edge.
   - Read numbers from content (`content.tuning` or the entry) unless the test is about that exact number.
   - Start from a scenario and play commands: `start`, then `game.send` and `game.endTurn`, from `packages/sim/src/testing/play.ts`. A test outside the simulation imports them from `@japacity/sim/testing`. Do not build states by hand.
   - Property tests use `import { fc, test } from "@fast-check/vitest"`.
4. **Write the code.** Plain functions and plain data, no classes. A kind changes only its own slice, and only in `evolve`; to change another kind, emit an effect. Exhaustive switches end in a `never` check. Comments say why, never what.
5. **A bug fix starts with a failing test** that shows the bug.

Never edit, delete, skip or loosen an existing test, golden, schema or lint rule to get a pass. Never commit a focused or skipped test. If one is wrong, stop and report it. CI fails a change that takes a check away (a deleted test file, fewer tests or assertions in a file, a changed golden, a longer `tools/rules-pending.json`) unless a maintainer approves it (decision 0039).

## The check

```sh
pnpm check
```

It runs these steps in order and stops at the first failure. It ends with `CHECK PASSED` or `CHECK FAILED at step: <step>`.

| Step | Run alone | What it checks |
|---|---|---|
| check:types | `pnpm check:types` | The Workers' generated bindings and runtime types still match each `wrangler.jsonc` |
| typecheck | `pnpm typecheck` | Every package's types, including the browser tests |
| lint | `pnpm lint` | Zero warnings. Includes the simulation's purity rules |
| test | `pnpm test` | Every unit test project: sim, content, store, db, tools, models, server, server-workers, client, teaser. Simulated play is left out |
| test:play | `pnpm test:play` | Simulated play: the balance, endings and random-play files in `packages/sim/src/simulated-play/`, whole lives played month by month (scenario:economy-meets-its-targets). CI runs them one file to a runner in the merge queue and on every push to main, not on pushes to a pull request |
| check:rules | `pnpm check:rules` | Every rule name in `docs/rules/` has a test that cites it, and every cited name exists. `tools/rules-pending.json` lists the rules waiting for a test |
| check:version | `pnpm check:version` | The content's data and the simulation's code match the fingerprint sealed with the content version. After a change: run `pnpm content:freeze`, then raise the version, then run `pnpm content:seal` (server:content-version-sealed, server:older-content-frozen) |
| check:assets | `pnpm check:assets` | The city's models and pictures match their manifest |
| check:size | `pnpm check:size` | Builds the client and holds each part of a first visit to `tools/check/size-budget.json` (engine:first-download-has-budget) |
| check:scrub | `pnpm check:scrub` | No file git would publish contains the planning words the repository keeps out (`tools/check/scrub.ts`) |

While you work, run only the tests you are changing:

```sh
pnpm exec vitest run packages/sim/src/turn/turn.test.ts
pnpm exec vitest run --project client apps/client/src/features/turn
```

Run the full `pnpm check` before you say you are done, and paste its last lines. When several agents share one machine, run it at most twice per task and hold the lock while it runs:

```sh
until mkdir /tmp/japacity-check-lock 2>/dev/null; do sleep 20; done; pnpm check; rmdir /tmp/japacity-check-lock
```

`pnpm check:rules --write-pending` rewrites the pending list. Run it only when your change moves a rule's test. Never edit the list by hand.

The browser tests (`pnpm test:browser`, in `apps/client/e2e/`) are not part of the check. Run them only when asked. `E2E_PORT` sets the dev server's port; `PREVIEW_DIR` makes some specs save pictures.

## Import boundaries

`tests/boundaries.test.ts` enforces these. Its list of allowed exceptions may only get shorter.

- The simulation (`packages/sim/src`) imports only `zod` and itself. Its tests may also read `@japacity/content`.
- Content (`packages/content/src`) imports only the simulation, `zod` and itself.
- The client imports nothing from `store`, `db` or `server`. Nothing in sim, store or client imports `db`.
- **A feature never imports another feature.** `apps/client/src/features/<kind>/` holds one kind's screens. Anything two features need goes in `apps/client/src/shared/` (`shared/ui`, `shared/words`, `shared/world` and so on).
- **Shared and authority code never imports a feature.** `apps/client/src/shared/` and `apps/client/src/authority/` sit below the features. A test that checks shared code on a feature's screen, or cuts across features, goes in `apps/client/src/cross-feature/`.
- Only files inside `apps/<app>` import from that app.

## Simulation purity and numbers

The simulation is pure: no clock, no randomness of its own, no network, no screen, no fractions. Lint rules enforce this in `packages/sim/src`. Never disable one.

- Money is a whole number of kobo, pence or cents. Exchange rates are kobo per pound or per dollar. Chances are basis points: 10000 is 100%.
- No `/`, `**`, decimal literal, `Math.random`, `Date`, `setTimeout`, `globalThis` or `console` in the simulation.
- Division only through `packages/sim/src/engine/int.ts`: `divFloor`, `divCeil`, `mulDiv`, `mulDivCeil`, `bp` (an amount times basis points), `clamp`, `roundDownTo`, `roundUpTo`, `isqrt`, `rateOf`, `isWhole`, and the money helpers `minorToKobo`, `koboToMinor`, `valueInKobo`, `convertMinor`. They round down unless the name says otherwise, and throw on anything that is not a safe whole number.
- Random numbers come only from `ctx.random`, on the named stream the rule page gives.
- Ids are `kind.slug`. Events are `kind/what-happened`, past tense. Files are `kind.role.ts`.
- Changes to determinism, the ledger's reasons, or the command and view types need a decision record in `docs/decisions/`. Only the maintainer writes those.

## Files for one kind

| Path | Holds |
|---|---|
| `packages/sim/src/<kind>/` | `<kind>.schema.ts`, `<kind>.events.ts`, `<kind>.logic.ts`, `<kind>.test.ts` (only the files a kind needs) |
| `packages/content/src/<kind>/` | `<kind>.data.ts` (entries), `<kind>.text.ts` (words) |
| `apps/client/src/features/<kind>/` | Screens, their words table (`<kind>.words.ts`) and their tests (`Thing.test.tsx`) |
| `docs/rules/<kind>.md` | The kind's rules and entries |
| `docs/design/` | The reasons behind the game's design. Read it when a rule seems wrong |

## Recorded lives and goldens

- **Goldens** (`packages/sim/src/goldens/*.json`) are saves replayed turn by turn and compared with a stored result. `packages/sim/src/engine/goldens.test.ts` replays them. The scripts that make them are in `packages/sim/src/goldens/scripts.ts`.
- **Recorded lives** (`packages/sim/src/goldens/lives.data.ts`, and `packages/sim/src/simulated-play/lives.data.ts` for the simulated lives played beside them) are the simulated players' lives on the real content, made by `pnpm record:lives`.
- **Only the maintainer re-records and blesses.** A contributor never touches `packages/sim/src/goldens/` or the recorded lives. If your change moves a golden, report it as a finding: stop and say which golden changed, from which month, and why.
- **When the maintainer re-records:** after a content or rule change moves the world's schedule.
  - `pnpm record:lives` records every life. `pnpm record:lives graduate-abroad` records only the lives named.
  - `RECORD_FROM=<n>` starts the seed search further on, when the first seed fails a coupled test.
  - Then `pnpm bless` rewrites the goldens and prints which changed and from which month. The commit says why each one moved.
- **Coupled tests** read the recorded lives and change with them. Find them with:
  ```sh
  grep -rlE "lifeSaves|simulatedLifeSaves" packages apps tools
  ```
  They include the route, chapter, wallet and engine tests in the simulation, simulated play, the server's upgrade and life routes, some client tests and the browser specs. Run all of them after a re-record.

## Player-facing words and voice

- The simulation never holds prose. It emits a key and numbers; content holds the words. Read `docs/rules/text.md` before writing any player-facing text.
- Content words: `packages/content/src/<kind>/<kind>.text.ts`, a table from key to text: `<id>.name`, `<id>.blurb`, `<id>.choice.<choice>`, `line.<kind>.<what>` for a report line, `reject.<code>` for a rejection. Numbers go in braces: `"Salary: {amount}"`. Money in a line is a typed `{ currency, amount }` param, never a bare number.
- Interface words: content's tables in `packages/content/src/ui/`, one `ui.<screen>.text.ts` file per screen, merged into `text` through `textTables` in content's `index.ts`.
  - Words a first visit does not need get their own file, a subpath in content's `package.json` and a dynamic import in the client (engine:first-download-has-budget).
  - The client reads words through `say` and each feature's reader (`features/<kind>/<kind>.words.ts`). The functions that turn a view into words are in `apps/client/src/shared/words/`.
  - `apps/client/src/cross-feature/voice.test.ts` reads every table in `textTables`.
- The voice (text:voice-by-surface): Nigerian English as spoken in Lagos, second person, present tense.
  - The band and buttons: the action, in the second person ("Next month", "Pay it").
  - A card: the person asking, in their own voice.
  - The results: what happened in the past month, past tense.
  - The nudge: one thing to do, imperative, under eight words.
  - Say a quality by its band, never its figure (text:bands-not-figures). Never use a system word for a thing a person would name.
- First drafts are plain and correct; the voice is refined in review.

## Writing anywhere

- Short plain sentences. No filler. No emoji. No exclamation marks in the narrator's voice.

## Branches, worktrees and reports

- **One branch per piece of work**, from local `main`, in its own worktree beside the repository:
  ```sh
  git worktree add -b <piece>/<name> ../japacity-wt/<dir> main
  cd ../japacity-wt/<dir> && pnpm install --frozen-lockfile --offline
  ```
  Use the dev server port your task gives you (`pnpm --filter @japacity/client exec vite --port <n> --strictPort`). Never use another branch's port.
- **Change only your folders.** Your task names them. Anything else you need changed goes in your report, with file, line and why.
- **Commits:** small, with a subject that says what changed and where. Use `git add` with explicit paths.
- **Push your branch** only when `pnpm check` ends `CHECK PASSED` and your task says to. Never force-push, never touch `main`, never deploy.
- **Pull requests** merge through the merge queue (decision 0040). Each push to a pull request runs the quick checks (types, lint, audit, size, secrets and the unit tests the change reaches). The queue runs every unit test and simulated play before the merge. The title is `type: Imperative phrase`, short, as `CONTRIBUTING.md` says.
- **The report** (`REPORT.md` at the worktree's root, never committed) lists:
  - what you built, by rule name;
  - the last lines of `pnpm check`;
  - every change outside your folders, and why;
  - rules you could not build or test;
  - what you would look at next.

  Update it after each piece of work, so a restart loses nothing.

## Before you say done

1. The test that cites the rule fails without your change and passes with it.
2. `pnpm check` ends `CHECK PASSED`, and its last lines are in the report.
3. `git diff main --stat` shows only your folders, or the report says why not.
