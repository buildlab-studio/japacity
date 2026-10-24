---
name: japacity-shipped-lives
description: "How a change is checked against the lives players already have on production. Use before changing the simulation's rules, the content's data or shape, the state's shape or the database schema once lives exist on production: how a life is kept and replayed, which kind of change breaks which lives, what carries them (content upgrades, snapshots, migrations, the rollback), and the checklist before a deploy."
---

# A change meets the lives already shipped

Once a player has a life on production, a change is not only code: it is something that happens to that life. This skill is how a change is judged against shipped lives before it is built and before it is deployed. Staging's lives are test lives and may be reset with the maintainer's word; production's are never reset.

## How a life is kept, and why a rules change can break it

- The server keeps each life as a snapshot plus a log of the commands after it (a new snapshot every `snapshotEvery` commands, 20, in `apps/server/src/config.ts`). Each log row holds the command, its tick, the version after it and the hash of the state after it (server:log-rows-hash-state).
- Every load replays the log from the snapshot under the segment's own content and compares the hash with the last row's. A mismatch, or a command the replay now rejects, refuses that life as `diverged` (HTTP 409) until it is mended; every other life carries on (`apps/server/src/authority/load.ts`).
- So the simulation's rules (`packages/sim`, anything that changes what a command does or what a month produces) change what old commands replay to. After such a deploy, every life with commands since its last snapshot diverges on its next load. This is the same reason lockstep games bind a replay to the exact game version: inputs are only meaningful under the rules that first ran them.
- Content is versioned (`packages/content/src/index.ts`, `content.version`, a count kept as a string, from "1"), and the version moves with any change to the content's data or the simulation's code: `pnpm check:version` fails until it is raised and sealed with `pnpm content:seal` (server:content-version-sealed). A life saved under an older content is replayed under that older content, which the server bundles beside the current (`olderContents`, server:newer-content-upgrades-state, server:upgrade-state-is-pure and server:older-contents-bundled; version 1 is the first, so the list is empty), then carried to the current by `upgradeState` (`packages/sim/src/engine/state.ts`: ids renamed through the newer content's `renames`, missing slices built by their kind's `initial`, grown slices filled), checked by every kind's invariants and `checkContent`, and opened as a new segment. A failed upgrade throws and writes nothing.
- The database schema moves by Drizzle migrations that run before every deploy (server:migration-before-deploy): additive first, a column or table removed only in a later migration once no deployed Worker reads it.
- The mend for a diverged life is the rollback tool (server:rollback-check-finds-divergence, server:rollback-apply-one-account and server:no-mass-rollback, `apps/server/src/ops/rollback.ts`): `pnpm rollback check|apply <character>`, one life at a time. With no flag it opens the database at `DATABASE_URL_UNPOOLED`; `--memory <save.json>` runs it against a saved file.

## First, know what is shipped

1. Production's commit and content version: `/api/health` answers `content`, and the maintainer's record of the deploy names the commit.
2. Whether lives exist on it: the maintainer counts `characters` in production's database (an agent never reads it, and asks the maintainer). No lives, no carrying: anything may change.
3. What is on staging, likewise, and whose lives they are.

## Then classify the change

| The change touches | What happens to a shipped life | What carries it |
|---|---|---|
| Words, screens, the client alone, the teaser, docs | Nothing | Nothing |
| Content data under `packages/content` (an entry, a number, a table) with the state's shape unchanged | The life's segment names the old content; it replays under the old bundle and upgrades on load | `pnpm content:freeze`, then raise `content.version` by one and run `pnpm content:seal` (the shipped version joins `olderContents` exactly as it shipped; see How to raise the content version); `renames` for any id that changed; the upgrade test from the shipped version (`apps/server/src/authority/upgrade.test.ts`) |
| The state's shape (`packages/sim` types, a kind's schema, a new slice) | As above, and the upgrade must build or fill the slice | A content version raise as the trigger, with the shipped version in `olderContents`; the kind's `initial`, and the engine's filling of slices that grew inside a kind (`grownTo4` under `upgradeState` in `packages/sim/src/engine/state.ts`); invariants that accept the carried state; the upgrade test with a save recorded under the shipped version |
| The simulation's rules (`evolve`, a command's acceptance, a month's results, the random streams) | Every life with commands since its last snapshot diverges on its next load | The content version is raised and sealed (server:content-version-sealed), and the shipped version joins `olderContents` (its data as it shipped: the current data under the old version when only the code changed). No deploy of a rules change over shipped lives without the maintainer's word, and then only after `pnpm snapshot:all` has snapshotted every life from the live commit (server:snapshot-before-deploy: a new segment per life with the current state as its base and an empty log, one transaction each); a life that diverges anyway is mended with the rollback tool, one at a time |
| The database schema (`packages/db/src/schema`) | None if the migration is additive | `pnpm --filter @japacity/db db:generate --name <x>` after the last; the migration runs before the deploy; never edit a committed migration; a removal comes in a later migration |
| The server's own state outside the life (switches, boards, the draw) | Depends on the table | Say so in the report; the maintainer decides |

