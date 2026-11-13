# Route gates: sponsor, points, endorsement, contract

> Numbers are real values at the dates given, used as working values. Where the game differs from real life, the real value and the factor stand beside it. Sources are at the end.
> Kind: `route`. The study gate is in `route.md`. Background: `../research/01-japa-journey.md`, `../research/02-all-routes-and-timeline.md`, `../research/03-life-abroad-and-return.md`, `../research/07-status-cliffs-and-restarts.md`.
> For game design. Not immigration advice. The sponsors, agents and employers are invented.

Every route moves through the states in `route.md`, has a checklist and a window, and ends in a decision draw. Routes differ in their **gate**: the steps between known and applying. The route's entry names its gate, and the route kind runs that gate's steps.

## Rules shared by every gate

**route-gates:route-runs-its-gate-steps** A route entry names its `gate`: `study`, `sponsor`, `points`, `endorsement`, `contract` or `road` (and `partner` or `dependant`, in `person.md`). The route kind runs only that gate's steps. A command or effect that belongs to another gate does nothing or is rejected with `not-legal`. Two exceptions: `route/pay-deposit` on a route with no schools is rejected with `unknown-id`; and `route/enter-pool` reads no gate, so on any known route with its window open it enters the pool and gives the route a points gate.

**route-gates:gate-decision-draw-terms** The decision draw is the one in route:visa-refusal-chance, with the route entry's own `refusalBaseBp` in place of the tuning base. The strictness, unexplained share, earlier refusals and good grade terms apply only where the gate says so; each gate below lists its terms. The floor and ceiling are shared.

**route-gates:departure-grants-status** `route/depart` on a granted route pays the flight (route:departure-pays-flight), unless the entry says `flightPaidByEmployer`. It then applies `place/move` to the route's `country` and `status/grant` for the route's `status`. The life does not end.

**route-gates:route-entry-gate-block** A route entry carries `country`, `status`, `refusalBaseBp` and its gate's block. The sponsor block names the salary and maintenance vars, the find chance, the English band, the qualification documents, the strictness var, the surcharge years and the job held on arrival. The endorsement block names its document, chances, cooldown, fee var and surcharge years. The points block names its table, the funds, cut-off, fee and decision vars, and the profile months. The application records the gate's own strictness and surcharge (route:application-fixes-figures). The funds a route shows are the gate's own line in its own currency: the maintenance line in pence, the Canadian funds in cents; the talent and contract routes show none. The checklist weights still add up to 100 (japacity:figure-is-whole-percent).

**route-gates:deception-bans-country** A refusal for deception (a fraud sponsor, route-gates:fraud-sponsor-refused) moves every known or applying route into that country to `refused` until the month plus the country's `deceptionBanMonths`. In that month the ban lifts and the routes are known again. A removal's ban (place:removal-bans-the-country) and the ban recorded on a return from an overstay (place:leaving-an-overstay-bans) work differently: until they lift, no route into that country can be heard of or looked into, and no partner route into it can be applied for, but no route moves. The fraud agent's refusal (route-gates:gulf-application-needs) bans nothing.

**route-gates:in-country-grant-switches-status** An application made in the country it is for (status:grace-allows-in-country-applications, person:partner-route-in-country) needs no flight. Its grant moves the route from `granted` to `departed` in the same `clocks` phase, with no `route/depart`, no flight and no `place/move`, and applies `status/grant` for the route's status. That replaces the overstayer status and clears its notice (status:notice-ends-in-removal). The line names the new permission in a person's words. Real: a switch of permission inside the UK, or an inland application in Canada.

**route-gates:canada-return-asks-authorisation** After the ban from a removal from Canada lifts (place:removal-bans-the-country), the first application into Canada adds two charges: the authorisation to return, `var.canada-arc-fee` (C$492.50), and the removal costs repaid, `var.canada-removal-cost` (C$3,840). They are taken once, as foreign fees with the reason `fee-visa`, with that application's fee: the pool's invitation fee (route-gates:pool-draws-invite), or a partner or accompanying application's fee. The slice keeps the removal as owing until they are paid, and the route's view names them. Real: a deportation order bars return for good unless an Authorization to Return to Canada is granted, at the officer's discretion, after the removal costs are repaid. The game ends the bar at 120 months and makes the authorisation certain.

## The sponsor gate: `route.uk-care`, `route.uk-skilled`

A sponsor is an employer abroad that holds a licence and issues a certificate of sponsorship. The certificate can be genuine or sold.

**route-gates:sponsor-offers-come-up** While a sponsor route is known and its window is not closed, sponsor offers come up through the offer kind: the `offer.sponsor-*` entries, with the route's `when` requirements. The trust's nursing post ignores the window (route-gates:nurses-sponsored-while-care-shut). The slot activity `activity.find-sponsor` looks for one: it rolls one offer at once, at the route entry's `sponsor.findBp` plus 20 basis points for each point of network, capped at 9500, on stream `job`.

