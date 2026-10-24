# Turns

> Numbers are working values.
> Kind: `turn`. One per character. Background: `../design/01-concept.md` section 9.

A turn is one month of the character's life. The month is lived (decision 0011): now-acts spend its free time, and the month turns when the player sleeps (world:sleep-ends-the-month); the sleep rests what is left.

The life also keeps a bank of turns. Real time fills it, one turn every two real hours up to 24; a closed chapter fills it at once; each month lived takes one while it holds any. The bank never holds a month back (turn:month-turns-on-empty-bank). It is there for the player who is away: when it fills, the server sends the one bank-full notice (clock:full-bank-push-notification). No screen shows it (clock:no-month-countdown-shown).

## Rules

**turn:new-character-full-bank** A new character starts with 24 turns banked and at month 0.

**turn:bank-capped-at-full** The bank never holds more than 24. A grant that would pass that is cut to it.

**turn:month-turns-on-empty-bank** `turn/end` raises the month by one whatever the bank holds, and takes the bank down by one while it holds any. It is never rejected for an empty bank (decision 0011; `../design/08-the-lived-month.md`).

**turn:refill-fills-the-bank** The effect `turn/refill` fills the bank to 24.

**turn:only-authority-grants-turns** Only the authority grants turns. `turns/grant` from a player is rejected with `not-yours`.

**turn:free-slots-per-month** A character with a job has two free slots a month. A character with no job has three. With wellbeing below 25 there is one fewer. `turn/end` must fill at most that many slots, and a slot left empty counts as rest. An activity whose `slot` is `none` (the word of someone who went, advice:someone-who-went-answers-free) answers now by `activity/now` and never enters the slots (activity:now-acts-and-month-acts); `turn/end` refuses a slot that holds one. Rest is never planned: an empty free slot rests, with the same wellbeing as `activity.rest`, so the client offers rest in no picker and on no thing (it leaves rest out of the view's acts as it lists them; the simulation keeps `activity.rest` as the empty slot's meaning, for the recordings and the results' "You rested" line). The Calendar app shows no empty slot and never says Free time (world:month-acts-carry-on). Cooking and the water answer now and fill no slot (obligation:cooking-and-fetching-water).

**turn:finish-ends-the-life** The effect `turn/finish` ends the life. Departure does not apply it: the life goes on abroad (route-gates:departure-grants-status), and the one thing that applies it is the road's `lost` (road:lost-is-final). After it, `turn.ended` is true and every command except `turns/grant` is rejected with `ended`.

**turn:turn-stores-a-report** Ending a turn stores a report: the month, one line for each thing that changed during it, the japacity before and after, and whether anything now needs the player. The report's need for an answer is the world's news nudge.

**turn:slots-can-be-locked** A slot can be locked: the effect `turn/lock` with a count, a number of months and a reason adds a lock; a lock's `untilMonth` is the last month it holds (`months` of 1 locks the month in hand only), and it ends in the `spend` phase of the month after. Locked slots come off the free slot count after the burnout slot, never below zero, and the view names each lock and its reason. Illness and its choices lock slots (`health.md`), and so does the side job while it is held (activity:side-job-holds-a-slot, the reason `side-job`).

**turn:month-lived-in-half-days** The month is lived (decision 0011). The turn slice keeps `spent`, the month's free time spent so far in half-days (1 a morning, 2 a day, 4 a weekend, 10 a week). The month's free time is `tuning.turn.halfDays.noJob` (60, the whole month) for a life with no job and `tuning.turn.halfDays.withJob` (20) for one whose job takes its own days. A now-act spends its entry's `halfDays` through the effect `turn/spend-days` (activity:now-acts-spend-half-days); the turn kind records `turn/days-spent` with the time taken and the new total, never past the month's free time, and the `spend` phase starts the next month at none spent. The view carries `halfDays: { spent, free }`; the band shows the month's name and the part of the day, never the half-days as a count or a percentage. The simulation never gates `turn/end` on it: the month turns at the bed's Sleep whatever time is left (world:sleep-ends-the-month, decision 0011), and the sleep rests that time. When one `turn/spend-days` carries `spent` across a mark of `tuning.turn.arrivalsBp` (shares of the free time, a third and two thirds), the turn kind applies `offer/come-up` with `max` 1 for each mark crossed (offer:day-arrivals-roll-offers), after the body's drain and before the `turn/days-spent` event.

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

The authority decides when to grant: one turn every two real hours. Online, the server's turn clock grants them: clock:turns-earned-from-refill-time, clock:earned-turns-granted-first, clock:full-bank-earns-nothing, clock:no-month-countdown-shown, clock:bonus-grants-keep-refill-time and clock:production-has-no-fast-clock (earning from `refilledAt`, the grant stepped before any command, nothing earned while the bank is full, no countdown shown, refills on top of the clock, and no fast clock in production). The local authority (`apps/client/src/authority/local.ts`) earns turns the same way. In development it runs a fast clock (`fastClock`, set by `apps/client/src/authority/clock.ts`) that refills an empty bank at once; a production build never runs it.

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `turn/refill` | effect | Fills the bank to the cap (turn:refill-fills-the-bank) |
| `turn/lock` | effect | Locks free slots for some months (turn:slots-can-be-locked) |
| `turn/finish` | effect | Ends the life (turn:finish-ends-the-life); only the road's `lost` applies it |
