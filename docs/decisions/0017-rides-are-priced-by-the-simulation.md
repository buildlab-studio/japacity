# 0017. Rides are commands, priced by the simulation

Status: Accepted

## Context

- The player moves between the places of a city by ride: in Lagos by danfo, keke, okada, on foot or in their own car; abroad by the country's own ways.
- A fare has to leave the wallet (world:ride-sheet-shows-fares).
- The client cannot debit. Only a command can, and only a command can be replayed by the authority.
- What the ride sheet shows must be what leaves the wallet.

## Decision

**A ride is a player command** (place:rides-between-city-places)

- The command is `place/ride`, with `from`, `to` and `way`.
- It works at home and abroad, between two places of the country the character is in, on the ways that country has.
- The simulation does not keep which place of the city the character stands in. The client keeps that, and moves the character only once the command is accepted.

**The simulation sets the fare**

- `rideFare` is the way's base fare (`fareKobo`) plus its fare per kilometre (`farePerKmKobo`) over the straight-line distance between the two places, rounded up to the country's step.
- The ways, their figures and their pace are content: `tuning.city.ride`, and `tuning.city.ride.abroad[country]` in that country's smallest unit.
- The fare is taken under the reason `fare`, cash first and the bank for the rest (decision 0014).
- `place/rode` carries the currency with the fare.

**Walking**

- On foot costs nothing, within `tuning.city.ride.walkMetres`.
- A walk home is accepted however far, so nothing in the simulation can lock a character in one place.

**Fares in a fuel scarcity**

- In the month the fuel scarcity's ask opens at home, every fare is `tuning.city.ride.scarcityBp` of its figure.
- The view's `place.fareBp` carries the month's factor.

**The pass and the shuttle** (place:country-pass-covers-ways, place:employer-shuttle-rides-free)

- A pass belongs to a country and covers the ways it lists (`passWays`).
- It is bought as the country's own now-act, once a month, and read from the month's played acts.
- A place abroad may carry `shuttle: true`. A ride by bus to or from it costs no fare: the employer's bus is how the job is reached.

**The view prices the sheet** (decision 0002)

- The view's `place.ways` lists the country's ways with their figures and what a pass covers.
- Its stops carry `shuttle`.
- So the ride sheet prices from the same function as the command.

## Consequences

- A country's ways, fares, pass and shuttles are content. Adding a country needs no change to the simulation.
- The minutes on the ride sheet are for display only, from the way's pace in tuning.
- A ride draws nothing from the random streams and has no slice of its own: the pass is an act and the shuttle a field on a place.
