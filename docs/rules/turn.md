# Turns

> Numbers are working values.
> Kind: `turn`. One per character. Background: `../design/01-concept.md` section 9.

A turn is one month of the character's life. The month is lived (decision 0011): now-acts spend its free time, and the month turns when the player sleeps (world:sleep-ends-the-month). The sleep rests whatever free time is left.

The life also keeps a bank of turns:

- Real time fills it, one turn every two real hours, up to 24.
- A closed chapter fills it at once.
- Each month lived takes one turn from it while it holds any.

The bank never holds a month back (turn:month-turns-on-empty-bank). It exists for the player who is away: when it fills, the server sends the one bank-full notice (clock:full-bank-push-notification). No screen shows it (clock:no-month-countdown-shown).

## Rules

**turn:new-character-full-bank** A new character starts at month 0 with 24 turns banked.

**turn:bank-capped-at-full** The bank never holds more than 24. A grant that would pass that is cut to it.

**turn:month-turns-on-empty-bank** `turn/end` raises the month by one whatever the bank holds, and takes the bank down by one while it holds any. It is never rejected for an empty bank (decision 0011; `../design/08-the-lived-month.md`).

**turn:refill-fills-the-bank** The effect `turn/refill` fills the bank to 24.

**turn:only-authority-grants-turns** Only the authority grants turns. `turns/grant` from a player is rejected with `not-yours`.

**turn:free-slots-per-month** A character with a job has two free slots a month; a character with no job has three. With wellbeing below 25 there is one fewer. `turn/end` must fill at most that many slots, and a slot left empty counts as rest.

- **Now-acts.** An activity whose `slot` is `none` (such as the word of someone who went, advice:someone-who-went-answers-free) is answered at once by `activity/now` and never enters the slots (activity:now-acts-and-month-acts). `turn/end` refuses a slot that holds one. Cooking and fetching water are also answered at once and fill no slot (obligation:cooking-and-fetching-water).
- **Rest is never planned.** An empty free slot rests, with the same wellbeing as `activity.rest`. So the client offers rest in no picker and on no thing, and leaves it out of the view's acts. The simulation keeps `activity.rest` as the empty slot's meaning, for the recordings and the results' "You rested" line.
- **The Calendar app** shows no empty slot and never says Free time (world:month-acts-carry-on).

**turn:finish-ends-the-life** The effect `turn/finish` ends the life. The only thing that applies it is the road's `lost` (road:lost-is-final). Departure does not: the life goes on abroad (route-gates:departure-grants-status). After it, `turn.ended` is true and every command except `turns/grant` is rejected with `ended`.

**turn:turn-stores-a-report** Ending a turn stores a report: the month, one line for each thing that changed during it, the japacity before and after, and whether anything now needs the player. The report's need for an answer drives the world's news nudge.

**turn:slots-can-be-locked** A slot can be locked. The effect `turn/lock`, with a count, a number of months and a reason, adds a lock.

- A lock's `untilMonth` is the last month it holds (`months` of 1 locks only the month in hand). It ends in the `spend` phase of the month after.
- Locked slots come off the free slot count after the burnout slot, never below zero.
- The view names each lock and its reason.
- Illness and its choices lock slots (`health.md`), and so does the side job while it is held (activity:side-job-holds-a-slot, the reason `side-job`).

**turn:month-lived-in-half-days** The month is lived (decision 0011). The turn slice keeps `spent`: the month's free time spent so far, in half-days (1 a morning, 2 a day, 4 a weekend, 10 a week).

- **Free time.** `tuning.turn.halfDays.noJob` (60, the whole month) for a life with no job, and `tuning.turn.halfDays.withJob` (20) for one whose job takes its own days.
- **Spending.** A now-act spends its entry's `halfDays` through the effect `turn/spend-days` (activity:now-acts-spend-half-days). The turn kind records `turn/days-spent` with the time taken and the new total, never past the month's free time. The `spend` phase starts the next month at none spent.
- **The view** carries `halfDays: { spent, free }`. The band shows the month's name and the part of the day, never the half-days as a count or a percentage.
- **No gate.** The simulation never gates `turn/end` on it: the month turns at the bed's Sleep whatever time is left (world:sleep-ends-the-month, decision 0011), and the sleep rests that time.
- **Arrivals.** When one `turn/spend-days` carries `spent` across a mark of `tuning.turn.arrivalsBp` (shares of the free time: a third and two thirds), the turn kind applies `offer/come-up` with `max` 1 for each mark crossed (offer:day-arrivals-roll-offers). This happens after the body's drain and before the `turn/days-spent` event.

## Numbers

| Setting | Value | In content as | Source |
|---|---|---|---|
| Starting bank | 24 | `tuning.turn.start` | Working value |
| Most that can be banked | 24 | `tuning.turn.cap` | Working value: two real days of turns |
| One turn earned every | 2 real hours | `time.TURN_REFILL_MS` (`packages/sim/src/engine/time.ts`), the server's `clock.turnRefillMs` | Working value |
| Free slots with a job | 2 | `tuning.turn.freeSlots` | Working value |
| Free slots without one | 3 | `tuning.turn.freeSlotsNoJob` | Working value |
| Most locked slots at once | 2 | `tuning.turn.maxLocked` | Working value |
| Free time with no job, half-days | 60 | `tuning.turn.halfDays.noJob` | Working value: the whole month |
| Free time with a job, half-days | 20 | `tuning.turn.halfDays.withJob` | Working value: the ten days a job leaves |
| The day's arrivals, shares of the free time | 3333, 6667 bp | `tuning.turn.arrivalsBp` | Working value: a third and two thirds |

## Outside the simulation

The authority decides when to grant turns: one every two real hours.

- **Online**, the server's turn clock grants them (`clock.md`): turns are earned from `refilledAt` (clock:turns-earned-from-refill-time), the grant is stepped before any command (clock:earned-turns-granted-first), nothing is earned while the bank is full (clock:full-bank-earns-nothing), no countdown is shown (clock:no-month-countdown-shown), refills come on top of the clock (clock:bonus-grants-keep-refill-time), and production has no fast clock (clock:production-has-no-fast-clock).
- **The local authority** (`apps/client/src/authority/local.ts`) earns turns the same way. In development it runs a fast clock (`fastClock`, set by `apps/client/src/authority/clock.ts`) that refills an empty bank at once. A production build never runs it.

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `turn/refill` | effect | Fills the bank to the cap (turn:refill-fills-the-bank) |
| `turn/spend-days` | effect | Spends half-days of the month's free time (turn:month-lived-in-half-days) |
| `turn/lock` | effect | Locks free slots for some months (turn:slots-can-be-locked) |
| `turn/finish` | effect | Ends the life (turn:finish-ends-the-life); only the road's `lost` applies it |
