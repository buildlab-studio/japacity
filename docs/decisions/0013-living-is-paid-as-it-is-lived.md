# 0013. Living costs at home are paid act by act, not as a monthly charge

Status: Accepted

## Context

- A month's living has to cost what it costs in Lagos.
- The cost should be seen where it is spent.
- It should never become a needs bar draining by the minute.
- A monthly upkeep charged at the month's end hides the cost from the day.
- A charge that is missed in full over a small shortfall reads as the game lying about the month.

## Decision

**Living by hand at home** (home:living-by-hand)

- At home the living is lived, not charged:
  - meals are bought and cooked as acts that cost at once (`reason: "food"`);
  - water is fetched;
  - fares are paid at the stop;
  - data is bought from the phone.
- `tuning.home.livingByHandBp` (the whole of it) is the share of a naira `upkeep` left out when the month ends.
- The scenarios keep their monthly figures as the measure of a month's living. The acts are priced so a month of eating and moving costs about that.
- Upkeep abroad is in the country's money and is charged when the month ends.

**Relief on the upkeep** (obligation:cooking-and-fetching-water)

- Cooking and fetching water apply the effect `obligation/relief` to the upkeep where the character lives.
- The next charge is lowered by a share of the whole charge, never below zero, each source once.
- That charge uses up the relief, whether it is paid or missed.
- The results tell each relief as its own line, and the scene draws the thing in its state.

**The upkeep takes what is held** (obligation:charges-paid-whole-or-missed)

- When the naira upkeep falls due and the naira held cannot cover it, it takes every naira held, under the reason `upkeep`.
- The shortfall is the miss. It is told with what was paid and what was short, and counted as any other miss.
- Every other obligation is paid in full or missed.

## Consequences

- No money from nowhere: the relief is a share off a charge, one line each on the results.
- The upkeep is food and a roof, which a family pays what it can toward. A bill short by a little never leaves the month's money untouched.
- The relief tests charge the upkeep whole through a copy of the content, since they test the charge.
- The client's act sheet shows each price plainly, with the balance before and after.
