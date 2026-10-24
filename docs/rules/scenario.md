# Starting lives

> Fixed lives for tests and recordings. A new player's life comes from the prologue (`prologue.md`).
> Kind: `scenario`. The people are invented.

## Rules

**scenario:state-built-from-scenario** A new state is built from a scenario, a seed and the content. Every always-true rule of every kind holds in it.

**scenario:new-state-starts-clean** A new state has its route unknown, no offers open, no set piece open, and only the obligations its scenario lists. Its opening balances are credited with the reason `opening`.

**scenario:first-turn-always-endable** From every scenario, a turn can be ended at once with every slot resting.

## The graduate, the banker and the developer

A ready life has no name and no sex of its own: the player gives the name and the look at the door (prologue:front-door-builds-a-person), and a line told by sex takes its neutral form (streets:sex-optional-with-neutral-path). Each one's family is of one people, and the family's names come from that people (person:one-mixed-name-pool).

| | `scenario.graduate` | `scenario.banker` | `scenario.developer` |
|---|---|---|---|
| In one line | Fresh from the service year, a good degree, no job yet, a family with a little behind it | A bank officer four years in, a lower grade, savings, a plot of land, and everyone leaning on you | A developer on the rise, from a family with nothing spare, who sends money home every month |
| Family's people | Igbo | Yoruba | Hausa-Fulani |
| Age | 23 years 2 months (278) | 28 years 6 months (342) | 25 years (300) |
| Lives | Family house, Surulere | Family house, Ogba | With an aunt, Yaba |
| Education | Bachelor's, second upper | Bachelor's, second lower | Bachelor's, second upper |
| English | 55 | 50 | 62 |
| Tech | 35 | 10 | 58 |
| Interview prep | 0 | 0 | 0 |
| Portfolio | 0 | 0 | 2 |
| Land | 0 | 1 | 0 |
| Network | 15 | 40 | 30 |
| Family means | 60 | 35 | 20 |
| Family stake | 0 | 0 | 0 |
| Standing | 60 | 70 | 50 |
| Wellbeing | 70 | 55 | 60 |
| Credit mark | 0 | 0 | 0 |
| Job | None | Bank officer, 48 months in | Junior developer, 18 months in |
| Naira in the bank | ₦355,000 (four months of living, so the first chapter has time to find pay) | ₦4,200,000 | ₦900,000 |
| Naira cash | ₦25,000 | ₦60,000 | ₦40,000 |
| Documents | None | Passport, 22 months left | None |
| Upkeep a month | ₦95,000 | ₦140,000 | ₦130,000 |
| Sent home a month | | | ₦60,000 |

## The teacher

`scenario.teacher`: 26, a maths teacher 48 months in, a second upper and tech 32, two siblings, ₦350,000 in the bank and ₦20,000 cash, upkeep ₦80,000 and ₦25,000 sent home; cannot drive. Its family is Efik-Ibibio, the largest share outside the big three (person:one-mixed-name-pool). Recorded as `teacher-borrower` in `simulated-play/lives.data.ts` (a master's flight in month 24). The nurse, `scenario.nurse`, is defined in `route-gates.md` (its last table); its family is Igbo.

## What each one tests

- **The graduate** has nothing built yet: everything has to be built, and the family can carry part of the weight.
- **The banker** has money and a job on day one and a harder file: a lower grade, an older face, land that the family thinks of as theirs.
- **The developer** is closest to the dollar salary that makes the funds easy, and furthest from any help.
- **The teacher** has a small steady wage and some tech: a maths teacher who codes after marking, with a way into tech if the portfolio is built.

## The balance targets

**scenario:economy-meets-its-targets** The economy is held to its targets by simulated play (decision 0031, `../design/13-the-economy.md` section 2). The balance test plays every fixed life and a life built from each archetype's preset (prologue:archetype-presets-answers: the accountant, the writer, the trader, the shop worker, the child of the water, and a graduate who takes the customer service job) under the player styles of `simulated-play/players.ts`: the careful, the borrower, the risky and the Canada players, and three more: trade-loyal (hunts only its own trade's rungs and side job, and studies tech only when its trade is tech), free-learner pivot (careful, working the free path to the developer jobs) and paid-learner pivot (careful, the diploma, or the bootcamp when the money allows). It runs 20 seeds for 96 months in three worlds (decision 0035): a calm world, `world-3`, the first `world-<n>` whose windows for the UAE and Canada's points stay open through month 72 and whose UK care window, shut at the start in every world, never closes again once opened, for the bands and the pivot's pace; the golden world, with the UAE ban of its months 13 to 30, for the mix, the students, tech's pace and the money; and a crash world, `world-v`, the steepest pound by month 36 of `world-v` and `world-0` to `world-499` (about twice as dear in 36 months), for the crash. It holds the ten thresholds below, each world's in its own test file. "Formal flights" are flights on a route other than the road. A flight's trade is the trade of the job held on the day it flies.

