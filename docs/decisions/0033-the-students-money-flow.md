# 0033. A student's tuition, work and Graduate visa

Status: Accepted

## Context

**The old rule broke most students.**

- Tuition was owed in three instalments, in course months 1, 4 and 7, and one default withdrew the student at once.
- In simulated play this broke 52 of 64 students, every borrower among them, most within 1 to 7 months:
  - a first instalment of about £3,667 to £4,334 met a part-time surplus of about £400;
  - held funds went back to the lender at the flight;
  - a pledge that only counted could not be spent.

**Real life is gentler.**

- Most Nigerian students complete and go on to the Graduate route. Those who fail are the ones without the money they showed.
- Universities take half at enrolment and the rest monthly.
- A missed payment runs through reminders, a cut of access, a payment plan and a final warning before withdrawal. The Home Office then cuts the permission to 60 days.
- A regulated education loan counts toward the funds (Appendix Finance FIN 8.3(c)(iii)). Lenders that lend to Nigerian students for a master's abroad pay the school direct.
- The Graduate visa costs £937 and its surcharge.

`../design/13-the-economy.md` section 7 gives the design.

## Decision

**Half at enrolment and four monthly instalments** (abroad-money:tuition-paid-in-instalments). `obligation.tuition` carries a `schedule` by course month in place of a term and a grace.

**The pledge pays the school** (route:family-pledge-pays-tuition):

- each charge the school makes, the enrolment deposit at home included, is met from the family's pledge first while any of it is left;
- it is credited under `gift` and paid at once;
- the student's own money meets only what the pledge no longer covers.

**A missed payment is a sequence** (abroad-money:missed-tuition-runs-in-stages, status:course-passed-or-withdrawn):

- a reminder;
- the access cut, and `offer.fee-payment-plan`;
- a final warning;
- withdrawal only after two plan payments missed in a row, or four months in arrears with no plan;
- then two months on the student status, in which paying everything reinstates, and a new course or a sponsor's job may be taken;
- `obligation/pay` takes tuition arrears (obligation:paying-down-obligations).

**Work as the rules allow** (status:status-sets-work-rule, ladders:student-holds-one-part-job): full-time pay in the Christmas and Easter months, and any job from course month 13.

**The Graduate visa is applied for and paid** (status:graduate-visa-applied-for):

- `activity.apply-graduate`, from course month 13 or in the grace, at `var.uk-graduate-fee` plus the surcharge;
- the student status does not move on by itself.

**A regulated education loan, on the master's route** (route:education-loan-pays-the-school):

- `offer.education-loan` comes up once the deposit is paid;
- it pays the school, lowers the funds required and the tuition owed, and adds nothing to the unexplained share;
- it is repaid in pounds from the Graduate status, at a flat rate set near the lender's representative rate;
- the lender's show-money says on its card that it goes back at the flight and the fees stay due.

## Consequences

**For players:**

- A pledged student's own money and pay are left for the living while the pledge lasts. The pledge, not the student's pounds, meets the deposit and the instalments, so a covered student is not left with nothing at each month's end.
- A careful student, and most pledged ones, complete. A student who arrived on borrowed show-money with nothing of their own still meets withdrawal, after every warning (scenario:economy-meets-its-targets, the seventh measure).
- The obligations table of `../design/01-concept.md` and `../rules/status.md` describe the sequence, not a cliff.

**The Graduate application:**

- It reads the course of the student status held, or of the student status that lapsed into the grace being served, and of no other.
- `StatusState` carries `lapsedFrom`, the status that lapsed into an overstayer status. It is set by the lapse and carried on `status/granted`.
- It is missing where nothing lapsed (the road's arrival), and needs nothing to fill it on upgrade.

**Withdrawal and reinstatement:**

- A withdrawal moves the study route flown from `departed` to `known` (the arrow the route already has).
- Its course is set aside on the route as `withdrawn` (the effect `route/set-aside`, the event of the same name), and the university's confirmation is gone.
- So a new school's offer and deposit, the partner route and the dependant route may be sought in country in the cut months (status:grace-allows-in-country-applications).
- Reinstatement moves it back by the one arrow from `known` to `departed` (the effect `route/reinstate`, the event `route/reinstated`). It is allowed only while the course set aside is open.
- A new school's application or deposit on the route shuts it, and paying what is owed then reinstates nothing.

**Replays move.** Every recorded life that studies abroad replays its tuition, its work and its move to the Graduate status differently from its first course month. The master's lives among the goldens and the recorded lives move from their flight.

**New state and content:**

- state: the course's months counted, `coursePassed` on the status slice, the stage of a missed payment, the route's `loanPaid`;
- content: the schedule, the plan's offer, the loan's offer and obligation, the Graduate fee var;
- a state saved under the old tuition is carried by the upgrade as a schedule of its remaining charges (server:upgrade-state-is-pure).

**The contract carries the flow:**

- **Requirements:** `chapter/plan` (the route the plan picks, for the gift or the pledge), `status/course-done`, and `status/is` with `withdrawn` for the cut months.
- **Effects:** `route/gift`, `route/pledge-pay`, `route/loan`, `money/drop-lot`, `obligation/plan`, `status/withdraw`, `status/reinstate` and `status/graduate`, with `obligation/close` naming one entry where needed.
- **Rejections:** a rejection may give `reason: "funds"`.
- **State and view:** the route holds `gift` and `loanPaid`, its view `loanPaid`; the points gate's view holds `educationCutoff` and `fundsShort`; the status view holds `graduate`.
- **Content fields:**
  - a sponsor block's `openWhileShut`;
  - the points block's `educationCutoffVar`, and a points table's `educationMonths` and `educationJobs`;
  - an obligation's `schedule`, `onCut`, `paysSchool` and `deferWhile`, with `plan` and `deferred` on its state;
  - a status's `course` and `renewByJob`, `withdrawn` on its state, and `course` on the slice;
  - a term read `from: "tuition-left"`;
  - a gate may name `appliesShut` and `departureShort`.
- **Tuning:** `status.vacationPayBp`, `curtailMonths` and `planFee`; `route.loanProcessing` and `loanFeeBp`.
- **Events:**
  - the route's `gifted`, `gift-deeded`, `pledge-paid` and `loan-paid`;
  - the obligation's `staged`, `planned`, `deferral-seen` and `started`;
  - the status's `withdrawn`, `reinstated`, `course-began` and `course-month`;
  - the wallet's `lot-dropped`.

## Alternatives

- **Withdrawal at the first default.** Teesside withdrew students so in 2024, and was told its own multi-step policy had not been followed. It breaks careful students with a pledge, where life sees most complete.
- **Let the held-funds loan stay with the student abroad.** In life the lender takes its money back at the flight. The show-money is not a loan for fees, and its card says so.
- **The pledge as money in the student's own account.** It would make the family's signature spendable on anything. Paying the school only, and the school first, is the parent's account the visa counted.
- **No education loan.** It leaves the master's to the family, a dollar rung or the land. The regulated loan is real, counts for the visa, and costs what a fifteen-year loan costs.
