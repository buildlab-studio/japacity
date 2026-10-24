# 0002. The view carries every figure the screens show

Status: Accepted

## Context

The client draws what the simulation decides. Where a screen needs a figure (a pay, a fare, a rent due, who a bond is with), it can either recompute it from a copy of the rule or read it from the simulation. A copy of a rule in the client drifts from the simulation and shows things the simulation does not hold.

## Decision

The player's view (`PlayerView` in `engine/types.ts`) carries every figure a screen shows, computed by the simulation with the same function the commands use, and the client reads it and keeps no copy of the rule. A figure that is a reading of what the state already holds is derived when the view is built, not stored in state.

The rules that name each figure the view carries hold the detail: among them wallet:view-carries-month-pay, home:moves-carry-cost-and-reason, home:compound-room-is-a-home, place:view-carries-way-home, person:view-shows-people and prologue:family-draw-on-first-answer (the hometown), and the records for marked money (0015), rides (0017), people (0020) and the plan (0022). A wallet line's tone comes from its event: a credit is good, a debit bad (wallet:tone-follows-money-direction).

## Consequences

- One source for each figure: a screen and a command never disagree.
- The view type grows with each screen that needs a figure, and every such growth is a change to the contract (`AGENTS.md` rule 9).
- A figure the view derives leaves the golden replays (stored results of recorded lives) and the recorded lives unchanged, and a stored state of any age carries it the moment it is viewed.
- The view never shows what the simulation keeps hidden: no draw before it is made, no chance, no computer's answers (person:view-shows-people).
