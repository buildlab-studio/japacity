# Obligations

> Loan rates are from `../research/09-uk-masters-numbers.md`, the Borrowing section; the group loan's figures are in Numbers.
> Kind: `obligation`. Many per character, due every month. Background: `../design/01-concept.md` section 12.

An obligation is anything owed on a schedule: upkeep, money sent home, a loan, funds held for you by a lender. Each has a monthly charge and a rule for what happens when it is missed.

## Rules

**obligation:due-phase-charges-oldest-first** In the `due` phase each open obligation is charged, oldest first. The charge is its fixed amount, plus interest at its monthly rate on the opening principal, plus, for one with a term, the principal divided by the term and rounded up, never more than what is still owed. The view lists every open obligation except an owned car (car:final-payment-owns-the-car), with its fields plus `due` and `car` (car:view-shows-car-terms's figures; null for anything but a car). `due` is the charge the next `due` phase takes, 0 when none falls then. In particular:
- a loan or group loan in default: everything still owed;
- anything else in default: 0;
- a car behind: the arrears `obligation/pay` would clear (car:missed-payments-take-the-car);
- a sponsor's undertaking: what is owed now (undertaking:view-lists-undertaking).

**obligation:charges-paid-whole-or-missed** A charge is paid in full or it is missed. The exception is the naira upkeep (decision 0013): short of its charge, it takes every naira held and the shortfall is the miss, told as "{obligation}: {paid} paid, {short} short" with the miss's own cost; the miss counts as any other. Naira is taken by its size (decision 0014): cash first at or under `tuning.wallet.cashUpTo`, the bank first above it. A paid charge on a loan lowers what is owed and the months left. When nothing is owed the loan closes.

**obligation:miss-applies-its-effects** A missed charge applies the entry's `onMiss` effects and adds one to the count of misses. A paid charge resets the count to zero.

**obligation:upkeep-never-defaults** Upkeep and support carry no arrears and never default. A missed month is gone once its `onMiss` effects have applied.

**obligation:loan-default-and-recovery** A loan missed more times in a row than its grace allows is in default, and its `onDefault` effects apply once. The miss that passes the grace applies `onMiss` first, then `onDefault`. A loan in default charges no more interest; what is owed is the principal still outstanding. From the `due` phase after the default, in each `due` phase, the lender takes whatever is in the bank pocket of the loan's currency, up to what is owed, until nothing is owed.

**obligation:loan-opening-credits-principal** Opening a loan credits its principal to the bank pocket of its currency with the reason `loan`, flagged. Opening held funds credits the principal to the locked pocket with the reason `held-funds`, flagged. An obligation opened by another obligation's effects (the car's shortfall, a guarantee called in) is owed but credits nothing.

**obligation:missed-interest-recalls-held-funds** If a month's interest on held funds is missed, the lender takes the locked principal back at once, the obligation closes, and its `onMiss` effects apply.

**obligation:paying-down-obligations** What `obligation/pay` accepts depends on the obligation:
- A loan: any amount up to what is owed, with the reason `loan-repay`.
- Held funds: the whole principal only. The locked money goes back to the lender and the obligation closes.
- Tuition: exactly every charge missed and not yet paid, under `fee-school`. It clears the arrears and what they set in motion (abroad-money:missed-tuition-runs-in-stages).
- A car: as car:missed-payments-take-the-car and car:car-handed-back-after-half.
- A sponsor's undertaking: as undertaking:missed-charges-lead-to-default.
- Anything else, including a guarantee held as an undertaking: rejected with `not-legal`.

**obligation:closed-obligation-removed** A closed obligation is removed from the state.

**obligation:group-loan-fees-up-front** A group loan (`type: "group-loan"`) opens through `offer.group-loan` with fees and compulsory savings taken up front: `tuning.groupLoan.feeBp` of the principal is paid (reason `fee-agent`), and `savingsBp` is held back from the credit and returned (reason `deposit-return`) when the loan closes paid. It is repaid over its `term` at its flat rate like any loan.

