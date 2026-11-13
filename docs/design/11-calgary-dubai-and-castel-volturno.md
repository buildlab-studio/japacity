# Calgary, Dubai and Castel Volturno

**Context and scope.** This page covers the three countries besides the UK as the player lives them:

- Canada: Calgary, reached on the points, spouse and accompanying routes;
- the UAE: Dubai, reached on the Gulf contract;
- Italy: Castel Volturno, at the end of the road, the journey overland and by sea (`../rules/road.md`).

Each is built as London is (`10-london.md`): a painted map, rides paid at the stop, food bought and cooked, and a workplace with a door. The code is the ways, with `passWays` and `shuttle` (decision 0017), the places, the acts, the three painted maps (`apps/client/src/features/map/paper/calgary.tsx`, `dubai.tsx`, `castel.tsx`) and the rides in each country's vehicles. The rules are world:painted-maps-abroad, world:ride-abroad-and-workplace, streets:calgary-life-by-hand, streets:dubai-life-by-hand, streets:castel-volturno-by-hand, place:country-pass-covers-ways and place:employer-shuttle-rides-free.

**Goals.**

- Each country shows players what that life abroad is like, through the shape of its days and its money.
- Each country has what London has, cut to its size: fewer places, its own ways, its own everyday vehicle.
- Interiors a country shares with London reuse London's scenes under the country's own entries, so only what is particular to the country gets its own models.

**Non-goals.** Any change to the rules of money, visas, jobs and the family; a driving licence or test taken in Canada or the UAE; a train, a taxi or a pass in Castel Volturno.

## 1. Summary

Each country is lived as London is, with its own character:

- **Calgary**: the cold, the CTrain, and a strip mall with an African store.
- **Dubai**: the heat, the labour bus at dawn, the camp and the exchange house.
- **Castel Volturno**: the roundabout at dawn, the van to the fields, and the bus on the coast road.

The interiors a country shares with London (a care home, a warehouse, an office, a big shop, a church) reuse London's scenes under the country's own entries, so only what is particular to the country gets models of its own.

## 2. What a player sees

**Calgary** (the points route, the spouse and the accompanying routes; CAD).

- The painted map shows the north-east: the wide grid, the CTrain line to downtown, the airport to the north, the Bow river along the south.
- The strip mall is the hub: the jobs notice, the coffee shop, the African store, the barber, the bus stop.
- The CTrain station sells the monthly pass, valid on the bus and the train.
- The superstore sells the weekly shop and winter clothes. The basement room cooks meals paid in dollars.
- The warehouse by the airport, the care home, the office downtown and the library's evening course are places with doors. The church hall has the newcomers' group.
- The upkeep is the prepaid phone; food and transport are paid as they are used. The cold is in the text, not the rules.

**Dubai** (the Gulf contract; AED).

- The painted map shows Deira: the creek across the west, the metro line, the airport to the south-east, the camp to the east, the site south across the creek.
- The room abroad is a bed space in the camp. The employer houses a contract worker, so it charges no rent (`../rules/abroad-money.md`).
- The site holds the guard's post and the cleaner's trolley. The labour bus at the camp gate takes the worker there free, every day. The job comes with the contract, so the site shows On shift from the first morning.
- Deira has the typing centre, the exchange house for money home, the cafeteria, the African foods shop, the barber and the community corner by the creek. Naif has the souq, the laundry and the tailor.
- The metro station sells the zone pass, valid on the bus and the metro. The upkeep is the prepaid phone.

**Castel Volturno** (the road; EUR).

- The painted map shows the coast: the sea along the west, the Via Domitiana running the length of the map, the river, the fields inland, and Naples on an inset.
- The roundabout at the town's hub is where the vans come at dawn: the cash farm job is found there. The farm is where it is done, reached free in the gangmaster's van. The pay is cash in hand, and some months it never comes, as the rule says.
- The Domitiana has the bus stop, the Nigerian shop, the barber, the market stall and the pickup point. The call shop for money home is at the roundabout.
- The discount supermarket sells the weekly shop; the room in a shared flat cooks meals paid in euros. The church is the community's.
- There is no pass: each bus ride is paid. The upkeep is the prepaid phone.

## 3. The places

