# The credit file

> Numbers are working values built from `../research/04` section 4.
> Kind: `credit`. One per character, abroad only. Background: `../design/01-concept.md` section 12.

Credit history does not cross borders. Everyone arrives with an empty file, and the file decides whether a landlord, a phone company or a car dealer says yes, and at what rate.

## Rules

**credit:file-starts-at-zero-abroad** The credit slice holds a `mark` from 0 to 100, counts of on-time and missed payments, and the month of the last miss. On arrival abroad the mark is 0 and the counts are 0. A return home keeps the file for that country: a second arrival in the same country starts from it, less 20, never below 0.

**credit:payments-move-the-mark** In the `due` phase, each obligation abroad that was paid in full and whose entry says `reportsToCredit` adds `tuning.credit.onTime` to the mark. Each one missed takes `tuning.credit.onMiss` from it. A default takes `tuning.credit.onDefault`. The mark never leaves 0 to 100.

**credit:clean-mark-drifts-up** A mark drifts: in the `month` phase with no miss in the last 12 months, the mark gains `tuning.credit.drift` up to `tuning.credit.driftTo`. A miss within 12 months stops the drift.

**credit:approval-reads-the-mark** Approval reads the mark. An obligation entry abroad names the mark it needs as `creditMin`, and the view lists those as `credit.needs`; the activity that opens it carries the requirement `credit/min` with the same figure, and that requirement judges it. A thin file is the common refusal: a car on finance needs 30, a flat in your own name needs 20, a phone contract needs 10. Below those, the room is a shared one, the phone is pay as you go, and the car is cash or nothing.

**credit:rate-follows-credit-ladder** The rate on a car or a loan reads the mark through the entry's `rateByCredit` ladder: the first rung whose `min` the mark reaches gives the monthly rate. The ladder in content follows the real tiers: about 6% a year at the top, 10 to 15% for average files, 22% at the bottom.

**credit:judgment-blocks-credit** A court judgment (a loan or car shortfall left after repossession) puts a `judgment` on the file for 72 months. While one is there, `credit/min` above 20 is never met, whatever the mark.

**credit:view-shows-credit-file** The view shows the mark, the counts, whether a judgment is there and the month it clears, and the `creditMin` of every entry that needs credit, so the player sees what the next ten points buy. The credit file abroad sits on the Bank, and a judgment clears in N months.

## Numbers

| Setting | Value | In content as |
|---|---|---|
| On-time payment | +3 | `tuning.credit.onTime` |
| Missed payment | -12 | `tuning.credit.onMiss` |
| Default | -30 | `tuning.credit.onDefault` |
| Drift a month with a clean year | +1 up to 40 | `tuning.credit.drift`, `driftTo` |
| Judgment lasts | 72 months (six years) | `tuning.credit.judgmentMonths` |
| Highest `credit/min` met under a judgment | 20 | `tuning.credit.judgmentCap` |
| Returning to the same country | mark less 20 | `tuning.credit.returnPenalty` |
| Car finance needs | 30 | `obligation.car.creditMin` |
| A flat in your own name needs | 20 | `obligation.rent-flat-uk.creditMin`, `obligation.rent-flat-canada.creditMin` |
| A phone contract needs | 10 | `obligation.phone-uk.creditMin`, `obligation.phone-canada.creditMin` |

Content: the car's `rateByCredit` stops at 1.2% a month (about 15% a year) from mark 30, with no rung below, and no loan abroad has a ladder; credit:rate-follows-credit-ladder's "22% at the bottom" is in no entry.

Pace: a carer paying rent and phone on time gains 6 a month and reaches 30 in five months, which is when the car becomes possible. One missed month costs four months of progress.

## Sources

- [Equifax: credit score when you move to the UK](https://www.equifax.co.uk/resources/loans-and-credit/credit-score-when-you-move-to-the-uk)
- [TransUnion: building credit as an immigrant](https://www.transunion.com/blog/credit-advice/building-credit-as-an-immigrant)
- [National Debtline: car repossession and the six-year judgment](https://nationaldebtline.org/get-information/guides/car-repossession-what-happens-and-what-you-can-do-about-it/)
- [Bankrate: US car loan rates by credit score](https://bankrate.com/loans/auto-loans/average-car-loan-interest-rates-by-credit-score)

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `credit/mark` | effect | Moves the mark in the current country's file by `amount`, within its range (credit:payments-move-the-mark) |
| `credit/judgment` | effect | A judgment on the current country's file for `tuning.credit.judgmentMonths` (credit:judgment-blocks-credit) |
| `credit/min` | requirement | The mark in the current country is at least `value`; never met above `judgmentCap` while a judgment stands (credit:approval-reads-the-mark, credit:judgment-blocks-credit) |
