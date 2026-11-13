# The content

The simulation holds the rules (how a job pays, how a route is judged, how a month passes) but no jobs, routes or words of its own. Those are content: one plain object of tables in `packages/content`, checked against the simulation's schemas, holding every number the game runs on and every line a player reads. Changing the content changes the game without changing the rules that read it.

```mermaid
flowchart LR
  subgraph content["packages/content"]
    tables["Tables of entries<br/>activity, place, route, offer, setpiece and more"]
    tuning["The tuning table"]
    words["Words files<br/>kind.text.ts"]
  end
  sim["packages/sim<br/>schemas and checkContent"]
  client["apps/client<br/>say and the screens"]
  server["apps/server<br/>overlay at start"]
  tables --> sim
  tuning --> sim
  words --> client
  tables --> client
  sim --> server
  content --> server
```

## The content object and its tables

`packages/content/src/index.ts` builds one `content` object of the simulation's `Content` type. Each table maps an id to its entry, and every id has the form `kind.slug`: `activity.job-teacher`, `place.ojuelegba`, `route.uk-care`. The lint rules allow the content package to import only the simulation and `zod`.

| Table | Holds | Where |
|---|---|---|
| `activity` | Jobs, side jobs, and the acts that fill free time or happen at once | `activity/activity*.data.ts` |
| `place` | Every place in Lagos, abroad and on the road, with its real name or none | `place/place.data.ts` |
| `route` | The ways out: each route's gate, country, status abroad and checklist | `route/route.data.ts` |
| `offer` | The asks that come up in a month: from family, a job, money, life, the road, abroad and the return | `offer/offer*.data.ts` |
| `setpiece` | Staged scenes with questions and answers, such as the visa interview | `setpiece/setpiece.data.ts` |
| `document`, `school`, `status`, `obligation` | Papers, schools, statuses held abroad, and debts and dues | Each in its own folder |
| `chapter`, `goal`, `era`, `news`, `var` | The story's chapters, life goals, the director's eras and stories, and the world's moving figures | Each in its own folder |
| `scenario`, `prologue` | The ready lives, and the opening of a life from sixteen | `scenario/`, `prologue/` |
| `quality`, `country`, `person`, `phrase`, `points`, `interview` | The character's qualities, countries, people, pair phrases, points tables and the interview | Each in its own folder |
| `people` | The spots where people meet (person:time-together-is-an-act) | `person/person.data.ts` |
| `advert`, `guide`, `analytics` | Advert slots, route guides and usage counters | Each in its own folder |
| `thing` | The market's catalogue: things a life can buy for the home, each with its price, what it does and what it costs to run (decision 0019) | `thing/thing.data.ts` |
| `tuning` | Every rule number that is not in an entry | `tuning/tuning.data.ts` |

File names follow the kind and the role: `<kind>.data.ts` holds entries, `<kind>.text.ts` holds words, `<kind>.test.ts` holds the tests that read them. Large kinds are split by theme (`activity.street.data.ts`, `offer.abroad.data.ts`) and joined in the main table file.

::: info Whole numbers only
Money in content is in the smallest unit: kobo, pence, cents. Chances are basis points, where 10000 is 100%. `packages/content/src/units.ts` has `naira()`, `pounds()`, `dollars()`, `cad()`, `aed()`, `euros()` and `pct()`, so a table reads like the rule page without a decimal point. The lint rules refuse a decimal literal in content, as they do in the simulation.
:::

### Activities

An activity states the slot it takes (`main` for a job, `free`, `side` or `none`), what it requires, what it costs, what it pays, the chance of being hired, and its effects each month. `activity.when.data.ts` marks which acts answer at once (a lottery ticket, asking around, a meetup) and which fill the month as a slot pick (activity:now-acts-and-month-acts in [the activity rules](../../rules/activity.md)). The rest of the table follows that page's "Jobs" and "Free-slot activities" sections.

### Places

A place states where it is (at home, abroad or on the road, with its city and area), whether its name is real or made up, its position, its crowd and the activities, offers and chapters it stages. city:place-entry-fields in [the city rules](../../rules/city.md) names every field, and the page lists every entry. Its words are in `place/place.text.ts` (city:place-words-are-text-keys). Its scene is a `place.json` under `apps/client/public/assets/places/<folder>/`.

::: warning Real names
A real business name appears only as the city rules allow (city:sponsor-shows-name-only, city:invented-names-for-risky-businesses). Each made-up shop name is checked, and `place.names.json` records each check.
:::

### Routes

A route names its gate (study, sponsor, points, endorsement, contract, partner, dependant or the road), its country, the status it leads to, when a character hears of it, its window and its checklist. Each checklist item has a weight and the requirement that ticks it, and the japacity figure reads the weights (japacity:figure-is-whole-percent in [the japacity rules](../../rules/japacity.md)). Each gate adds its own block, such as the sponsor's salary bar or the points table. [Chapters and routes](./chapters.md) covers how the story follows a route.

