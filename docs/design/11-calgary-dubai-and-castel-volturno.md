# Calgary, Dubai and Castel Volturno

**Context and scope.** Why the three countries besides the UK are drawn as they are:

- Canada: Calgary, reached on the points, spouse and accompanying routes;
- the UAE: Dubai, reached on the Gulf contract;
- Italy: Castel Volturno, at the end of the road, the journey overland and by sea ([`road.md`](../rules/road.md)).

Each follows the pattern set for every country abroad in [page 10](10-london.md) section 2, and its rules and figures live where London's do (page 10's opening list), with streets:calgary-life-by-hand, streets:dubai-life-by-hand, streets:castel-volturno-by-hand and place:employer-shuttle-rides-free beside them. The code is the ways, with `passWays` and `shuttle` (decision 0017), the places, the acts, the three painted maps (`apps/client/src/features/map/paper/calgary.tsx`, `dubai.tsx`, `castel.tsx`) and the rides in each country's vehicles.

**Goals.**

- Each country shows players what that life abroad is like, through the shape of its days and its money.
- Each country has what London has, cut to its size: fewer places, its own ways, its own everyday vehicle.
- Interiors a country shares with London (a care home, a warehouse, an office, a big shop, a church) reuse London's scenes under the country's own entries, so only what is particular to the country gets models of its own.

**Non-goals.** As for London, plus: a driving licence or test taken in Canada or the UAE; a train, a taxi or a pass in Castel Volturno.

## 1. Summary

Each country is lived as London is, with its own character:

- **Calgary**: the cold, the CTrain, and a strip mall with an African store.
- **Dubai**: the heat, the labour bus at dawn, the camp and the exchange house.
- **Castel Volturno**: the roundabout at dawn, the van to the fields, and the bus on the coast road.

## 2. What a player sees

**Calgary** (the points route, the spouse and the accompanying routes; Canadian dollars).

- The strip mall in the north-east is the hub: the jobs notice, the coffee shop, the African store, the barber, the bus stop.
- The CTrain station sells the monthly pass, valid on the bus and the train.
- The superstore sells the weekly shop and winter clothes. The basement room cooks meals paid in dollars.
- The warehouse by the airport, the care home, the office downtown and the library's evening course are places with doors. The church hall has the newcomers' group.
- The cold is in the words, not the rules.

**Dubai** (the Gulf contract; dirhams).

- The room abroad is a bed space in the camp. The employer houses a contract worker, so there is no rent while the contract's status holds ([`abroad-money.md`](../rules/abroad-money.md)).
- The site holds the guard's post and the cleaner's trolley. The labour bus at the camp gate takes the worker there free every day (place:employer-shuttle-rides-free). The job comes with the contract, so the site shows On shift from the first morning.
- Deira has the typing centre, the exchange house for money home, the cafeteria, the African foods shop, the barber and the community corner by the creek. Naif has the souq, the laundry and the tailor.
- The metro station sells the zone pass, valid on the bus and the metro.

**Castel Volturno** (the road; euros).

- The roundabout at the town's hub is where the vans come at dawn: the cash farm job is found there. The farm is where it is done, reached free in the gangmaster's van. The pay is cash in hand, and some months it never comes (ladders:cash-jobs-paid-in-hand).
- The Domitiana has the bus stop, the Nigerian shop, the barber, the market stall and the pickup point. The call shop for money home is at the roundabout.
- The discount supermarket sells the weekly shop, and the room in a shared flat cooks meals paid in euros. The church is the community's.
- There is no pass: each bus ride is paid.

## 3. The places

Each country's entries, positions and reasons are in [`city.md`](../rules/city.md), "Entries: abroad". A place drawn "on" another's scene reuses that scene under its own entry and stages its own acts (city:places-stage-their-acts). The room has no position of its own: its sticker stands at the country's home spot, a made-up spot (world:painted-maps-abroad).

### Calgary (ten stops)