**route-gates:taking-sponsor-records-it** Taking a sponsor offer records the sponsor on the route: the offer's `salary` term (in pence a year), the employer key, and, hidden, whether it is a fraud (offer:opening-fixes-terms-and-fraud decides that when the offer opens). An honest sponsor costs nothing: the employer pays for the certificate and the skills charge, so a sponsor that asks for money is a warning sign. A fraud takes its `fee` term from cash with the reason `fee-agent` and is recorded as a sponsor all the same.

**route-gates:sponsor-application-needs** Applying needs: the route known with its window at 1 or more; a sponsor recorded; the sponsor's salary at or above the route's salary bar (`var.uk-skilled-salary` or `var.uk-care-salary`); the route's qualification documents held (below); the English met, either by the degree's English statement held (document:degree-english-statement) or by an English result at or above the route's band, 55 (B2); the TB certificate (not asked of an application made in country, status:grace-allows-in-country-applications); the passport; and, for `uk-skilled`, the maintenance funds `var.uk-skilled-maintenance` covered at one month end (route:funds-held-month-count, with the sponsor route's own funds line). The visa fee and the surcharge for the status's months are the activity's cost.

**route-gates:fraud-sponsor-refused** The decision uses route-gates:gate-decision-draw-terms with the strictness, earlier refusals and the sponsor's honesty. A fraud sponsor is refused with the reason `sponsor` whatever the draw, and route-gates:deception-bans-country applies. For an honest sponsor the refusal chance is the route's base, plus 10 per strictness point, plus 800 per earlier refusal, minus 200 for a second upper or better. The unexplained share is not read.

**route-gates:care-route-needs-verification** `route.uk-care` needs `document.nursing-licence` and `document.nmcn-verification`. The verification can be requested only after 24 months of tenure in a nursing job (the Nigerian nursing council's rule since 1 Mar 2024), and takes 6 to 12 months. The route's window var `var.uk-care-window` starts at 0: the route is closed to care workers applying from abroad (since 22 Jul 2025) until the director opens it, and open throughout to a registered nurse with a trust's post (route-gates:nurses-sponsored-while-care-shut). Players still hear of it. The clinic's nursing certification counts toward health care, as its card and activity:waiting-months-build-profile say: the checklist item `certificate` (`document.nurse-certificate` held) has the checklist's smallest weight, 5, and the weights add up to 100 (japacity:figure-is-whole-percent), so a certified nurse's figure is 5 higher. The certificate's place is the clinic, where the exam is sat. Applying does not need it (route-gates:sponsor-application-needs).

**route-gates:nurses-sponsored-while-care-shut** A registered nurse can still be sponsored while the care window is shut. `offer.sponsor-trust`, a hospital trust's post at a nurse's salary, comes up and can be looked for (route-gates:sponsor-offers-come-up) whatever `var.uk-care-window` says, for a life holding `document.nursing-licence` and `document.nmcn-verification` with `quality.care` 60. A `route.uk-care` application whose sponsor is the trust may be sent with the window at 0; every other need of route-gates:sponsor-application-needs still applies. The care homes' offers stay behind the window. The trust's chance is 4% a month (`offer.sponsor-trust`), below the care homes' 8%, for the fall in international hiring. The nurse meets the English need as any applicant does (the Numbers row on nurses' English). Real: the closure of 22 Jul 2025 applied to care workers recruited from abroad, and registered nurses still get Health and Care visas; international joiners to the NMC's register fell 47% in 2025 to 2026, and Nigerian joiners 25.5% in 2024 to 2025 (Sources).

**route-gates:skilled-route-needs-degree** `route.uk-skilled` needs a bachelor's degree and 24 months of tenure across all jobs. Its salary bar is `var.uk-skilled-salary`. Each sponsor states the salary in its offer; a sponsor whose salary is under the bar cannot be used, and the view says so.

**route-gates:sponsored-status-on-departure** On departure the status is `status.uk-sponsored`, granted with the sponsor block's `job`, so the job held becomes the sponsor's job (`activity.job-uk-care` or `activity.job-uk-skilled`). It pays the sponsor's yearly salary divided by twelve into the GBP bank pocket, less tax (`abroad-money.md`).

### Entries: sponsor routes

