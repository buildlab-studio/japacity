# 0019. The things a life owns, and the passbook

Status: Accepted

## Context

A month needs something to buy for, and a room becomes yours by what is in it. The slow money chapter needs a goal with named roads to it. Both touch money and the month, so they have to be the simulation's for the goldens, simulated play and the server's upgrade path to carry them; where a thing stands in a room changes nothing in a life.

## Decision

- **Things are the simulation's.** The `things` slice holds what is owned, with the month and the price paid; the content kind `thing` is the market's catalogue, every figure content's (home:things-a-life-owns). The commands `thing/buy` and `thing/sell`, and the effect `things/sell-off` on leaving Lagos. The money reasons `goods` (a thing bought), `running` (its cost a month) and `sale` (a thing sold). The ride way `drive` while the car stands at home (decision 0017). Papa's loan is `activity.ask-family-loan` and `offer.family-loan`.
- **Arrangement is the device's.** Where a thing stands in the room is kept beside the save by life and home on the device, never in the simulation.
- **The passbook.** The money held for the road against the plan's whole cost, with stamps at fixed figures and a pace line read from the month's net (wallet:passbook-against-plan-cost, wallet:savings-stamps, wallet:saving-pace and wallet:roads-to-the-target): the wallet keeps `paceNet`, `nets` and `stamps`, with the events `wallet/paced` and `wallet/stamped`.
- **The view** carries `things` (owned, the market with why each thing is shut, the drive, the running costs) and `passbook` (held, the target, the stamps, the pace, the roads to it); the Market's pictures are keyed `market.<slug>` (world:room-things-and-buy-mode).
- The state's `schema` covers the `things` slice and the fields the lived month grew (decision 0004).

## Consequences

- The Market app, buy mode in the room and the Bank's first page read the view alone.
- A thing's running cost and its monthly lift are part of the month's close, so a life short of money sees its things stand idle.
- Every figure of a thing is content's, so a price change is a content change, never a code change.
