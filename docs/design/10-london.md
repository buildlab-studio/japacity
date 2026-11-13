# London

**Context and scope.** This page covers the UK as the player lives it: London's places, its ways and fares, the costs of a month lived by hand, and its painted map (`apps/client/src/features/map/paper/london.tsx`). Life abroad is lived the same way as life in Lagos, so this page builds on `07-the-world-first.md` (the world is the game), `08-the-lived-month.md` (living by hand) and `09-the-games-look.md` (the look). Calgary, Dubai and Castel Volturno follow the same pattern (`11-calgary-dubai-and-castel-volturno.md`). The rules are world:painted-maps-abroad, world:ride-abroad-and-workplace, streets:london-life-by-hand and place:country-pass-covers-ways.

**Goals.**

- Show players what the life abroad they aim for is like: hard, but not hopeless.
- Spend every pound abroad where it would really be spent: at the stop, the till, the cooking corner.
- Give every job abroad a place to go to.

**Non-goals.** Any change to the rules of money, visas, jobs and the family; London as a whole city (the map shows south-east London, with Heathrow on an inset); real business names on shops and workplaces (city:invented-names-for-risky-businesses).

## 1. Summary

Life abroad is lived the way life in Lagos is: in places with things to tap, on rides paid at the stop, with food bought and cooked, and in a workplace the character goes to. The rules of money, visas, jobs and the family are the same everywhere; only the world around them is drawn.

## 2. Why

Lagos is lived by hand (`07-the-world-first.md` and `08-the-lived-month.md`): a meal costs money when it is eaten, a ride when it is taken, and a job has a door. London works the same way, so the player experiences abroad as a place to be in, not as a sum.

## 3. What a player sees in London

