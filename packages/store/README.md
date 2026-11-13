# @japacity/store

The storage interfaces of the online game (`docs/decisions/0006-the-online-stack.md` section 4), an in-memory implementation of each, and one contract suite per interface.

## Layout

- `src/types.ts`: `PlayerStore`, `PairStore`, `WorldStore`, `PresenceStore`, `NudgeBus`, `AccountStore`, `DeletionStore`, `LedgerStore`, `AuditStore`, `PushStore` and their rows, each pointing at its rule id.
- The other interfaces, each in its own file: `pair.types.ts` (invites, conversations, reports), `moderation.types.ts`, `advert.types.ts`, `analytics.ts` (counters), `switches.ts`, `boards.ts`, `dedication.ts`.
- `lottery.ts`: how every store compares two puts of a draw.
- `pairKeys.ts`: the one order in which ids are locked and sorted.
- `src/memory/`: the in-memory stores. They are deterministic: no clock and no randomness; times and the presence seed are passed in.
- `src/contract/`: `suiteFor<Name>(make)`, written with Vitest's `describe`. `make` returns an empty store each time it is called.

## Tests

`pnpm vitest run --project store`, or `pnpm check` for everything.

`packages/db` reuses the suites: `import { suiteForPlayerStore } from "@japacity/store/contract"`, then `suiteForPlayerStore(async () => ...)` with a store over a fresh PGlite, in its own test file (`packages/db/src/stores/player.test.ts`).

## Imports

- The runtime code imports only types from `@japacity/sim`. The contract suites also take `time` from it.
- Runtime code imports `@japacity/store`, never `@japacity/store/contract`, which pulls in Vitest.
