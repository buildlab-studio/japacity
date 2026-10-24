# The director, eras and the story pool

> The director takes the place of the fixed schedule in `news.md`; the news kind's delivery rules (news:changed-stages-delivered-once, news:for-you-when-touching-route and news:announcement-makes-routes-heard) hold as that page says. Timeline and sources: `../research/02` section 4, `../research/01` section 4, `../research/06`.
> Kinds: `era` (world), `var`, `news`; code in `packages/sim/src/world/`. Background: `../design/01-concept.md` section 7.

The world is a pool of things that have really happened, fired in an order that cause and effect allows. One era runs at a time. Most checks produce nothing.

## Rules

**director:world-variables-per-route** The world's variables are the ones in `rate.md` plus, for each route, a window (`var.<route>-window`, 2 open, 1 narrowing, 0 closed), a strictness (`var.<route>-strictness`, 0 to 100; content has none for the talent and Gulf routes, `var.uk-talent-strictness` and `var.uae-strictness` do not exist, as neither gate reads a strictness) and a surge (`var.<route>-surge`, 0 to 100), and at home `var.inflation` (0 to 100), `var.season-december` (0 or 1) and the status and fee variables named on the other pages. Every variable has a start value in content and is changed only by a story in force or by director:policy-cycle-surge-backlash and director:december-and-inflation.

**director:one-era-at-a-time** One era runs at a time. At tick 0 the era is `era.calm`. When an era's end tick comes, the next is drawn from the pool on the world stream `era`, weighted by each entry's `after` weights for the era that just ended, never the same era twice in a row, and its length is a draw between its `ticks`. `World.era` carries the id, the tick it began and its end tick; the view shows them as well as `sinceMonth` and `untilMonth`, the same ticks read as the player's months (one tick is one month played). An era is announced as a story of its own (`news.era-*`) on the tick it begins. News tells the era as months ago and away.

**director:stories-start-by-roll** Each tick, for each story in the pool in id order, the director rolls (world stream `shock`) whether it starts now (with a `rumourLead` above zero the rumour runs from this tick and the announcement comes `rumourLead` ticks later; with none it is announced on this tick): it must not have fired within its `cooldown`, must not be `once` and already fired, every `needs` requirement over the world's variables and era must hold, and the roll is the story's `chanceBp` times the running era's weight for that story over 10000. At most `tuning.director.maxNewPerTick` stories start on one tick, and a story marked `shock` fires at most once per era and never within `tuning.director.shockGapTicks` of the last shock.

**director:stories-pass-through-stages** A story passes through its stages as `news.md` says: rumour `rumourLead` ticks before announcement when above zero, in force `forceLag` ticks after announcement (never under 2: news:force-waits-after-announcement), ended `endsAfter` ticks after in force or when a `endedBy` story comes into force. Its `sets` apply when it comes into force; later in force wins; `revert` restores on end (rate:latest-story-sets-variable). An `adds` is relative and holds no variable: it is added when the story comes into force and, when the story reverts, taken back when it ends.

**director:policy-cycle-surge-backlash** The policy cycle: while a route's window is 2, its surge rises by `tuning.director.surgePerTick` each tick, capped at 100; while 1 it holds; while 0 it falls by twice that. Backlash stories `needs` a surge over their threshold; restriction stories `needs` a backlash in force; a closure `needs` a restriction in force; a shortage (reopening) `needs` a window at 0 for at least `tuning.director.closedTicks`. The cycle is shortage, open, surge, backlash, restriction, and no story skips a step.

**director:december-and-inflation** `var.season-december` is 1 on the tick whose month of the game year is December and 0 otherwise: offline, tick mod 12 equals 11; online, by the real calendar. `var.inflation` adds its basis points to every naira `upkeep` and `support` charge, so home support paid from abroad rises too (the obligation kind reads it).

**director:stories-never-undo-player-gains** Fairness: no story lowers a quality, removes a document, closes an obligation the player chose, or changes a recorded visa application's rules (route:application-fixes-figures already fixes those at submission). A story that would do so fails `checkContent`. Every era has an end and a name.

**director:world-stepped-from-seed** The stand-in world builds all of this from the world seed and the tick by stepping from tick 0 (rate:world-follows-seed-and-tick). The online world does the same from a stored history and the real clock. `World.news` lists every story that has reached a stage, and the news kind delivers them (news:changed-stages-delivered-once).

**director:story-touches-and-hearing** A story's `touches` and `hear` lists work as in `news.md`; `era.*` stories touch every route and go to the front page.

## Eras

