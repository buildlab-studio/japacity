# Money

> Numbers are working values unless a source is given.
> Kind: `wallet`. One pocket set per currency. Background: `../design/01-concept.md` section 13 and `../research/06-naira-rates-and-currency.md`.

Money is held per currency: naira, pounds, US dollars, Canadian dollars, dirhams and euros. Each currency has three pockets:

- **bank**: documented money;
- **cash**: undocumented money;
- **locked**: money in the bank that counts when funds are shown but cannot be spent.

## Rules

**wallet:no-pocket-below-zero** No pocket ever goes below zero. A debit that cannot be met in full does not happen at all.

**wallet:ledger-balances-each-currency** Every credit and debit is an event with a reason from the fixed list (Reasons, below). In each currency, bank plus cash plus locked equals all credits minus all debits. Money in a queued conversion has already been debited from the currency it left; it is credited to the other currency when it arrives. `top-up` is on the list as money in, credited only by the authority's `wallet/top-up` (wallet:top-ups-are-marked).

**wallet:conversions-are-matched-pairs** A conversion or a move between pockets is a matched pair: a debit and a credit with the same reason, `convert` or `move`.

**wallet:bank-converts-at-official-rate** A bank conversion uses the official rate and bank pockets only. A 1.5% charge is taken from the amount paid in, with the reason `bank-charge`. A conversion between two foreign currencies goes through naira at the official rates, with one charge. Besides the charge's line, the conversion tells two plain lines: `line.wallet.convert-paid`, the amount paid in after the charge, and `line.wallet.converted`, the amount received. The results read the amount paid from `line.wallet.convert-paid`, never from the charge alone.

**wallet:monthly-fx-allowance** Bank purchases of foreign currency in a month are limited, all together, to the month's allowance: a world variable in US cents. Selling foreign currency for naira has no limit. A purchase above what is left of the allowance is rejected with `bad-amount`. A foreign fee paid from naira (wallet:foreign-fee-payment-order) settles an invoice rather than buying currency, so it does not count against the allowance. The view's `bankAllowanceLeft` is null abroad, where the Lagos allowance does not apply.

**wallet:bank-queue-delays-purchases** While the world's bank queue is above zero, a bank purchase of foreign currency is queued. The money leaves at once; the foreign currency arrives that many months later, in the `settle` phase, at the official rate of the day it arrives.

**wallet:aboki-trades-at-street-rate** A conversion at the aboki uses cash pockets only, is instant and has no limit. Buying foreign currency costs the street rate. Selling it pays the street rate less 2%.

**wallet:aboki-short-count** Each aboki conversion has a 1.5% chance of a short count: the character receives 3% to 8% less, shown as a debit with the reason `short-count`.

**wallet:foreign-fee-payment-order** A fee in a foreign currency is paid from that currency's bank pocket first, then its cash, then from the naira bank pocket at the official rate plus the 1.5% charge. The naira part is refused while the world's bank queue is above zero. If the whole fee cannot be paid, nothing is paid.

**wallet:locked-money-stays-put** Locked money cannot be spent, moved or converted. Only a debit that names the locked pocket removes it.

**wallet:large-deposits-record-lots** A lot (the currency, the amount, the month and the reason) is recorded for a bank credit marked as flagged, and for a move of cash into the bank that leaves the month's cash paid in (the slice's `cashIn`, reset each month) above ₦500,000 at the official rate. Each such move is a lot of its own amount: the move that crosses the line and every later move that month. In the `settle` phase, lots older than 3 months are dropped. A sale the game itself makes is documented money, with its deed as the paper, and is not flagged: the plot sold to the land buyer is paid into the bank under `sale` with no lot (`offer.md`), so it adds nothing to the unexplained share (route:unexplained-share-of-funds). A gift with nothing to show where it came from is flagged.

