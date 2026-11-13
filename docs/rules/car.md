# The car chain

> The thresholds are the real UK ones; prices are working values. Sources at the end.
> Kinds: `obligation` (type `car`), `activity`, `document`. Background: `../design/01-concept.md` section 12, `../research/04-debt-credit-and-car.md` section 4.

A car abroad is a work tool. A home carer with a car can take the visits that pay; without one, only the shifts the bus can reach. Cars are bought on finance, and finance has thresholds with real consequences.

## Rules

**car:car-bought-on-finance** `activity.buy-car-finance` (abroad, the UK only) needs `credit/min` 30, the deposit payable in the local currency, and a licence in force: `document.home-licence` within its 12 months or `document.uk-licence`. It pays the deposit (reason `car-deposit`) and opens `obligation.car` with the price less the deposit as the principal, the term from the entry, the monthly rate from the credit ladder (credit:rate-follows-credit-ladder), and the final payment recorded.

**car:open-finance-gives-the-car** While `obligation.car` is open and not in default, the character has the car (the code's `hasCar` in `activity.pay.ts`; content reads it with the requirement `obligation/has` and type `car`): activities marked `needsCar` are legal, and job entries marked `carBonus` pay their bonus. Losing the car ends both at once.

**car:missed-payments-take-the-car** A missed car payment follows obligation:miss-applies-its-effects and marks the credit file. Two misses in a row bring a `notice` (a line). On the third miss in a row:
- **Under a third of the total price paid**: the car is taken at once. The obligation closes. The shortfall (what is owed less the entry's `car.resaleBp` of the price), if above zero, becomes the entry's `car.shortfall` obligation (`obligation.car-shortfall`), with a court judgment (credit:judgment-blocks-credit).
- **A third or more paid**: the lender needs a court. The car is taken the entry's `car.courtMonths` later, unless the arrears are cleared with `obligation/pay` first.

**car:car-handed-back-after-half** At any time once half the total price has been paid, `obligation/pay` with the amount `0` on the car hands it back: the obligation closes, nothing more is owed, no judgment, and the character has no car.

**car:final-payment-owns-the-car** When the term ends with every payment made, the final payment is due. If it is paid, the car is owned and kept with nothing owed: its item stays in the state, so the car still counts for car:open-finance-gives-the-car, but it is never charged again, the view does not list it, and `obligation/pay` on it is rejected with `not-legal`. If it is missed, the car is handed back with nothing owed, as in car:car-handed-back-after-half.

**car:licence-and-driving-test** Anyone with `quality.driving` 1 or more holds `document.home-licence` on arrival, valid for 12 months from arrival. `activity.driving-test` (abroad, UK) costs `tuning.car.lessons` once for the lessons, then `tuning.car.testFee` per attempt. It passes on a draw on stream `status` at 5500 basis points plus 500 for each earlier attempt, capped at 9000. A pass grants `document.uk-licence`, never expiring. Driving with no licence in force is not legal: the car's `needsCar` activities close and the car cannot be bought.

**car:view-shows-car-terms** The view shows the car: price, paid so far, the third and half marks, months left, the final payment, the rate, misses in a row, and whether a notice or a court date stands. The obligation item carries them as `car`: `price`, `paid`, `third`, `half`, `final`, `resale`, `interest` (the monthly interest the ladder fixed), `rateBp` (that interest over the opening principal), `notice`, and `courtMonth` (the month the car is taken, null when no court stands) with `courtMonths`. On Bills the rate is shown as interest a month, with no percent sign.

## Entries

| Id | Values |
|---|---|
| `obligation.car` | type `car`; currency GBP; price, deposit, term, final payment and grace as in Numbers; rate by credit mark: 70 or more, 50 to 69 and 30 to 49 take the three rates in Numbers, under 30 not offered; the rate is flat on the opening principal, so the APR is about one and a half times the monthly rate times twelve; sink `car-payment`, interest sink `loan-interest`; reportsToCredit true |
| `obligation.car-shortfall` | the loan for what is still owed after the car goes (`obligation.car.car.shortfall`): type `loan`, principal the shortfall, 12 months, 0% interest, sink `loan-repay`; opened with a judgment |
| `activity.buy-car-finance` | abroad, UK; needs credit 30 and a licence in force; cost the deposit; effect opens the car |
| `activity.driving-test` | abroad, UK; cost `tuning.car.testFee` and, the first time, `tuning.car.lessons`; effect the pass draw |
| `document.home-licence` | valid 12 months from arrival, never requested |
| `document.uk-licence` | never expires, granted by the test |
| `quality.driving` | self, 0 to 1, hidden; 1 for the lives that can drive (the banker, the nurse) |

## Numbers

| Setting | Value | Source and date | In content as |
|---|---|---|---|
| Used car price | £9,500 | Working value for a seven-year-old hatchback, 2026 | `obligation.car.car.price` |
| Deposit | 10% | Common dealer plan | `obligation.car.car.depositBp` |
| Term | 36 months | Common dealer plan | `obligation.car.term` |
| Final payment | 30% of the price | Working value inside the usual range | `obligation.car.car.finalBp` |
| Rates by file | 0.5%, 0.9% and 1.2% a month flat on the opening principal: about 9%, 16% and 22% APR on £8,550 borrowed over 36 months with a £2,850 final payment. Real: mainstream used-car finance 9.9% to 14.9% APR, the market average about 13% to 16%, thin or poor files 15% to 29.9% and up; the game sits inside each band (factor 1.0) | Carsa, 30 Jun 2026 | `obligation.car.rateByCredit` 50, 90, 120 |
| Misses before the car is taken | 3 in a row (two misses bring the notice) | Arrears notice after two misses, then a default notice of 14 days | `obligation.car.grace` 2 |
| Taken without a court if paid under | a third of the total | Consumer Credit Act, protected goods | `obligation.car.car.courtThirdBp` 3333 |
| Court delay when over a third is paid | 3 months | Working value | `obligation.car.car.courtMonths` 3 |
| Hand back owing nothing at | half the total | Voluntary termination | `obligation.car.car.handBackBp` 5000 |
| Resale value on repossession | 55% of the price | Working value | `obligation.car.car.resaleBp` 5500 |
| Judgment on the file | 72 months | A UK court judgment stays six years (National Debtline), factor 1.0 | `tuning.credit.judgmentMonths` |
| Home licence valid for | 12 months after arrival | gov.uk | `document.home-licence` |
| Learning to drive | £2,200 lessons, then £62 a test attempt (practical £62 weekday, theory £23) | Cost of learning to drive, 2026 (passrates.uk) | `tuning.car.lessons` 220000, `tuning.car.testFee` 6200 |
| Pass chance | 55% first attempt, +5% each later attempt, capped 90% | UK first-time pass rate about 50% | `tuning.car.passBp` 5500, `passPerAttemptBp` 500 |

## Why it is built this way

- **The car and the visa are linked.** If the sponsor loses its licence, the job goes, the 60-day clock starts, the payments stop, and the car follows. The grace, the hand-back and the notice soften this.

## Sources

- [Carsa: is 10.9% APR good for car finance, 30 Jun 2026](https://carsa.co.uk/blog/is-10-9-apr-good-car-finance-2026)
- [MoneyHelper: PCP explained](https://www.moneyhelper.org.uk/en/everyday-money/buying-and-running-a-car/financing-buying-car-personal-contract-purchase-pcp?source=mas)
- [National Debtline: car repossession, the third and the half](https://nationaldebtline.org/get-information/guides/car-repossession-what-happens-and-what-you-can-do-about-it/)
- [GOV.UK: driving on a non-GB licence](https://www.gov.uk/driving-nongb-licence/y/a-resident-of-great-britain/full-car-and-motorcycle/any-other-country)
- [Cost of learning to drive, 2026](https://passrates.uk/guide/cost-of-learning-to-drive-2026-breakdown)
- [Healthcare Management: transport as a barrier to recruiting carers](https://www.healthcare-management.uk/transport-factors-barrier-recruiting-retaining-carers)