| Id | Ticks | Weights for stories | After (weights by the era before) | Theme |
|---|---|---|---|---|
| `era.calm` | 18 to 30 | fx 1, uk 1, ca 1, uae 1, home 1 | from any: 3 | Nothing in particular. The baseline |
| `era.open-door` | 18 to 26 | openings 3, closures 0, fx 1 | calm 2, strike 2, crash 1 | Shortages abroad. Windows open |
| `era.hard-line` | 20 to 30 | closures 3, strictness 3, openings 0 | open-door 3, scandal 2 | Rules change often. Spread your bets |
| `era.crash` | 14 to 22 | fx 4, home 3, openings 1 | calm 1, hard-line 1, strike 2 | The naira falls. Fees double in naira |
| `era.scandal` | 14 to 20 | closures 2, abroad 3 | open-door 3 | Abuse on a popular route is exposed. It narrows |
| `era.strike` | 10 to 16 | home 3, study 2 | calm 2, crash 2 | Universities shut. Study routes stall |
| `era.pandemic` | 12 to 18 | closures 4, remote 3, fx 2 | calm 1 (`once`) | Borders shut. Remote work and health workers gain |

The weights name story groups; each story below carries one group.

## The story pool

The five stories of `news.md` are in the pool, with these preconditions: `news.dollar-scarcity` needs `var.fx-supply` at 80 or more (it cannot fire during a scarcity) and group `fx`; `news.naira-float` is `endedBy` nothing and keeps its `after`; `news.uk-living-rise` needs `var.uk-study-window` at 1 or more; `news.uk-refusals-up` needs `var.uk-study-surge` over 40 and is a backlash story.