**wallet:amounts-whole-and-positive** A command amount must be a whole number above zero, and a conversion must give back at least one unit of the other currency; otherwise the command is rejected with `bad-amount`. The one exception is the car's hand-back, `obligation/pay` with 0 (car:car-handed-back-after-half). An amount larger than the pocket holds is rejected with `cannot-afford`.

**wallet:ledger-total-requirement** The requirement `wallet/total` (`flow` in or out, `reason`, `currency`, `amount`) is met when the ledger's total under that reason in that currency is at least the amount. `have` and `need` are shown. Goals use it to read what was sent home or paid under a reason.

**wallet:ledger-report-raises-alarms** The pure function `ledgerReport(state, content)` reads the totals the ledger keeps and gives the money created and destroyed, by reason and currency, with a list of alarms. An alarm names the account as suspect when a reason's total in is more than that reason can produce in the months played: salary above the best job's pay (raised by the yearly review's cap for each year played, activity:naira-pay-reviewed-yearly) times the months; gig pay above its ceiling; opening money above the richest starting life. The server runs the report across every account each day. The ceiling for `top-up` in naira is an input: the payment processor's receipts for the account (wallet:top-ups-are-marked). The server passes no receipts, so the ceiling is 0 and any top-up names the account. A top-up in any other currency has a ceiling of 0.

**wallet:months-kept-counted** Months kept (decision 0024). As each month closes, the wallet counts it as kept when the month's net, in the money of the place where the month ended, is above zero. This is the figure the results sheet shows as kept or down (world:month-end-results-sheet), read from the same ledger, so the two never disagree. Changing money counts for nothing either way: the `convert` legs are left out, while the bank's charge and the aboki's short count stay as money out. These count nothing: a move between pockets, held funds locked and given back, money before the prologue closed, and a month not yet ended. The view's `keptMonths` holds the count; it is never shown as a figure. The careful saver japa type reads it.

**wallet:view-carries-month-pay** The view carries the month's pay as the wallet will book it. `job.pay` is the held job's pay less the month's tax (abroad-money:salary-abroad-taxed-locally), using the written figure or its tier (activity:side-jobs-pay-by-tier), as the yearly review left it (activity:naira-pay-reviewed-yearly), with the raise (activity:waiting-months-build-profile), the car bonus (ladders:car-bonus-needs-car), the courier's account rent and the shop's growth; for a sponsored or contract job it is the salary recorded on the route (route-gates:sponsored-status-on-departure, route-gates:employer-flies-and-holds-passport). `job.sidePay` is the side job's pay. An open offer whose terms name a job carries its `pay`, worked out the same way. Each is null where no pay can be read. A sick month and cash work held back are drawn when the month ends and are not foreseen. The client's dues warning, the card's dues and the line of a hunt that found a job read these figures and keep no copy.

**wallet:tone-follows-money-direction** A wallet line's tone comes from its event, not its reason: a credit is `good` (money in), a debit is `bad` (money out), and a conversion or a move between pockets is `plain`. So the foreign leg of a transfer home is money out in the local currency, its naira leg is money in, and a refund under a fee's reason is money in. The client reads the tone and keeps no patch of its own.

**wallet:money-lands-as-in-lagos** Money is paid where it would be in Lagos (decision 0014). A naira credit from work, a gig, a tip, a prize or the prologue's earnings goes to cash at or under `tuning.wallet.cashUpTo` (₦10,000) and to the bank above it; salary always goes to the bank. A `money/take` with `pocket: "any"` takes cash first at or under the line and the bank first above it, never locked money, all or nothing (wallet:no-pocket-below-zero). A named pocket is used as named. One helper, `pocketFor`, applies the line for activities and for the prologue's content alike.

**wallet:cash-pile-warning** Money never moves by itself; the world warns instead. When a month closes after the prologue with more than `tuning.wallet.cashWarnAt` (₦100,000) in naira cash, the wallet tells one line, with attention, once in a life: `line.wallet.cash-warning`, Mama saying in her own words that cash on you is at risk and the bank is safer, with no figure. The news pool for the first months at home carries one story of a one-chance robbery on a danfo (`news.warning-one-chance`: bad news told straight, no variable moved, once, in the calm era that opens every world), so the warning is heard before the robbery can happen (activity:one-chance-bus-robbery). The story is certain in the calm era, and certain stories start before rolled ones under the cap on new stories a tick (director:stories-start-by-roll, decision 0034), so every world hears it by the third tick. Moving the money stays the player's act, in the Bank app.

**wallet:top-ups-are-marked** Marked money (decision 0015). A top-up is naira credited by the authority's command `wallet/top-up` (`amount` in kobo, server:apologies-never-currency), never by the client; no server route sends it. It applies the effect of the same name: a flagged credit to the naira bank pocket with the reason `top-up`, which also adds the amount to the wallet's marked figure, the topped-up naira not yet spent.
Every debit except a Friday ticket (`lottery/buy`) or the kiosk's slip (`activity.play-lotto`) spends earned naira first; the marked share pays only once the earned naira runs out, like savings kept aside. A ticket or a slip is paid from earned naira only (the balance less the marked figure) and is rejected with `cannot-afford` when that is short. A ticket is paid from the naira bank (lottery:ticket-buying-capped), so the bank must cover it as well as the earned share; the slip pays by its size from the earned share. A prize is paid into earned naira. The band shows one balance.
A top-up is a lot the visa officer asks about (wallet:large-deposits-record-lots, route:unexplained-share-of-funds), explained as a gift is. The ledger report's ceiling for `top-up` is the processor's receipts (wallet:ledger-report-raises-alarms). The slice's `marked` is absent while zero, so no state hash changes. After a naira debit it is never above the naira bank and cash left, because earned naira is spent first; a move between pockets spends nothing. The view's `wallet.marked` carries the figure (0 when there is none); the kiosk's sheet and the slip read it for the message they show when closed: "Tickets come from money you earned".

**wallet:passbook-against-plan-cost** The passbook (`../design/08-the-lived-month.md`, section 2). At home the view carries `passbook`: the money held for the move against the plan's whole cost. It is null abroad, in the prologue and once the life has ended. `held` is bank and cash in every currency at the official rate, never locked money. `target` shows only once the plan's route (`planOf`) has been looked into or is further on. It has:
- `funds`: what the route requires before the application is sent, less locked money and family support; never below zero, and zero once applying;
- `fees`: every priced act at home that sends this route's application or requests a paper its checklist needs. Repeat acts are left out, and an act drops out once its application is sent or its paper is held or on its way. Where one checklist item can be met by any of several papers (English by the degree's statement or by the test), only the cheapest act the life may do counts, and none once either paper is held or on its way;
- `flight`: `tuning.route.flight`, unless the employer pays or the route is flown;
- `total`: their sum, in kobo.

