# 0035. The balance test reads calm and crash worlds

Status: Accepted

## Context

The balance test (scenario:economy-meets-its-targets, decision 0031) first played every life and style in the golden world and in world-b, and 8 of its 10 measures failed. Read against the game's aims, part of the failure was the test reading the wrong world or the wrong players:

- The trades' bands are months to the first flight "without luck", and the golden world draws a UAE ban in its months 13 to 30, as the real ban on Nigerian visas ran for most of two years. The Gulf's trades, the shop and the fish trade, could not fly inside their bands while the ban stood, and every band was read in a world with that luck in it.
- world-b was meant as a crash with the pound 2.36 times dearer in 36 months. As built it rises 1.07 times; no seed of the first 500 reaches 2.36, and the steepest, world-v, reaches 2.08.
- The developer-rung measure counted the two pivot styles, which exist to pivot: they alone made about a third of all flights, so the measure could not be met whatever the rest did.
- A care worker's renewal is a small part of a month by law: the Health and Care visa's reduced fee and its exemption from the surcharge put it at about a fifth of a month's keep, under the sinks' 0.5.

## Decision

- **A calm world for the bands.** The first, second, third and fifth measures read a calm world: the first `world-<n>` whose windows for the UAE and Canada's points never close before month 72 and whose UK care window, shut at the start in every world, never closes again once opened. It is `world-3`, named in the test. The golden world keeps the developer rung, the mix, the students, tech's pace and the money, so the luck of a real ban still shows there.
- **The crash world is named.** The tenth measure reads the steepest pound by month 36 among `world-v` and `world-0` to `world-499`: `world-v`, about twice as dear. The review's own figure is still read in the golden world beside it.
- **The developer rung reads the players who did not set out to pivot.** The fourth measure counts every style but the two pivots.
- **The sinks' bounds are 0.2 to 6 months** of what the month keeps, for settlement, renewal and citizenship. The broke run stands as it was.
- **One test file for each world**, each citing scenario:economy-meets-its-targets and holding its own measures, so they run on separate workers.

## Consequences

- scenario.md's measure table names each measure's world, and its bands table reads "in a calm world".
- A trade that cannot reach its band in a calm world is the economy missing its target; a band missed only in the golden world is the luck of the draw, and shows in the mix and the money instead.
- A world's draws move when the stories or the eras move, so a later change that moves the calm or the crash world's windows or pound names the new seed in the test and in scenario.md.
