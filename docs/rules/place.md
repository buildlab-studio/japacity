# Place: home and abroad

> Numbers are working values with their sources.
> Kind: `place`. One per character. Background: `../design/01-concept.md` sections 12 and 14, `../research/03-life-abroad-and-return.md`.
> Departure does not end the life (route:departure-pays-flight; `../decisions/0001-the-contract-carries-the-whole-life.md`).

A character is in one place at a time: at home in Lagos, or abroad in one country. Most entries carry `where`, and an entry only applies in its place.

The kind also holds `place.*` entries, one for each spot in a city (`place.ojuelegba`, the room, the test centre). They hold no state and change no rule here; their fields and rules are on `city.md` (city:place-entry-fields and on).

## Rules

**place:new-character-at-home** A new character is at home. The place slice holds `where` (`home` or `abroad`), the `country` (null at home), the month of the last move, and the record of every return: its month, its shape and the country left.

**place:departure-moves-abroad** The effect `place/move` with `to: "abroad"` is applied by `route/depart`, which sets the country from the route's entry, and by the road's arrival, which sets `country.italy` (road:sea-arrival-in-italy). `route/depart` is accepted only at home, since the airport's gate is in Lagos: no flight leaves from abroad or from the road, so the character never moves from one country to another. It records the month. The character's home obligations of type `upkeep` and `support` close; the family house is not charged for while you are away. A room rented at home is let go (home:compound-room-is-a-home): leaving Lagos or the road, `rent` closes with them, and the year paid is gone; the return goes to the family house (place:family-takes-you-back). Leaving Lagos, by flight or by the road, sells everything owned at its resale share (`things/sell-off`) and tells it in one line, "Before you left, what you owned was sold" (home:things-a-life-owns).

**place:entries-legal-by-where** An entry with `where: "home"` is not legal abroad, and one with `where: "abroad"` is not legal at home. `where: "any"` applies in both. This holds for activities (activity:illegal-slot-rejects-turn rejects a slot naming one), offers (they are not rolled and not opened), obligations (they are not opened) and routes (they are not heard of or looked into).

**place:return-home-paid-or-assisted** The command `return/home` is accepted abroad when either the fare can be paid or the character holds no status and nothing in any bank pocket abroad covers the fare (the assisted return). It applies `place/move` to home, closes every status, and records the return with its shape: `removed`, `assisted`, `broke`, `by-choice` or `with-papers`, by place:return-shape-decided-at-once.

**place:return-shape-decided-at-once** The shape of a return is decided when it happens, first match wins: `removed` if it follows the effect `status/remove`; `assisted` if no status was held and the fare was not paid; `broke` if the fare was paid and the character's bank and cash in every currency, valued in naira at the official rate, come to under the broke line; `with-papers` if the character holds a settled or citizen status at the moment of leaving; otherwise `by-choice`.

**place:fare-home-in-local-currency** The fare home is the route's country's fare in that country's currency, times the December factor when the world's `var.season-december` is 1. It is paid with `money/take` from `any` pocket of that currency, reason `fare`. A fare that cannot be paid from that currency may be paid from the naira pockets at the official rate plus the bank charge, as wallet:foreign-fee-payment-order does for fees.

**place:family-takes-you-back** On return the family house takes you back: the `upkeep` obligation reopens at the amount the starting life gave, the `support` obligation at its old amount if it existed, and a `standing` change applies by the shape of the return: `with-papers` +10, `by-choice` 0, `broke` -8, `assisted` -12, `removed` -20. These are the stigma numbers in `return.md`, repeated here so the kind has one source.

**place:removal-bans-the-country** A removal (status:removal-sends-home-banned) bans every route into that country for the `banMonths` of the country's overstayer status, counted from the removal's month. No route moves: while the ban holds, a route into that country is not heard of or looked into, and a partner route into it cannot be applied for. The ban lifts in the month that is the removal's month plus those months.

**place:view-shows-place-and-returns** The view shows `where`, the country, months since the last move, the record of returns (`country` null for a return from the road), the status token kept, and `fareHome`: the fare from the country the character is in with the December factor applied (place:fare-home-in-local-currency), null at home. It never shows the shape of a return as a record before it has happened; the forecast of place:view-carries-way-home is a forecast, and is marked as one.

