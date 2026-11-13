# Structure and conventions

## Context and scope

Where each kind of game thing lives in the repository and how it is named, so that someone who has seen one kind knows where to find everything for any other. How code and tests are written line by line is in `../../AGENTS.md` ("How code is written", "How tests are written"). The import boundaries are enforced by `tests/boundaries.test.ts`. The reading of other open-source codebases behind these choices is in [research note 11](../research/11-game-codebases-read.md).

## Goals and non-goals

**Goals.**

- Every kind keeps its files in the same places under the same names.
- Content can be checked as plain data, and saves store ids only.
- A test, not a habit, holds the boundaries between packages.

**Non-goals.** Classes and inheritance; entries that inherit from other entries; functions or scripting inside data; a state-machine library; build orchestration tools; a shared helper before two kinds need it.

## 1. Terms

| Term | Means |
|---|---|
| Kind | A category of game thing: a route, a status, an obligation, a news story |
| Entry | One row of a kind's content table, keyed by id: `route.uk-masters` |
| Slice | A kind's part of a character's state. Only that kind changes it |
| Effect | A typed instruction one kind sends another: `{ type: "money/add", ... }` |
| Command | What a player or the authority asks for: `route/apply` |
| Event | What happened, recorded when a command is accepted: `route/applied` |
| View | What one player may see of the state, made by one function |
| Pair record | The single record of anything between two players |

## 2. A kind's files

A kind has only the files it needs, each named after the kind. Most kinds have both of these:

| File | Holds |
|---|---|
| `packages/content/src/<kind>/<kind>.data.ts` | All entries of the kind, in one table keyed by id |
| `packages/sim/src/<kind>/<kind>.schema.ts` | The shape of an entry |

A kind with a slice but no entries of its own (the turn, the wallet, the credit file, the lottery) has no schema file; its slice's type is in `packages/sim/src/engine/types.ts`. A kind adds these only when it needs them:

| File | Holds |
|---|---|
| `packages/sim/src/<kind>/<kind>.logic.ts` | Pure functions: what is legal now, applying an event, the kind's phase of the month |
| `packages/sim/src/<kind>/<kind>.events.ts` | The kind's own events |
| `packages/content/src/<kind>/<kind>.text.ts` | The words, keyed. See `../rules/text.md` |
| `packages/sim/src/<kind>/<kind>.test.ts` | Tests, next to the code, each citing a rule name |
| `apps/client/src/features/<kind>/` | The kind's screens, such as `OfferView.tsx`, and their words table |
| `docs/rules/<kind>.md` | The rules in words, each with a name |

**Every file a kind owns has the kind's name in it**, so knowing the kind tells you where to look. Two slices use the singular for their folder: the `people` slice lives in `person/` and the `things` slice in `thing/`.

## 3. Plain data

Entries hold data only, never functions.

- What an entry does is a list of typed effects: `{ type: "money/add", currency: "NGN", pocket: "cash", amount, reason: "gig" }`.
- The engine knows how to carry out each effect type, and each type belongs to one kind (`../rules/engine.md`).
- Behaviour an effect list cannot express lives in the kind's logic file as a plain function that reads the entry's fields.
- No scripting language inside data.

This keeps saves plain and content checkable, and keeps the game's rules from scattering across thousands of entries.

## 4. Three questions for each kind

Kinds differ in three ways. Each kind answers the three questions once, in its schema and its logic. An entry may differ from its kind's answer when it must.

| Question | Answers | What it decides |
|---|---|---|
| **How many can a character have?** | One, or many | Whether the slice is a single value or a collection keyed by id |
| **Who does it involve?** | One player, a pair, or the whole world | Where the state lives, who must agree, and who may see it |
| **How long does it last?** | Instant, lasting, or recurring | Whether it resolves at once, runs for some months, or comes due every so many months |

For example, a car on finance is an obligation that lasts 36 months, and a joint application is a route with pair scope.

Answering the three questions first fixes the shape of the kind's state and the pattern of its screen.

## 5. Pair state

Anything between two players is **one record**, never a copy on each side (pair:one-record-per-two).

- Its id is the two character ids, sorted and joined by `~`, so a pair can have only one record.
- It holds a pending proposal for each side, for steps that need both to agree (pair:joint-steps-need-both-sides).
- The pure helper `other(record, me)` returns the other party.

