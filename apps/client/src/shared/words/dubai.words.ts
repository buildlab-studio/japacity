// Dubai's words (world.md R-WORLD-038, R-WORLD-039; streets.md R-STREET-014; design page 15): the names of the things and
// acts of its places, the colleague's lines at the site, the talk overheard there and the ride's lines on the metro, the
// city bus, the labour bus and the taxi. First drafts in the voice of docs/rules/text.md; content's table wins over these.
// Kept in a chunk of their own and added once the life is in the UAE (late.ts), so a first visit at home carries none of
// them (engine.md R-ENGINE-020).
export const dubaiWords: Readonly<Record<string, string>> = {
  // Deira restaged (design page 15 section 3): the exchange house for money home, the African foods shop, the cafeteria.
  "city.thing.exchange-house": "Money exchange",
  "city.thing.african-foods": "African foods",
  "city.act.naija-shop": "A taste of home",
  "city.thing.cafeteria": "Cafeteria",
  "city.act.cafeteria": "Rice and curry",
  // Naif (R-STREET-014): the tailor and the laundry on the souq's arcades.
  "city.thing.tailor": "Tailor",
  "city.act.tailor": "Get measured",
  "city.thing.laundry": "Laundry",
  "city.act.laundry": "Wash and iron",
  // Union station: the Nol machine that sells the month's zone pass (place.md R-PLACE-012), the gates.
  "city.thing.nol-machine": "Nol machine",
  "city.act.transit-pass": "Zone pass",
  "city.thing.platform": "Gates",
  // The site (design page 15 section 3): the guard's post and the cleaner's trolley where the contract's job is held, the
  // rota board for overtime, the water cooler where a colleague says a line.
  "city.thing.guard-post": "Guard's post",
  "city.thing.cleaner-trolley": "Cleaner's trolley",
  // The contract's other job, looked at: the hunt never asks for a Gulf job, so the thing keeps its look (R-WORLD-005).
  "city.act.look-post": "Look",
  "city.act.look-post.done": "A plastic chair, the gate's logbook, a fan that turns all day.",
  "city.act.look-trolley": "Look",
  "city.act.look-trolley.done": "Mops, two buckets, a bottle of something blue.",
  "city.thing.rota": "Rota board",
  "city.act.overtime": "Overtime",
  "city.act.read-rota": "Read",
  "city.act.read-rota.done": "Every shift is filled this month. Your name is where it should be.",
  "city.thing.colleague": "Colleague",
  "city.thing.on-shift": "On shift",
  "city.act.on-shift": "Your shift",
  "city.act.on-shift.done": "On the rota here. Your shifts run as the month goes.",
  // The hypermarket on London's big shop (world.md R-WORLD-039): the trolley, the tills looked at.
  "city.act.weekly-shop": "The weekly shop",
  "city.thing.tills": "Tills",
  "city.act.look-tills": "Look",
  "city.act.look-tills.done": "A queue at every till. The cashiers are not hiring today.",
  "city.thing.staff-notice": "Staff notice",
  "city.act.read-staff-notice": "Read",
  "city.act.read-staff-notice.done": "Prayer times, the rota, and a lost wallet found by the door.",
  // The colleague at the water cooler (R-WORLD-039): a new line each time you talk, in turn.
  "city.line.colleague.site-uae.1": "Drink water before you feel thirsty.",
  "city.line.colleague.site-uae.2": "Supervisor shouts, but he pays on time.",
  "city.line.colleague.site-uae.3": "Two more years, then my house in Ibadan.",
  // Dubai's places (R-WORLD-039): Nigerian voices among the others, beside content's own lines.
  "city.overheard.metro-station-uae.1": "The women's cabin is at the front.",
  "city.overheard.site-uae.1": "Helmet on. The safety officer is walking around.",
  "city.overheard.big-shop-uae.1": "Rice is on offer. The ten kilo bags.",
  "city.overheard.big-shop-uae.2": "Indian, Filipino, Nigerian, all in one queue.",
  "city.overheard.big-shop-uae.3": "Card or cash, sir?",
  "city.overheard.big-shop-uae.4": "Have you seen yam anywhere in this place?",
  // Dubai's metro: the voice in the ceiling and the people in the car, as the doors close (R-WORLD-039).
  "map.ride.line.dubai-metro.1": "Doors closing. Please stand clear.",
  "map.ride.line.dubai-metro.2": "Next station, Union. Change for the green line.",
  "map.ride.line.dubai-metro.3": "Gold class is the front car. Please move back.",
  "map.ride.line.dubai-metro.4": "Sit, my sister. Nobody stands when seats are free.",
  "map.ride.line.dubai-metro.5": "No eating or drinking on the metro, please.",
  "map.ride.line.dubai-metro.6": "Hold on. The train leaves the tunnel now.",
  "map.ride.along.road.1.dubai-metro": "The track climbs out over the road, the city below.",
  "map.ride.along.road.2.dubai-metro": "Cranes stand over half-built towers in the haze.",
  "map.ride.along.road.3.dubai-metro": "Everybody is on their phone, half of them calling home.",
  // Dubai's city bus: the driver and a fellow passenger, as you board.
  "map.ride.line.dubai-bus.1": "Tap your card. It is cold inside, thank God.",
  "map.ride.line.dubai-bus.2": "The front seats are for women, please.",
  "map.ride.line.dubai-bus.3": "Move inside. Another bus comes in ten minutes.",
  "map.ride.line.dubai-bus.4": "Sit, my brother. Na long road be this.",
  "map.ride.line.dubai-bus.5": "Next stop, Union.",
  "map.ride.line.dubai-bus.6": "Hold the strap. This driver brakes hard.",
  "map.ride.along.road.1.dubai-bus": "Glass towers and sand lots slide past the window.",
  "map.ride.along.road.2.dubai-bus": "The air outside shimmers over the road.",
  "map.ride.along.road.3.dubai-bus": "A man sleeps on his bag, his helmet on his lap.",
  // The labour bus to the site, the employer's, at the camp's gate before dawn (place.md R-PLACE-013).
  "map.ride.line.labour-bus.1": "Sit down. The supervisor counts heads at the gate.",
  "map.ride.line.labour-bus.2": "Close the window. The AC is finally working.",
  "map.ride.line.labour-bus.3": "My brother, wake me when we reach site.",
  "map.ride.line.labour-bus.4": "The bus leaves at five. Late people walk.",
  "map.ride.line.labour-bus.5": "Helmet on your lap, not on the seat.",
  "map.ride.line.labour-bus.6": "Everybody here? Driver, we can go.",
  "map.ride.along.road.1.labour-bus": "The camp's fence runs past, then the empty road.",
  "map.ride.along.road.2.labour-bus": "Men sleep against the windows in their overalls.",
  "map.ride.along.road.3.labour-bus": "The sun is not up, and the air is already warm.",
  // The taxi in Dubai: the driver, as you get in.
  "map.ride.line.dubai-taxi.1": "Where are you going, sir? Deira?",
  "map.ride.line.dubai-taxi.2": "Belt, please. The police check here.",
  "map.ride.line.dubai-taxi.3": "From Nigeria? My friend from Lagos drives a taxi too.",
  "map.ride.line.dubai-taxi.4": "Card or cash? Card is fine.",
  "map.ride.line.dubai-taxi.5": "Traffic on the bridge. I take the tunnel.",
  "map.ride.line.dubai-taxi.6": "The AC is good? I make it colder.",
  "map.ride.along.road.1.dubai-taxi": "The creek flashes past between the buildings.",
  "map.ride.along.road.2.dubai-taxi": "Lanes and lanes of white cars, all moving fast.",
  "map.ride.along.road.3.dubai-taxi": "The meter climbs quietly by the driver's hand.",
};