| Place | Where | Its things |
|---|---|---|
| The basement room in north-east Calgary | the home, at a made-up spot in the north-east | the bed, the cooking corner, the laptop, the phone, the post, the bag |
| The strip mall, north-east Calgary | the hub, at a made-up spot in the north-east, where newcomers settle, so the map reads right | the jobs notice, the coffee shop, the African store with its transfer counter, the barber, the bus stop, the bench, the find |
| The CTrain station | its own scene, a made-up spot on the north-east line | the ticket machine (the pass), the platform (the train's stop) |
| The superstore | on the big shop's scene | the trolley (the weekly shop), winter clothes |
| The warehouse by the airport | on the warehouse's scene | the clock-in, the rota board, the shelter |
| The care home | on the care home's scene | the door (the care aide's job), the rota board, the tea point |
| The office downtown | on the office's scene | the desk (the professional's job), the glass office (the developer's), the kitchen |
| The library | its own scene | the course desk (the evening course), the shelves, the notice |
| The church hall | on the church's scene | the pews, the hall where people are met |
| Calgary International Airport | the airport, on the map | the arrival; the December flight and the way home stay on the room's bag |

### Dubai (seven stops)

| Place | Where | Its things |
|---|---|---|
| The bed space at the camp | the home, at a made-up spot east of the city | the bed, the cooking corner, the phone, the post, the bag; the labour bus at the gate is the ride to the site |
| Deira | the hub | the typing centre (the jobs), the exchange house (money home), the cafeteria, the African foods shop, the barber, the corner by the creek (the community), the find |
| Naif | its own scene | the souq, the laundry, the tailor |
| Union station | its own scene | the Nol machine (the pass), the platform (the metro's stop) |
| The hypermarket | on the big shop's scene, a made-up spot in Al Rigga | the trolley (the weekly shop) |
| The site | its own scene, a made-up spot among the towers across the creek, served by the employer's shuttle | the guard's post and the cleaner's trolley (the two Gulf jobs), the rota board, the labour bus at the gate, the water cooler with a colleague's line |
| Dubai International Airport | the airport, on the map | the arrival; the December flight and the way home stay on the room's bag |

The UAE has no test centre, because the Gulf route takes no test there. Canada has no registry, because the driving test is the UK's alone (car:licence-and-driving-test).

### Castel Volturno (seven stops)

| Place | Where | Its things |
|---|---|---|
| The room in a shared flat on the Domitiana | the home, at a made-up spot | the bed, the cooking corner, the phone, the post, the bag |
| Castel Volturno (its real name; the roundabout is its landmark) | the hub | the roundabout (the jobs: the vans at dawn), the bar, the African shop, the call shop (money home), the bus stop, the find |
| Via Domitiana (its real name) | its own scene | the bus stop, the pickup point (the second shift), the Nigerian shop, the barber, the market stall |
| The fields | its own scene, a made-up spot inland, served by the employer's shuttle | the gangmaster's table (the farm's cash job), the crates, the van, the water tap with a colleague's line |
| The discount supermarket | on the big shop's scene | the trolley (the weekly shop) |
| The church | on the church's scene | the pews, the hall where people are met |
| Naples Airport | the airport, on an inset | the assisted return; the way home stays on the room's bag |

## 4. Ways and fares

The game's fares, paces and passes are in the Numbers of [`place.md`](../rules/place.md), with how a pass and the employer's shuttle work (place:country-pass-covers-ways, place:employer-shuttle-rides-free) and how walking distance is measured in each country (place:rides-between-city-places). They rest on each city's 2025 fares, rounded:

- **Calgary**: one adult fare on the bus and the CTrain, and a monthly pass covering both. A taxi is there for the airport and the cold.
- **Dubai**: the Nol zone fares, read as distance, the same on the bus and the metro, and a monthly zone pass covering both. Walking is slower than anywhere else, because of the Gulf's heat.
- **Castel Volturno**: the coast road's bus, slow and infrequent, at one flat fare. No train, no taxi, no pass. Naples airport is reached by bus.

The labour bus to the site and the gangmaster's van to the fields cost nothing, as an employer's transport does.

## 5. The costs of a month

Each cost is a priced act done on the spot in the country's money, on the pattern of London's (page 10 section 6). The acts and their figures are in streets:calgary-life-by-hand, streets:dubai-life-by-hand and streets:castel-volturno-by-hand, with the Numbers of [`streets.md`](../rules/streets.md); the room and the phone are in the Numbers of [`abroad-money.md`](../rules/abroad-money.md). The content is in `packages/content/src/activity/activity.calgary.data.ts`, `activity.dubai.data.ts` and `activity.castel.data.ts`.

Each country's month says something different about the life there:

- **Calgary pays well; the cold and needing a car are the price.** A warehouse job pays about C$38,000 a year, about C$2,700 a month after tax. After the room, the pass, four weekly shops, ten meals, the phone and a haircut, about C$1,200 is left.
- **The Gulf is for sending money home, and offers little else.** The contract's salary (`CONTRACT_SALARY`, the agent's term) pays no rent while the contract holds; after four weekly shops, the phone, a few evenings in Deira and the pass for them, most of it is left to send home.
- **Life at the end of the road is work at dawn, a shared flat and barely enough money.** The farm pays about €9,600 a year in cash, €800 a month, with some months paid nothing. After the room, four weekly shops, ten meals, the bus and the phone, about €240 is left, and a withheld month leaves a hole.

## 6. The painted maps and the vehicles

Each city's map is its own descriptor, in the shape `apps/client/src/features/map/paper/city.ts` defines, loaded only when the map shows that country (world:painted-maps-abroad, which lists what each shows and its cards). Each shows only the part of the city a newcomer's life runs through, so every stop stays tappable:

| City | File | Why it shows what it shows |
|---|---|---|
| Calgary | `calgary.tsx` | The north-east, where newcomers settle, joined to the office downtown by the CTrain line, with the airport to the north and the Bow river to the south |
| Dubai | `dubai.tsx` | Deira on the creek, the camp east of the city and the site across the creek: the worker's day is the labour bus between them |
| Castel Volturno | `castel.tsx` | The coast road the length of the map, the fields inland where the vans go, and Naples airport on an inset, too far for the paper |

The ride plays inside the country's vehicle (world:ride-abroad-and-workplace): Calgary's bus and the CTrain car; Dubai's metro car, the labour bus and the taxi; Castel Volturno's blue bus and the white van. Each ride has its own boarding lines and road lines (six and three), written in the voice of [`text.md`](../rules/text.md), and the fare pill in the country's money.

## 7. Recorded test lives

The recorded lives that go abroad (graduate-abroad, banker-abroad and developer-abroad) all fly to the UK, so none of their recordings depends on these countries or their upkeep figures. `packages/sim/src/simulated-play/lives.countries.data.ts` records a points life to Calgary (`developer-canada`) and a contract life to Dubai (`banker-gulf`). No recorded life takes the road to Castel Volturno.

## 8. Alternatives considered

- **One model per place in every country.** Building each country's care home, warehouse, office, big shop and church anew. Rejected: it costs models and download size for rooms that look alike the world over. Reusing London's scenes under each country's own entries leaves only what is particular to the country to build.
- **One workplace abroad shared by every country.** A single workplace with no country for all jobs abroad. Rejected: every country's job would have the same door. Each country's workplaces stage its own jobs.