**obligation:group-covers-misses-at-cost** The group stands behind you, at a cost:
- First miss in a row: the group covers the charge, the amount is added to what is owed, standing -5.
- Second miss in a row: the officer and the group come to the house, standing -12, wellbeing -5.
- Third: default, as obligation:loan-default-and-recovery, and the named asset is seized: the entry's `seize` effects apply (for a developer, tech -10 and portfolio -1: the laptop). `quality.credit-mark` +1 keeps every group loan closed to you.

**obligation:three-roads-to-group-loan** The loan reaches the character three ways:
- `offer.group-loan`: their own, for a side business. Needs standing 40, network 20, credit mark 0.
- `offer.parents-group-debt`: a parent's shop loan gone bad and the group at the door. `pay` ₦120,000, or standing -15.
- `offer.stand-guarantor`: a relative asks. `accept` gives standing +4; three months later, at `tuning.groupLoan.vanishBp`, the relative is gone and `obligation.group-loan` opens on you for the balance, with a line. `refuse` gives standing -4.

After a default on a group loan or a sponsor's undertaking (`obligation.group-loan`, `obligation.undertaking-canada`), the group will not take the character in, or as a guarantor: neither `offer.group-loan` nor `offer.stand-guarantor` comes up for `tuning.groupLoan.shutAfterDefault` months (24) from the latest such default, whether or not the defaulted debt is still open. The obligation slice keeps the month each obligation entry last went into default (`defaulted`), and the requirement `obligation/defaulted-lately` reads it against that tuning.

**obligation:way-out-at-every-stage** Every stage has a way out, written plainly: the loan can be paid ahead (obligation:paying-down-obligations), a family request can be answered, and the whip-round (luck:whip-round-once-per-life) can reach a character once no loan of theirs is in default. The words never make the recovery a joke.

**obligation:cooking-and-fetching-water** Cooking and fetching water: `activity.cook-at-home` and `activity.fetch-water`, two activities with `slot: "none"`, at home and abroad.
- They answer now (`when: "now"`), fill no slot and repeat (activity:acts-may-repeat-in-month). Each one's relief is taken once a month however often it is done: a source already on the upkeep adds nothing.
- Each applies the effect `obligation/relief` to the upkeep of the place the character lives in. The next charge of that upkeep is lowered by `tuning.room.cookedBp` (cooking) or `tuning.room.waterBp` (water) of its amount, never below zero, and that charge uses up the relief. The relief is recorded on the upkeep at once, for its next charge at the month's end.
- The results give each its own line ("Food, cooked at home: ₦15,000 less.", "Water, fetched yourself: ₦4,000 less."). The scene shows each with no line, and the phone's Calendar app says what the chores took off this month ("Cooked and fetched water: ₦X less this month").
- A meal takes a morning, fills the belly (+25) and lifts wellbeing (+2). Fetching water takes a day and 8 energy.
- The state shows on the thing: the pot steams the month it was cooked in, and the drum's level rises when water is fetched.

Water is a saving only where it is bought:
- Abroad water costs nothing (a tap in the room), and the act is not offered.
- In a room in a compound the drum is filled from the yard's tap or well, which costs nothing, so the compound's upkeep carries no water share (home:compound-room-is-a-home). There `activity.fetch-water` is not offered (it requires that `obligation.upkeep-compound` is not open). The drum's act is `activity.fill-drum` (requires it open; slot `none`; no effects): it takes nothing off and gives a plain chore line ("The drum is full."), no money line. It answers now and repeats, as cooking and water do.
- The hostel's drum fills free as the compound's does (`activity.fill-drum`), and no water is bought there.
- In Makoko water is bought from vendors who fill from boreholes (about ₦5,000 a family a month in 2013, Sources), so fetching water there brings the relief, as it does at the family house.