The nurse's care route comes to about ₦2.01m. The Bank's Saved for the move (world:phone-holds-what-phones-hold) keeps its own figure in the route's currency; the passbook's figure is the whole cost in naira.

**wallet:savings-stamps** Stamps: `tuning.wallet.stamps` (₦1m, ₦2.5m, ₦5m), then the target. Each is stamped once, at the close of a month at home that moved money, and kept with its month in the wallet's `stamps`. The event `wallet/stamped` tells it with attention, under `line.passbook.stamped` or, for the target, `line.passbook.ready`; no list of money moved counts these lines. The view shows the fixed stamps that are under the target or already reached, then the target. A stamp reached is a moment (moment:outcomes-that-are-moments).

**wallet:saving-pace** Pace. Through a month, `paceNet` adds up money in and out in every currency, as the month net of wallet:months-kept-counted does, but leaves out the move's own reasons (`fee-document`, `fee-test`, `fee-school`, `fee-visa`, `fee-surcharge`, `flight`), which the target already counts. At the close of a month that moved money the net is valued in kobo (`wallet/paced`), and the last three are kept (`nets`). `pace` is their average, rounded down, and null before any month has closed. `months` is 0 when held covers the target, null when there is no pace above zero, and otherwise the gap divided by the pace, rounded up. A month that moved nothing tells nothing. A state without `nets` or `stamps` loads with none (server:upgrade-state-is-pure).

