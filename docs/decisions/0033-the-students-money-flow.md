# 0033. The student's money flow

Status: Accepted

## Context

Tuition owed in three instalments, in course months 1, 4 and 7, with one default withdrawing the student at once, breaks 52 of 64 students in simulated play, every borrower among them, most within 1 to 7 months: a first instalment of about £3,667 to £4,334 meets a part-time surplus of about £400, held funds go back to the lender at the flight, and a pledge that only counts cannot be spent. In life most Nigerian students complete and go on to the Graduate route, and those who fail are the ones without the money they showed. Universities take half at enrolment and the rest monthly, and a missed payment runs through reminders, a cut of access, a payment plan and a final warning before withdrawal; the Home Office then cuts the permission to 60 days. A regulated education loan counts toward the funds (Appendix Finance FIN 8.3(c)(iii)), and lenders that lend to Nigerian students for a master's abroad pay the school direct. The Graduate visa costs £937 and its surcharge. `../design/13-the-economy.md` section 7 gives the design.

## Decision

- **Half at enrolment and four monthly instalments** (abroad-money:tuition-paid-in-instalments): `obligation.tuition` carries a `schedule` by course month in place of a term and a grace.
- **The pledge pays the school** (route:family-pledge-pays-tuition): a tuition charge the student's pounds cannot meet is met from the family's pledge while it stands, landing under `gift` and paid at once.
- **A missed payment is a sequence** (abroad-money:missed-tuition-runs-in-stages, status:course-passed-or-withdrawn): a reminder; the access cut and `offer.fee-payment-plan`; a final warning; withdrawal only after two plan payments missed in a row, or four months in arrears with no plan; then two months on the student status in which paying everything reinstates, and a new course or a sponsor's job may be taken. `obligation/pay` takes tuition arrears (obligation:paying-down-obligations).
- **Work as the rules allow** (status:status-sets-work-rule, ladders:student-holds-one-part-job): full-time pay in the Christmas and Easter months, and any job from course month 13.
- **The Graduate visa is applied for and paid** (status:graduate-visa-applied-for): `activity.apply-graduate` from course month 13 or in the grace, at `var.uk-graduate-fee` plus the surcharge; the student status no longer moves on by itself.
- **A regulated education loan, on the master's route** (route:education-loan-pays-the-school): `offer.education-loan` once the deposit is paid; it pays the school, lowers the funds required and the tuition owed, adds nothing to the unexplained share, and is repaid in pounds from the Graduate status at a flat rate set near the lender's representative rate. The lender's show-money says on its card that it goes back at the flight and the fees stay due.

## Consequences

- A careful student, and most pledged ones, complete; a student who arrived on borrowed show-money with nothing of their own still meets withdrawal, after every warning (scenario:economy-meets-its-targets, the seventh measure).
- Every recorded life that studies abroad replays its tuition, its work and its move to the Graduate status differently from its first course month: the master's lives among the goldens and the recorded lives move from their flight.
- New state: the course's months counted, `coursePassed` on the status slice, the stage of a missed payment, the route's `loanPaid`; new content: the schedule, the plan's offer, the loan's offer and obligation, the Graduate fee var. A state saved under the old tuition is carried by the upgrade as a schedule of its remaining charges (server:upgrade-state-is-pure).
- The obligations table of page 01 and status.md describe the sequence, not a cliff.

## Alternatives

- **Withdrawal at the first default.** Teesside withdrew students so in 2024, and was told its own multi-step policy had not been followed; it breaks careful students with a pledge, where life sees most complete.
- **Let the held-funds loan stay with the student abroad.** The lender takes its money back at the flight in life; the show-money is not a loan for fees, and its card says so.
- **The pledge as money in the student's own account.** It would make the family's signature spendable on anything; paying the school only, the shortfall only, is the parent's account the visa counted.
- **No education loan.** It leaves the master's to the family, a dollar rung or the land; the regulated loan is real, counts for the visa, and costs what a fifteen-year loan costs.
