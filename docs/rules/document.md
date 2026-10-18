# Documents

> Fees, waits and validity are from `../research/09-uk-masters-numbers.md`.
> Kind: `document`. Many per character. Papers are a kind of their own because they have queues and expiry dates that qualities do not.

A document is something the character can show: a passport, a test result, a certificate. Each has a wait before it is issued and, usually, a date it runs out.

## Rules

**document:request-starts-pending** Requesting a document starts it pending, due after a wait drawn between the entry's two figures. The fee is the cost of the activity that requests it.

**document:due-document-issued** In the `papers` phase, a pending document whose month has come is issued: it is held from that month and, if the entry has a validity, expires that many months later. A wait of zero issues it at the first `papers` phase after the request: the same turn for a request made in the turn, the next month end for one made between turns.

**document:expired-document-not-held** In the `papers` phase, a held document whose expiry month has come becomes expired. The expiry month is the first month it does not count, from the start of that month, so a requirement judged in that month before `papers` runs already sees it as not held. An expired document does not count as held.

**document:one-pending-copy** Only one copy of a document can be pending. Requesting a document that is held leaves the held one in force until the new one is issued and replaces it. A paper that runs out is taken last. Japa's line for the TB step says how long it lasts, from the entry's validity, and that it is taken last, when the application is near; the nudge never points at the TB test before the file's other steps are met (world:nudge-says-one-thing); and while the plan's application is not sent, a paper its checklist reads that runs out within two months gets one line on the month's results ("Your TB test certificate runs out in 2 months.").

**document:english-test-band-value** An English test result takes its value when it is issued: 40, plus 35 for every 100 points of English rounded down, plus a draw of -5, 0 or +5. The value is a band times ten, moved down to the nearest 5, and kept between 40 and 90.

**document:grant-and-void-commands** `document/grant` issues a document at once. `document/void` removes it, held or pending.

**document:police-certificate-for-routes** The police character certificate: a paper the routes ask for that take one (`route.canada-points`, `route.uk-skilled`, `route.uk-care`, `route.gulf-contract`: their checklists hold it; the master's does not), requested at the police station's desk (staged at the visa centre's notice) for ₦5,000 with a wait of 1 to 3 months, valid 12 months. The chaser (advice:chaser-runs-around-cheaper) and the fixer can bring it forward.

**document:paper-on-its-way** A paper is on its way while a copy is being made: pending, or held with a new copy requested (document:one-pending-copy). The view carries each paper's `onItsWay`, the month that copy is due, or null when none is being made, and every screen that says a paper is coming reads it (the papers list, Japa and its reminders, the coming list). A held paper on its way is not warned of as expiring soon: its new copy is coming. The phone's Papers app (world:phone-holds-what-phones-hold) is the papers list, and it says a paper on its way the same way for a first copy and a renewal. The requests that are a call or a message (the transcript, the credential assessment, the council's verification, the licence's renewal) are made from Papers; the passport is asked for at the passport office in Ikoyi; the other papers at their places. A paper issued, run out, made void, requested or brought forward at the month's end is told on the phone (world:month-passes-as-lived).

## Entries

| Id | Name | Wait | Valid for | Value |
|---|---|---|---|---|
| `document.passport` | Passport | 1 to 3 months | 60 months | |
| `document.transcript` | Degree transcript | 1 to 4 months | For good | |
| `document.english-test` | English test result | 1 month | 24 months | The band times ten |
| `document.tb-certificate` | TB test certificate | None | 6 months | |
| `document.cas` | Confirmation from the university | Granted by the route | For good | |
| `document.police-certificate` | Police character certificate | 1 to 3 months (`activity.get-police-certificate`, ₦5,000, document:police-certificate-for-routes) | 12 months | |
| `document.nurse-certificate` | Nursing certification | 2 months (`activity.nurse-certification`, activity:waiting-months-build-profile) | For good | |

## Numbers

| Setting | Value | In content as |
|---|---|---|
| Band base | 40 | `tuning.english.base` |
| Band for every 100 points of English | 35 | `tuning.english.perHundred` |
| Noise steps of 5 either way | 1 | `tuning.english.noiseSteps` |
| Lowest and highest band | 40 and 90 | `tuning.english.min`, `tuning.english.max` |
| Band step, the band times ten | 5 | `tuning.english.bandStep` |

English 60 gives band 6.0 on an even draw. English 72 gives 6.5. English 86 gives 7.0.

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
