# Where things live: client, server, database

> The platform is Cloudflare at the edge and Postgres (Neon, London) as the database. Section 5 says why, section 7 what the platform demands of the code.

## 1. The guideline

Ask these in order. The first yes decides.

| Question | Then it lives |
|---|---|
| Would lying about it help a player? Does it touch another player, or money? | **The server decides. The database remembers** |
| Is it the same for everyone: the clock, rates, news, eras? | **The server produces it.** Clients fetch it |
| Is it game content: routes, events, text, numbers? | **Shipped with the code**, versioned. Never in the database |
| Can it be worked out from other state: japacity, what is legal now? | **Computed by the simulation**, on both sides. Never stored |
| Is it only how this device looks or sounds? | **The client**, on the device |

## 2. Thing by thing

| Thing | Client | Server | Database |
|---|---|---|---|
| The rules | Shows the view; online it predicts nothing (server:client-never-predicts) | Runs the simulation for the truth | |
| A character | A copy for display | The authority | A snapshot, plus the seed and the list of commands |
| Turn budget | Shows it | Works it out from its own clock | Banked turns and the time of the last refill |
| Clock, rates, news, eras | Shows them | Generates them from seeded streams | The schedule and the history |
| Money | Shows balances | Every change is a ledger entry with a named source or sink | The ledger |
| Anything between two players | Shows that player's view | One record per pair | One row per pair |
| Who is in a place | Shows a sample | Held in memory, short-lived | Not stored |
| Messages | Shows them | Checks connection, blocks, rate | Stored. See section 4 |
| Content | Bundled | Bundled | Only ids, and the content version a save was made under |
| Models, sounds, images | Loaded from static hosting | | Advert images, after review, in file storage |
| Sound and graphics settings | On the device | | |
| Sign-in secrets, payment details | Never | Handled by the sign-in library and, for any payment, a payment provider | References only |
| Analytics | Sends batched counters | Receives and checks them | A separate store |

**Adverts are reviewed by hand.** A submission comes from outside the game and waits in quarantine until a person reviews it; nothing posts by itself (advert:submissions-never-auto-post).

**Real-time connection: a nudge, not a pipe.** A socket tells the client "something changed", and the client fetches it by an ordinary request. Game state never travels over the socket. It keeps the server simple and cheap.

## 3. Why the server is the authority

Trusting the client would keep the server's work small. It would also let a player set their own balance and predict their own results, and the clean-up afterwards hurts honest players. So the server is the authority, and the client runs the same code only to show results early. Our rates, proof of funds, pair records, and japacity scores are worthless if a player can edit them.

## 4. Messages between players

### Preset phrases

| Field | Holds |
|---|---|
| Message id | |
| Conversation id | The two player ids, sorted. One conversation per pair |
| Sender | |
| Phrase id | Which preset phrase, with any fill-ins chosen from a fixed list such as a place or a route |
| Sent at, read at | |

- **No text is stored, because none is typed.** There is nothing to moderate, and a phrase can be shown in any language.
- **Before storing, the server checks**: the two are connected (invited or matched), neither has blocked the other, and the sender is within the rate limit.
- **Delivery**: store the row, then nudge the recipient. Their client fetches the conversation from where it left off.
- **Phrases said aloud in a place** go to whoever is there and are not stored.
- **Kept for as long as the account exists.** They are game events between characters, with no typed text, and the game uses them: the genuineness interview asks about a couple's shared history. They go when the account is deleted.
- **A report cites message ids.** A reported conversation is held until reviewed.

### Free text, not part of the game

The game has no typed text. If it had, this is how it would live:

- Stored on the server as text. Reports and the law both need it readable, so it is not end-to-end encrypted, and the privacy notice says so.
- Phone numbers, links, and payment details are stripped before storing.
- Opens only with the date-of-birth screen, a one-time acknowledgement that the player is responsible for who they talk to, and block and report (`01-concept.md` section 16).
- Kept for a fixed period, then deleted. Typed text is personal in a way phrases are not.

## 5. The platform

**Cloudflare at the edge, Postgres as the database.**

| Layer | Choice | Why |
|---|---|---|
| Requests and static files | Cloudflare edge functions, with the Hono framework | Nothing to provision. A point of presence in Lagos |
| Sockets and who-is-where | Cloudflare's small stateful objects, one per place or group of players | Idle sockets cost nothing. Presence never touches the database |
| Database | Managed Postgres in London (Neon), reached through Cloudflare's connection pooler | One place for every record, with real transactions and ordinary queries |
| Query layer | Drizzle | Widely used. The same schema style works on Cloudflare's own stores |
| Sign-in | Better Auth, with Google, email codes, and passkeys | Free at any scale, and accounts stay in our database. No text-message codes: at $0.22 to $0.39 each to Nigerian numbers they would cost more than everything else combined |

