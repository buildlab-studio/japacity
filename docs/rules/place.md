# Place: home and abroad

> Kind: `place`, one per character. Background: `../design/01-concept.md` sections 12 and 14, `../research/03-life-abroad-and-return.md`.
> Numbers are working values with their sources. Where the game differs from real life, the real value and the factor are given beside it.
> Departure does not end the life (route:departure-pays-flight; `../decisions/0001-the-contract-carries-the-whole-life.md`).

A character is in one place at a time: at home in Lagos, or abroad in one country. Most entries carry `where`, and an entry applies only in its place.

The kind also holds `place.*` entries, one for each spot in a city (`place.ojuelegba`, the room, the test centre). They hold no state and change no rule on this page. Their fields and rules are in `city.md`, from city:place-entry-fields on.

## Rules

**place:new-character-at-home** A new character starts at home. The place slice holds `where` (`home` or `abroad`), `country` (null at home), the month of the last move, and a record of every return: its month, its shape and the country left.

**place:departure-moves-abroad** The effect `place/move` with `to: "abroad"` is applied by `route/depart`, which sets the country from the route's entry, and by the road's arrival, which sets `country.italy` (road:sea-arrival-in-italy). It records the month.
- `route/depart` is accepted only at home, because the airport's gate is in Lagos. No flight leaves from abroad or from the road, so a character never moves from one country to another.
- The home obligations of type `upkeep` and `support` close. The family house is not charged for while the character is away.
- A room rented at home is given up (home:compound-room-is-a-home). Leaving Lagos or the road closes `rent` with it, and the year already paid is lost. A later return goes to the family house (place:family-takes-you-back).
- Leaving Lagos, by flight or by the road, sells everything owned at its resale share (`things/sell-off`) and says so in one line: "Before you left, what you owned was sold" (home:things-a-life-owns).

**place:entries-legal-by-where** An entry with `where: "home"` is not legal abroad, and one with `where: "abroad"` is not legal at home. `where: "any"` applies in both. This holds for:
- activities: activity:illegal-slot-rejects-turn rejects a slot that names one;
- offers: they are not rolled and not opened;
- obligations: they are not opened;
- routes: they are not heard of or looked into.

**place:return-home-paid-or-assisted** The command `return/home` is accepted abroad in three cases:
- the fare can be paid;
- the character holds no status and no bank pocket abroad covers the fare (the assisted return);
- it asks for the returns service (`scheme: true`) on an overstayer status whose entry carries a `returnGrant` (place:returns-service-takes-you-home).

From the UAE on `status.uae-irregular`, the fare is the fare plus the fine (status:uae-fine-accrues). The command applies `place/move` to home, closes every status except one that a trip home keeps (return:papers-return-keeps-status), and records the return with its shape (`removed`, `assisted`, `broke`, `by-choice` or `with-papers`) by place:return-shape-decided-at-once.

**place:return-shape-decided-at-once** The shape of a return is decided when it happens. The first match wins:
1. `removed` if it follows the effect `status/remove`;
2. `assisted` if no status was held and the fare was not paid, or the returns service took the character home;
3. `broke` if the fare was paid and the character's bank and cash in every currency, valued in naira at the official rate, come to less than the broke line;
4. `with-papers` if, at the moment of leaving, the character holds a settled or citizen status, or a status a trip home keeps (return:papers-return-keeps-status) with months left;
5. otherwise `by-choice`.

**place:fare-home-in-local-currency** The fare home is the country's fare in that country's currency, times the December factor when the world's `var.season-december` is 1. It is paid with `money/take` from `any` pocket of that currency, reason `fare`. If that currency cannot pay it, the fare may be paid from the naira pockets at the official rate plus the bank charge, in the same way wallet:foreign-fee-payment-order pays fees.

**place:family-takes-you-back** On return the family house takes the character back:
- the `upkeep` obligation reopens at the amount the starting life gave;
- the `support` obligation reopens at its old amount, if it existed;
- `standing` changes by the shape of the return: `with-papers` +10, `by-choice` 0, `broke` -8, `assisted` -12, `removed` -20 (`tuning.return.standing`).

`return.md` cites these figures and adds the capital's recovery (return:standing-by-return-shape).

**place:removal-bans-the-country** A removal (status:removal-sends-home-banned) bans every route into that country for the `banMonths` of the country's overstayer status, counted from the month of the removal. No route is changed. While the ban holds, a route into that country is not heard of or looked into, and a partner route into it cannot be applied for. The ban lifts in the month of the removal plus `banMonths`. A return from an overstay records its ban the same way (place:leaving-an-overstay-bans), and that ban is read the same way.

