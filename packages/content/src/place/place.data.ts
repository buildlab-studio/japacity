// The places of the city: docs/rules/city.md "Entries". Positions were looked up
// by hand in OpenStreetMap's search service (Nominatim) on 8 Oct 2026; the made-up
// business names on signs were checked under R-CITY-007 (place.names.json).
import type { Id, PlaceEntry } from "@japacity/sim";

const CHECKED = "2026-10-08";
const OSM: NonNullable<PlaceEntry["data"]> = { source: "osm", licence: "ODbL-1.0", checked: CHECKED };

/** The slug that stands for wherever the character lives, for an entry the page gives no area. */
const OWN_AREA = "own-area";

// The traditional share by kind of place: city.md "Numbers" (working values).
const MARKET = 6000;
const ROADSIDE = 6000;
const STREET = 5000;
const OFFICE = 2000;
const HUB = 2000;
const CAMPUS = 2000;
const AIRPORT = 2500;

// Each place's own cap on its sample (R-CITY-014), within tuning.city's 8 and 16. Working values.
const PACKED = { low: 8, high: 16, target: 12 };
const BUSY = { low: 6, high: 12, target: 12 };
const QUIET = { low: 3, high: 6, target: 8 };
const FEW = { low: 2, high: 4, target: 8 };
// The homes' own people: the family at home (Mama, Papa and two of the children), a neighbour or two in the compound's
// yard, two in the hostel's corridor and nook.
const FAMILY = { low: 4, high: 4, target: 4 };
const NEIGHBOURS = { low: 1, high: 2, target: 2 };
const CORRIDOR = { low: 2, high: 2, target: 2 };

type Staged = PlaceEntry["stages"];

interface Shape {
  scope?: PlaceEntry["scope"];
  /** The folder under public/assets/places/ when it is not the slug: a world-first place's own scene (docs/rules/world.md R-WORLD-011). */
  assets?: string;
  hub?: boolean;
  occasion?: boolean;
  stages?: Staged;
  crowd: PlaceEntry["crowd"];
  traditionalBp: number;
  /** A made-up spot for a place with no address of its own, in thousandths of a degree (R-CITY-008): the map and the fares read it. */
  spot?: [number, number];
  /** R-PLACE-013: the employer's shuttle serves it, so the bus to or from it asks no fare. */
  shuttle?: boolean;
}

/** The day the made-up spots were placed by hand against the public places around them. */
const OWN_SPOTS_PLACED = "2026-10-12";

function slugOf(id: Id<"place">): string {
  return id.slice("place.".length);
}

/** A public place in Lagos, with its real name and its position. */
function lagos(id: Id<"place">, realName: string, area: string, latE3: number, lonE3: number, shape: Shape, data: PlaceEntry["data"] = OSM): PlaceEntry {
  return {
    id,
    where: "home",
    country: null,
    city: "lagos",
    area,
    nameKind: "public",
    realName,
    position: { latE3, lonE3 },
    data,
    sponsor: null,
    scope: shape.scope ?? "exterior",
    hub: shape.hub ?? false,
    occasion: shape.occasion ?? false,
    stages: shape.stages ?? [],
    crowd: shape.crowd,
    traditionalBp: shape.traditionalBp,
    assets: shape.assets ?? slugOf(id),
    shuttle: shape.shuttle ?? false,
  };
}

/** A public place abroad. */
function abroad(id: Id<"place">, country: Id<"country">, city: string, area: string, realName: string, latE3: number, lonE3: number, shape: Shape): PlaceEntry {
  return {
    id,
    where: "abroad",
    country,
    city,
    area,
    nameKind: "public",
    realName,
    position: { latE3, lonE3 },
    data: OSM,
    sponsor: null,
    scope: shape.scope ?? "exterior",
    hub: shape.hub ?? false,
    occasion: shape.occasion ?? false,
    stages: shape.stages ?? [],
    crowd: shape.crowd,
    traditionalBp: shape.traditionalBp,
    assets: shape.assets ?? slugOf(id),
    shuttle: shape.shuttle ?? false,
  };
}

/** A place with no real name: an institution, a business by made-up name, a home or the road. */
function unnamed(
  id: Id<"place">,
  nameKind: Exclude<PlaceEntry["nameKind"], "public">,
  where: PlaceEntry["where"],
  city: string | null,
  area: string | null,
  shape: Shape,
): PlaceEntry {
  return {
    id,
    where,
    country: null,
    city,
    area,
    nameKind,
    realName: null,
    position: shape.spot === undefined ? null : { latE3: shape.spot[0], lonE3: shape.spot[1] },
    data: shape.spot === undefined ? null : { source: "own", licence: null, checked: OWN_SPOTS_PLACED },
    sponsor: null,
    scope: shape.scope ?? "interior",
    hub: shape.hub ?? false,
    occasion: shape.occasion ?? false,
    stages: shape.stages ?? [],
    crowd: shape.crowd,
    traditionalBp: shape.traditionalBp,
    assets: shape.assets ?? slugOf(id),
    shuttle: shape.shuttle ?? false,
  };
}

