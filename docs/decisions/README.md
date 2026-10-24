# Decisions

A decision record is one short file that states a choice made between real alternatives, why, and what follows from it. The rule pages (`../rules/`) say what the game does; the design pages (`../design/`) say why the game is the way it is; a record says which way a fork was taken and holds it there.

The records are numbered in reading order, foundations first: the simulation's contract and determinism, randomness, saves and replay, the online stack and the platform, then the game's shape system by system (the month, money, the city, people, the routes, the world). Read from 0001 onward, they explain the game from the ground up.

## When to write one

- A change to determinism, the ledger's reasons, the command and view types, or the save's shape (`AGENTS.md` rule 9).
- A change to a rule that a rule page says needs a record (engine:first-download-has-budget, `../rules/region.md`).
- A choice of platform, provider, package layout or a dependency that others will build on.
- A choice in the game's shape that closes off a real alternative, where the reason would otherwise be lost.

A tuning number, a new entry of an existing kind, or a fix that brings code to what a rule already says needs no record.

## The template

```md
# NNNN. A title that states the decision

Status: Accepted

## Context

What forces the choice: the facts, the constraints, the alternatives.

## Decision

What holds, stated plainly, with the rule ids and files it rests on.

## Consequences

What follows, good and bad, and what the decision does not change.
```

The file is `NNNN-a-short-slug.md`, numbered after the last record. A record cites rules by id and other records by number (`decision 0004`). It states the decision as it holds, never the steps that led to it: no dates, no people, no quotes, no reviews and no branches.

## Changing a decision

An accepted record's decision is never edited. A record may have its wording, links and citations kept current, but a change to what it decides is a new record that supersedes it: the new record says `Status: Accepted` and names the record it supersedes in its Context, and the old record's status becomes `Superseded by NNNN`.

## The records

| No. | Decision |
|---|---|
| [0001](0001-the-contract-carries-the-whole-life.md) | The engine contract carries the whole life |
| [0002](0002-the-view-carries-every-figure.md) | The view carries every figure the screens show |
| [0003](0003-random-draws-by-position.md) | Random draws are counted by position |
| [0004](0004-saves-are-segments-of-commands.md) | A save is a list of segments of commands |
| [0005](0005-the-authoritys-commands-are-a-closed-list.md) | The authority's commands are a closed list |
| [0006](0006-the-online-stack.md) | The online stack, the packages and the storage interfaces |
| [0007](0007-mail-through-cloudflare-email-service.md) | Mail leaves through Cloudflare Email Service |
| [0008](0008-the-prologues-preset-in-one-request.md) | The prologue's preset is played by the server in one request |
| [0009](0009-models-are-code.md) | The city's models are code, baked in Node and checked by a build step |
| [0010](0010-the-first-download-has-a-budget.md) | What a first visit downloads has a budget |
| [0011](0011-the-worlds-day-and-the-lifes-months.md) | The world's day and the life's months |
| [0012](0012-acts-answer-when-they-are-done.md) | Acts answer when they are done |
| [0013](0013-living-is-paid-as-it-is-lived.md) | Living is paid as it is lived |
| [0014](0014-naira-moves-as-it-would-in-lagos.md) | Naira is paid and lands as it would in Lagos |
| [0015](0015-marked-money.md) | Marked money: a top-up is kept apart from money earned |
| [0016](0016-the-friday-draw.md) | The Friday draw: a kind of its own, fixed odds and a rolling jackpot |
| [0017](0017-rides-are-priced-by-the-simulation.md) | Rides are commands, priced by the simulation |
| [0018](0018-the-homes-and-what-they-cost.md) | The homes at home, and what each costs |
| [0019](0019-the-things-a-life-owns-and-the-passbook.md) | The things a life owns, and the passbook |
| [0020](0020-people-across-two-lives.md) | People across two lives |
| [0021](0021-one-game-for-every-country.md) | One game for every country, and players before residents |
| [0022](0022-the-plan-is-the-players-choice.md) | The plan is the player's choice |
| [0023](0023-the-age-picked-is-the-age-lived.md) | The age picked is the age the life starts at |
| [0024](0024-the-japa-type.md) | A life is shared as a japa type, never a score |
| [0025](0025-the-lively-layer.md) | The lively layer |
| [0026](0026-the-painted-map-that-folds.md) | The painted map that folds |
| [0027](0027-one-contract-for-the-client-and-the-server.md) | One contract for the client and the server |
| [0028](0028-overstaying-in-stages.md) | Overstaying in stages |
