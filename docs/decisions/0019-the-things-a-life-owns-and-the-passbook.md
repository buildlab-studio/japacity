# 0019. The things a life owns and the passbook belong to the simulation

Status: Accepted

## Context

- A month needs something to buy for, and a room becomes yours by what is in it.
- Saving for the way out needs a goal with named roads to it.
- Both touch money and the month. So they have to be the simulation's, for the goldens, simulated play and the server's upgrade path to carry them.
- Where a thing stands in a room changes nothing in a life.

## Decision

**Things are the simulation's** (home:things-a-life-owns)

- The `things` slice holds what is owned, with the month bought and the price paid.
- The content kind `thing` is the market's catalogue. Every figure is content's.
- Commands: `thing/buy` and `thing/sell`. Effect: `things/sell-off`, on leaving Lagos.
- Money reasons: `goods` (a thing bought), `running` (its cost a month) and `sale` (a thing sold).
- The ride way `drive`, while the car stands at home (decision 0017).
- Papa's loan is `activity.ask-family-loan` and `offer.family-loan`.

**Arrangement is the device's**

- Where a thing stands in the room is kept on the device beside the save, by life and home. Never in the simulation.

**The passbook** (wallet:passbook-against-plan-cost, wallet:savings-stamps, wallet:saving-pace, wallet:roads-to-the-target)

- The passbook is the Bank app's first page.
- It shows the money held for the road against the plan's whole cost, with stamps at fixed figures and a pace line read from the month's net.
- The wallet keeps `paceNet`, `nets` and `stamps`, with the events `wallet/paced` and `wallet/stamped`.

**The view** (world:room-things-and-buy-mode)

- `things`: what is owned, the market with why each thing is shut, the drive, the running costs.
- `passbook`: the money held, the target, the stamps, the pace, the roads to it.
- The Market's pictures are keyed `market.<slug>`.

**The save**

- The state's `schema` covers the `things` slice and the lived month's fields (decision 0004).

## Consequences

- The Market app, buy mode in the room and the Bank's first page read the view alone.
- A thing's running cost and its monthly lift are part of the month's end, so a life short of money sees its things stand idle.
- Every figure of a thing is content's, so a price change is a content change, never a code change.
