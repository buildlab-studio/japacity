# Where things live: client, server, database

## Context and scope

Which part of the system holds each thing in the game (the browser, the server or the database), and on which platform. The platform is Cloudflare at the edge, with Postgres (Neon, London) as the database (decision 0006). Section 5 says why; section 7 says what the platform demands of the code. The figures behind the choices, with their sources and dates, are in [research note 10](../research/10-testing-tools-and-agents.md), section 3.

## Goals and non-goals

**Goals.**

- Nothing a player could gain by lying about is held on the device.
- A change that touches two players happens in one transaction.
- Storage can move to another provider without touching the simulation.
- The bill stays small when idle and bounded at a peak.

**Non-goals.** Typed free text between players: the game stores no typed message, so it needs no design for keeping, stripping or moderating one. Client prediction of results. Sign-in codes by text message.

## 1. Deciding where a thing lives

Ask these questions in order. The first yes decides.

| Question | Then it lives |
|---|---|
| Would lying about it help a player? Does it touch another player, or money? | **The server decides, and the database remembers** |
| Is it the same for everyone (the clock, rates, news, eras)? | **The server produces it.** Clients fetch it |
| Is it game content (routes, events, text, numbers)? | **Shipped with the code**, versioned. Never in the database |
| Can it be worked out from other state (japacity, what is legal now)? | **Computed by the simulation** on the server each time, and carried in the view (decision 0002). Never stored |
| Is it only how this device looks or sounds? | **The client**, on the device |

## 2. Where each thing lives

| Thing | Client | Server | Database |
|---|---|---|---|
| The rules | Shows the view; predicts nothing (server:client-never-predicts) | Runs the simulation for the truth | |
| A character | The view, for display | The authority | A snapshot, plus the save's segments of commands (server:save-is-list-of-segments) |
| The bank of turns | Shows nothing | Fills it from its own clock, one turn every 2 real hours, before any command (clock:turns-earned-from-refill-time). It never holds a month back (turn:month-turns-on-empty-bank) | Banked turns and the time of the last refill |
| Clock, rates, news, eras | Shows them | Generates them from the world seed | The world's ticks |
| Money | Shows balances | Every change is a ledger event with a named reason from the fixed list (wallet:ledger-balances-each-currency) | The ledger's totals inside each snapshot, and each day's money created and destroyed, by reason and currency (server:daily-money-report) |
| Anything between two players | Shows that player's view | One record per pair | One row per pair |
| Who is in a place | Shows a sample | Held in memory, short-lived (clock:presence-held-in-memory) | Not stored |
| Messages | Shows them | Checks the connection, blocks and rate | Stored (section 4) |
| Content | Bundled | Bundled | Only ids, and the content version each segment was made under |
| Models, sounds, images | Loaded from static hosting | | |
| Adverts | Shows a reviewed image in its slot | Holds submissions until a person reviews them | Advertisers, campaigns, creatives and their reviews, and daily counts (advert:advertiser-records-stored) |
| Sound and graphics settings | On the device | | |
| Sign-in secrets | Never | Handled by the sign-in library | References only |
| Analytics | Sends batched counts of what only it sees | Checks them, and counts the game from its own log nightly | Day totals only, in a separate store (analytics:rows-stored-as-day-totals) |

**Adverts are reviewed by hand.** A submission comes from outside the game and waits in quarantine until a person reviews it. Nothing posts by itself (advert:submissions-never-auto-post).

**The socket only nudges.** A socket tells the client that something changed, and the client fetches it with an ordinary request (clock:socket-only-nudges). Game state never travels over the socket, which keeps the server simple and cheap.

## 3. Why the server is the authority

Trusting the client would keep the server's work small, but it would let a player set their own balance and read their own results ahead, and cleaning that up afterwards hurts honest players. So the server is the authority: it plays every command (server:one-command-one-transaction). The client holds a view, sends commands, and shows the command as sent until the reply arrives (server:client-never-predicts). The game's rates, proof of funds, pair records and japacity figures are worthless if a player can edit them.

## 4. Messages between players

Players talk only in preset phrases (pair:preset-phrases-only); nobody types a message to another player.

| Field | Holds |
|---|---|
| Message id | |
| Conversation id | The pair record's id: the two character ids, sorted. One conversation per pair |
| Sender | |
| Phrase id | Which preset phrase |
| Fill-in | The phrase's fill-in, if any, chosen from a fixed list such as a place or a route |
| Sent at, read at | |

- **No text is stored, because none is typed.** There is nothing to moderate, and a phrase can be shown in any language.
- **Before storing, the server checks** that the two are connected by an invite, that neither has blocked the other, and that the sender is within the rate limit.
- **Delivery**: the server stores the row, then nudges the recipient, whose client fetches the conversation from where it left off.
- **Phrases said aloud in a place** go to whoever is there and are not stored.
- **Messages are kept for as long as the account exists.** They are game events between characters, with no typed text, and the game uses them: the genuineness interview asks about a couple's shared history. They are deleted with the account.
- **A report cites message ids.** A reported conversation is held until it is reviewed.

## 5. The platform

**Cloudflare at the edge, Postgres as the database.**