/**
 * The day the made-up spots abroad were placed by hand against the public places around them: London's (design page 14
 * section 4), and Calgary's, Dubai's and Castel Volturno's (design page 15 section 3) the same day.
 */
const ABROAD_SPOTS_PLACED = "2026-10-16";

/**
 * A place of London with no real name of its own (city.md "Entries: abroad"): a business by made-up name
 * or an institution by plain description, at a made-up spot in its area, its own source with no licence (R-CITY-008).
 */
function london(id: Id<"place">, nameKind: "business" | "institution", area: string, latE3: number, lonE3: number, shape: Shape): PlaceEntry {
  return madeUp(id, "country.uk", "london", nameKind, area, latE3, lonE3, shape);
}

/** A place of Calgary with no real name of its own, at a made-up spot (design page 15 section 3). */
function calgary(id: Id<"place">, nameKind: "business" | "institution", area: string, latE3: number, lonE3: number, shape: Shape): PlaceEntry {
  return madeUp(id, "country.canada", "calgary", nameKind, area, latE3, lonE3, shape);
}

/** A place of Dubai with no real name of its own, at a made-up spot (design page 15 section 3). */
function dubai(id: Id<"place">, nameKind: "business" | "institution", area: string, latE3: number, lonE3: number, shape: Shape): PlaceEntry {
  return madeUp(id, "country.uae", "dubai", nameKind, area, latE3, lonE3, shape);
}

/** A place of Castel Volturno with no real name of its own, at a made-up spot (design page 15 section 3). */
function castel(id: Id<"place">, nameKind: "business" | "institution", area: string, latE3: number, lonE3: number, shape: Shape): PlaceEntry {
  return madeUp(id, "country.italy", "castel-volturno", nameKind, area, latE3, lonE3, shape);
}

/**
 * A place abroad with no real name of its own (city.md "Entries: abroad", design pages 14 and 15): a business by
 * description or made-up name or an institution by plain description, at a made-up spot in its area, its own source
 * with no licence (R-CITY-008).
 */
function madeUp(id: Id<"place">, country: Id<"country">, city: string, nameKind: "business" | "institution", area: string, latE3: number, lonE3: number, shape: Shape): PlaceEntry {
  return {
    id,
    where: "abroad",
    country,
    city,
    area,
    nameKind,
    realName: null,
    position: { latE3, lonE3 },
    data: { source: "own", licence: null, checked: ABROAD_SPOTS_PLACED },
    sponsor: null,
    scope: shape.scope ?? "interior",
    hub: shape.hub ?? false,
    occasion: shape.occasion ?? false,
    stages: shape.stages ?? [],
    crowd: shape.crowd,
    traditionalBp: shape.traditionalBp,
    assets: shape.assets ?? slugOf(id),
    shuttle: shape.shuttle ?? false,
  };
}

