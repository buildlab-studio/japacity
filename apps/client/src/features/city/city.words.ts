// The city's own words, first drafts in the voice of docs/rules/text.md. Content's table wins over
// these, so each key can move into content to be rewritten. Place names, blurbs, signs and
// talk overheard are content's already (city.md R-CITY-024).
import { text } from "@japacity/content";

import { hasWords, nameOf, runningName, words } from "../../shared/words/text";
import { hash } from "./crowd";
import type { Role } from "./roster";

export const cityText: Record<string, string> = {
  "city.menu": "City",
  "city.look": "Look around",
  "city.back": "Back to your month",
  "city.places": "Places",
  "city.places.title": "Where you can go",
  "city.here": "You are here",
  "city.loading": "Getting {place} ready: {percent}%",
  "city.failed": "{place} could not be shown. Your month is not affected.",
  "city.unbuilt": "Not built yet: open ground for now.",
  "city.band.quiet": "Quiet",
  "city.band.busy": "Busy",
  "city.band.packed": "Packed",
  "city.hold": "Tap the ground to walk. Hold to look from above.",
  "city.close": "Close",
  "city.you": "You",

  "city.map": "Map",
  "city.map.country": "Country",
  "city.map.home": "Home",
  "city.map.been": "Been here",
  "city.map.can": "Can go",
  "city.map.not": "Not yet",
  "city.map.line.here": "Here. {things} things to do",
  "city.map.line.things": "{things} things to do",
  "city.map.line.not": "Opens later in this life",
  "city.map.go": "Go there",
  "city.map.go-home": "Go home",
  "city.map.locked": "Locked",
  "city.map.not-now": "Not now",
  "city.map.hint": "Drag to look round. Pinch to zoom. Tap a pin.",
  "city.map.lagos": "Lagos",
  "city.map.no-visa": "No visa yet",
  "city.map.not-open": "Not in this life yet",
  "city.hud.month": "Month {month}",
  "city.phone": "Phone",
  "city.phone.back": "Back",
  "city.phone.apps": "Apps",
  // The band says what a home is, in few words (R-WORLD-002).
  "city.home.compound-room": "Your room, a compound in Ojuelegba",
  "city.home.family-house": "The family house",
  "city.home.makoko": "The room on the water",
  "city.home.the-room": "The shared room, {area}",
  "city.home.teach.close": "Got it",
  "city.zoom.closer": "Closer",
  "city.zoom.whole": "Whole place",
  "city.thing.lotto": "Lotto",
  // The trader's own stall at the market (R-ACTIVITY-016).
  "city.thing.own-stall": "Your stall",
  "city.act.open-shop": "Open the shop",
  "city.thing.bets": "Bets",
  "city.thing.danfo": "Danfo",
  "city.thing.keke": "Keke",
  "city.thing.okada": "Okada",
  "city.thing.house": "House",
  "city.thing.out": "Out",
  // The thirteen world-first places' things and acts (docs/rules/world.md R-WORLD-005), first drafts in the voice of text.md.
  "city.thing.sofa": "Sofa",
  "city.thing.mama": "Mama",
  "city.thing.papa": "Papa",
  "city.thing.tv": "TV",
  "city.thing.table": "Table",
  "city.thing.bed": "Bed",
  "city.thing.papers": "Papers box",
  "city.thing.door": "Door",
  "city.thing.veranda": "Veranda",
  "city.thing.gate": "Gate",
  "city.thing.hub": "Hub",
  "city.thing.stop": "Bus stop",
  "city.thing.motor-park": "Motor park",
  "city.thing.mum-stall": "Mama's stall",
  "city.thing.mummy": "Mama",
  "city.thing.visa-desk": "Visa desk",
  "city.thing.passport-desk": "Passport desk",
  "city.thing.chairs": "Chairs",
  "city.thing.agent-desk": "Agent",
  "city.thing.test-desk": "Test desk",
  "city.thing.nurse": "Nurse",
  "city.thing.counter": "Counter",
  // the clerk at the bank's counter takes back held funds still open.
  "city.thing.clerk": "Clerk",
  "city.thing.long-desk": "Desks",
  "city.thing.jobs-board": "Jobs board",
  "city.thing.meetup": "Meetup",
  "city.thing.window": "Window",
  "city.thing.phone": "Phone",
  "city.thing.laptop": "Laptop",
  "city.thing.post": "Post",
  "city.thing.arrivals-gate": "Arrivals",
  // the gate that boards the plane reads as the way out.
  "city.thing.departures": "Departures",
  "city.thing.flight-board": "Flights",
  "city.thing.trolley": "Trolley",
  "city.thing.cooking": "Cooking corner",
  "city.thing.drum": "Water drum",
  "city.thing.bag": "Bag",
  // The room in a compound (home.md R-HOME-010), in its own voice: a mattress on the floor, a gas stove.
  "city.thing.mattress": "Mattress",
  "city.thing.stove": "Stove",
  "city.act.sit": "Sit",
  "city.act.turn-on.done": "The TV comes on, NEPA permitting.",
  // The light bill paid at home: Mama's words over her head, then the next compound in the corner (R-WORLD-005, R-WORLD-026).
  "city.say.light-back": "God bless you. Light is back.",
  "city.heard.up-nepa": "The next compound shouts “UP NEPA”.",
  "city.told.light-paid": "Light bill paid",
  // The parcel collected at the cargo office, told in the corner (R-WORLD-005).
  "city.told.parcel": "The parcel is yours.",
  // Lying down is done at once, seen on the bed or the couch; an empty slot of the month already rests (R-TURN-006).
  "city.act.lie": "Lie down",
  "city.act.cook": "Cook for the week",
  "city.act.fetch-water": "Fetch water",
  // The compound's drum, filled from the tap in the yard: the water costs nothing there, so nothing comes off (R-OBLIGATION-014); an act the scene shows tells no line (R-TEXT-008).
  "city.act.fill-drum": "Fetch water",
  "city.act.pack": "Pack and go",
  "city.act.turn-on": "Turn on",
  // R-WORLD-019: the box opens the phone's Papers app, where every paper is told.
  "city.act.papers": "Look in the box",
  "city.act.go-in": "Go in",
  "city.act.go-out": "Go out",
  "city.act.ride": "Ride",
  "city.act.bills": "The bills",
  "city.act.family-time": "Family time",
  "city.act.family-meeting": "Family meeting",
  "city.act.roof": "The roof",
  "city.act.night-shift": "Night shift",
  "city.act.brother-fees": "School fees",
  "city.act.send-off": "The send-off",
  "city.act.pledge": "The pledge",
  // chapter.md R-CHAPTER-008: home's send-off, on the veranda the month of the grant.
  "city.act.send-off-home": "Your send-off",
  "city.act.play-lotto": "Play",
  "city.act.bet-slip": "Bet",
  "city.act.find-your-feet": "Find work",
  "city.act.fuel": "Fuel",
  "city.act.ask-around": "Ask around",
  "city.act.mum-shop": "Help Mama",
  "city.act.greet-mum": "Greet Mama",
  // A person's words over their head (`.says`), and what follows told in the corner (`.done`; R-WORLD-005).
  "city.act.greet-mum.says": "You have eaten? Sit small.",
  "city.act.greet-mum.done": "Mama presses a bag of oranges on you.",
  "city.act.apply-visa": "Apply",
  "city.act.interview": "Interview",
  "city.act.agent-offer": "His offer",
  "city.act.gulf-agent": "Dubai",
  "city.act.sit-test": "Sit the test",
  "city.act.study": "Study",
  "city.act.tb-test": "TB test",
  "city.act.medical": "Medical",
  "city.act.held-funds": "Proof of funds",
  "city.act.salary-loan": "Salary loan",
  "city.act.learn-tech": "Learn",
  "city.act.routes": "Ask about routes",
  "city.act.jobs": "Jobs",
  "city.act.agents": "The agents",
  // the agent at his desk when nothing is on; the fifth, P21: he says what he deals in and when to come back.
  "city.act.ask-desk": "Agent",
  "city.act.ask-desk.says": "Not today. Papers, proof of funds, Dubai jobs: come back next month.",
  // the visa desk once the interview is over.
  "city.act.ask-visa-desk": "Ask at the desk",
  "city.act.ask-visa-desk.says": "Nothing for you today.",
  "city.act.ask-visa-desk.who": "The officer",
  "city.act.build-portfolio": "Build",
  "city.act.junior-dev": "Junior job",
  "city.act.mid-dev": "Mid job",
  "city.act.meetup": "Join",
  "city.act.community": "Community",
  "city.act.call-home": "Call home",
  "city.act.phone-contract": "Phone plan",
  "city.act.rent": "Rent",
  "city.act.december": "December",
  "city.act.send-off-chapter": "Leaving",
  "city.act.december-home": "Come home",
  // Computer Village, Peckham and Deira rebuilt as frontages (docs/rules/world.md R-WORLD-005).
  "city.thing.repair-bench": "Repair bench",
  "city.thing.phone-stall": "Phones",
  "city.thing.accessories": "Accessories",
  "city.thing.grocer": "Grocer",
  "city.thing.barber": "Barber",
  "city.thing.bench": "Bench",
  "city.thing.gold-shop": "Gold shop",
  "city.thing.cafe": "Cafe",
  "city.thing.spice-stall": "Spices",
  "city.thing.corner": "The corner",
  "city.thing.taxi": "Taxi",
  "city.act.laptop-fault": "The laptop",
  "city.act.side-gig": "Side gig",
  "city.act.look-phones": "Look",
  "city.act.look-phones.done": "Phones in their boxes, prices on paper.",
  "city.act.look-accessories": "Look",
  "city.act.look-accessories.done": "Chargers, covers, earpieces, all priced by hand.",
  "city.act.look-grocer": "Look",
  "city.act.look-grocer.done": "Yam, plantain, egusi. Dearer than Tejuosho.",
  "city.act.look-barber": "Look",
  "city.act.look-barber.done": "Three waiting on the bench, and the football on.",
  "city.act.look-gold": "Look",
  "city.act.look-gold.done": "Bangles in every window. Nobody is in a hurry.",
  "city.act.look-spices": "Look",
  "city.act.look-spices.done": "Dried lemons, cardamom, and a pepper that smells like home.",
  // The hidden places' life (docs/rules/streets.md R-STREET-001 to 004, 008).
  "city.act.buy-phone": "Buy a phone",
  "city.act.apprentice": "Learn repairs",
  "city.act.phone-sales": "Sell phones",
  "city.thing.mats": "Mats",
  "city.thing.drum-fire": "Fire",
  "city.thing.track": "Track",
  "city.act.sleep-rough": "Sleep here",
  "city.act.bridge-night": "The night",
  "city.act.warm-hands": "Warm your hands",
  "city.act.warm-hands.done": "Someone moves up to make space.",
  "city.act.morning-run": "Run",
  "city.act.look-gate": "Look",
  "city.act.look-gate.done": "The gate is chained. Through the bars, grass grows in the stands.",
  // The Inverter Room (place.yaba-hub): desks by the day in Yaba.
  "city.thing.inverter": "Inverter",
  "city.thing.chair": "Chair",
  "city.act.look-inverter": "Look",
  "city.act.look-inverter.done": "The inverter hums by the wall, its light green.",
  "city.thing.notices": "Notices",
  "city.act.read-notices": "Read",
  "city.act.read-notices.done": "Desks by the day, light and data included. In red marker: no sleeping on the benches.",
  // A computer partner met in a place (world.md R-WORLD-020): the name is theirs once someone stands there; their one act.
  "city.thing.someone": "Someone",
  "city.act.talk-to": "Talk",
  // Their room (place.their-room, R-WORLD-020, people.md R-PEOPLE-014): time together on the chair under the window.
  "city.act.spend-time": "Spend time",
  // The streets abroad (docs/rules/streets.md R-STREET-005, 006): shopping at the grocer and the spice stall, and a find while one is open.
  "city.act.shop": "Shop",
  "city.act.street-find": "See what's on",
  // Work abroad (world.md R-WORLD-005): the jobs notice and the agency in Peckham, the typing centre and the site bus in Deira, and money home from the room.
  "city.thing.jobs-notice": "Jobs notice",
  "city.thing.agency": "Job agency",
  "city.thing.typing-centre": "Typing centre",
  "city.thing.site-bus": "Site bus",
  "city.act.job-shop": "Shop work",
  "city.act.job-kitchen": "Kitchen work",
  "city.act.job-care": "Care work",
  "city.act.job-warehouse": "Warehouse",
  "city.act.job-guard": "Guard work",
  "city.act.job-cleaner": "Cleaning work",
  // the notice once none of its jobs is open (one held, or none on these papers).
  "city.act.read-jobs-notice": "Read",
  "city.act.read-jobs-notice.done": "Shop work and kitchen work, by the till. Nothing new on it is open to you this month.",
  "city.act.look-typing": "Look",
  "city.act.look-typing.done": "Visa, ID and labour papers, typed while you wait.",
  "city.act.look-site-bus": "Look",
  "city.act.look-site-bus.done": "The bus to the site leaves before six.",
  "city.act.send-money": "Send money home",
  "city.inside.name": "Inside {place}",
  "city.inside.out": "Step outside",
  "city.ride.title": "Where to?",
  "city.ride.home": "Home",
  "city.ride.line": "{minutes} minutes by road",
  "city.ride.here": "You are here",
  "city.ride.danfo": "Take the danfo",
  "city.ride.keke": "Take the keke",
  "city.ride.okada": "Take the okada",
  "city.ride.none": "Nowhere else to go yet.",
  // Turn back on a ride (R-WORLD-017): told in the corner once the character has walked back.
  "city.ride.turned-back": "Turned back at the next stop",
  "city.world.tap": "Tap a thing to do it. Tap the ground to walk.",

  "city.graphics": "Graphics",
  "city.graphics.auto": "Let the game choose",
  "city.graphics.low": "Low: lighter on the phone",
  "city.graphics.high": "High: shadows, haze, more people",
  "city.graphics.now": "Showing: {mode}",
  "city.mode.low": "low",
  "city.mode.high": "high",

  "city.card.resident": "{name}, {role}. Lives in the city.",
  "city.card.player": "{name}. Another player.",
  "city.card.stranger": "Another player.",
  "city.card.shop": "{sign}",
  "city.role.passer-by": "passing through",
  "city.role.hawker": "hawker",
  "city.role.rider": "okada rider",
  "city.role.corper": "serving corps member",
  "city.role.trader": "trader",
  "city.role.elder": "elder of the area",

  "city.overheard.news": "“Did you hear? {head}”",
  "city.overheard.route": "“My cousin's friend went by {route}. It is not easy, they say.”",
  // The room abroad's own talk (R-WORLD-026): the landlord, the radiator, a neighbour through the wall.
  "city.overheard.room.1": "The landlord said Thursday for the boiler. Which Thursday, he did not say.",
  "city.overheard.room.2": "Bleed the radiator, my sister. Na air dey inside, no be heat.",
  "city.overheard.room.3": "Mummy, I don eat. I dey fine. Yes, I wear my jacket.",
  "city.overheard.room.4": "Landlord says no visitors after ten. Since when?",

  "city.scene.at": "At {place}",
  "city.scene.answer": "Answer in your month",
  "city.report.here": "This month, here",
  "city.offer.here": "Waiting for you here: {offer}",
  // An ask answered at its place, and what still waits elsewhere (StillWaiting.tsx).
  "city.asks.still": "Still waiting on you: {what}.",
  "city.asks.see": "See what waits",

  "city.credits": "Credits",
  "city.credits.map": "Map data",
  "city.credits.fonts": "Fonts",
  "city.credits.assets": "Models",
  "city.credits.generated": "Generated media",
  "city.credits.loading": "Reading the credits...",
};

