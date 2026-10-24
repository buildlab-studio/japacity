# Calgary, Dubai and Castel Volturno

**Context and scope.** The three countries beside the UK as the player lives them: Canada's Calgary on the points, spouse and accompanying routes, the UAE's Dubai on the Gulf contract, and Italy's Castel Volturno at the end of the road, the journey overland and by sea (`../rules/road.md`). Each is drawn as London is (`10-london.md`): a painted map, rides paid at the stop, food bought and cooked, a workplace with a door. The code is the ways with `passWays` and `shuttle` (decision 0017), the places, the acts, the three painted maps (`apps/client/src/features/map/paper/calgary.tsx`, `dubai.tsx`, `castel.tsx`) and the rides in each country's vehicles. The rules are world:painted-maps-abroad, world:ride-abroad-and-workplace, streets:calgary-life-by-hand, streets:dubai-life-by-hand, streets:castel-volturno-by-hand, place:country-pass-covers-ways and place:employer-shuttle-rides-free.

**Goals.**

- Each country gives players its own glimpse of the life abroad they look toward: the cut of its days and its money that tells what that life is like.
- Each country has what London has, cut to its size: fewer places, its own ways, its own staple vehicle.
- What a country shares with London is London's scene under the country's own entry, so only what is that country's has models of its own.

**Non-goals.** Any change to the rules of money, visas, jobs and the family; a driving licence or a test sat in Canada or the UAE; a train, a taxi or a pass in Castel Volturno.

## 1. The decision in one line

Each country is lived as London is, with its own glimpse: Calgary is the cold, the CTrain and a strip mall with an African store; Dubai is the heat, the labour bus at dawn, the camp and the exchange house; Castel Volturno is the roundabout at dawn, the van to the fields and the bus on the coast road. The interiors a country shares with London (a care home, a warehouse, an office, a big shop, a church) reuse London's scenes under the country's own entry, so only what is that country's has models of its own.

## 2. What a player sees

**Calgary** (the points route, the spouse and the accompanying routes; CAD). The painted map is the north-east: the wide grid, the CTrain line to downtown, the airport to the north, the Bow river along the south. The strip mall is the hub: the jobs notice, the coffee shop, the African store, the bus stop. The CTrain station sells the month's pass, good on the bus and the train. The superstore sells the weekly shop; the basement room cooks in dollars. The warehouse by the airport, the care home, the office downtown and the library's evening course are places with doors. The church hall has the newcomers' group. The upkeep is the prepaid phone; food and transport are lived. The cold is in the words, not the rules.

**Dubai** (the Gulf contract; AED). The painted map is Deira: the creek across the west, the metro's line, the airport to the south-east, the camp to the east, the site south across the creek. The room abroad is the bed space in the camp; the employer houses a contract worker, so it asks no rent (`../rules/abroad-money.md`). The site is where the guard's post or the cleaner's trolley is, reached by the labour bus at the camp's gate for nothing, every day; the job comes with the contract, so the site says On shift from the first morning. Deira has the typing centre, the exchange house for money home, the cafeteria, the African foods shop, the barber and the community corner by the creek. Naif has the souk and the laundry. The metro station sells the zone pass, good on the bus and the metro. The upkeep is the prepaid phone.

**Castel Volturno** (the road; EUR). The painted map is the coast: the sea along the west, the Domitiana running the length of the paper, the river, the fields inland, Naples on an inset. The roundabout at the town's hub is where the vans come at dawn: the farm's cash job is got there. The farm is where it is done, reached by the gangmaster's van for nothing; the pay is in hand and some months it never comes, as the rule says. The Domitiana's stretch has the bus stop, the Nigerian shop, the call shop for money home and the pickup point. The discount supermarket sells the weekly shop; the room in a shared flat cooks in euros. The church is the community's. There is no pass; the bus is paid each time. The upkeep is the prepaid phone.

## 3. The places

