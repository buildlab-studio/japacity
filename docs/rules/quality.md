# Qualities

> Numbers are working values.
> Kind: `quality`. Many per character. Background: `../design/01-concept.md` section 3.

A quality is one whole number about the character: a skill, a grade, how the family sees them. Routes, offers and jobs all read qualities.

## Rules

**quality:qualities-stay-in-range** A quality never leaves its range. A change that would pass either end stops at it.

**quality:changes-are-named-events** Every change is an event that names the quality, the amount actually applied, and what caused it. A change of zero records no event.

**quality:age-moves-monthly** Age goes up by one month in the `month` phase of every turn, and nothing else changes it, except the prologue: its steps move age by their months under the source `prologue` (prologue:age-advances-with-steps).

**quality:wellbeing-drifts-to-baseline** In the `month` phase wellbeing moves 2 toward 60, and stops at 60.

**quality:high-skills-gain-slower** A gain to a quality in the skills group is halved, rounding up, when the quality is already at 70 or above. Losses are never halved.

**quality:gains-name-their-routes** The report line for a gain carries the routes that quality counts toward.

**quality:body-belly-and-energy** The body (decision 0011). Two qualities say how the character is today, `quality.belly` and `quality.energy` (0 to 100; a life starts at the entry's `start`, 60 and 70, where its scenario says nothing; both hidden from the profile and said on the screen in words only, never as a meter or a percentage). Acts move them at once: a meal fills the belly, a nap or a bath gives energy, work and study take it. The time lived takes a little off both: `turn/spend-days` applies `tuning.turn.body.bellyPerHalfDay` (2) and `energyPerHalfDay` (1) for each half-day spent. As the month turns, a body under `lowBelow` (30) takes `hungryWellbeing` (6) or `spentWellbeing` (4) off wellbeing, then the night's rest and the family's pot bring each back toward `restTo` (60) by at most `restBy` (25). A new life's qualities list both.

## Entries

| Id | Group | Range | Shown | Counts toward | Meaning |
|---|---|---|---|---|---|
| `quality.age-months` | self | 192 to 1200 | Yes | | Age in months |
| `quality.edu-level` | education | 0 to 5 | Yes | UK master's | 0 none, 1 secondary, 2 diploma, 3 bachelor's, 4 master's, 5 doctorate |
| `quality.edu-grade` | education | 0 to 5 | Yes | UK master's | 1 pass, 2 third, 3 second lower, 4 second upper, 5 first |
| `quality.english` | skills | 0 to 100 | Yes | UK master's | Practice level. The test band is drawn from it |
| `quality.tech` | skills | 0 to 100 | Yes | | Software skill |
| `quality.interview-prep` | skills | 0 to 100 | Yes | UK master's | Readiness for a credibility interview |
| `quality.portfolio` | proof | 0 to 10 | Yes | | Finished work that can be shown |
| `quality.land` | proof | 0 to 3 | Yes | | Plots of land owned |
| `quality.network` | people | 0 to 100 | Yes | | People who know your work |
| `quality.family-means` | people | 0 to 100 | Yes | | How much the family could raise |
| `quality.family-stake` | people | 0 to 1 | Yes | | 1 once the family has put money into your leaving |
| `quality.standing` | self | 0 to 100 | Yes | | How the family and the street see you |
| `quality.wellbeing` | self | 0 to 100 | Yes | | Rest, health and mood together |
| `quality.credit-mark` | self | 0 to 3 | Yes | | Loans gone bad. Lenders check it |

## Numbers

| Setting | Value | In content as |
|---|---|---|
| Wellbeing drifts toward | 60 | `tuning.quality.wellbeingDriftTo` |
| Drift a month | 2 | `tuning.quality.wellbeingDrift` |
| Slot lost below wellbeing | 25 | `tuning.quality.burnoutBelow` |
| Skill gains halve at | 70 | `tuning.quality.skillSoftAt` |
| Share of a skill gain kept from there, rounding up | 50% | `tuning.quality.skillSoftBp` = 5000 |
| Wellbeing back for an empty slot | 12 | `tuning.quality.wellbeingRest` |

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `quality/add` | effect | Adds `amount` to a quality within its range, halving a skill gain at the soft cap (quality:high-skills-gain-slower) |
| `quality/min` | requirement | The quality is at least `value` |
| `quality/max` | requirement | The quality is at most `value` |