/** First names for the people who live in the city. Common names, no one in particular. */
export const RESIDENT_NAMES: Record<"f" | "m", readonly string[]> = {
  f: ["Bisi", "Nkechi", "Aisha", "Funke", "Ngozi", "Halima", "Yetunde", "Chioma", "Kemi", "Amina", "Titi", "Ifeoma"],
  m: ["Tunde", "Emeka", "Musa", "Segun", "Chinedu", "Sani", "Kunle", "Obinna", "Femi", "Ibrahim", "Dapo", "Uche"],
};

/** How a name is said in the street, by age and sex: Iya Bisi, Baba Tunde, or the name alone. */
export const RESIDENT_TITLES: Record<"f" | "m", readonly string[]> = {
  f: ["Iya", "Mama", "Aunty", ""],
  m: ["Baba", "Oga", "Brother", ""],
};

export function roleWords(role: Role): string {
  return cityWords(`city.role.${role}`);
}

/** Words for a city key: content's first, then the interface's, then the city's own drafts. */
export function cityWords(key: string, params: Record<string, string | number> = {}): string {
  const template = text[key] ?? (hasWords(key) ? words(key) : undefined) ?? cityText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** A place's name as content gives it (R-CITY-024). */
export function placeName(id: string): string {
  return nameOf(id);
}

/** A line overheard, as words: the place's own line, or talk of a story or a route the view holds. */
export function heardWords(key: string, params: Record<string, string>): string {
  // A headline that is itself someone's words keeps them, without its own straight quotes, inside the speaker's curly ones.
  if (key === "city.overheard.news") return cityWords(key, { head: words(params.head ?? "").replace(/^"(.*)"$/, "$1").replaceAll('"', "") });
  if (key === "city.overheard.route") return cityWords(key, { route: runningName(params.route ?? "") });
  return text[key] ?? cityWords(key);
}

/** What a resident is called, from the same hash as the crowd: the same person has the same name all day. */
export function residentName(sex: "f" | "m", place: string, date: string, slot: number): string {
  const names = RESIDENT_NAMES[sex];
  const titles = RESIDENT_TITLES[sex];
  const name = names[hash(`${place}|${date}|${String(slot)}|name`) % names.length] ?? "";
  const title = titles[hash(`${place}|${date}|${String(slot)}|title`) % titles.length] ?? "";
  return title === "" ? name : `${title} ${name}`;
}