| # | What is measured | Styles, world | Threshold |
|---|---|---|---|
| 1 | The median month of the first flight, for each trade | trade-loyal, calm | Inside the trade's cheap band in the table below |
| 2 | The 75th percentile of the first flight, for each trade | trade-loyal, calm | At most the cheap band's top plus 12 months |
| 3 | The share flown by month 72 | trade-loyal, calm | 80% or more for every trade |
| 4 | Flights leaving from a developer rung, among lives that did not start as developers and did not set out to pivot | every style but the two pivots, golden | 35% or less |
| 5 | The pivot's pace | the two pivot styles against trade-loyal, calm | The pivot's median first flight is never sooner than 0.8 times trade-loyal's for any trade, and for the teacher no later than 1.5 times |
| 6 | The mix of routes | every style, golden | No route over 50% of formal flights; the master's, the skilled worker, Canada's points, care or the nurse, and the Gulf each 5% or more |
| 7 | Students | careful, risky, borrower | Careful: 90% or more reach `status.uk-graduate`; risky: 70% or more; every withdrawal follows a reminder, a plan offered and two plan payments missed in a row, or the four months in arrears with no plan (all of them); the median from the first miss to withdrawal is 3 months or more |
| 8 | Tech's pace to junior-ready (30) | the pivot styles | The free path 8 to 12 months, the short course 6 to 8, the diploma 7 to 9, the bootcamp 4 to 6; no life reaches tech 30 by study before month 4 |
| 9 | The money floor and the sinks | careful, golden | No careful life under the broke line more than 2 months in a row; at the rung that fits abroad, settlement, renewal and citizenship each take 0.2 to 6 months of what the month keeps |
| 10 | A crash | trade-loyal, the crash world | The Gulf from the shop and the racks, and the UK nurse's route from the nurse, reached by month 36 for 60% or more; naira pay at month 36 under the review about 1.21 times its start in the golden world, and lower in pounds than at the start in the crash world |

The cheap and dear bands, in months to the first flight for a careful player who stays in the trade, without luck, in a calm world:

| Trade | The cheapest way that fits | Months | The dearer way that fits | Months |
|---|---|---|---|---|
| Nurse | UK care as a nurse with a trust's post; the Gulf's nursing offers as the fallback | 18 to 36 | Canada's points with the care cut-off | 42 to 60 |
| Teacher | Canada's points (the education draw while it stands) or the master's with the family's pledge | 48 to 60 | none beyond these | |
| Customer service | The Gulf, or Canada once on the dollar rung | 24 to 36 | The skilled worker or the master's | 36 to 66 |
| Shop, trader | The Gulf contract | 18 to 30 | none: the own stall is the rung | |
| Fish | The Gulf contract | 18 to 30 | none: the fish trade is the rung | |
| Banker | Canada's points | 36 to 48 | The skilled worker, or the master's with the pledge | 30 to 66 |
| Accountant | Canada's points | 36 to 54 | The skilled worker as a chartered accountant | 30 to 54 |
| Developer | Canada or the UK talent route once remote | 18 to 36 | The master's or the skilled worker | 24 to 48 |
| Graduate | Canada's points on the customer service ladder | 36 to 54 | The master's with the pledge | 48 to 72 |

The thresholds and bands are the game's aims, not real figures; a change that moves a life outside them changes the content, or the targets with a decision record that says why.
