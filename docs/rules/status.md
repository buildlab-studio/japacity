# Status abroad

> Numbers are the real ones at the dates given, as working values. Where the game differs from real life, the real value and the factor stand beside it. Sources at the end.
> Kind: `status`. One current status per character, held only abroad. Background: `../design/01-concept.md` section 12, `../design/12-overstaying.md`, `../research/03-life-abroad-and-return.md`, `../research/07-status-cliffs-and-restarts.md`.
> For game design. Not immigration advice.

A status is the permission you hold abroad: what you may do, when it runs out, and what happens when the thing it hangs on goes. The route you arrived on sets the first one.

## Rules

**status:granting-a-status** The effect `status/grant` opens a status from its entry: `expiresMonth` is the current month plus the entry's `months` (null for one that does not expire), `clock` is null, `monthsHeld` is 0, `lawfulMonths` carries over from the status it replaces when the entry says `countsFromBefore`, else starts at 0. A status kept from a return with papers (return:papers-return-keeps-status) is not granted anew: it carries on with the `monthsHeld` and `lawfulMonths` it had on the day of the return. Only one status is current. Granting a new one closes the old one.

**status:status-sets-work-rule** Each status entry names its `work` rule, and the activity kind obeys it: `any` (any job), `part` (jobs marked `part: true` only, the 20-hour cap), `one-employer` (only the job named on the status; a hunt for another job is not legal), `cash` (only activities marked `cash: true`), `none`.

**status:lost-job-starts-clock** On a `one-employer` status, losing the job (the effect `activity/end-job`, whatever its cause) starts the clock: `clock` is set to the entry's `clockMonths`. Starting a job that the status allows clears the clock. In the `clocks` phase a clock at zero lapses the status (status:overstayer-risks-detection). The status clock shows on the phone's home and above every app.

**status:expiry-lapses-or-moves-on** In the `clocks` phase a status whose `expiresMonth` has come lapses unless its entry names a `next` status whose `nextIf` requirements hold now, in which case `status/grant` for `next` is applied instead. The student becomes a graduate this way, and the graduate route runs out this way.

**status:overstayer-risks-detection** A lapsed status is replaced by the country's `overstayer` status. It allows cash work only and carries no expiry. However it is granted (a lapse, or the road's arrival, road:sea-arrival-in-italy), the slice records the month it began as `overstaySince`. Its first months are the grace (status:grace-before-overstaying). After the grace, while no notice stands (status:detection-gives-notice) and no application made in country is pending (status:grace-allows-in-country-applications, person:partner-route-in-country), each month in the `clocks` phase draws detection on stream `status` at the entry's `detectBp`, plus `tuning.ladder.cashDetectBp` in a month with cash work (ladders:cash-jobs-paid-in-hand). Detection gives a notice; it never removes at once.

**status:grace-before-overstaying** The grace. Through the month that is `overstaySince` plus the entry's `graceMonths` (the UK 1, Canada 3, the UAE 1, Italy 0), the character is not yet overstaying: no detection is drawn, no hardship of the overstay applies (abroad-money:right-to-rent-check, status:overstayer-hospital-charged, status:uae-fine-accrues), and a return home at the character's own fare carries no ban (place:leaving-an-overstay-bans). An application sent in country during the grace holds it: while that application is pending the grace does not end, and after a refusal it ends at that month's end. Real: in the UK an application made within 14 days of permission ending, with a good reason, is treated as no overstay (Part Suitability SUI 13.1), and an overstay of 30 days or less is disregarded for someone who leaves at their own expense (SUI 11.5); the game's month asks no reason, about twice as kind for applying and the same for leaving. Canada restores a lost status within 90 days; the game's 3 months ask no restoration fee.

**status:grace-allows-in-country-applications** In the grace, three ways stay open from inside the country, with no flight. A job marked `sponsor: true` may be hunted, which the cash work rule otherwise refuses, and a hire grants its status as ladders:sponsor-job-ties-status says. A route known into the country may be applied for in country: the master's again (route:lapsed-route-known-again), with a new school's offer and deposit, `activity.apply-to-school` and `activity.apply-for-visa` being legal in that country while the grace holds and the TB certificate not asked. And a partner or dependant route on a bond whose sponsor or lead holds a qualifying status (person:partner-gate-needs, person:dependant-gate-needs). A grant on such an application switches the status in country (route-gates:in-country-grant-switches-status). After the grace, only the partner route stays open in country (person:partner-route-in-country).

