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

The records use the project's terms (a kind, a slice, an effect, the authority, the goldens, the recorded lives and the rest) as [the structure and conventions page, section 1](../design/03-structure-and-conventions.md#_1-terms) defines them.

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
| [0001](0001-the-contract-carries-the-whole-life.md) | One engine contract holds the whole life, at home and abroad |
| [0002](0002-the-view-carries-every-figure.md) | The view carries every figure the screens show |
| [0003](0003-random-draws-by-position.md) | Random draws are counted by position |
| [0004](0004-saves-are-segments-of-commands.md) | A save is a list of segments of commands |
| [0005](0005-the-authoritys-commands-are-a-closed-list.md) | The authority's commands are a closed list |

### Online and platform

| No. | Decision |
|---|---|
| [0006](0006-the-online-stack.md) | The online stack, the packages and the storage interfaces |
| [0027](0027-one-contract-for-the-client-and-the-server.md) | One contract for the client and the server |
| [0007](0007-mail-through-cloudflare-email-service.md) | Mail is sent through Cloudflare Email Service |
| [0008](0008-the-prologues-preset-in-one-request.md) | The prologue's preset is played by the server in one request |
| [0010](0010-the-first-download-has-a-budget.md) | What a first visit downloads has a budget |

### The city's models

| No. | Decision |
|---|---|
| [0009](0009-models-are-code.md) | The city's models are code, built in Node and checked by a build step |

### The month

| No. | Decision |
|---|---|
| [0011](0011-the-worlds-day-and-the-lifes-months.md) | Two clocks: a shared world day and each life's months |
| [0012](0012-acts-answer-when-they-are-done.md) | An act takes effect when it is done, not when the month ends |
| [0013](0013-living-is-paid-as-it-is-lived.md) | Living costs at home are paid act by act, not as a monthly charge |

### Money

| No. | Decision |
|---|---|
| [0014](0014-naira-moves-as-it-would-in-lagos.md) | Naira is paid and received in cash or bank as it would be in Lagos |
| [0015](0015-marked-money.md) | A top-up is marked and kept apart from money earned |
| [0016](0016-the-friday-draw.md) | The Friday draw is a kind of its own, with fixed odds and a rolling jackpot |
| [0030](0030-the-ledger-and-the-rejections-name-only-what-a-rule-uses.md) | The ledger and the rejections name only what a rule uses |

### The economy

| No. | Decision |
|---|---|
| [0031](0031-each-trade-climbs-its-own-ladder.md) | Each trade has its own job ladder and a yearly pay review |
| [0032](0032-learning-in-bands.md) | Tech is learned in bands, and the day's coding class is capped |
| [0033](0033-the-students-money-flow.md) | A student's tuition, work and Graduate visa |
| [0034](0034-certain-stories-start-first.md) | News stories that are certain to start go before rolled ones |
| [0035](0035-the-balance-test-reads-calm-and-crash-worlds.md) | The balance test reads calm and crash worlds |
| [0036](0036-a-miss-moves-the-story.md) | A missed first job hunt opens a lead, never a promised job |
| [0037](0037-the-catch-is-its-own-stream.md) | The fishing catch is drawn on its own random stream |
| [0038](0038-a-bank-remit-arrives-as-quoted.md) | A bank remit arrives as quoted |

### The city

| No. | Decision |
|---|---|
| [0017](0017-rides-are-priced-by-the-simulation.md) | Rides are commands, priced by the simulation |
| [0018](0018-the-homes-and-what-they-cost.md) | The four homes in Lagos, and what each costs |
| [0019](0019-the-things-a-life-owns-and-the-passbook.md) | The things a life owns and the passbook belong to the simulation |
| [0026](0026-the-painted-map-that-folds.md) | The map is a painted SVG city that folds away |

### People

| No. | Decision |
|---|---|
| [0020](0020-people-across-two-lives.md) | Two players' lives affect each other through commands, never shared state |
| [0021](0021-one-game-for-every-country.md) | One game for every country, and real players before computer residents |

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

### Working on the code

| No. | Decision |
|---|---|
| [0039](0039-ci-gates-checks-taken-away-not-test-edits.md) | CI gates a check taken away, not a test edited |
| [0040](0040-quick-checks-on-a-pull-request-full-run-in-the-merge-queue.md) | Quick checks on a pull request, the full run in the merge queue |
