# 0017. Rides are commands, priced by the simulation

Status: Accepted

## Context

The player moves between the places of a city by ride: in Lagos by danfo, keke, okada, on foot or by their own car, and abroad by the country's own ways. A fare has to leave the wallet (world:ride-sheet-shows-fares), and the client cannot debit: only a command can, and only a command can be replayed by the authority. What the ride sheet shows must be what leaves the money.

## Decision

- **A ride is the player command `place/ride`** with `from`, `to` and `way` (place:rides-between-city-places), at home and abroad, between two places of the country the character is in, on the ways that country has. The simulation does not keep which place of the city the character stands in; the client keeps that and moves only once the command is accepted.
- **The fare is the simulation's.** `rideFare` is the way's base fare (`fareKobo`) plus its fare a kilometre (`farePerKmKobo`) over the straight-line distance between the two places' positions, rounded up to the country's step; the ways, their figures and their pace are content's (`tuning.city.ride`, and `tuning.city.ride.abroad[country]` in that country's smallest unit). It is taken under the reason `fare`, cash first and the bank for the rest (decision 0014). `place/rode` carries the currency with the fare.
- **The walk.** On foot costs nothing, within `tuning.city.ride.walkMetres`, and a walk home is accepted however far, so nothing in the simulation can lock a character in one place.
- **The month's fares.** The month the fuel scarcity's ask opens at home, every fare is `tuning.city.ride.scarcityBp` of its figure, and the view's `place.fareBp` carries the month's factor.
- **The pass and the shuttle.** A pass is the country's, covering the ways it lists (`passWays`), bought as the country's own now-act once a month and read from the month's played acts (place:country-pass-covers-ways). A place abroad may carry `shuttle: true`: a ride by bus to or from it asks no fare, the employer's bus being the way the job is reached (place:employer-shuttle-rides-free).
- **The view prices the sheet.** The view's `place.ways` lists the country's ways with their figures and what a pass covers, and its stops carry `shuttle`, so the ride sheet prices from the same function as the command (decision 0002).

## Consequences

- A country's ways, fares, pass and shuttles are content: a country added needs no change to the simulation.
- The minutes on the ride sheet are display only, from the way's pace in tuning.
- A ride draws nothing from the random streams and has no slice of its own: the pass is an act and the shuttle a field on a place.