**status:detection-gives-notice** Detection records a notice: `noticeUntil` is the month plus the entry's `noticeMonths` (the UK 3, Canada 1, the UAE 1, Italy 1), told as a line with attention. While a notice stands no further detection is drawn, and every way out stays open: home at the character's own fare, the returns service where the country has one (place:returns-service-takes-you-home), the assisted return, and the partner route in country (person:partner-route-in-country). The notice is the UK's notice of liability for removal, Canada's departure order and Italy's expulsion order with its days to leave. Real: removal may follow a UK notice at any time, with no set window; Canada's departure order gives 30 days and Italy's order 7 to 30 (D.lgs. 286/1998, Art. 13 c.5). The game's three months in the UK are kinder; one month in Canada and Italy is about the real time.

**status:notice-ends-in-removal** In the `clocks` phase of the month `noticeUntil`, a character still on the overstayer status in that country is removed (`status/remove`, status:removal-sends-home-banned), unless an application made in country is pending: then the notice holds until it is decided, and after a refusal it ends at the next month's end. Any `status/grant` clears the notice. Removal is the last case, never the first.

**status:overstay-counts-as-refusal** An overstay goes on the record of the country it was in. Each return home from an overstayer status past the grace, and each removal, counts as one earlier refusal in the decision draw of every later application into that country (route:visa-refusal-chance, route-gates:gate-decision-draw-terms, person:partner-application-decided, person:dependant-application-decided). Real: an earlier breach of the rules is a ground for refusal at the officer's discretion; the game always counts it, once for each overstay.

**status:overstayer-hospital-charged** In the UK, past the grace, the `hospital` answers of health:illness-rolls-when-run-down and health:worse-illness-locks-slots cost `tuning.status.hospitalChargeBp` (15,000) of their figure. The chemist and ignoring it cost what they cost. Real: hospital care is charged at 150% of the NHS tariff to someone with no permission, while A&E and the GP stay free; the game applies the real 150% to its own hospital figure, which is far below an NHS tariff.

**status:uae-fine-accrues** The UAE's fine. Each month past the grace on `status.uae-irregular`, in the `clocks` phase, the slice's `fine` grows by the entry's `finePerMonth` (AED 1,500, the real AED 50 a day). A return home at the character's own fare from the UAE asks the fine with the fare (place:return-home-paid-or-assisted), paid from the same pockets as the fare with the reason `fine`. An assisted return or a removal leaves it owing: it opens `obligation.uae-fine-home` in naira at the day's official rate (type `loan`, 12 months, no interest, sink `loan-repay`), which follows the character home as the car's shortfall does (return:return-reopens-home-charges). Real: the fine must be paid before leaving, and an unpaid one bars coming back; the game lets the assisted return carry it home as a debt.