Most Lagos homes draw their water from their own borehole or a shared one rather than a piped supply (about half on their own borehole, a further 30% on a shared one, 41% with any piped supply, in a survey that leans to higher incomes; Sources).

Cooking's relief applies at home, where an upkeep carries food. In a home of your own the cooking act is the meal of your own, `activity.cook-own` or `activity.cook-own-pot` (home:living-by-hand). Abroad the country's own meal (`activity.cook-own-uk`, `activity.cook-own-canada`, `activity.cook-own-uae`, `activity.cook-own-italy`) relieves nothing, since each country's upkeep is the phone alone and food is bought by hand (streets:london-life-by-hand; abroad-money:arrival-opens-upkeep-and-room).

**obligation:prepaid-entries-skip-first-charge** An entry marked `prepaid: true` with `everyMonths` has its first period paid when it opens, so its first charge falls `everyMonths` after the opening month, then every `everyMonths`. A missed instalment is asked for again each month, as any missed charge is. The rent for a room in a compound is one (home:compound-room-is-a-home): its year is paid on moving in, and the next year's falls due twelve months on.

## Entries

| Id | Type | Monthly charge | Interest a month | Term | Grace | When missed | On default |
|---|---|---|---|---|---|---|---|
| `obligation.upkeep` | Upkeep | Set by the starting life | | | | Standing -3, wellbeing -5 | |
| `obligation.home-support` | Support | Set by the starting life | | | | Standing -6 | |
| `obligation.salary-loan` | Loan | | 2% flat | 12 months | 1 | Standing -4 | Standing -15, credit mark +1 |
| `obligation.quick-loan` | Loan | | 20% | 1 month | 1 | Standing -8 | Standing -15, credit mark +1 |
| `obligation.held-funds` | Held funds | | 5% | | | Standing -5 | |
| `obligation.held-funds-agent` | Held funds | | 3% | | | Standing -5 | |
| `obligation.group-loan` | Group loan | | 1.7% flat (15% over 9 months) | 9 months | 2 | the ladder in obligation:group-covers-misses-at-cost | seize: tech -10, portfolio -1; standing -15; credit mark +1 |
| `obligation.ajo` | Savings circle (`luck.md`) | ₦20,000 | | 10 months | 0 | closes with standing -6 | |
| `obligation.upkeep-compound` | Upkeep (home:compound-room-is-a-home) | ₦50,000 | | | | Standing -3, wellbeing -5 | |
| `obligation.rent-compound` | Rent (home:compound-room-is-a-home), every 12 months, prepaid (obligation:prepaid-entries-skip-first-charge) | ₦350,000 a year | | | 2 | Standing -3, wellbeing -5 | closes it; the character goes back to the family house (home:rent-default-returns-to-family) |
| `obligation.tech-diploma` | Course fee, as `activity.masters-at-home`'s (activity:paid-tech-courses) | ₦40,000 | | 12 months | | that month gives no gain and does not count | |
| `obligation.bootcamp` | Loan, owed after a developer job (activity:bootcamp-paid-after-a-job) | | 0 | 36 months | 2 | Standing -4 | Standing -10, credit mark +1 |
| `obligation.education-loan` | Loan in pounds, paid to the school (route:education-loan-pays-the-school) | nothing while studying, then from the repayment's start | 0.8% flat | 180 months | 2 | Standing -4 | Standing -10, credit mark +1 |

Upkeep is food, transport, phone and what you give at home. Its reason is `upkeep`. Support's reason is `family`.

The loan rates, checked against `../research/09-uk-masters-numbers.md`, the Borrowing section:
- Salary loan: 2% a month flat, a large bank's salary advance.
- Quick loan: 20% a month, among the loan apps' 2.5% to 36% a month and well above the bank's own quick loan at 2.95%.
- Held funds: 5% a month, the microfinance proof-of-funds loans' rate. The agent's 3% is a working value.
- Education loan: 0.8% a month flat on what was lent, over 180 months, is about £149 a month on £11,000, against about £143 at the lender's representative 13.48% a year over the same fifteen years (factor about 1.04; `route.md`, Numbers).