Positions are in thousandths of a degree, rough on purpose (city:positions-rough-on-purpose); made-up spots are marked. A place that names `assets` reuses that scene under its own entry (city:places-stage-their-acts: a country's own place stages its own acts). The bag by the room's door (world:japacity-bag-by-door) is where the way home and the December flight are taken. The find is a street find: something interesting seen on the street that the player may stop to look at (`offer.street-find-canada`, `-uae`, `-italy`).

### Calgary (ten stops)

| Id | Shown as | Where | Position | Scope | Stages (things) |
|---|---|---|---|---|---|
| `place.the-room` | The basement room in north-east Calgary | the home, with no country of its own; its sticker at the country's home spot | 51088, -113955 (made up) | interior | the bed, the cooking corner (`activity.cook-own-canada`), the laptop, the phone, the post, the bag |
| `place.calgary-north-east` | The strip mall, north-east Calgary | the hub, at a made-up spot in the north-east so the map reads right | 51090, -113960 (made up) | exterior | the jobs notice (`activity.job-hunt`), the coffee shop (`activity.coffee-canada`), the African store (`activity.naija-shop-canada`) with its transfer counter (`activity.send-money`), the barber (`activity.barber-canada`), the bus stop, the bench, the find |
| `place.ctrain-station-canada` | The CTrain station | its own scene | 51073, -113977 (made up, on the north-east line) | exterior | the ticket machine (`activity.transit-pass-canada`), the platform (the train's stop) |
| `place.big-shop-canada` | The superstore | on the scene `big-shop-uk` | 51095, -113980 (made up) | interior | the trolley (`activity.weekly-shop-canada`), winter clothes (`activity.buy-clothes-canada`) |
| `place.warehouse-canada` | The warehouse by the airport | on the scene `warehouse-uk` | 51110, -113990 (made up) | interior | the clock-in (`activity.job-canada-warehouse`), the rota board (`activity.overtime`), the shelter |
| `place.care-home-canada` | The care home | on the scene `care-home-uk` | 51080, -113995 (made up) | interior | the door (`activity.job-canada-care-aide`), the rota board (`activity.overtime`), the tea point |
| `place.office-canada` | The office downtown | on the scene `office-uk` | 51046, -114063 | interior | the desk (`activity.job-canada-professional`), the glass office (`activity.job-canada-developer`), the kitchen |
| `place.library-canada` | The library | its own scene | 51092, -113972 (made up) | interior | the course desk (`activity.learn-tech-canada`), the shelves, the notice |
| `place.church-canada` | The church hall | on the scene `church-uk` | 51085, -113965 (made up) | interior | the pews (`activity.community-canada`), the hall (the people a life can meet, world:nobody-picked-from-list) |
| `place.calgary-airport` | Calgary International Airport | the airport | 51122, -114014, on the map | interior | the arrival; the December flight and the way home stay on the room's bag |

### Dubai (seven stops)

| Id | Shown as | Where | Position | Scope | Stages (things) |
|---|---|---|---|---|---|
| `place.the-room` | The bed space at the camp | the home, with no country of its own; its sticker at the country's home spot | 25270, 55395 (made up, east of the city) | interior | the bed, the cooking corner (`activity.cook-own-uae`), the phone, the post, the bag; the labour bus at the gate is the ride to the site |
| `place.deira` | Deira | the hub | 25273, 55305 | exterior | the typing centre (`activity.job-hunt`), the exchange house (`activity.send-money`), the cafeteria (`activity.cafeteria-uae`), the African foods shop (`activity.naija-shop-uae`), the barber (`activity.barber-uae`), the corner by the creek (`activity.community-uae`), the find (`offer.street-find-uae`) |
| `place.naif` | Naif | its own scene | 25272, 55310 | exterior | the souq (`activity.street-shopping-uae`), the laundry (`activity.laundry-uae`), the tailor (`activity.buy-clothes-uae`) |
| `place.metro-station-uae` | Union station | its own scene | 25266, 55312 | exterior | the Nol machine (`activity.transit-pass-uae`), the platform (the metro's stop) |
| `place.big-shop-uae` | The hypermarket | on the scene `big-shop-uk` | 25265, 55320 (made up, Al Rigga) | interior | the trolley (`activity.weekly-shop-uae`) |
| `place.site-uae` | The site | its own scene; `shuttle: true` | 25186, 55263 (made up, the towers across the creek) | exterior | the guard's post (`activity.job-gulf-guard`), the cleaner's trolley (`activity.job-gulf-cleaner`), the rota board (`activity.overtime`), the labour bus at the gate, the water cooler (a colleague's line) |
| `place.dubai-airport` | Dubai International Airport | the airport | 25252, 55367, on the map | interior | the arrival; the December flight and the way home stay on the room's bag |

The UAE has no test centre, because the Gulf route takes no test there. Canada has no registry, because the driving test is the UK's alone (car:licence-and-driving-test).

### Castel Volturno (seven stops)

| Id | Shown as | Where | Position | Scope | Stages (things) |
|---|---|---|---|---|---|
| `place.the-room` | The room in a shared flat on the Domitiana | the home, with no country of its own; its sticker at the country's home spot | 40950, 14010 (made up) | interior | the bed, the cooking corner (`activity.cook-own-italy`), the phone, the post, the bag |
| `place.castel-volturno` | Castel Volturno (its real name; the roundabout is its landmark) | the hub | 41034, 13941 | exterior | the roundabout (`activity.job-hunt`: the vans at dawn), the bar (`activity.coffee-italy`), the African shop (`activity.naija-shop-italy`), the call shop (`activity.send-money`), the bus stop, the find |
| `place.via-domitiana` | Via Domitiana (its real name) | its own scene | 40929, 14025 | exterior | the bus stop, the pickup point (`activity.overtime`: the second shift), the Nigerian shop (`activity.street-shopping-italy`), the barber (`activity.barber-italy`), the market stall (`activity.buy-clothes-italy`) |
| `place.farm-italy` | The fields | its own scene; `shuttle: true` | 41010, 13990 (made up, inland) | exterior | the gangmaster's table (`activity.job-italy-farm-cash`), the crates, the van, the water tap (a colleague's line) |
| `place.big-shop-italy` | The discount supermarket | on the scene `big-shop-uk` | 41030, 13950 (made up) | interior | the trolley (`activity.weekly-shop-italy`) |
| `place.church-italy` | The church | on the scene `church-uk` | 41028, 13945 (made up) | interior | the pews (`activity.community-italy`), the hall (world:nobody-picked-from-list) |
| `place.naples-airport` | Naples Airport | the airport | 40884, 14285, on an inset | interior | the assisted return; the way home stays on the room's bag |

## 4. Ways and fares

Fares are in the country's smallest unit, rounded up to its step; 2025 figures, rounded.

- **The pass** covers the ways the country lists in `passWays`. It is bought once a month at the station's machine, with the reason `fare` (place:country-pass-covers-ways).
- **Employer transport.** A place marked `shuttle` is served by the employer's own transport: the `bus` way to it costs nothing, and the fare pill says so (place:employer-shuttle-rides-free). These are the labour bus to the site in Dubai and the gangmaster's van to the fields in Castel Volturno.
- **`lonMetresPerE3`** is how many metres a thousandth of a degree of longitude spans at the city's latitude. It sets walking distances on the map.

### Calgary

| Way | Flag-down | Per kilometre | Pace | Notes |
|---|---|---|---|---|
| Bus | C$3.80 | nothing | 300 m a minute | One flat fare |
| CTrain (`train`) | C$3.80 | nothing | 700 m a minute | The same fare; one ticket covers both |
| Taxi | C$3.80 | C$2.00 | 600 m a minute | For the airport and the cold |
| Walk | nothing | nothing | 80 m a minute | Within `walkMetres`; to or from home at any distance when no fare can be paid |
| The transit pass | C$118 a month | | | `activity.transit-pass-canada`, at the station's machine; covers bus and train |

Step 5 cents. `lonMetresPerE3` 71.

### Dubai

| Way | Flag-down | Per kilometre | Pace | Notes |
|---|---|---|---|---|
| Bus | AED 4 | 50 fils | 250 m a minute | The zone fare, modelled as distance |
| Metro (`train`) | AED 4 | 50 fils | 700 m a minute | The same fare |
| Taxi | AED 12 | AED 2 | 600 m a minute | |
| Walk | nothing | nothing | 60 m a minute | The heat makes it slower than anywhere else |
| The zone pass | AED 140 a month | | | `activity.transit-pass-uae`, at the Nol machine; covers bus and metro |
| The labour bus | nothing | | | `place.site-uae` is `shuttle`: the bus way to it costs nothing, "AED 0, site bus" |

Step 25 fils. `lonMetresPerE3` 100.

### Castel Volturno

| Way | Flag-down | Per kilometre | Pace | Notes |
|---|---|---|---|---|
| Bus | €1.60 | nothing | 200 m a minute | The coast road's bus, slow and infrequent |
| Walk | nothing | nothing | 80 m a minute | |
| The van | nothing | | | `place.farm-italy` is `shuttle`: the bus way to it costs nothing, "€0, the van" |

No train, no taxi, no pass. Step 5 cents. `lonMetresPerE3` 84. Naples airport, on an inset, is reached by bus at the flat fare; the December flight and the return are taken at the bag.

## 5. The costs of a month

Each item is a priced act done on the spot (a now-act) in the country's money. Each spends its time (turn:month-lived-in-half-days), repeats unless stated otherwise, and moves the body as quality:body-belly-and-energy says. The content is in `packages/content/src/activity/activity.calgary.data.ts`, `activity.dubai.data.ts` and `activity.castel.data.ts` (streets:calgary-life-by-hand, streets:dubai-life-by-hand, streets:castel-volturno-by-hand). Each country's only upkeep is the prepaid phone (abroad-money:arrival-opens-upkeep-and-room); rent is as `../rules/abroad-money.md` sets it.

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

**Worked example.** A warehouse job pays C$38,000 a year, about C$2,700 a month after the flat tax band. After the room, the pass, four weekly shops, ten meals, the phone and a haircut, about C$1,200 is left. Calgary pays well; the cold and needing a car are the price.

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

**Worked example.** The contract's salary (`CONTRACT_SALARY`, the agent's term), less four weekly shops, the phone, a few evenings in Deira and the pass for them, leaves most of it to send home. The Gulf is for sending money home, and offers little else.

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

**Worked example.** The farm pays €9,600 a year in cash, €800 a month, with a quarter of months paid nothing. After the room, four weekly shops, ten meals, the bus and the phone, about €240 is left, and a withheld month leaves a hole. Life at the end of the road is work at dawn, a shared flat and barely enough money.

## 6. The painted maps and the vehicles

Each city's map is its own descriptor, in the shape `apps/client/src/features/map/paper/city.ts` defines, as London's is:

| City | File | What the map shows | Cards |
|---|---|---|---|
| Calgary | `calgary.tsx` | The grid, the CTrain line from the north-east to downtown, the airport to the north, the Bow river to the south; the home sticker at the country's home spot | The north-east, the airport, downtown |
| Dubai | `dubai.tsx` | The creek, the metro line, the airport to the south-east, the camp to the east, the site to the south | Deira, the airport, the camp, the site |
| Castel Volturno | `castel.tsx` | The sea to the west, the Domitiana the length of the map, the river, the fields; Naples airport on an inset | The town, the Domitiana, the fields |

Each is its own chunk, loaded only when the map shows that country (world:painted-maps-abroad). The list of stops stays available for screen readers.

The ride plays inside the country's vehicle (world:ride-abroad-and-workplace): Calgary's bus and the CTrain car; Dubai's metro car, the labour bus and the taxi; Castel Volturno's blue bus and the white van. Each ride has its own boarding lines and road lines (six and three), written in the voice of `../rules/text.md`, and the fare pill in the country's money.

## 7. Recorded test lives

The recorded lives that go abroad (graduate-abroad, banker-abroad and developer-abroad) all fly to the UK, so none of their recordings depends on these countries or their upkeep figures. `packages/sim/src/simulated-play/lives.countries.data.ts` records a points life to Calgary (`developer-canada`) and a contract life to Dubai (`banker-gulf`). No recorded life takes the road to Castel Volturno.

## 8. Alternatives considered

- **One model per place in every country.** Building each country's care home, warehouse, office, big shop and church anew. Rejected: it costs models and download size for rooms that look alike the world over. Reusing London's scenes under each country's own entries leaves only what is particular to the country to build.
- **One workplace abroad shared by every country.** A single workplace with no country for all jobs abroad. Rejected: every country's job would have the same door. Each country's workplaces stage its own jobs.