**status:uae-amnesty** The amnesty. While `var.uae-amnesty` is 1 (the director's story `news.uae-amnesty`), a return from `status.uae-irregular` asks no fine and clears it, carries no ban (place:leaving-an-overstay-bans), and detection is not drawn. Real: the amnesty of 1 Sep to 31 Dec 2024 let overstayers leave or put their papers right with no fines and no entry ban.

**status:renewing-a-status** The command `status/renew` is accepted while the current status is in force, its entry has `renewMonths` above zero, and the renewal fee and the surcharge for the renewal period can be paid as foreign fees (wallet:foreign-fee-payment-order) with the reasons `fee-visa` and `fee-surcharge`. It extends `expiresMonth` by `renewMonths`. A `one-employer` status renews only while the job is held. A status whose entry has `renewBp` (the Gulf contract) is renewed by the employer, not the player. In the contract's last month a draw on the `status` stream at `renewBp` extends `expiresMonth` by `renewMonths` with no fee and a report line; `status/renew` stays refused for it, and a lost draw lets it lapse.

**status:lawful-months-reach-settlement** `lawfulMonths` goes up by one in the `month` phase while a status that `countsToSettlement` is held. When it reaches the country's settlement months (`var.uk-settle-months`, `var.canada-settle-months`) and the settlement fee can be paid, the effect `status/grant` for the country's settled status is applied in the `clocks` phase, and the fee is taken. A settled status never expires. After the citizenship months on the settled status, the citizen status is granted the same way with its fee.

**status:removal-sends-home-banned** The effect `status/remove` records a removal with the `banMonths` of the country's overstayer status, which bans every route into the country (place:removal-bans-the-country), and moves the character home with the effect `place/move` (to home): the character is home at once, and the return is on record with the shape `removed` (place:return-shape-decided-at-once). Removal comes only at the end of a notice (status:notice-ends-in-removal). A character who leaves an overstay any other way carries the ban place:leaving-an-overstay-bans gives, which is never longer than the removal's.

**status:gulf-status-holds-passport** A `gulf-worker` status holds the passport (its entry's `holdsPassport` is true): while the status is current, routes that need the passport cannot proceed, and `return/home` asks the fare alone, whether the contract has ended or not. There is no document state for a held passport (a document is only `pending`, `held` or `expired`); the code reads the hold with `passportHeldByEmployer` in `status.logic.ts`, which the passport requirement in `document.logic.ts` reads. Leaving the employer's job does not start a clock; it lapses the status at once to `uae-irregular`.

**status:view-shows-status** The view shows the current status: its entry, months left (null for none), the clock if running, lawful months and the settlement months they count toward, what work it allows, a `nextStep` key naming the way up, and `renew`: what `status/renew` would cost today (`months`, `currency`, `fee`, `surcharge`, from the world's variables), null when the status does not renew at the player's asking (status:renewing-a-status). On an overstayer status it carries `overstay`: `graceLeft` (the months of grace left counting the month in play, so 1 in the grace's last month and 0 once past it), `noticeLeft` (the months a notice has left, null with none), `fine` (the UAE's fine owed, null elsewhere) and `pending` (whether an application made in country holds the grace or the notice); null on any other status. It never shows the detection chance.

## Entries

| Id | Country | Months | Work | Clock on job loss | Renew | Next, if | Counts to settlement | Ban on removal |
|---|---|---|---|---|---|---|---|---|
| `status.uk-student` | uk | 16 (a one-year course, plus four months) | part | none | no | `uk-graduate` if the course is passed (status:course-passed-or-withdrawn) and `var.uk-graduate-months` above 0 | no | 120 |
| `status.uk-graduate` | uk | `var.uk-graduate-months` (24 until the tick the shortening story comes into force, then 18) | any | none | no | `uk-sponsored` is reached by a sponsor route, not by this clock | no | 120 |
| `status.uk-sponsored` | uk | 36 | one-employer | 2 (60 days) | 24 months at `var.uk-skilled-renew-fee` | none | yes | 120 |
| `status.uk-talent` | uk | 60 | any | none | no | none | yes, at `var.uk-talent-settle-months` 36 | 120 |
| `status.uk-settled` | uk | none | any | none | no | `uk-citizen` after 12 months and the fee | | |
| `status.uk-citizen` | uk | none | any | | | | | |
| `status.uk-overstayer` | uk | none | cash | | | | no | 120 |
| `status.canada-resident` | canada | none (permanent residence) | any | none | no | `canada-citizen` after 36 lawful months in Canada and the fee | yes | 120, then the authorisation to return (route-gates:canada-return-asks-authorisation) |
| `status.canada-citizen` | canada | none | any | | | | | |
| `status.canada-overstayer` | canada | none | cash | | | | no | 120, then the authorisation to return |
| `status.gulf-worker` | uae | 24 | one-employer | none: lapses at once | 24 months by the employer's choice (a draw) | none | no | 60 |
| `status.uae-irregular` | uae | none | cash | | | | no | 60 |
| `status.eu-irregular` | italy | none | cash | | | | no | 36 |

### Entries: overstaying, country by country

The fields of each country's overstayer status (status:grace-before-overstaying to status:uae-amnesty, place:leaving-an-overstay-bans, place:returns-service-takes-you-home, abroad-money:right-to-rent-check). Every status of a country carries the country's `banMonths` and `detectBp`, as today; the other fields are read on the overstayer only.

| Field | `status.uk-overstayer` | `status.canada-overstayer` | `status.uae-irregular` | `status.eu-irregular` |
|---|---|---|---|---|
| `graceMonths` | 1 | 3 | 1 | 0 (the road arrives with no papers) |
| `detectBp`, a month | 100 | 100 | 200 | 100 |
| `noticeMonths` | 3 | 1 (the departure order) | 1 | 1 (the expulsion order) |
| `ownFareBanMonths`, home at your own fare after the grace | 12 | 0 | 12 (the labour ban) | 0 |
| `assistedBanMonths`, the assisted return or the returns service | 24 | 12 (the exclusion order) | 12 (the labour ban) | 0 (the assisted scheme suspends the order) |
| `banMonths`, removal | 120 | 120, then the authorisation | 60 | 36 |
| `rentCheckBp`, a month | 1500 | 0 | 0 | 0 |
| `returnGrant` | £1,500 (150000 pence) | none | none | none |
| `finePerMonth` | none | none | AED 1,500 (150000 fils) | none |

**status:course-passed-or-withdrawn** The course is passed when, at the student status's expiry, the character held the student status for at least `tuning.status.courseMonths` (12) months and the tuition obligation was never in default. A student whose tuition defaulted is withdrawn: the status lapses at once (the Teesside case, May 2024).

**status:one-renewability-test** One test says whether a status may be renewed at the player's asking, and both `status/renew` and the view's `renew` (status:view-shows-status) read it: the status renews (`renewMonths` above 0, an expiry month, a `renewFeeVar`); a one-employer status is held with its job (status:renewing-a-status); and a status tied to a partner has a bond at `partner` or `married` whose sponsor meets the floor (person:partner-status-renews). Where it refuses, the view's `renew` is null, so terms show only where the renewal would be taken.

## Numbers

| Setting | Value | Date | In content as |
|---|---|---|---|
| UK sponsored worker clock | 60 days, 2 turns | In force 2026 | `status.uk-sponsored.clockMonths` = 2 |
| UK graduate visa length | 24 months, 18 from applications on or after 1 Jan 2027 | gov.uk, Oct 2026 | `var.uk-graduate-months` start 24; the director's story sets 18 |
| UK settlement months | 60 (five years); a proposed 120 arrives as a story | Rules in force Oct 2026; proposal consulted Feb 2026 | `var.uk-settle-months` start 60 |
| UK talent settlement months | 36 | gov.uk | `var.uk-talent-settle-months` start 36 |
| UK settlement fee | £3,226 | 8 Apr 2026 | `var.uk-settle-fee` = 322600 pence |
| UK citizenship fee | £1,709, including the ceremony | 8 Apr 2026 | `var.uk-citizen-fee` = 170900 |
| UK skilled worker extension fee, over 3 years | £1,865 | 8 Apr 2026 | `var.uk-skilled-renew-fee` = 186500 |
| Gulf contract renewed by the employer | 60 in 100 | working value | `status.gulf-worker.renewBp` = 6000 |
| UK health surcharge, workers | £1,035 a year | In force | `var.uk-surcharge-year` = 103500 |
| UK health surcharge, students | £776 a year | In force since Feb 2024 | included in `var.uk-surcharge` as the 1.5-year sum |
| Canada citizenship presence | 1,095 days in five years, modelled as 36 lawful months | IRCC, 2026 | `var.canada-settle-months` start 36 |
| Canada citizenship fee | C$630 | IRCC | `var.canada-citizen-fee` = 63000 cents |
| UK refusal periods after an overstay | Real: none after 30 days or less at your own expense; 12 months at your own expense after that; 2 years at public expense within 6 months of a notice, 5 years later; 10 years removed; 10 years for deception. The game: none in the grace, 12, 24 (always the shorter public-expense period), 120 | Part Suitability SUI 11.5 and 12.1, in force from 11 Nov 2025 | `status.uk-overstayer` `ownFareBanMonths` 12, `assistedBanMonths` 24, `banMonths` 120 |
| UK grace | Real: an application within 14 days with a good reason (SUI 13.1), leaving within 30 days at your own expense (SUI 11.5). The game: 1 month, no reason asked; about twice as kind for applying, the same for leaving | Part Suitability, 2026 | `status.uk-overstayer.graceMonths` 1 |
| UK notice before removal | Real: none set; removal may follow the notice of liability at any time. The game: 3 months, kinder | Home Office enforcement practice | `status.uk-overstayer.noticeMonths` 3 |
| Detection, a month | Real: about 9,914 enforced returns from the UK in 2025 against 700,000 to 900,000 people without papers (the 2017 estimate), about 1% to 1.5% a year. The game: 1% a month, about 11% a year, about 8 times real, so the risk is felt; UAE 2%, working value; Canada and Italy 1%, working values | gov.uk immigration statistics, year ending Dec 2025; Pew estimate via Full Fact | `detectBp` 100, 100, 200, 100 |
| UK returns service | Real: the ticket for someone who cannot pay, and up to £3,000 to restart. The game: the ticket for anyone who asks and £1,500, half the most, paid at once | gov.uk, return home voluntarily, Oct 2026 | `status.uk-overstayer.returnGrant` 150000 pence |
| UK right to rent | Real: landlords in England must check; fines up to £10,000 an occupier, £20,000 for a repeat (2024). No figure for how often an overstayer's room ends. The game: 15% a month, working value | Immigration Act 2014; the 2024 Maximum Penalty Order | `status.uk-overstayer.rentCheckBp` 1500 |
| UK hospital charge | Real: 150% of the NHS tariff, A&E and the GP free. The game: 150% of its own hospital figure | NHS charges to overseas visitors, 2017 amendment (not reconfirmed for 2026) | `tuning.status.hospitalChargeBp` 15000 |
| Canada grace | Real: restoration within 90 days at C$246.25 plus the permit's fee (C$155 for a work permit). The game: 3 months and no fee, since no Canadian route in the game is a temporary permit | IRCC restoration manual and fee list | `status.canada-overstayer.graceMonths` 3 |
| Canada leaving and removal | Real: a departure order obeyed within 30 days brings no bar; an exclusion order bars 1 year; a deportation order bars for good unless an Authorisation to Return is granted (C$492.50, after repaying C$3,840 of removal costs). The game: no ban at your own fare, 12 months assisted, 120 months removed and then the two fees, certain, where real life is permanent and discretionary | canada.ca, who needs an Authorization to Return; IRPR s. 243; removal costs from 1 Apr 2025 | `status.canada-overstayer` `ownFareBanMonths` 0, `assistedBanMonths` 12, `banMonths` 120; `var.canada-arc-fee` 49250, `var.canada-removal-cost` 384000 cents |
| UAE grace after cancellation | 60 days | Sep 2024 rule | modelled inside the 24-month contract; the Gulf status lapses at once on leaving the job |
| UAE grace after leaving the job | Real: an absconding report can follow 7 days' absence. The game: 1 month, kinder | u.ae | `status.uae-irregular.graceMonths` 1 |
| UAE overstay fine | AED 50 a day, so AED 1,500 a month (factor 1.0) | Gulf News, on the unified fine | `status.uae-irregular.finePerMonth` 150000 fils |
| UAE labour ban | Real: a new work permit is barred for one year after an absconding report, from the day the worker leaves. The game: 12 months on routes into the UAE, the Gulf contract being the only one | u.ae, banning a new work permit for one year | `status.uae-irregular` `ownFareBanMonths` 12, `assistedBanMonths` 12 |
| UAE amnesty | No fines and no entry ban, 1 Sep to 31 Dec 2024 (four months) | The National, 1 Nov 2024 | `news.uae-amnesty`, `var.uae-amnesty` |
| UAE removal ban | 5 years, working value | not verified | `status.uae-irregular.banMonths` 60 |
| Italy expulsion | Real: 7 to 30 days to leave by choice; a re-entry ban of 3 to 5 years, which can be revoked on proof of leaving in time; an assisted return suspends the order. The game: 1 month; no ban for leaving in it; 36 months removed, the real minimum | D.lgs. 286/1998, Art. 13 c.5 and c.14, Art. 14-ter | `status.eu-irregular` `noticeMonths` 1, `banMonths` 36 |
| Student work cap | 20 hours a week in term | gov.uk | `work: part` |
| Months of student status for the course to count as passed | 12 | A one-year master's | `tuning.status.courseMonths` |
| A partner status granted in country to an overstayer settles at | 120 months, the real ten-year partner route (factor 1.0) | Appendix FM, EX.1 and the ten-year route | `tuning.status.overstayPartnerSettleMonths` 120 (person:partner-route-in-country) |

## What the player should feel

- The student's clock is the course. The graduate's clock is the hunt for a sponsor. The sponsored worker's clock only starts when the job goes, and then it is two months.
- Losing status is not the end. The grace month is the last door from inside: a new sponsor, a partner, a new course. After it, life gets narrower (cash work, a room that can go, a dear hospital), and the ways out stay on the table with a price on each. Removal comes last, after a notice, and only for someone who chose nothing.
- Settlement is a long bar that can be moved by the world: the ten-year story, when it fires, doubles what is left for anyone not yet settled. Applications already granted keep their rules (fairness rule 3).

## Sources

All read on 7 Oct 2026.

- [GOV.UK: Graduate visa](https://www.gov.uk/graduate-visa), length 2 years to 31 Dec 2026 and 18 months from 1 Jan 2027
- [Davidson Morris: Graduate Route reducing to 18 months](https://www.davidsonmorris.com/graduate-route-reduced-to-18-months/)
- [Davidson Morris: ILR fees 2026](https://www.davidsonmorris.com/ilr-fees/) and [Thorntons: fee increases from 8 April 2026](https://www.thorntons-law.co.uk/knowledge/home-office-immigration-fee-increases-from-8-april-2026-key-changes-for-applicants-and-sponsors)
- [Penningtons: earned settlement consultation](https://www.penningtonslaw.com/insights/earned-settlement-consultation-closes-where-we-stand/)
- [IRCC: physical presence requirements](https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/canadian-citizenship/grant/residence/physical-presence-intent-reside-requirements.html)
- [LSE: working on a visa](https://info.lse.ac.uk/current-students/immigration-advice/Working-on-a-visa-in-the-UK)
- [Chambers: the UK 60-day rule](https://chambers.com/articles/i-lost-my-job-on-a-skilled-worker-visa-the-60-day-rule-explained)
- [Right to Remain: re-entry bans](https://righttoremain.org.uk/refusal-of-entry-to-the-uk-and-re-entry-bans/)
- [Abu Dhabi Police: domestic worker law, two-year contracts](https://adpolice.gov.ae/en/Media-Center/News/2021/06/19/New-law-on-domestic-workers-from-April-)

Read on 23 Oct 2026, for overstaying (`../research/07-status-cliffs-and-restarts.md`, `../research/03-life-abroad-and-return.md` section 2):

- [GOV.UK: Immigration Rules, Part Suitability](https://www.gov.uk/guidance/immigration-rules/immigration-rules-part-suitability), SUI 11.5, 12.1 and 13.1
- [Home Office: mandatory refusal periods](https://assets.publishing.service.gov.uk/media/6971ff98a1311bdcfa0ed899/Mandatory_refusal_period.pdf)
- [GOV.UK: return home voluntarily](https://www.gov.uk/return-home-voluntarily)
- [GOV.UK: UK and Nigeria partnership to speed up removals, Mar 2026](https://www.gov.uk/government/news/new-uk-nigeria-partnership-to-speed-up-removals)
- [Canada.ca: who needs an Authorization to Return to Canada](https://www.canada.ca/en/immigration-refugees-citizenship/services/admissibility-enforcement/authorization-return-canada/who-needs-authorization.html)
- [IRCC: fee list](https://ircc.canada.ca/english/information/fees/fees.asp)
- Gulf News on the UAE's unified overstay fine; u.ae on the one-year ban on a new work permit; The National, 1 Nov 2024, on the amnesty (named, not linked)
- D.lgs. 286/1998, Art. 13 c.5 and c.14 and Art. 14-ter, read through Brocardi (named, not linked)

## Not verified

- The Canada citizenship fee of C$630 is from memory of the IRCC fee page and must be checked before tuning.
- Detection chances are working values set against the UK's enforced returns. At 1% a month an overstayer who does nothing is noticed after about 100 months on average, about 50 with cash work every month; the notice then gives three months more.
- The UK hospital charge rests on sources from 2016 to 2018, not reconfirmed against gov.uk in 2026. The UAE's grace periods conflict between sources (0, 10 or 30 days); its removal ban of 60 months is a working value.
- The Canadian removal cost of C$3,840 and the authorisation fee of C$492.50 are from the research's reading of the fee list and IRPR s. 243, not from a second source.

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `status/grant` | effect | Grants a status, with the job it is tied to when given; with `kept`, the months held and lawful months a status kept from a return with papers carries on with (status:granting-a-status, return:papers-return-keeps-status) |
| `status/lose` | effect | Lapses the status abroad, to the overstayer (status:overstayer-risks-detection); at home it closes the status with nothing after it; an overstayer is left as it is |
| `status/remove` | effect | A removal: recorded, and the character sent home with the shape `removed` (status:removal-sends-home-banned); applied only at the end of a notice (status:notice-ends-in-removal) |
| `status/clock-start` | effect | Starts the clock on a one-employer status, or lapses at once one that `lapsesAtOnce` (status:lost-job-starts-clock, status:gulf-status-holds-passport) |
| `status/is` | requirement | The current status is one of `statuses`; with `grace: true`, only while that overstayer status is in its grace (status:grace-allows-in-country-applications) |
| `status/clock-under` | requirement | A status is held whose clock is running and under `months` |
