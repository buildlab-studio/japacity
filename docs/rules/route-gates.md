# Route gates: sponsor, points, endorsement, contract

> Numbers are the real ones at the dates given, as working values. Sources at the end.
> Kind: `route`. The study gate is `route.md`. Background: `../research/01-japa-journey.md`, `../research/02-all-routes-and-timeline.md`, `../research/03-life-abroad-and-return.md`, `../research/07-status-cliffs-and-restarts.md`.
> For game design. Not immigration advice. The sponsors, agents and employers are invented.

Every route moves through the states in `route.md`, keeps a checklist and a window, and ends in a decision draw. What differs is the **gate**: the steps between known and applying. A gate is named on the route's entry and the route kind switches on it.

## Rules shared by every gate

**route-gates:route-runs-its-gate-steps** A route entry names its `gate`: `study`, `sponsor`, `points`, `endorsement`, `contract` or `road`. The route kind runs only the steps of that gate. A command or effect belonging to another gate does nothing or is rejected with `not-legal`, with two exceptions: `route/pay-deposit` on a route with no schools is rejected with `unknown-id`, and `route/enter-pool` reads no gate, so on any known route with its window open it enters the pool and gives the route a points gate.

**route-gates:gate-decision-draw-terms** The decision draw is the one in route:visa-refusal-chance, with the route entry's own `refusalBaseBp` in place of the tuning base, and with the strictness, unexplained share, earlier refusals and good grade terms applying only where the gate says they do. Each gate below lists its terms. The floor and ceiling are shared.

**route-gates:departure-grants-status** `route/depart` on a granted route pays the flight (route:departure-pays-flight) unless the entry says `flightPaidByEmployer`, then applies `place/move` to the route's `country` and `status/grant` for the route's `status`. The life does not end.

**route-gates:route-entry-gate-block** A route entry carries `country`, `status`, `refusalBaseBp` and its gate's block: the sponsor block names the salary and maintenance vars, the find chance, the English band, the qualification documents, the strictness var, the surcharge years and the job held on arrival; the endorsement block names its document, chances, cooldown, fee var and surcharge years; the points block its table, funds, cut-off, fee and decision vars and the profile months. The application records the gate's own strictness and surcharge (route:application-fixes-figures), and the funds a route shows are the gate's own line in its own currency (the maintenance line in pence, the Canadian funds in cents; the talent and contract routes show none). Its checklist weights still add up to 100 (japacity:figure-is-whole-percent).

**route-gates:deception-bans-country** A refusal for deception (a sponsor that was a fraud, route-gates:fraud-sponsor-refused) moves every known or applying route into that country to `refused` until the month plus the country's `deceptionBanMonths`, and the ban lifts in that month with the route known again. A removal's ban (place:removal-bans-the-country) stops a route into that country being heard of or looked into, and a partner route into it being applied for, until the ban lifts; no route moves. The fraud agent's refusal (route-gates:gulf-application-needs) bans nothing.

## The sponsor gate: `route.uk-care`, `route.uk-skilled`

A sponsor is an employer abroad who holds a licence and gives you a certificate. The certificate is the thing that can be real or sold.

**route-gates:sponsor-offers-come-up** While a sponsor route is known and its window is not closed, sponsor offers come up through the offer kind: the entries in `offer.sponsor-*` with the route's `when` requirements. One may also be looked for with the slot activity `activity.find-sponsor`, which rolls one offer at once with the route entry's `sponsor.findBp` plus 20 basis points for each point of network, capped at 9500, stream `job`.

**route-gates:taking-sponsor-records-it** Taking a sponsor offer records the sponsor on the route: the offer's `salary` term (in pence a year), the employer key, and hidden whether it is a fraud (offer:opening-fixes-terms-and-fraud decides that when the offer opens). An honest sponsor costs nothing: the employer pays the certificate and the skills charge, and a sponsor that asks for money is a sign. A fraud takes its `fee` term from cash with the reason `fee-agent` and records a sponsor all the same.