A change that does not fit a row goes to the maintainer before it is built.

## How to raise the content version

Every version below the current one is kept exactly as it shipped, frozen and listed, whether or not lives were found under it, since no check can see the databases (server:older-content-frozen). `pnpm check:version` fails until it is. The order:

1. **Freeze, before anything changes.** On a checkout where `pnpm check:version` passes, run `pnpm content:freeze`. It writes the sealed version's content to `packages/content/src/older/<version>/content.json`, with `seal.json` beside it holding the fingerprint of that content alone, and lists it in `olderContents` in `packages/content/src/index.ts`. It refuses a content or a simulation that moved since the seal, since only what shipped is frozen, and a version already frozen. If the change is already made, set it aside (`git stash`), freeze, and bring it back (`git stash pop`). The check now fails because the frozen version is not below the current one: the raise below mends that.
2. **Change.** The content, the simulation, or both: the rule, then the test, then the code (`japacity-dev`).
3. **Raise.** `version` in `packages/content/src/index.ts` by one, with `renames` for any id that changed.
4. **Seal.** `pnpm content:seal`. `pnpm check:version` passes again: the new version sealed, every version below it frozen and listed. A frozen folder is never edited; the check holds it to its fingerprint, and a failure there is mended by restoring the folder from git.
5. **Bless.** The goldens and the recorded lives name the content version they were made under, so the maintainer re-records (`pnpm record:lives`) and runs `pnpm bless` after the raise; the report names each golden that moved, from which month, and why. The upgrade test (`apps/server/src/authority/upgrade.test.ts`) carries a save from the frozen version to the new one, and its expectation of an empty `olderContents` moves with the first freeze.
6. **Snapshot, at the deploy.** When the simulation's code changed and production holds lives, `pnpm snapshot:all` runs from a checkout of the commit production is running, after the migration and before `wrangler deploy` (server:snapshot-before-deploy). A change to the content alone needs no snapshot: the frozen version replays the old segments and each is upgraded on its next load.

## How to see it before anyone is hurt

- `pnpm bless` after a rules change: every recorded life whose golden moves is a life that would replay differently. The list of changed goldens is the list of what the change does to past play; the report names them.
- The upgrade test (`apps/server/src/authority/upgrade.test.ts`) must pass from the shipped content version to the new one; add a save from the shipped version if none covers the shape that changed.
- The replay test (`packages/sim/src/engine/replay.test.ts`) and the rollback tests (`apps/server/src/ops/rollback.test.ts`) stay green; never loosened.
- On staging, after the deploy, a tester's existing life loads (one `GET /api/view` answers 200, not 409) before the same deploy goes to production. The Workers Logs for `japacity-server` show no 409 on `/api/view` after a production deploy; if they do, name the account and run the rollback.

## Before a production deploy, the maintainer checks

1. The migration, if any, is generated after the last and applies on staging first.
2. The content version: raised and sealed whenever the content or the simulation changed (`pnpm check:version` passes); the version production runs is in `olderContents` exactly as it shipped when lives exist under it.
3. A rules change: the maintainer's word, and `pnpm snapshot:all` before `wrangler deploy` (server:snapshot-before-deploy), or, on the maintainer's word, a wipe of the lives.
4. The record: the maintainer's record of the deploy names the commit, the content version and which of the above applied.

## Reporting

An agent's report says, under its own heading "Shipped lives": which row of the table the change is, which goldens moved and why, whether a content bump or a migration was added, and what the maintainer must do at the deploy. "None" is a valid answer only for the first row.

## Where the industry's practice agrees

Version every save and migrate forward in a chain of one step per version, with new fields starting at defaults: that is the content version, `upgradeState` and the kinds' `initial`. Never load an input log under rules other than the ones that recorded it: that is the snapshot at the version boundary (server:snapshot-before-deploy). The migration step before the build and the deploy, expand first and contract later, is the database's side of the same rule (server:migration-before-deploy).
