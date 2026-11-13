# 0002. The view carries every figure the screens show

Status: Accepted

## Context

- The client draws what the simulation decides.
- A screen needs figures: a pay, a fare, a rent due, who a bond is with.
- The client could recompute each figure from its own copy of the rule, or read it from the simulation.
- A copy of a rule in the client drifts from the simulation and shows things the simulation does not hold.

## Decision

**The view holds every figure**

- The player's view (`PlayerView` in `engine/types.ts`) carries every figure a screen shows.
- The simulation computes each figure with the same function its commands use.
- The client reads the figure and keeps no copy of the rule.
- A figure that only reads what the state already holds is worked out when the view is built, not stored in state.

**Where the detail lives**

- The rules that name each figure hold the detail. Among them: wallet:view-carries-month-pay, home:moves-carry-cost-and-reason, home:compound-room-is-a-home, place:view-carries-way-home, person:view-shows-people and prologue:family-draw-on-first-answer (the hometown).
- So do the records for marked money (0015), rides (0017), people (0020) and the plan (0022).
- A wallet line's tone comes from its event: a credit is good, a debit bad (wallet:tone-follows-money-direction).

## Consequences

- Each figure has one source, so a screen and a command never disagree.
- The view type grows with each screen that needs a figure. Each such growth is a change to the contract (`AGENTS.md` rule 9).
- A figure the view works out leaves the golden replays (stored results of recorded lives) and the recorded lives unchanged. A stored state of any age has it as soon as it is viewed.
- The view never shows what the simulation keeps hidden: no draw before it is made, no chance, no computer character's answers (person:view-shows-people).
