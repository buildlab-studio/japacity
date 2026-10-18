# 0006. The online stack, the packages and the storage interfaces

Status: Accepted

## Context

The online game runs on Cloudflare with Postgres (`../design/04-where-things-live.md` sections 5 and 6). What remains to choose is the server's libraries, how the stores are tested without a database service on every run, how the code is split into packages, and how to keep the option to move a store elsewhere.

## Decision

The server is built on the tools below, in separate packages, with every store behind an interface that has an in-memory implementation and a Postgres one, both held to one contract suite.

### 1. The tools

| Tool | Line | Why, and its trap |
|---|---|---|
| Hono | 4 | The router on Workers. A 5.0 release candidate is not taken |
| Drizzle ORM and drizzle-kit | 0.45 and 0.31 | The query builder and the migrations. Their `rc` tags are the 1.0 line, whose docs are the default on Drizzle's site: read the 0.45 docs and never install the release candidate |
| Better Auth with passkeys | 1.7 | Sign-in, with its Drizzle adapter (`provider: "pg"`), created inside each request |
| node-postgres (`pg`) | 8 | A new `Client` per request through Hyperdrive; postgres.js over Hyperdrive is not supported |
| PGlite | 0.5 | Postgres inside the test process, tests only |
| Postgres | 18 | Production, on Neon |
| The Cloudflare Vitest plugin | 1 | The Workers runtime in tests; it needs Vitest 4.1 |

The exact pins are in the `package.json` files. The Worker runs with `compatibility_flags: ["nodejs_compat"]`, which Better Auth (it uses `AsyncLocalStorage`) and node-postgres both need.

### 2. Postgres for tests

PGlite runs every store contract test inside `pnpm check`, with no service to start, with Postgres's own semantics for JSON, transactions and SQL. It has one connection, so the few tests that need two connections racing for one row (server:one-command-one-transaction's `stale`, server:paired-rows-locked-in-order's lock order) run in a separate Vitest project, `db-race`, against a local Postgres 18 named by `DATABASE_URL`, outside `pnpm check`. Not chosen: pg-mem (it cannot test `SELECT ... FOR UPDATE` and its JSONB support has gaps), Testcontainers (it needs Docker), embedded-postgres (binaries downloaded by a post-install script, beta releases only) and pglite-socket (one connection, as PGlite).

### 3. Packages

```
packages/
  sim/        the pure simulation
  content/    the game's data and words
  store/      the storage interfaces, their in-memory implementations, the contract suites
  db/         the Drizzle schema, the migrations, the Postgres implementations
apps/
  server/     Hono on Workers: routes, Better Auth, the scheduled trigger, the place objects, admin tools
  client/     the game, with a local authority and a remote one
tools/        the command-line tools, which call the server's admin functions
```

`store` stands apart from `db` so the server's unit tests and the place objects use the in-memory stores without Drizzle; `db` is the one package that knows SQL. The boundary test holds: `sim` imports nothing from `store`, `db` or `server`; `store` imports only types from `sim`; `db` imports `store`, `sim` types and Drizzle; `client` imports nothing from `store`, `db` or `server`, and server:build-scanned-for-secrets's bundle scan proves it of the built output too.

### 4. The interfaces

Every store method is a promise. The interfaces live in `packages/store/src/types.ts`: among them `PlayerStore` (a character's row, segments, snapshots and log), `PairStore` (a record shared by two characters), `WorldStore` (the world's ticks and the draws), `PresenceStore` and `NudgeBus` (held by a place object on Cloudflare, with no table), `AccountStore`, `LedgerStore`, `DeletionStore` and `AuditStore`.

Writes that belong to one command happen inside one `PlayerStore.transact`, the only way to write a character. It locks rows in ascending id order and hands its work, beside the rows, `TxStores` (`world`, `audit`) bound to the transaction's own client, so every read and write inside the work goes through the transaction's connection and the handle's one-connection lock is never entered twice. On Postgres those stores run over the transaction's connection, a store's own transaction becomes a savepoint, and a refusal after the work ran is thrown so what the work wrote rolls back with the rest. Game state reads go through a Hyperdrive configuration with caching off; only the world's ticks and the auth library may use a cached one (`../design/04-where-things-live.md` section 7).

### 5. The contract tests

`packages/store` exports one suite per interface, each a function that takes a factory (`playerStoreContract(make)`). `store` runs them on the in-memory implementations; `db` runs them on PGlite with a fresh database per file; `apps/server` runs the presence and nudge suites in the Workers runtime against the place objects. Each test title starts with the rule it proves. The `db-race` project runs the player and pair suites' locking tests with two real connections.

## Consequences

- Two implementations of each store, kept equal by one suite, which keeps the server honest about what it depends on and keeps the option to move a store.
- The in-process tests cannot catch a missing lock; the race project does, on demand, against a local Postgres.
- A store used inside a transaction must take the transaction's own client, or it waits on the transaction's lock for ever: only a real Postgres shows that, so `TxStores` makes it the only path.
- The simulation's purity, its determinism and its random streams are untouched by the stack.
