# Health, locked slots and forced months

> Prices are the real ones at the dates given, as working values.
> Kinds: `quality`, `offer`, `turn` (turn:slots-can-be-locked locks), `activity`. No kind of its own.

Being run down has a cost, and the choice when you fall ill is the real one: the hospital, the chemist, or ignore it.

## Rules

**health:low-wellbeing-warns-first** When `quality.wellbeing` has been under `tuning.health.runDownBelow` at the `month` phase of two months in a row, the quality kind gives the line `line.quality.run-down` with attention. It is the warning; nothing else happens yet.

**health:illness-rolls-when-run-down** From the month after the warning, while wellbeing stays under the line, each `come-up` phase rolls `offer.illness` with `tuning.health.illnessBp` on stream `health`. It lapses after one month into `ignore`. Its choices: `hospital` pays `tuning.health.hospital` (consultation, tests, drugs; reason `mishap`), locks one slot for one month (bed rest) and heals: wellbeing +20. `chemist` pays `tuning.health.chemist`, wellbeing +8, and `tuning.health.relapseChemistBp` chance that `offer.illness-worse` opens next month. `ignore` locks one slot for one month, wellbeing -15, and `tuning.health.relapseIgnoreBp` chance of `illness-worse`.

**health:worse-illness-locks-slots** `offer.illness-worse` has one real choice: `hospital` pays `tuning.health.hospitalWorse` (a scan and admission) and locks two slots for two months; `cannot` (when it cannot be paid) locks two slots for three months and standing -5: the family nurses you. Left unanswered it is `cannot` even when the hospital could be paid: the offer kind's lapse cannot take it then (offer:lapsed-offer-removed), so the health roll applies `cannot`'s effects in the `come-up` phase of the month it lapses. Either way wellbeing returns to 40.

**health:sick-pay-unless-sick-leave** While a slot is locked for illness, a job held is paid at `tuning.health.sickPayBp` of its pay unless the entry says `sickLeave: true` (the bank jobs and the UK jobs do; the teacher, the developer at a startup and every cash job do not). The activity kind reads the lock's reason.

**health:forced-months-spaced-apart** Illness cannot open within `tuning.health.gapMonths` of the latest month the last illness could close: the month it opened plus its time to lapse, so one answered early waits up to a month longer. Forced months of every kind (illness, a burial, a court date) are at most one in any twelve, counted from the locks' reasons. The warning always comes first.

**health:forced-months-warned-ahead** Other forced months arrive as offers that say so a month ahead: `offer.village-burial` (family: travel costs ₦60,000 and locks one slot next month; `send-money` instead costs ₦100,000 and standing -3; `absent` standing -10), and abroad `offer.court-date` (the car shortfall or an unpaid fine: a day lost, one slot locked next month). Each carries `lockNext: { slots, months, why }`, which the view reads to word the lock on the choice; the lock itself is the `turn/lock` carried by each choice that takes the slot (`go`, `attend`), so `send-money` and `absent` lock nothing.

**health:view-shows-health-warning** The view shows the warning as a banner while it stands, every lock with its reason and months left, and the illness offer's prices before the choice. The banner stands on the phone's home and above every app.

## Entries

| Id | Group | When | Chance | Choices |
|---|---|---|---|---|
| `offer.illness` | life, bad | run down (health:illness-rolls-when-run-down) | 2500 | `hospital` ₦85,000; `chemist` ₦9,000; `ignore` |
| `offer.illness-worse` | life, bad | opened by the chemist's or ignore's relapse | | `hospital` ₦180,000; `cannot` |
| `offer.village-burial` | family | at home, standing 20 or more | 150 | `go` ₦60,000 and one slot locked next month; `send-money` ₦100,000; `absent` |
| `offer.court-date` | abroad | a car shortfall or a defaulted loan abroad | 500 | `attend` one slot locked next month |

## Numbers

| Setting | Value | Date | In content as |
|---|---|---|---|
| Run down below | 30 | working value | `tuning.health.runDownBelow` |
| Illness chance a month while run down | 25% | working value | `tuning.health.illnessBp` 2500 |
| Hospital visit | ₦85,000 (consultation ₦20,000 to ₦25,000, tests, a dose of antimalarials up to ₦9,000, drugs) | late 2025 | `tuning.health.hospital` 8500000 |
| Chemist | ₦9,000 | a dose of antimalarials, 2024 | `tuning.health.chemist` 900000 |
| Worse: scan, X-ray and admission | ₦180,000 (scans and an X-ray about ₦80,000, plus a bed) | 2025 | `tuning.health.hospitalWorse` 18000000 |
| Relapse after the chemist | 35% | working value | `tuning.health.relapseChemistBp` |
| Relapse after ignoring it | 60% | working value | `tuning.health.relapseIgnoreBp` |
| Sick pay without leave | 50% | working value | `tuning.health.sickPayBp` 5000 |
| Gap between illnesses | 10 months | the cap of about one forced month a year | `tuning.health.gapMonths` |
| Health insurance | under 10% of Nigerians hold any | 2025 | why everything is paid out of pocket |

## Sources

- [BusinessDay: out-of-pocket medical bills](https://businessday.ng/news/article/out-of-pocket-medical-bills-derail-health-insurance-reforms/)
- [The Rio Times: private consultation in Lagos, ₦20,000 to ₦25,000, late 2025](https://www.riotimesonline.com/healthcare-nigeria-expats-2026/)
- [Nairametrics: malaria and typhoid test costs rose over 100%, Jan 2024](https://nairametrics.com/?p=478353)
