# 0013. Living is paid as it is lived

Status: Accepted

## Context

A month's living has to cost what it costs in Lagos, be seen where it is spent, and never become a needs bar draining by the minute. A monthly upkeep charged at the close hides the cost from the day; a charge that misses in full over a small shortfall reads as the game lying about the month.

## Decision

- **Living by hand at home** (home:living-by-hand). At home the living is lived, not charged: meals are bought and cooked as acts that cost at once (`reason: "food"`), water is fetched, fares are paid at the stop, data from the phone. `tuning.home.livingByHandBp` (the whole of it) is the share of a naira `upkeep` left out as the month turns. The scenarios keep their monthly figures as the measure of a month's living, and the acts are priced so a month of eating and moving costs about that. Upkeep abroad is in the country's money and is charged as the month turns.
- **Relief on the upkeep** (obligation:cooking-and-fetching-water). Cooking and fetching water apply the effect `obligation/relief` to the upkeep where the character lives: the next charge is lowered by a share of the whole charge, never below zero, each source once, and the relief is spent by that charge whether it is paid or missed. The results tell each as its own line, and the scene draws the state on the thing.
- **The upkeep takes what is held** (obligation:charges-paid-whole-or-missed). When the naira upkeep falls due and the naira held cannot cover it, it takes every naira held under the reason `upkeep`, and the shortfall is the miss, told with what was paid and what was short, counted as any other miss. Every other obligation is paid in full or missed.

## Consequences

- No money from nowhere: the relief is a share off a charge, one line each on the results.
- The upkeep is food and a roof, which a family pays what it can toward; a bill short by a little never leaves the month's money untouched.
- The relief tests charge the upkeep whole through a content copy, since they test the charge.
- The client's act sheet says each price plainly, with the balance before and after.
