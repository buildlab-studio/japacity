# 0031. Each trade has its own job ladder and a yearly pay review

Status: Accepted

## Context

- The routes charge their real fees and ask their real funds.
- Most trades at home had one rung, and naira pay never moved.
- So for every trade paid below the senior bank officer, every route but the Gulf and UK care asked more than 36 months of the trade's surplus: a gap of 3 to 50 times.
- In simulated play:
  - no flight left from a teacher's, a nurse's, a shop's or the racks' job;
  - the nurse took a bank job in month 2 in every seed;
  - the remote developer's job paid for 108 of 164 formal flights.
- The official pound rises 1.14 times in 36 months in the golden world, and 2.36 times in a bad one.
- Without a family road, Canada is funded from own savings alone.
- `../design/13-the-economy.md` gives the design and its targets.

## Decision

**Ladders and side jobs** (activity:each-trade-climbs-its-ladder, activity:capital-opens-own-work, document:trade-papers):

- every trade at home has two or three rungs and one side job of its own;
- pay is real advertised pay or a stated working value;
- a rung is unlocked by months across the trade's jobs and one quality or paper of the trade;
- night support and home lessons are tied to their trades;
- own work (the kiln, the fish trade, the POS stand) is opened with its capital under `goods`.

**The yearly review** (activity:naira-pay-reviewed-yearly), at each 12 months in a naira main job:

- a formal employer raises pay by 10% plus half of the official dollar's rise beyond 10% over the year, at most 30%;
- an informal employer raises it by 5%;
- own work keeps its own growth;
- dollar pay, side jobs and jobs abroad are not reviewed;
- being noticed stays once a job;
- the job slice gains the held pay and the dollar rate at the last review, the job entries an `employer` field, and the event `activity/reviewed` is new.

**The family's gift for Canada** (route-gates:family-gift-counts-with-deed, route-gates:canada-funds-checked-at-departure):

- the family meeting gives a Canada plan a gift that counts with a notary's deed;
- the gift or the master's pledge, never both;
- Canada's funds are asked again at the invitation and at the flight.

**The targets** (scenario:economy-meets-its-targets): the months to a first flight for each trade, and ten measures that simulated play holds, so later tuning has a stated aim.

**The real fees corrected beside them:**

- Canada's citizenship;
- the care and the skilled renewals, read by the job held (status:renewing-a-status);
- nurses sponsorable while the care window is shut (route-gates:nurses-sponsored-while-care-shut);
- the NMC's tests;
- one December rule (place:december-factor-from-the-real-median).

## Consequences

- **Replays move.** Every life with a naira job past month 12 earns more than before. So every golden and recorded life that holds one moves from its twelfth month in a job. The renewals move the lives that renew abroad, and the ladders move any life that hunts.
- **The ledger report's salary ceiling** grows by the review's cap a year (wallet:ledger-report-raises-alarms).
- **The contract carries the ladders and the review:**
  - the job slice holds `pay` and `reviewRate`;
  - the event `activity/pay-held` records a reviewed job's pay and the dollar rate on its first month;
  - a side job's months are carried on `activity/side-worked` as `tenure`;
  - the months across a trade are read by `tenureAcross` from the content's jobs;
  - the chartered exams are sat in sittings: `ActivityExam.sittings` names how many passes a paper asks, the activity slice keeps `sittings` passed by exam, and `activity/sitting-passed` counts each;
  - the requirement `prologue/answered` (`step`, `answer`) holds when the prologue's step was answered so, judged by the prologue kind from the answers it keeps after it closes. So the junior developer takes a computer science degree in place of a piece of work.
- **New content:** the rungs, the side jobs, two papers, the gift and its deed. The content version is frozen, raised and sealed. The review, the gift's count and the renewal by job are rule changes that replay differently (server:older-content-frozen, server:content-version-sealed).
- **The screens read the next rung.** The board, the Jobs app and the passbook's ladder road read the trade's next rung, so a nurse is shown the senior nursing officer, not the bank.
- **No fee is lowered.** Nothing about the routes' fees or funds is lowered: the gap is closed on the income side.

## Alternatives

- **A factor below real on the routes' money.** A gap of 3 to 50 times cannot be closed by a factor, and the figures would stop being true.
- **A loan for Canada's funds.** IRCC refuses borrowed money; the family's gift with its deed is the real road.
- **Being noticed once a year in place of a review.** It rewards a draw, not loyalty, and ignores the dollar that moves the routes' price.
- **One general promotion for every job.** A trade's ladder asks the trade's own papers and qualities, which is what makes staying in a trade a choice.
