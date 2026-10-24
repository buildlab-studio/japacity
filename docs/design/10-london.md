# London

**Context and scope.** The UK as the player lives it: London's places, its ways and fares, the money of a month lived by hand, and its painted map (`apps/client/src/features/map/paper/london.tsx`). Abroad is lived the way Lagos is: it rests on `07-the-world-first.md` (the world is the game), `08-the-lived-month.md` (living by hand) and `09-the-lively-layer.md` (the look). Calgary, Dubai and Castel Volturno are drawn the same way (`11-calgary-dubai-and-castel-volturno.md`). The rules are world:painted-maps-abroad, world:ride-abroad-and-workplace, streets:london-life-by-hand and place:country-pass-covers-ways.

**Goals.**

- Give players the glimpse of the life abroad they look toward: hard, not hopeless.
- Every pound spent abroad is spent where it would be: at the stop, the till, the cooking corner.
- A job abroad has a door to go to.

**Non-goals.** Any change to the rules of money, visas, jobs and the family; London as a whole city (the paper shows south-east London and an inset for Heathrow); the city's real business names on its shops and workplaces (city:invented-names-for-risky-businesses).

## 1. The decision in one line

Abroad is lived the way Lagos is lived: in places with things, on rides paid at the stop, with food bought and cooked, in a workplace you go to. The rules of money, visas, jobs and the family are the same as everywhere; the world around them is drawn.

## 2. Why

Lagos is lived by hand (`07-the-world-first.md` and `08-the-lived-month.md`): a meal costs when it is eaten, a ride costs when it is taken, a job has a door. London is lived the same way, so the glimpse of abroad is a place to be in, not a sum.

## 3. What a player sees in London

