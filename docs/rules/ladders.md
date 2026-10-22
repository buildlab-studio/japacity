# Ladders: working life abroad

> Pay figures are the real ones at the dates given, as working values. Sources at the end.
> Kind: `activity`, extended with `where`, `part`, `cash`, `needsCar`, `carBonus`. Background: `../design/01-concept.md` section 12, `../research/03` sections 3 and 4.

Abroad, a month still has a main activity and two or three free slots. What is on offer depends on the status you hold and the country you are in.

## Rules

**ladders:activities-filtered-by-where** Every activity entry carries `where`. Abroad, the free slots list only entries with `where` `abroad` or `any`, and only those whose `country` is the character's or null. The status's `work` rule (status:status-sets-work-rule) decides which `main` entries may be hunted or started: `part` allows only entries marked `part`, `cash` only entries marked `cash`, `one-employer` only the job the status names.

**ladders:local-tenure-counted** Tenure abroad is counted per job as at home, and a `local` tenure total is kept: months in any job in the current country. Entries read it with the requirement `activity/local-tenure`. It is how a survival job turns into a professional one.

**ladders:cash-jobs-paid-in-hand** A job marked `cash` is paid in hand: naira by its size (wallet:money-lands-as-in-lagos: cash at or under `tuning.wallet.cashUpTo`, the bank above it), foreign cash work in cash; it reports no tax, and carries a `withheldBp` chance on stream `status` each month that the pay is not paid at all (wage theft). Cash work while holding an overstayer status raises that status's detection chance by `tuning.ladder.cashDetectBp` that month.

**ladders:car-bonus-needs-car** A job marked `carBonus` pays its bonus only while the character has the car (car:open-finance-gives-the-car). An activity marked `needsCar` is not legal without it.

**ladders:sponsor-job-ties-status** The sponsor's job is the job held on arrival. On a `one-employer` status, `activity/end-job` for any cause (the sponsor losing its licence, offer entries in `abroad`, or quitting) starts the status clock (status:lost-job-starts-clock). Hunting is legal only for jobs marked `sponsor: true`, which carry their own certificate: getting one grants a new `one-employer` status for that job.

**ladders:student-holds-one-part-job** A student may hold one `part` job. Working more is not a thing the game lets you do: the cap is the list.

## Entries: jobs abroad

| Id | Country | Pay a year | Needs | Work rule it fits | Base chance | Monthly effects | Notes |
|---|---|---|---|---|---|---|---|
| `activity.job-uk-care` | uk | the sponsor's salary (£25,000 to £29,000) | the sponsor | one-employer | by the sponsor offer | wellbeing -4, care +1 | `carBonus` £3,000 a year for the visiting round |
| `activity.job-uk-senior-care` | uk | £29,000 | care 60, 24 months in uk-care, `sponsor: true` | one-employer | 25% | wellbeing -4, standing +1 | |
| `activity.job-uk-nurse` | uk | £31,300 | `document.nmc-pin`, `sponsor: true` | one-employer | 40% | wellbeing -5, care +1, standing +2 | the band 5 nurse |
| `activity.job-uk-skilled` | uk | the sponsor's salary (£42,000 to £60,000) | the sponsor | one-employer | by the sponsor offer | wellbeing -4, tech +1 | |
| `activity.job-uk-senior-dev` | uk | £62,000 | tech 85, 24 months local, `sponsor: true` | one-employer, any | 20% | wellbeing -4, tech +1 | |
| `activity.job-uk-warehouse` | uk | £23,000 | none | any | 60% | wellbeing -5 | the survival job |
| `activity.job-uk-retail-part` | uk | £10,400 (20 hours at £12.21) | none, `part: true` | part, any | 55% | wellbeing -3 | the student job |
| `activity.job-uk-graduate` | uk | £30,000 | bachelor's and 12 months local or a master's held | any | 20% | wellbeing -3, network +1, tech +1 | the first professional job; not `sponsor: true` |
| `activity.job-uk-kitchen-cash` | uk | £10,800 (about £7 an hour on paper) | none, `cash: true` | cash | 70% | wellbeing -7, standing -1 | `withheldBp` 1500 |
| `activity.job-uk-courier-cash` | uk | £13,200 less `tuning.ladder.accountRent` £60 a week | none, `cash: true` | cash | 65% | wellbeing -8 | a rented account |
| `activity.job-canada-warehouse` | canada | C$38,000 | none | any | 60% | wellbeing -5 | |
| `activity.job-canada-care-aide` | canada | C$44,000 | care 30 | any | 45% | wellbeing -5, care +1 | counts for the care cut-off |
| `activity.job-canada-professional` | canada | C$75,000 | bachelor's, 12 months local | any | 25% | wellbeing -3, network +1 | |
| `activity.job-canada-dev` | canada | C$95,000 | tech 70, 12 months local | any | 20% | wellbeing -4, tech +1 | |
| `activity.job-gulf-guard` | uae | AED 21,600 (1,800 a month) | the agent's contract | one-employer | by the contract | wellbeing -6 | 12-hour shifts; accommodation included |
| `activity.job-gulf-cleaner` | uae | AED 14,400 (1,200 a month) | the agent's contract | one-employer | by the contract | wellbeing -6 | |
| `activity.job-italy-farm-cash` | italy | €9,600 | none, `cash: true` | cash | 70% | wellbeing -9 | where the road leaves you; `withheldBp` 2500 |