**place:rides-between-city-places** A ride between two places of the city is the command `place/ride` with `from`, `to` and `way`. At home the ways are the danfo, the keke, the okada, `drive` and on foot. A ride at home is accepted when both are places at home and differ, and the naira in cash and bank together hold the way's fare, taken with the reason `fare` from cash first and the bank for the rest. On foot is accepted whenever the two positions are within `tuning.city.ride.walkMetres` of each other (a place with no position is always walkable). Past it a walk is refused, except a walk to the character's own home (`home.place`, the family house when none) while the naira in cash and bank together cannot pay the cheapest fare of the same ride by any other way (the danfo, the keke, the okada, and `drive` while the car stands at home, at the month's fares): a life with no fare home walks home however far, and a life with the fare takes a ride (world:ride-sheet-shows-fares). The fare grows with the distance: `rideFare` is the way's flag-down figure (`tuning.city.ride.fareKobo`) plus its figure a kilometre (`tuning.city.ride.farePerKmKobo`) over the straight-line metres between the two places' positions (`metresApart`, whole numbers, city:positions-rough-on-purpose), rounded up to fifty naira, then the month's factor; a place with no position (their room) stands at the flag-down figure; on foot the fare is nothing, so a character with no naira can always move. The ride sheet prices from the same function with content's positions, so it says what the ride takes to the kobo. The month the fuel scarcity's ask opens (`offer.fuel-scarcity`, answered or not) every fare is `tuning.city.ride.scarcityBp` of its flat figure, and the view's `place.fareBp` carries the month's factor so the ride sheet shows the same fares. `drive` is accepted only while the life's car stands at home (home:things-a-life-owns; the hostel has no car spot, so a car is stored there and Drive is not offered); its fare is `tuning.thing.drive`, ₦300 plus ₦100 a kilometre rounded up to ₦50, the scarcity factor applying, so a drive costs more than a danfo and less than an okada.

Abroad (decision 0017, design page 10) a ride is accepted between two places of the character's country (a place with `where: "abroad"` and the character's country, or a country-less abroad place such as the room), on the ways the country lists in `tuning.city.ride.abroad[country].ways` (`bus`, `train`, `taxi`, each with its flag-down figure, its figure a kilometre and its pace in the country's smallest unit) and on foot by the same walking rule as at home, the country's `lonMetresPerE3` measuring longitude. The room is the home there; it has no position of its own, so a walk's distance, to it or from it, reads it at the country's `homeSpot` (`walkPosition`, world:painted-maps-abroad), and a walk from the room to a stop past the walking limit is refused as any walk is, while its fares stay at the flag-down figure. A walk to the room past the walking limit is accepted only while the country's money in cash and bank together cannot pay the cheapest fare of the same ride by the country's ways, a way the month's pass covers or the shuttle serves counting as a fare of nothing. The fare is `rideFare` with the country's figures, rounded up to the country's `step` (five pence, five cents, twenty-five fils), taken from the country's currency with the reason `fare`, cash first and the bank for the rest; the scarcity factor is Lagos's and is not applied abroad. A country with no ways listed refuses a ride.

Short of the fare is `cannot-afford`; the same place twice, or a place elsewhere, is `not-legal`. The event `place/rode` records the ride, with the `currency` beside the `fare`. The view's `place.ways` lists the ways of the country the character is in with their figures (at home, the five ways), so the ride sheet prices from the same function. The simulation keeps no place of the city: the client holds where the character stands and moves only once the ride is accepted (decision 0017). `metresApart` and `withinMetres` read the metres a thousandth of a degree of longitude is worth from the country (`tuning.city.ride.lonMetresPerE3` at home, 111; `tuning.city.ride.abroad[country].lonMetresPerE3` abroad, the UK 69), since a degree of longitude shrinks toward the poles (at 51.5 degrees north it is about 0.62 of a degree of latitude); latitude stays at 111 everywhere. So the train from Peckham to Heathrow prices near £5.50 and the ward is within a walk's reach of Peckham where it is.

**place:country-pass-covers-ways** The pass (decision 0017, design page 11 section 4). A pass is the country's: `tuning.city.ride.abroad[country].pass` is the figure and `passWays` the ways it covers (the UK `["bus"]`; Canada and the UAE `["bus", "train"]`; Italy none). The act is the country's own: `activity.bus-pass-uk` at Peckham Rye station's ticket machine (£95), `activity.transit-pass-ca` at the CTrain station's machine (C$118), `activity.transit-pass-uae` at Union station's Nol machine (AED 140), each a now-act (`slot: "none"`, `when: "now"`, once a month) paid from the country's money with the reason `fare`, read from the month's played acts. In a month it has been played, a ride on a covered way asks no fare (the fare is 0 and `place/rode` records it so), and the ride sheet's pill says so in the country's money ("£0, bus pass", "C$0, transit pass", "AED 0, zone pass"); the UK's train stays per trip. The pass is the month's, not the life's: the next month asks again. A country without a `pass` figure has no pass.

**place:employer-shuttle-rides-free** The employer's shuttle (decision 0017, design page 11). A place entry abroad may carry `shuttle: true`: the labour bus to the site in Dubai (`place.site-uae`), the gangmaster's van to the fields in Castel Volturno (`place.farm-italy`). A ride by `bus` to or from such a place asks no fare whatever the month (the fare is 0 and `place/rode` records it so), and the view's stop carries `shuttle` so the ride sheet's pill says it ("AED 0, site bus", "€0, the van"); every other way to it is priced as usual and the walk keeps its limit. The shuttle is the way the job is reached, not a pass: it covers no other stop.

**place:view-carries-way-home** The place view carries `wayHome`, the way home from where the character is today as `return/home` would take it: the fare now and off peak, where it would come from (`local`: the country's money; `naira`: bought through the bank as place:fare-home-in-local-currency allows; null: nobody), the naira it takes when bought from naira with the bank's charge, the shape by place:return-shape-decided-at-once read after the fare is paid as the wallet would pay it, and the standing the return brings (the shape's figure and the capital, return:standing-by-return-shape). Where the command would refuse, the shape is null. From the road's far shore it is the assisted return with no fare (road:sea-arrival-in-italy). Null at home and on the road. It is a forecast of today, not the record: the record of returns still holds no shape before one happens (place:view-shows-place-and-returns). The client reads it and keeps no copy. The Go home card on the room abroad's bag reads everything it says from `wayHome` (return:standing-by-return-shape).

## Entries: countries

| Id | Currency | Fare home, off peak | December factor | Source |
|---|---|---|---|---|
| `country.uk` | GBP | £620 | 2.5 | One-way economy London to Lagos, mid 2025 press quotes of £550 to £700 off peak; December quotes of £1,500 and up (`../research/03-life-abroad-and-return.md` section 2) |
| `country.canada` | CAD | C$1,350 | 2.2 | Toronto to Lagos one-way economy, 2025, airline fare pages (not verified; see below) |
| `country.uae` | AED | AED 1,900 | 1.8 | Dubai to Lagos one-way economy, 2025 (not verified) |
| `country.italy` | EUR | €480 | 2.0 | Rome to Lagos one-way economy, 2025 (not verified). Where the road ends |

The December factor is the world's doing, not the country's: `var.season-december` is set by the director for one tick each game year. The slice records `decemberMonth`, the month the December visit last opened (null before), so a second turn in the same December tick does not open it twice and a turn a year old does not miss it.

## Numbers

| Setting | Value | In content as |
|---|---|---|
| Broke line, in naira | ₦500,000 | `tuning.place.brokeLine` = 50000000 |
| Fare paid from naira allowed | Yes, at the official rate plus the bank charge | `tuning.place.fareFromNaira` = true |
| A ride's flag-down figure | danfo ₦200, keke ₦300, okada ₦500 | `tuning.city.ride.fareKobo` (place:rides-between-city-places) |
| A ride's figure a kilometre | danfo ₦50, keke ₦100, okada ₦150 | `tuning.city.ride.farePerKmKobo` (place:rides-between-city-places) |
| A fare is said in | fifties of naira, rounded up | place:rides-between-city-places |
| The UK's ways (place:rides-between-city-places) | bus £1.75 flat, 250 m a minute; train £2.80 and 10p a kilometre, 600 m a minute; walk free, 80 m a minute; fares rounded up to 5p | `tuning.city.ride.abroad["country.uk"]` |
| The bus pass | £95 a month, the bus (`passWays` `["bus"]`) | `tuning.city.ride.abroad["country.uk"].pass`, `.passWays` (place:country-pass-covers-ways) |
| Canada's ways (place:rides-between-city-places, design page 11) | bus C$3.80 flat, 300 m a minute; CTrain (`train`) C$3.80 flat, 700 m a minute; taxi C$3.80 and C$2.00 a kilometre, 600 m a minute; walk free, 80 m a minute; fares rounded up to 5 cents | `tuning.city.ride.abroad["country.canada"]` |
| The transit pass | C$118 a month, bus and train | `tuning.city.ride.abroad["country.canada"].pass`, `.passWays` (place:country-pass-covers-ways) |
| The UAE's ways (place:rides-between-city-places, design page 11) | bus AED 4 and 50 fils a kilometre, 250 m a minute; metro (`train`) AED 4 and 50 fils a kilometre, 700 m a minute; taxi AED 12 and AED 2 a kilometre, 600 m a minute; walk free, 60 m a minute; fares rounded up to 25 fils | `tuning.city.ride.abroad["country.uae"]` |
| The zone pass | AED 140 a month, bus and metro | `tuning.city.ride.abroad["country.uae"].pass`, `.passWays` (place:country-pass-covers-ways) |
| Italy's ways (place:rides-between-city-places, design page 11) | bus €1.60 flat, 200 m a minute; walk free, 80 m a minute; no train, taxi or pass; fares rounded up to 5 cents | `tuning.city.ride.abroad["country.italy"]` |
| The shuttle (place:employer-shuttle-rides-free) | `place.site-uae` and `place.farm-italy` carry `shuttle: true`: the bus way to or from them asks nothing | the place entry's `shuttle` |

## Not verified

- The Canada, UAE and Italy fares are working values from fare pages read in 2025 press, not from an airline's published tariff. The UK fare is the best sourced. Re-check before tuning.

## Effects and requirements the place kind handles

| Type | | What it does, or when it is met |
|---|---|---|
| `place/move` | effect | Moves the character `to` home, abroad or the road, with the country; records the month (place:departure-moves-abroad) |
| `place/return` | effect | Sends the character home with this `shape`, as `return/home` would; from the road the return has no country (place:return-home-paid-or-assisted, road:exit-is-assisted-return) |
| `place/is` | requirement | `where` matches, and `country` when given |
| `place/returned` | requirement | a return of one of `shapes` is on record (place:removal-bans-the-country) |
| `place/months-here` | requirement | the character is in `where` and `month - movedMonth` is at least `months` |
| `place/banned` | requirement | a removal's ban holds on `country` this month (place:removal-bans-the-country); a partner application asks for it not to (person:partner-gate-needs) |
