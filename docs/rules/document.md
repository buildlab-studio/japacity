# Documents

> Fees, waits and validity are from `../research/09-uk-masters-numbers.md` and `../research/01-japa-journey.md`; where the game differs from real life, the real value and the factor stand beside it.
> Kind: `document`. Many per character. Papers are a kind of their own because they have queues and expiry dates that qualities do not.

A document is something the character can show: a passport, a test result, a certificate. Each has a wait before it is issued and, usually, a date it runs out.

## Rules

**document:request-starts-pending** Requesting a document starts it pending, due after a wait drawn between the entry's two figures. The fee is the cost of the activity that requests it.

**document:due-document-issued** In the `papers` phase, a pending document whose month has come is issued: it is held from that month and, if the entry has a validity, expires that many months later. A wait of zero issues it at the first `papers` phase after the request: the same turn for a request made in the turn, the next month end for one made between turns.

**document:expired-document-not-held** In the `papers` phase, a held document whose expiry month has come becomes expired. The expiry month is the first month it does not count, from the start of that month, so a requirement judged in that month before `papers` runs already sees it as not held. An expired document does not count as held.

**document:one-pending-copy** Only one copy of a document can be pending. Requesting a document that is held leaves the held one in force until the new one is issued and replaces it. A paper that runs out is taken last. Japa's line for the TB step says how long it lasts, from the entry's validity, and that it is taken last, when the application is near; the nudge never points at the TB test before the file's other steps are met (world:nudge-says-one-thing); and while the plan's application is not sent, a paper its checklist reads that runs out within two months gets one line on the month's results ("Your TB test certificate runs out in 2 months.").

**document:english-test-band-value** An English test result takes its value when it is issued: 40, plus 35 for every 100 points of English rounded down, plus a draw of -5, 0 or +5. The value is a band times ten, moved down to the nearest 5, and kept between 40 and 90.

**document:degree-english-statement** The degree's English statement. `document.degree-english` is requested by `activity.degree-english`, a now-act made from the Papers app (document:paper-on-its-way), which needs a bachelor's degree and the statement neither held nor being made, and costs ₦150,000 with the reason `fee-document`. It is issued after 1 month, never expires and carries no value: it always passes. It meets the English of the UK work routes (route-gates:sponsor-application-needs) and of the partner route (person:partner-gate-needs). Real: Ecctis confirms that a degree from abroad was taught in English for £210 plus £42 VAT (£252, about ₦458,800 at ₦1,820.79 to the pound on 23 Oct 2026) in 20 working days, with no fast track. The game charges about a third of the real fee and keeps the real wait (factor 1.0).

**document:who-sits-the-english-test** The English test is for the routes that ask a band: Canada's pool at band 60 (route-gates:entering-the-pool), the UK work routes at band 55 for an applicant with no degree statement, and the partner route at band 30 for one with no degree. A graduate needs it for none of the UK routes (route:degree-meets-masters-english, document:degree-english-statement, person:partner-gate-needs). `activity.sit-english-test` costs ₦295,000, the fee for IELTS for UKVI from 15 Jul 2025; one test stands for every test each country accepts.

**document:grant-and-void-commands** `document/grant` issues a document at once. `document/void` removes it, held or pending.

