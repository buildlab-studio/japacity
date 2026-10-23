# Money abroad

> Numbers are the real ones at the dates given, as working values. Sources at the end.
> Kinds: `wallet` and `obligation`, extended; `var`. Background: `../design/01-concept.md` sections 12 and 13, `../research/03` section 6, `../research/04` section 4, `../research/06`.

Abroad you are paid in the local currency, taxed before you see it, and charged for a roof, a phone and your own visa. What is left is what you send home, and sending it is a choice of channel.

## Rules

**abroad-money:foreign-currencies-join-wallet** Three currencies join the wallet: `CAD`, `AED` and `EUR`. Each has an official and a street rate in kobo per whole unit, moved by the stand-in world as the pound and the dollar are (rate:official-rates-drift-together and rate:street-premium-tracks-target apply to all four foreign currencies with one factor; the AED is pegged to the dollar, so its official rate is the dollar's times 10000 over 36725, rounded down). Every wallet rule holds for these currencies as for the pound and the dollar.

**abroad-money:salary-abroad-taxed-locally** A job abroad pays its salary over twelve into the local currency's bank pocket (reason `salary`), less tax: the country's `taxBp` on the part of the yearly salary above the country's `taxFreeLine`, taken as a debit with the reason `tax` in the same `main` phase. The UAE has no tax.

**abroad-money:arrival-opens-upkeep-and-room** Arriving abroad opens the country's `upkeep` obligation in the local currency, and a `rent-room` obligation: a shared room, no credit needed. Abroad the living is lived, not charged, as at home (home:living-by-hand; design page 10, design page 11 section 5): the upkeep is the phone alone, named so (`obligation.upkeep-uk` the pay as you go at £15 a month, `obligation.upkeep-canada` the prepaid phone at C$30, `obligation.upkeep-uae` at AED 50, `obligation.upkeep-italy` at €10); food is bought and cooked by hand in the country's money (streets:london-life-by-hand, streets:calgary-life-by-hand, streets:dubai-life-by-hand and streets:castel-volturno-by-hand), and fares are paid at the stop (place:rides-between-city-places, place:country-pass-covers-ways, place:employer-shuttle-rides-free). `activity.rent-flat` moves to a flat in your own name when `credit/min` 20 holds and a deposit of one month is paid (reason `rent`, returned on leaving as `deposit-return` to the bank of its currency; an eviction keeps it); it closes `rent-room` and opens `rent-flat`. Rent missed twice in a row is `onMiss` standing and wellbeing, and a third miss in a row evicts: back to `rent-room` with a mark on the credit file (credit:payments-move-the-mark with the default figure). The Gulf's bed space is the employer's while the contract's status holds.

**abroad-money:right-to-rent-check** The right to rent. In the `clocks` phase of each month past the grace on an overstayer status whose entry has `rentCheckBp` above 0 (the UK's, 1500; status:grace-before-overstaying), a draw at that chance on stream `status` is the landlord's check, while the room is `rent-room` or `rent-flat`. On it the room ends: the obligation closes with nothing owed, a flat's deposit kept as on an eviction, and `obligation.rent-cash-room-uk` opens in its place, a room let with no papers asked: £840 a month, paid from `any` pocket of pounds, cash first, reporting to no credit file, its misses following `rent-room`'s; wellbeing -6, with a line that asks for attention. That room has no check, so the draw is not made again on it. Real: landlords in England must check a tenant's right to rent and may end the tenancy of someone with none, under fines of up to £10,000 an occupier, £20,000 for a repeat (Immigration Act 2014; the 2024 Maximum Penalty Order); no source gives how often an overstayer's room ends. The 15% a month and the dearer room are working values.

**abroad-money:phone-contract-builds-credit** `activity.phone-contract` needs `credit/min` 10 and opens the country's phone obligation (`obligation.phone-uk`, `obligation.phone-canada`; no fixed term, so it runs on month by month; reports to credit). Without it the phone is pay as you go inside upkeep. A contract paid on time is the cheapest way to build the file.

**abroad-money:tuition-paid-in-instalments** A student's tuition less the deposit is owed in three instalments: `obligation.tuition` opens as the student departs (the study gate applies it with the flight) with the remaining tuition as the principal, term 3, charged in months 1, 4 and 7 of the course (the obligation's `everyMonths` is 3). A missed instalment is `grace` 1, and a default withdraws the student (status:course-passed-or-withdrawn): the status lapses at once.

**abroad-money:remit-sends-money-home** `wallet/remit` sends money home: `amount` in a foreign currency from that currency's bank pocket, through a `channel`: `app` (fee `tuning.remit.appFeeBp` of the amount, paid out in naira to the home bank pocket at the official rate less `tuning.remit.appMarginBp`; documented), `bank` (fee `tuning.remit.bankFeeBp`, official rate, documented, arrives next month), or `informal` (no fee, the street rate, paid as cash at home, and a `tuning.remit.informalLossBp` chance on stream `street` that it does not arrive at all). The pound leg is a debit with the reason `remit`, the fee `remit-fee`. Family requests abroad are paid this way: their `money/take` reads the home naira pockets, so money must be sent before a request can be met. The naira that arrives at home is credited under the reason `remit`, the same reason the foreign money leaves under, so the ledger reads it as a transfer and a goal can read the total sent (wallet:ledger-total-requirement). The Bank shows what lands in naira per channel and the family's naira at home.

**abroad-money:family-asks-more-abroad** Family requests while abroad are the home ones with `abroadBp` applied to their amounts (the family expects more once a relative is abroad), and `obligation.home-support` reopens at the scenario's amount times the same factor, in naira, if the starting life had one.

**abroad-money:remit-quote-is-shared** The view's `pockets` and `rates` carry every currency. The view has no `remit` field: the screen gets the quote from the pure function `remitQuote(rates, tuning.remit, currency, amount)` in `wallet.logic.ts`, the same one `wallet/remit` uses, which gives for each channel the fee and what ₦ arrives for the amount typed, so the choice is made with the numbers in front of the player. The Bank's chooser never offers more than the bank holds (shares of the balance).

## Entries

| Id | Values |
|---|---|
| `country.uk` money | currency GBP; `taxFreeLine` 1257000 pence; `taxBp` 2800 (20% tax plus 8% national insurance in the basic band); upkeep £15 a month, the phone's pay as you go (`obligation.upkeep-uk` 1500 pence; abroad-money:arrival-opens-upkeep-and-room); `rent-room` £670 (67000); `rent-flat` £950 (95000), deposit one month, creditMin 20; `phone` £25 a month (2500), no fixed term, creditMin 10 |
| `country.canada` money | CAD; `taxFreeLine` 1600000 cents; `taxBp` 2500; upkeep C$30 a month, the prepaid phone (`obligation.upkeep-canada` 3000 cents; abroad-money:arrival-opens-upkeep-and-room); `rent-room` C$900 (90000); `rent-flat` C$1,700 (170000); `phone` C$45 (4500) |
| `country.uae` money | AED; no tax; upkeep AED 50 a month, the prepaid phone (`obligation.upkeep-uae` 5000 fils; abroad-money:arrival-opens-upkeep-and-room); accommodation is the employer's: no rent while `status.gulf-worker` is held; `rent-room` AED 1,200 (120000) for anyone else |
| `country.italy` money | EUR; cash work only; upkeep €10 a month, the prepaid phone (`obligation.upkeep-italy` 1000 cents; abroad-money:arrival-opens-upkeep-and-room); `rent-room` €350 (35000) |
| `obligation.rent-cash-room-uk` | type `rent`, GBP, £840 a month (84000 pence), a quarter above the shared room, working value; paid from `any` pocket, cash first; `reportsToCredit` false; opened only by abroad-money:right-to-rent-check |
| `obligation.tuition` | type `tuition`, GBP, principal the tuition less deposit and discount, term 3, `everyMonths` 3, grace 1, sink `fee-school`; onDefault: status lapses |
| Start rates | CAD 97000 kobo (₦970), AED 36255 (₦362.55), EUR 155800 (₦1,558) at tick 0, from the dollar rate of ₦1,331.50 and cross rates of 7 Oct 2026 |

## Numbers

| Setting | Value | Date | In content as |
|---|---|---|---|
| UK personal allowance | £12,570 | 2026/27 | `country.uk.taxFreeLine` |
| UK basic rate plus employee national insurance | 20% + 8% | 2026/27 | `country.uk.taxBp` 2800 |
| UK room rent outside London | £668 a month | SpareRoom Q1 2026 | `rent-room` 67000 |
| UK one-bed flat outside London | £950 | Working value | `rent-flat` 95000 |
| Canada tax, flat working band | 25% above C$16,000 | Working value for Ontario at these incomes | `country.canada.taxBp` 2500 |
| App remittance fee and margin | 0% fee, 2% margin on the rate | Lemfi, Wise and others, 2026 | `tuning.remit.appFeeBp` 0, `appMarginBp` 200 |
| Bank remittance fee | 8% | World Bank average for $200, 2025 | `tuning.remit.bankFeeBp` 800 |
| Informal channel loss chance | 5% | Working value | `tuning.remit.informalLossBp` 500 |
| Naira-only payout at the official rate | From 1 May 2026 | CBN | the app and bank channels pay naira at the official rate; the informal one pays cash at the street rate |
| Family requests abroad | amounts times 3 | Working value from the remittance survey: 58% send £100 to £500 a month | `tuning.remit.abroadBp` 30000 |
| Tuition instalments | 3 | Universities cut instalments from seven to three in 2024 | `obligation.tuition.term` 3 |

## Sources

All read on 7 Oct 2026.

- [SpareRoom rental index, Q1 and Q2 2026](https://www.spareroom.co.uk/rentalindex)
- [ACCA: income tax thresholds 2026/27](https://www.accaglobal.com/uk/en/technical-activities/technical-resources-search/2025/November/Income-tax-thresholds.html), [LITRG: employee national insurance](https://www.litrg.org.uk/working/employment/nic-employees)
- [AllAfrica: CBN naira-only payouts from 1 May 2026](https://allafrica.com/stories/202603260150.html), [TechEconomy: what the naira-only policy means](https://techeconomy.ng/what-cbn-naira-only-remittance-policy-means)
- [nairaCompare: sending money from the UK to Nigeria](https://nairacompare.ng/send-money/from-uk-to-nigeria)
- [Condia: UK to Nigeria remittance survey 2025](https://thecondia.com/ohentpay-nigerians-in-the-uk-remittance-report-2025/)
- [BBC via Graphic: students withdrawn after missed instalments](https://www.graphic.com.gh/international/international-news/crisis-hit-university-students-ordered-to-leave-uk.html)

## Not verified

- Canada rents and tax are working values, not drawn from a 2026 source. Dubai upkeep likewise.
- The informal channel's loss chance has no source: it stands for the short count and the vanished collector.
