---
name: japacity-shipped-lives
description: "How a change is checked against the lives players already have on production. Use before changing the simulation's rules, the content's data or shape, the state's shape or the database schema once lives exist on production: how a life is kept and replayed, which kind of change breaks which lives, what carries them (content upgrades, snapshots, migrations, the rollback), and the checklist before a deploy."
---

# Checking a change against shipped lives

Once a player has a life on production, a change also affects that life. Use this skill to judge a change against shipped lives before you build it and before it is deployed. Staging's lives are test lives and may be reset with the maintainer's agreement. Production's lives are never reset.

## How a life is stored, and why a rules change can break it

How the server keeps and replays a life is in `docs/site/built/server.md`, "The log, segments and replay check", and in the rules it cites. What matters for a change:

- **Every load replays.** The server keeps each life as a snapshot plus a log of the commands after it, and every load replays the log under the segment's own content and checks the hash (server:log-rows-hash-state, server:snapshots-bound-replay). A life whose hash differs, or whose replay now rejects a command, is refused as `diverged` (HTTP 409) until it is mended; every other life carries on (`apps/server/src/authority/load.ts`).
- **So rules changes break replays.** Changing the simulation's rules (`packages/sim`: anything that changes what a command does or what a month produces) changes what old commands replay to. A command log is only valid under the rules that first ran it.
- **Content is versioned.** `version` in `packages/content/src/index.ts` moves with any change to the content's data or the simulation's code (server:content-version-sealed). Older versions are bundled as they shipped (`olderContents`), and a life saved under one is replayed under it, then carried to the current content by `upgradeState` in `packages/sim/src/engine/state.ts` (server:older-contents-bundled, server:newer-content-upgrades-state, server:upgrade-state-is-pure). The upgrade renames ids through the newer content's `renames`, builds missing slices with their kind's `initial` and fills slices that grew; a failed upgrade throws and writes nothing.
- **Schema changes are migrations**, which run before every deploy and only add (server:migration-before-deploy).
- **Diverged lives are mended with the rollback tool**, one life at a time (server:rollback-check-finds-divergence, server:rollback-apply-one-account, server:no-mass-rollback): `pnpm rollback check|apply <character>`. With no flag it opens the database at `DATABASE_URL_UNPOOLED`; `--memory <save.json>` runs it against a saved file.

## Step 1: find out what is shipped

1. Production's commit and content version: `/api/health` returns `content`, and the maintainer's record of the deploy names the commit.
2. Whether lives exist on production: the maintainer counts `characters` in production's database. An agent never reads that database; ask the maintainer. If there are no lives, nothing needs carrying and anything may change.
3. The same for staging: what is there, and whose lives they are.

## Step 2: classify the change

