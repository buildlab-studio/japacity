# Starting lives

> Fixed lives for tests and recordings. A new player's life comes from the prologue (`prologue.md`).
> Kind: `scenario`. The people are invented.

## Rules

**scenario:state-built-from-scenario** A new state is built from a scenario, a seed and the content. Every always-true rule of every kind holds in it.

**scenario:new-state-starts-clean** A new state has its route unknown, no offers open, no set piece open, and only the obligations its scenario lists. Its opening balances are credited with the reason `opening`.

**scenario:first-turn-always-endable** From every scenario, a turn can be ended at once with every slot resting.

## Ada, Tunde and Zainab

| | `scenario.ada` | `scenario.tunde` | `scenario.zainab` |
|---|---|---|---|
| Name | Adaeze Okafor, "Ada" | Babatunde Adeyemi, "Tunde" | Zainab Bello |
| In one line | Fresh from her service year, a good degree, no job yet, a family with a little behind it | A bank officer four years in, a lower grade, savings, a plot of land, and everyone leaning on him | A developer on the rise, from a family with nothing spare, who sends money home every month |
| Age | 23 years 2 months (278) | 28 years 6 months (342) | 25 years (300) |
| Lives | Family house, Surulere | Family house, Ogba | With her aunt, Yaba |
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

## Aniekan

`scenario.aniekan`: Aniekan Etim, 26, Efik-Ibibio, a maths teacher 48 months in, a second upper and tech 32, three siblings, ₦350,000 in the bank, upkeep ₦80,000 and ₦25,000 sent home; he cannot drive. Picked by the name pool's rules (person:one-mixed-name-pool): the largest share outside the big three, and a person, not a tribe. Recorded as `aniekan-borrower` in `simulated-play/lives.data.ts` (a master's flight in month 33). Ngozi's life, `scenario.ngozi`, is in `route-gates.md`.

## What each one tests

- **Ada** has nothing built yet: everything has to be built, and the family can carry part of the weight.
- **Tunde** has money and a job on day one and a harder file: a lower grade, an older face, land that the family thinks of as theirs.
- **Zainab** is closest to the dollar salary that makes the funds easy, and furthest from any help.
