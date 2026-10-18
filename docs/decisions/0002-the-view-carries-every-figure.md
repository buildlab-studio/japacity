# 0002. The view carries every figure the screens show

Status: Accepted

## Context

The client draws what the simulation decides. Where a screen needs a figure (a pay, a fare, a rent due, who a bond is with), it can either recompute it from a copy of the rule or read it from the simulation. A copy of a rule in the client drifts from the simulation and shows things the simulation does not hold.

## Decision

The player's view (`PlayerView` in `engine/types.ts`) carries every figure a screen shows, computed by the simulation with the same function the commands use, and the client reads it and keeps no copy of the rule. A figure that is a reading of what the state already holds is derived when the view is built, not stored in state. What the view carries includes:

- **Money and work**: the job's `pay` and `sidePay` and an offer's `pay`, net of tax, with a sponsored or contract job's recorded salary (wallet:view-carries-month-pay); the raise from being noticed as `job.raise` (activity:waiting-months-build-profile); `keptMonths` (wallet:months-kept-counted); `wallet.marked` (decision 0015).
- **Home and the city**: the home's `moves` with each move's monthly charge, what it takes now and why it is shut (home:moves-carry-cost-and-reason); `roomRent` with the year's rent, its fees and the months to the next charge (home:compound-room-is-a-home); the place's `wayHome` (place:view-carries-way-home), `fareBp` for the month's fares and `ways` for the country's ride ways (decision 0017).
- **Papers and the plan**: each paper's `onItsWay`; the chapter's `closes` and `next`; the points gate's `invites`; `plan` with the chosen way and every way heard of with its figure (decision 0022).
- **People**: each bond's `person`, `pair`, `lastMomentMonth`, `cooldownUntil` and `consent`, and the joint's `myScore` and `theirScore` read fresh on a points route (decision 0020).
- **The life's origin**: `hometown`, a content key read from the family draw already made (prologue:family-draw-on-first-answer), so it needs no new stream and no new state; a fixed life names its own on its scenario entry.

A wallet line's tone comes from its event: a credit is good, a debit bad (wallet:tone-follows-money-direction).

## Consequences

- One source for each figure: a screen and a command never disagree, and the goldens prove the simulation unchanged when a figure moves into the view.
- The view type grows with each screen that needs a figure, and every such growth is a change to the contract (`AGENTS.md` rule 9).
- A figure derived in the view leaves recorded lives and goldens as they are, and an older stored state gains it the moment it is viewed.
- The view never shows what the simulation keeps hidden: no draw before it is made, no chance, no computer's answers (person:view-shows-people).
