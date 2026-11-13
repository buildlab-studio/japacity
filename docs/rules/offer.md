# Offers

> Amounts are working values.
> Kind: `offer`. Many per character. Background: `../design/01-concept.md` sections 7 and 12, and `../research/01-japa-journey.md` section 6.

An offer is anything that comes to the character with choices and a deadline: a family request, a job, a loan, a man who says he can arrange things. Which offers reach a character depends on who they are now.

## Rules

**offer:come-up-rolls-in-order** In the `come-up` phase, entries with a chance above zero are taken group by group (money, then life, then family) and in id order within a group. An entry is rolled if its conditions hold, none of it is open, its cooldown has passed since it last opened, and it has not reached its limit of times. At most 2 offers open this way in a month, and none while 4 are open. The month's cap counts the offers rolled at the day's arrivals (offer:day-arrivals-roll-offers) and at the close together (decision 0012). The slice keeps the month's rolled count (`rolled`, `rolledMonth`), raised by `offer/opened` with `rolled: true`.

**offer:opening-fixes-terms-and-fraud** Opening an offer fixes its terms, its expiry month, the signs it shows, and, hidden, whether it is a fraud. A range term is one draw in whole steps. A quality term is the quality times its figure. A pay term is the monthly pay of the job held times its figure, up to its cap.

**offer:choice-needs-conditions-and-funds** `offer/choose` needs:
- an open offer and one of its choices;
- that choice's conditions holding;
- every debit among its effects payable;
- where the choice asks for an amount, a whole number between the two terms it names.

The choice's effects apply, the amount picked is readable as the term `amount`, and the offer is removed.

**offer:fraud-effects-replace-ordinary** When an offer is a fraud and the chosen choice has fraud effects, those apply in place of its ordinary effects.

**offer:lapsed-offer-removed** In the `expire` phase an offer whose month has come is removed. If its entry names a choice for lapsing and that choice can be taken, it is applied first. The one exception is `offer.illness-worse`: when its `cannot` cannot be taken, the health roll applies it all the same (health:worse-illness-locks-slots). Both family pledges and the family's gift for Canada name no lapse choice, so an unanswered pledge or gift lapses into nothing. `route/depart` closes every open offer whose entry is `where: "home"`, unanswered, with no choice recorded and nothing paid: an ask that belongs at home cannot be answered abroad.

**offer:fraud-hidden-signs-shown** The view never shows whether an offer is a fraud. Each sign of an entry is shown or not when the offer opens, by one chance if it is honest and another if it is a fraud.

**offer:effect-opens-named-offer** The effect `offer/open` opens the named offer only if its conditions hold. It ignores the chance, the cooldown and the monthly limit, but respects the limit of times. Terms handed over with the effect are added to the offer's own: this is how a job offer learns which job it is for. Opening an entry that is already open closes the waiting one unanswered, with no lapse effects, and opens the new one, so the job landed most recently is the one on the table.

**offer:day-arrivals-roll-offers** The day's arrivals (decision 0012). The effect `offer/come-up` with `max` rolls as the `come-up` phase does (offer:come-up-rolls-in-order: the groups in order, the conditions, the cooldown, the limit of times, the chance on the stream `offer`). It opens at most `max` offers, inside the month's cap of rolled offers and the cap of open ones. Nothing else of the phase comes with it (no illness, no whip-round, no parcel). The turn kind applies it with `max` 1 each time the month's free time spent crosses one of `tuning.turn.arrivalsBp` (a third and two thirds of the free time) within one `turn/spend-days` (turn:month-lived-in-half-days), so an ask lands in the middle of the day being lived. The close's roll opens what the cap still allows.

## Family requests

Group `family`. Money paid has the reason `family`. Every family request lapses after one month into its last choice.

All are "not when broke": they need at least ₦150,000 in naira, bank and cash together. This keeps the family's asks off a character who is broke, alongside luck:no-kicking-while-down. Abroad the family expects more: the same requests come with `abroadBp` applied to their amounts (abroad-money:family-asks-more-abroad).