**Why Postgres and not one object per player:**

- **This game is full of changes that touch two players at once**: a joint application, a break-up, a sponsorship, a sibling's status changing your points. With one object per player, each of those spans three objects and no single transaction covers them. In Postgres it is one transaction.
- **Leaderboards, moderation, admin, and analytics are ordinary queries.** With objects they need an export pipeline from day one.
- **The data is easy to move.**

**Why Postgres and not MongoDB or another document database:**

- **The flexibility is the same.** The character is one JSON document either way. The simulation upgrades old shapes when it reads them, so the database never needs to know the shape.
- **MongoDB has no pooled route from Cloudflare's edge.** Its HTTP interface was removed in September 2025.
- **Changes that touch two players need transactions**, which MongoDB's own docs treat as a fallback.
- **The tooling is stronger**: 55.6% of developers use Postgres against 24%, and the chosen query layer does not support MongoDB.

**Why Neon:** London. Cloudflare has an official guide for it. Copies of the database that include data cost almost nothing, which suits tests and previews. Scale-to-zero can be off in production and on for previews. Its weakness is failover: one to ten minutes after a data-centre failure, with no hot standby.

**One cost to design around.** Rewriting a 20 to 60 KB character on every command is heavy on any database. Because the simulation is deterministic, the server writes the small command every time and the full character only every 20 commands or so, then replays the few commands in between when loading (server:one-command-one-transaction, server:log-rows-hash-state and server:snapshots-bound-replay).

**What to watch:**

1. **The database is the one thing that must be sized.** At a peak of 100,000 players online it handles about 420 commands a second, one transaction each. Heartbeats and presence stay off it.
2. **Lagos to London is about 100 ms** each way for a command. The client shows the command as sent until the reply arrives (server:client-never-predicts), and the server runs near the database (server:worker-placed-near-database) so the reply crosses once. A command that draws no random number and reads no hidden field can be predicted on the client; nothing in the contract blocks it.
3. **Cloudflare has had six published outages in two years.**
4. **The bill has no cap.** Spending alerts and per-player rate limits are the guard (server:spending-alerts).
5. **Every deploy that changes the rules snapshots every character first** (server:snapshot-before-deploy), from the deploy workflows themselves.

**Keeping the option to move:**

- All storage sits behind a few small interfaces: a player's state, a pair record, the world, presence, and nudges.
- One set of contract tests runs against every implementation of those interfaces.
- The simulation package uses no platform feature at all.

## 6. Technical choices

| Question | Choice |
|---|---|
| Postgres provider | Neon, London (server:worker-placed-near-database) |
| One deployable or two | One Worker serving the client and the API: the client's build at `japacity.app`, the server's code only under `/api`. Code stays in separate packages |
| Where the code lives | One repository, with the design pages in its `docs/` |
| Checks on every change | GitHub Actions run the quick checks on every push to `main` and every pull request (`.github/workflows/check.yml`); the full check and the browser suite run locally |
| Tests against a database | An in-process Postgres for unit tests (PGlite, `packages/db`). Provider branches for previews |
| Email for sign-in codes | Cloudflare Email Service (decision 0007). Google sign-in is the main path |
| People built on the device or shipped as files | Shipped as files (`apps/client/public/assets/shared/person`) |
| Animations in code or from a library | In code, with no animation library |
| Styling and components for the interface | Tailwind 4 and Base UI (`AGENTS.md`) |

## 7. What the platform demands

Five facts about the platform and the browsers that shape the code.

| Fact | So |
|---|---|
| **Hidden information breaks "the client runs the same simulation".** Whether an offer is fraud, whether a rumour is true, and anything about another player must not reach the client | The client simulates only what the player can see. Any result that depends on hidden state is decided by the server and arrives as an event. This is rule 1 of the engine contract |
| **The database pooler caches reads for 60 seconds and does not clear them after a write** | Game state goes through a second connection with caching off |
| **The pooler has no advisory locks, no listen and notify, and no SQL-level prepared statements** | A change touching two players locks both rows, always in sorted id order |
| **A stateful object that sleeps loses its memory, and a timer stops it sleeping** | Who-is-where is rebuilt from what each socket carries. The world's clock runs on scheduled triggers, never on timers. Every deploy drops all sockets, so the client reconnects by itself |
| **The same sum can differ between browsers and the server** if it uses fractions or functions such as sine | Money is whole numbers of the smallest unit. The simulation uses no floating-point maths functions. A lint rule bans them next to the clock and random numbers |
