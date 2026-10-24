# Qualities

> Numbers are working values unless a source is given.
> Kind: `quality`. Many per character. Background: `../design/01-concept.md` section 3.

A quality is one whole number about the character: a skill, a grade, how the family sees them. Routes, offers and jobs all read qualities.

## Rules

**quality:qualities-stay-in-range** A quality never leaves its range. A change that would pass either end stops at it.

**quality:changes-are-named-events** Every change is an event that names the quality, the amount actually applied, and what caused it. A change of zero records no event.

**quality:age-moves-monthly** Age goes up by one month in the `month` phase of every turn, and nothing else changes it, except the prologue: its steps move age by their months under the source `prologue` (prologue:age-advances-with-steps).

**quality:wellbeing-drifts-to-baseline** In the `month` phase wellbeing moves 2 toward 60, and stops at 60.

**quality:high-skills-gain-slower** A gain to a quality in the skills group is halved, rounding up, when the quality is already at 70 or above. Losses are never halved.

**quality:skill-bands-slow-gains** Tech is learned in bands, and each band gives less (`../design/13-the-economy.md` section 5). The bands of `quality.tech` are `tuning.quality.techBands`: starting (0 to 29), junior-ready (30 to 49), working (50 to 69), strong (70 to 84) and senior (85 and up). Every tech study at home (activity:study-days-capped, activity:free-path-keeps-a-streak, activity:paid-tech-courses, streets:apprentice-learns-repair) names its gain a month for each band in its entry's `bandGains`, read at the band the character is in when the gain applies; a band the entry gives no figure for, or a figure of 0, gives nothing, and the act's card says it has taught what it can. quality:high-skills-gain-slower then halves what is left at 70 or above, as for any skill gain. A job's monthly tech, a certificate's or a course's closing gain and the study acts abroad (`activity.learn-tech-uk`, `activity.learn-tech-canada`) are not read by band and keep their figures. Real: freeCodeCamp's certifications ask about 300 hours each and its full-stack path about 1,800, and a self-taught Lagos developer reaches a first job in 9 to 15 months at two or more hours a day (a guide's estimate, Sources); the bands put the free path's junior-ready mark at 9 to 10 months.

**quality:gains-name-their-routes** The report line for a gain carries the routes that quality counts toward.

**quality:body-belly-and-energy** The body (decision 0011). Two qualities say how the character is today, `quality.belly` and `quality.energy` (0 to 100; a life starts at the entry's `start`, 60 and 70, where its scenario says nothing; both hidden from the profile and said on the screen in words only, never as a meter or a percentage). Acts move them at once: a meal fills the belly, a nap or a bath gives energy, work and study take it. The time lived takes a little off both: `turn/spend-days` applies `tuning.turn.body.bellyPerHalfDay` (2) and `energyPerHalfDay` (1) for each half-day spent. As the month turns, a body under `lowBelow` (30) takes `hungryWellbeing` (6) or `spentWellbeing` (4) off wellbeing, then the night's rest and the family's pot bring each back toward `restTo` (60) by at most `restBy` (25). A new life's qualities list both.

## Entries

| Id | Group | Range | Shown | Counts toward | Meaning |
|---|---|---|---|---|---|
| `quality.age-months` | self | 192 to 1200 | Yes | | Age in months |
| `quality.education-level` | education | 0 to 5 | Yes | UK master's | 0 none, 1 secondary, 2 diploma, 3 bachelor's, 4 master's, 5 doctorate |
| `quality.education-grade` | education | 0 to 5 | Yes | UK master's | 1 pass, 2 third, 3 second lower, 4 second upper, 5 first |
| `quality.english` | skills | 0 to 100 | Yes | Canada's points, health care and the skilled worker (through the test, for anyone without the degree's statement) | Practice level. The test band is drawn from it (document:who-sits-the-english-test) |
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
| `quality.care` | skills | 0 to 100 | Yes | | Nursing and care skill; a nurse starts at 60, a care assistant at 30 (`route-gates.md`) |
| `quality.belly` | self | 0 to 100 | No | | How fed the character is today; starts at 60 (quality:body-belly-and-energy) |
| `quality.energy` | self | 0 to 100 | No | | How rested the character is today; starts at 70 (quality:body-belly-and-energy) |
| `quality.driving` | self | 0 to 1 | No | | 1 for a life that can drive (`car.md`) |
| `quality.run-down-months` | self | 0 to 3 | No | | Months in a row under the run-down line (health:low-wellbeing-warns-first) |
| `quality.illness-course` | self | 0 to 4 | No | | Where the last illness stands: 0 nothing pending, 1 treated at the chemist, 2 ignored, 3 worse and not answered, 4 worse and answered (health:illness-rolls-when-run-down, health:worse-illness-locks-slots) |
| `quality.forced-wait` | self | 0 to 12 | No | | Months before another forced month may come (health:forced-months-spaced-apart) |

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| Wellbeing drifts toward | 60 | Working value | `tuning.quality.wellbeingDriftTo` |
| Drift a month | 2 | Working value | `tuning.quality.wellbeingDrift` |
| Slot lost below wellbeing | 25 | Working value | `tuning.quality.burnoutBelow` |
| Skill gains halve at | 70 | Working value | `tuning.quality.skillSoftAt` |
| Share of a skill gain kept from there, rounding up | 50% | Working value | `tuning.quality.skillSoftBp` = 5000 |
| Tech bands, the lowest figure of each | starting 0, junior-ready 30, working 50, strong 70, senior 85 | Working value; junior-ready is the junior developer's bar (activity.md) | `tuning.quality.techBands` [0, 30, 50, 70, 85] (quality:skill-bands-slow-gains) |
| Wellbeing back for an empty slot | 12 | Working value, the same as `activity.rest` | `tuning.quality.wellbeingRest` |
| Belly and energy lost for each half-day lived | 2 and 1 | Working value | `tuning.turn.body.bellyPerHalfDay`, `energyPerHalfDay` |
| Low body line | under 30 | Working value | `tuning.turn.body.lowBelow` |
| Wellbeing lost to a hungry or a spent body at the month's turn | 6 and 4 | Working value | `tuning.turn.body.hungryWellbeing`, `spentWellbeing` |
| The night's rest brings the body toward | 60, by at most 25 | Working value | `tuning.turn.body.restTo`, `restBy` |
| Spent mark: an act that takes time waits for sleep under it | 10 energy | Working value (activity:spent-body-refuses-acts) | `tuning.turn.body.spentBelow` |

## Sources

Read on 24 Oct 2026.

- [freeCodeCamp: the certifications](https://www.freecodecamp.org/news/freecodecamp-certifications/): about 300 hours a certification, five projects each. quality:skill-bands-slow-gains.
- [McTaba: how long it takes to become a developer in Nigeria](https://mctaba.com/learn/nigeria/how-long-to-become-developer-nigeria): 9 to 15 months at two or more hours a day, a guide's estimate, not a survey. quality:skill-bands-slow-gains.

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `quality/add` | effect | Adds `amount` to a quality within its range, halving a skill gain at the soft cap (quality:high-skills-gain-slower) |
| `quality/min` | requirement | The quality is at least `value` |
| `quality/max` | requirement | The quality is at most `value` |