| Id | Group | Needs | Chance a tick | Rumour, force lag, ends | Sets | Once, shock | Date it echoes |
|---|---|---|---|---|---|---|---|
| `news.warning-one-chance` | home | the calm era | 10000 | once, moves nothing | | | wallet:cash-pile-warning: the one-chance robbery told early, so Mama's warning is heard before it bites; its id sorts after the recruiting fair so the fair keeps its tick (the director starts at most two stories a tick) |
| `news.uk-dependants-ban` | closures | uk-study surge over 60 | 400 | 2, 3, never | `var.uk-study-strictness` +15 | once | Jan 2024 |
| `news.uk-study-narrows` | closures | strictness 70 or more, uk-study surge over 50, window open | 500 | 1, 2, 24 | `var.uk-study-window` 1, revert | | 2024 |
| `news.uk-study-closes` | closures | `uk-study-narrows` in force, era hard-line or scandal | 500 | 2, 2, the reopening | `var.uk-study-window` 0, revert | shock | stylised |
| `news.uk-study-reopens` | openings | `var.uk-study-window` 0 for 8 ticks | 1500 | 0, 2, never | `var.uk-study-window` 2, `var.uk-study-surge` 0, `var.uk-study-strictness` 50 | | |
| `news.uk-care-opens` | openings | `var.uk-care-window` 0, era open-door or calm | 400 | 2, 2, never | `var.uk-care-window` 2 | | Feb 2022 |
| `news.uk-care-dependants` | closures | uk-care surge over 50 | 500 | 2, 3, never | `var.uk-care-strictness` +10 | once | Mar 2024 |
| `news.uk-care-sponsors-revoked` | abroad | uk-care surge over 50 | 400 | 1, 2, 10 | `var.uk-care-sponsor-risk` 1200 (a `one-employer` job on the care route ends with this chance a month while in force), revert | shock | 2023 to 2024 |
| `news.uk-care-closes` | closures | `uk-care-sponsors-revoked` in force (`var.uk-care-sponsor-risk` 1200 or more) | 600 | 2, 2, never | `var.uk-care-window` 0 | once | Jul 2025 |
| `news.uk-skilled-bar-rises` | closures | era hard-line | 500 | 2, 3, never | `var.uk-skilled-salary` 4600000 | | Apr 2024, Jul 2025 |
| `news.uk-settle-ten-years` | closures | era hard-line | 300 | 4, 6, never | `var.uk-settle-months` 120 | once, shock | consulted 2025 to 2026 |
| `news.uk-graduate-shortened` | closures | any | 400 | 3, 4, never | `var.uk-graduate-months` 18 | once | Jan 2027 |
| `news.uk-talent-body-closes` | closures | any | 200 | 1, 2, the reappointment | `var.uk-talent-window` 0, revert | once | Jan to Apr 2023 |
| `news.uk-talent-reappointed` | openings | `var.uk-talent-window` 0 for 8 ticks | 900 | 0, 2, never | `var.uk-talent-window` 2 | once | Aug 2025 |
| `news.canada-care-draw` | openings | `var.canada-window` 2 | 600 | 1, 2, 6 | `var.canada-care-cutoff` -20, revert | | Jun 2023 |
| `news.canada-general-stops` | closures | ca surge over 40 | 400 | 2, 3, never | `var.canada-cutoff` +20 | once | Apr 2024 |
| `news.canada-points-overhaul` | closures | era hard-line | 300 | 3, 4, never | `var.canada-cutoff` +15, `var.canada-care-cutoff` +10 | once | early 2025 |
| `news.canada-funds-rise` | closures | any | 300 | 1, 3, never | `var.canada-funds` 1600000 | | Jul 2025 |
| `news.uae-ban` | closures | `var.uae-window` 2 | 200 | 1, 2, 18 or the lifting | `var.uae-window` 0, revert | shock | Oct 2022 |
| `news.uae-lifted` | openings | `var.uae-window` 0 for 8 ticks | 10000 | 8, 2, never | `var.uae-window` 2 | | Jul 2024 |
| `news.uae-amnesty` | abroad | any | 100 | 1, 2, 4 | `var.uae-amnesty` 1 (status:uae-amnesty), revert | | Sep to Dec 2024 |
| `news.passport-fee-doubles` | home | any | 200 | 2, 3, never | `var.passport-fee` 20000000 | once | Sep 2025 |
| `news.fuel-subsidy` | home | era crash or calm | 200 | 1, 2, never | `var.inflation` +2000 | once, shock | Jun 2023 |
| `news.inflation-eases` | home | `var.inflation` over 1000 | 300 | 2, 3, never | `var.inflation` -800 | | 2026 |
| `news.strike-starts` | study | era strike | 3000 | 1, 2, 8 | `var.transcript-wait-extra` 4 (added to the transcript's wait), revert | shock | Feb 2022 |
| `news.pandemic-borders` | closures | era pandemic | 10000 | 0, 2, 10 | every window 0, `var.flight-factor` 20000, revert | once, shock | Mar 2020 |
| `news.remote-hiring-boom` | remote | era pandemic | 5000 | 1, 2, 18 | `var.remote-hire-bonus` 1500 (added to the remote job's hire chance), revert | once | 2020 to 2021 |
| `news.era-*` | front page | the era begins | fixed | 0, 2, with the era | nothing | | |

Content: `offer.sponsor-licence-lost` takes `var.uk-care-sponsor-risk` as its chance a month (`CHANCE_VARS` in `offer.logic.ts`), 300 and 1200 while the revocations are in force.

The variables this page defines, with their starts: `var.uk-study-surge` 20, `var.uk-care-surge` 0, `var.uk-skilled-surge` 10, `var.uk-talent-surge` 0, `var.canada-surge` 30, `var.uae-surge` 0, `var.uk-care-strictness` 50, `var.uk-skilled-strictness` 40, `var.canada-strictness` 50, `var.inflation` 0, `var.season-december` 0, `var.uk-care-sponsor-risk` 300, `var.passport-fee` 10000000, `var.transcript-wait-extra` 0, `var.flight-factor` 10000, `var.remote-hire-bonus` 0, `var.uae-amnesty` 0.

## Numbers

| Setting | Value | In content as |
|---|---|---|
| Surge a tick while a window is open | 3 | `tuning.director.surgePerTick` |
| Ticks closed before a reopening may fire | 8 | `tuning.director.closedTicks` |
| Most stories announced on one tick | 2 | `tuning.director.maxNewPerTick` |
| Gap between shocks | 6 ticks | `tuning.director.shockGapTicks` |
| Era length | 10 to 30 ticks by entry | `era.*.ticks` |
| Online tick | 12 hours, so an era of 24 ticks is 12 real days; online scales `ticks` by `tuning.director.onlineTickScale` 2 so an era is about four real weeks, and the same scale applies to every story's `rumourLead`, `forceLag`, `endsAfter` and `cooldown` and to `closedTicks` and `shockGapTicks` (clock:online-lengths-scaled) | `tuning.director.onlineTickScale` |

## What the player should feel

- Calm is most of the time. Then a rumour, and a month to act before it is law.
- A window closing mid-plan is the central drama (`../research/02`). The surge makes it predictable to the attentive: when everyone is going, the door is about to narrow.

## Sources

- The dated events in `../research/02` section 4 and `../research/01` section 4.
- Published design notes on storyteller systems and crisis checks in strategy games, read for the shape of a director that rolls quietly most ticks and escalates in steps; nothing is reproduced from them.