A courtship, a joint application, the genuineness interview, a break-up and a sponsorship all use it. Only the server writes it (pair:only-server-writes-record).

## 6. Commands, events, and views

| Idea | Rule |
|---|---|
| **Commands and events are different** | The client sends a command: `route/apply`. The authority checks it and records events: `route/applied`. Only events change state (engine:only-events-change-state) |
| **Stale commands are refused** | Every command carries the state version it was based on. If the server has moved on, the command is rejected and the client fetches the state again (engine:stale-commands-rejected) |
| **Each player gets a view** | One function returns what a given player may see of the state. Pair and world state always pass through it (engine:view-holds-no-hidden-field) |

A save is a list of segments of commands, each naming its content version (decision 0004). The server keeps them.

## 7. The kinds

The kinds with a slice, in the registry's order (`packages/sim/src/kinds.ts`):

| Kind | How many | Who | How long | States |
|---|---|---|---|---|
| turn | One | Player | Lasting | |
| quality | Many | Player | Lasting | |
| activity | Many | Player | Instant or lasting | |
| wallet | One pocket set per currency | Player | Lasting | |
| document | Many | Player | Lasting | Pending, held, expired |
| route | Many | Player, or pair when joint | Lasting | Unknown, heard, known, applying, granted, refused, departed |
| setpiece | One open at a time | Player or pair | Instant | |
| obligation | Many | Player | Recurring | Active, in grace, defaulted; a closed one is removed |
| offer | Many | Player | Lasting | Open; a taken, declined or lapsed one is removed |
| chapter | One current | Player | Lasting | Current, done |
| news | Many | World, with a record of what each character was shown | Lasting | Rumour, announced, in force, ended |
| place | One | Player | Lasting | Home, abroad, on the road |
| status | One current | Player | Lasting | In force, on a clock, overstaying |
| credit | One | Player, abroad | Lasting | |
| goal | Many | Player | Lasting | Open, done |
| prologue | One | Player | Instant | Open, closed |
| lottery | One | Player, against the world's draw | Recurring | |
| people | Slots and bonds | Pair | Lasting | Slots: empty, computer, invited, player, stand-in. Bonds: connected, courting, partner, married, ended |
| interview | One open at a time | Pair | Instant | |
| home | One | Player | Lasting | |
| things | Many | Player | Lasting | |

Content tables with no slice of their own include `era`, `var`, `school`, `scenario`, `country`, `points`, `phrase`, `person` (the computer characters) and `story`; the full list is in `packages/content/src/index.ts`. The world (the rates, the eras, the stories) is built in `packages/sim/src/world/` from the world seed and the tick.

Family requests, job offers, loans and life events are all of kind `offer`.

## 8. Naming

| Thing | Pattern | Example |
|---|---|---|
| Entry id | `kind.slug`, lower case with hyphens, typed by kind | `route.uk-masters` as `Id<"route">` |
| Command | `kind/verb` | `route/apply` |
| Event | `kind/what-happened`, past tense | `route/applied`, `obligation/missed` |
| Rule name | `page:slug`: the rule page's file name and a short slug of what holds | `status:lost-job-starts-clock` |
| File | `kind.role.ts` | `route.logic.ts` |
| Test name | The rule name in brackets, then given, when, then | `[status:lost-job-starts-clock] given a sponsored care worker, when ...` |
| Test helper | `name.testing.ts` beside the tests that use it, or in a package's `testing/` folder when tests in several folders share it. Never exported from a test file | `apps/server/src/place/place.testing.ts`, `packages/sim/src/testing/read.ts` |
| Journey a test starts from | `kind.journey.ts` in the simulation's `testing/` folder | `packages/sim/src/testing/route.journey.ts` |
| Tool fixture | `tools/__fixtures__/<tool>/` | `tools/__fixtures__/lint/sim/divide.ts` |
| Screen | `KindView.tsx` | `OfferView.tsx` |

**Ids:**

- A display name is never an id.
- Saves store ids only, never content.
- When an id is renamed, the old id goes in the content's rename table (`content.renames`), so old saves still load (server:upgrade-state-is-pure).

## 9. Folder layout and import boundaries

