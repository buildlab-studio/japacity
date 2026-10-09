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
}

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
    position: null,
    data: null,
    sponsor: null,
    scope: shape.scope ?? "interior",
    hub: false,
    occasion: shape.occasion ?? false,
    stages: shape.stages ?? [],
    crowd: shape.crowd,
    traditionalBp: shape.traditionalBp,
    assets: shape.assets ?? slugOf(id),
  };
}

/** Every job held abroad, shown at the workplace unless a place of the country stages it. */
const JOBS_ABROAD: Staged = [
  "activity.job-uk-care",
  "activity.job-uk-senior-care",
  "activity.job-uk-nurse",
  "activity.job-uk-skilled",
  "activity.job-uk-senior-dev",
  "activity.job-uk-warehouse",
  "activity.job-uk-retail-part",
  "activity.job-uk-graduate",
  "activity.job-uk-kitchen-cash",
  "activity.job-uk-courier-cash",
  "activity.job-ca-warehouse",
  "activity.job-ca-care-aide",
  "activity.job-ca-professional",
  "activity.job-ca-dev",
  "activity.job-gulf-guard",
  "activity.job-gulf-cleaner",
  "activity.job-it-farm-cash",
];

const entries: PlaceEntry[] = [
  // Lagos: public places.
  lagos("place.ojuelegba", "Ojuelegba", "surulere", 6511, 3362, { assets: "ojuelegba-front", hub: true, stages: ["offer.fuel-scarcity", "chapter.find-your-feet", "activity.ask-around", "activity.see-agent-stop", "offer.agent-stop", "offer.agent-promise", "offer.agent-papers"], crowd: PACKED, traditionalBp: ROADSIDE }),
  // streets.md R-STREET-008: a morning run, and nothing else; it is a landmark.
  lagos("place.national-stadium", "National Stadium", "surulere", 6497, 3365, { stages: ["activity.morning-run"], crowd: QUIET, traditionalBp: STREET }),
  lagos("place.bode-thomas", "Bode Thomas Street", "surulere", 6490, 3355, { assets: "bode-thomas-front", stages: ["activity.play-lotto", "activity.bet-slip"], crowd: BUSY, traditionalBp: STREET }),
  lagos("place.adeniran-ogunsanya", "Adeniran Ogunsanya Street", "surulere", 6494, 3357, { stages: ["activity.job-teacher"], crowd: BUSY, traditionalBp: STREET }),
  lagos("place.costain", "Costain", "surulere", 6482, 3369, { crowd: BUSY, traditionalBp: ROADSIDE }),
  // The market is not a feature in OpenStreetMap: the position is Tejuosho Avenue's.
  lagos("place.tejuosho-market", "Tejuosho Market", "yaba", 6504, 3370, { assets: "tejuosho-front", stages: ["offer.mum-shop"], crowd: PACKED, traditionalBp: MARKET }),
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
  // From the rail stop named after it. Not built in M3 (R-CITY-020).
  lagos("place.national-theatre", "National Theatre", "iganmu", 6475, 3369, { crowd: QUIET, traditionalBp: STREET }),
  lagos("place.mile-2", "Mile 2", "amuwo-odofin", 6459, 3313, { crowd: PACKED, traditionalBp: ROADSIDE }),
  lagos("place.festac-town", "Festac Town", "amuwo-odofin", 6468, 3284, { crowd: BUSY, traditionalBp: STREET }),
  lagos("place.alaba-market", "Alaba International Market", "ojo", 6461, 3191, { crowd: PACKED, traditionalBp: MARKET }),
  lagos("place.ikorodu", "Ikorodu", "ikorodu", 6619, 3504, { crowd: BUSY, traditionalBp: STREET }),
  // OpenStreetMap spells it "Mohammed"; the sign uses the official spelling. Exterior, with departures and arrivals inside.
  lagos("place.airport-lagos", "Murtala Muhammed International Airport", "ikeja", 6574, 3321, {
    // the arrivals hall is an interior scene; the entry keeps "exterior" while the old terminal front's test reads its scope against the entry.
    assets: "arrivals-hall",
    stages: ["chapter.send-off", "setpiece.december", "activity.december-home-uk", "activity.december-home-ca", "activity.december-home-uae"],
    crowd: BUSY,
    traditionalBp: AIRPORT,
  }),

  // Lagos: institutions, by plain description. An area and never a position.
  unnamed("place.passport-office", "institution", "home", "lagos", "ikoyi", { stages: [], crowd: BUSY, traditionalBp: OFFICE }),
  // R-DOCUMENT-007: the police certificate is asked at the notice here until a station is built.
  unnamed("place.visa-centre", "institution", "home", "lagos", "victoria-island", { stages: ["activity.apply-for-visa", "activity.apply-uk-care", "activity.apply-uk-talent", "setpiece.credibility-interview", "activity.get-police-certificate"], crowd: BUSY, traditionalBp: OFFICE }),
  unnamed("place.english-test-centre", "institution", "home", "lagos", "ikeja", { stages: ["activity.sit-english-test", "activity.study-english"], crowd: QUIET, traditionalBp: OFFICE }),
  // The staff nurse's job is on the clinic's notice, where a nurse from sixteen takes her first step (prologue.md R-PROLOGUE-010).
  // activity.md R-ACTIVITY-013: the nurse's certification on the notice, its exam sat on the chairs.
  unnamed("place.tb-clinic", "institution", "home", "lagos", "ikeja", { stages: ["activity.tb-test", "activity.gulf-medical", "activity.job-nurse", "activity.nurse-certification", "activity.request-verification", "setpiece.nurse-exam"], crowd: QUIET, traditionalBp: OFFICE }),
  unnamed("place.medical-centre", "institution", "home", "lagos", "ikeja", { crowd: QUIET, traditionalBp: OFFICE }),
  unnamed("place.university", "institution", "home", "lagos", "akoka", { scope: "exterior", stages: [], crowd: BUSY, traditionalBp: CAMPUS }),
  unnamed("place.general-hospital", "institution", "home", "lagos", "surulere", { stages: ["offer.illness", "offer.illness-worse"], crowd: BUSY, traditionalBp: STREET }),
  unnamed("place.church", "institution", "home", "lagos", OWN_AREA, { occasion: true, stages: ["offer.harvest"], crowd: BUSY, traditionalBp: STREET }),
  unnamed("place.mosque", "institution", "home", "lagos", OWN_AREA, { scope: "exterior", crowd: BUSY, traditionalBp: STREET }),

  // Lagos: businesses by made-up name. Shopfronts are signs on their street, in place.text.ts.
  // Its own room, not the hub's: the hub's file with nothing staged here showed only the door (R-WORLD-005).
  // activity.md R-ACTIVITY-013: the posts are written at the room's long table of laptops.
  unnamed("place.yaba-hub", "business", "home", "lagos", "yaba", { assets: "inverter-room", stages: ["activity.tech-posts"], crowd: QUIET, traditionalBp: HUB }),
  unnamed("place.olokun-office", "business", "home", "lagos", "victoria-island", { assets: "bank-counter", stages: ["offer.held-funds", "offer.salary-loan"], crowd: FEW, traditionalBp: OFFICE }),
  unnamed("place.agent-office", "business", "home", "lagos", "ikeja", { stages: ["offer.held-funds-agent", "offer.gulf-agent", "activity.see-agent-office", "activity.apply-gulf-contract", "offer.agent-office"], crowd: FEW, traditionalBp: OFFICE }),

  // Homes and stylised places: no real name, no area, no position, no sponsor.
  // Home opens in the compound; the house door cuts to the parlour (docs/rules/world.md R-WORLD-014).
  // home.md R-HOME-006: the settlement on the lagoon the character may live in; its scene lands with the place builder.
  lagos("place.makoko", "Makoko", "makoko", 6495, 3390, { scope: "exterior", crowd: BUSY, traditionalBp: OFFICE }),
  unnamed("place.family-house", "stylised", "home", "lagos", null, {
    scope: "exterior",
    assets: "family-house-compound",
    occasion: true,
    stages: [
      "activity.get-passport",
      "activity.get-transcript",
      "activity.get-eca",
      "activity.rest",
      "activity.family-time",
      "activity.family-meeting",
      "activity.night-support",
      // obligation.md R-OBLIGATION-014: the cooking corner and the water drum in the parlour.
      "activity.cook-at-home",
      "activity.fetch-water",
      "offer.nepa-bill",
      "offer.brother-fees",
      "offer.roof",
      "offer.family-pledge",
      "offer.family-pledge-small",
      "offer.send-off-party",
      // chapter.md R-CHAPTER-008: home's own send-off, the month of the grant.
      "offer.family-send-off",
    ],
    crowd: FEW,
    traditionalBp: STREET,
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

  // Abroad. the design table's shares are for Lagos; abroad uses the hub and office share.
  abroad("place.heathrow", "country.uk", "london", "heathrow", "London Heathrow Airport", 51468, -459, { scope: "interior", crowd: BUSY, traditionalBp: AIRPORT }),
  // streets.md R-STREET-005 and 006: the grocer's shopping and the find on the street. The UK jobs the hunt
  // can ask for, on the jobs notice by the grocer and at the job agency's stand (world.md R-WORLD-005).
  abroad("place.peckham", "country.uk", "london", "peckham", "Peckham", 51473, -70, {
    hub: true,
    stages: ["activity.street-shopping-uk", "offer.street-find-uk", "activity.job-uk-retail-part", "activity.job-uk-kitchen-cash", "activity.job-uk-senior-care", "activity.job-uk-nurse", "activity.job-uk-warehouse"],
    crowd: BUSY,
    traditionalBp: HUB,
  }),
  abroad("place.rye-lane", "country.uk", "london", "peckham", "Rye Lane", 51468, -69, { stages: ["activity.send-money", "activity.community-uk"], crowd: BUSY, traditionalBp: HUB }),
  abroad("place.peckham-rye-station", "country.uk", "london", "peckham", "Peckham Rye", 51470, -69, { stages: ["activity.job-uk-courier-cash"], crowd: BUSY, traditionalBp: HUB }),
  abroad("place.calgary-airport", "country.canada", "calgary", "north-east", "Calgary International Airport", 51122, -114014, { scope: "interior", crowd: QUIET, traditionalBp: AIRPORT }),
  // The city's position, not the street's: the street is made up.
  abroad("place.calgary-north-east", "country.canada", "calgary", "north-east", "Northeast Calgary", 51046, -114058, { hub: true, stages: ["activity.community-ca"], crowd: QUIET, traditionalBp: HUB }),
  abroad("place.dubai-airport", "country.uae", "dubai", "garhoud", "Dubai International Airport", 25252, 55367, { scope: "interior", crowd: PACKED, traditionalBp: AIRPORT }),
  // The Gulf jobs at the typing centre and the site bus; both come by the agent's contract (world.md R-WORLD-005).
  abroad("place.deira", "country.uae", "dubai", "deira", "Deira", 25273, 55305, {
    hub: true,
    stages: ["activity.community-uae", "activity.street-shopping-uae", "offer.street-find-uae", "activity.job-gulf-guard", "activity.job-gulf-cleaner"],
    crowd: PACKED,
    traditionalBp: HUB,
  }),
  abroad("place.naif", "country.uae", "dubai", "deira", "Naif", 25272, 55310, { crowd: PACKED, traditionalBp: HUB }),
  abroad("place.castel-volturno", "country.italy", "castel-volturno", "castel-volturno", "Castel Volturno", 41034, 13941, { hub: true, crowd: QUIET, traditionalBp: HUB }),
  abroad("place.via-domitiana", "country.italy", "castel-volturno", "castel-volturno", "Via Domitiana", 40929, 14025, { stages: ["activity.overtime"], crowd: QUIET, traditionalBp: HUB }),
  abroad("place.naples-airport", "country.italy", "naples", "capodichino", "Naples Airport", 40884, 14285, { scope: "interior", crowd: QUIET, traditionalBp: AIRPORT }),
  // One shared room dressed per person: a friend's room, and a partner's home once courting (world.md R-WORLD-020).
  unnamed("place.their-room", "stylised", "home", "lagos", null, { stages: ["activity.see-someone"], crowd: FEW, traditionalBp: OFFICE }),
  unnamed("place.the-room", "stylised", "abroad", null, null, {
    // The bed, the window and the laptop in the room abroad (R-WORLD-025; R-CITY-010 lets the country-less room stage what a country's own place also stages).
    stages: ["activity.rest", "activity.community-uk", "activity.community-ca", "activity.call-home", "activity.job-hunt", "activity.send-money", "activity.rent-flat-uk", "activity.rent-flat-ca", "activity.phone-contract-uk", "activity.phone-contract-ca", "activity.cook-at-home"],
    crowd: FEW,
    traditionalBp: OFFICE,
  }),
  unnamed("place.test-centre-abroad", "institution", "abroad", null, OWN_AREA, { stages: ["activity.nmc-tests", "activity.driving-test"], crowd: QUIET, traditionalBp: OFFICE }),
  unnamed("place.workplace-abroad", "business", "abroad", null, OWN_AREA, { stages: JOBS_ABROAD, crowd: QUIET, traditionalBp: OFFICE }),
];

export const placeTable: Record<Id<"place">, PlaceEntry> = Object.fromEntries(entries.map((entry) => [entry.id, entry]));