**place:leaving-an-overstay-bans** A return home from the country's overstayer status records a ban on that country, counted from the month of the return. The length depends on how the character left:
- at their own fare within the grace (status:grace-before-overstaying): no ban;
- at their own fare after the grace (`by-choice` or `broke`): the entry's `ownFareBanMonths`;
- `assisted`, by the assisted return or the returns service: the entry's `assistedBanMonths`;
- `removed`: the entry's `banMonths` (place:removal-bans-the-country).

A ban of 0 records nothing. A return from any other status records no ban. The UAE records no ban at all while the amnesty holds (status:uae-amnesty). In months:

| Country | Own fare, within the grace | Own fare, after it | Assisted | Removed |
|---|---|---|---|---|
| UK | none | 12 | 24 | 120 |
| Canada | none | none | 12 | 120 |
| UAE | none | 12 | 12 | 60 |
| Italy | none | none | none | 36 |

Real: the UK's refusal periods of Part Suitability SUI 11.5 and 12.1, Canada's departure, exclusion and deportation orders, the UAE's one-year labour ban and Italy's expulsion (`status.md`, Numbers).

**place:returns-service-takes-you-home** The returns service is the UK's Voluntary Returns Service, for a country whose overstayer entry carries a `returnGrant`. On that status, `return/home` with `scheme: true` is accepted whatever money the character holds:
- the scheme pays the fare (no `money/take`);
- the shape is `assisted`, and the ban is `assistedBanMonths` (24, place:leaving-an-overstay-bans);
- on arrival home, the `returnGrant` (£1,500) is credited to the naira bank at the day's official rate with the reason `gift`, not flagged, because the scheme's money is documented. A line says where the money came from.

An assisted return in the UK with no fare is the same service, grant included. Real: the service books the ticket for someone who cannot pay and may give up to £3,000 to restart. The game books it for anyone who asks and gives half the maximum.

**place:view-shows-place-and-returns** The view shows:
- `where`, the country, and the months since the last move;
- the record of returns (`country` is null for a return from the road);
- the status token kept;
- `fareHome`: the fare from the country the character is in, with the December factor applied (place:fare-home-in-local-currency), or null at home.

It never shows the shape of a return as a record before the return has happened. The forecast of place:view-carries-way-home is a forecast and is marked as one.

**place:rides-between-city-places** A ride between two places of the city is the command `place/ride` with `from`, `to` and `way`.

At home:
- The ways are the danfo, the keke, the okada, `drive` and on foot.
- A ride is accepted when both places are at home and differ, and the naira in cash and bank together hold the way's fare. The fare is taken with the reason `fare`, from cash first and the bank for the rest.
- On foot is accepted whenever the two positions are within `tuning.city.ride.walkMetres` of each other. A place with no position is always walkable.
- Past that distance a walk is refused, with one exception: a walk to or from the character's own home (`home.place`, or the family house when there is none) while the naira in cash and bank together cannot pay the cheapest fare of the same ride by any other way (the danfo, the keke, the okada, and `drive` while the car stands at home, at the month's fares). The long walk is a way out for a life that cannot pay a ride, never a way to save a fare. A life with no fare walks home, or out from home, however far; a life with the fare takes a ride (world:ride-sheet-shows-fares).
- The fare grows with distance. `rideFare` is the way's flag-down figure (`tuning.city.ride.fareKobo`) plus its figure per kilometre (`tuning.city.ride.farePerKmKobo`) times the straight-line distance between the two places' positions (`metresApart`, whole metres, city:positions-rough-on-purpose), rounded up to fifty naira, then multiplied by the month's factor. A place with no position (their room) costs the flag-down figure. On foot costs nothing, so a character with no naira can always move. The ride sheet prices rides with the same function and content's positions, so it shows exactly what the ride takes, to the kobo.
- In the month the fuel scarcity's ask opens (`offer.fuel-scarcity`, answered or not), every fare is `tuning.city.ride.scarcityBp` of its normal figure. The view's `place.fareBp` carries the month's factor so the ride sheet shows the same fares.
- `drive` is accepted only while the life's car stands at home (home:things-a-life-owns). The hostel has no car space, so a car is stored while the character lives there and Drive is not offered. Its fare is `tuning.thing.drive`: ₦300 plus ₦100 a kilometre, rounded up to ₦50, with the scarcity factor applied. A drive costs more than a danfo and less than an okada.

