---
name: japacity-dev
description: "How a change is made in the Japacity repository. Use before changing any code, content, words or test here: rules first, then the test that cites the rule, then the code; running the check; the import boundaries; the simulation's whole-number rule; the recorded lives and goldens; the words and the voice; and the branch, worktree and report way of working."
---

# Making a change in Japacity

Japacity is a browser life-sim about leaving Nigeria. The simulation is pure and deterministic. Every rule has a name, and every rule name has a test. `AGENTS.md` at the root holds the rules for changing code; read all of it before your first change. This skill gives the order of work and what `AGENTS.md` does not cover. What each command and each step of the check does is in `docs/site/built/working.md`.

## Order of work: rule, test, code

1. **Find the rule.** Rules live in `docs/rules/<kind>.md`, one paragraph each, starting with the rule's name in bold: `**turn:month-turns-on-empty-bank** ...`. A name is the page's file name, a colon, and a short slug of what the rule holds. `docs/rules/engine.md` is the contract every kind is built against: read it first. Its types are in `packages/sim/src/engine/types.ts`.
2. **No rule, no change** (`AGENTS.md` rules 3 and 8). If you need a rule, stop and ask for it in your report, with the wording you propose. If a rule page and a test disagree, or a rule cannot be built as written, stop and report it.
3. **Write the test that cites the rule**, beside the code, and see it fail first. Follow "Writing tests" in `AGENTS.md`. To play commands, use `start`, then `game.send` and `game.endTurn`, from `packages/sim/src/testing/play.ts`; a test outside the simulation imports them from `@japacity/sim/testing`.
4. **Write the code**, following "Writing code" in `AGENTS.md`.
5. **A bug fix starts with a failing test** that shows the bug.

Never edit, delete, skip or loosen an existing test, golden, schema or lint rule to get a pass (`AGENTS.md` rules 1 and 7). CI fails a change that takes a check away unless a maintainer approves it (decision 0039; `docs/site/built/working.md`, "Rules and tests").

## Running the check

`pnpm check` runs ten steps in order and ends with `CHECK PASSED` or `CHECK FAILED at step: <step>`. The steps are in `docs/site/built/working.md`, "The check".

- While you work, run only the tests you are changing:
  ```sh
  pnpm exec vitest run packages/sim/src/turn/turn.test.ts
  pnpm exec vitest run --project client apps/client/src/features/turn
  ```
- Run the full `pnpm check` before you say you are done, and paste its last lines. When several agents share one machine, run it at most twice per task and hold the lock while it runs:
  ```sh
  until mkdir /tmp/japacity-check-lock 2>/dev/null; do sleep 20; done; pnpm check; rmdir /tmp/japacity-check-lock
  ```
- `pnpm check:rules --write-pending` rewrites `tools/rules-pending.json`. Run it only when your change moves a rule's test. Never edit the list by hand.
- When your change touches the content's data or the simulation's code, `pnpm check:version` fails until the content version is raised. Follow "Raising the content version" in the `japacity-shipped-lives` skill: freeze first, then raise, then seal (server:content-version-sealed, server:older-content-frozen).
- The browser tests (`pnpm test:browser`) are not part of the check. Run them only when asked.

## Import boundaries

`tests/boundaries.test.ts` enforces these, and `docs/design/03-structure-and-conventions.md` section 9 lists them all. Its list of allowed exceptions may only get shorter.

- The simulation (`packages/sim/src`) imports only `zod` and itself. Its tests may also read `@japacity/content`.
- Content (`packages/content/src`) imports only the simulation, `zod` and itself.
- The client imports nothing from `store`, `db` or `server`. Nothing in sim, store or client imports `db`.
- **A feature never imports another feature.** `apps/client/src/features/<kind>/` holds one kind's screens. Anything two features need goes in `apps/client/src/shared/` (`shared/ui`, `shared/words`, `shared/world` and so on).
- **Shared and authority code never imports a feature.** `apps/client/src/shared/` and `apps/client/src/authority/` sit below the features. A test that checks shared code on a feature's screen, or cuts across features, goes in `apps/client/src/cross-feature/`.
- Only files inside `apps/<app>` import from that app.

## Simulation purity and numbers

`AGENTS.md` rule 4 and "Writing code" hold. In practice, in `packages/sim/src`:

