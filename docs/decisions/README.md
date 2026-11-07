# Decisions

A decision record is one short file that states a choice made between real alternatives, why, and what follows from it. The rule pages (`../rules/`) say what the game does; the design pages (`../design/`) say why the game is the way it is; a record says which way a fork was taken and holds it there.

Records are numbered in sequence; the table groups them by topic. A number is a record's permanent id.

## When to write one

- A change to determinism, the ledger's reasons, the command and view types, or the save's shape (`AGENTS.md` rule 9).
- A change to a rule that a rule page says needs a record (engine:first-download-has-budget, `../rules/region.md`).
- A choice of platform, provider, package layout or a dependency that others will build on.
- A choice in the game's shape that closes off a real alternative, where the reason would otherwise be lost.

A tuning number, a new entry of an existing kind, or a fix that brings code to what a rule already says needs no record.

## Words the records use

The engine's own words (state, content, world, command, event, authority, view) are defined in the table at the head of `../rules/engine.md`. A few more:

- **A kind** is one part of the game with its own rules page, code folder and content: `wallet`, `route`, `home`, `lottery`.
- **A slice** is the part of a character's state that one kind owns and alone changes.
- **An effect** is a typed change that content or a kind asks for, carried out by the kind it names: `route/look-into`, `obligation/relief`.
- **The authority** is whoever runs the simulation for a life: the server online, or the in-browser authority offline.
- **The golden replays** (the goldens) are stored saves replayed against a stored result; **the recorded lives** are simulated players' lives on the real content. Both prove a change leaves play as it is, or show where it moves.

## The template

```md
# NNNN. A title that states the decision

Status: Accepted

## Context

What forces the choice: the facts and the constraints.

## Decision

What holds, stated plainly, with the rule ids and files it rests on.

## Consequences

What follows, good and bad, and what the decision does not change.

## Alternatives

The other ways weighed, and why each was not taken. Only where the record weighed some.
```

The file is `NNNN-a-short-slug.md`, numbered after the last record. A record cites rules by id and other records by number (`decision 0004`). It states the decision as it holds, never the steps that led to it: no dates, no people, no quotes, no reviews and no branches.

## Changing a decision

An accepted record's decision is never edited. A record may have its wording, links and citations kept current, but a change to what it decides is a new record that supersedes it: the new record says `Status: Accepted` and names the record it supersedes in its Context, and the old record's status becomes `Superseded by NNNN`.

## The records

### Foundations

| No. | Decision |
|---|---|
| [0001](0001-the-contract-carries-the-whole-life.md) | The engine contract carries the whole life |
| [0002](0002-the-view-carries-every-figure.md) | The view carries every figure the screens show |
| [0003](0003-random-draws-by-position.md) | Random draws are counted by position |
| [0004](0004-saves-are-segments-of-commands.md) | A save is a list of segments of commands |
| [0005](0005-the-authoritys-commands-are-a-closed-list.md) | The authority's commands are a closed list |

### Online and platform

| No. | Decision |
|---|---|
| [0006](0006-the-online-stack.md) | The online stack, the packages and the storage interfaces |
| [0027](0027-one-contract-for-the-client-and-the-server.md) | One contract for the client and the server |
| [0007](0007-mail-through-cloudflare-email-service.md) | Mail leaves through Cloudflare Email Service |
| [0008](0008-the-prologues-preset-in-one-request.md) | The prologue's preset is played by the server in one request |
| [0010](0010-the-first-download-has-a-budget.md) | What a first visit downloads has a budget |

### The city's models

| No. | Decision |
|---|---|
| [0009](0009-models-are-code.md) | The city's models are code, baked in Node and checked by a build step |

### The month

| No. | Decision |
|---|---|
| [0011](0011-the-worlds-day-and-the-lifes-months.md) | The world's day and the life's months |
| [0012](0012-acts-answer-when-they-are-done.md) | Acts answer when they are done |
| [0013](0013-living-is-paid-as-it-is-lived.md) | Living is paid as it is lived |

### Money

| No. | Decision |
|---|---|
| [0014](0014-naira-moves-as-it-would-in-lagos.md) | Naira is paid and lands as it would in Lagos |
| [0015](0015-marked-money.md) | Marked money: a top-up is kept apart from money earned |
| [0016](0016-the-friday-draw.md) | The Friday draw: a kind of its own, fixed odds and a rolling jackpot |
| [0030](0030-the-ledger-and-the-rejections-name-only-what-a-rule-uses.md) | The ledger and the rejections name only what a rule uses |

### The economy

| No. | Decision |
|---|---|
| [0031](0031-each-trade-climbs-its-own-ladder.md) | Each trade climbs its own ladder |
| [0032](0032-learning-in-bands.md) | Learning in bands |
| [0033](0033-the-students-money-flow.md) | The student's money flow |
| [0034](0034-certain-stories-start-first.md) | Certain stories start first |
| [0035](0035-the-balance-test-reads-calm-and-crash-worlds.md) | The balance test reads calm and crash worlds |
| [0036](0036-a-miss-moves-the-story.md) | A miss moves the story |
| [0037](0037-the-catch-is-its-own-stream.md) | The catch is its own stream |

### The city

| No. | Decision |
|---|---|
| [0017](0017-rides-are-priced-by-the-simulation.md) | Rides are commands, priced by the simulation |
| [0018](0018-the-homes-and-what-they-cost.md) | The homes at home, and what each costs |
| [0019](0019-the-things-a-life-owns-and-the-passbook.md) | The things a life owns, and the passbook |
| [0026](0026-the-painted-map-that-folds.md) | The painted map that folds |

### People

| No. | Decision |
|---|---|
| [0020](0020-people-across-two-lives.md) | People across two lives |
| [0021](0021-one-game-for-every-country.md) | One game for every country, and players before residents |

### Routes and status

| No. | Decision |
|---|---|
| [0023](0023-the-age-picked-is-the-age-lived.md) | The age picked is the age the life starts at |
| [0022](0022-the-plan-is-the-players-choice.md) | The plan is the player's choice |
| [0028](0028-overstaying-in-stages.md) | Overstaying in stages |
| [0029](0029-statuses-kept-on-a-trip-home.md) | Statuses kept on a trip home |

### The interface and sharing

| No. | Decision |
|---|---|
| [0025](0025-the-games-look.md) | The game's look |
| [0024](0024-the-japa-type.md) | A life is shared as a japa type, never a score |