**document:police-certificate-for-routes** The police character certificate: a paper the routes ask for that take one (`route.canada-points`, `route.uk-skilled`, `route.uk-care`, `route.gulf-contract`: their checklists hold it; the master's does not), requested at the police station's desk (staged at the visa centre's notice) for ₦5,000 with a wait of 1 to 3 months, valid 12 months. The chaser (advice:chaser-runs-around-cheaper) and the fixer can bring it forward.

**document:paper-on-its-way** A paper is on its way while a copy is being made: pending, or held with a new copy requested (document:one-pending-copy). The view carries each paper's `onItsWay`, the month that copy is due, or null when none is being made, and every screen that says a paper is coming reads it (the papers list, Japa and its reminders, the coming list). A held paper on its way is not warned of as expiring soon: its new copy is coming. The phone's Papers app (world:phone-holds-what-phones-hold) is the papers list, and it says a paper on its way the same way for a first copy and a renewal. The requests that are a call or a message (the transcript, the credential assessment, the council's verification, the licence's renewal, the degree's English statement) are made from Papers; the passport is asked for at the passport office in Ikoyi; the other papers at their places. A paper issued, run out, made void, requested or brought forward at the month's end is told on the phone (world:month-passes-as-lived).

**document:trade-papers** The papers of a trade, each the key to a rung (activity:each-trade-climbs-its-ladder). `document.trcn`, the teaching registration, is requested from the Papers app by `activity.get-trcn` (a bachelor's degree; ₦25,000 under `fee-document`; a wait of 2 months) and never expires; the senior teacher's rung asks it. `document.ican`, the chartered exams, is earned by `activity.ican-exams`, a month-act holding one slot for 18 months (a bachelor's degree): at its 6th, 12th and 18th month a sitting, each paid on the day (₦50,000 under `fee-test`) and sat as a short quiz set piece of three questions from the trade's facts with a pass at two, as the nurse's certification is (activity:waiting-months-build-profile); a failed sitting is sat again six months on, and a sitting that cannot be paid waits for the next. Passing the third requests `document.ican` with no wait; it never expires, the chartered accountant's rung asks it, and it adds nothing to Canada's points table, which reads degrees. `document.gift-deed` is the family gift's paper (route-gates:family-gift-counts-with-deed).

## Entries

| Id | Name | Wait | Valid for | Value |
|---|---|---|---|---|
| `document.passport` | Passport | 1 to 3 months | 60 months | |
| `document.transcript` | Degree transcript | 1 to 4 months | For good | |
| `document.english-test` | English test result | 1 month | 24 months | The band times ten |
| `document.degree-english` | Your degree's English statement | 1 month (`activity.degree-english`, ₦150,000, document:degree-english-statement) | For good | None: it always passes |
| `document.tb-certificate` | TB test certificate | None | 6 months | |
| `document.cas` | Confirmation from the university | Granted by the route | For good | |
| `document.police-certificate` | Police character certificate | 1 to 3 months (`activity.get-police-certificate`, ₦5,000, document:police-certificate-for-routes) | 12 months | |
| `document.nurse-certificate` | Nursing certification | 2 months (`activity.nurse-certification`, activity:waiting-months-build-profile) | For good | |
| `document.trcn` | Teaching registration | 2 months (`activity.get-trcn`, ₦25,000, document:trade-papers) | For good | |
| `document.ican` | Chartered accountant | None, on passing the third sitting (`activity.ican-exams`, document:trade-papers) | For good | |

The other nine documents are entered on the pages of the routes and things that ask for them: `document.eca`, `document.endorsement`, `document.medical`, `document.nursing-licence`, `document.nmcn-verification` and `document.gift-deed` in `route-gates.md`, `document.nmc-pin` in `ladders.md`, and `document.home-licence` and `document.uk-licence` in `car.md`. All nineteen are in `packages/content/src/document/document.data.ts`.

## Numbers

| Setting | Value | In content as | Source |
|---|---|---|---|
| Band base | 40 | `tuning.english.base` | Working value |
| Band for every 100 points of English | 35 | `tuning.english.perHundred` | Working value |
| Noise steps of 5 either way | 1 | `tuning.english.noiseSteps` | Working value |
| Lowest and highest band | 40 and 90 | `tuning.english.min`, `tuning.english.max` | Working value; real IELTS bands run 0 to 9 |
| Band step, the band times ten | 5 | `tuning.english.bandStep` | IELTS reports half bands |
| The English test's fee | ₦295,000 | `activity.sit-english-test` cost 29500000 | IELTS for UKVI from 15 Jul 2025 (IELTS on computer ₦279,500), British Council Nigeria (`../research/01-japa-journey.md`); the real fee, factor 1.0 |
| The degree's English statement | ₦150,000 and 1 month | `activity.degree-english` cost 15000000; `document.degree-english` wait [1, 1] | Real: Ecctis, £252 (about ₦458,800) and 20 working days (Gherson, 7 May 2025); the game charges about a third of the fee and keeps the wait |

| Teaching registration | ₦25,000 and 2 months | `activity.get-trcn` cost 2500000; `document.trcn` wait [2, 2] | Working value; the real fee was not found (Not verified) |
| The chartered exams | ₦50,000 a sitting, three sittings 6 months apart, a pass at two of three questions | `activity.ican-exams` | Working value; no official 2026 schedule was found, and unofficial figures give ₦8,500 to ₦9,800 a paper plus ₦15,000 registration (Not verified) |

English 60 gives band 6.0 on an even draw. English 72 gives 6.5. English 86 gives 7.0.

## Sources

- [British Council Nigeria: IELTS questions](https://www.britishcouncil.org.ng/exam/ielts/book-test/ielts-faqs-frequently-asked-questions), the fees from 15 Jul 2025, as `../research/01-japa-journey.md` gives them
- [Gherson: Ecctis update, new qualification and language service and higher fees, 7 May 2025](https://www.gherson.com/blog/ecctis-update-new-qualification-and-language-service-and-higher-fees)

## Not verified

- The teaching registration's fee and wait, and the chartered exams' fees and schedule, are working values: no official figure for 2026 was found.

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `document/request` | effect | Starts making the document: issued after a draw between its `wait` months on stream `document` (document:request-starts-pending) |
| `document/grant` | effect | Issues the document at once, replacing whatever was there |
| `document/void` | effect | Takes the document away |
| `document/held` | requirement | Held and in date, with a value of at least `min` when given |
| `document/absent` | requirement | Neither held nor being made |
| `document/pending` | requirement | Being made now |
