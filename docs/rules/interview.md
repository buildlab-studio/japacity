# The genuineness interview

> The bans are the real ones, from the Sources at the end; the scoring figures are working values.
> Kind: `interview`, one open at a time per character. Rests on `person.md` (bonds, moments, facts, the stand-in), `pair.md` (the record), `route.md` (route:open-set-piece-holds-month) and `route-gates.md` (route-gates:deception-bans-country). Background: `../design/01-concept.md` section 6, `../research/05-real-people-family-and-safety.md` section 5.
> For game design. Not immigration advice.

A route that rests on a relationship ends in an interview (on the dependant route, only when the record is thin): both partners answer questions about their shared history separately, and the answers are compared. The questions come from the pair's own record: where they met, what they did, what was last said. A couple who lived that history answer alike. A marriage made only for papers is a choice the game allows; a thin record with answers that do not match is how it is caught, and both partners then carry a long ban.

## Opening the interview

**interview:partner-application-opens-interview** Sending an application on the `partner` gate (person:partner-gate-needs) opens the interview in the applicant's life at once. With a real sponsor, the authority sends `interview/open`, with the same questions and options, to the sponsor's life in the same transaction. With a computer sponsor, the computer's answers are made at once (interview:computer-answers-by-recall).

**interview:thin-record-triggers-interview** Sending an application on the `dependant` gate opens the interview only when the record is thin: fewer than `tuning.interview.thinMoments` moments, or the bond at `partner` or `married` for fewer than `tuning.interview.thinMonths` of the applicant's months. Officers call couples in where the evidence has gaps, so a dependant with a long shared history is not interviewed.

**interview:questions-drawn-from-record** Opening draws `tuning.interview.ask` questions without repeats, on stream `visa` in the applicant's life, from the question entries whose `needs` the record meets. Each question's truth is worked out from the record and the facts at that moment, according to its `about`. Its options are the truth plus `tuning.interview.decoys` others drawn on `visa` from the question's list (never the truth twice), in an order drawn on `visa`. A `plans` question has no truth: its options are its whole list. The questions and options are fixed at opening and are the same in both lives.

## Answering

