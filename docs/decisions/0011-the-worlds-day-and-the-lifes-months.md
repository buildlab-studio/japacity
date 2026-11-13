# 0011. Two clocks: a shared world day and each life's months

Status: Accepted

## Context

- The game is a shared city and a life of years.
- One real-time clock for everything would either end months for absent players or make players wait for a month to end.
- One personal clock for everything would give the city no shared day.
- Within a month the player lives days of acts. Something has to limit a day without showing a counter on the screen.

## Decision

The game keeps two clocks.

**The world's clock** (clock:game-day-on-real-time)

- It is the game's own day, 105 minutes of real time long.
- It is the same moment for everyone, computed from real time alone (`worldClockAt`).
- Every reply carries it as `clock.world`. The simulation never reads it.
- It drives the sky and the night, what is open or shut, who is about, and the events set at an hour.
- A sealed result opens on the world's next morning (clock:envelopes-show-real-waits).

**Each life's clock is its months**

- A month ends only when the character sleeps (world:sleep-ends-the-month).
- Nothing in a life moves while its player is away.

**The month is lived in half-days** (turn:month-lived-in-half-days, activity:now-acts-spend-half-days)

- The turn slice keeps `spent`: the month's free time used so far, in half-days. Half-days, because content holds whole numbers and a morning is the smallest act.
- A now-act spends its entry's `halfDays` through `turn/spend-days`.
- The view carries `halfDays: { spent, free }`.
- The free time is recorded only. It blocks nothing.

**The body limits a day** (quality:body-belly-and-energy, activity:spent-body-refuses-acts)

- `quality.belly` and `quality.energy` change with acts and with time lived.
- When the month ends they count toward wellbeing and drift back toward a middle figure.
- They are said in words, never shown as a meter.
- Below the spent mark, an act that takes time waits until the character has slept.

**The bank of turns is a count in state**

- Real time fills it: the server's `turns/grant` adds one turn every two real hours, up to 24 (clock:turns-earned-from-refill-time).
- Closing a chapter fills it (turn:refill-fills-the-bank).
- Each month lived takes one turn while the bank holds any.
- It never holds a month back: `turn/end` is never refused for an empty bank (turn:month-turns-on-empty-bank).
- Its only use is the bank-full notice (clock:full-bank-push-notification). No screen shows it (clock:no-month-countdown-shown).

## Consequences

- The world's day gives every player a shared now. The life's months keep every decision the player's own.
- Being spent is something the player feels and fixes by sleeping, which is also how the month ends.
- A player who sleeps early only rests the month. Nothing is gained, so the simulation needs no refusal for it, and every recorded life replays as it was recorded.
- The sky, the night and the nudge to bed on the player's screen come from `clock.world`. The client never ends a month on its own.