1. **A painted map.** The map abroad is painted like Lagos's: south-east London, the river across the top, the railway through Peckham, the roads, the district names, and every built place as its own sticker. Heathrow is too far west for the map, so it sits on a corner inset with a plane. The strip, the cards and the open map work as at home. The country menu lists every country.
2. **Rides paid at the stop.** Picking a stop opens the ride sheet with the country's ways: the bus at one flat fare whatever the distance, the train by distance, and walking within walking distance. A ride plays as the danfo's does, inside a red bus or a train carriage, with the fare pill and the family's pings, as on the send-off ride. The bus pass is bought once a month at the station's machine. With it, the bus costs nothing for the rest of the month and the fare pill says so ("£0, bus pass"); the train is still paid per trip.
3. **Food bought and cooked.** The big shop on the high street sells the weekly shop in pounds, which fills the belly as a pot does at home, and the room's cooking corner cooks a meal in pounds. Rye Lane has the chicken shop, the Nigerian shop (a taste of home, dearer), the barber, the clothes shop, the market stalls and the pub. The upkeep, the only fixed monthly charge besides the rent, is the phone on pay as you go. Food and transport are paid as they are used.
4. **A workplace with a door.** The care home, the ward, the office, the warehouse, the big shop's shop floor and the chicken shop's kitchen are drawn, each with its things:
   - the door or desk where the job is found and held (the hunt's card names the job, and shows "On shift" once it is held);
   - the rota board for overtime;
   - the manager's door for the next rung;
   - a colleague at the tea point with a line.

   A job takes its days by itself as the month plays. The place is where the character goes to get the job, to be seen, and to hear things.
5. **The church** on the Old Kent Road is the Nigerian community's place: `activity.community-uk`, and the people a life can meet (world:nobody-picked-from-list).
6. **The test centre** is a London place with a position, so the nurse's tests and the driving test happen somewhere on the map. **Heathrow** is the place of arrival and of the December flight.
7. **Everything else is as for every life abroad.** Visas, the ladders, the credit file, rent, money sent home, December and the return work as `../site/plays/abroad.md` describes.

## 4. The places of London

Twelve stops. Positions are in thousandths of a degree, rough on purpose (city:positions-rough-on-purpose); made-up spots are marked. The bag by the room's door (world:japacity-bag-by-door) is where the way home and the December flight are taken. The find is a street find: something interesting seen on the street that the player may stop to look at (`offer.street-find-uk`, streets:street-finds-abroad).

| Id | Shown as | Where | Position | Scope | Stages (things) |
|---|---|---|---|---|---|
| `place.the-room` | The shared room in Peckham | the home, with no country of its own; its sticker at a made-up spot off Choumert Road | 51471, -73 (the map's home spot) | interior (exists) | the bed, the cooking corner (`activity.cook-own-uk`), the laptop, the phone, the post, the bag |
| `place.peckham` | Peckham | the hub | 51473, -70 | exterior | the jobs notice (`activity.job-hunt`), the agency stand, the bus stop, the bench, the find |
| `place.rye-lane` | Rye Lane | Peckham | 51468, -69 | exterior | the chicken shop (`activity.chicken-shop`; the kitchen at the back, `activity.job-uk-kitchen-cash`), the Nigerian shop (`activity.naija-shop-uk`), the barber (`activity.barber-uk`), the clothes shop (`activity.buy-clothes-uk`), the stalls (`activity.street-shopping-uk`), the pub (`activity.pub-pint`), the transfer shop (`activity.send-money`) |
| `place.peckham-rye-station` | Peckham Rye | Peckham | 51470, -69 | exterior | the ticket machine (`activity.bus-pass-uk`), the platform (the train's stop), the courier's bike (`activity.job-uk-courier-cash`) |
| `place.big-shop-uk` | The big shop (a made-up name, city:invented-names-for-risky-businesses) | Peckham High Street | 51474, -68 | interior | the trolley (`activity.weekly-shop-uk`), the tills (`activity.job-uk-retail-part`), the notice (overtime) |
| `place.care-home-uk` | The care home in Nunhead (its sign a made-up name) | Nunhead | 51467, -54 (made-up spot) | interior | the door (`activity.job-uk-care`), the rota board (`activity.overtime`), the manager's door (`activity.job-uk-senior-care`), the tea point (a colleague's line) |
| `place.ward-uk` | The ward on Denmark Hill (made-up name) | Camberwell | 51468, -94 | interior | the nurses' station (`activity.job-uk-nurse`), the rota board (`activity.overtime`), the tea point |
| `place.office-uk` | The office at London Bridge (made-up name) | London Bridge | 51505, -86 | interior | the desk (`activity.job-uk-skilled`, `activity.job-uk-graduate`), the glass office (`activity.job-uk-senior-developer`), the kitchen (a colleague's line) |
| `place.warehouse-uk` | The warehouse on the Old Kent Road (made-up name) | Old Kent Road | 51487, -62 | interior | the clock-in (`activity.job-uk-warehouse`), the rota board (`activity.overtime`), the smoking shelter (a colleague's line) |
| `place.church-uk` | The church on the Old Kent Road (made-up name) | Old Kent Road | 51486, -66 | interior | the pews (`activity.community-uk`), the hall (the people a life can meet, world:nobody-picked-from-list) |
| `place.test-centre-uk` | The test centre at Elephant and Castle | Elephant and Castle, on the scene `english-test-centre` | 51494, -100 (made-up spot) | interior | `activity.nmc-tests`, `activity.driving-test` (city:places-stage-their-acts: a country's own place may stage what the shared place with no country stages) |
| `place.heathrow` | London Heathrow Airport | the arrivals hall | 51468, -459, on the inset | interior | the arrival; the December flight and the way home stay on the room's bag |

## 5. Ways and fares

| Way | Flag-down | Per kilometre | Pace | Notes |
|---|---|---|---|---|
| Bus | £1.75 | nothing | 250 m a minute | One flat fare; free for the rest of the month once the bus pass is bought |
| Train | £2.80 | 10p | 600 m a minute | By distance; Heathrow from Peckham about £5.50 |
| Walk | nothing | nothing | 80 m a minute | Within `walkMetres`, as at home; to or from home at any distance when no fare can be paid |
| The bus pass | £95 a month | | | `activity.bus-pass-uk` at the station's machine, once a month, reason `fare` |

Fares are rounded up to five pence. Lagos's fuel scarcity factor does not apply abroad. The figures are 2025 London fares, rounded: the hopper fare £1.75, a monthly bus and tram pass about £95, a zone 1 to 6 off-peak single about £5.60.

## 6. The costs of a London month

| What | Figure | Act |
|---|---|---|
| The weekly shop | £45, belly +40 (as the pot at home) | `activity.weekly-shop-uk`, the big shop, repeats |
| A meal in the room | £6, belly +25 | `activity.cook-own-uk`, the cooking corner, repeats |
| The chicken shop | £7, belly +20, wellbeing +4 | `activity.chicken-shop`, Rye Lane, repeats |
| The Nigerian shop | £25, belly +30, wellbeing +8 | `activity.naija-shop-uk`, Rye Lane, repeats |
| A pint | £6, wellbeing +5, energy -3 | `activity.pub-pint`, Rye Lane, repeats |
| The barber | £15, wellbeing +5, standing +1, interview-prep +2 | `activity.barber-uk`, Rye Lane, once a month |
| Clothes | £40, standing +1, wellbeing +3 | `activity.buy-clothes-uk`, Rye Lane, once a month |
| The stalls | £20, wellbeing +5 | `activity.street-shopping-uk`, Rye Lane, reason `enjoyment` |
| The phone, pay as you go | £15 a month | `obligation.upkeep-uk`, the one upkeep charge |
| The room | £670 a month | `obligation.rent-room-uk` |

**Worked example.** A survival job in the warehouse pays £23,000 a year before tax, about £1,670 a month after it. Take off the room (£670), the bus pass (£95), four weekly shops (£180) and a few evenings out (£60), and about £665 is left for money home, the credit file and the December flight. Hard, but not hopeless.

## 7. Alternatives considered

- **One monthly figure abroad.** Food, transport and the phone as one sum a month, a map of two stops, and jobs found at a notice with no place to go to. Cheaper to build, but it turns abroad into a sum and a list; drawn places make it a life.
- **Bus fares paid once a month.** Nobody pays a month's fares at once: a pass is tapped on the bus each day. So the pass is bought once a month at the station's machine, and the train is still paid per trip.
- **The big shop once a month.** Nobody shops for a whole month at once, so the weekly shop repeats, as the pot does at home.
- **London's whole map.** Every borough at the map's scale would leave Peckham too small to tap. South-east London on the map, with Heathrow on an inset, keeps every stop tappable.