| Layer | Choice | Why |
|---|---|---|
| Requests and static files | Cloudflare Workers (Cloudflare's edge functions) with the Hono framework | Nothing to provision. A point of presence in Lagos |
| Sockets and who is where | Durable Objects (Cloudflare's small objects that keep state in memory), one per place | Idle sockets cost nothing. Presence never touches the database |
| Database | Managed Postgres in London (Neon), reached through Hyperdrive, Cloudflare's connection pooler | One place for every record, with real transactions and ordinary queries |
| Query layer | Drizzle | Widely used, and its schema style works on other stores too |
| Sign-in | Better Auth, with Google, email codes and passkeys | Free at any scale, and accounts stay in the game's database. No text-message codes: at $0.22 to $0.39 each to Nigerian numbers, they would cost more than everything else combined |

**Why Neon:** it has a London region. Cloudflare has an official guide for it. Copies of the database that include data cost almost nothing, which suits tests and previews. Scale-to-zero can be off in production and on for previews. Its weakness is failover: recovery takes minutes after a data-centre failure, with no hot standby.

**Writing a character on every command.** A character is 20 to 60 KB, and rewriting it on every command is heavy on any database. Because the simulation is deterministic, the server writes the small command every time and the full character only every 20 commands (`server.snapshotEvery`), then replays the few commands in between when loading (server:one-command-one-transaction, server:log-rows-hash-state, server:snapshots-bound-replay).

**What to watch:**

1. **The database is the one part that must be sized.** At a peak of 100,000 players online it handles about 420 commands a second, one transaction each. Heartbeats and presence stay off it.
2. **Lagos to London is about 100 ms** each way for a command. The client shows the command as sent until the reply arrives (server:client-never-predicts), and the Worker runs near the database (server:worker-placed-near-database), so the reply crosses only once.
3. **There is one provider at the edge.** When Cloudflare is down, so is the game.
4. **The bill has no cap.** Spending alerts and per-account rate limits guard it (server:spending-alerts, server:per-account-rate-limits).
5. **Every deploy snapshots every character first** (server:snapshot-before-deploy), from the deploy workflows themselves.

**Keeping the option to move:**

- All storage sits behind a few small interfaces in `packages/store`: a player's state, a pair record, the world, presence and nudges.
- One set of contract tests runs against every implementation of those interfaces.
- The simulation package uses no platform feature.

## 6. Technical choices

| Question | Choice |
|---|---|
| Postgres provider | Neon, London (server:worker-placed-near-database) |
| One deployable or two | One Worker serving the client and the API: the client's build at `japacity.app`, the server's code only under `/api`. The code stays in separate packages |
| Where the code lives | One repository, with the design pages in its `docs/` |
| Checks on every change | GitHub Actions (`.github/workflows/check.yml`, decision 0040). On every push to a pull request: the quick checks and the unit tests the change can reach. In the merge queue, on every push to `main` and by hand: every unit test and simulated play. The full `pnpm check` runs locally. The browser suite runs locally, and nightly and by hand in `.github/workflows/browser.yml` |
| Tests against a database | An in-process Postgres for unit tests (PGlite, `packages/db`). Provider branches for previews |
| Email for sign-in codes | Cloudflare Email Service (decision 0007). Google sign-in is the main path |
| People built on the device or shipped as files | Shipped as files (`apps/client/public/assets/shared/person`) |
| Animations in code or from a library | In code, with no animation library |
| Styling and components for the interface | Tailwind 4 and Base UI (`AGENTS.md`) |

## 7. What the platform demands

Five facts about the platform and the browsers shape the code.

| Fact | So |
|---|---|
| **Hidden information cannot reach the client.** Whether an offer is fraud, whether a rumour is true, and anything about another player must stay on the server | The client holds a view, never the state (server:client-never-predicts). The view holds no hidden field (engine:view-holds-no-hidden-field), another person is known only by facts (person:view-shows-people), and the seed never leaves the server (engine:seed-never-leaves-authority) |
| **The database pooler caches reads for 60 seconds and does not clear them after a write** | Game state goes through a configuration with caching off (`GAME_DB`). A cached configuration (`CACHED_DB`) stays bound for reads that may come from a cache (the world's ticks and the sign-in library), but nothing reads it: the world's reply is kept by the Cache API instead (server:public-replies-cached) |
| **The pooler has no advisory locks, no LISTEN and NOTIFY, and no SQL-level prepared statements** | A change touching two players locks both rows, always in sorted id order (server:paired-rows-locked-in-order) |
| **A Durable Object that sleeps loses its memory, and a timer stops it sleeping** | Who is where is rebuilt from what each socket carries. The world's clock runs on scheduled triggers, never on timers. Every deploy drops all sockets, so the client reconnects by itself |
| **The same sum can differ between browsers and the server** if it uses fractions or functions such as sine | Money is whole numbers of the smallest unit. The simulation uses no floating-point maths functions. A lint rule bans them, along with the clock and random numbers |

## 8. Alternatives considered

| Instead of | The game does | Why |
|---|---|---|
| Trusting the client with the state | The server as the authority | A player could set their own balance, and the clean-up hurts honest players |
| The client predicting results | The command shown as sent until the reply | Almost every turn draws on a hidden stream, so a prediction would often be wrong |
| One Durable Object per player as the store | Postgres | Changes that touch two players (a joint application, a break-up, a sponsorship, a sibling's status changing your points) would each span three objects with no single transaction. Leaderboards, moderation, admin and analytics would need an export pipeline. Data is easier to move out of Postgres |
| MongoDB or another document database | Postgres | The flexibility is the same: the character is one JSON document either way, and the simulation upgrades old shapes as it reads them. MongoDB has no pooled route from Cloudflare's edge, its own docs treat multi-document transactions as a fallback, fewer developers use it, and Drizzle does not support it |
| Sign-in codes by text message | Google, email codes and passkeys | Each code to a Nigerian number costs more than everything else combined |
| Typed free text between players | Preset phrases | Typed text needs rules for keeping it, stripping of numbers and links, and moderation, and it opens the scams the safety rules close (`01-concept.md` section 6) |
