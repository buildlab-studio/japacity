// Castel Volturno's words (world.md R-WORLD-038, R-WORLD-039; streets.md R-STREET-015; design page 15): the names of the
// things and acts of its places, the colleague's lines at the fields, the talk overheard there and the ride's lines on the
// coast road's bus and the gangmaster's van. In the voice of docs/rules/text.md; content's table wins over
// these. Kept in a chunk of their own and added once the life is in Italy (late.ts), so a first visit at home carries none
// of them (engine.md R-ENGINE-020).
export const castelWords: Readonly<Record<string, string>> = {
  // The roundabout at the town's hub (design page 15 section 3): where the vans come at dawn, the bar, the African shop,
  // the call shop for money home.
  "city.thing.roundabout": "Roundabout",
  "city.thing.bar": "Bar",
  "city.act.coffee": "A coffee",
  "city.thing.african-shop": "African shop",
  "city.act.naija-shop": "A taste of home",
  "city.thing.call-shop": "Call shop",
  // The Domitiana: the pickup point for the second shift, the Nigerian shop's evening, the clothes stall.
  "city.thing.pickup": "Pickup point",
  "city.act.overtime": "Overtime",
  "city.thing.nigerian-shop": "Nigerian shop",
  "city.thing.clothes-stall": "Clothes stall",
  // The fields: the gangmaster's table where the farm's cash job is got and held, the crates, the van, the tap.
  "city.thing.gangmaster-table": "Gangmaster's table",
  "city.act.job-farm": "Farm work",
  "city.thing.crates": "Crates",
  "city.act.look-crates": "Look",
  "city.act.look-crates.done": "Crates of tomatoes, stacked higher than your head.",
  "city.thing.van": "Van",
  "city.thing.water-tap": "Water tap",
  "city.thing.on-shift": "On shift",
  "city.act.on-shift": "Your shift",
  "city.act.on-shift.done": "On the list here. Your days run as the month goes.",
  // The discount supermarket and the church on London's scenes (world.md R-WORLD-039).
  "city.act.weekly-shop": "The weekly shop",
  "city.thing.tills": "Tills",
  "city.act.look-tills": "Look",
  "city.act.look-tills.done": "One till open, a long queue. Nobody is hiring.",
  "city.thing.staff-notice": "Staff notice",
  "city.act.read-staff-notice": "Read",
  "city.act.read-staff-notice.done": "The rota, in Italian. You read the days and the times.",
  "city.thing.pews": "Pews",
  "city.thing.hall": "Church hall",
  "city.act.look-hall": "Look",
  "city.act.look-hall.done": "Plastic chairs, a big pot of rice, and somebody's baby asleep on the table.",
  // The colleague at the water tap (R-WORLD-039): a new line each time you talk, in turn.
  "city.line.colleague.farm-it.1": "Fill fast. He pays by the crate.",
  "city.line.colleague.farm-it.2": "Last week he paid nobody. We came back.",
  "city.line.colleague.farm-it.3": "Bring gloves tomorrow. The stems cut.",
  // Castel Volturno's places (R-WORLD-039): Nigerian voices among the others, beside content's own lines.
  "city.overheard.castel-volturno.1": "One coffee, quick. The van is coming.",
  "city.overheard.via-domitiana.1": "No work today. Go home and rest.",
  "city.overheard.farm-it.1": "The tomatoes are heavy this year.",
  "city.overheard.big-shop-it.1": "Bring your own bag. They charge for one.",
  "city.overheard.big-shop-it.2": "Everything is cheaper on Thursday.",
  "city.overheard.big-shop-it.3": "Garri? No. Try the African shop.",
  "city.overheard.big-shop-it.4": "Do you have the card for discounts?",
  "city.overheard.church-it.1": "Pastor is from Benin City. He knows everybody.",
  "city.overheard.church-it.2": "After service, we share food in the hall.",
  "city.overheard.church-it.3": "Pray for your papers, my sister.",
  "city.overheard.church-it.4": "Choir practice is on Thursday night.",
  // The coast road's bus: the driver and a fellow passenger, as you board (R-WORLD-039).
  "map.ride.line.italy-bus.1": "Ticket? Stamp it in the machine.",
  "map.ride.line.italy-bus.2": "Buongiorno. Sit anywhere, the bus is empty.",
  "map.ride.line.italy-bus.3": "Stamp the ticket. Controllers come sometimes.",
  "map.ride.line.italy-bus.4": "My brother, this one dey go Mondragone?",
  "map.ride.line.italy-bus.5": "Hold on. The road is full of holes.",
  "map.ride.line.italy-bus.6": "Next stop, the roundabout.",
  "map.ride.along.road.1.italy-bus": "Pines and shuttered villas run along the coast road.",
  "map.ride.along.road.2.italy-bus": "The sea shows grey between the buildings, then hides.",
  "map.ride.along.road.3.italy-bus": "Men wait at every lay-by, watching for vans.",
  // The gangmaster's van to the fields, at the roundabout before sunrise (place.md R-PLACE-013).
  "map.ride.line.van.1": "Get in. Quick quick, no talking.",
  "map.ride.line.van.2": "Sit on the bench. Hold the side.",
  "map.ride.line.van.3": "Ten of us today. He said eight.",
  "map.ride.line.van.4": "My brother, shift small. Make I sit.",
  "map.ride.line.van.5": "Close the door well. It opens by itself.",
  "map.ride.line.van.6": "Bring your own water. The tap is far.",
  "map.ride.along.road.1.van": "The van bumps off the road onto a dirt track.",
  "map.ride.along.road.2.van": "Through the small window, fields and more fields.",
  "map.ride.along.road.3.van": "Nobody talks. Somebody prays under his breath.",
};