| The change touches | Effect on a shipped life | What carries the life over |
|---|---|---|
| Words, screens, the client alone, the teaser, docs | None | Nothing needed |
| Content data under `packages/content` (an entry, a number, a table), with the state's shape unchanged | The life's segment names the old content. It replays under the old bundle and is upgraded on load | `pnpm content:freeze`, then raise `content.version` by one and run `pnpm content:seal`, so the shipped version joins `olderContents` exactly as it shipped (see [Raising the content version](#raising-the-content-version)). Add `renames` for any id that changed. The upgrade test from the shipped version (`apps/server/src/authority/upgrade.test.ts`) must pass |
| The state's shape (`packages/sim` types, a kind's schema, a new slice) | As above, and the upgrade must build or fill the slice | A content version raise as the trigger, with the shipped version in `olderContents`. The kind's `initial` builds a new slice; the engine fills slices that grew inside a kind (`grownTo4` under `upgradeState` in `packages/sim/src/engine/state.ts`). Invariants must accept the carried state. The upgrade test needs a save recorded under the shipped version |
| The simulation's rules (`evolve`, a command's acceptance, a month's results, the random streams) | Every life with commands since its last snapshot diverges on its next load | Raise and seal the content version (server:content-version-sealed), and add the shipped version to `olderContents` (its data as it shipped; when only the code changed, that is the current data under the old version). Never deploy a rules change over shipped lives without the maintainer's agreement. Every deploy snapshots every life from the live commit before it switches (server:snapshot-before-deploy), so old commands are never replayed under the new rules. Mend any life that still diverges with the rollback tool, one at a time |
| The database schema (`packages/db/src/schema`) | None if the migration only adds | Run `pnpm --filter @japacity/db db:generate --name <x>` after the last migration. The migration runs before the deploy. Never edit a committed migration. Removals come in a later migration |
| The server's own state outside the life (switches, boards, the draw) | Depends on the table | Say so in the report; the maintainer decides |

If a change fits no row, take it to the maintainer before building it.

## Raising the content version

Every version below the current one is kept exactly as it shipped, frozen and listed, whether or not lives exist under it, because no check can see the databases (server:older-content-frozen). `pnpm check:version` fails until this holds. Steps, in order:

1. **Freeze, before changing anything.** On a checkout where `pnpm check:version` passes, run `pnpm content:freeze`. It writes the sealed version's content to `packages/content/src/older/<version>/content.json`, with `seal.json` beside it holding the fingerprint of that content alone, and lists it in `olderContents` in `packages/content/src/index.ts`. It refuses if the content or the simulation moved since the seal (only what shipped is frozen), and refuses a version already frozen. If you have already made the change, set it aside (`git stash`), freeze, and bring it back (`git stash pop`). The check now fails because the frozen version is not below the current one; step 3 fixes that.
2. **Change** the content, the simulation, or both: the rule, then the test, then the code (`japacity-dev`).
3. **Raise** `version` in `packages/content/src/index.ts` by one, with `renames` for any id that changed.
4. **Seal** with `pnpm content:seal`. `pnpm check:version` passes again: the new version is sealed and every version below it is frozen and listed. Never edit a frozen folder. The check holds it to its fingerprint; if that fails, restore the folder from git.
5. **Bless.** The goldens and the recorded lives name the content version they were made under, so after the raise the maintainer re-records (`pnpm record:lives`) and runs `pnpm bless`. The report names each golden that moved, from which month, and why. The upgrade test (`apps/server/src/authority/upgrade.test.ts`) carries a save from the frozen version to the new one, and its list of expected `olderContents` versions grows with each freeze.
6. **Snapshot at the deploy.** Every deploy snapshots every character from the commit the environment is running, in the order server:migration-before-deploy gives (server:snapshot-before-deploy). The deploy workflows do it; a deploy by hand runs `pnpm snapshot:all` from a checkout of the live commit at that point (`apps/server/README.md`).

## Catching breakage before players see it

- Run `pnpm bless` after a rules change. Every recorded life whose golden moves is a life that would replay differently. The list of changed goldens is the list of what the change does to past play; the report names them.
- The upgrade test (`apps/server/src/authority/upgrade.test.ts`) must pass from the shipped content version to the new one. Add a save from the shipped version if none covers the shape that changed.
- The replay test (`packages/sim/src/engine/replay.test.ts`) and the rollback tests (`apps/server/src/ops/rollback.test.ts`) stay green and are never loosened.
- On staging, after the deploy and before the same deploy goes to production, a tester's existing life must load (one `GET /api/view` returns 200, not 409).
- After a production deploy, the Workers Logs for `japacity-server` must show no 409 on `/api/view`. If they do, name the account and run the rollback.

## Rehearsing a version raise before the deploy

Rehearse a raise on the local stack first, and on staging when staging holds lives: play lives under the version that ships now, then carry them to the version about to ship. `apps/server/src/authority/carry.test.ts` covers the same path in a unit test for every version in `olderContents`; the rehearsal runs it on the real Worker, the real database and the built client.

On the local stack:

1. On a checkout of the commit the environment runs, start the stack (`pnpm dev:full`). Give it its own database with `LOCAL_DATABASE_URL` in `.env.local` (a database made with `createdb` in the Compose Postgres), so the rehearsal's lives are the only ones there.
2. Play the lives a deploy meets, each with `--keep <file>`. The file must be outside the repository; it holds a signed-in session and is never printed.
   ```sh
   pnpm play --url https://localhost:8787 --life nurse --months 2 --keep /tmp/japacity-kept/nurse.json --out /tmp/japacity-play/nurse
   pnpm play --url https://localhost:8787 --life water --months 2 --keep /tmp/japacity-kept/water.json --out /tmp/japacity-play/water
   pnpm play --url https://localhost:8787 --life accountant --stop door --keep /tmp/japacity-kept/door.json --out /tmp/japacity-play/door
   pnpm play --url https://localhost:8787 --life trader --months 1 --stop planned --keep /tmp/japacity-kept/planned.json --out /tmp/japacity-play/planned
   ```
   `--stop door` keeps a life made at Begin with its years before unplayed. `--stop planned` keeps one with a month planned and not ended.
3. Do what a deploy does before it switches (server:migration-before-deploy): run the migration (`pnpm db:migrate:local`), then `pnpm snapshot:all` from the same checkout with `DATABASE_URL_UNPOOLED` set to the local database's connection string (server:snapshot-before-deploy). Every line must read `snapshotted` or `already`, and the last line must count no `diverged` or `failed`.
4. To reproduce the race a live deploy has, play one kept life on with `--resume <file> --keep <file> --months 1` after the snapshot and before the switch. Its commands are then logged after its snapshot, under the version that ships now.
5. Stop the stack, check out the commit about to ship, and start the stack again. The migrations run as they do before a deploy.
6. Resume every kept life: `pnpm play --url https://localhost:8787 --resume <file> --months 2 --out <folder>`.
7. Run `pnpm rollback check <character>` for each life, with `DATABASE_URL_UNPOOLED` set as in step 3. The character ids are in the `characters` table, by the account's username, which the driver logs at Begin.

On staging, the deploy workflow does the migration, the snapshot and the deploy. The rollback check on staging's database is done by the maintainer. The driver reaches staging with `--url https://staging.japacity.app` and the Access service token in `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` (`tools/local/access.ts`). Staging's bot check refuses the driver's browser at Begin, so the driver cannot make a life there to keep. Before a staging deploy, the lives to carry are the testers' own; after it, check that each tester's life loads (see [Catching breakage before players see it](#catching-breakage-before-players-see-it)). A storage file kept from a staging session the driver did not make is resumed the same way, with `--resume`.

What to read afterwards:

- **Each resumed run.** Its first picture, `NN-resumed.png`, shows the life where it was left (the world, or the years before filling for a life stopped at the door). Its last line shows every month asked for ended, with no problem. `PROBLEM the server refused the resumed life: 409 on /api/view` means the life diverged. Any other status, or a trouble card, means a load failed. Either fails the run.
- **Each `rollback check`.** Its report must say `"ok": true`, `"firstDiff": null` and `"dropped": []` for every account. A `firstDiff` names the first version that replays differently; mend that life with `pnpm rollback apply <character>` before the deploy goes further.
- **The database.** Each carried life has one more segment, under the new version, opened at its first load after the switch and never again (`segments` by character).
- **Going back strands lives.** Reverting to the commit before the raise, after a carried life has played under the new version, strands that life: the older code does not bundle the newer content, so the load fails and its rollback check returns `no-content`. Only roll a deploy back to a commit that bundles every version a life's segment names.

## Production deploy checklist (for the maintainer)

1. The migration, if any, is generated after the last one and applied on staging first.
2. The content version is raised and sealed whenever the content or the simulation changed (`pnpm check:version` passes). When lives exist under the version production runs, that version is in `olderContents` exactly as it shipped.
3. For a rules change: the maintainer's agreement. The deploy's snapshot step (server:snapshot-before-deploy) must end with no character skipped; a skipped one is mended with the rollback tool. With the maintainer's agreement, the lives may be wiped instead.
4. The maintainer's record of the deploy names the commit, the content version and which of the above applied.

## Reporting

An agent's report has its own heading, "Shipped lives", which says:

- which row of the table the change falls under;
- which goldens moved, and why;
- whether a content version raise or a migration was added;
- what the maintainer must do at the deploy.

"None" is a valid answer only for the first row.

## Why it works this way

These follow common practice for versioned saves:

- Version every save and migrate forward one step per version, with new fields starting at defaults: here, the content version, `upgradeState` and the kinds' `initial`.
- Never replay an input log under rules other than the ones that recorded it: here, the snapshot at the version boundary (server:snapshot-before-deploy).
- Migrate the database before the build and the deploy, adding first and removing later (server:migration-before-deploy).
