# Rates and the stand-in world

> Numbers are working values. The start rates are the real ones for late September 2026 in `../research/09-uk-masters-numbers.md`. After that the rates are simulated: the game never shows live street rates.
> Scope: world. Code: `packages/sim/src/world/`. Background: `../design/01-concept.md` sections 7 and 13.

The world is the same for everyone at one tick: two naira rates for each foreign currency, the world's variables, and the news. Online the server builds it one tick at a time (`clock.md`); for the in-browser authority a stand-in (`world/standIn.ts`) builds it from a world seed and a tick.

## Rules

**rate:world-follows-seed-and-tick** The world at a tick depends only on the world seed, the tick and the content. Asking twice gives equal worlds.

**rate:official-rates-drift-together** At tick 0 the official rates are the start values and every variable has its start value. Each tick after, both official rates are multiplied by the same factor: 10000 plus the drift plus a draw of noise, over 10000.

**rate:street-premium-tracks-target** The street rate is the official rate raised by the premium. Each tick the premium moves a third of the way toward its target, then takes a draw of noise. The target is the floor plus 72 basis points for each point the supply variable is below 100. The premium never goes below the floor.

**rate:float-jumps-official-rate** On the tick the float story comes into force, the official rates jump so that the premium is 3%, and the street rate stays where it was.

**rate:street-never-below-official** Rates are whole numbers above zero, and a street rate is never below its official rate.

**rate:latest-story-sets-variable** A variable holds its start value until a story that sets it comes into force. When two stories in force set the same variable, the one that came into force later wins. When a story with `revert` ends, its variables go back to what they were before it; if the story that held a value before it has itself ended and reverted since, the value goes back past it to what that story found.

## Variables

| Id | Start | Meaning |
|---|---|---|
| `var.fx-supply` | 97 | How freely the banks have foreign currency, 0 to 100 |
| `var.fx-bank-queue` | 0 | Months a bank purchase of foreign currency waits |
| `var.fx-bank-allowance` | 50000 | US cents of foreign currency one person may buy at the bank in a month |
| `var.uk-study-window` | 2 | 2 open, 1 narrowing, 0 closed |
| `var.uk-living-line` | 117100 | Pence a month a student outside London must show |
| `var.uk-living-months` | 9 | Months of living money to show |
| `var.uk-visa-fee` | 55800 | Pence |
| `var.uk-surcharge` | 116400 | Pence. The health surcharge for a one-year course |
| `var.uk-study-strictness` | 50 | How hard decisions are, 0 to 100 |

## Numbers

| Setting | Value | In content as |
|---|---|---|
| Pound, official, at tick 0 | ₦1,758.00 | `tuning.rate.start.GBP` = 175800 |
| Dollar, official, at tick 0 | ₦1,331.50 | `tuning.rate.start.USD` = 133150 |
| Drift a tick | 0.4% | `tuning.rate.driftBp` = 40 |
| Noise a tick | Up to 1.2% either way | `tuning.rate.noiseBp` = 120 |
| Premium floor | 2% | `tuning.rate.premiumFloorBp` = 200 |
| Premium for each point of missing supply | 0.72% | `tuning.rate.premiumPerSupplyBp` = 72 |
| Premium noise | Up to 0.5% either way | `tuning.rate.premiumNoiseBp` = 50 |
| Premium after a float | 3% | `tuning.rate.floatPremiumBp` = 300 |

With supply at 97 the premium settles near 4.2%, close to the 4% gap of early October 2026. With supply at 40 it heads for about 45%, and with 90 after a float about 9%.

## The stand-in's clock

In the in-browser authority one tick passes for each month played. Online, ticks follow real time. See `engine.md` section 7.