const entries: PlaceEntry[] = [
  // Lagos: public places.
  lagos("place.ojuelegba", "Ojuelegba", "surulere", 6511, 3362, { assets: "ojuelegba-front", hub: true, stages: ["offer.fuel-scarcity", "chapter.find-your-feet", "activity.ask-around", "activity.see-agent-stop", "offer.agent-stop", "offer.agent-promise", "offer.agent-papers", "activity.buy-suya", "activity.mallam-tea", "activity.pure-water"], crowd: PACKED, traditionalBp: ROADSIDE }),
  // streets.md R-STREET-008: a morning run, and nothing else; it is a landmark.
  lagos("place.national-stadium", "National Stadium", "surulere", 6497, 3365, { stages: ["activity.morning-run"], crowd: QUIET, traditionalBp: STREET }),
  lagos("place.bode-thomas", "Bode Thomas Street", "surulere", 6490, 3355, { assets: "bode-thomas-front", stages: ["activity.play-lotto", "activity.bet-slip", "offer.parcel-shipped", "activity.barber", "activity.viewing-centre", "activity.beer-joint", "activity.night-out"], crowd: BUSY, traditionalBp: STREET }),
  lagos("place.adeniran-ogunsanya", "Adeniran Ogunsanya Street", "surulere", 6494, 3357, { stages: ["activity.job-teacher"], crowd: BUSY, traditionalBp: STREET }),
  lagos("place.costain", "Costain", "surulere", 6482, 3369, { crowd: BUSY, traditionalBp: ROADSIDE }),
  // The market is not a feature in OpenStreetMap: the position is Tejuosho Avenue's.
  lagos("place.tejuosho-market", "Tejuosho Market", "yaba", 6504, 3370, { assets: "tejuosho-front", stages: ["offer.mum-shop", "activity.open-shop", "activity.buy-clothes"], crowd: PACKED, traditionalBp: MARKET }),
  // The hub in Yaba: the room Ojuelegba's hub door cuts to (docs/rules/world.md R-WORLD-013).
  lagos("place.yaba", "Yaba", "yaba", 6507, 3375, {
    scope: "interior",
    assets: "yaba-hub",
    // activity.md R-ACTIVITY-013: open source and the talk at the desks, the talk itself at the meetup corner's
    // screen, a master's beside the routes, being noticed at work beside the jobs board.
    stages: [
      "activity.meetup",
      "activity.learn-tech",
      "activity.build-portfolio",
      "activity.interview-prep",
      "activity.job-junior-dev",
      "activity.job-mid-dev",
      "activity.job-hunt",
      "activity.look-into-route",
      "activity.apply-to-school",
      "activity.see-adviser",
      "activity.ask-someone-who-went",
      "activity.job-bank-officer",
      "activity.job-bank-senior",
      "activity.open-source",
      "activity.conference-talk",
      // R-CHAPTER-009: the care, talent and points files' steps at the hub's desk.
      "activity.find-sponsor",
      "activity.apply-endorsement",
      "activity.enter-pool",
      "setpiece.conference-talk",
      "activity.masters-at-home",
      "activity.be-noticed",
    ],
    crowd: BUSY,
    traditionalBp: OFFICE,
  }),
  lagos("place.herbert-macaulay-way", "Herbert Macaulay Way", "yaba", 6505, 3378, { crowd: BUSY, traditionalBp: STREET }),
  lagos("place.akoka", "Akoka", "akoka", 6529, 3391, { crowd: BUSY, traditionalBp: CAMPUS }),
  lagos("place.oyingbo", "Oyingbo", "ebute-metta", 6483, 3382, { crowd: PACKED, traditionalBp: MARKET }),
  lagos("place.jibowu", "Jibowu", "yaba", 6517, 3367, { crowd: BUSY, traditionalBp: ROADSIDE }),
  lagos("place.mushin", "Mushin", "mushin", 6525, 3352, { crowd: PACKED, traditionalBp: STREET }),
  lagos("place.ladipo-market", "Ladipo Market", "mushin", 6544, 3341, { crowd: PACKED, traditionalBp: MARKET }),
  // From Terminal 2 of the transport interchange.
  lagos("place.oshodi", "Oshodi", "oshodi", 6556, 3351, { crowd: PACKED, traditionalBp: ROADSIDE }),
  lagos("place.maryland", "Maryland", "ikeja", 6577, 3366, { crowd: BUSY, traditionalBp: ROADSIDE }),
  lagos("place.ojota", "Ojota", "kosofe", 6587, 3379, { crowd: BUSY, traditionalBp: ROADSIDE }),
  // streets.md R-STREET-001 to 003: a phone, the sales job and the repair apprenticeship.
  lagos("place.computer-village", "Computer Village", "ikeja", 6594, 3340, { stages: ["offer.laptop-fault", "activity.side-gig", "activity.buy-phone", "activity.job-phone-sales", "activity.apprentice-repair"], crowd: PACKED, traditionalBp: MARKET }),
  lagos("place.allen-avenue", "Allen Avenue", "ikeja", 6601, 3352, { stages: ["activity.ride-driving"], crowd: BUSY, traditionalBp: STREET }),
  lagos("place.ogba", "Ogba", "ogba", 6633, 3341, { crowd: BUSY, traditionalBp: STREET }),
  lagos("place.berger", "Berger", "ojodu", 6642, 3369, { crowd: BUSY, traditionalBp: ROADSIDE }),
  lagos("place.agege", "Agege", "agege", 6625, 3311, { crowd: BUSY, traditionalBp: ROADSIDE }),
  lagos("place.mile-12-market", "Mile 12 Market", "kosofe", 6609, 3394, { crowd: PACKED, traditionalBp: MARKET }),
  lagos("place.ikorodu-road", "Ikorodu Road", "kosofe", 6605, 3401, { crowd: BUSY, traditionalBp: ROADSIDE }),
  lagos("place.lagos-ibadan-expressway", "Lagos-Ibadan Expressway", "ikeja", 6610, 3370, { crowd: QUIET, traditionalBp: ROADSIDE }),
  lagos("place.gbagada", "Gbagada", "kosofe", 6558, 3384, { crowd: BUSY, traditionalBp: OFFICE }),
  // streets.md R-STREET-004: sleeping rough under the span, and its price.
  lagos("place.third-mainland-bridge", "Third Mainland Bridge", "lagos-lagoon", 6502, 3402, {
    stages: ["activity.sleep-rough", "offer.bridge-theft", "offer.bridge-mosquitoes", "offer.bridge-night"],
    crowd: QUIET,
    traditionalBp: OFFICE,
  }),
  // The "Carter Bridge, Iddo" way, the first result; the page had 6467, 3385, the bridge's middle.
  lagos("place.carter-bridge", "Carter Bridge", "iddo", 6469, 3383, { crowd: QUIET, traditionalBp: ROADSIDE }),
  lagos("place.eko-bridge", "Eko Bridge", "iddo", 6474, 3376, { crowd: QUIET, traditionalBp: ROADSIDE }),
  lagos("place.idumota", "Idumota", "lagos-island", 6463, 3387, { crowd: PACKED, traditionalBp: MARKET }),
  // Not a feature in OpenStreetMap: the position is the Idumota bus stop's, the nearest feature found.
  lagos("place.balogun-market", "Balogun Market", "lagos-island", 6463, 3387, { stages: ["offer.aso-ebi"], crowd: PACKED, traditionalBp: MARKET }, { source: "own", licence: "ODbL-1.0", checked: CHECKED }),
  // The commercial stretch of the street; the page had 6456, 3384, which no result gave.
  lagos("place.broad-street", "Broad Street", "lagos-island", 6454, 3390, { crowd: BUSY, traditionalBp: STREET }),
  lagos("place.marina", "Marina", "lagos-island", 6446, 3395, { crowd: BUSY, traditionalBp: STREET }),
  // From the ferry terminal.
  lagos("place.cms", "CMS", "lagos-island", 6449, 3390, { crowd: PACKED, traditionalBp: ROADSIDE }),
  lagos("place.tafawa-balewa-square", "Tafawa Balewa Square", "lagos-island", 6447, 3402, { occasion: true, crowd: QUIET, traditionalBp: STREET }),
  lagos("place.freedom-park", "Freedom Park", "lagos-island", 6449, 3397, { occasion: true, crowd: BUSY, traditionalBp: STREET }),
  lagos("place.obalende", "Obalende", "lagos-island", 6449, 3406, { crowd: PACKED, traditionalBp: ROADSIDE }),
  lagos("place.ikoyi", "Ikoyi", "ikoyi", 6452, 3428, { crowd: QUIET, traditionalBp: OFFICE }),
  lagos("place.victoria-island", "Victoria Island", "victoria-island", 6430, 3426, { stages: ["activity.job-customer-service"], crowd: BUSY, traditionalBp: OFFICE }),
  // From the ferry jetty.
  lagos("place.lekki-phase-1", "Lekki Phase 1", "lekki", 6448, 3459, { stages: ["activity.weekend-tutoring"], crowd: QUIET, traditionalBp: OFFICE }),
  lagos("place.lekki-epe-expressway", "Lekki-Epe Expressway", "lekki", 6452, 3555, { crowd: QUIET, traditionalBp: ROADSIDE }),
  lagos("place.ajah", "Ajah", "ajah", 6469, 3562, { crowd: PACKED, traditionalBp: ROADSIDE }),
  lagos("place.tarkwa-bay", "Tarkwa Bay", "lagos-harbour", 6400, 3396, { crowd: QUIET, traditionalBp: STREET }),
  // Placed at the rail stop named after it; its landmark is not built (R-CITY-020).
  lagos("place.national-theatre", "National Theatre", "iganmu", 6475, 3369, { crowd: QUIET, traditionalBp: STREET }),
  lagos("place.mile-2", "Mile 2", "amuwo-odofin", 6459, 3313, { crowd: PACKED, traditionalBp: ROADSIDE }),
  lagos("place.festac-town", "Festac Town", "amuwo-odofin", 6468, 3284, { crowd: BUSY, traditionalBp: STREET }),
  lagos("place.alaba-market", "Alaba International Market", "ojo", 6461, 3191, { crowd: PACKED, traditionalBp: MARKET }),
  lagos("place.ikorodu", "Ikorodu", "ikorodu", 6619, 3504, { crowd: BUSY, traditionalBp: STREET }),
  // OpenStreetMap spells it "Mohammed"; the sign uses the official spelling. Exterior, with departures and arrivals inside.
  lagos("place.airport-lagos", "Murtala Muhammed International Airport", "ikeja", 6574, 3321, {
    // The arrivals hall is an interior scene, but the entry keeps "exterior" because the terminal front's test reads its scope against the entry.
    assets: "arrivals-hall",
    stages: ["chapter.send-off", "setpiece.december", "activity.december-home-uk", "activity.december-home-ca", "activity.december-home-uae"],
    crowd: BUSY,
    traditionalBp: AIRPORT,
  }),

  // Lagos: institutions, by plain description. An area and never a position.
  // The passport is a visit to Immigration: the office has no room of its own and stands in
  // the visa centre's hall, as the hub's room borrows the inverter room.
  unnamed("place.passport-office", "institution", "home", "lagos", "ikoyi", { spot: [6451, 3431], assets: "visa-centre", stages: ["activity.get-passport"], crowd: BUSY, traditionalBp: OFFICE }),
  // R-DOCUMENT-007: no police station is built, so the police certificate is asked at the notice here.
  unnamed("place.visa-centre", "institution", "home", "lagos", "victoria-island", { spot: [6428, 3422], stages: ["activity.apply-for-visa", "activity.apply-uk-care", "activity.apply-uk-talent", "setpiece.credibility-interview", "activity.get-police-certificate"], crowd: BUSY, traditionalBp: OFFICE }),
  unnamed("place.english-test-centre", "institution", "home", "lagos", "ikeja", { spot: [6598, 3352], stages: ["activity.sit-english-test", "activity.study-english"], crowd: QUIET, traditionalBp: OFFICE }),
  // The staff nurse's job is on the clinic's notice, where a nurse from sixteen takes her first step (prologue.md R-PROLOGUE-010).
  // activity.md R-ACTIVITY-013: the nurse's certification on the notice, its exam sat on the chairs.
  unnamed("place.tb-clinic", "institution", "home", "lagos", "ikeja", { spot: [6596, 3348], stages: ["activity.tb-test", "activity.gulf-medical", "activity.job-nurse", "activity.nurse-certification", "setpiece.nurse-exam"], crowd: QUIET, traditionalBp: OFFICE }),
  unnamed("place.medical-centre", "institution", "home", "lagos", "ikeja", { spot: [6600, 3355], crowd: QUIET, traditionalBp: OFFICE }),
  unnamed("place.university", "institution", "home", "lagos", "akoka", { spot: [6517, 3395], scope: "exterior", stages: [], crowd: BUSY, traditionalBp: CAMPUS }),
  unnamed("place.general-hospital", "institution", "home", "lagos", "surulere", { spot: [6499, 3351], stages: ["offer.illness", "offer.illness-worse"], crowd: BUSY, traditionalBp: STREET }),
  unnamed("place.church", "institution", "home", "lagos", OWN_AREA, { spot: [6505, 3357], occasion: true, stages: ["offer.harvest"], crowd: BUSY, traditionalBp: STREET }),
  unnamed("place.mosque", "institution", "home", "lagos", OWN_AREA, { spot: [6509, 3356], scope: "exterior", crowd: BUSY, traditionalBp: STREET }),

  // Lagos: businesses by made-up name. Shopfronts are signs on their street, in place.text.ts.
  // Its own room, not the hub's: the hub's file with nothing staged here showed only the door (R-WORLD-005).
  // activity.md R-ACTIVITY-013: the posts are written at the room's long table of laptops.
  unnamed("place.yaba-hub", "business", "home", "lagos", "yaba", { spot: [6509, 3373], assets: "inverter-room", stages: ["activity.tech-posts"], crowd: QUIET, traditionalBp: HUB }),
  unnamed("place.olokun-office", "business", "home", "lagos", "victoria-island", { spot: [6432, 3423], assets: "bank-counter", stages: ["offer.held-funds", "offer.salary-loan"], crowd: FEW, traditionalBp: OFFICE }),
  unnamed("place.agent-office", "business", "home", "lagos", "ikeja", { spot: [6591, 3345], stages: ["offer.held-funds-agent", "offer.gulf-agent", "activity.see-agent-office", "activity.apply-gulf-contract", "offer.agent-office"], crowd: FEW, traditionalBp: OFFICE }),

  // Homes and stylised places: no real name, no area, no position, no sponsor.
  // Home opens in the compound; the house door cuts to the parlour (docs/rules/world.md R-WORLD-014).
  // home.md R-HOME-006: the settlement on the lagoon the character may live in.
  lagos("place.makoko", "Makoko", "makoko", 6495, 3390, { scope: "exterior", crowd: BUSY, traditionalBp: OFFICE, stages: ["activity.job-fish-racks"] }),
  // On a made-up street in Surulere near the hub: the spot the map and the fares read (R-CITY-008). The house
  // is one wide floor seen whole, its yard and carport inside its walls (decision 0018), so it stays an exterior.
  unnamed("place.family-house", "stylised", "home", "lagos", null, {
    spot: [6507, 3359],
    scope: "exterior",
    assets: "home-family-house",
    occasion: true,
    stages: [
      "activity.rest",
      "activity.family-time",
      "activity.family-meeting",
      "activity.night-support",
      // obligation.md R-OBLIGATION-014: the cooking corner and the water drum in the parlour.
      "activity.cook-at-home",
      "activity.fetch-water",
      "activity.fill-drum",
      "offer.nepa-bill",
      "offer.brother-fees",
      "offer.roof",
      "offer.family-pledge",
      "offer.family-pledge-small",
      "offer.send-off-party",
      // chapter.md R-CHAPTER-008: home's own send-off, the month of the grant.
      "offer.family-send-off",
    ],
    crowd: FAMILY,
    traditionalBp: STREET,
  }),
  // home.md R-HOME-010: one rented room in a shared compound in Ojuelegba, the character's home while they live there.
  // It stages nothing of its own: its things carry the home's own acts, which the family house stages (R-HOME-006,
  // R-CITY-010), and the city opens them where the character lives. Its made-up spot is in Ojuelegba; the map shows it only as home.
  unnamed("place.compound-room", "stylised", "home", "lagos", null, {
    spot: [6513, 3360],
    scope: "interior",
    assets: "home-room-house",
    crowd: NEIGHBOURS,
    traditionalBp: STREET,
  }),
  // A hostel room of your own (decision 0018): one small room off a shared corridor, rented by the month, the cheap
  // way out of the family house. Like the room in a compound it stages nothing of its own; its made-up spot is in Yaba,
  // where the hostels by the colleges are, and the map shows it only as home.
  unnamed("place.hostel-room", "stylised", "home", "lagos", null, {
    spot: [6512, 3378],
    scope: "interior",
    assets: "home-hostel-house",
    crowd: CORRIDOR,
    traditionalBp: CAMPUS,
  }),
  unnamed("place.motor-park", "stylised", "home", "lagos", null, {
    scope: "exterior",
    stages: ["offer.road-park", "offer.road-radio", "offer.road-cousin"],
    crowd: PACKED,
    traditionalBp: ROADSIDE,
  }),
  unnamed("place.road-night", "stylised", "road", null, null, {
    scope: "exterior",
    stages: ["setpiece.road-night", "setpiece.road-truth", "offer.road-ransom-call", "offer.road-exit"],
    crowd: FEW,
    traditionalBp: ROADSIDE,
  }),

  // Abroad. The design table's shares are for Lagos; abroad uses the hub and office share.
  abroad("place.heathrow", "country.uk", "london", "heathrow", "London Heathrow Airport", 51468, -459, { scope: "interior", crowd: BUSY, traditionalBp: AIRPORT }),
  // London on the Lagos mold (city.md "Entries: abroad", design page 14 section 4). The hub: the jobs
  // notice and the agency's stand where the hunt is sent (world.md R-WORLD-005), and the find on the street (R-STREET-006).
  abroad("place.peckham", "country.uk", "london", "peckham", "Peckham", 51473, -70, {
    hub: true,
    stages: ["activity.job-hunt", "offer.street-find-uk"],
    crowd: BUSY,
    traditionalBp: HUB,
  }),
  // The shopping street (streets.md R-STREET-005, R-STREET-012): the transfer shop, the stalls, the chicken
  // shop and its kitchen, the Nigerian shop, the barber, the clothes shop and the pub.
  abroad("place.rye-lane", "country.uk", "london", "peckham", "Rye Lane", 51468, -69, {
    stages: ["activity.send-money", "activity.street-shopping-uk", "activity.chicken-shop", "activity.job-uk-kitchen-cash", "activity.naija-shop-uk", "activity.barber-uk", "activity.buy-clothes-uk", "activity.pub-pint"],
    crowd: BUSY,
    traditionalBp: HUB,
  }),
  // The station (place.md R-PLACE-012): the ticket machine's bus pass, the courier's bike; the train's platform.
  abroad("place.peckham-rye-station", "country.uk", "london", "peckham", "Peckham Rye", 51470, -69, { stages: ["activity.bus-pass-uk", "activity.job-uk-courier-cash"], crowd: BUSY, traditionalBp: HUB }),
  // The rota board's overtime stands at every workplace (R-CITY-010: the one id at several places).
  // The big shop on Peckham High Street: the weekly shop, the part-time job at the tills and the staff notice's overtime.
  london("place.big-shop-uk", "business", "peckham", 51474, -68, { stages: ["activity.weekly-shop-uk", "activity.job-uk-retail-part", "activity.overtime"], crowd: BUSY, traditionalBp: HUB }),
  // The care home in Nunhead: the door, the rota board's overtime and the manager's door.
  london("place.care-home-uk", "business", "nunhead", 51467, -54, { stages: ["activity.job-uk-care", "activity.job-uk-senior-care", "activity.overtime"], crowd: QUIET, traditionalBp: OFFICE }),
  // The ward on Denmark Hill, shown by plain description: the nurses' station and the rota board.
  london("place.ward-uk", "institution", "camberwell", 51468, -94, { stages: ["activity.job-uk-nurse", "activity.overtime"], crowd: QUIET, traditionalBp: OFFICE }),
  // The office at London Bridge: the desk and the glass office.
  london("place.office-uk", "business", "london-bridge", 51505, -86, { stages: ["activity.job-uk-skilled", "activity.job-uk-graduate", "activity.job-uk-senior-dev"], crowd: QUIET, traditionalBp: OFFICE }),
  // The warehouse on the Old Kent Road: the clock-in and the rota board.
  london("place.warehouse-uk", "business", "old-kent-road", 51487, -62, { stages: ["activity.job-uk-warehouse", "activity.overtime"], crowd: QUIET, traditionalBp: OFFICE }),
  // The church on the Old Kent Road, the community's place (world.md R-WORLD-020), shown by plain description.
  london("place.church-uk", "institution", "old-kent-road", 51486, -66, { occasion: true, stages: ["activity.community-uk"], crowd: BUSY, traditionalBp: HUB }),
  // The UK's test centre at Elephant and Castle, on the English test centre's scene (R-CITY-010: the country's own place
  // stages what the country-less one stages).
  london("place.test-centre-uk", "institution", "elephant-and-castle", 51494, -100, { assets: "english-test-centre", stages: ["activity.nmc-tests", "activity.driving-test"], crowd: QUIET, traditionalBp: OFFICE }),
  // Calgary on the mold (city.md "Entries: abroad", design page 15 section 3). Made-up spots in the
  // north-east, placed against the airport, the CTrain's north-east line and downtown so the paper reads right.
  abroad("place.calgary-airport", "country.canada", "calgary", "north-east", "Calgary International Airport", 51122, -114014, { scope: "interior", crowd: QUIET, traditionalBp: AIRPORT }),
  // The hub, dressed as a strip mall at a made-up spot: the jobs notice, the coffee shop, the
  // African store, the barber, the bus stop and the find. A row of shops shown by description, so a business.
  calgary("place.calgary-north-east", "business", "north-east", 51090, -113960, {
    scope: "exterior",
    hub: true,
    // Money home goes from the transfer counter at the African store, not the room (city.md).
    stages: ["activity.job-hunt", "activity.coffee-ca", "activity.naija-shop-ca", "activity.barber-ca", "activity.send-money", "offer.street-find-ca"],
    crowd: QUIET,
    traditionalBp: HUB,
  }),
  // The station (place.md R-PLACE-012): the ticket machine's transit pass; the train's platform. Which station
  // is not said, so it is shown by plain description.
  calgary("place.ctrain-station-ca", "institution", "north-east", 51073, -113977, { scope: "exterior", stages: ["activity.transit-pass-ca"], crowd: QUIET, traditionalBp: HUB }),
  // The rooms Calgary shares with London are London's scenes under Calgary's own entries (R-WORLD-039).
  calgary("place.big-shop-ca", "business", "north-east", 51095, -113980, { assets: "big-shop-uk", stages: ["activity.weekly-shop-ca", "activity.buy-clothes-ca"], crowd: BUSY, traditionalBp: HUB }),
  calgary("place.warehouse-ca", "business", "north-east", 51110, -113990, { assets: "warehouse-uk", stages: ["activity.job-ca-warehouse", "activity.overtime"], crowd: QUIET, traditionalBp: OFFICE }),
  calgary("place.care-home-ca", "business", "north-east", 51080, -113995, { assets: "care-home-uk", stages: ["activity.job-ca-care-aide", "activity.overtime"], crowd: QUIET, traditionalBp: OFFICE }),
  calgary("place.office-ca", "business", "downtown", 51046, -114063, { assets: "office-uk", stages: ["activity.job-ca-professional", "activity.job-ca-dev"], crowd: QUIET, traditionalBp: OFFICE }),
  // The library's evening course, a room of its own.
  calgary("place.library-ca", "institution", "north-east", 51092, -113972, { stages: ["activity.learn-tech-ca"], crowd: QUIET, traditionalBp: OFFICE }),
  // The church hall, the community's place (world.md R-WORLD-020).
  calgary("place.church-ca", "institution", "north-east", 51085, -113965, { assets: "church-uk", occasion: true, stages: ["activity.community-ca"], crowd: BUSY, traditionalBp: HUB }),
  // The registry on the English test centre's scene, for Alberta's licence (R-CITY-010: the country's own place stages
  // what the country-less test centre staged).

  // Dubai on the mold (design page 15 section 3).
  abroad("place.dubai-airport", "country.uae", "dubai", "garhoud", "Dubai International Airport", 25252, 55367, { scope: "interior", crowd: PACKED, traditionalBp: AIRPORT }),
  // The hub: the typing centre where the hunt is sent, the exchange house for money home, the cafeteria, the African foods
  // shop, the barber, the corner by the creek and the find. The souq moved to Naif and the Gulf's jobs to the site.
  abroad("place.deira", "country.uae", "dubai", "deira", "Deira", 25273, 55305, {
    hub: true,
    stages: ["activity.job-hunt", "activity.send-money", "activity.cafeteria-uae", "activity.naija-shop-uae", "activity.barber-uae", "activity.community-uae", "offer.street-find-uae"],
    crowd: PACKED,
    traditionalBp: HUB,
  }),
  // The souq streets (streets.md R-STREET-014): the souq, the laundry and the tailor.
  abroad("place.naif", "country.uae", "dubai", "deira", "Naif", 25272, 55310, { stages: ["activity.street-shopping-uae", "activity.laundry-uae", "activity.buy-clothes-uae"], crowd: PACKED, traditionalBp: HUB }),
  // The metro station (place.md R-PLACE-012): the Nol machine's zone pass; the metro's platform. Looked up in
  // OpenStreetMap's search on 16 Oct 2026 (the station's gates on Al Maktoum Street, 25.2665, 55.3122).
  { ...abroad("place.metro-station-uae", "country.uae", "dubai", "deira", "Union station", 25266, 55312, { stages: ["activity.transit-pass-uae"], crowd: BUSY, traditionalBp: HUB }), data: { ...OSM, checked: ABROAD_SPOTS_PLACED } },
  dubai("place.big-shop-uae", "business", "al-rigga", 25265, 55320, { assets: "big-shop-uk", stages: ["activity.weekly-shop-uae"], crowd: BUSY, traditionalBp: HUB }),
  // The site among the towers across the creek, reached by the labour bus for nothing (R-PLACE-013): the guard's post,
  // the cleaner's trolley and the rota board.
  dubai("place.site-uae", "business", "towers", 25186, 55263, { scope: "exterior", shuttle: true, stages: ["activity.job-gulf-guard", "activity.job-gulf-cleaner", "activity.overtime"], crowd: QUIET, traditionalBp: OFFICE }),

  // Castel Volturno on the mold (design page 15 section 3).
  // The hub: the roundabout where the vans come at dawn, the bar, the African shop, the call shop for money home and the find.
  abroad("place.castel-volturno", "country.italy", "castel-volturno", "castel-volturno", "Castel Volturno", 41034, 13941, {
    hub: true,
    stages: ["activity.job-hunt", "activity.coffee-it", "activity.naija-shop-it", "activity.send-money", "offer.street-find-it"],
    crowd: QUIET,
    traditionalBp: HUB,
  }),
  // The coast road: the pickup point's second shift, the Nigerian shop, the barber and the market stall.
  abroad("place.via-domitiana", "country.italy", "castel-volturno", "castel-volturno", "Via Domitiana", 40929, 14025, {
    stages: ["activity.overtime", "activity.street-shopping-it", "activity.barber-it", "activity.buy-clothes-it"],
    crowd: QUIET,
    traditionalBp: HUB,
  }),
  // The fields inland, reached by the gangmaster's van for nothing (R-PLACE-013): the gangmaster's table.
  castel("place.farm-it", "business", "fields", 41010, 13990, { scope: "exterior", shuttle: true, stages: ["activity.job-it-farm-cash"], crowd: QUIET, traditionalBp: ROADSIDE }),
  castel("place.big-shop-it", "business", "castel-volturno", 41030, 13950, { assets: "big-shop-uk", stages: ["activity.weekly-shop-it"], crowd: BUSY, traditionalBp: HUB }),
  // The church, the community's place (world.md R-WORLD-020).
  castel("place.church-it", "institution", "castel-volturno", 41028, 13945, { assets: "church-uk", occasion: true, stages: ["activity.community-it"], crowd: BUSY, traditionalBp: HUB }),
  abroad("place.naples-airport", "country.italy", "naples", "capodichino", "Naples Airport", 40884, 14285, { scope: "interior", crowd: QUIET, traditionalBp: AIRPORT }),
  // One shared room dressed per person: a friend's room, and a partner's home once courting (world.md R-WORLD-020).
  unnamed("place.their-room", "stylised", "home", "lagos", null, { stages: ["activity.see-someone"], crowd: FEW, traditionalBp: OFFICE }),
  unnamed("place.the-room", "stylised", "abroad", null, null, {
    // The bed, the window and the laptop in the room abroad (R-WORLD-025; R-CITY-010 lets the country-less room stage what a country's own place also stages).
    // The cooking corner cooks in each country's money (streets.md R-STREET-012 to R-STREET-015, home.md R-HOME-012):
    // each country's meal shows only there. The hunt, the community and money home are at each country's own places
    // (city.md "Entries: abroad").
    stages: ["activity.rest", "activity.call-home", "activity.rent-flat-uk", "activity.rent-flat-ca", "activity.phone-contract-uk", "activity.phone-contract-ca", "activity.cook-own-uk", "activity.cook-own-ca", "activity.cook-own-uae", "activity.cook-own-it"],
    crowd: FEW,
    traditionalBp: OFFICE,
  }),
];

export const placeTable: Record<Id<"place">, PlaceEntry> = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
