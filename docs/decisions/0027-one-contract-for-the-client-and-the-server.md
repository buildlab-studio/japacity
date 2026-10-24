# 0027. One contract for the client and the server

Status: Accepted

## Context

The client imports nothing from the server, the store or the database (decision 0006 section 3), and server:build-scanned-for-secrets's bundle scan proves it of the build. Yet the two must agree on every route's request and reply, on the socket's messages and on the few lists both read, such as the report reasons and the switch names. This record adds one package to decision 0006's layout.

## Decision

`packages/api` (`@japacity/api`) holds the contract: each route's request and reply, the admin routes' replies, and the socket's messages. Both apps depend on it, and the client takes every shape the server sends from it.

- The server builds its replies with these types and the client reads them with the same ones, so a change on one side that the other does not expect fails the type check of both.
- A reply that carries a stored row names the store's type (`Switches`, `ModerationLogEntry`, `Campaign`, `Nudge`): the row and the wire are one declaration.
- The package imports only types, from `@japacity/sim` and `@japacity/store`; `tests/boundaries.test.ts` holds it there. The client compiles against the store's types and never bundles its code, and server:build-scanned-for-secrets's scan stays as it is.
- Its own code is what both sides must read the same way: the lists `REPORT_REASONS` (moderation:report-carries-subject-and-reason), `REPORT_ACTIONS` (moderation:fixed-admin-actions) and `SWITCH_NAMES` (server:four-off-switches), the socket's `PING` and `PONG` (clock:client-sends-only-pings), and `readNudge` (clock:socket-only-nudges), the one reader of a nudge, which drops a message with any key a nudge does not have.

## Consequences

- One declaration of each shape and no text comparison: the compiler checks every use on both sides.
- The client's type check reads the store's type files; the store gains no dependency and the boundary forbids the client to import it.
- A shape the server answers with an inferred type, as most admin routes do, is held by the client's use of it, not by the server's; naming the reply type where the server builds it closes that.
- The contract and the store change together where a reply carries a row: changing a stored row is changing the wire.

## Alternatives

- A copy of each shape on the client's side, held to the server's by a test that compares the two files as text: it agrees only on the shapes the test lists, and fails late, in a test, rather than where a shape is used.
- A schema the replies are validated against at run time, from which both sides' types are made: a runtime cost on every reply, a dependency, and a second language for the shapes.
- The router's own typed client, inferred from the server's routes: the client would compile the server, which decision 0006 rules out.
