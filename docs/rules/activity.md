# Activities and jobs

> Pay and prices are working values set against the real figures in `../research/09-uk-masters-numbers.md` (Pay in Lagos); the English test's fee is the real one (`document.md`).
> Kind: `activity`. Background: `../design/01-concept.md` section 9.

A month has one main activity, the job, and two or three free slots. An activity is an entry with requirements, a cost and a list of effects.

## Rules

**activity:one-job-paid-monthly** A character holds at most one job. In the `main` phase of each month a job is held, its pay is credited to the bank with the reason `salary`, the time in that job goes up by one month, and its effects apply.

**activity:illegal-slot-rejects-turn** `turn/end` is rejected with `not-legal` if any slot names an activity that is not a free-slot activity, whose requirements do not hold, or whose param is not one it may take now.

**activity:slots-resolve-in-order** Slots resolve in order. When a slot resolves, its requirements are checked again and its cost must be payable. If either fails, the activity fails: nothing is paid, no effect applies, and the report says why.

**activity:costs-paid-bank-or-cash** Each cost is paid under its own ledger reason. A cost in naira is paid by transfer, the bank first and then cash; a street price (the kiosk, the bet slip, the phone stall) follows its size, cash first at or under `tuning.wallet.cashUpTo` and the bank first above it (decisions 0012 and 0014). A cost in a foreign currency follows wallet:foreign-fee-payment-order.

**activity:job-hunt-lands-offer** One month of job hunting lands the named job with a chance of its base chance plus 20 basis points for each point of network, never more than 9500. On success a job offer opens that names the job. The job's requirements must hold to hunt for it, and a job already held cannot be hunted. A job at the hire cap reads "As good as certain" on the board and sorts with the likely ones (the racks, activity:fish-racks-at-makoko). Under guide:early-win-in-three-turns, a starting life's first hunt in its first three months lands for sure; the draw is made as ever and, when it misses, the lowest-paid job the life may hunt in that slot whose pay covers the naira it owes a month is the one landed, else the lowest-paid of all. While that hunt is still to come the view's hunt option carries `sure`, and the board reads every job at the bar. When the draw misses and the sure hunt lands another job than the one named, the month first says the named job came to nothing (`activity/hunted` with `hired` false for it), then the offer for the job landed, so the pick is never lost from the results or News; the plan's other acts never touch it. The board opens on the life's own trade: the first job in its order that asks for something beyond schooling (a skill such as code or care, a degree's grade, a paper of its own, or months in a job before it), else its first row; with a job held, the first of these that pays more than it; in Makoko the racks stay the pick while they lead (activity:fish-racks-at-makoko). The order of the rows does not change.

**activity:new-job-replaces-held** Starting a job replaces the job held, at once. `activity/quit` leaves the character with no job; with no job to leave it is rejected with `not-legal`. Time served in a job is kept when it is left.

**activity:requirements-judged-at-hunt** Requirements decide who can get a job. They are judged when the hunt lands, not again when the job offer is accepted. A job already held is kept even if they stop holding.

**activity:side-gig-pays-a-draw** A side gig pays a draw between its lowest and highest figure, plus its per-point figure for each point of tech, landing where its size says (wallet:money-lands-as-in-lagos: a sum over `tuning.wallet.cashUpTo` is a transfer to the bank). Reason `gig`.

**activity:last-month-plan-kept** The free slots played last month are stored. The client does not ask for the same again, since the plan carries on by itself (world:month-acts-carry-on).

