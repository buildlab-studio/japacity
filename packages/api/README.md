# @japacity/api

The HTTP and socket contract between the client and the server (`docs/decisions/0027-one-contract-for-the-client-and-the-server.md`). Every route's request and reply is declared here once; the server builds its replies with these types and the client reads them with the same ones, so a change on either side that the other does not expect fails `pnpm typecheck`.

- One file per area: `reply.ts` (the refusals and the clock), `game.ts` (command, view, world, preset, character, presence), `socket.ts` (the nudges, the ping and `readNudge`), `account.ts`, `pair.ts`, `moderation.ts`, `lottery.ts`, `advert.ts`, `lights.ts`, `analytics.ts`, `boards.ts`, `notify.ts`, and the admin routes in `admin.ts`, `admin.moderation.ts`, `admin.analytics.ts`, `admin.switches.ts`, `admin.advert.ts`.
- A reply that carries a stored row names the store's type (`Switches`, `ModerationLogEntry`, `Campaign`), so the row and the wire cannot drift apart.
- Imports only types, from `@japacity/sim` and `@japacity/store` (`tests/boundaries.test.ts`). Its own code is the few lists and limits both sides read (`REPORT_REASONS`, `REPORT_ACTIONS`, `TOLD_ACTIONS`, `SWITCH_NAMES`, `PING`, `PONG`, `USERNAME`, `USERNAME_SHORTEST`, `USERNAME_LONGEST`, `USERNAME_FREE_PATH`, `ACTION_MAX_DAYS`, `MAX_DIAL`, `FEEDBACK_MAX_CHARS`) and the readers of a nudge, `readNudge` (exact, the server's) and `readKnownNudge` (passing over a key it does not know, the client's).
- Imports neither app. The client takes every shape the server sends from here.