| Route | Hear if | Hear by | Window var | Country | Status | Base refusal | Salary bar | Visa fee | Surcharge | Band | Qualification | Checklist (weight) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `route.uk-care` | `quality.care` 30 or more | 4 | `var.uk-care-window`, start 0 | uk | `status.uk-sponsored` | 500 | `var.uk-care-salary` 2500000 pence | `var.uk-care-visa-fee` 32400 | none (exempt) | 55 (B2), or the degree's statement | licence, verification | licence 10, verification 14, certificate 5, passport 6, english 10 (the statement, or band 55), sponsor 25, tb 5, police 5, salary 10, applied 10 |
| `route.uk-skilled` | bachelor's and 24 months in any job | 6 | `var.uk-skilled-window`, start 2 | uk | `status.uk-sponsored` | 500 | `var.uk-skilled-salary` 4170000 pence | `var.uk-skilled-visa-fee` 81900 | `var.uk-surcharge-year` times 3 | 55 (B2), or the degree's statement | degree | degree 8, passport 6, english 10 (the statement, or band 55), sponsor 30, salary 10, funds 10 (partial), tb 6, police 5, applied 15 |

### Entries: sponsor offers

| Id | Route | Chance a month | Cooldown | Lapses | Fraud | Terms | Signs (honest, fraud) | Choices |
|---|---|---|---|---|---|---|---|---|
| `offer.sponsor-care-home` | uk-care | 8% | 3 | 2 | 25% | `salary` a draw £25,000 to £29,000 by £500; `fee` ₦0 honest, the fraud asks `fee` ₦4,500,000 | `pays-for-cos` (10, 85), `licensed-register` (85, 20), `video-interview` (80, 30), `whatsapp-only` (15, 75), `start-date` (70, 20) | `take`: record the sponsor; a fraud takes the fee from cash. `decline` |
| `offer.sponsor-trust` | uk-care | 4% | 6 | 2 | 0% | `salary` £31,300 (a nurse's band) | none | `take`, `decline`. Needs the licence and the verification held, `quality.care` 60; open with the window shut (route-gates:nurses-sponsored-while-care-shut) |
| `offer.sponsor-tech-firm` | uk-skilled | 4% | 4 | 2 | 15% | `salary` a draw £42,000 to £60,000 by £1,000; `fee` ₦6,000,000 if a fraud | `pays-for-cos` (5, 80), `licensed-register` (90, 25), `video-interview` (90, 40), `whatsapp-only` (10, 70), `start-date` (80, 30) | `take`, `decline`. Needs `quality.tech` 60 or more and 24 months across the developer jobs (`activity.job-junior-developer`, `-mid-developer`, `-remote-developer`, read as the endorsement's track record is; a working value): a UK firm sponsors a developer with experience |
| `offer.sponsor-accounting-firm` | uk-skilled | 4% | 4 | 2 | 0% | `salary` a draw £46,000 to £56,000 by £1,000 | none | `take`, `decline`. Needs the job held to be the chartered accountant's rung or the finance manager's above it (`activity.job-chartered-accountant`, `-finance-manager`) and 24 months across the accounting jobs (a working value): chartered and certified accountants are an eligible skilled worker occupation |
| `offer.sponsor-agency` | uk-skilled | 6% | 3 | 1 | 50% | `salary` a draw £38,000 to £45,000 by £500; `fee` ₦5,000,000 | the same five signs | `take`, `decline`. Needs 24 months across the ladder of the trade whose job is held (one trade's rungs at home, activity.md "Jobs: the ladders"; a working value): an agency places experienced workers in their trade. The one that beats the others on every visible number |

Sign words: `pays-for-cos` "They want you to pay for the certificate." `licensed-register` "The company is on the public register of licensed sponsors." `video-interview` "There was an interview on video with the manager." `whatsapp-only` "Everything happens in a chat app." `start-date` "They gave a start date and a rota."

## The points gate: `route.canada-points`

**route-gates:points-score-from-table** A character's score is the sum of the points table below for age, education, language and foreign work, with the transferability part capped at 100. It is worked out from the state each time it is read, and shown on the route from the moment the route is known.

**route-gates:entering-the-pool** Entering the pool (`activity.enter-pool`) needs: the route known with its window at 1 or more; `document.eca` held; an English result at band 60 or more (CLB 7); 12 months of tenure across all jobs; and the funds `var.canada-funds` covered now (route:funds-shown-exclude-cash with the Canadian line, valued in Canadian cents). It records `poolMonth` on the route and a profile that lasts 12 months. The way's file in the phone's Japa app shows the window and the pool as months ago or months away.

**route-gates:pool-draws-invite** In the `clocks` phase, while a profile is live, the world invites the character when one of these holds: `var.canada-cutoff` is at or below the score; or the character holds `quality.care` at 60 or more and `var.canada-care-cutoff` is at or below the score; or the character has 12 months across the teacher jobs (`activity.job-teacher`, `-senior-teacher`, `-head-of-department`; `points.canada.educationMonths`) and `var.canada-education-cutoff` is at or below the score. The education cut-off stands only while the director's education draw is in force (director.md, `news.canada-education-draw`). No chance is drawn here: the randomness is in the world's cut-offs. An invitation moves the route to `applying`, with the decision `var.canada-decision-months` later. The application fee is taken then, as a foreign fee in Canadian cents with the reason `fee-visa`, and `var.canada-funds` must be covered at that moment (the funds are asked for at application). If the fee cannot be paid or the funds are not covered, the invitation lapses after one month and the profile carries on. Real: IRCC's education category invites secondary, elementary and kindergarten teachers, early childhood educators, instructors of persons with disabilities and teacher assistants with 12 months of work in one of these in the last three years, in Canada or abroad. Its rounds of 1 May 2025 (1,000 invited, CRS 479) and 17 Sep 2025 (2,500, CRS 462) are its only ones up to 16 Oct 2026, while the 2026 rounds for Canadian experience ran 514 to 523 and the healthcare rounds 475 (Sources). The game counts 12 months across the teacher jobs at any time, not only in the last three years.

**route-gates:family-gift-counts-with-deed** The family's gift for Canada counts as the applicant's own money only with its deed (decision 0031). `offer.family-gift-canada`, opened by the family meeting for a Canada plan (activity.md, `activity.family-meeting`), pays family means times ₦100,000 into the naira bank under `gift`, flagged (wallet:large-deposits-record-lots), and records the naira on the route as `gift`. The family's stake rises by one, so the gift and the master's pledge are never both had, nor Papa's loan beside them (wallet:roads-to-the-target). Until `document.gift-deed` is held, the Canadian funds shown (route:funds-shown-exclude-cash with the Canadian line) leave out the gift, valued at the day's official rate and never more than the naira bank holds. `activity.gift-deed` (at home; the gift taken and no deed held or being made; ₦20,000 under `fee-document`) requests the deed, with a wait of 1 month. Once the deed is held the gift counts and its lot is dropped, so it adds nothing to the unexplained share. The gift is the applicant's to spend, and money spent no longer shows: the funds are checked again at the invitation (route-gates:pool-draws-invite) and at the flight (route-gates:canada-funds-checked-at-departure). A loan never counts this way: no lender's money is offered for Canada. Real: IRCC asks C$15,263 for one person (updated 7 Jul 2025) and says "you can't borrow this money from another person"; the funds must be held at application and when the permanent resident visa is issued. Its page says nothing of gifts. Consultancies report that a gift counts with a signed or notarised deed that names the amount and the relationship and says it is not a loan, backed by the transfer, and that a large recent deposit without one draws a request to explain (Sources, Not verified).

**route-gates:canada-funds-checked-at-departure** `route/depart` on `route.canada-points` needs `var.canada-funds` covered on the day, as at entry to the pool (route-gates:entering-the-pool), as well as route:departure-pays-flight's needs. When the funds fall short, the flight is refused with the reason `funds`, and the way's file says how much is missing. Departure stays shut until the money is back; the grant stands meanwhile. Real: the funds must be held when IRCC issues the permanent resident visa, and the officer at the port of entry may ask for proof of them.

**route-gates:points-decision-gives-residence** The decision uses route-gates:gate-decision-draw-terms with the unexplained share (Canadian officers ask about deposits too) and earlier refusals, not the strictness. A grant gives `status.canada-resident` on departure.

**route-gates:profile-lapses-and-score-ages** A profile that reaches 12 months without an invitation lapses; the character can enter the pool again. Age points fall as `quality.age-months` passes each birthday in the table, so the score drops over time.

**route-gates:points-view-carries-invites** The points gate's view carries `invites`: whether the clocks would invite now under route-gates:pool-draws-invite. That is the general cut-off at or below the score; the care cut-off, for a carer with `quality.care` at the table's `careMin`; or the education cut-off, while it stands, for a teacher with the table's `educationMonths`. The points panel says "short" only when no invitation would come, and names the care workers' or the teachers' cut-off when that is the one met.

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

Worked example: a developer aged 25 with a bachelor's, band 7.0 and 18 months in a job scores 110 + 120 + 124 + 25 + 25 = 404. The world's general cut-off starts at 405 and the care cut-off at 370, so this life is one point short. Three years of work (110 + 120 + 124 + 25 + 50 = 429) clears it, even after the general draws pause (+20). After a points overhaul (+15) it also needs a better band or a master's. A diploma, band 6.0 and no work (289) reaches neither cut-off. A graduate aged 23 with band 6.5 and no job yet scores 110 + 120 + 92 + 13 = 335.

### Entry: `route.canada-points`

| Field | Value |
|---|---|
| Hear if | bachelor's degree |
| Hear by | 5 |
| Window | `var.canada-window`, start 2 |
| Country, status | canada, `status.canada-resident` |
| Base refusal | 1000 |
| Checklist | degree 8, eca 10, english 12, funds 20 (partial), pool 15, invited 20, police 5, applied 10 |
| Documents | `document.eca`: wait 2 to 4 months, valid 60, requested by `activity.get-eca` at C$329 (`var.canada-eca-fee` 32900 cents) paid as a foreign fee with reason `fee-document` |

## The endorsement gate: `route.uk-talent`

**route-gates:applying-for-endorsement** `activity.apply-endorsement` needs: the route known with its window at 1 or more; `quality.tech` 75 or more; `quality.portfolio` 3 or more; `quality.network` 50 or more; 36 months across the developer jobs (`activity.job-junior-developer`, `-mid-developer`, `-remote-developer`, read as `activity/tenure` reads a trade's jobs: a track record, since the endorsement recognises a career and not a first two years); and no endorsement pending or held. It costs `var.uk-talent-endorse-fee` as a foreign fee with reason `fee-document`, and requests `document.endorsement`, wait 1 to 2 months. In Japa, each need not yet met names the act and place that meet it: tech, the coding course at the hub; the portfolio pieces, work at the hub's desk or a talk; the people who will write, the meetups at the hub or a talk; the track record, a developer's job, the hunt for one, or the months while one is held. The talk moves network and portfolio, not tech, so tech's line names the course alone. The nudge names the first unmet need's act (world:nudge-says-one-thing). The endorsement lasts only 3 months (route-gates:talent-visa-needs-endorsement), so the nudge names it only once the passport is held and the naira held pays for it together with the TB test and the application; until then the nudge names the passport or the gap (world:nudge-says-one-thing). A developer who follows the nudge never asks for the endorsement without a passport, and never lets one run out unused for want of the rest.

**route-gates:endorsement-decided-by-draw** When the endorsement document is issued, one draw on stream `visa` decides it. The chance of endorsement is 2500, plus 700 for each portfolio point above 3, plus 10 for each network point above 50, capped at 8500. A refused endorsement is voided at once; the route records a refusal with the reason `endorsement` (counted among the earlier refusals of route-gates:talent-visa-needs-endorsement); and `activity.apply-endorsement` is not legal for the block's `cooldown` months, which the activity reads as the gate step `cooled`. The way's file in the phone's Japa app says in words that the endorsement was refused.

**route-gates:talent-visa-needs-endorsement** Applying for the visa needs the endorsement held (it is valid 3 months), the passport, the TB certificate, and the fee `var.uk-talent-visa-fee` plus the surcharge for 60 months. The decision uses route-gates:gate-decision-draw-terms with earlier refusals only, base 300. A grant gives `status.uk-talent`.

### Entry: `route.uk-talent`

| Field | Value |
|---|---|
| Hear if | `quality.tech` 60 or more and `quality.portfolio` 2 or more |
| Hear by | never by itself: through `activity.meetup` at 20% (the first meetup of a life hears it for sure at tech 40, guide:first-meetup-hears-fitting-route; later meetups keep this page's bar) and `news.uk-talent-reappointed` |
| Window | `var.uk-talent-window`, start 2 |
| Country, status | uk, `status.uk-talent` |
| Base refusal | 300 |
| Checklist | tech 15, portfolio 20, network 10, passport 5, endorsement 30, tb 5, applied 15 |
| Fees | endorsement £561 (`var.uk-talent-endorse-fee` 56100), visa £205 (`var.uk-talent-visa-fee` 20500), surcharge £1,035 times 5 |
| Endorsement asks | tech 75, portfolio 3, network 50, and 36 months across the developer jobs (a working value) |

## The contract gate: `route.gulf-contract`

**route-gates:gulf-route-heard-at-park** The route is heard of at the motor park and the salon: `activity.ask-around` and `offer.gulf-agent` make it heard. Looking into it makes it known. Its checklist is short, and its japacity figure reflects that.

**route-gates:gulf-agent-offer** `offer.gulf-agent` comes up while the route is known and `var.uae-window` is 1 or more. Taking it pays the agent's fee from naira by its size (decision 0014: cash first at or under `tuning.wallet.cashUpTo`, the bank first above it), with the reason `fee-agent`. It records the agent as the route's sponsor, in the shape of route-gates:taking-sponsor-records-it, with the contract's `salary` term in fils a month and, hidden, whether it is a fraud.

**route-gates:gulf-application-needs** Applying needs the agent recorded, the passport, `document.medical` (requested by `activity.gulf-medical`: wait 1 month, ₦60,000, reason `fee-test`), secondary school or better, and age under 45 years (540 months). There is no fee: the employer pays for the visa. The decision uses route-gates:gate-decision-draw-terms with base 1000 and no other terms, except that a fraud agent is refused with the reason `agent`. route-gates:deception-bans-country does not apply: nothing was forged in the applicant's name, the money is simply gone.

**route-gates:employer-flies-and-holds-passport** On a grant the employer pays the flight (`flightPaidByEmployer: true`). Departure gives `status.gulf-worker` and the job `activity.job-gulf-guard` or `activity.job-gulf-cleaner`, by the offer's `role` term, and the employer holds the passport (status:gulf-status-holds-passport).

### Entries

| Id | Values |
|---|---|
| `route.gulf-contract` | hear if secondary school; hear by never by itself; window `var.uae-window` start 2; country uae; status `status.gulf-worker`; base refusal 1000; checklist passport 20, medical 15, agent 35, police 5, applied 25 |
| `offer.gulf-agent` | group `money`; when route known and window 1 or more; 10% a month; cooldown 4; lapses 2; fraud 40%; terms `fee` a draw ₦900,000 to ₦1,800,000 by ₦100,000, `salary` a draw AED 1,500 to AED 2,200 by AED 100, `role` guard or cleaner; signs `office` (75, 25), `receipt` (70, 15), `contract-paper` (80, 20), `pay-today` (20, 85), `friend` (40, 10); choices `take`, `walk-away` |

The agent's pitch, for the words file: "Dubai. Security or cleaning, accommodation included, {salary} a month. Visa and ticket are sorted. Bring {fee} and your passport."

## Numbers

| Setting | Value | Source and date | In content as |
|---|---|---|---|
| Skilled worker salary bar | £41,700 a year | 22 Jul 2025 | `var.uk-skilled-salary` 4170000 |
| Care worker salary bar | £25,000 a year, nurses £31,300 | 22 Jul 2025 | `var.uk-care-salary` 2500000 |
| Skilled worker visa fee, three years | £819 | Apr 2026 | `var.uk-skilled-visa-fee` 81900 |
| Health and care visa fee, three years | £324 | Apr 2026 | `var.uk-care-visa-fee` 32400 |
| Health surcharge, workers, a year | £1,035 | In force | `var.uk-surcharge-year` 103500 |
| Skilled worker maintenance | £1,270 held 28 days | In force | `var.uk-skilled-maintenance` 127000 |
| Nurse verification wait after licence | 24 months | 1 Mar 2024 | `document.nmcn-verification` requires tenure 24 |
| Care route closed to care workers applying from abroad | Closed; nurses still sponsored | 22 Jul 2025 (Centuro Global) | `var.uk-care-window` start 0; route-gates:nurses-sponsored-while-care-shut |
| Canada proof of funds, one person | C$15,263 | 7 Jul 2025 | `var.canada-funds` 1526300 |
| Canada credential assessment | C$329 | 2025 | `var.canada-eca-fee` 32900 |
| Canada application fee | C$1,590: C$990 processing plus C$600 right of permanent residence | IRCC fee list, from 30 Apr 2026 | `var.canada-apply-fee` 159000 |
| English for the UK work routes | B2 for new applicants since 8 Jan 2026 (B1 before), shown by a UK degree, a degree from abroad taught in English and confirmed by Ecctis, or a SELT. B2 is IELTS for UKVI 5.5 in each part. The game: band 55, or the degree's statement (document:degree-english-statement) | gov.uk, Skilled Worker and Health and Care Worker visas, knowledge of English; Statement of Changes HC 1333 | `route.uk-care` and `route.uk-skilled` `bandMin` 55 |
| Nurses' English | Real: a nurse who passed the English test the NMC accepts (IELTS Academic 7.0 or OET B) needs no other proof. The game leaves this way out: the nurse meets English as any applicant does | gov.uk, Health and Care Worker visa | none |
| English for Canada | CLB 7 in each of four abilities, from CELPIP-General, IELTS General Training or PTE Core, under 2 years old, with no exemption by degree or nationality. The game: one test stands for the three, band 60 (factor 1.0) | canada.ca, Express Entry language tests | route-gates:entering-the-pool |
| Nursing council verification fee | ₦66,875 | NMCN, 2026 | `activity.request-verification` cost 6687500 |
| Canada's authorisation to return | C$492.50, after repaying removal costs of C$3,840 (unescorted, from 1 Apr 2025) | IRCC fee list; IRPR s. 243 | `var.canada-arc-fee` 49250, `var.canada-removal-cost` 384000 (route-gates:canada-return-asks-authorisation) |
| Canada general cut-off, start | 405 | A working value: a bachelor's, band 7.0, a year of work and under thirty is one short and reaches it within two years; the game's scale, not the real one, where 2026 draws ran 508 to 547 | `var.canada-cutoff` 405 |
| Canada healthcare cut-off, start | 370 | The general start times 475 over 520, the real ratio of Jun to Sep 2026 | `var.canada-care-cutoff` 370 |
| Canada education cut-off, while the draw stands | 365 | The general start times 470 over 520: the mean of the two real education rounds (479 and 462) over the general rounds' 520, as the care cut-off is set | `var.canada-education-cutoff`: start 9999, no draw; `news.canada-education-draw` sets 365 (route-gates:pool-draws-invite) |
| Teacher's months the education draw reads | 12 | IRCC's category: 12 months in one of its occupations in the last three years (factor 1.0 on the months) | `points.canada.educationMonths` 12 |
| The family's gift for Canada | family means times ₦100,000: ₦3,000,000 at means 30, ₦6,000,000 at 60 | Working value; one third of the pledge's show, a gift where the pledge is a signature | `offer.family-gift-canada` terms (route-gates:family-gift-counts-with-deed) |
| The gift deed | ₦20,000 at a notary, 1 month | Working value (Not verified) | `activity.gift-deed` cost 2000000; `document.gift-deed` wait [1, 1] |
| A trust's nursing post, a month | 4%, open with the care window shut, care 60 | Working values; real international joiners to the NMC register fell 47% in 2025 to 2026 | `offer.sponsor-trust` chance 400 (route-gates:nurses-sponsored-while-care-shut) |
| Canada decision months | 6 | Working value | `var.canada-decision-months` 6 |
| Foreign work counts from | 12 months | The CRS grid | `points.canada.transfer.workMonths` 12 |
| Care cut-off read from | care 60 | Working value | `points.canada.careMin` 60 |
| Talent endorsement fee | £561 | Apr 2026 | `var.uk-talent-endorse-fee` 56100 |
| Talent visa fee | £205 | Apr 2026 | `var.uk-talent-visa-fee` 20500 |
| A tech firm's sponsored developer | 24 months across the developer jobs | Working value: no source found for what UK employers list for sponsored developer posts | `offer.sponsor-tech-firm` when |
| An agency's placed worker | 24 months across the ladder of the trade whose job is held | Working value: agencies place experienced workers, and a first job in a new trade is not that trade's record | `offer.sponsor-agency` when |
| An accountancy firm's sponsored accountant | the chartered accountant's rung or above, and 24 months across the accounting jobs | Chartered and certified accountants (2421) are an eligible occupation, higher skilled (gov.uk, 22 Jul 2025); the 24 months are a working value | `offer.sponsor-accounting-firm` when |
| An accountancy firm's salary and chance | £46,000 to £56,000 by £1,000; 4% a month | Working values about the occupation's standard going rate of £49,200 (gov.uk, 22 Jul 2025); the chance as the tech firm's | `offer.sponsor-accounting-firm` terms, chance 400 |
| Endorsement track record | 36 months across the developer jobs | Working value: the digital technology criteria ask a proven track record of innovation or recognition in the sector, which a first two years in work does not give | `activity.apply-endorsement` requires |
| Endorsement wait | 1 to 2 months | Tech Nation guidance, 5 to 8 weeks | `document.endorsement` wait [1, 2] |
| Endorsement validity | 3 months | gov.uk | `document.endorsement` validMonths 3 |
| Gulf agent fee | ₦900,000 to ₦1,800,000 | Working value from a reported loss of ₦450,000; charging workers recruitment fees is illegal in the UAE | `offer.gulf-agent` terms |
| Gulf guard pay | AED 1,500 to 2,200 a month, accommodation included | 2024 to 2025 listings | `offer.gulf-agent` terms |
| UAE window for Nigerians | Open; it was closed from Oct 2022 to Jul 2024 | Africanews, 17 Jul 2024 | `var.uae-window` start 2; the director's story closes it |
| Deception ban | 120 months | gov.uk | `country.uk.deceptionBanMonths` 120 |

## Qualities, documents and starting life

| Id | Kind | Values |
|---|---|---|
| `quality.care` | quality, skills, 0 to 100, counts toward no route | Nursing and care skill. A nurse starts at 60, a care assistant at 30 |
| `document.nursing-licence` | document | Never requested: a starting life holds it. Valid 36 months, renewed by `activity.renew-licence` at ₦25,000 |
| `document.nmcn-verification` | document | wait [6, 12], valid 24, requested by `activity.request-verification` at ₦66,875, the council's verification fee (reason `fee-document`), needs 24 months of nursing tenure |
| `document.eca`, `document.endorsement`, `document.medical` | document | As above |
| `document.gift-deed` | document | wait [1, 1], valid for good, requested by `activity.gift-deed` at ₦20,000 (reason `fee-document`) once the family's gift for Canada is taken (route-gates:family-gift-counts-with-deed) |
| `scenario.nurse` | scenario | The nurse, 27 (324), a staff nurse 30 months in (`activity.job-nurse`, ₦180,000), second upper, English 58, care 60, network 25, family means 30, standing 65, wellbeing 50, ₦650,000 bank, ₦30,000 cash, passport 40 months left, nursing licence 30 months left, upkeep ₦120,000, home support ₦40,000 |

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
- [Pakistan Bureau of Emigration: UAE security guard listings, AED 1,200 to 2,267](https://beoe.gov.pk/foreign-jobs/1279899/1498048/55-security-guards-required-in-united-arab-emirates-salary-1200-2267-dirham-aed), [Legit: a Nigerian's ₦450,000 loss to a Dubai agent](https://www.legit.ng/people/1472165-i-got-scammed-lied-my-parents-nigerian-lady-uaes-first-female-delivery-rider-opens-video/), [UAE government: charging workers recruitment fees is illegal](https://u.ae/en/information-and-services/jobs/Sector-of-employment/employment-in-the-private-sector/labour-rights)
- [Africanews: UAE lifts the 2022 visa ban](https://africanews.com/2024/07/17/uae-lifts-2022-visa-ban-on-nigerians)

Read on 23 Oct 2026:

- [GOV.UK: Skilled Worker visa, knowledge of English](https://www.gov.uk/skilled-worker-visa/knowledge-of-english), [GOV.UK: Health and Care Worker visa, knowledge of English](https://www.gov.uk/health-care-worker-visa/knowledge-of-english)
- [Canada.ca: Express Entry language tests](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html)
- [IRCC: fee list](https://ircc.canada.ca/english/information/fees/fees.asp), the application fee from 30 Apr 2026 and the authorisation to return
- [NMCN: verification](https://www.nmcn.gov.ng/verify.html)

Read on 24 Oct 2026:

- [GOV.UK: Skilled Worker visa, eligible occupations and codes](https://www.gov.uk/government/publications/skilled-worker-visa-eligible-occupations/skilled-worker-visa-eligible-occupations-and-codes) and [going rates](https://www.gov.uk/government/publications/skilled-worker-visa-going-rates-for-eligible-occupations/skilled-worker-visa-going-rates-for-eligible-occupation-codes), both 22 Jul 2025: 2421, chartered and certified accountants, higher skilled, standard going rate £49,200 (£25.23 an hour). route-gates:sponsor-offers-come-up.
- [GOV.UK: Global Talent visa, digital technology](https://www.gov.uk/global-talent-digital-technology): the endorsement asks applicants to show a track record of innovation or recognition as a leader or an emerging leader in digital technology. route-gates:applying-for-endorsement.

- [IRCC: proof of funds](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/proof-funds.html): C$15,263 for one person, updated 7 Jul 2025; "you can't borrow this money from another person"; held when you apply and when the visa is issued. route-gates:family-gift-counts-with-deed, route-gates:canada-funds-checked-at-departure.
- [Liberty Immigration: proof of funds 2026](https://libertyimmigration.ca/express-entry-proof-of-funds-2026-updated-settlement-fund-requirements/), [Panel Physician: proof of funds for Express Entry](https://www.panelphysician.ca/blog/proof-of-funds-express-entry-how-much-you-need): a gift counts with a gift deed, as consultancies report. route-gates:family-gift-counts-with-deed.
- [IRCC: category-based selection](https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html), modified 16 Oct 2026: the education category's five occupations and its 12 months of work. route-gates:pool-draws-invite.
- [IRCC: Express Entry rounds of invitations](https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds.html) (its data file of rounds): the education rounds of 1 May 2025 (1,000, CRS 479) and 17 Sep 2025 (2,500, CRS 462); none in 2026 to 16 Oct; the Canadian experience rounds of 2026 at 514 to 523, the healthcare rounds of 25 Jun and 4 Sep 2026 at 475. route-gates:pool-draws-invite.
- [GOV.UK: Health and Care Worker visa](https://www.gov.uk/health-care-worker-visa), and the NMC's [annual data report](https://www.nmc.org.uk/globalassets/sitedocuments/data-reports/march-2025/annual-data-report-march-2025.pdf): nurses still sponsored from abroad; joiners from abroad falling. route-gates:nurses-sponsored-while-care-shut.

## Not verified

- Gift deeds for Canada: IRCC's page says nothing of gifts; the practice is reported by consultancies.
- The endorsement chance and the sponsor offer rates are working values with no source. Simulated play tunes them.
- Whether the UK care route will reopen to care workers applying from abroad. The window var models it either way.

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `route/record-sponsor` | effect | Records a sponsor, agent or connection on a gate route; `fraud` is kept hidden (route-gates:taking-sponsor-records-it, route-gates:gulf-agent-offer) |
| `route/enter-pool` | effect | Enters the points pool, from `activity.enter-pool` (route-gates:entering-the-pool) |
| `route/gate-step` | requirement | The route's gate has reached the named `step` (`sponsor` for a sponsor or agent recorded) |