**activity:side-job-holds-a-slot** A side job (`slot: "side"`) holds one free slot for as long as it is kept: it is started like a job (hunted, then offered) and ends with `activity/quit` with `side: true`. While held, it locks one slot (turn:slots-can-be-locked with the reason `side-job`), pays each `main` phase (naira under `gig` to the pocket its size takes, wallet:money-lands-as-in-lagos: cash at or under `tuning.wallet.cashUpTo`, the bank above it; a foreign currency to that currency's bank pocket under `salary`), costs its monthly wellbeing, and halves every skill gain as quality:high-skills-gain-slower does at the soft cap. One side job at a time. The view's `job` carries it as `side` (null for none).

**activity:months-played-counted** The slice counts the months each activity was played over the whole life, main or free, in `played`: one for each month it was in the slots at `turn/end`, and one for each month a now-act was done (activity:now-acts-and-month-acts). The send-off card's three lines come from it (chapter:send-off-card-on-close). The view does not show it.

The view lists each free-slot activity that applies where the character is as an `ActivityOption`: `allowed`; `missing`, the requirements not met now (with the wait for a school's answer when no school can be picked), so the screen can say why not; `params`, the params that may be picked now, null when it takes none; `cost`, the prices for the first param; and `affordable`, whether those prices could be paid now.

**activity:one-chance-bus-robbery** One chance: in each `main` phase at home with a side job held, there is `tuning.ladder.oneChanceBp` on stream `street` that the bus home is a robbery, unless that month `activity.safe-ride` was done (a now-act under activity:now-acts-and-month-acts, counted among the month's now-acts) or a slot held `activity.sleep-at-office`. The loss is every naira in the cash pocket (reason `mishap`) and a phone, ₦60,000 from the bank if the bank holds that much and nothing otherwise (`mishap`), and wellbeing -12, with a line that asks for attention. Beyond the phone, money in the bank is never touched.

## Jobs

Pay is monthly, after tax, to the bank. Effects apply each month the job is held.

| Id | Name | Pay | To get it | Base chance | Each month |
|---|---|---|---|---|---|
| `activity.job-teacher` | Private school teacher | ₦90,000 | Bachelor's degree | 70% | Wellbeing -2, standing +1 |
| `activity.job-customer-service` | Customer service agent | ₦110,000 | Secondary school | 60% | Wellbeing -3 |
| `activity.job-junior-developer` | Junior developer | ₦320,000 | Tech 30 | 35% | Tech +2, wellbeing -3 |
| `activity.job-bank-officer` | Bank officer | ₦320,000 | Bachelor's degree, second lower or better | 20% | Network +1, wellbeing -5 |
| `activity.job-bank-senior` | Senior bank officer | ₦560,000 | 36 months as a bank officer | 25% | Network +1, wellbeing -5 |
| `activity.job-mid-developer` | Mid-level developer | ₦1,100,000 | Tech 60, and 12 months across the developer jobs | 30% | Tech +2, wellbeing -4 |
| `activity.job-remote-developer` | Remote developer, foreign company | $2,800 | Tech 75, portfolio 3, English 60, 6 months across the developer jobs | 10% | Tech +1, wellbeing -5 |

The remote job pays dollars into the dollar account. That money is documented and needs no explaining later.

## Side jobs

| Id | Name | Pay | To get it | Base chance | Each month |
|---|---|---|---|---|---|
| `activity.night-support` | Night customer support, foreign company | $350 to the dollar bank pocket | English 50, tech 20 | 30% | Wellbeing -6 |
| `activity.weekend-tutoring` | Weekend tutoring | ₦60,000, to the naira bank by its size | Bachelor's degree | 50% | Wellbeing -4 |
| `activity.ride-driving` | Driving for a ride app at night | ₦120,000, to the naira bank by its size | `quality.driving` 1 | 45% | Wellbeing -7 |

Counter-moves, as free-slot activities: `activity.safe-ride` (₦25,000 a month, reason `upkeep`: a proper ride home; no one chance that month), `activity.sleep-at-office` (wellbeing -4, standing -1; no one chance that month).

## Free-slot activities

| Id | Name | Needs | Pick | Cost | Effects |
|---|---|---|---|---|---|
| `activity.rest` | Rest | | | | Wellbeing +12 |
| `activity.family-time` | Time with family | | | Takes no time, repeats (activity:acts-may-repeat-in-month) | Standing +1, wellbeing +2 |
| `activity.job-hunt` | Look for a job | | A job | | Hunt |
| `activity.study-english` | Study for the English test | | | ₦3,000, study; a day, repeats (activity:acts-may-repeat-in-month) | English +2, energy -3 |
| `activity.learn-tech` | Take a coding course | | | ₦5,000, study; a day, repeats | Tech +2, energy -3 |
| `activity.build-portfolio` | Build something to show | Tech 40 | | A weekend, repeats | Portfolio +1, tech +1, energy -5 |
| `activity.side-gig` | Take a side gig | Tech 25 | | | Gig: ₦30,000 to ₦90,000, plus ₦1,000 a point of tech. Wellbeing -4 |
| `activity.meetup` | Go to a meetup | | | ₦10,000, social | Network +5, wellbeing +2. Hear of the route that fits the life for sure the first time (guide:first-meetup-hears-fitting-route: care, talent or the master's); after that the UK master's at 40%, the care route with no chance |
| `activity.look-into-route` | Look into a route | Has heard of it | A route | | Look into it |
| `activity.get-passport` | Apply for a passport | Passport neither held nor being made | | `var.passport-fee`, ₦100,000 at the start (`news.passport-fee-doubles` can double it), document fee | Request the passport |
| `activity.get-transcript` | Chase your transcript | Bachelor's degree. Transcript neither held nor being made | | ₦25,000, document fee | Request the transcript |
| `activity.sit-english-test` | Sit the English test | Passport held. No result pending | | ₦295,000, test fee (document:who-sits-the-english-test) | Request the test result |
| `activity.degree-english` | Ask for your degree's English statement | A bachelor's degree. Statement neither held nor being made | | ₦150,000, document fee; from the Papers app | Request the statement (document:degree-english-statement) |
| `activity.apply-to-school` | Apply to a university | Route known. Passport and transcript held | A school | | Apply to the school |
| `activity.ask-family-loan` | Call home about a loan | At home. Standing 40. Family means 10. Family stake 0 | | | A morning, once a month; opens `offer.family-loan` (wallet:roads-to-the-target) |
| `activity.family-meeting` | Call a family meeting | Holds an offer from a school. Standing 30. Family stake 0 | | | Opens the family's pledge: the full one or the small one, whichever fits |
| `activity.tb-test` | Take the TB test | Passport held. Certificate neither held nor being made | | ₦120,000, test fee | Request the certificate |
| `activity.interview-prep` | Practise for the interview | Route known | | | Interview prep +20 |
| `activity.apply-for-visa` | Apply for the visa | See `route.md`, route:visa-application-needs | | The visa fee and the health surcharge, in pounds | Apply |

**activity:waiting-months-build-profile** The waiting months build the profile toward a route. Each act below is a free-slot activity (or a side job) whose card says what it counts toward, and each moves a figure a route's gate reads:
- `activity.open-source` (the developer, needs tech 40): portfolio +1 every second month played, network +2; counts toward the UK talent route.
- `activity.tech-posts` (the phone, slot none, once a month, needs tech 30): network +1, standing +1; counts toward talent (the endorsement reads the network as the "notable" line).
- `activity.conference-talk` (needs portfolio 2 and network 40, once a life): portfolio +1, standing +5, network +5; a set piece of one question.
- `activity.be-noticed` (any job held 6 months or more): on a draw of 3000 the job's pay rises by `tuning.activity.raiseBp` (1000) once; standing +2. The raise shows in the Jobs app on the held job's row ("Raised last month"), through `PlayerView.job.raise` (decision 0002).
- `activity.nurse-certification` (the nurse, care 50, needs the licence; ₦120,000; a wait of 2 months): care +10, `document.nurse-certificate` (for good); counts toward UK care and the Gulf's nursing offers; sat as a short quiz set piece of three questions from the care page's facts, a pass at two.
- `activity.masters-at-home` (a bachelor's, ₦1,800,000 over 12 months as an obligation, 12 months of one slot): education-level 4; counts toward Canada's points (the education row). The course ends with the flight: a course in progress when the character leaves records `activity/course-ended`, its fees close and nothing more is charged; the months played are kept, so a returnee who takes it again goes on from that count.
Every card names its route in words ("Counts toward: the talent route"). The talk's one question marks how it went, as the exam's do (`exam`: pass 1, nothing more given): running the code live or telling the bug's story scores 1, reading the slides 0; the results tell it in one line, "The talk went well: three people asked for your handle." or "The talk fell flat.", with what it counted for, "It counts toward the endorsement's letters.", and "The talk is over." is not told beside it. What the talk gives is the act's own. The care checklist counts the certificate (route-gates:care-route-needs-verification), so the certification card's "Counts toward: health care in the UK" is true, and the waiting months on the ward name the certification while she can pay it (world:nudge-says-one-thing). The certification is one sitting. It leaves the month's plan the month it runs, pass or fail (world:month-acts-carry-on), so a failed exam is never charged again by itself; "You can sit it again" means a new tap on its card.

**activity:side-jobs-pay-by-tier** Side jobs pay by level, so the waiting months are the saving months: each side job entry carries `tiers`, a list of `{ min: { quality, value }, pay }`; the pay a month is the highest tier whose `min` the character meets, the entry's own `pay` when none. The Jobs app and the board say the tier's pay and what lifts it ("₦60,000 a month; ₦90,000 at tech 50").

**activity:now-acts-and-month-acts** An activity entry says when it answers: `when: "now"` or `when: "month"`. A now-act is anything quick, a purchase or a conversation: the kiosk and the bet slip (the slip in hand now, the draw or the match later), asking around (a line from someone there now, the route heard now, the pitch opened now), the official page and the adviser's visit, the meetup, seeing or calling someone, the family meeting, buying a phone and the shopping abroad, the cash gig, posting from the phone, the safe ride, every paper's request (made now, the wait starting now) and every application (sent now, the answer with the month), and the job hunt (applied now, the employer answering with the month). The command `activity/now` (`activity`, `param`) runs a now-act at once for a character where it is staged: the same requirements, cost, effects and lines as a slot resolving (activity:slots-resolve-in-order, activity:costs-paid-bank-or-cash), applied in the month it is sent and told on that month's results as well as in the place; it fills no slot. A now-act that is not a purchase runs once a month unless it repeats (activity:acts-may-repeat-in-month); a purchase as often as money allows. A month-act is anything that fills time: every job and side job, the apprenticeship, study, the course, the portfolio, open source, the talk's preparation, the master's at home, the certification's study, interview practice, being noticed, the morning run, time with family, sleeping at the office or rough, and rest; it stays a slot pick, shows as "This month: ...", and lands in the month's results. In the recorded lives a now-act stands as its command at the tick it was planned. A purchase repeats while money allows, within its own ceiling where its page sets one (the kiosk's monthly tickets, luck:kiosk-sells-lotto-tickets). Cooking and fetching water, and filling the compound's drum, are now-acts that repeat (activity:acts-may-repeat-in-month, obligation:cooking-and-fetching-water). Rest is a month-act in the simulation as the empty slot's meaning, and is never planned (turn:free-slots-per-month).

**activity:trader-opens-own-shop** The trader's own shop. A life with a trade's settlement in hand (`activity.open-shop`: education-level 2 or less, at least ₦1,000,000 held, no shop running) opens its shop at its own stall at Tejuosho market, a free-slot act whose effect starts the main job `activity.run-shop` ("Your shop"): takings of ₦180,000 a month to the bank, growing by `tuning.activity.raiseBp` a year by the months the shop has stood, wellbeing down 3 and standing up 1 a month. No hunt lists it. Opening it meets the first chapter's `job` item; the first takings come the month after. The trader's first chapter speaks in her words (the settlement, the shop) and her way to the job step is the stall. Opening the shop costs nothing; the settlement is not moved on the ledger.

**activity:fish-racks-at-makoko** The fish racks at Makoko (the child of the water, prologue:makoko-start-never-a-trap). `activity.job-fish-racks` is a main job staged at `place.makoko` beside the racks: education-level 0, about ₦70,000 a month, a high hire chance, no hunt needed while the character lives in Makoko (the racks are where they grew up; the board lists it for anyone who asks around at Makoko). It is work at hand, not a way up: the way up is the market stall reached on Makoko's savings (activity:trader-opens-own-shop). The racks end like any job on the flight (activity:side-job-holds-a-slot). While the character lives in Makoko the board lists the racks first, as the nudge names them; elsewhere they take their place by chance and pay.

**activity:now-acts-spend-half-days** The time a now-act spends (decision 0011; turn:month-lived-in-half-days). An activity entry may carry `halfDays`, the month's free time the act spends: 1 a morning (cooking, a call, the kiosk's word, a look into a route), 2 a day (fetching water, the meetup, a paper's request, a hunt), 4 a weekend (the passport office, a visa application, a cash gig), 10 a week. The table is `packages/content/src/activity/activity.days.data.ts`, applied beside `when`. A now-act without a figure spends a morning; a purchase spends none, so the kiosk and the shops never take time; a month-act spends none here, since it fills the month as a commitment. `activity/now` applies the effect `turn/spend-days` after the act's prices are paid, so an act that cannot be paid spends nothing. The place says the time in words beside the act ("A morning", "A weekend"), never a number of days.

**activity:acts-may-repeat-in-month** Acts that repeat (decision 0012). Money and effects move when the act is done, never when the month turns. An activity entry may carry `repeat: true`: a now-act that may run again in the same month, as often as the body allows (activity:spent-body-refuses-acts), each time paid and answered at once, with its effects applied and its `played` count raised at once (`activity/now-played` with `counted`); the month's count of played acts leaves it out, and the month's results do not list it ("Done this month" is for what answered with the month). The repeat acts: the meals (`activity.cook-at-home`, `activity.cook-jollof`), the water (`activity.fetch-water`, `activity.fill-drum`), a nap, a bucket bath, the TV, gist with Mama (`activity.family-time`), Mama's shop (`activity.help-shop`), and the study that answers as it is done: `activity.study-english`, `activity.learn-tech`, `activity.build-portfolio`, each a day or a weekend with a small gain now, three of them a month giving what the month's slot gave. A repeat act may still stand as a commitment in a slot (a recorded life planned it, or a player keeps it up): `turn/end` accepts it and the slots phase runs it `tuning.turn.repeatPerSlot` times (3), each paid, stopping when one can no longer be paid. The acts that are a once-a-month thing (asking around, a paper's request, a hunt) run as activity:now-acts-and-month-acts has them.

**activity:spent-body-refuses-acts** The spent body (decision 0011). What bounds a day of acts is the body, not a hidden budget: once `quality.energy` is under `tuning.turn.body.spentBelow` (10), a now-act that takes any time (`halfDays` above 0, a purchase excepted) is refused by `activity/now` and the view marks it `spent`, so the place says "You are spent. Sleep." where its button was; an act that takes no time (gist, looking, buying) stays open. Sleep (the month's turn) rests the energy back (quality:body-belly-and-energy) and the acts open again. The month's free time (turn:month-lived-in-half-days) is still spent and recorded, and the sky reads it, but it shuts nothing. A spent act's fan button is shut and carries the words; a tap on it sends nothing.

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| Jobs' pay, after tax | the Jobs table: teacher ₦90,000, customer service ₦110,000, junior developer ₦320,000, mid-level developer ₦1,100,000, remote developer $2,800 | Working values. Real, in Lagos: a private-school teacher ₦25,000 to ₦75,000, customer service mostly ₦70,000 to ₦150,000, a junior developer ₦250,000 to ₦400,000, mid-level ₦700,000 to ₦2,000,000, remote $2,500 to $5,000 (`../research/09-uk-masters-numbers.md`, Pay in Lagos); the teacher is paid above the real range, the others inside it | the job entries' `pay` |
| A raise from being noticed: the share of the pay, the chance | 10%, 30% on stream `job` | Working value | `tuning.activity.raiseBp`, `raiseChanceBp` (activity:waiting-months-build-profile) |
| Side jobs' tiers | night support $450 once your tech is good (60), $600 once strong (80); weekend tutoring ₦90,000 once your tech is good (50); ride driving ₦150,000 once your network is wide (70), ₦180,000 wider (85); the player reads the band's word, never the figure (text:bands-not-figures) | Working value | the entries' `tiers` (activity:side-jobs-pay-by-tier) |
| The nurse's certification | ₦120,000, care 50 and the licence; three questions, a pass at two; care +10 | Working value | `activity.nurse-certification` (activity:waiting-months-build-profile) |
| A master's at home | ₦1,800,000 in twelve instalments, twelve months of one slot, education-level 4 | Working value | `activity.masters-at-home` (activity:waiting-months-build-profile) |
| Hiring chance for each point of network | 20 basis points | Working value | `tuning.quality.networkHireBp` |
| Highest hiring chance | 95% | Working value | `tuning.quality.hireMaxBp` |
| One chance a month with a side job | 3% | Working value | `tuning.ladder.oneChanceBp` 300 |
| Phone lost in a robbery | ₦60,000 | Working value | `tuning.ladder.phone` 6000000 |
| Wellbeing lost in a robbery | -12 | Working value | `tuning.ladder.robberyWellbeing` |

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `activity/exam` | effect | Counts the exam's answers given with a score above zero; at the pass mark the certificate is requested and the gain applied (activity:waiting-months-build-profile) |
| `activity/hunt` | effect | One month of looking for the job the slot's param names, on stream `job`; a hire opens the job offer |
| `activity/start-job` | effect | Starts the job named, or the job a term names, as the main or side job |
| `activity/end-job` | effect | Ends the main job, with `why` for the line; on a one-employer status it starts the clock (status:lost-job-starts-clock). With `side: true` it ends only the side job, as the flight does (activity:side-job-holds-a-slot, place:entries-legal-by-where); without it only the main job. |
| `activity/gig` | effect | Pays a gig between `min` and `max`, plus `perTech` for each point of tech, on stream `gig` |
| `job/any` | requirement | A main job is held |
| `job/none` | requirement | No main job is held |
| `job/is` | requirement | The main job is one of `activities` |
| `activity/tenure` | requirement | Months across the listed jobs, added together, are at least `months`; an empty list means every job |
| `activity/local-tenure` | requirement | Months in any job in the current country are at least `months` (ladders:local-tenure-counted) |

## Sources

- `../research/09-uk-masters-numbers.md`, Pay in Lagos: the real pay the Jobs table is set against.
- `../research/01-japa-journey.md`: the English test's fee (British Council Nigeria).

## Not verified

- The one chance robbery's 3% a month and its losses are working values; no source on how often it happens is held.
