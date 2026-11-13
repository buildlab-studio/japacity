# Instructions for coding agents

Japacity is a browser life-sim about leaving Nigeria. The simulation is pure and deterministic. Every rule has a name, and every rule name has a test. Read this whole page before you change anything.

This page holds the instructions you must follow. What the commands and the check do, and how CI and merging work, is in [Working on it](docs/site/built/working.md); [Where each fact lives](docs/site/built/working.md#where-each-fact-lives) says which page owns each kind of fact.

## Commands

Run them from the repository root; pnpm switches itself to the pinned version there. Every command is in [Commands](docs/site/built/working.md#commands), and each step of the check in [The check](docs/site/built/working.md#the-check).

| Command | When |
|---|---|
| `pnpm check` | Before you say you are done. It must end with `CHECK PASSED` |
| `pnpm exec vitest run <file>`, `pnpm test:play <file>` | While you work: only the tests you touch |
| `pnpm typecheck`, `pnpm lint`, `pnpm check:rules` | One step of the check each, when you need it alone |
| `pnpm bless` | Only when the maintainer asks (rule 5) |
| `pnpm content:freeze`, then `pnpm content:seal` | Around raising the content version, in the order the `japacity-shipped-lives` skill gives |

## Where things are

| Path | Holds | Read |
|---|---|---|
| `docs/rules/engine.md` | The engine contract | Always, first |
| `docs/rules/<kind>.md` | The rules for one kind, each with a name, and its entries | Before touching that kind |
| `docs/rules/text.md` | Where words live and how they sound | Before writing any player-facing text |
| `packages/sim/src/engine/types.ts` | The contract in types | Always |
| `packages/sim/src/<kind>/` | `<kind>.schema.ts`, `<kind>.events.ts`, `<kind>.logic.ts`, `<kind>.test.ts` (only the files a kind needs) | |
| `packages/content/src/<kind>/` | `<kind>.data.ts`, `<kind>.text.ts` | |
| `packages/api/src/` | The HTTP contract: every route's request and reply, shared by the client and the server | Before changing a route |
| `apps/client/src/features/<kind>/` | Screens, their words reader (`<kind>.words.ts`) and their tests (`Thing.test.tsx`) | |
| `docs/design/` | The reasons behind the game's design. Section 1 of `03-structure-and-conventions.md` defines the project's terms (kind, slice, effect, command, view) | When a rule seems wrong, or a term is new to you |
| `docs/decisions/` | One short record per decision | |

## Rules

1. Never edit, delete, skip or loosen an existing test, golden file, schema or lint rule to get a pass. If one is wrong, stop and report it.
2. A bug fix starts with a failing test.
3. New behaviour needs a named rule in a rule page and a test that cites it. Only the maintainer adds rules. If you need a new rule, ask for it in your report.
4. The simulation stays pure: no clock, no randomness of its own, no network, no screen, no fractions. Lint rules enforce this. Never disable one.
5. Golden files change only through `pnpm bless`, and you explain the change.
6. Before you say you are done, run `pnpm check` and paste its last lines.
7. Never weaken an assertion. Never commit a focused or skipped test.
8. If a rule page and a test disagree, or a rule cannot be built as written, stop and report it. Do not quietly pick one side.
9. Changes to determinism, the ledger's reasons, or the command and view types need a decision record. Only the maintainer writes those.
10. Change only the folders your task names. Anything else you need changed goes in your report.

## Writing tests

- Tests sit beside the code: `<kind>.test.ts`.
- Test helpers sit beside the tests that use them: `<name>.testing.ts`. A helper shared by tests in several folders goes in the package's `testing/` folder (for the simulation, `packages/sim/src/testing/`). A test file exports nothing.
- A test title starts with the rule's name in brackets, then given, when, then: `test("[turn:month-turns-on-empty-bank] given no turn banked, when the turn is ended, then the month turns", ...)`.
- Each rule has at least one test. A rule with numbers gets a test at each edge.
- Read numbers from content (`content.tuning` or the entry) unless the test is about that exact number.
- Start from a scenario and play commands through `step`. Do not build a state by hand when a few commands would reach it.
- Property tests use `import { fc, test } from "@fast-check/vitest"`.
- A rule you could not test counts as not built. Say so in your report.

## Writing code

- Plain functions and plain data. No classes. No inheritance. No functions inside data.
- Money is a whole number of kobo, pence or cents. Division only through `packages/sim/src/engine/int.ts`.
- Exchange rates are kobo per pound or per dollar. Chances are basis points: 10000 is 100%.
- Random numbers come only from `ctx.random`, on the named stream the rule page gives.
- A kind changes only its own slice, and only in `evolve`. To change another kind, emit an effect.
- Ids are `kind.slug`. Events are `kind/what-happened`, past tense. Files are `kind.role.ts`.
- Exhaustive switches over unions, ending in a `never` check.
- Comments say why, never what.

## Writing text

- Short plain sentences. No filler. No emoji. No exclamation marks in the narrator's voice.
- Player text follows `docs/rules/text.md`.

## Pinned versions

These are pinned on purpose. Do not upgrade them.

| Tool | Pin | Watch out for |
|---|---|---|
| TypeScript | 6.0.x | The registry's latest is 7. The lint tooling stops below 6.1 |
| Vitest | 4.1.x | The registry's latest is 5 |
| Zod | 4.x | `z.email()`, `z.int()`, `z.enum([...])` take the new top-level forms. Errors use `error`, not `message`. `z.record` needs both key and value. Template literal ids: `z.templateLiteral` |
| ESLint | 10, flat config | No `.eslintrc`. No `eslint-disable` for the purity rules |
| React | 19.3 | No `forwardRef` needed. `ref` is a prop. No default `React` import needed |
| Vite | 8 | `rolldownOptions`, not `rollupOptions` |
| pnpm | 11 | A dependency's build script must be allowed in `pnpm-workspace.yaml` or the install stops |
| Tailwind | 4 | Configured in CSS with `@theme`, not a JavaScript config file. Import is `@import "tailwindcss"` |
| Base UI | 1.x | The package is `@base-ui/react`. Not the old `@base-ui-components` name |

## Common mistakes in the client

Mistakes that break the screens with these versions:

- Writing `tailwind.config.js` and `@tailwind base`. Tailwind 4 uses `@import "tailwindcss"` and `@theme` in CSS.
- Adding `postcss`, `autoprefixer` or the `tailwindcss` PostCSS plugin. With Vite only `@tailwindcss/vite` is needed.
- Tailwind 3 names: `shadow-sm`, `rounded-sm`, `outline-none`, bare `ring`. Tailwind 4 uses `shadow-xs`, `rounded-xs`, `outline-hidden`, `ring-3`.
- The removed utilities `bg-opacity-50` and `flex-shrink-0`. Tailwind 4 uses `bg-black/50` and `shrink-0`.
- `bg-[--brand]`. Tailwind 4 writes `bg-(--brand)`.
- `!` before the class. Tailwind 4 puts it after: `flex!`.
- Custom classes under `@layer utilities`. Tailwind 4 needs `@utility`.
- Forgetting that `border` defaults to `currentColor` and `ring` to 1px.
- `@apply` in a separate CSS file without `@reference "../app.css"`.
- Reading variants right to left. Tailwind 4 applies them left to right.
- Importing `@base-ui-components/react`. The 1.0 package is `@base-ui/react`.
- Radix `asChild` on Base UI parts. Base UI composes with a `render` prop.
- Adding an animation or drawer library, or the deprecated shadcn `toast` and `tailwindcss-animate`. Motion is written in code.
- Wrapping components in `forwardRef`. React 19 passes `ref` as a prop.
- Calling `document.startViewTransition` by hand. React calls it, and only for transitions.
- Lucide brand icons, removed in version 1, or assuming icons are announced. Version 1 sets `aria-hidden`.
- Formatting NGN with `en-GB` and the default display, which prints "NGN".
- Importing a font's `latin.css` alone for a face that draws ẹ, ọ, ị, ụ, tone marks or ₦ in its other subsets (the note in `apps/client/src/index.css` says which face does).
- `build.rollupOptions` or an object `manualChunks` in Vite 8.
- `baseUrl` in a tsconfig, deprecated in TypeScript 6.
- `npm i -D typescript vitest`, which installs 7 and 5 instead of the pins.

## Skills

The working method is also kept as skills in `.claude/skills/`:

- `japacity-dev`: how a change is made.
- `japacity-play`: the end-to-end play driver, `pnpm play`.
- `japacity-shipped-lives`: how a change is judged against the lives players already have on production. Read it before changing the simulation's rules, the content's shape or the database schema.

[`CONTRIBUTING.md`](CONTRIBUTING.md#skills) explains them for a person.

## Your report

End every task with:

1. What you built, by rule name.
2. The last lines of `pnpm check`.
3. Anything in the contract, a rule page or another kind that you needed changed, or had to change. Be exact: file, line, why.
4. Rules you could not build or test, and why.
5. What you would look at next.

## Commits

Keep commits small, with a subject that says what changed and where. If a hook refuses a commit, fix the problem; never force it. Add a body only when the change needs one, with one line per bullet. Use `git add` with explicit paths.

CI runs only part of the check on a pull request ([The check in CI](docs/site/built/working.md#the-check-in-ci)), so run `pnpm check` before you push. Pull request titles and descriptions follow [`CONTRIBUTING.md`](CONTRIBUTING.md#pull-requests).

## Never

- Copy anything from another game.
- Put a real person or a real photo into content. A real business name stands only as neutral scenery, under city:sponsor-shows-name-only and city:invented-names-for-risky-businesses ([the city rules](docs/rules/city.md)).
- Add a dependency without the maintainer's agreement. Use only well-adopted tools.
- Publish or deploy. Push your branch only when your task says to and `pnpm check` has passed. Never push `main`.