**route-gates:sponsor-application-needs** Applying needs: the route known and its window at 1 or more; a sponsor recorded; the sponsor's salary at or above the route's salary bar (`var.uk-skilled-salary` or `var.uk-care-salary`); the route's qualification documents held (below); the English result at or above the route's band; the TB certificate; the passport; and for `uk-skilled` the maintenance funds `var.uk-skilled-maintenance` covered at one month end (route:funds-held-month-count with the sponsor route's own funds line). The visa fee and the surcharge for the status's months are the activity's cost.

**route-gates:fraud-sponsor-refused** The decision uses route-gates:gate-decision-draw-terms with the strictness, earlier refusals and the sponsor's honesty: a fraud sponsor is refused with the reason `sponsor` whatever the draw, and route-gates:deception-bans-country applies. An honest sponsor's draw uses the route's base, plus 10 per strictness point, plus 800 per earlier refusal, minus 200 for a second upper or better. The unexplained share is not read.

**route-gates:care-route-needs-verification** `route.uk-care` needs `document.nursing-licence` and `document.nmcn-verification`. The verification can be requested only after 24 months of tenure in a nursing job (the home council's rule since 1 Mar 2024), and takes 6 to 12 months. The route's window var `var.uk-care-window` starts at 0: the route is closed to applicants abroad (22 Jul 2025) until the director opens it. Players hear of it all the same. The clinic's certification counts toward health care, as its card and activity:waiting-months-build-profile say: the checklist carries `certificate`, `document.nurse-certificate` held, with the checklist's smallest weight (5), and the weights add up to 100 (japacity:figure-is-whole-percent), so a certified nurse's figure is 5 higher, one more thing in her favour. Its place is the clinic, where the exam is sat. Applying does not need it (route-gates:sponsor-application-needs).

**route-gates:skilled-route-needs-degree** `route.uk-skilled` needs a bachelor's degree and 24 months of tenure across every job. Its bar is `var.uk-skilled-salary`. Its sponsors pay the salary in their offer; a salary under the bar is a sponsor you cannot use, which the view says.

**route-gates:sponsored-status-on-departure** On departure the status is `status.uk-sponsored`, granted with the sponsor block's `job` so the job held becomes the sponsor's job (`activity.job-uk-care` or `activity.job-uk-skilled`), paying the sponsor's salary over twelve into the GBP bank pocket, less tax by `abroad-money.md`.

### Entries: sponsor routes

| Route | Hear if | Hear by | Window var | Country | Status | Base refusal | Salary bar | Visa fee | Surcharge | Band | Qualification | Checklist (weight) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `route.uk-care` | `quality.care` 30 or more | 4 | `var.uk-care-window`, start 0 | uk | `status.uk-sponsored` | 500 | `var.uk-care-salary` 2500000 pence | `var.uk-care-visa-fee` 32400 | none (exempt) | 40 (B1) | licence, verification | licence 10, verification 14, certificate 5, passport 6, english 10, sponsor 25, tb 5, police 5, salary 10, applied 10 |
| `route.uk-skilled` | bachelor's and 24 months in any job | 6 | `var.uk-skilled-window`, start 2 | uk | `status.uk-sponsored` | 500 | `var.uk-skilled-salary` 4170000 pence | `var.uk-skilled-visa-fee` 81900 | `var.uk-surcharge-year` times 3 | 40 (B1) | degree | degree 8, passport 6, english 10, sponsor 30, salary 10, funds 10 (partial), tb 6, police 5, applied 15 |

### Entries: sponsor offers

| Id | Route | Chance a month | Cooldown | Lapses | Fraud | Terms | Signs (honest, fraud) | Choices |
|---|---|---|---|---|---|---|---|---|
| `offer.sponsor-care-home` | uk-care | 8% | 3 | 2 | 25% | `salary` a draw £25,000 to £29,000 by £500; `fee` ₦0 honest, the fraud asks `fee` ₦4,500,000 | `pays-for-cos` (10, 85), `licensed-register` (85, 20), `video-interview` (80, 30), `whatsapp-only` (15, 75), `start-date` (70, 20) | `take`: record the sponsor; a fraud takes the fee from cash. `decline` |
| `offer.sponsor-trust` | uk-care | 3% | 6 | 2 | 0% | `salary` £31,300 (a nurse's band) | none | `take`, `decline`. Needs `quality.care` 60 or more |
| `offer.sponsor-tech-firm` | uk-skilled | 4% | 4 | 2 | 15% | `salary` a draw £42,000 to £60,000 by £1,000; `fee` ₦6,000,000 if a fraud | `pays-for-cos` (5, 80), `licensed-register` (90, 25), `video-interview` (90, 40), `whatsapp-only` (10, 70), `start-date` (80, 30) | `take`, `decline`. Needs `quality.tech` 60 or more |
| `offer.sponsor-agency` | uk-skilled | 6% | 3 | 1 | 50% | `salary` a draw £38,000 to £45,000 by £500; `fee` ₦5,000,000 | the same five signs | `take`, `decline`. The one that beats the others on every visible number |

Sign words: `pays-for-cos` "They want you to pay for the certificate." `licensed-register` "The company is on the public register of licensed sponsors." `video-interview` "There was an interview on video with the manager." `whatsapp-only` "Everything happens on WhatsApp." `start-date` "They gave a start date and a rota."

## The points gate: `route.canada-points`

**route-gates:points-score-from-table** A character's score is the sum of the points table below over age, education, language and foreign work, with the transferability part capped at 100. It is worked out from the state each time it is asked for and shown on the route from the moment it is known.

**route-gates:entering-the-pool** Entering the pool (`activity.enter-pool`) needs: the route known with its window at 1 or more, `document.eca` held, the English result at band 60 or more (CLB 7), 12 months of tenure across every job, and the funds `var.ca-funds` covered now (route:funds-shown-exclude-cash with the Canadian line, valued in Canadian cents). It records `poolMonth` on the route and a profile that lasts 12 months. Japa's way file says the window and the pool in months ago or away.

**route-gates:pool-draws-invite** In the `clocks` phase, while a profile is live, a draw of the world invites the character when `var.ca-cutoff` is at or below the score, or when the character holds `quality.care` at 60 or more and `var.ca-care-cutoff` is at or below the score. The draw is not random: the world's cut-offs are. An invitation moves the route to `applying` with the decision `var.ca-decision-months` later, and the application fee is taken as a foreign fee in Canadian cents with the reason `fee-visa`. If it cannot be paid the invitation lapses after one month and the profile goes on.

**route-gates:points-decision-gives-residence** The decision uses route-gates:gate-decision-draw-terms with the unexplained share (Canadian officers ask about deposits too) and earlier refusals, not the strictness. A grant gives `status.ca-resident` on departure.

**route-gates:profile-lapses-and-score-ages** A profile that reaches 12 months without an invitation lapses; the pool can be entered again. Age points fall as `quality.age-months` passes each birthday in the table, so the score is a clock.

**route-gates:points-view-carries-invites** The points gate's view carries `invites`: whether the clocks would invite now by route-gates:pool-draws-invite, the general cut-off at or below the score, or the care cut-off for a carer with `quality.care` at the table's `careMin`. The points panel says "short" only when no invitation would come, and names the care workers' cut-off when that is the one met.

### The points table (`points.canada`)

| Part | Points |
|---|---|
| Age, by whole years: 18 to 19 | 99 |
| 20 to 29 | 110 |
| 30 | 105 |
| 31 | 99 |
| 32 | 94 |
| 33 | 88 |
| 34 | 83 |
| 35 | 77 |
| 36 | 72 |
| 37 | 66 |
| 38 | 61 |
| 39 | 55 |
| 40 | 50 |
| 41 | 39 |
| 42 | 28 |
| 43 | 17 |
| 44 | 6 |
| 45 and over | 0 |
| Education: bachelor's | 120 |
| Education: master's | 135 |
| Education: doctorate | 150 |
| Education: diploma | 98 |
| Education: secondary | 30 |
| Language, each of four abilities, from the band: 60 (CLB 7) | 17 |
| 65 (CLB 8) | 23 |
| 70 or 75 (CLB 9) | 31 |
| 80 and over (CLB 10) | 34 |
| Transferability, education after secondary school with band 60 or 65 | 13 |
| Transferability, education after secondary school with band 70 or more | 25 |
| Transferability, 12 to 35 months of work with band 60 or 65 | 13 |
| Transferability, 12 to 35 months of work with band 70 or more | 25 |
| Transferability, 36 months or more of work with band 60 or 65 | 25 |
| Transferability, 36 months or more of work with band 70 or more | 50 |

Worked example: Zainab at 25 with a bachelor's, band 7.0 and 18 months in a job scores 110 + 120 + 124 + 25 + 25 = 404. The world's general cut-off starts at 405 and the care cut-off at 370, so she is one point short: three years of work (110 + 120 + 124 + 25 + 50 = 429) clears it, even after the general draws pause (+20). A points overhaul (+15) asks a better band or a master's too. A diploma, band 6.0 and no work (289) reaches neither. Ada at 23 with band 6.5 and no job yet scores 110 + 120 + 92 + 13 = 335.

### Entry: `route.canada-points`

| Field | Value |
|---|---|
| Hear if | bachelor's degree |
| Hear by | 5 |
| Window | `var.ca-window`, start 2 |
| Country, status | canada, `status.ca-resident` |
| Base refusal | 1000 |
| Checklist | degree 8, eca 10, english 12, funds 20 (partial), pool 15, invited 20, police 5, applied 10 |
| Documents | `document.eca`: wait 2 to 4 months, valid 60, requested by `activity.get-eca` at C$329 (`var.ca-eca-fee` 32900 cents) paid as a foreign fee with reason `fee-document` |

## The endorsement gate: `route.uk-talent`

**route-gates:applying-for-endorsement** `activity.apply-endorsement` needs the route known with its window at 1 or more, `quality.tech` 75 or more, `quality.portfolio` 3 or more, `quality.network` 50 or more, and no endorsement pending or held. It costs `var.uk-talent-endorse-fee` as a foreign fee with reason `fee-document`, and requests `document.endorsement`, wait 1 to 2 months. Each need not yet met names its act and place under it in Japa (tech: the coding course at the hub; the pieces: work at the hub's desk, or a talk; the people who will write: the meetups at the hub, or a talk), and the nudge names the first unmet need's act (world:nudge-says-one-thing). The talk moves the network and the portfolio, not tech, so tech's line names the course alone. The endorsement lasts 3 months (route-gates:talent-visa-needs-endorsement), so the nudge names it only once the passport is held and the naira held pays it with the TB test and the application, else the passport or the gap (world:nudge-says-one-thing); a developer who follows the nudge never asks for it with no passport, and never lets one run out unused for want of the rest.

**route-gates:endorsement-decided-by-draw** When the endorsement document is issued, one draw on stream `visa` decides it: the chance of endorsement is 2500 plus 700 for each portfolio point above 3 plus 10 for each network point above 50, capped at 8500. A refused endorsement is voided at once, the route records a refusal with the reason `endorsement` (it counts among the earlier refusals of route-gates:talent-visa-needs-endorsement), and `activity.apply-endorsement` is not legal for the block's `cooldown` months, which the activity reads as the gate step `cooled`. A refused endorsement is told in Japa's way file in words.

> guide:first-meetup-hears-fitting-route: the first meetup of a life hears of the talent route for sure at tech 40; the later hears keep this page's bar.

**route-gates:talent-visa-needs-endorsement** Applying for the visa needs the endorsement held (it is valid 3 months), the passport, the TB certificate, and the fee `var.uk-talent-visa-fee` plus the surcharge for 60 months. The decision is route-gates:gate-decision-draw-terms with earlier refusals only, base 300. A grant gives `status.uk-talent`.

### Entry: `route.uk-talent`

| Field | Value |
|---|---|
| Hear if | `quality.tech` 60 or more and `quality.portfolio` 2 or more |
| Hear by | never by itself: through `activity.meetup` at 20% and `news.uk-talent-reappointed` |
| Window | `var.uk-talent-window`, start 2 |
| Country, status | uk, `status.uk-talent` |
| Base refusal | 300 |
| Checklist | tech 15, portfolio 20, network 10, passport 5, endorsement 30, tb 5, applied 15 |
| Fees | endorsement £561 (`var.uk-talent-endorse-fee` 56100), visa £205 (`var.uk-talent-visa-fee` 20500), surcharge £1,035 times 5 |

## The contract gate: `route.gulf-contract`

**route-gates:gulf-route-heard-at-park** The route is heard of at the motor park and the salon: `activity.ask-around` and `offer.gulf-agent` make it heard. Looking into it makes it known. Its checklist is short and its japacity figure shows that.

**route-gates:gulf-agent-offer** `offer.gulf-agent` comes up while the route is known and `var.uae-window` is 1 or more. Taking it pays the agent's fee from the naira, by its size (decision 0014: cash first at or under `tuning.wallet.cashUpTo`, the bank first above it), with the reason `fee-agent` and records the agent as the route's sponsor (route-gates:taking-sponsor-records-it shape), with the contract's `salary` term in fils a month and whether it is a fraud, hidden.

**route-gates:gulf-application-needs** Applying needs the agent recorded, the passport, `document.medical` (requested by `activity.gulf-medical`, wait 1, ₦60,000, reason `fee-test`), secondary school or better and age under 45 years (540 months). No fee: the employer pays the visa. The decision is route-gates:gate-decision-draw-terms with base 1000 and no other terms, except that a fraud agent is refused with the reason `agent`, and route-gates:deception-bans-country does not apply: nothing was forged in your name, the money is simply gone.

**route-gates:employer-flies-and-holds-passport** On a grant the flight is paid by the employer (`flightPaidByEmployer: true`), departure gives `status.gulf-worker`, the job `activity.job-gulf-guard` or `activity.job-gulf-cleaner` by the offer's `role` term, and the employer holds the passport (status:gulf-status-holds-passport).

### Entries

| Id | Values |
|---|---|
| `route.gulf-contract` | hear if secondary school; hear by never by itself; window `var.uae-window` start 2; country uae; status `status.gulf-worker`; base refusal 1000; checklist passport 20, medical 15, agent 35, police 5, applied 25 |
| `offer.gulf-agent` | group `money`; when route known and window 1 or more; 10% a month; cooldown 4; lapses 2; fraud 40%; terms `fee` a draw ₦900,000 to ₦1,800,000 by ₦100,000, `salary` a draw AED 1,500 to AED 2,200 by AED 100, `role` guard or cleaner; signs `office` (75, 25), `receipt` (70, 15), `contract-paper` (80, 20), `pay-today` (20, 85), `friend` (40, 10); choices `take`, `walk-away` |

The agent's pitch, for the words file: "Dubai. Security or cleaning, accommodation included, {salary} a month. Visa and ticket are sorted. Bring {fee} and your passport."

## Numbers

| Setting | Value | Date | In content as |
|---|---|---|---|
| Skilled worker salary bar | £41,700 a year | 22 Jul 2025 | `var.uk-skilled-salary` 4170000 |
| Care worker salary bar | £25,000 a year, nurses £31,300 | 22 Jul 2025 | `var.uk-care-salary` 2500000 |
| Skilled worker visa fee, three years | £819 | Apr 2026 | `var.uk-skilled-visa-fee` 81900 |
| Health and care visa fee, three years | £324 | Apr 2026 | `var.uk-care-visa-fee` 32400 |
| Health surcharge, workers, a year | £1,035 | In force | `var.uk-surcharge-year` 103500 |
| Skilled worker maintenance | £1,270 held 28 days | In force | `var.uk-skilled-maintenance` 127000 |
| Nurse verification wait after licence | 24 months | 1 Mar 2024 | `document.nmcn-verification` requires tenure 24 |
| Care route closed to applicants abroad | 22 Jul 2025 | | `var.uk-care-window` start 0 |
| Canada proof of funds, one person | C$15,263 | 7 Jul 2025 | `var.ca-funds` 1526300 |
| Canada credential assessment | C$329 | 2025 | `var.ca-eca-fee` 32900 |
| Canada application fee | C$1,525 | 2025 | `var.ca-apply-fee` 152500 |
| Canada general cut-off, start | 405 | A working value: a bachelor's, band 7.0, a year of work and under thirty is one short and reaches it within two years; the game's scale, not the real one, where 2026 draws ran 508 to 547 | `var.ca-cutoff` 405 |
| Canada healthcare cut-off, start | 370 | The general start times 475 over 520, the real ratio of Jun to Sep 2026 | `var.ca-care-cutoff` 370 |
| Canada decision months | 6 | Working value | `var.ca-decision-months` 6 |
| Foreign work counts from | 12 months | The CRS grid | `points.canada.transfer.workMonths` 12 |
| Care cut-off read from | care 60 | Working value | `points.canada.careMin` 60 |
| Talent endorsement fee | £561 | Apr 2026 | `var.uk-talent-endorse-fee` 56100 |
| Talent visa fee | £205 | Apr 2026 | `var.uk-talent-visa-fee` 20500 |
| Endorsement wait | 1 to 2 months | Tech Nation guidance, 5 to 8 weeks | `document.endorsement` wait [1, 2] |
| Endorsement validity | 3 months | gov.uk | `document.endorsement` validMonths 3 |
| Gulf agent fee | ₦900,000 to ₦1,800,000 | Working value from reported losses of ₦450,000 and £1,775 | `offer.gulf-agent` terms |
| Gulf guard pay | AED 1,500 to 2,200 a month, accommodation included | 2024 to 2025 listings | `offer.gulf-agent` terms |
| UAE window for Nigerians | Closed Oct 2022 to Jul 2024, open since | | `var.uae-window` start 2; the director's story closes it |
| Deception ban | 120 months | gov.uk | `country.uk.deceptionBanMonths` 120 |

## Qualities, documents and a starting life of the gates

| Id | Kind | Values |
|---|---|---|
| `quality.care` | quality, skills, 0 to 100, counts toward no route | Nursing and care skill. A nurse starts at 60, a care assistant at 30 |
| `document.nursing-licence` | document | Never requested: a starting life holds it. Valid 36 months, renewed by `activity.renew-licence` at ₦25,000 |
| `document.nmcn-verification` | document | wait [6, 12], valid 24, requested by `activity.request-verification` at ₦150,000 (reason `fee-document`), needs 24 months of nursing tenure |
| `document.eca`, `document.endorsement`, `document.medical` | document | As above |
| `scenario.ngozi` | scenario | Ngozi Eze, 27 (324), a staff nurse 30 months in (`activity.job-nurse`, ₦180,000), second upper, English 58, care 60, network 25, family means 30, standing 65, wellbeing 50, ₦650,000 bank, ₦30,000 cash, passport 40 months left, nursing licence 30 months left, upkeep ₦120,000, home support ₦40,000 |

## Sources

All read on 7 Oct 2026.

- [Centuro Global: Skilled Worker changes 2025 to 2026](https://www.centuroglobal.com/article/uk-immigration-2025-changes/), [Jobbatical: salary thresholds](https://www.jobbatical.com/blog/uk-skilled-worker-visas-salary-thresholds)
- [Davidson Morris: Skilled Worker costs 2026](https://www.davidsonmorris.com/tier-2-visa-costs)
- [BusinessDay: no abroad dreams without two years, NMCN](https://businessday.ng/news/article/no-abroad-dreams-without-2yrs-work-nmcn-tells-nigerian-nurses/), [ICIR: nurses sue over verification](https://www.icirnigeria.org/nurses-sue-nigerian-government-over-new-verification-guidelines/)
- [NMC: costs for nurses trained outside the UK](https://www.nmc.org.uk/registration/joining-the-register/register-nurse-midwife/trained-outside-uk/how-to-guide/check-ready/costs/)
- [Guardian Nigeria: care jobs extortion scheme](https://guardian.ng/news/nigerian-doctor-indicted-for-care-jobs-extortion-scheme-in-uk/), [BBC via Graphic: secret filming of sponsorship sellers](https://www.graphic.com.gh/international/international-news/secret-filming-reveals-brazen-tactics-of-uk-immigration-scammers.html)
- [immigration.ca: the CRS grid](https://www.immigration.ca/express-entry-crs-grid/), [CIC News: foreign work experience and CRS](https://www.cicnews.com/2025/07/how-foreign-work-experience-can-boost-your-crs-score-in-a-competitive-express-entry-pool-0757515.html)
- [CIC News: healthcare draw, Feb 2026](https://www.cicnews.com/2026/02/latest-express-entry-draw-sees-thousands-of-healthcare-professionals-invited-0271898.html), [immigration.ca: 3,500 healthcare invitations, Sep 2026](https://immigration.ca/canada-invites-3500-healthcare-workers-express-entry-september-4-2026/)
- [Liberty Immigration: proof of funds 2026](https://libertyimmigration.ca/express-entry-proof-of-funds-2026-updated-settlement-fund-requirements/)
- [Migrate UK: Global Talent fees 2026](https://migrate-uk.com/articles/global-talent-visa-fees-2026-complete-cost-breakdown), [Lewis Silkin: digital technology applicants](https://lewissilkin.com/en/insights/factsheet-global-talent-digital-technology-applicants)
- [Pakistan Bureau of Emigration: UAE security guard listings, AED 1,200 to 2,267](https://beoe.gov.pk/foreign-jobs/1279899/1498048/55-security-guards-required-in-united-arab-emirates-salary-1200-2267-dirham-aed), [Legit: a Nigerian's ₦450,000 loss to a Dubai agent](https://www.legit.ng/people/1472165-i-got-scammed-lied-my-parents-nigerian-lady-uaes-first-female-delivery-rider-opens-video/), [BHRRC: fees of up to £1,775 for Gulf guard jobs](https://www.bhrrc.org/ja/最新ニュース/g4s-faces-calls-to-repay-fees-paid-by-migrant-workers-to-recruitment-agents-for-jobs-in-gulf-states-conflict-zones-includes-co-comments/)
- [Africanews: UAE lifts the 2022 visa ban](https://africanews.com/2024/07/17/uae-lifts-2022-visa-ban-on-nigerians)

## Not verified

- The Canada application fee of C$1,525 (C$950 processing plus C$575 right of permanent residence) is from memory of the IRCC fee page.
- The endorsement chance and the sponsor offer rates are working values with no source. The sweep tunes them.
- Whether the UK care route's closure to applicants abroad will be reopened. The window var models it either way.

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `route/record-sponsor` | effect | Records a sponsor, agent or connection on a gate route; `fraud` is kept hidden (route-gates:taking-sponsor-records-it, route-gates:gulf-agent-offer) |
| `route/enter-pool` | effect | Enters the points pool, from `activity.enter-pool` (route-gates:entering-the-pool) |
| `route/gate-step` | requirement | The route's gate has reached the named `step` (`sponsor` for a sponsor or agent recorded) |
