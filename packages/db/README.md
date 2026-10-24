# @japacity/db

The Postgres side of the store interfaces (`docs/decisions/0006-the-online-stack.md`): a Drizzle schema in `src/schema/` (Better Auth's tables apart in `auth.ts`), the migrations generated from it in `migrations/`, and one store per interface in `src/stores/`, each a plain function over a `Handle`.

- In production: `const { handle, close } = await connect(url)` makes one `pg` client for one request; `pgStores(handle)` gives every store; `close()` after the response.
- A `Handle` runs its calls one after the other, because one connection cannot hold two transactions at once. Locks between connections are Postgres's own.
- Tests: `pnpm vitest run --project db` runs the contract suites of `@japacity/store/contract` on PGlite with the committed migrations applied, one database per test file. `pnpm check` includes it.
- The lock races: `DATABASE_URL=postgres://localhost:5432/japacity_race pnpm vitest run --project db-race`, against a Postgres 18 database kept for them (every table is emptied). Without the variable the run fails.
- A migration: change `src/schema/`, run `pnpm --filter @japacity/db db:generate --name <what-changed>`, commit the new files in `migrations/`. Never edit a committed migration. A migration runs before the Worker that needs it is deployed, beside the Worker still running, so it only adds: a column or table is removed in a migration of its own, once no deployed Worker reads it (server:migration-before-deploy).
- The migrations start from one file, `migrations/0000_japacity.sql`, with a hand-written function and trigger at its end (server:migration-before-deploy). Every migration after it only adds.
- `src/squash.test.ts` holds `migrations/0000_japacity.sql` to the structure built by the three migrations it stands for, kept as a fixture in `src/__fixtures__/`: it migrates one PGlite with the three and one with `0000_japacity.sql`, walks both catalogs (schemas, tables, columns with their types, defaults and nullability, constraints, indexes, sequences, functions, triggers) and expects them equal. It compares only that one file, so it holds as new migrations are added.
- Deploys apply the migrations themselves, before the build and the Worker (`.github/workflows/deploy-*.yml`, with the environment's `DATABASE_URL_UNPOOLED`, the migrator role's direct string).
- Imports: `@japacity/store`, types from `@japacity/sim`, Drizzle and `pg`. PGlite only through `@japacity/db/pglite`, which the server never imports.
