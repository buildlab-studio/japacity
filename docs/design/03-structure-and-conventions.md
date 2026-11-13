# Structure and conventions

## Context and scope

Where each kind of game thing lives in the repository and how it is named, so that someone who has seen one kind knows where to find everything for any other. Section 1 is the project's one list of terms. How code and tests are written line by line is in `../../AGENTS.md` ("Writing code", "Writing tests"). The import boundaries are enforced by `tests/boundaries.test.ts`. The reading of other open-source codebases behind these choices is in [research note 11](../research/11-game-codebases-read.md).

## Goals and non-goals

**Goals.**

- Every kind keeps its files in the same places under the same names.
- Content can be checked as plain data, and saves store ids only.
- A test, not a habit, holds the boundaries between packages.

**Non-goals.** Classes and inheritance; entries that inherit from other entries; functions or scripting inside data; a state-machine library; build orchestration tools; a shared helper before two kinds need it.

## 1. Terms

The one list of the words the docs, the code and the decision records use. Each says what the word means in plain words and links to the page that holds its exact rules. Another page links its first use of a term here.

### Data and code

| Term | Means |
|---|---|
| Kind | A category of game thing with its own rule page, code folder and content: a route, a status, an obligation, the wallet, the lottery. The kinds with a slice are listed in section 7 |
| Registry | The list of kinds with a slice, in the order the engine calls them (`packages/sim/src/kinds.ts`) |
| Entry | One row of a kind's content table, keyed by its id: `route.uk-masters` |
| Instance | One occurrence of an entry in a life, with an id of its own, such as an offer that came up or a loan taken. Commands that act on one name the instance |
| Content | The game's data in `packages/content`: every kind's entries, the tuning table and the words. Versioned and shipped with the code ([The content](../site/built/content.md)) |
| Tuning | The content table of the rule numbers that belong to no single entry. A rule page names each number by its tuning key (engine:numbers-read-from-content) |
| Content version | The number that names one release of the content and the simulation's code. It moves whenever something a replay depends on moves, and every save segment records it (server:content-version-sealed) |
| Overlay | A plain object that replaces some of the content's numbers on one deployment. Its own version is recorded in each save (engine:numbers-read-from-content) |
| Simulation | The game's rules as plain functions, in `packages/sim` ([The simulation](../site/built/simulation.md)) |
| Engine | The simulation's core, in `packages/sim/src/engine/`: the step, the random streams, effects, requirements and the view. Its contract is [the engine page](../rules/engine.md) |
| State | One character's whole life as plain data: ids and whole numbers, never words or content (engine:state-is-plain-data) |
| Slice | A kind's part of the state. Only that kind changes it (engine:kinds-own-their-state) |
| World | What is the same for every player at one tick: the exchange rates, the era, the world variables and the news. It is passed into each step and never stored in a character's state |
| Step | The one function that plays a command against a state, a world and the content, and returns the new state, events and lines, or a rejection ([the engine page](../rules/engine.md#_1-overview)) |
| Command | What a player or the authority asks for, named `kind/verb`: `route/apply`, `turn/end`. It carries `basedOn`, the state version it was made against ([the commands](../rules/engine.md#_3-commands)) |
| Sender | Who sent a command: `player`, `authority` or `stand-in`. Some commands only the authority may send |
| Rejection | A refused command, with a code such as `stale` or `cannot-afford`. It changes nothing |
| Event | What happened, recorded when a command is accepted, named in the past tense: `route/applied`, `wallet/credited`. Only events change the state (engine:only-events-change-state) |
| Effect | A typed change that content or one kind asks for, carried out by the kind its type names before the slash: `{ type: "money/add", ... }` is carried out by the wallet |
| Requirement | A typed condition held as data and judged by the kind its type names before the slash: `{ type: "quality/min", quality: "quality.tech", value: 60 }`. Checklist items, offer conditions and chapter items are requirements |
| Phase | One stage of the month's turn. The phases run in a fixed order ([turn order](../rules/engine.md#_4-turn-order)) |
| Invariant | Something that must hold in every state, checked by a kind's `invariants` |
| Line, report line | What the player is told about an event: a text key and its numbers, never the words (`line.<kind>.<what>`) |
| Report | The month's lines, stored when a turn ends (turn:turn-stores-a-report) |
| View | What one player may see of the state, made by one function. The screens read nothing else (engine:view-holds-no-hidden-field) |
| Ledger | The wallet's record of every change of money, each with a named reason (engine:money-in-whole-minor-units) |
| Minor unit | The smallest unit of a currency: kobo, pence, cents. Money is always a whole number of them |
| Basis points | How a chance or a share is written: 10000 is certain, 2500 is one in four |
| Stream | A named source of random draws, such as `job` or `visa`, drawn by position so one stream never shifts another ([the streams](../rules/engine.md#_6-random-streams)) |
| Seed | The hidden value a life's draws come from. It never leaves the authority. The world has its own world seed |
| Pair record | The single record of anything between two players (section 5) |
| Rule name | `page:slug`: the name a rule carries on its rule page, cited by tests and other pages (section 8) |

### Who runs a life

| Term | Means |
|---|---|
| Authority | Whoever holds the full state and the seed and runs the step: the server for the public game, the local authority for development, tests and offline play (engine:browser-authority-for-dev-only) |
| Local authority, in-browser authority | The authority that runs in the browser tab (`apps/client/src/authority/local.ts`) |
| Stand-in world | The world the local authority makes from a world seed and a tick, in the same shape as the server's ([the stand-in world](../rules/engine.md#_7-the-stand-in-world)) |
| Stand-in | What answers, narrowly, for a player bonded with another real player once they have been away long enough, sending commands as `stand-in` (person:stand-in-after-absence, person:stand-in-acts-narrowly) |
| Computer character | A person in a life whom the game plays, not a player: a sibling, a parent, a partner. Marked "Not a player" on screen ([People](../rules/person.md#computer-characters)) |
| Nudge | A socket message that only says something changed, so the client fetches it (clock:socket-only-nudges) |
| Presence | Who is in a place now, held in memory and never stored (clock:presence-held-in-memory) |

### Time

| Term | Means |
|---|---|
| Tick | One step of the world's clock: on the server's clock online (clock:world-tick-length-and-epoch), one per month played in the stand-in world |
| Turn | One month of a character's life ([Turns](../rules/turn.md)) |
| Bank of turns, turn bank | The turns a life holds, earned on real time and by a closed chapter, one spent per month lived. It never holds a month back (turn:month-turns-on-empty-bank) |
| Half-day | The unit of a month's free time (turn:month-lived-in-half-days) |
| Free slot | A place in the month for a month-act (turn:free-slots-per-month) |
| Now-act | An act answered at once with `activity/now`: a purchase, a conversation, an application sent. It spends half-days and fills no slot (activity:now-acts-and-month-acts) |
| Month-act | An act that fills time, such as a job, study or rest. It is a slot pick and resolves when the month turns (activity:now-acts-and-month-acts) |
| The waiting months | The months at home before a route can be taken, spent building toward it (activity:waiting-months-build-profile). A rule pages' term, never said on a screen |
| Game day | The world's own day on real time, the same for every player (clock:game-day-on-real-time) |
| Envelope | A result the local authority seals until the world's next morning (clock:envelopes-show-real-waits) |
| Era | A stretch of the world's history with its own theme, which weights the stories that fire. One runs at a time ([The director](../rules/director.md#eras)) |
| Director | The code that steps the world from tick to tick and fires its stories ([The director](../rules/director.md)) |
| Story | A piece of news from the director's pool, which passes through stages from rumour to its end (director:stories-pass-through-stages) |
| World variable | A figure of the world that stories move, such as a rate or the season, read by the requirements `var/min` and `var/max` |

### Saves and tests

| Term | Means |
|---|---|
| Save | How a life began and the commands accepted since, never a copy of the state (engine:state-is-plain-data, decision 0004) |
| Segment | The part of a save played under one content version and one overlay |
| Replay | Rebuilding a state by playing a save's commands again under the content they were played with |
| Golden, golden replay | A stored save the tests replay against a stored result, month by month (`packages/sim/src/goldens/`) |
| Recorded life | A simulated player's life on the real content, recorded by `pnpm record:lives`. Most goldens are recorded lives |
| Bless | `pnpm bless`: rewriting the golden files from the recordings, the only way a golden changes ([Goldens](../site/built/simulation.md#goldens-recorded-lives-and-simulated-play)) |
| Simulated play | The tests that play many lives, at random or as simulated players, and check the invariants after every command (`packages/sim/src/simulated-play/`) |
| Simulated player | A fixed way of playing a life in the tests: careful, borrower, risky and the others in `simulated-play/players.ts` |
| Scenario | A fixed starting life, for tests and recordings ([Starting lives](../rules/scenario.md)) |

### The game's own words

| Term | Means |
|---|---|
| Route, way out | A way out of the country, with its gate, its window and its checklist ([Routes](../rules/route.md)) |
| Gate | The part of a route's journey that is its own: study, sponsor, points, endorsement, contract, partner, dependant or the road ([Route gates](../rules/route-gates.md)) |
| Checklist | A route's weighted list of requirements |
| Japacity | How ready the character is to leave, a whole percentage worked out from the state each time ([Japacity](../rules/japacity.md)) |
| Chapter, brief | A short list of things to get done; the player only ever sees it called a brief ([Chapters](../rules/chapter.md)) |
| Plan, lean | The way out the chapters follow (chapter:chapters-follow-lean-route) |
| Offer, ask | Something that comes up in a month and asks for a choice: a family request, a job offer, a loan, a life event ([Offers](../rules/offer.md)) |
| Set piece | A staged scene of questions and answers, such as the visa interview |
| Obligation | Something owed over months: rent, upkeep, a loan ([Obligations](../rules/obligation.md)) |
| Quality, band | A measure of the character as a whole number, such as English or wellbeing; the screens say it by its band, never its figure (text:bands-not-figures) |
| Standing, wellbeing | Two qualities: how the family and the street see the character, and how the character is ([Qualities](../rules/quality.md)) |
| Pocket | Where money of one currency is held: the bank, cash, or locked ([Money](../rules/wallet.md)) |
| Lot | A record of a large or flagged deposit, which the visa officer may ask about (wallet:large-deposits-record-lots) |
| Marked money | Naira the authority tops up, kept apart from money earned (wallet:top-ups-are-marked) |
| Ladder, rung | A trade's jobs in order, from the first to the top; a rung is one job on it (activity:each-trade-climbs-its-ladder, decision 0031; abroad, [Ladders](../rules/ladders.md)) |
| The road | The route through the desert, with no checklist and no figure ([The road](../rules/road.md)) |
| Prologue | The years from sixteen to the first month, played as answers ([The prologue](../rules/prologue.md)) |
| The door, front door | The screens that build the person and start a life |
| Archetype, preset | A tile on the door, and the answers it plays through the prologue for the player (prologue:archetype-presets-answers) |
| Japa type | How a life is shared: a label, never a score (decision 0024) |
| The phone | The character's phone on screen, whose apps hold most of the game's screens |
| The shell | The client's frame that holds the screens (`apps/client/src/app/`) |

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

Anything between two players is **one record**, never a copy on each side, so the two sides cannot drift apart. A courtship, a joint application, the genuineness interview, a break-up and a sponsorship all use it. Its id, its pending proposals, its helpers and who writes it are on [the pairs page](../rules/pair.md) (pair:one-record-per-two, pair:joint-steps-need-both-sides, pair:only-server-writes-record).

## 6. Commands, events, and views

Three ideas shape how a life changes. Their exact rules are on [the engine page](../rules/engine.md):

- **Commands and events are different.** The client sends a command; the authority checks it and records events, and only events change the state (engine:only-events-change-state).
- **A stale command is refused**, because every command names the state version it was based on (engine:stale-commands-rejected).
- **Each player gets a view**, and pair and world state always pass through it (engine:view-holds-no-hidden-field).

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
| A lint rule for every package's imports | A boundary test whose exceptions only shrink; lint (`no-restricted-imports` in `eslint.config.js`) only for what the simulation and content, and their tests, may import | A list that only shrinks stops leaks from growing; the purity of the simulation and content is checked as each file is written |
| Classes, inheritance, entries that inherit | Plain functions and plain data | Inheritance across entries scatters what an entry means |
| A state-machine library | Stages as plain unions in each kind | A kind has few stages, and they read best beside its logic |
| Layered front-end architectures | Features by kind, with `shared/` under them | One kind's screens live in one place |
