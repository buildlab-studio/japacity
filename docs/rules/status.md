# Status abroad

> Numbers are the real ones at the dates given, as working values. Sources at the end.
> Kind: `status`. One current status per character, held only abroad. Background: `../design/01-concept.md` section 12, `../research/03-life-abroad-and-return.md`, `../research/07-status-cliffs-and-restarts.md`.
> For game design. Not immigration advice.

A status is the permission you hold abroad: what you may do, when it runs out, and what happens when the thing it hangs on goes. The route you arrived on sets the first one.

## Rules

**status:granting-a-status** The effect `status/grant` opens a status from its entry: `expiresMonth` is the current month plus the entry's `months` (null for one that does not expire), `clock` is null, `monthsHeld` is 0, `lawfulMonths` carries over from the status it replaces when the entry says `countsFromBefore`, else starts at 0. A status kept from a return with papers (return:papers-return-keeps-status) is not granted anew: it carries on with the `monthsHeld` and `lawfulMonths` it had on the day of the return. Only one status is current. Granting a new one closes the old one.

**status:status-sets-work-rule** Each status entry names its `work` rule, and the activity kind obeys it: `any` (any job), `part` (jobs marked `part: true` only, the 20-hour cap), `one-employer` (only the job named on the status; a hunt for another job is not legal), `cash` (only activities marked `cash: true`), `none`.

**status:lost-job-starts-clock** On a `one-employer` status, losing the job (the effect `activity/end-job`, whatever its cause) starts the clock: `clock` is set to the entry's `clockMonths`. Starting a job that the status allows clears the clock. In the `clocks` phase a clock at zero lapses the status (status:overstayer-risks-detection). The status clock shows on the phone's home and above every app.

**status:expiry-lapses-or-moves-on** In the `clocks` phase a status whose `expiresMonth` has come lapses unless its entry names a `next` status whose `nextIf` requirements hold now, in which case `status/grant` for `next` is applied instead. The student becomes a graduate this way, and the graduate route runs out this way.

**status:overstayer-risks-detection** A lapsed status is replaced by the country's `overstayer` status. It allows cash work only, carries no expiry, and has a detection chance each month in the `clocks` phase on stream `status`. Detection applies `status/remove`.

**status:renewing-a-status** The command `status/renew` is accepted while the current status is in force, its entry has `renewMonths` above zero, and the renewal fee and the surcharge for the renewal period can be paid as foreign fees (wallet:foreign-fee-payment-order) with the reasons `fee-visa` and `fee-surcharge`. It extends `expiresMonth` by `renewMonths`. A `one-employer` status renews only while the job is held. A status whose entry has `renewBp` (the Gulf contract) is renewed by the employer, not the player. In the contract's last month a draw on the `status` stream at `renewBp` extends `expiresMonth` by `renewMonths` with no fee and a report line; `status/renew` stays refused for it, and a lost draw lets it lapse.

**status:lawful-months-reach-settlement** `lawfulMonths` goes up by one in the `month` phase while a status that `countsToSettlement` is held. When it reaches the country's settlement months (`var.uk-settle-months`, `var.canada-settle-months`) and the settlement fee can be paid, the effect `status/grant` for the country's settled status is applied in the `clocks` phase, and the fee is taken. A settled status never expires. After the citizenship months on the settled status, the citizen status is granted the same way with its fee.

**status:removal-sends-home-banned** The effect `status/remove` records a removal with the `banMonths` of the country's overstayer status, which bans every route into the country (place:removal-bans-the-country), and moves the character home with the effect `place/move` (to home): the character is home at once, and the return is on record with the shape `removed` (place:return-shape-decided-at-once). A character who leaves by choice while an overstayer carries no ban: the record of the overstay is enough, and the removal is the only ban.

**status:gulf-status-holds-passport** A `gulf-worker` status holds the passport (its entry's `holdsPassport` is true): while the status is current, routes that need the passport cannot proceed, and `return/home` asks the fare alone, whether the contract has ended or not. There is no document state for a held passport (a document is only `pending`, `held` or `expired`); the code reads the hold with `passportHeldByEmployer` in `status.logic.ts`, which the passport requirement in `document.logic.ts` reads. Leaving the employer's job does not start a clock; it lapses the status at once to `uae-irregular`.

**status:view-shows-status** The view shows the current status: its entry, months left (null for none), the clock if running, lawful months and the settlement months they count toward, what work it allows, a `nextStep` key naming the way up, and `renew`: what `status/renew` would cost today (`months`, `currency`, `fee`, `surcharge`, from the world's variables), null when the status does not renew at the player's asking (status:renewing-a-status). It never shows the detection chance.

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
| `status.canada-resident` | canada | none (permanent residence) | any | none | no | `canada-citizen` after 36 lawful months in Canada and the fee | yes | 240 (needs permission to return; modelled as 20 years) |
| `status.canada-citizen` | canada | none | any | | | | | |
| `status.canada-overstayer` | canada | none | cash | | | | no | 240 |
| `status.gulf-worker` | uae | 24 | one-employer | none: lapses at once | 24 months by the employer's choice (a draw) | none | no | 60 |
| `status.uae-irregular` | uae | none | cash | | | | no | 60 |
| `status.eu-irregular` | italy | none | cash | | | | no | 120 |

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
| UK removal ban | 10 years | Right to Remain, 2026 | `banMonths` 120 |
| UAE grace after cancellation | 60 days | Sep 2024 rule | modelled inside the 24-month contract; the Gulf status lapses at once on leaving the job |
| Detection chance, overstayer, a month | 3% UK and Canada, 6% UAE, 4% Italy | Working values | `detectBp` 300, 300, 600, 400 |
| Student work cap | 20 hours a week in term | gov.uk | `work: part` |
| Months of student status for the course to count as passed | 12 | A one-year master's | `tuning.status.courseMonths` |

## What the player should feel

- The student's clock is the course. The graduate's clock is the hunt for a sponsor. The sponsored worker's clock only starts when the job goes, and then it is two months.
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

## Not verified

- The Canada citizenship fee of C$630 is from memory of the IRCC fee page and must be checked before tuning.
- Detection chances are working values with no source. They set how long an overstayer lasts: about 33 months in the UK on average at 3%.

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `status/grant` | effect | Grants a status, with the job it is tied to when given; with `kept`, the months held and lawful months a status kept from a return with papers carries on with (status:granting-a-status, return:papers-return-keeps-status) |
| `status/lose` | effect | Lapses the status abroad, to the overstayer (status:overstayer-risks-detection); at home it closes the status with nothing after it; an overstayer is left as it is |
| `status/remove` | effect | A removal: recorded, and the character sent home with the shape `removed` (status:removal-sends-home-banned) |
| `status/clock-start` | effect | Starts the clock on a one-employer status, or lapses at once one that `lapsesAtOnce` (status:lost-job-starts-clock, status:gulf-status-holds-passport) |
| `status/is` | requirement | The current status is one of `statuses` |
| `status/clock-under` | requirement | A status is held whose clock is running and under `months` |