The `document.nmc-pin` is requested by `activity.nmc-tests` (uk; care 60; £1,170 as `fee-test`; wait 3 to 6 months) and never expires.

## Entries: free slots abroad

| Id | Where | Needs | Cost | Effects |
|---|---|---|---|---|
| `activity.rest` | any | | | wellbeing +12 |
| `activity.call-home` | abroad | | the phone is in upkeep | standing +3, wellbeing +2 |
| `activity.community` | abroad | | £10 / C$15 / AED 20 social | network +4, wellbeing +4. Hear of the sponsor and professional jobs: the church, the mosque, the association |
| `activity.overtime` | abroad, with a job that is not `part` | | | pay +25% of the month's pay before tax, untaxed (a cash job's to cash under `cash-work`, any other job's to the bank under `salary`), wellbeing -8 |
| `activity.job-hunt` | any | | | hunt, as at home, filtered by the status's work rule |
| `activity.learn-tech` | any | | £40 / C$60 study | tech +4, wellbeing -2 |
| `activity.study-english` | any | | £30 study | english +6, wellbeing -2 (settlement needs B2: band 60 at least) |
| `activity.nmc-tests` | uk | care 60, no pin pending | £1,170 fee-test | request `document.nmc-pin` |
| `activity.driving-test` | uk | see `car.md` | | |
| `activity.buy-car-finance` | uk | see `car.md` | the deposit | |
| `activity.rent-flat` | abroad | credit 20 | one month's rent as deposit | see `abroad-money.md` |
| `activity.phone-contract` | abroad | credit 10 | | opens the country's phone obligation (`obligation.phone-uk`, `obligation.phone-canada`) |
| `activity.send-money` | abroad | | | opens the remit sheet: the interface's name for `wallet/remit` |
| `activity.december-home-uk`, `-ca`, `-uae` | in that country, in the tick `var.season-december` is 1, not on its overstayer status | the fare both ways | the fare times the December factor, reason `fare` | standing +12, wellbeing +6; no set piece (return:december-visit-set-piece) |

## Numbers

| Setting | Value | Date | In content as |
|---|---|---|---|
| UK care worker pay | £25,000 to £29,000 | Salary bar Jul 2025; care home pay bands 2026 | `offer.sponsor-care-home` terms |
| UK band 5 nurse | £31,300 bar; NHS band 5 starts about £31,000 | 2026 | `activity.job-uk-nurse` |
| UK national living wage | £12.21 an hour, 21 and over | Apr 2025 | `activity.job-uk-retail-part` |
| UK warehouse | about £23,000 | 2026 listings | working value |
| Cash kitchen work | about £7 an hour reported, below the minimum | Reporting 2024 | `withheldBp` 1500 |
| Courier account rent | £60 a week reported | The Conversation, 2023 | `tuning.ladder.accountRent` 6000 |
| Canada warehouse | C$38,000 | Working value | |
| Gulf guard pay | AED 1,800 a month, accommodation included | 2024 to 2025 listings | `activity.job-gulf-guard` |
| NMC tests | £1,170 | NMC fee page 2026 | `activity.nmc-tests` cost 117000 |
| Cash work raises detection by | 2 points a month | Working value | `tuning.ladder.cashDetectBp` 200 |

## Sources

- [NMC: costs for nurses trained outside the UK](https://www.nmc.org.uk/registration/joining-the-register/register-nurse-midwife/trained-outside-uk/how-to-guide/check-ready/costs/)
- [The Conversation: substitute couriers in the UK](https://www.theconversation.com/im-always-delivering-food-while-hungry-how-undocumented-migrants-find-work-as-substitute-couriers-in-the-uk-201695)
- [Context: abuse in UK care jobs](https://www.context.news/socioeconomic-inclusion/long-read/soaring-abuse-in-uk-care-jobs-shatters-migrants-dreams)
- [Pakistan Bureau of Emigration: UAE guard listings](https://beoe.gov.pk/foreign-jobs/1279899/1498048/55-security-guards-required-in-united-arab-emirates-salary-1200-2267-dirham-aed)

## Not verified

- Canada pay figures and the UK warehouse figure are working values. They are set against the rents in `abroad-money.md` so a survival job leaves something over and a professional one leaves a lot.