1. **A city on paper.** The map abroad is a painted map as Lagos's is: south-east London on the paper, the river across its top, the railway through Peckham, the roads, the district names, every built place as its own sticker, and Heathrow in a corner inset with the plane, as it is too far west for the paper. The strip, the cards and the open map work as at home. The country menu lists every country.
2. **Rides paid at the stop.** Picking a stop opens the ride sheet with the ways of the country: the bus at one flat fare whatever the distance, the train by distance, and on foot within walking distance. A ride plays as the danfo's does, inside a red bus or a train carriage, with the fare pill and the family's pings as the send-off's ride has them. A bus pass is a thing bought once a month at the station's machine: with it the bus asks no fare for the rest of the month, and the fare pill says so ("£0, bus pass"); the train stays per trip.
3. **Food bought and cooked.** The big shop on the high street sells the weekly shop in pounds, which fills the belly as a pot does at home, and the room's cooking corner cooks a meal in pounds. Rye Lane has the chicken shop, the Nigerian shop (a taste of home, dearer), the barber, the clothes shop, the market stalls and the pub. The upkeep, the one fixed charge a month besides the rent, is the phone's pay as you go in the UK; food and transport are lived.
4. **A workplace with a door.** The care home, the ward, the office, the warehouse, the big shop's shop floor and the chicken shop's kitchen are drawn, each with its things: the door or the desk where the job is got and held (the hunt's card with that job named, and the words "On shift" once the job is held), the rota board for overtime, the manager's door for the next rung, and a colleague at the tea point with a line. A job takes its days by itself as the lived month plays; the place is where you go to get it, to be seen, and to be told things.
5. **The church** on the Old Kent Road is the Nigerian community's place: `activity.community-uk`, and the people a life can meet (world:nobody-picked-from-list).
6. **The test centre** of the UK is a London place with a position, so the nurse's tests and the driving test have somewhere to be on the paper. **Heathrow** is the arrival and the December flight's place.
7. **The rest is as for every life abroad.** Visas, the ladders, the credit file, rent, remittance, December, the return: as `../site/plays/abroad.md` says.

## 4. The places of London

Twelve stops. Positions in thousandths of a degree as city:positions-rough-on-purpose keeps them; made-up spots marked. The room's bag is the bag by its door (world:japacity-bag-by-door), where the way home and December's flight are taken. The find is a street find, something interesting seen on the street that the player may stop and look at (`offer.street-find-uk`, streets:street-finds-abroad).

| Id | Shown as | Where | Position | Scope | Stages (things) |
|---|---|---|---|---|---|
| `place.the-room` | The shared room, Peckham | the home, country-less; its sticker at a made-up spot off Choumert Road | 51471, -73 (the map's home spot) | interior (exists) | the bed, the cooking corner (`activity.cook-own-uk`), the laptop, the phone, the post, the bag |
| `place.peckham` | Peckham | the hub | 51473, -70 | exterior | the jobs notice (`activity.job-hunt`), the agency stand, the bus stop, the bench, the find |
| `place.rye-lane` | Rye Lane | Peckham | 51468, -69 | exterior | the chicken shop (`activity.chicken-shop`; the kitchen at the back `activity.job-uk-kitchen-cash`), the Nigerian shop (`activity.naija-shop-uk`), the barber (`activity.barber-uk`), the clothes shop (`activity.buy-clothes-uk`), the stalls (`activity.street-shopping-uk`), the pub (`activity.pub-pint`), the transfer shop (`activity.send-money`) |
| `place.peckham-rye-station` | Peckham Rye station | Peckham | 51470, -69 | exterior | the ticket machine (`activity.bus-pass-uk`), the platform (the train's stop), the courier's bike (`activity.job-uk-courier-cash`) |
| `place.big-shop-uk` | The big shop (a made-up name, city:invented-names-for-risky-businesses) | Peckham High Street | 51474, -68 | interior | the trolley (`activity.weekly-shop-uk`), the tills (`activity.job-uk-retail-part`), the notice (overtime) |
| `place.care-home-uk` | The care home (made-up name) | Nunhead | 51467, -54 (made-up spot) | interior | the door (`activity.job-uk-care`), the rota board (`activity.overtime`), the manager's door (`activity.job-uk-senior-care`), the tea point (a colleague's line) |
| `place.ward-uk` | The ward on Denmark Hill (made-up name) | Camberwell | 51468, -94 | interior | the nurses' station (`activity.job-uk-nurse`), the rota board (`activity.overtime`), the tea point |
| `place.office-uk` | The office at London Bridge (made-up name) | London Bridge | 51505, -86 | interior | the desk (`activity.job-uk-skilled`, `activity.job-uk-graduate`), the glass office (`activity.job-uk-senior-developer`), the kitchen (a colleague's line) |
| `place.warehouse-uk` | The warehouse on the Old Kent Road (made-up name) | Old Kent Road | 51487, -62 | interior | the clock-in (`activity.job-uk-warehouse`), the rota board (`activity.overtime`), the smoking shelter (a colleague's line) |
| `place.church-uk` | The church on the Old Kent Road (made-up name) | Old Kent Road | 51486, -66 | interior | the pews (`activity.community-uk`), the hall (the people a life can meet, world:nobody-picked-from-list) |
| `place.test-centre-uk` | The test centre | Elephant and Castle, on the scene `english-test-centre` | 51494, -100 (made-up spot) | interior | `activity.nmc-tests`, `activity.driving-test` (city:places-stage-their-acts: a country's own place may stage what the country-less one stages) |
| `place.heathrow` | London Heathrow Airport | the arrivals hall | 51468, -459, on the inset | interior | the arrival; December's flight and the way home stay on the room's bag |

## 5. The ways and the fares

| Way | Flag-down | A kilometre | Pace | Notes |
|---|---|---|---|---|
| Bus | £1.75 | nothing | 250 m a minute | One flat fare; free for the month once the bus pass is bought |
| Train | £2.80 | 10p | 600 m a minute | By distance; Heathrow from Peckham about £5.50 |
| Walk | nothing | nothing | 80 m a minute | Within `walkMetres` as at home; home always |
| The bus pass | £95 a month | | | `activity.bus-pass-uk` at the station's machine, once a month, reason `fare` |

Fares are rounded up to five pence. The fuel scarcity's factor is Lagos's and does not apply abroad. Figures are 2025 London fares, rounded (the hopper fare £1.75; a monthly bus and tram pass about £95; a zone 1 to 6 off-peak single about £5.60).

## 6. The money of a London month, by hand

| What | Figure | Act |
|---|---|---|
| The weekly shop | £45, fills the belly as the pot does | `activity.weekly-shop-uk`, the big shop, repeats |
| A meal in the room | £6 | `activity.cook-own-uk`, the cooking corner, repeats |
| The chicken shop | £7, belly +20, wellbeing +4 | `activity.chicken-shop`, Rye Lane, repeats |
| The Nigerian shop | £25, belly +30, wellbeing +8 | `activity.naija-shop-uk`, Rye Lane, repeats |
| A pint | £6, wellbeing +5, energy -3 | `activity.pub-pint`, Rye Lane, repeats |
| The barber | £15, wellbeing +5, standing +1, interview-prep +2 | `activity.barber-uk`, Rye Lane, once a month |
| Clothes | £40, standing +1, wellbeing +3 | `activity.buy-clothes-uk`, Rye Lane, once a month |
| The stalls | £20, wellbeing +5 | `activity.street-shopping-uk`, Rye Lane, reason `enjoyment` |
| The phone, pay as you go | £15 a month | `obligation.upkeep-uk`, the one upkeep charge |
| The room | £670 a month | `obligation.rent-room-uk` |

A survival job, the warehouse's (£23,000 a year before tax, about £1,670 a month after it), leaves something over a month of the room, the pass, four weekly shops and a few evenings: about £1,670 less £670 less £95 less £180 less £60 leaves about £665 for money home, the credit file and the flight in December. That is the glimpse: hard, not hopeless.

## 7. Alternatives considered

- **One monthly figure abroad.** Food, transport and the phone as one sum a month, a map of two stops, and a job got at a notice with no place to go to. It is cheaper to build and turns abroad into a sum and a list; the drawn places make it a life.
- **Bus fares paid once a month.** Nobody pays a month's fares in one go: a bus pass is tapped at the bus each day. The pass is a thing bought once a month at the station's machine, and the train stays per trip.
- **The big shop once a month.** Nobody shops for a month at once; the weekly shop repeats, as the pot does at home.
- **London's whole map.** Every borough at the paper's scale leaves Peckham too small to tap; south-east London on the paper with Heathrow on an inset keeps every stop a tap.
