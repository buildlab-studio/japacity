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
  "city.map.line.here": "You are here. {things} things to do.",
  "city.map.line.things": "{things} things to do here.",
  "city.map.line.not": "Not yet. Opens when a route takes you through here.",
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
  "city.month": "Month",
  "city.month.title": "This month",
  "city.month.hint": "Plan by tapping things in the world.",
  "city.month.none": "Nothing planned. You rest.",
  "city.zoom.closer": "Closer",
  "city.zoom.whole": "Whole place",
  "city.thing.lotto": "Lotto",
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
  "city.thing.mum-stall": "Mummy's stall",
  "city.thing.visa-desk": "Visa desk",
  "city.thing.chairs": "Chairs",
  "city.thing.agent-desk": "Agent",
  "city.thing.test-desk": "Test desk",
  "city.thing.nurse": "Nurse",
  "city.thing.counter": "Counter",
  "city.thing.long-desk": "Desks",
  "city.thing.jobs-board": "Jobs board",
  "city.thing.meetup": "Meetup",
  "city.thing.window": "Window",
  "city.thing.phone": "Phone",
  "city.thing.laptop": "Laptop",
  "city.thing.post": "Post",
  "city.thing.arrivals-gate": "Arrivals",
  "city.thing.flight-board": "Flights",
  "city.thing.trolley": "Trolley",
  "city.act.sit": "Sit",
  "city.act.sit.done": "You sit for a while.",
  "city.act.turn-on.done": "The TV comes on, NEPA permitting.",
  // R-WORLD-019: what the box holds, as the Papers screen in Japa says it. `.done` alone is true in every state; the City fills the others through `papersLook`.
  "city.act.papers.done": "The box under the bed, where the papers live. Japa on your phone says what is in it.",
  "city.act.papers.empty": "The box is empty for now.",
  "city.act.papers.some": "In the box: {papers}.",
  "city.act.papers.all": "{papers}. All in the box.",
  "city.act.papers.and": "{first} and {last}",
  "city.act.rest": "Rest here",
  "city.act.rest.done": "You lie down. A month's rest, counted when the month ends.",
  "city.act.turn-on": "Turn on",
  "city.act.papers": "Look in the box",
  "city.act.papers-start": "Start a paper",
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
  "city.act.pledge-small": "A small pledge",
  "city.act.play-lotto": "Play",
  "city.act.bet-slip": "Bet",
  "city.act.find-your-feet": "Find work",
  "city.act.fuel": "Fuel",
  "city.act.ask-around": "Ask around",
  "city.act.mum-shop": "Help Mummy",
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
  "city.act.look-phones.done": "Phones in their boxes, prices on paper. Everything is fairly used.",
  "city.act.look-accessories": "Look",
  "city.act.look-accessories.done": "Chargers, covers, earpieces. You price one and walk on.",
  "city.act.look-grocer": "Look",
  "city.act.look-grocer.done": "Yam, plantain, egusi. Dearer than Tejuosho, but it is here.",
  "city.act.look-barber": "Look",
  "city.act.look-barber.done": "Three ahead of you on the bench, and the football on.",
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
  "city.act.sleep-rough.done": "You lay your mat down under the bridge. It counts when the month ends.",
  "city.act.bridge-night": "The night",
  "city.act.warm-hands": "Warm your hands",
  "city.act.warm-hands.done": "Someone moves up to make space. Nobody asks your name.",
  "city.act.morning-run": "Run",
  "city.act.morning-run.done": "Four laps before the sun is hot. It counts when the month ends.",
  "city.act.look-gate": "Look",
  "city.act.look-gate.done": "The gate is chained. Through the bars, grass grows in the stands.",
  // The Inverter Room (place.yaba-hub): desks by the day in Yaba.
  "city.thing.inverter": "Inverter",
  "city.thing.chair": "Chair",
  "city.act.look-inverter": "Look",
  "city.act.look-inverter.done": "The inverter hums by the wall, its light green. When NEPA takes light, it is the reason the room stays full.",
  "city.thing.notices": "Notices",
  "city.act.read-notices": "Read",
  "city.act.read-notices.done": "Desks by the day, light and data included. Under it, in red marker: no sleeping on the benches.",
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
  "city.act.look-typing": "Look",
  "city.act.look-typing.done": "Visa, ID and labour papers typed while you wait. Every contract here passes a desk like this.",
  "city.act.look-site-bus": "Look",
  "city.act.look-site-bus.done": "The bus to the site leaves before six. Twelve hours, then back to the camp.",
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

/** Names in a running list: "the passport", "the passport and the transcript", "a, b and c". */
function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return cityWords("city.act.papers.and", { first: names.slice(0, -1).join(", "), last: names.at(-1) ?? "" });
}

/**
 * R-WORLD-019: Look in the box says what is in it, as Japa's Papers screen does: empty when no
 * paper is held, every paper by name when all are, else the ones held. The City shows this as
 * the act's line, from the view's documents.
 */
export function papersLook(documents: readonly { id: string; state: string }[]): string {
  const held = documents.filter((paper) => paper.state === "held").map((paper) => paper.id);
  if (held.length === 0) return cityWords("city.act.papers.empty");
  if (held.length === documents.length) {
    // The list opens the sentence, so only its first name keeps a capital.
    const all = listOf(held.map((id, index) => (index === 0 ? nameOf(id) : runningName(id))));
    return cityWords("city.act.papers.all", { papers: all });
  }
  return cityWords("city.act.papers.some", { papers: listOf(held.map((id) => runningName(id))) });
}

/** A place's name as content gives it (R-CITY-024). */
export function placeName(id: string): string {
  return nameOf(id);
}

/** A line overheard, as words: the place's own line, or talk of a story or a route the view holds. */
export function heardWords(key: string, params: Record<string, string>): string {
  if (key === "city.overheard.news") return cityWords(key, { head: words(params.head ?? "") });
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
