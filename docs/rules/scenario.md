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