**wallet:roads-to-the-target** The ways to reach the target, each one something the game already has:
- the ladder: the next rung of the held job's own trade (activity:each-trade-climbs-its-ladder), never a rung in another trade; else the better-paid job nearest; else the nearest job;
- a side job: the one held, else the best-paid one that can be hunted now;
- the street's ajo (`offer.join-ajo`, luck:savings-circle-holds-pot): taken while a circle runs, open while its offer stands, else shut with what it asks for. It adds nothing a month, since its pot is what was paid in;
- the family: the family meeting for a master's plan; the family meeting's gift for a Canada plan once the credential assessment is held (route-gates:family-gift-counts-with-deed, with its deed named); else Papa's loan (`activity.ask-family-loan` and `offer.family-loan`). Papa's loan is a call home, once a month, needing standing 40, family means 10 and stake 0. It lends family means times ₦50,000 to the bank under `loan`, with no repayment and no deadline, and raises the family's stake by one, which shuts this way;
- the scholarship, where the plan names one.

Each way carries its state (taken, open, shut), what it still needs, its monthly and lump figures, and its months: the gap less the lump, divided by the pace plus the monthly, rounded up. `best` is the soonest way not taken that beats the pace alone. The pace is shown as two chips, each with its months in green, such as "At this pace: ready in 15 months" and "With Papa's loan: 4", never as a percentage.

## Pockets

Which pocket money is taken from or paid into. Earned naira credits follow wallet:money-lands-as-in-lagos.

- **`transfer`**: the bank first, then cash, never locked money. This is how Lagos pays (by transfer) and how people pay abroad (by tap) (decision 0014).
- **`any`**: the street: a fare, the kiosk and the bet slip, the phone stall, an agent at the park who wants it today. Cash first at or under `tuning.wallet.cashUpTo` (₦10,000), the bank first above it, never locked money (wallet:money-lands-as-in-lagos).
- **A named pocket** is used as named. A bank credit marked `locked` goes to the locked pocket.
- **Cash alone** is taken only by the aboki (wallet:aboki-trades-at-street-rate), a theft and a robbery.
- **A foreign fee abroad** follows wallet:foreign-fee-payment-order, the bank first. It may be recorded as two debits, one per pocket, under the same reason.

## Reasons

Every reason in `Reason` (`packages/sim/src/engine/types.ts`), with the page that uses it. The Money in column lists the money-in reasons; every other reason except the pairs is money out.