**interview:answers-taken-in-order** `interview/answer` (`question`, `option`) must name the first question not yet answered and one of its options; anything else is rejected with `not-legal`. While an interview is open in a life, `turn/end` there is rejected with `setpiece-open`, as route:open-set-piece-holds-month does for a set piece, and other commands work as usual. After the last answer the interview closes in that life, its answers are kept, and the authority copies them into the record. In the world, the bed refuses sleep while the interview waits, and the ask's line opens the questions one at a time. After the last answer the asks close, the `ding` cue plays, and the officer's toast "Your answers are in." stands under the band for about three seconds (a `SaidToast` drawn as the chapter brief's toast, with the officer's name pill and the desk's tile). The interview card is drawn as an ask: the desk's tile and the officer's pill at the head, the question as the title, content's `interview.genuineness.blurb` as the line, the chips For {route} and Question n of total, and the options as the ask's buttons with no main one. The waiting, stand-in and result states are drawn the same way. The region keeps its name for screen readers.

**interview:one-question-at-a-time** The view shows one question at a time with its options, and never a score, a truth or the other side's answers. While an interview is open, the bond's moments are left out of the view, so each partner answers from memory, and the bond's header says the times together are hidden. After the result it shows the result and the number of answers that matched, never which ones.

**interview:answers-scored-without-draw** When both sets of answers are in, the authority sends `interview/scored` with the other side's answers to both lives, and each life works out the same result with no draw. A question about the couple matches when the two answers are the same; a question about the other person matches when each side's answer is the truth about the other. `matchBp` is the matches times 10000 over the questions asked. The result is `pass` at `tuning.interview.passBp` or more, `doubt` at `tuning.interview.failBp` or more, and `fail` below that. It is `caught` instead when the record is thin (by interview:thin-record-triggers-interview's measure) and the result is not `pass`, or when `matchBp` is under `tuning.interview.caughtBelowBp` whatever the record.

**interview:computer-answers-by-recall** A computer's answers are made in the player's life when the interview opens, on stream `people`, and kept in `secret`. A question with a truth gets the truth at the computer's `recallBp`, and otherwise one of the decoys; a `plans` question gets the computer's `plan`. The comparison runs when the player gives their last answer. A papers partner (person:papers-marriage-offer) recalls at 2000 over a record with no moments.

**interview:stand-in-answers-when-absent** When the stand-in is `on` (person:stand-in-after-absence) for a side that has not finished, the stand-in answers in that life with the sender `stand-in`: the truth at `tuning.interview.standInRecallBp`, drawn on that life's stream `people`, otherwise a decoy. On a `plans` question it gives the waiting side's answer, if that is in, at the same chance, and otherwise the first option. Both views mark the interview as answered by a stand-in. The stand-in answers as a partner who lived the history would, so the waiting player is neither punished nor rewarded for the other's absence.

## Results

**interview:result-applies-to-application** The result applies to the application that opened the interview, in each life, in that life's own months. `pass`: nothing more. `doubt`: the refusal chance rises by `tuning.interview.doubtBp`. `fail`: refused with the reason `relationship`, with no draw. `caught`: refused with the reason `sham`, and route-gates:deception-bans-country applies (every route into that country in that life is `refused` until the month plus the country's `deceptionBanMonths`); standing falls by `tuning.interview.caughtStanding`. A partner application waits for the result (person:partner-application-decided); a dependant application without an interview never waits.

**interview:caught-sponsor-carries-bar** When the interview is `caught`, a sponsor already living in the country keeps their status but carries the ban as a bar: `people/propose` for a joint with them as sponsor is not legal until the month the applicant's ban ends. The view's `barUntilMonth` shows the later of this bar and the bar of undertaking:sponsored-arrivals-wait-to-sponsor. Removing a settled sponsor is a separate legal process the game does not model; the bar keeps the cost on both records.

**interview:players-answer-at-own-pace** Two real players answer at different times. The first to finish carries on with their life, and the view says the interview is waiting for the other. If the bond ends before both have answered, the interview closes unscored and the application is withdrawn (person:joint-collapses-with-bond). Because of the stand-in (interview:stand-in-answers-when-absent), the wait is never longer than `tuning.people.standInDays` real days.

**interview:draws-made-in-one-life** Every draw for an interview is made in one life: the questions in the applicant's, a computer's answers in the player's, a stand-in's in the absent side's. The comparison reads no hidden field and draws nothing, so both lives reach the same result, and a replay of either life alone reaches it again.

## Entry: the questions

`interview.genuineness` asks 5 questions. For a question about `couple`, the two answers are compared with each other. For a question about `other`, each answer is compared with the truth about the other person.

| Question | Words | About | Truth | Needs | Options drawn from |
|---|---|---|---|---|---|
| `first-spot` | "Where did you first meet?" | couple | the spot of the first `met` moment | one `met` moment | the spots |
| `first-what` | "What did you do the first time you met?" | couple | the what of the first `met` moment | one `met` moment | the whats |
| `last-spot` | "Where did you last see each other?" | couple | the spot of the latest `met` moment | two `met` moments | the spots |
| `times-met` | "How many times have you met in person?" | couple | the band of the count of `met` moments | none | `not-yet`, `one-to-three`, `four-to-eight`, `nine-to-fifteen`, `sixteen-or-more` |
| `wedding-spot` | "Where was the wedding?" | couple | the spot of the `wedding` moment | the bond `married` with a `wedding` moment | the wedding spots |
| `calls` | "How do you keep in touch when you are apart?" | couple | the what most used in `call` moments | three `call` moments | the calls |
| `partner-job` | "What does your partner do for work?" | other | the other's `job` in the facts, or `no-job` | none | every job's name, and `no-job` |
| `partner-home` | "Where is your partner's family from?" | other | the other's `home` | none | `city`, `town`, `not-sure` |
| `last-said` | "What did your partner last say to you?" | other | the latest `said` moment by the other | one `said` moment by each side | the phrases |
| `plans` | "Where will you live together?" | couple | none | none | `uk`, `canada`, `with-you-abroad`, `home`, `not-decided` |

Text keys: `interview.genuineness.q.<question>` and `interview.genuineness.a.<question>.<option>`, with the spots, whats, jobs and phrases reusing their own names.

## Numbers

| Setting | Value | Source or "working value" | In content as |
|---|---|---|---|
| Questions asked | 5 | working value | `tuning.interview.ask` |
| Decoys beside the truth | 3 | working value | `tuning.interview.decoys` |
| Pass | 70% matched | working value | `tuning.interview.passBp` 7000 |
| Doubt down to | 40% matched | working value | `tuning.interview.failBp` 4000 |
| Caught whatever the record | under 20% | working value | `tuning.interview.caughtBelowBp` 2000 |
| Thin record | under 8 moments or under 6 months together | working value | `tuning.interview.thinMoments`, `thinMonths` |
| Refusal added on doubt | 30% | working value | `tuning.interview.doubtBp` 3000 |
| Stand-in recall | 80% | working value | `tuning.interview.standInRecallBp` 8000 |
| Standing lost when caught | 15 | working value | `tuning.interview.caughtStanding` |
| UK ban after deception | 10 years | gov.uk suitability guidance, 11 Nov 2025 | `country.uk.deceptionBanMonths` 120 |
| Canada ban after misrepresentation | 5 years | Immigration and Refugee Protection Act, s. 40(2)(a) | `country.canada.deceptionBanMonths` 60 |

## Why it is built this way

- **Real interviews are separate and compare accounts.** UK investigation officers may interview each party alone, together or both, about the background, history and living arrangements of the relationship and its future plans. Canadian officers may interview the sponsor and the applicant separately and record every question and answer.
- **Canada's rule names the two failures the result tracks**: a relationship that is not genuine, or one entered mainly to gain status.
- **A couple who agree their answers outside the game can pass**, as a coached couple can in life. The record still counts: a thin record fails unless the answers are near perfect, and a deep record is never caught for a poor memory, only refused.

## Sources

All read on 8 Oct 2026.

- [GOV.UK: Marriage and civil partnership referral and investigation scheme, statutory guidance, version 4.0, 31 Mar 2025](https://www.gov.uk/government/publications/marriage-and-civil-partnership-referral-and-investigation-scheme/marriage-and-civil-partnership-referral-and-investigation-scheme-statutory-guidance-for-home-office-staff-accessible-version): notice extended from 28 to 70 days on investigation; interviews alone, together or both; topics; refusals and enforcement after a sham finding.
- [GOV.UK: Part Suitability, deception and false representations, version 1.0, 11 Nov 2025](https://www.gov.uk/government/publications/suitability-false-representations-immigration-staff-guidance/part-suitability-deception-false-representations-false-documents-and-non-disclosure-of-relevant-facts-accessible): future applications refused for 10 years after deception.
- [canada.ca: Assessing the relationship between spouses or common-law partners](https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/permanent-residence/non-economic-classes/family-class-determining-spouse/assessing-relationship.html): separate interviews, questions and answers recorded.
- [Justice Laws: Immigration and Refugee Protection Regulations, s. 4](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/section-4.html): bad faith relationships.
- [Justice Laws: Immigration and Refugee Protection Act, s. 40](https://laws-lois.justice.gc.ca/eng/acts/i-2.5/section-40.html): misrepresentation, five years.

## Not verified

- The ten-year UK refusal period's start date: commentators differ between the date of refusal and the date of departure. The game counts from the month of the refusal.
- How often officers in either country catch a sham marriage. The scoring figures are working values.

## Contract

1. `KindName` holds `interview`. `Content` holds `interview: Record<Id<"interview">, InterviewEntry>` with `InterviewEntry`: `{ id: Id<"interview">; ask: number; questions: { id: string; about: "couple" | "other"; truth: "first-spot" | "first-what" | "last-spot" | "times-met" | "wedding-spot" | "calls" | "job" | "home" | "last-said" | null; needs: { met?: number; calls?: number; saidEach?: number; married?: boolean }; options: string[] | "spots" | "whats" | "calls" | "wedding-spots" | "jobs" | "phrases" }[] }`.
2. `InterviewSlice`: `{ open: { pair: string; route: Id<"route">; questions: { id: string; options: string[] }[]; answers: string[]; standIn: boolean } | null; last: { route: Id<"route">; result: InterviewResult; matched: number; asked: number; month: number } | null; secret: { truths: (string | null)[] | null } }`. `State` holds `interview`. A computer's answers sit in `people.secret.computerAnswers`.
3. `InterviewResult`: `"pass" | "doubt" | "fail" | "caught"`.
4. `PairInterview` (on the pair record): `{ route: Id<"route">; questions: { id: string; options: string[] }[]; answers: { a: string[] | null; b: string[] | null }; standIn: { a: boolean; b: boolean }; result: InterviewResult | null }`.
5. Commands: `interview/answer` (`question`, `option`) from a player or the stand-in; `interview/open` (`pair`, `route`, `questions`) and `interview/scored` (`pair`, `theirs`: string[]) from the authority only.
6. Events: `interview/opened`, `interview/answered`, `interview/closed`, `interview/scored`, `interview/withdrawn`.
7. Route refusal reasons include `relationship`, `sham` and `lead` (person:dependant-application-decided).
8. View: `PlayerView.interview`: `{ route: Id<"route">; question: { id: string; options: string[] } | null; asked: number; total: number; waiting: boolean; standIn: boolean; result: InterviewResult | null; matched: number | null } | null`.
9. Tuning: `interview: { ask: number; decoys: number; passBp: number; failBp: number; caughtBelowBp: number; thinMoments: number; thinMonths: number; doubtBp: number; standInRecallBp: number; caughtStanding: number }`.
10. Content: `country.canada.deceptionBanMonths` is 60.