```
packages/
  sim/src/
    engine/         the step, the random streams, the ledger, effects, the view, the contract's types
    kinds.ts        the registry: every kind with a slice, in the order the engine calls them
    world/          the world built from its seed and tick: rates, eras, stories
    <kind>/         schema, logic, events and tests where needed
    simulated-play/ simulated players, recorded lives, and the tests that cut across kinds
    testing/        the game handle, what tests read off a game, and the journeys tests start from; other packages import them as @japacity/sim/testing
    goldens/        the golden files
  content/src/
    <kind>/         the kind's data and words
    ui/             the interface's words
    older/          the shipped content of earlier versions, frozen
  api/src/          the HTTP contract the client and the server share
  store/src/        the storage interfaces and their contract tests
  db/               Postgres through Drizzle, the migrations, and PGlite for tests
  brand/            the game's marks
  model-kit/        the code that builds the city's models
apps/
  server/           the Worker: the API, the clock, presence, the world's ticks
  client/src/
    app/            the shell and its tests
    authority/      the game's authority, local or remote, and the store the screens read
    features/<kind>/ one kind's screens
    shared/         what two features need: ui, words, world, three, scene, phone and the rest
    cross-feature/  the tests that cut across features
  teaser/           the teaser video
models/             the sources of the city's models, never shipped: builders, specs, outlines, reviews, the register (decision 0009)
tools/              the checks (rules, scrub, size, protected, content version), goldens and bless, recording lives, the play driver, assets, the load test, the local stack, share pictures and notices
tests/              repository-wide tests, such as the import boundaries
docs/
  rules/  decisions/  design/  research/  site/  teaser/
```

**Import boundaries, enforced by `tests/boundaries.test.ts`:**

- The simulation imports only `zod` and itself. Its tests may also import content and the test libraries.
- Content imports only the simulation, `zod` and itself. Its tests may also import the test libraries.
- The client and the server meet only in `packages/api`, which imports only types from the simulation and the store (decision 0027).
- The store imports only the simulation and itself, plus the test libraries in its tests and its contract suites.
- The database package imports only the store, types from the simulation, Drizzle and `pg`. The migration tool, PGlite and the test libraries are allowed only in its test and migration files, and only its tests import the store's contract suites.
- The client imports nothing from the store, the database or the server. Nothing in the simulation, the store or the client imports the database.
- Only files inside an app import from that app.
- A feature does not import another feature. Shared parts live in `shared/`.
- `shared/` and `authority/` sit under the features and do not import a feature.
- The test holds a list of allowed exceptions. The list may only shrink, and a stale entry fails the test. The list is empty.

The simulation's and content's import limits are also lint rules in `eslint.config.js`.

**One validation test loops over the registry** and checks every table of every kind: ids are well formed, every reference resolves, and every entry fits its schema (engine:content-checked-before-play).

## 10. Tools

| Job | Choice |
|---|---|
| Packages in one repository | pnpm workspaces |
| Categories that differ | TypeScript unions with exhaustive switches ending in a `never` check |
| State changes | Plain functions, state and event in and state out, only in a kind's `evolve` |
| A new kind | An existing kind's files, copied and renamed |

## 11. Alternatives considered

| Instead of | The game does | Why |
|---|---|---|
| The same fixed set of files for every kind | The files a kind needs, each with the kind's name | None of the codebases read keeps a fixed set, and empty files hide where the code is |
| The three answers fixed per kind | Defaults that an entry can override | Real entries differ: a car is an obligation with its own term |
| Functions or scripts inside data | Plain data, typed effects, behaviour in the logic file | Behaviour in data cannot be saved as plain data, and an invented scripting language needs its own deprecation process |
| A copy of shared state on each side | One record per pair, with a sorted id | Two copies drift apart; one record cannot |
| Events only | Commands separate from events, with a state version | A stale command is refused before it changes anything |
| Dotted ids alone | Dotted, typed ids with a rename table | Old saves keep loading after a rename |
| A lint rule for imports | A boundary test whose exceptions only shrink | A list that only shrinks stops leaks from growing |
| Classes, inheritance, entries that inherit | Plain functions and plain data | Inheritance across entries scatters what an entry means |
| A state-machine library | Stages as plain unions in each kind | A kind has few stages, and they read best beside its logic |
| Layered front-end architectures | Features by kind, with `shared/` under them | One kind's screens live in one place |
