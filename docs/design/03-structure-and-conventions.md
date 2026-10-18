# Structure and conventions

> Shaped by reading the source trees of 14 open source games and simulations. Section 10 says what that reading showed.
> Purpose: every kind of game thing lives in the same places and is named the same way, so a person or an agent who has seen one has seen them all.

## 1. What real codebases do

Fourteen projects were cloned and read, from a 370-star incremental game to an 18,800-star chess server.

| Pattern | How many of 14 |
|---|---|
| Content kept as data, separate from logic | 11 |
| One data file or folder per kind of content | 9 |
| A shared or pure core used by client and server | 8 |
| A registry keyed by kind and id | 8 |
| Behaviour written inside the data entries | 7 |
| Data kept pure, with logic in the engine | 4 |
| Tests in a separate tree | 7 |
| Tests beside the code | 4 |
| Tests that validate every content table | 6 |
| Seeded randomness with replay | 4 |
| The same fixed set of files for every kind | **0** |

**What that means for us:**

- Kinds, ids, a registry, and files grouped by kind are standard practice.
- A fixed file set per kind is not. Real projects keep all entries of a kind in one data file and add other files only where needed.
- Declaring "how many, who, how long" once per kind is our own idea. Every project that has scope or duration sets it per entry.
- Behaviour inside data is common and has a cost: one project's entries cannot be saved as plain data, and two that invented scripting inside data maintain formal deprecation processes.

## 2. A kind

A kind is a category of game thing: a route, a status, an obligation, a news story.

**Every kind has two files:**

| File | Holds |
|---|---|
| `content/<kind>/<kind>.data.ts` | All entries of the kind, in one table keyed by id |
| `sim/<kind>/<kind>.schema.ts` | The shape of an entry and of its state |

**A kind adds these only when it needs them:**

| File | Holds |
|---|---|
| `sim/<kind>/<kind>.logic.ts` | Pure functions: what is legal now, apply an event, end the turn, what must always be true |
| `sim/<kind>/<kind>.events.ts` | The kind's own events |
| `content/<kind>/<kind>.text.ts` | The words, keyed. See `../rules/text.md` |
| `sim/<kind>/<kind>.test.ts` | Tests, next to the code, each citing a rule name |
| `client/features/<kind>/<Kind>View.tsx` | How it looks |
| `docs/rules/<kind>.md` | The rules in words, each with a name |

**The mirror rule: wherever a kind has a file, the kind's name is in it.** Know the kind, and you know where to look.

## 3. Data stays plain

Entries are data only. No functions inside them.

- What an entry does is a list of typed effects: `{ type: "money/add", amount: 5000 }`.
- The engine knows how to carry out each effect type.
- When an entry truly needs custom behaviour, it names a handler, and the handler is a normal function in the kind's logic file.
- No scripting language inside data.

This keeps saves plain, keeps content checkable, and stops the game's rules from scattering across thousands of entries.

## 4. The three questions

Kinds differ in three ways. Each kind answers them once, in its schema and its logic, and an entry can differ from its kind.

| Question | Answers | What it decides |
|---|---|---|
| **How many can a character have?** | One, or many | The state is a single slot or a collection keyed by id |
| **Who does it involve?** | One player, a pair, or the whole world | Where the state lives, who must agree, and who may see it |
| **How long does it last?** | Instant, lasting, or recurring | Resolves at once, runs for some months, or comes due every so many months |

An entry differs when it must: a car on finance is an obligation that lasts 48 months, and a joint application is a route with pair scope.

Kinds that move through stages list their states in order, and all use one small helper.

**Why ask them of every kind?** No surveyed project does. The answers decide the shape of the kind's state and the pattern of its screen, so asking them first keeps every kind's intent plain.

## 5. Pair state

Anything between two players is **one record**, never a copy on each side.

- Its id is made from the two player ids, sorted, so there is only one possible record for any pair.
- It holds a pending flag for each side, for changes that need both to agree.
- A helper returns the other party.

A joint application, a courtship, the genuineness interview, a break-up, and a sponsorship all use this.

## 6. Commands, events, and views

Three ideas, each standard in the server-authoritative projects surveyed.

| Idea | Rule |
|---|---|
| **Commands and events are different** | The client sends a command: `route/apply`. The server checks it and records an event: `route/applied`. Only events change state |
| **Stale commands are refused** | Every command carries the state version it was based on. If the server has moved on, it is rejected and the client refetches |
| **Each player gets a view** | One function returns what a given player may see of the state. Pair and world state always pass through it |

A save is the seed plus the list of commands. The server keeps both.

## 7. The kinds in the baseline

| Kind | How many | Who | How long | States |
|---|---|---|---|---|
| quality | Many | Player | Lasting | |
| activity | Many | Player | Instant or lasting | |
| route | Many | Player, or pair when joint | Lasting | Unknown, heard, known, applying, granted, refused |
| status | One | Player | Lasting | Active, on a clock, lapsed |
| obligation | Many | Player | Recurring | Active, in grace, defaulted, closed |
| wallet | Many, one per currency | Player | Lasting | |
| rate | Many, one per currency | World | Recurring | |
| news | Many | World | Lasting | Rumour, announced, in force, ended |
| era | One | World | Lasting | Announced, running, over |
| offer | Many | Player | Lasting | Open, taken, declined, expired |
| chapter | One | Player | Lasting | Locked, current, done |
| setpiece | One at a time | Player or pair | Instant | |
| slot | Partner: one. Sibling: many | Player | Lasting | Empty, computer, invited, filled, stand-in |
| bond | Many | Pair | Lasting | Courting, partnered, ended |
| sponsorship | Many | Pair | Recurring | Pending, active, discharged |
| goal | Many | Player | Lasting | Open, done |
| place | Many | World | | |
| document | Many | Player | Lasting | Pending, held, expired |
| school | Many | World | | |
| var | Many | World | Lasting | |
| scenario | Many | World | | |
| turn | One | Player | Lasting | |