- No `/`, `**`, decimal literal, `Math.random`, `Date`, `setTimeout`, `globalThis` or `console`.
- Division only through `packages/sim/src/engine/int.ts`: `divFloor`, `divCeil`, `mulDiv`, `mulDivCeil`, `bp` (an amount times basis points), `clamp`, `roundDownTo`, `roundUpTo`, `isqrt`, `rateOf`, `isWhole`, and the money helpers `minorToKobo`, `koboToMinor`, `valueInKobo`, `convertMinor`. They round down unless the name says otherwise, and throw on anything that is not a safe whole number.

## Recorded lives and goldens

- **Goldens** (`packages/sim/src/goldens/*.json`) are saves replayed turn by turn and compared with a stored result, by `packages/sim/src/engine/goldens.test.ts`. **Recorded lives** (`packages/sim/src/goldens/lives.data.ts`, and the simulated lives in `packages/sim/src/simulated-play/`) are made by `pnpm record:lives`. How each is made is in `docs/site/built/simulation.md`, "Goldens, recorded lives and simulated play".
- **Only the maintainer re-records and blesses** (`AGENTS.md` rule 5). Never touch `packages/sim/src/goldens/` or the recorded lives. If your change moves a golden, report it as a finding: say which golden changed, from which month, and why.
- **When the maintainer asks you to re-record** (after a content or rule change moves the world's schedule): `pnpm record:lives` (with `RECORD_FROM=<n>` if the first seed fails a coupled test), then `pnpm bless`. The commit says why each golden moved. Then run every coupled test, the tests that read the recorded lives:
  ```sh
  grep -rlE "lifeSaves|simulatedLifeSaves" packages apps tools
  ```
  They include the route, chapter, wallet and engine tests in the simulation, simulated play, the server's upgrade and life routes, some client tests and the browser specs.

## Player-facing words and voice

- The simulation never holds prose. It emits a key and numbers; content holds the words. Read `docs/rules/text.md` before writing any player-facing text.
- Content words: `packages/content/src/<kind>/<kind>.text.ts`, a table from key to text: `<id>.name`, `<id>.blurb`, `<id>.choice.<choice>`, `line.<kind>.<what>` for a report line, `reject.<code>` for a rejection. Numbers go in braces: `"Salary: {amount}"`. Money in a line is a typed `{ currency, amount }` param, never a bare number.
- Interface words: content's tables in `packages/content/src/ui/`, one `ui.<screen>.text.ts` file per screen, merged into `text` through `textTables` in content's `index.ts`.
  - Words a first visit does not need get their own file, a subpath in content's `package.json` and a dynamic import in the client (engine:first-download-has-budget).
  - The client reads words through `say` and each feature's reader (`features/<kind>/<kind>.words.ts`). The functions that turn a view into words are in `apps/client/src/shared/words/`.
  - `apps/client/src/cross-feature/voice.test.ts` reads every table in `textTables`.
- The voice for each surface (the band and buttons, a card, the results, the nudge) is text:voice-by-surface; a quality is said by its band, never its figure (text:bands-not-figures). Never use a system word for a thing a person would name.
- First drafts are plain and correct; the voice is refined in review.

## Branches, worktrees and reports

- **One branch per piece of work**, from local `main`, in its own worktree beside the repository, set up as `docs/site/built/working.md`, "Worktrees", shows. Use the dev server port your task gives you (`pnpm --filter @japacity/client exec vite --port <n> --strictPort`). Never use another branch's port.
- **Change only your folders** (`AGENTS.md` rule 10). Anything else you need changed goes in your report, with file, line and why.
- **Commits** follow "Commits" in `AGENTS.md`.
- **Push your branch** only when `pnpm check` ends `CHECK PASSED` and your task says to. Never force-push, never touch `main`, never deploy.
- **Pull requests** follow `CONTRIBUTING.md`, "Pull requests".
- **The report** is the one "Your report" in `AGENTS.md` lists, plus every change outside your folders and why. Write it to `REPORT.md` at the worktree's root (never committed) and update it after each piece of work, so a restart loses nothing.

## Before you say done

1. The test that cites the rule fails without your change and passes with it.
2. `pnpm check` ends `CHECK PASSED`, and its last lines are in the report.
3. `git diff main --stat` shows only your folders, or the report says why not.