## Numbers for the group loan

| Setting | Value | Source | In content as |
|---|---|---|---|
| Principal | ₦50,000 to ₦300,000 by ₦50,000 | Real: first loans of ₦20,000 to ₦50,000, rising to ₦300,000 (press reporting, 2020); the game starts above the smallest first loan | `offer.group-loan` terms |
| Fees and compulsory savings up front | 15% fee, 10% savings held back | Real: ₦25,000 in fees and savings for ₦100,000 (press reporting, 2020); the same 25% | `tuning.groupLoan.feeBp` 1500, `savingsBp` 1000 |
| Term and rate | 9 months at 15% in all | Real: 40 weeks at 15% (press reporting, 2020); the game rounds the term to whole months | `obligation.group-loan` term 9, rateBp 170 |
| A guarantor's relative vanishes | 25% | Working value | `tuning.groupLoan.vanishBp` |
| The second miss in a row, the visit | standing -12, wellbeing -5 | Working value | `tuning.groupLoan.visit` |

## Why it is built this way

- **No arrears on upkeep.** The family house always feeds you; a miss costs standing and wellbeing. It is one of the brakes on a downward spiral in `../design/01-concept.md` section 12.
- **Held funds cost money every month.** Five percent a month on ₦25m is ₦1.25m. The pressure is to apply quickly, and a rushed application is a flagged one.
- **The quick loan is a trap, as in life.** It is offered when the pockets are empty, and a miss is announced to your contacts.

## Effects and requirements this kind handles

The part before the slash names the kind that carries out an effect or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `obligation/open` | effect | Opens an obligation from its entry; `principal` and `amount` may override the entry's figures |
| `obligation/close` | effect | Closes every open obligation of a type; a car closes by `closeCar`, which hands it back (car:car-handed-back-after-half) |
| `obligation/relief` | effect | Takes a share off the next charge of the oldest open obligation of a type where the character lives; a source already on it adds nothing (obligation:cooking-and-fetching-water) |
| `obligation/plan` | effect | Turns the open tuition of an entry into a payment plan: what is owed now, spread evenly over the course months left (abroad-money:missed-tuition-runs-in-stages) |
| `obligation/has` | requirement | An open obligation of `obligationType`, not in default, exists. The car is `obligation/has` with type `car` (car:open-finance-gives-the-car). With `obligation` set, only that entry counts, as `goal.own-door` needs (goal:goals-need-the-real-deed). With `defaulted` set, only one in default counts, and with `localCurrency` set only one owed in the currency of the country the character is in (naira at home), as `offer.court-date` needs (health:forced-months-warned-ahead) |
| `obligation/defaulted-lately` | requirement | One of the entries in `obligations` went into default within `tuning.groupLoan.shutAfterDefault` months, whether still open or since closed (obligation:three-roads-to-group-loan) |

## Sources

Read 10 Oct 2026.

- [Africa Groundwater Atlas (British Geological Survey): use and perceptions of groundwater in Lagos](https://earthwise.bgs.ac.uk/index.php/Case_Study_Use_Perceptions_Groundwater_Lagos): an online survey of 539 Lagos residents (Capstick, Whitmarsh, Healy and Bristow, Cardiff University): 41% had a piped supply to the home; for about 50% the main source was their own private borehole and for a further 30% a borehole shared with others. The authors say the sample leans to higher incomes. obligation:cooking-and-fetching-water.
- [Al Jazeera, "Nigeria's water-starved 'Venice of Africa'", 11 Nov 2013](https://www.aljazeera.com/features/2013/11/11/nigerias-water-starved-venice-of-africa): in Makoko water is bought from vendors who fill from boreholes (a vendor buys a tank for ₦2,000 and sells it on for ₦4,000), and a family spends about ₦5,000 a month on water. obligation:cooking-and-fetching-water.