Family requests, job offers, loans and life events are all `offer`.

## 8. Names

| Thing | Pattern | Example |
|---|---|---|
| Entry id | `kind.slug`, lower case with hyphens, typed by kind | `route.uk-masters` as `Id<"route">` |
| Command | `kind/verb` | `route/apply` |
| Event | `kind/what-happened`, past tense | `route/applied`, `obligation/missed` |
| Rule name | `page:slug`, the rule page's file name and a short slug of what holds | `status:expiry-lapses-or-moves-on` |
| File | `kind.role.ts` | `route.logic.ts` |
| Test name | Rule name in brackets, then given, when, then | `[status:expiry-lapses-or-moves-on] given a sponsored worker, when ...` |
| Test helper | `name.testing.ts` beside the tests that use it, or a package's `testing/` folder when tests in several folders share it. Never exported from a test file | `place.testing.ts`, `sim/src/testing/read.ts` |
| Tool fixture | `tools/__fixtures__/<tool>/` | `tools/__fixtures__/lint/sim/divide.ts` |
| Screen | `KindView.tsx` | `OfferView.tsx` |

**Id rules:**

- A display name is never an id.
- Saves store ids only, never content.
- When an id is renamed, the old one goes in a rename table so old saves still load.

## 9. Layout

```
packages/
  sim/src/
    engine/        the turn loop, random streams, the ledger, effects, the lifecycle helper
    kinds.ts       the registry: every kind, in the order the engine calls them
    <kind>/        schema, and logic and tests where needed
    sweep/         simulated players, recorded lives, and the tests that cut across kinds
    testing/       the game handle, what tests read off a game, and the journeys tests start from; other packages import them as @japacity/sim/testing
    goldens/       the golden files
  content/src/
    <kind>/        one data file per kind
  api/src/         the HTTP contract the client and the server share
apps/
  server/
  client/src/
    authority/     the game's authority, local or remote, and the store the screens read
    features/<kind>/
    shared/ui/     the visual design system
    shared/three/  the 3D helpers
    shared/scene/  a place built from its file, which the city and the front door both draw
    sweep/         the tests that cut across features
tools/             rule-name check, bless, recording lives, the play driver, the size and scrub checks
docs/
  rules/<kind>.md
  decisions/
```

**Boundaries, enforced by a test:**

- The simulation imports nothing from the server or the client.
- The client and the server meet only in `packages/api`, which imports only types from the simulation and the store (decision 0027).
- A feature does not import another feature. Shared parts live in `shared/`.
- `shared/` and `authority/` do not import a feature: they sit under the features.
- The test holds a list of allowed exceptions that may only shrink. One surveyed project had to split its engine into packages after 14 imports had leaked across this line.

**One validation test loops over the registry** and checks every table of every kind: ids are well formed, every reference resolves, every entry fits its schema.

## 10. What reading real code showed

| Rather than | Japacity does | Shown by |
|---|---|---|
| Six files for every kind | Two required, the rest only when needed | No surveyed project has a fixed set |
| The three answers fixed per kind | Defaults that an entry can override | Every project sets scope and duration per entry |
| Not specified | Data is plain, effects are typed, handlers are named | Projects with functions or scripts in data pay for it |
| Not specified | One record per pair, with a sorted id | A strategy game's alliance record |
| Events only | Commands separate from events, with a state version | A turn-based game framework and a strategy game |
| Not specified | A per-player view function | The same framework, and a multiplayer framework |
| Dotted ids | Dotted and typed, with a rename table | A large data-driven game, and a roguelike with 13,000 stars |
| Lint rule for imports | A boundary test whose exceptions only shrink | The strategy game's engine split |

## 11. Tools

| Job | Choice |
|---|---|
| Packages in one repo | pnpm workspaces. Three surveyed projects use it |
| Categories that differ | TypeScript unions with exhaustive checks |
| State changes | Plain reducer functions: state and event in, state out |
| A new kind | An existing kind's files, copied and renamed |

## 12. Left out on purpose

- Classes and inheritance.
- Entries that inherit from other entries. Two surveyed projects warn about where that leads.
- Functions or scripting inside data.
- Layered front-end architectures.
- A state-machine library.
- Build orchestration tools. Builds are fast enough without them.
- Any shared helper before two kinds need it.

## Sources

Projects read at source: two frameworks, [boardgame.io](https://github.com/boardgameio/boardgame.io) and [Colyseus](https://github.com/colyseus/colyseus), and twelve open-source game projects: an idle hacking game, a browser strategy game, a battle simulator, a habit-tracking role-playing game, a space station role-play game, a turn-based empire strategy game, a survival roguelike, a historical real-time strategy game, an incremental game, a chess server, a browser online role-playing game and a factory-building game.

Specific files and docs cited:

- [boardgame.io: the authoritative master](https://github.com/boardgameio/boardgame.io/blob/main/src/master/master.ts)
- [boardgame.io: secret state](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/secret-state.md)
- [Colyseus: client prediction](https://github.com/colyseus/colyseus/blob/master/PREDICTION.md)
- [TypeScript handbook: narrowing and exhaustive checks](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Redux style guide](https://redux.js.org/style-guide/)
- [Sandi Metz: the wrong abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)

Not verified: star counts are the rounded figures shown on each repository page. Regrets were taken from documents and comments inside the repositories, and issue threads were not read.