Abroad (decision 0017, `../design/10-london.md`):
- A ride is accepted between two places of the character's country: a place with `where: "abroad"` and that country, or an abroad place with no country, such as the room.
- The ways are those the country lists in `tuning.city.ride.abroad[country].ways` (`bus`, `train`, `taxi`, each with its flag-down figure, its figure per kilometre and its pace, in the country's smallest unit), plus on foot under the same walking rule as at home. The country's `lonMetresPerE3` measures longitude.
- The room is the home abroad. It has no position of its own, so the distance of a walk to or from it is read from the country's `homeSpot` (`walkPosition`, world:painted-maps-abroad). Its fares stay at the flag-down figure.
- A walk to or from the room past the walking limit is accepted only while the country's money in cash and bank together cannot pay the cheapest fare of the same ride by the country's ways. A way the month's pass covers, or the shuttle serves, counts as a fare of nothing. With the fare in hand, the walk is refused like any walk past the limit.
- The fare is `rideFare` with the country's figures, rounded up to the country's `step` (five pence, five cents, twenty-five fils), taken from the country's currency with the reason `fare`, cash first and the bank for the rest. The scarcity factor is Lagos's and does not apply abroad.
- A country with no ways listed refuses every ride.

Everywhere:
- Short of the fare is `cannot-afford`. The same place twice, or a place elsewhere, is `not-legal`.
- The event `place/rode` records the ride, with `currency` beside `fare`.
- The view's `place.ways` lists the ways of the country the character is in, with their figures (at home, the five ways), so the ride sheet prices from the same function.
- The simulation keeps no position in the city. The client holds where the character stands and moves the character only once the ride is accepted (decision 0017).
- `metresApart` and `withinMetres` read how many metres a thousandth of a degree of longitude is worth from the country: `tuning.city.ride.lonMetresPerE3` at home (111), `tuning.city.ride.abroad[country].lonMetresPerE3` abroad (the UK 69). A degree of longitude shrinks towards the poles; at 51.5 degrees north it is about 0.62 of a degree of latitude. Latitude stays at 111 everywhere. So the train from Peckham to Heathrow costs about £5.50, and the ward is within walking distance of Peckham, as it is in reality.

**place:country-pass-covers-ways** A pass belongs to a country (decision 0017, `../design/11-calgary-dubai-and-castel-volturno.md` section 4). `tuning.city.ride.abroad[country].pass` is its price and `passWays` the ways it covers: the UK `["bus"]`; Canada and the UAE `["bus", "train"]`; Italy none.
- Each country has its own act: `activity.bus-pass-uk` at Peckham Rye station's ticket machine (£95), `activity.transit-pass-canada` at the CTrain station's machine (C$118), `activity.transit-pass-uae` at Union station's Nol machine (AED 140). Each is a now-act (`slot: "none"`, `when: "now"`, once a month), paid from the country's money with the reason `fare`, and read from the month's played acts.
- In a month the pass was bought, a ride on a covered way costs nothing: the fare is 0 and `place/rode` records it so. The ride sheet's pill says so in the country's money ("£0, bus pass", "C$0, transit pass", "AED 0, zone pass"). The UK's train is still paid per trip.
- The pass lasts the month, not the life: the next month needs a new one. A country without a `pass` figure has no pass.

**place:employer-shuttle-rides-free** The employer's shuttle (decision 0017, `../design/11-calgary-dubai-and-castel-volturno.md`). A place entry abroad may carry `shuttle: true`: the labour bus to the site in Dubai (`place.site-uae`) and the gangmaster's van to the fields in Castel Volturno (`place.farm-italy`). A ride by `bus` to or from such a place costs nothing in any month (the fare is 0 and `place/rode` records it so). The view's stop carries `shuttle`, so the ride sheet's pill says it ("AED 0, site bus", "€0, the van"). Every other way to the place is priced as usual, and the walk keeps its limit. The shuttle is how the job is reached, not a pass: it covers no other stop.

**place:view-carries-way-home** The place view carries `wayHome`: the way home from where the character is today, as `return/home` would take it. It holds:
- the fare now and off peak;
- where the fare would come from: `local` (the country's money), `naira` (bought through the bank, as place:fare-home-in-local-currency allows) or null (nobody);
- the naira it takes when bought from naira, with the bank's charge;
- the shape by place:return-shape-decided-at-once, read after the fare is paid as the wallet would pay it;
- the standing the return brings (the shape's figure and the capital, return:standing-by-return-shape);
- `banMonths`, the ban the return would record (place:leaving-an-overstay-bans), 0 for none.

From the UAE on `status.uae-irregular` the fare includes the fine, and `fine` says how much of it is the fine (status:uae-fine-accrues). Beside it, `scheme` is the returns service's way where the status has one (place:returns-service-takes-you-home): the grant in naira at the day's rate, and its ban; null elsewhere. Where the command would refuse, the shape is null. From the road's far shore it is the assisted return with no fare (road:sea-arrival-in-italy). `wayHome` is null at home and on the road.

It is a forecast for today, not the record: the record of returns still holds no shape before a return happens (place:view-shows-place-and-returns). The client reads it and keeps no copy. The Go home card on the bag in the room abroad reads everything it shows from `wayHome` (return:standing-by-return-shape).

## Entries: countries

| Id | Currency | Fare home, off peak | December factor | Source |
|---|---|---|---|---|
| `country.uk` | GBP | £380 | 1.7 | Real, London to Lagos one way: cheapest £330, recent deals £335 to £389; the game sits at the top of the deals (about 1.0). The December return's median is £1,108: £1,108 times 1.15 over £760 is 1.68 (KAYAK UK; `../research/03-life-abroad-and-return.md` section 2) |
| `country.canada` | CAD | C$1,350 | 1.2 | Real, Calgary to Lagos one way: about C$1,368 on average, so the game's figure is about 1.0; the December return's median is C$2,895 (February's C$1,675): C$2,895 times 1.15 over C$2,700 is 1.23 (KAYAK Canada, Calgary to Lagos) |
| `country.uae` | AED | AED 1,300 | 1.4 | Real, Dubai to Lagos one way: AED 1,168 to AED 1,399, average AED 1,265; the game about 1.0. The December return's median is AED 3,147 (February's AED 2,310): AED 3,147 times 1.15 over AED 2,600 is 1.39 (KAYAK UAE) |
| `country.italy` | EUR | €480 | 1.2 | Real, Rome to Lagos one way: cheapest €307, typical €395 to €543, average €381; the game about 1.25 times the average. Where the road ends. The December return's median is €967: €967 times 1.15 over €960 is 1.16 (KAYAK Italy) |

**place:december-factor-from-the-real-median** Every country's December factor (`decemberFactorBp`) is set the same way: the city's real December return median, times 1.15 for the Christmas week's peak over the month's median, divided by twice the game's one-way fare home, rounded to the nearest tenth. The table above shows each sum. A country added later takes its factor the same way.

The December factor belongs to the world, not the country: the director sets `var.season-december` for one tick each game year. The slice records `decemberMonth`, the month the December visit last opened (null until it first opens), so a second turn in the same December tick does not open it twice, and a turn a year later does not miss it.

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| Broke line, in naira | ₦500,000 | Working value | `tuning.place.brokeLine` = 50000000 |
| Standing by the shape of a return | `with-papers` +10, `by-choice` 0, `broke` -8, `assisted` -12, `removed` -20 | Working value; the welcome by shape follows the returnee reports in Sources | `tuning.return.standing` (place:family-takes-you-back) |
| Fare paid from naira allowed | Yes, at the official rate plus the bank charge | Working value | `tuning.place.fareFromNaira` = true |
| A ride's flag-down figure | danfo ₦200, keke ₦300, okada ₦500 | Working value | `tuning.city.ride.fareKobo` (place:rides-between-city-places) |
| A ride's figure a kilometre | danfo ₦50, keke ₦100, okada ₦150 | Working value | `tuning.city.ride.farePerKmKobo` (place:rides-between-city-places) |
| A fare is said in | fifties of naira, rounded up | Working value | place:rides-between-city-places |
| The UK's ways (place:rides-between-city-places) | bus £1.75 flat, 250 m a minute; train £2.80 and 10p a kilometre, 600 m a minute; walk free, 80 m a minute; fares rounded up to 5p | 2025 London fares, rounded: the hopper fare £1.75, a zone 1 to 6 off-peak single about £5.60 (`../design/10-london.md` section 5) | `tuning.city.ride.abroad["country.uk"]` |
| The bus pass | £95 a month, the bus (`passWays` `["bus"]`) | 2025 London monthly bus and tram pass, about £95 (`../design/10-london.md` section 5) | `tuning.city.ride.abroad["country.uk"].pass`, `.passWays` (place:country-pass-covers-ways) |
| Canada's ways (place:rides-between-city-places) | bus C$3.80 flat, 300 m a minute; CTrain (`train`) C$3.80 flat, 700 m a minute; taxi C$3.80 and C$2.00 a kilometre, 600 m a minute; walk free, 80 m a minute; fares rounded up to 5 cents | 2025 Calgary figures, rounded (`../design/11-calgary-dubai-and-castel-volturno.md` section 4) | `tuning.city.ride.abroad["country.canada"]` |
| The transit pass | C$118 a month, bus and train | 2025 Calgary Transit monthly pass, rounded (`../design/11-calgary-dubai-and-castel-volturno.md` section 4) | `tuning.city.ride.abroad["country.canada"].pass`, `.passWays` (place:country-pass-covers-ways) |
| The UAE's ways (place:rides-between-city-places) | bus AED 4 and 50 fils a kilometre, 250 m a minute; metro (`train`) AED 4 and 50 fils a kilometre, 700 m a minute; taxi AED 12 and AED 2 a kilometre, 600 m a minute; walk free, 60 m a minute; fares rounded up to 25 fils | 2025 Dubai zone fares read as distance, rounded (`../design/11-calgary-dubai-and-castel-volturno.md` section 4) | `tuning.city.ride.abroad["country.uae"]` |
| The zone pass | AED 140 a month, bus and metro | 2025 Nol zone pass, rounded (`../design/11-calgary-dubai-and-castel-volturno.md` section 4) | `tuning.city.ride.abroad["country.uae"].pass`, `.passWays` (place:country-pass-covers-ways) |
| Italy's ways (place:rides-between-city-places) | bus €1.60 flat, 200 m a minute; walk free, 80 m a minute; no train, taxi or pass; fares rounded up to 5 cents | 2025 coast road bus fare, rounded (`../design/11-calgary-dubai-and-castel-volturno.md` section 4) | `tuning.city.ride.abroad["country.italy"]` |
| The shuttle (place:employer-shuttle-rides-free) | `place.site-uae` and `place.farm-italy` carry `shuttle: true`: the bus way to or from them asks nothing | Working value | the place entry's `shuttle` |

## Not verified

- The fares are fare-search snapshots for the coming months, not an airline's published tariff, and fare searches change daily.
- The 1.15 for the Christmas week over December's median is a working value.

## Sources

- [KAYAK UK: London to Lagos](https://www.kayak.co.uk/flight-routes/London-LON/Lagos-LOS), [KAYAK UAE: Dubai to Lagos](https://www.kayak.ae/flight-routes/Dubai-DXB/Lagos-LOS), [KAYAK Italy: Rome to Lagos](https://www.kayak.it/flight-routes/Roma-ROM/Lagos-LOS), read 23 Oct 2026, the one-way fares
- [KAYAK UK: London to Lagos](https://www.kayak.co.uk/flight-routes/London-LON/Lagos-Murtala-Muhammed-LOS), [KAYAK Canada: Calgary to Lagos](https://www.ca.kayak.com/flight-routes/Calgary-Intl-YYC/Lagos-Murtala-Muhammed-LOS), [KAYAK UAE: Dubai to Lagos](https://www.kayak.ae/flight-routes/Dubai-Intl-DXB/Lagos-Murtala-Muhammed-LOS), [KAYAK Italy: Rome to Lagos](https://www.kayak.it/flight-routes/Roma-ROM/Lagos-Murtala-Muhammed-LOS), read 24 Oct 2026: Calgary's one-way average and every country's December return median (place:december-factor-from-the-real-median)
- [GOV.UK: Voluntary Returns Service, up to £3,000](https://www.gov.uk/return-home-voluntarily/who)
- [New Lines: Nigeria's returnees are not always welcome](https://newlinesmag.com/reportage/nigerias-returnees-arent-always-welcome/)
- [The New Humanitarian: returnees treated alike](https://www.thenewhumanitarian.org/news-feature/2020/07/28/Nigeria-migrants-return-Europe)

## Effects and requirements

The effects and requirements the place kind handles:

| Type | | What it does, or when it is met |
|---|---|---|
| `place/move` | effect | Moves the character `to` home, abroad or the road, with the country; records the month (place:departure-moves-abroad) |
| `place/return` | effect | Sends the character home with this `shape`, as `return/home` would; from the road the return has no country (place:return-home-paid-or-assisted, road:exit-is-assisted-return) |
| `place/is` | requirement | `where` matches, and `country` when given |
| `place/returned` | requirement | a return of one of `shapes` is on record (place:removal-bans-the-country) |
| `place/months-here` | requirement | the character is in `where` and `month - movedMonth` is at least `months` |
| `place/banned` | requirement | a removal's ban, or an overstay's (place:leaving-an-overstay-bans), holds on `country` this month (place:removal-bans-the-country); a partner application requires that it does not (person:partner-gate-needs) |
