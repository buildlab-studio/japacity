# 0011. The world's day and the life's months

Status: Accepted

## Context

The game is a shared city and a life of years. A single real-time clock either closes months for absent players or makes them wait; a single personal clock gives the city no shared day to live on. Within a month the player lives days of acts, and something has to bound a day without a counter on the screen.

## Decision

The game keeps two clocks.

- **The world's clock** (clock:game-day-on-real-time) is the game's own day, shorter than a real day, the same moment for everyone, a pure function of real time (`worldClockAt`), carried on every reply as `clock.world` and never seen by the simulation. It drives the sky and the night, what is open and shut, who is about, and the events hung on the hour. A sealed result opens with the world's next morning (clock:envelopes-show-real-waits).
- **A life's clock** is its months. A month turns only when that life sleeps (world:sleep-ends-the-month); nothing in a life moves while its player is away.

The month is lived in the simulation. The turn slice keeps `spent`, the month's free time spent so far in half-days, because content holds whole numbers and a morning is the smallest act; a now-act spends its entry's `halfDays` through `turn/spend-days`, and the view carries `halfDays: { spent, free }` (turn:month-lived-in-half-days, activity:now-acts-spend-half-days). The free time is recorded and gates nothing.

The body bounds a day. `quality.belly` and `quality.energy` move with acts and with the time lived, fold into wellbeing as the month turns and rest toward a middle figure, said in words and never as a meter (quality:body-belly-and-energy). Under the spent mark, an act that takes time waits for sleep (activity:spent-body-refuses-acts).

`turn/end` is never refused for an empty turn bank (turn:month-turns-on-empty-bank): the bank and the server's grants stay in state and gate nothing.

## Consequences

- The world's day gives every player a shared now; the life's months keep every decision the player's own.
- Being spent is something the player feels and fixes by sleeping, which is also how the month turns.
- A player who sleeps early only rests the month: nothing is gained, so the simulation needs no refusal for it, and every recorded life still replays.
- The interface's sky, its night and the nudge to bed come from `clock.world`; the client has no automatic turn.