### Offers and set pieces

An offer is an ask that rolls each month while its `when` holds. It has a chance, a cooldown, an expiry, terms drawn when it opens, and choices with their effects. A fraud chance can be decided when it opens and kept secret.

A set piece is a scene of questions, some drawn and some fixed, whose answers carry effects. The credibility interview, the December visit, and the road's night and its truth are set pieces. Details: [the offer rules](../../rules/offer.md) and [the interview rules](../../rules/interview.md).

## The tuning table

`tuning/tuning.data.ts` is one table of every rule number that does not belong to a single entry: the free time a month holds, the bank's charge, the start rates of the pound and the dollar, the refusal chance per point of strictness, the credit file's steps and many more. It is grouped by the rule page each number comes from (its first comment says so), and every "In content as" row of the rule pages' Numbers tables is in it.

No rule number lives in code (engine:numbers-read-from-content in [the engine contract](../../rules/engine.md)). A rule reads its number from `content.tuning` or from the entry. A test does the same, unless it tests that exact number.

## The overlay

The public content runs the whole game and passes every test (server:public-defaults-run-the-game). A deployment may change live numbers with an overlay: a plain object with a `version` and any part of the content to replace, defined in `packages/sim/src/engine/overlay.ts`.

```mermaid
flowchart TD
  json["Overlay JSON<br/>version plus changed numbers"] --> check{"checkOverlay"}
  check -->|"a field the content lacks"| refuse["Refused, the server does not start"]
  check -->|"a value that is not a number"| refuse
  check -->|"a cost a new character meets rises"| refuse
  check -->|"a ledger reason or the rename table"| refuse
  check -->|"no problems"| apply["applyOverlay<br/>merge, parse, checkContent"]
  apply --> live["The live content<br/>its overlay version recorded in every save"]
```

- `applyOverlay(content, overlay)` works as engine:numbers-read-from-content says; it replaces arrays whole.
- `checkOverlay(base, overlay)` also refuses: a field the content does not have (an overlay has no factor field), a non-number replacing a number, a list whose shape changes, a ledger reason, the rename table, money added to a scenario or to the opening of a life, and any rise in a cost or fee a new character can meet (server:overlays-never-multiply-prices and server:public-defaults-run-the-game in [the server rules](../../rules/server.md)).
- The server reads the overlay from its environment when its isolate starts (`apps/server/src/authority/overlay.ts`) and refuses to run on one that fails.
- A save records the overlay's version beside the content's, so a life replays under the numbers it was played with (engine:state-is-plain-data, server:overlay-change-opens-segment).

## The words

Every line a player reads is content: each kind's words file and the interface's own tables in `packages/content/src/ui/`. The simulation emits only a key and its numbers. [The words page](../../rules/text.md) owns where words live: the keys, how the files are merged and which ones a first visit leaves out, how the client looks a key up, how money is shown and how a line is written, joke versions included. Read it before writing a new line.

```mermaid
flowchart LR
  sim["The simulation emits<br/>key plus params"] --> say["say in the client<br/>shared/words/text.ts"]
  content["content text<br/>merged words files,<br/>the interface's among them"] --> say
  late["a country's late words<br/>fetched abroad"] --> say
  say --> screen["The line on screen"]
  say -.->|"no words for the key"| itself["The key itself shows,<br/>so a gap is visible"]
```

## How the content is checked

Content is checked before anything plays on it (engine:content-checked-before-play). For the public content this happens in the test suite, under `pnpm check`.

- `ContentSchema` parses the whole object, so every entry fits its schema and no unknown key gets through.
- `checkContent` in `packages/sim/src/engine/content.ts` checks that every key is a well-formed id of its kind, every id an entry mentions exists, every number is whole, every route's checklist weights add up to 100, and the director's stories are fair to every player.
- `packages/content/src/text.test.ts` checks the words: every entry has a name; every offer has a title, a body and every choice; every set piece question and answer has words; every chapter has its title, opening, close and items; every rejection code has a line; and no em dash or en dash appears in any words file.
- Each kind's own tests read figures back from the rule page, so a number that drifts from its page fails.

## Interface words

The interface's own words show first, then tell (text:show-then-tell). The shared `Mark`, `FactChip` and `ToneTag` in `apps/client/src/shared/ui/` are the only way to show a state, a fact or a gain, each screen held to short words has a test citing that rule (such as `apps/client/src/features/city/told.words.test.ts`), and `apps/client/src/cross-feature/voice.test.ts` reads every words table for the voice (text:voice-by-surface).

## Rule pages

- [The engine contract](../../rules/engine.md): engine:state-is-plain-data, engine:content-checked-before-play and engine:numbers-read-from-content, for saves, checks and the overlay.
- [Words](../../rules/text.md): where words live, the keys, money on screen and the voice.
- [The city](../../rules/city.md), [Activities and jobs](../../rules/activity.md), [Offers](../../rules/offer.md), [Japacity](../../rules/japacity.md), [The server](../../rules/server.md).
