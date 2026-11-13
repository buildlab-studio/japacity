# @japacity/api

The HTTP and socket contract between the client and the server (`docs/decisions/0027-one-contract-for-the-client-and-the-server.md`). Every route's request and reply is declared here once. The server builds its replies with these types and the client reads them with the same ones, so a change on one side that the other does not expect fails `pnpm typecheck`.

## Files

One file per area:

- `reply.ts`: the refusals and the clock.
- `game.ts`: command, view, world, preset, character, presence.
- `socket.ts`: the nudges, the ping and the nudge readers.
- `account.ts`, `pair.ts`, `moderation.ts`, `lottery.ts`, `advert.ts`, `lights.ts`, `analytics.ts`, `boards.ts`, `notify.ts`.
- The admin routes: `admin.ts`, `admin.moderation.ts`, `admin.analytics.ts`, `admin.switches.ts`, `admin.advert.ts`, `admin.checks.ts`.

A reply that carries a stored row names the store's type (`Switches`, `ModerationLogEntry`, `Campaign`), so the row and the wire cannot drift apart.

## Imports and code

- It imports only types, from `@japacity/sim` and `@japacity/store` (`tests/boundaries.test.ts`). It imports neither app. The client takes every shape the server sends from here.
- Its own runtime code is limited to:
  - the lists and limits both sides read: `REPORT_REASONS`, `REPORT_ACTIONS`, `TOLD_ACTIONS`, `SWITCH_NAMES`, `CHECK_NAMES`, `PING`, `PONG`, `USERNAME`, `USERNAME_SHORTEST`, `USERNAME_LONGEST`, `USERNAME_FREE_PATH`, `NEW_LIFE_PATH`, `GOOGLE_NEW_LIFE`, `ACTION_MAX_DAYS`, `MAX_DIAL`, `FEEDBACK_MAX_CHARS`;
  - the two nudge readers: `readNudge` (exact, used by the server) and `readKnownNudge` (skips a key it does not know, used by the client).
