# Rates and the stand-in world

> The start rates are real: the pound's official rate of 24 Sep 2026 and the dollar's of 7 Oct 2026 (`../research/09-uk-masters-numbers.md`, Exchange rates the game starts from), the Canadian dollar and the euro from the cross rates of 7 Oct 2026, and the dirham on the dollar's peg. After tick 0 the rates are simulated, with working values: the game never shows live street rates.
> Scope: world. Code: `packages/sim/src/world/`. Background: `../design/01-concept.md` sections 7 and 13.

This page covers the world's naira rates (official and street, for each foreign currency) and the variables they read. Who builds the world at each tick, online and in the browser, and how fast ticks pass in each: [`engine.md` section 7](engine.md).

## Rules

**rate:world-follows-seed-and-tick** The world at a tick depends only on the world seed, the tick and the content. Asking twice gives equal worlds.

**rate:official-rates-drift-together** At tick 0 the official rates are the start values and every variable has its start value. On each later tick, every official rate is multiplied by the same factor: 10000 plus the drift plus a draw of noise, over 10000. The dirham then follows the dollar's peg (abroad-money:foreign-currencies-join-wallet).

**rate:street-premium-tracks-target** The street rate is the official rate raised by the premium. Each tick the premium moves a third of the way toward its target, then takes a draw of noise. The target is the floor plus 72 basis points for each point the supply variable is below 100. The premium never goes below the floor.

**rate:float-jumps-official-rate** On the tick the float story comes into force, the official rates jump so that the premium is 3%, and the street rates stay where they were.

**rate:street-never-below-official** Rates are whole numbers above zero, and a street rate is never below its official rate.

**rate:latest-story-sets-variable** A variable holds its start value until a story that sets it comes into force. When two stories in force set the same variable, the one that came into force later wins. When a story with `revert` ends, its variables go back to what they were before it. If the story that held a value before it has itself ended and reverted since, the value goes back past that story to what that story found.

## Variables

The variables the rates and the UK master's route read. Content holds 70 in all (`packages/content/src/var/var.data.ts`). The windows, strictness and surges of the other routes are in `director.md` (director:world-variables-per-route); the status and fee variables are on the pages that read them.

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

| Setting | Value | In content as | Source |
|---|---|---|---|
| Pound, official, at tick 0 | ₦1,758.00 | `tuning.rate.start.GBP` = 175800 | CBN selling rate ₦1,758.36, 24 Sep 2026 (`../research/09-uk-masters-numbers.md`) |
| Dollar, official, at tick 0 | ₦1,331.50 | `tuning.rate.start.USD` = 133150 | NFEM close, 7 Oct 2026, TechEconomy and Vanguard (`../research/09-uk-masters-numbers.md`) |
| Canadian dollar, official, at tick 0 | ₦970.00 | `tuning.rate.start.CAD` = 97000 | Cross rate of 7 Oct 2026 |
| Dirham, official, at tick 0 | ₦362.55 | `tuning.rate.start.AED` = 36255 | The dollar's rate over the dirham's peg (abroad-money:foreign-currencies-join-wallet) |
| Euro, official, at tick 0 | ₦1,558.00 | `tuning.rate.start.EUR` = 155800 | Cross rate of 7 Oct 2026 |
| Drift a tick | 0.4% | `tuning.rate.driftBp` = 40 | Working value |
| Noise a tick | Up to 1.2% either way | `tuning.rate.noiseBp` = 120 | Working value |
| Premium floor | 2% | `tuning.rate.premiumFloorBp` = 200 | Working value; the street gap was 2% on 7 Oct 2026 (`../research/06-naira-rates-and-currency.md`) |
| Premium for each point of missing supply | 0.72% | `tuning.rate.premiumPerSupplyBp` = 72 | Working value |
| Premium noise | Up to 0.5% either way | `tuning.rate.premiumNoiseBp` = 50 | Working value |
| Premium after a float | 3% | `tuning.rate.floatPremiumBp` = 300 | Working value; after the float of 14 Jun 2023 the gap closed (`../research/06-naira-rates-and-currency.md`) |

Where the premium settles:

- supply 97: near 4.2%, close to the calm gap of 3% to 5% on 2 Oct 2026 (`../research/06-naira-rates-and-currency.md`);
- supply 40: heading for about 45%, near the crisis gap of 47% in Dec 2023;
- supply 90, after a float: about 9%.
