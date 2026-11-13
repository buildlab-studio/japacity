# @japacity/db

The Postgres implementation of the store interfaces (`docs/decisions/0006-the-online-stack.md`):

- a Drizzle schema in `src/schema/` (Better Auth's tables kept apart in `auth.ts`);
- the migrations generated from it, in `migrations/`;
- one store per interface in `src/stores/`, each a plain function over a `Handle`.

## Use

- In production, `const { handle, close } = await connect(url)` makes one `pg` client for one request. `pgStores(handle)` gives every store. Call `close()` after the response.
- A `Handle` runs its calls one after the other, because one connection cannot hold two transactions at once. Locks between connections are Postgres's own.
- Imports: `@japacity/store`, types from `@japacity/sim`, Drizzle and `pg`. PGlite comes only through `@japacity/db/pglite`, which the server's runtime code never imports.

## Tests

- `pnpm vitest run --project db` runs the contract suites of `@japacity/store/contract` on PGlite with the committed migrations applied, one database per test file. `pnpm check` includes it.
- The lock races: `DATABASE_URL=postgres://localhost:5432/japacity_race pnpm vitest run --project db-race`, against a Postgres 18 database kept for them (every table is emptied). Without the variable the run fails.
- `src/migrations.test.ts` holds the committed migrations to the schema:
  - It migrates one PGlite with them and one with a fresh generate of `src/schema/` (drizzle-kit's own generator, run in the test).
  - It walks both catalogs (schemas, tables, columns with their types, defaults and nullability, constraints, indexes, sequences, functions, triggers) and expects them equal, apart from the hand-written functions and triggers, which it names.
  - It checks both insert-only triggers refuse an update and a delete.
  - It checks the journal starts at `0000_japacity` and each later entry comes after the one before.

## Migrations

- To add one: change `src/schema/`, run `pnpm --filter @japacity/db db:generate --name <what-changed>`, and commit the new files in `migrations/`. It needs no database. Never edit a committed migration.
- To apply them to a real database: `pnpm --filter @japacity/db db:migrate` from the root, with `DATABASE_URL_UNPOOLED` set to the branch's direct connection string for the migrator role. On the local stack, `pnpm db:migrate:local` applies them to its Postgres (`LOCAL_DATABASE_URL`, on this machine only).
- The first file, `migrations/0000_japacity.sql`, holds every table generated from `src/schema/` and, written by hand at its end, the functions and triggers the schema cannot express (the insert-only triggers on the moderation log and the switch log).
- Every deploy applies the migrations before the new Worker is up, so every migration after the first only adds, and a column or table is removed in a later migration of its own (server:migration-before-deploy).