| | Money in | Money out | Pairs |
|---|---|---|---|
| Home | `opening`, `salary`, `gig`, `gift`, `sale` (a thing sold at its resale share, home:things-a-life-owns), `loan`, `held-funds`, `refund`, `top-up` (naira bought with real money, marked: wallet:top-ups-are-marked) | `upkeep`, `family`, `goods` (a thing bought from the market) and `running` (its cost a month), `fee-document`, `fee-test`, `fee-school`, `fee-visa`, `fee-surcharge`, `fee-agent`, `fee-advice` (the licensed adviser, advice:licensed-adviser-is-truthful), `bank-charge`, `loan-repay`, `loan-interest`, `held-funds-return`, `held-funds-interest`, `study`, `social`, `mishap`, `flight`, `short-count`, `food` (a meal or water bought and eaten, home:living-by-hand), `foodstuff` (food bought for the family house's pot, home:living-by-hand), `enjoyment` (spending on the street, streets:lagos-street-spending), `ticket` (a Friday draw ticket, lottery:ticket-buying-capped) | `convert`, `move` |
| Across the whole life | `deposit-return` (the group loan's savings back, obligation:group-loan-fees-up-front; a flat's deposit back, abroad-money:arrival-opens-upkeep-and-room), `cash-work` (cash pay, ladders:cash-jobs-paid-in-hand), `win` (luck:kiosk-sells-lotto-tickets, luck:bet-slip-stake-and-odds, lottery:winners-paid-by-authority), `assistance` (social assistance abroad, undertaking:social-assistance-offer), `remit` (the naira received at home, as the code books it: abroad-money:remit-sends-money-home) | `rent`, `phone`, `car-payment`, `car-deposit`, `remit` (the foreign leg sent home), `remit-fee`, `tax` (abroad-money:salary-abroad-taxed-locally), `agent-debt` (road:road-truth-asks-more), `fare` (the fare home, place:fare-home-in-local-currency), `fine` (the UAE's overstay fine, status:uae-fine-accrues), `wedding` (a wedding's share, person:agreed-partner-and-marriage), `undertaking` (a charge a sponsor pays, undertaking:assistance-charged-to-sponsor) | |

`remit` is the one reason used both ways: out for the foreign leg, in for the naira leg.

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| Bank charge | 1.5% | Working value | `tuning.wallet.bankChargeBp` |
| Aboki's cut when selling foreign currency | 2% | Working value; no published spread was found (`../research/06-naira-rates-and-currency.md`) | `tuning.wallet.streetSpreadBp` |
| Chance of a short count | 1.5% | Working value; short counts are the common trick (`../research/06-naira-rates-and-currency.md`) | `tuning.wallet.streetShortBp` |
| Size of a short count | 3% to 8% | Working value | `tuning.wallet.streetShortLossBp` |
| Cash deposit that gets flagged | Over ₦500,000 | Working value | `tuning.wallet.flagDepositAbove` |
| Months a lot is remembered | 3 | Working value | `tuning.wallet.lotMonths` |
| Largest naira sum that changes hands as cash | ₦10,000 | Working value (decision 0014) | `tuning.wallet.cashUpTo` |
| Naira cash at a month's close that draws the warning | Over ₦100,000 | Working value | `tuning.wallet.cashWarnAt` |

## Why it is built this way

- **Naira savings lose value when the naira falls.** Funds are valued in pounds on the day, so a balance can drop under the line without a kobo leaving it.
- **Dollars and pounds are the hedge, and the bank sells few of them.** The aboki sells any amount, as cash, but cash paid into the bank is a flagged deposit for three months.
- **A dollar salary is documented from the start.** That is why the remote job matters.

## Effects and requirements this kind handles

The part before the slash names the kind that carries out an effect or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `money/add` | effect | Credits `amount` to a pocket under a reason; `flagged` records a lot (wallet:large-deposits-record-lots), `locked` puts it in the locked pocket |
| `money/take` | effect | Debits `amount` from `bank`, `cash`, `locked`, `any` (the street: cash first at or under `tuning.wallet.cashUpTo`, the bank first above it, wallet:money-lands-as-in-lagos) or `transfer` (bank first, then cash); all or nothing (wallet:no-pocket-below-zero) |
| `money/pay-fee` | effect | Pays a foreign-currency fee by wallet:foreign-fee-payment-order |
| `wallet/top-up` | effect | Credits `amount` to the naira bank as `top-up`, records a lot and raises the marked figure (wallet:top-ups-are-marked); only the authority's command of the same name applies it |
| `money/min` | requirement | Bank and cash together, or the named pocket, hold at least `amount`; locked money never counts |
| `money/can-pay` | requirement | The amount could be paid now: naira from cash and bank, a foreign fee by wallet:foreign-fee-payment-order |
| `wallet/total` | requirement | The ledger's total under a reason, in or out, is at least `amount` (wallet:ledger-total-requirement) |