Positions in thousandths of a degree (city:positions-rough-on-purpose); made-up spots marked. A place with `assets` named reuses that scene under its own entry (city:places-stage-their-acts: a country's own place stages what it stages). The room's bag is the bag by its door (world:japacity-bag-by-door), where the way home and December's flight are taken. The find is a street find, something interesting seen on the street that the player may stop and look at (`offer.street-find-canada`, `-uae`, `-italy`).

### Calgary (ten stops)

| Id | Shown as | Where | Position | Scope | Stages (things) |
|---|---|---|---|---|---|
| `place.the-room` | The basement room, north-east Calgary | the home, country-less; its sticker at the country's home spot | 51088, -113955 (made up) | interior | the bed, the cooking corner (`activity.cook-own-canada`), the laptop, the phone, the post, the bag |
| `place.calgary-north-east` | The strip mall, north-east Calgary | the hub, at a made-up spot in the north-east so the paper reads right | 51090, -113960 (made up) | exterior | the jobs notice (`activity.job-hunt`), the coffee shop (`activity.coffee-canada`), the African store (`activity.naija-shop-canada`) with its transfer counter (`activity.send-money`), the bus stop, the bench, the find |
| `place.ctrain-station-canada` | The CTrain station | its own scene | 51073, -113977 (made up, on the north-east line) | exterior | the ticket machine (`activity.transit-pass-canada`), the platform (the train's stop) |
| `place.big-shop-canada` | The superstore | on the scene `big-shop-uk` | 51095, -113980 (made up) | interior | the trolley (`activity.weekly-shop-canada`), the notice (overtime) |
| `place.warehouse-canada` | The warehouse by the airport | on the scene `warehouse-uk` | 51110, -113990 (made up) | interior | the clock-in (`activity.job-canada-warehouse`), the rota board (`activity.overtime`), the shelter |
| `place.care-home-canada` | The care home | on the scene `care-home-uk` | 51080, -113995 (made up) | interior | the door (`activity.job-canada-care-aide`), the rota board (`activity.overtime`), the tea point |
| `place.office-canada` | The office downtown | on the scene `office-uk` | 51046, -114063 | interior | the desk (`activity.job-canada-professional`), the glass office (`activity.job-canada-developer`), the kitchen |
| `place.library-canada` | The library | its own scene | 51092, -113972 (made up) | interior | the course desk (`activity.learn-tech-canada`), the shelves, the notice |
| `place.church-canada` | The church hall | on the scene `church-uk` | 51085, -113965 (made up) | interior | the pews (`activity.community-canada`), the hall (the people a life can meet, world:nobody-picked-from-list) |
| `place.calgary-airport` | Calgary International Airport | the airport | 51122, -114014, on the paper | interior | the arrival; December's flight and the way home stay on the room's bag |

### Dubai (seven stops)

| Id | Shown as | Where | Position | Scope | Stages (things) |
|---|---|---|---|---|---|
| `place.the-room` | The bed space, the camp | the home, country-less; its sticker at the country's home spot | 25270, 55395 (made up, east of the city) | interior | the bed, the cooking corner (`activity.cook-own-uae`), the phone, the post, the bag; the labour bus at the gate is the ride to the site |
| `place.deira` | Deira | the hub | 25273, 55305 | exterior | the typing centre (`activity.job-hunt`), the exchange house (`activity.send-money`), the cafeteria (`activity.cafeteria-uae`), the African foods shop (`activity.naija-shop-uae`), the barber (`activity.barber-uae`), the corner by the creek (`activity.community-uae`), the find (`offer.street-find-uae`) |
| `place.naif` | Naif | its own scene | 25272, 55310 | exterior | the souq (`activity.street-shopping-uae`), the laundry (`activity.laundry-uae`), the tailor (`activity.buy-clothes-uae`) |
| `place.metro-station-uae` | Union station | its own scene | 25266, 55312 | exterior | the Nol machine (`activity.transit-pass-uae`), the platform (the metro's stop) |
| `place.big-shop-uae` | The hypermarket | on the scene `big-shop-uk` | 25265, 55320 (made up, Al Rigga) | interior | the trolley (`activity.weekly-shop-uae`) |
| `place.site-uae` | The site | its own scene; `shuttle: true` | 25186, 55263 (made up, the towers across the creek) | exterior | the guard's post (`activity.job-gulf-guard`), the cleaner's trolley (`activity.job-gulf-cleaner`), the rota board (`activity.overtime`), the labour bus at the gate, the water cooler (a colleague's line) |
| `place.dubai-airport` | Dubai International Airport | the airport | 25252, 55367, on the paper | interior | the arrival; December's flight and the way home stay on the room's bag |

The UAE has no test centre: the Gulf route sits no test there. Canada has no registry: the driving test is the UK's alone (car:licence-and-driving-test).

### Castel Volturno (seven stops)

| Id | Shown as | Where | Position | Scope | Stages (things) |
|---|---|---|---|---|---|
| `place.the-room` | The room in a shared flat, the Domitiana | the home, country-less; its sticker at the country's home spot | 40950, 14010 (made up) | interior | the bed, the cooking corner (`activity.cook-own-italy`), the phone, the post, the bag |
| `place.castel-volturno` | Castel Volturno (its real name; the roundabout is its thing) | the hub | 41034, 13941 | exterior | the roundabout (`activity.job-hunt`: the vans at dawn), the bar (`activity.coffee-italy`), the African shop (`activity.naija-shop-italy`), the call shop (`activity.send-money`), the bus stop, the find |
| `place.via-domitiana` | Via Domitiana (its real name) | its own scene | 40929, 14025 | exterior | the bus stop, the pickup point (`activity.overtime`: the second shift), the Nigerian shop (`activity.street-shopping-italy`), the barber (`activity.barber-italy`), the market stall (`activity.buy-clothes-italy`) |
| `place.farm-italy` | The fields | its own scene; `shuttle: true` | 41010, 13990 (made up, inland) | exterior | the gangmaster's table (`activity.job-italy-farm-cash`), the crates, the van, the water tap (a colleague's line) |
| `place.big-shop-italy` | The discount supermarket | on the scene `big-shop-uk` | 41030, 13950 (made up) | interior | the trolley (`activity.weekly-shop-italy`) |
| `place.church-italy` | The church | on the scene `church-uk` | 41028, 13945 (made up) | interior | the pews (`activity.community-italy`), the hall (world:nobody-picked-from-list) |
| `place.naples-airport` | Naples Airport | the airport | 40884, 14285, on an inset | interior | the assisted return; the way home stays on the room's bag |

## 4. The ways and the fares

Each in the country's smallest unit, rounded up to its step; 2025 figures, rounded. The pass covers the ways the country names (`passWays`), bought once a month at the station's machine with the reason `fare` (place:country-pass-covers-ways). A place marked `shuttle` (a place the employer's own transport serves) is reached by the employer's bus for nothing on the `bus` way, the fare pill saying so (place:employer-shuttle-rides-free): the labour bus to the site, the gangmaster's van to the fields.

### Calgary

| Way | Flag-down | A kilometre | Pace | Notes |
|---|---|---|---|---|
| Bus | C$3.80 | nothing | 300 m a minute | One flat fare |
| CTrain (`train`) | C$3.80 | nothing | 700 m a minute | The same fare, one ticket for both |
| Taxi | C$3.80 | C$2.00 | 600 m a minute | For the airport and the cold |
| Walk | nothing | nothing | 80 m a minute | Within `walkMetres`; home always |
| The transit pass | C$118 a month | | | `activity.transit-pass-canada`, the station's machine; covers bus and train |

Step 5 cents. `lonMetresPerE3` 71: a thousandth of a degree of longitude is 71 metres at Calgary's latitude, which sets walking distances on its map.

### Dubai

| Way | Flag-down | A kilometre | Pace | Notes |
|---|---|---|---|---|
| Bus | AED 4 | 50 fils | 250 m a minute | The zone fare, read as distance |
| Metro (`train`) | AED 4 | 50 fils | 700 m a minute | The same fare |
| Taxi | AED 12 | AED 2 | 600 m a minute | |
| Walk | nothing | nothing | 60 m a minute | The heat: slower than anywhere |
| The zone pass | AED 140 a month | | | `activity.transit-pass-uae`, the Nol machine; covers bus and metro |
| The labour bus | nothing | | | `place.site-uae` is `shuttle`: the bus way to it asks nothing, "AED 0, site bus" |

Step 25 fils. `lonMetresPerE3` 100.

### Castel Volturno

| Way | Flag-down | A kilometre | Pace | Notes |
|---|---|---|---|---|
| Bus | €1.60 | nothing | 200 m a minute | The coast road's bus, slow and rare |
| Walk | nothing | nothing | 80 m a minute | |
| The van | nothing | | | `place.farm-italy` is `shuttle`: the bus way to it asks nothing, "€0, the van" |

No train, no taxi, no pass. Step 5 cents. `lonMetresPerE3` 84. Naples airport, on an inset, is reached by bus at the flat fare; the December flight and the return are taken at the bag.

## 5. The money of a month, by hand

Priced acts done on the spot (now-acts) in the country's money, each spending its time (turn:month-lived-in-half-days), repeating unless said, the body moving as quality:body-belly-and-energy says; content in `packages/content/src/activity/activity.calgary.data.ts`, `activity.dubai.data.ts` and `activity.castel.data.ts` (streets:calgary-life-by-hand, streets:dubai-life-by-hand, streets:castel-volturno-by-hand). The upkeep of each country is the prepaid phone alone (abroad-money:arrival-opens-upkeep-and-room); the rent is as `../rules/abroad-money.md` sets it.

### Calgary

| What | Figure | Act |
|---|---|---|
| The weekly shop | C$90, belly +40 | `activity.weekly-shop-canada`, the superstore, repeats |
| A meal in the room | C$8, belly +25 | `activity.cook-own-canada`, the cooking corner, repeats |
| A coffee | C$3, wellbeing +2 | `activity.coffee-canada`, the strip mall, repeats |
| The African store | C$40, belly +30, wellbeing +8 | `activity.naija-shop-canada`, the strip mall, repeats |
| The barber | C$30, wellbeing +5, standing +1, interview-prep +2 | `activity.barber-canada`, the strip mall, once a month |
| Winter clothes | C$120, standing +1, wellbeing +4 | `activity.buy-clothes-canada`, the superstore, once a month |
| The phone, prepaid | C$30 a month | `obligation.upkeep-canada` |
| The room | C$900 a month | `obligation.rent-room-canada` |

A warehouse job (C$38,000 a year, about C$2,700 a month after the flat band) less the room, the pass, four weekly shops, ten meals, the phone and a cut leaves about C$1,200: Calgary pays, and the cold and the car are the price.

### Dubai

| What | Figure | Act |
|---|---|---|
| The weekly shop | AED 150, belly +40 | `activity.weekly-shop-uae`, the hypermarket, repeats |
| A meal at the camp | AED 8, belly +25 | `activity.cook-own-uae`, the cooking corner, repeats |
| The cafeteria | AED 12, belly +25, wellbeing +3 | `activity.cafeteria-uae`, Deira, repeats |
| The African foods shop | AED 60, belly +30, wellbeing +8 | `activity.naija-shop-uae`, Deira, repeats |
| The barber | AED 25, wellbeing +5, standing +1 | `activity.barber-uae`, Deira, once a month |
| The tailor | AED 80, standing +1, wellbeing +3 | `activity.buy-clothes-uae`, Naif, once a month |
| The laundry | AED 20, wellbeing +2 | `activity.laundry-uae`, Naif, repeats |
| The souq | AED 80, wellbeing +5 (`tuning.street.shoppingAed`) | `activity.street-shopping-uae`, Naif, reason `enjoyment` |
| The phone, prepaid | AED 50 a month | `obligation.upkeep-uae` |
| The bed space | nothing while the contract's status holds; AED 1,200 otherwise | `obligation.rent-room-uae` |

The contract's salary (`CONTRACT_SALARY`, the agent's term) less four weekly shops, the phone, a few evenings in Deira and the pass for them leaves most of it for home: the Gulf sends money home and gives little else, which is the glimpse.

### Castel Volturno

| What | Figure | Act |
|---|---|---|
| The weekly shop | €35, belly +40 | `activity.weekly-shop-italy`, the discount supermarket, repeats |
| A meal in the flat | €4, belly +25 | `activity.cook-own-italy`, the cooking corner, repeats |
| A coffee at the bar | €1.20, wellbeing +2 | `activity.coffee-italy`, the roundabout, repeats |
| The African shop | €20, belly +30, wellbeing +8 | `activity.naija-shop-italy`, the roundabout, repeats |
| The barber | €10, wellbeing +5, standing +1 | `activity.barber-italy`, the Domitiana, once a month |
| Clothes from the stall | €25, standing +1, wellbeing +3 | `activity.buy-clothes-italy`, the Domitiana, once a month |
| The Nigerian shop's evening | €15, wellbeing +5 | `activity.street-shopping-italy`, the Domitiana, reason `enjoyment` |
| The phone, prepaid | €10 a month | `obligation.upkeep-italy` |
| The room | €350 a month | `obligation.rent-room-italy` |

The farm's cash (€9,600 a year, €800 a month, a quarter of months paid nothing) less the room, four weekly shops, ten meals, the bus and the phone leaves about €240, and a withheld month is a hole: the road's glimpse is work at dawn, a shared flat and money that is barely there.

## 6. The painted maps and the vehicles

Three descriptors in `apps/client/src/features/map/paper/city.ts`, as London's: Calgary (the grid, the CTrain line from the north-east to downtown, the airport north, the Bow river south; cards: the north-east, the airport, downtown; the home sticker at the country's home spot), Dubai (the creek, the metro line, the airport south-east, the camp east, the site south; cards: Deira, the airport, the camp, the site), Castel Volturno (the sea west, the Domitiana the length of the paper, the river, the fields; cards: the town, the Domitiana, the fields; Naples airport on an inset). Each its own chunk, loaded only when the map shows that country (world:painted-maps-abroad); the stops list stays for a screen reader. The ride plays inside the country's vehicle (world:ride-abroad-and-workplace): Calgary's bus and the CTrain car, Dubai's metro car, the labour bus and the taxi, Castel Volturno's blue bus and the white van. Each ride has its own boarding and road lines (six and three), in the voice of `../rules/text.md`, and the fare pill in the country's money.

## 7. The recorded lives

The recorded lives that go abroad (graduate-abroad, banker-abroad and developer-abroad) all fly to the UK, so no golden of theirs rests on these countries or their upkeep figures. `packages/sim/src/simulated-play/lives.countries.data.ts` records a points life to Calgary (`developer-canada`) and a contract life to Dubai (`banker-gulf`); no recorded life takes the road to Castel Volturno.

## 8. Alternatives considered

- **One model per place in every country.** Each country's care home, warehouse, office, big shop and church built anew. It costs models and download for rooms that look alike the world over; London's scenes under each country's own entry keep only what is that country's to build.
- **A workplace abroad shared by every country.** One country-less workplace for all jobs abroad. It would make every country's job the same door; each country's workplaces stage its own jobs.