| Id | Chance a month | Cooldown | Title | Body | Choices |
|---|---|---|---|---|---|
| `offer.nepa-bill` | 12% | 3 | NEPA has brought the bill at home | "They are threatening to cut the light. ₦25,000. Your father says he will handle it. He will not." | `pay` ₦25,000: standing +3. `leave`: standing -4, wellbeing -3 |
| `offer.brother-fees` | 6% | 4 | Your brother's school fees | "Resumption is Monday. ₦120,000. He has been sent home once already this year." | `pay` ₦120,000: standing +8. `half` ₦60,000: standing +2. `no`: standing -9 |
| `offer.mum-shop` | 5% | 6 | Mama's shop | "The supplier has stopped giving on credit. ₦80,000 would restock the provisions before the month ends." | `give` ₦80,000: standing +6. `half` ₦40,000: standing +2. `no`: standing -6 |
| `offer.aso-ebi` | 5% | 6 | Aso ebi for the wedding | "Your cousin is getting married. The cloth is ₦60,000. Everybody is buying." | `buy` ₦60,000: standing +4, network +3, wellbeing +3. `plain`: standing -2, network +1. `absent`: standing -5 |
| `offer.roof` | 2.5% | 12 | The roof | "Rain entered the parlour again. The carpenter wants ₦200,000 for zinc and labour." | `pay` ₦200,000: standing +10. `half` ₦100,000: standing +3. `no`: standing -8 |
| `offer.harvest` | 6% | 12 | Harvest pledge | "They are calling families by name. ₦30,000 would cover yours." | `give` ₦30,000: standing +3, wellbeing +2. `no`: standing -1 |
| `offer.uncle-burial` | 2.5% | 12 | Your uncle's burial | "The family is contributing. Your share is ₦100,000. People will remember who gave." | `send` ₦100,000: standing +7. `token` ₦20,000: standing +1. `nothing`: standing -7 |

## Life

Group `life`. Each lapses after one month into its last choice.

| Id | Comes up when | Chance | Cooldown | Title | Body | Choices |
|---|---|---|---|---|---|---|
| `offer.send-off-party` | Bachelor's degree; once a life (`maxTimes` 1) | 5% | 5 | Terna's send-off | "He leaves for Leeds on Sunday. Small chops at his sister's place, Saturday. 'Come o, you never know who you will meet.'" | `go` ₦20,000, social: network +4, wellbeing +4, hear of the UK master's route. `message`: nothing |
| `offer.laptop-fault` | Tech 25 | 3% | 8 | The laptop | "The screen flickers, then nothing. The repairer at Computer Village says ₦85,000 and three days." | `repair` ₦85,000, mishap. `manage`: tech -2, wellbeing -6 |
| `offer.fuel-scarcity` | Always | 4% | 6 | Fuel scarcity | "Queues at every station. Bus fare has doubled this week." | `pay` ₦30,000, upkeep. `trek`: wellbeing -7 |
| `offer.recruiter-message` | Tech 50, has a job | 3% | 6 | A message from a recruiter | "'Saw your work. We have a take-home task, no promises.' It would eat your weekends this month." | `do-it`: portfolio +1, network +3, wellbeing -3. `ignore`: nothing |

## Money

Group `money`.

| Id | Comes up when | Chance | Cooldown | Lapses after | Terms |
|---|---|---|---|---|---|
| `offer.family-loan` | Opened by `activity.ask-family-loan` alone (chance 0, so no random stream moves); once in a life | 0 | | 3 | Papa lends family means times ₦50,000 to the naira bank under `loan`, flagged, and the family's stake rises by one; no obligation, no deadline; in Papa's voice (wallet:roads-to-the-target) |
| `offer.salary-loan` | Has a job, 6 months in any job, credit mark 0; never while a route is granted or flown on | 8% | 6 | 2 | `min` ₦100,000. `max` 4 times monthly pay, up to ₦3,000,000 |
| `offer.quick-loan` | Under ₦100,000 in naira, credit mark 0 | 25% | 3 | 1 | `min` ₦50,000. `max` a draw from ₦100,000 to ₦300,000 in steps of ₦50,000 |
| `offer.held-funds` | Deposit paid, has a job, 6 months in any job, standing 40, credit mark 0 | 100% | 2 | 2 | `min` ₦2,000,000. `max` 12 times monthly pay, up to ₦30,000,000 |
| `offer.held-funds-agent` | Deposit paid | 35% | 4 | 2 | `min` ₦2,000,000. `max` ₦40,000,000. A fraud 35 times in 100 |
| `offer.land-buyer` | Owns land, route known | 20% | 3 | 2 | `price` a draw from ₦7,500,000 to ₦10,500,000 in steps of ₦500,000 |
| `offer.family-pledge` | Standing 50. Opened only by the family meeting. Once | | | 3 | `show` family means times ₦300,000. `gift` family means times ₦60,000 |
| `offer.family-pledge-small` | Standing 30 to 49. Opened only by the family meeting. Once | | | 3 | `show` family means times ₦150,000. `gift` family means times ₦30,000 |
| `offer.family-gift-canada` | `route.canada-points` known, `document.eca` held, standing 40, family stake 0. Opened only by the family meeting. Once | | | 3 | `gift` family means times ₦100,000 (route-gates:family-gift-counts-with-deed) |
| `offer.education-loan` | `route.uk-masters` deposit paid, no visa granted or flown on it, credit mark 0, no education loan taken on the route | 100% | 3 | 2 | `max` the tuition left (the school's tuition less its discount and the deposit), in pence; `min` £1,000 (route:education-loan-pays-the-school) |
| `offer.fee-payment-plan` | Opened only by tuition left unpaid a second month (abroad-money:missed-tuition-runs-in-stages). Group `money` | | | 1 | the arrears and the rest of the tuition, spread evenly to course month 12; the plan's fee £50 |
| `offer.job` | Opened only by job hunting. Group `job`, not `money` | | | 2 | `job`, the job's id |
| `offer.job-lead` | Opened only by a starting life's first missed hunt, for another job than the one missed (activity:missed-hunt-opens-a-lead). Group `job`; once in a life | | | 2 | `job`, the lead's job; `missed`, the job missed; `lead`, the words of the place; `cost`, the words of what it costs the trade missed |
| `offer.job-word` | Opened only by a starting life's first missed hunt, for the job just missed (activity:missed-hunt-opens-a-lead). Group `job`; once in a life | | | 2 | `job`, the job missed; `lead`, the words of the place |
| `offer.canoe-place` | Opened only by `activity.ask-fisherman` while the life lives in Makoko and holds no boat job (activity:boat-work-at-the-net-shed). Group `job`; once in a life | | | 2 | `job`, the crew's job |

A pay term for a job paid in dollars is valued in naira at the official rate.

| Id | Title | Body | Choices |
|---|---|---|---|
| `offer.salary-loan` | Salary loan | "Your bank: 'You qualify for a salary advance. 2% a month, twelve months, deducted at source.'" | `take`, pick an amount: opens `obligation.salary-loan` for it. `no` |
| `offer.quick-loan` | QuickNaira | "'Need cash now? Approved in 5 minutes. No collateral.' The small print says 20% a month and access to your contacts." | `take`, pick an amount: opens `obligation.quick-loan` for it. `ignore` |
| `offer.held-funds` | Olokun Microfinance: proof of funds | "'We place the funds in your account for as long as you need. 5% a month, 1% arrangement fee. The money is yours to show, not to spend.' The small print: the money comes back to them before you fly, and your school fees will still be yours to pay." | `take`, pick an amount: pay 1% of it, reason `fee-agent`, then open `obligation.held-funds` for it. `no` |
| `offer.held-funds-agent` | Mr Gbenga can arrange it | "A friend of a friend. 'Proof of funds? I do it every week. 3% monthly, cheaper than any bank. Just bring the first payment.'" | `take`, pick an amount: pay 4% of it from cash, reason `fee-agent`, then open `obligation.held-funds-agent` for it. If a fraud: the 4% is paid and nothing else happens. `walk-away` |
| `offer.land-buyer` | A buyer for the land | "'I will pay {price} for the plot, cash, this week. After that I look elsewhere.' Your father will hear about it either way." | `sell`: the price to the bank, reason `sale`, not flagged: the deed of sale says where it came from (wallet:large-deposits-record-lots). Land -1, standing -3. `hold` |
| `offer.family-pledge` | The family meeting | "Your father, after a long silence: 'We will stand behind you. I will sign that {show} in my account is for your studies. And your mother and I will give you {gift}. Do not forget this house.'" | `accept`: family support of `show` on the route. `gift` to the bank, reason `gift`, flagged. Family stake +1. `decline`: standing -2 |
| `offer.family-pledge-small` | The family meeting | "Your mother speaks for them: 'It is not much. {show} in the account can carry your name, and take {gift}. Things are tight, you know how it is.'" | The same two choices |
| `offer.family-gift-canada` | The family meeting | "Your father: 'Canada wants to see the money is yours. We will give you {gift}. Not a loan, a gift. Get the paper from the notary so they believe it.'" | `accept`: `gift` to the bank, reason `gift`, flagged; recorded on the route as the family's gift; family stake +1. `decline`: standing -2 |
| `offer.education-loan` | A study lender | "A lender that funds master's students from Nigeria: 'We pay your fees straight to the university. About 13.5% a year, a 4.2% fee added to the loan, $500 to process. Repay over fifteen years, starting after your course.'" | `take`, pick an amount: pay the processing fee, reason `fee-agent`, and open `obligation.education-loan` for the amount plus the 4.2% fee, paid to the school (route:education-loan-pays-the-school). `no` |
| `offer.fee-payment-plan` | The university's fees office | "'You can clear the arrears on a plan: {instalment} a month until the end of the course, and a £50 fee. Miss a plan payment and we will write to you before we withdraw you.'" | `agree`: pay £50, reason `fee-school`, and spread the tuition owed over the months left (abroad-money:missed-tuition-runs-in-stages). `no` |
| `offer.job` | A job offer | "'We would like you to start on the first.'" | `accept`: start the job. `decline` |
| `offer.job-lead` | Them dey hire | Lanre: "'I know {lead}: it pays, but {cost}.'" | `accept` ("Take it"): start the job. `decline` ("Keep looking") |
| `offer.canoe-place` | Join my canoe | Sewanu: "'You want learn the water? Third in my canoe, you sort fish, I share the catch.'" | `accept` ("Take it"): start the job. `decline` ("Not now") |
| `offer.job-word` | Try them again | Lanre: "'I put in a word for you with {lead}, so go and see them again.'" | `accept` ("Take it"): start the job. `decline` ("Keep looking") |

Signs for `offer.held-funds-agent`, each shown or not when the offer opens (offer:fraud-hidden-signs-shown):

| Sign | Shown if honest | Shown if a fraud |
|---|---|---|
| `cash-only`: "He only takes cash." | 30% | 90% |
| `office`: "He has an office, with his name on the door." | 80% | 25% |
| `receipt`: "He gives a stamped receipt." | 70% | 20% |
| `my-guy`: "He keeps saying 'my guy at the bank will sort it'." | 30% | 70% |
| `friend`: "Someone you know used him last year and it worked." | 50% | 10% |

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| Most offers that can open by roll in a month | 2 | Working value | `tuning.offer.maxNewPerMonth` |
| No rolls while this many are open | 4 | Working value | `tuning.offer.maxOpen` |
| The day's arrivals, shares of the free time | 33.33%, 66.67% | Working value | `tuning.turn.arrivalsBp` (offer:day-arrivals-roll-offers) |
| "Not when broke" | ₦150,000 in naira, bank and cash together | Working value | each family request's `when` |

## Effects and requirements this kind handles

The part before the slash names the kind that carries out an effect or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `offer/open` | effect | Opens an offer from its entry, unless its own `when` does not hold |
| `offer/come-up` | effect | Rolls as the come-up phase does and opens at most `max` offers inside the month's cap (offer:day-arrivals-roll-offers) |
| `offer/close` | effect | Closes the named open offer unanswered, no choice recorded and nothing paid, for a family request handled in another life (person:family-requests-shared) |
