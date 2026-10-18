// Calgary as a painted city (docs/rules/world.md R-WORLD-038; design page 15 sections 2 and 6): the north-east
// on paper, the wide grid of its avenues and trails, the CTrain line from the north-east down to downtown, the airport to
// the north, the Bow along the south with downtown across it, three neighbourhood cards, every built place of Canada as
// its sticker and the home sticker at the country's home spot from content. Its own chunk, loaded only when the map shows
// Canada, so a first visit at home carries none of it. Authored in the thousandths of a degree content keeps positions
// in, laid on the paper through Calgary's own fit; rough on purpose, as the positions are (city.md R-CITY-008).
import { content } from "@japacity/content";

import { calgaryMapWords } from "./paper.words";
import { abroadPaper, card, type LatLon, paperPen } from "./abroad";
import type { PaperCity, StripMark } from "./city";
import type { Card, Rule } from "./districts";
import type { Fit, Point, Position } from "./fit";
import type { Decor, Label, Road } from "./geometry";
import { Tower } from "./landmarks";
import { PaperMap, type PaperMapProps } from "./PaperMap";

export const CANADA = "country.canada";

/**
 * Calgary's fit: north up, a thousandth of a degree eight paper units south and five east, so the paper keeps the
 * city's true shape (a thousandth of a degree of longitude is about 71 m at 51 degrees north against 111 m of latitude,
 * R-PLACE-010). The paper runs from 114.078 to 113.904 west and from 51.140 down to 51.028 north.
 */
export const CALGARY_FIT: Fit = { xLon: 5, xLat: 0, x0: 570390, yLon: 0, yLat: -8, y0: 409120 };
export const CALGARY_PAPER = { width: 680, height: 900 } as const;

const { at, ring, label, decor } = paperPen(CALGARY_FIT);

/** The home's spot on the map, from content's country table: the room abroad has no position of its own (design page 15 section 3). */
export const CALGARY_HOME_SPOT: Position = content.country[CANADA]?.homeSpot ?? { latE3: 51088, lonE3: -113955 };

/** The Bow's two banks, from the west past downtown's north side, then bending south-east toward Inglewood. */
const NORTH_BANK: readonly LatLon[] = [
  [51059, -114220],
  [51057, -114080],
  [51055, -114060],
  [51054, -114046],
  [51051, -114034],
  [51044, -114025],
  [51036, -114017],
  [51022, -114009],
  [50980, -113995],
];
const SOUTH_BANK: readonly LatLon[] = [
  [51055, -114220],
  [51053, -114080],
  [51051, -114060],
  [51050, -114047],
  [51047, -114038],
  [51040, -114031],
  [51032, -114023],
  [51018, -114015],
  [50980, -114003],
];

/** The land on either side of the river; the Bow is the water between them. It runs on past the paper's edges. */
const LAND: Readonly<Record<string, readonly Point[]>> = {
  north: ring([...NORTH_BANK, [50980, -113760], [51260, -113760], [51260, -114220]]),
  south: ring([...SOUTH_BANK, [50980, -114220]]),
};

/** The grid's lines: the avenues east to west at their latitude, the streets and trails north to south at their longitude. */
const AVENUES = { airportTrail: 51130, mcKnight: 51098, ave32: 51082, ave16: 51067 } as const;
const STREETS = { centre: -114063, deerfoot: -114030, barlow: -114005, st36: -113985, st52: -113962 } as const;

/** One line of the grid, with every crossing on its way, so a route turns at any corner (route.ts turns at shared points). */
function avenue(lat: number, from: number, to: number, main = true): Road {
  const crossings = Object.values(STREETS).filter((lon) => lon > from && lon < to);
  return { points: [from, ...crossings, to].map((lon) => at([lat, lon])), main };
}
function street(lon: number, from: number, to: number, main = true): Road {
  const crossings = Object.values(AVENUES).filter((lat) => lat < from && lat > to);
  return { points: [from, ...crossings, to].map((lat) => at([lat, lon])), main };
}

const ROADS: readonly Road[] = [
  // Airport Trail along the airport's north, McKnight, 32 Avenue and 16 Avenue across the north-east.
  avenue(AVENUES.airportTrail, -114040, -113930),
  avenue(AVENUES.mcKnight, -114075, -113930),
  avenue(AVENUES.ave32, -114068, -113930),
  avenue(AVENUES.ave16, -114078, -113930),
  // Centre Street from the north down to the river, Deerfoot Trail by the creek, Barlow Trail by the airport, 36 Street and 52 Street NE.
  street(STREETS.centre, 51125, 51056),
  street(STREETS.deerfoot, 51140, 51056),
  street(STREETS.barlow, 51132, 51060),
  street(STREETS.st36, 51112, 51058),
  street(STREETS.st52, 51112, 51058),
  // Memorial Drive along the north bank.
  { points: ring([[51056, -114078], [51056, -114063], [51056, -114046], [51056, -114030]]), main: true },
  // Downtown's avenues across the river.
  { points: ring([[51047, -114078], [51047, -114063], [51047, -114045], [51044, -114036]]), main: true },
  { points: ring([[51042, -114078], [51042, -114063], [51042, -114048]]), main: false },
  // The crescents and bays between the grid: the north-east's grain.
  { points: ring([[51090, -113985], [51092, -113975], [51090, -113962]]), main: false },
  { points: ring([[51074, -113985], [51076, -113972], [51074, -113962]]), main: false },
  { points: ring([[51105, -113985], [51103, -113972], [51105, -113962]]), main: false },
  { points: ring([[51088, -114005], [51086, -113995], [51088, -113985]]), main: false },
  { points: ring([[51072, -114005], [51070, -113995], [51072, -113985]]), main: false },
  { points: ring([[51118, -113985], [51120, -113962]]), main: false },
  { points: ring([[51090, -114063], [51088, -114045], [51090, -114030]]), main: false },
  { points: ring([[51075, -114063], [51073, -114045], [51075, -114030]]), main: false },
  { points: ring([[51082, -113962], [51080, -113940]]), main: false },
  // The bridge across the Bow on Centre Street.
  { points: ring([[51056, -114063], [51047, -114063]]), main: true, bridge: "centre-street" },
];

/** The CTrain's north-east line: from downtown east across the river, then up the north-east past the station. */
const RAILS: readonly (readonly Point[])[] = [
  ring([
    [51045, -114080],
    [51045, -114042],
    [51049, -114031],
    [51056, -114010],
    [51063, -113986],
    [51070, -113980],
    [51125, -113980],
  ]),
];

/** The parks, as [x, y, rx, ry] on the paper: a playing field in the north-east, Confederation Park, the green by the river. */
const PARKS: readonly (readonly [number, number, number, number])[] = [
  [...at([51110, -113965]), 22, 14],
  [...at([51093, -114055]), 26, 16],
  [...at([51061, -114015]), 18, 10],
];

const LABELS: readonly Label[] = [
  label("map.area.calgary.whitehorn", [51101, -113950], -3, 12),
  label("map.area.calgary.rundle", [51066, -113950], 2, 11),
  label("map.area.calgary.sunridge", [51077, -114012], -4, 11),
  label("map.area.calgary.airport", [51137, -114012], 0, 11),
  label("map.area.calgary.downtown", [51038, -114055], 0, 13),
];

const WATER_LABELS: readonly Label[] = [label("map.water.bow", [51049, -114005], -40, 13)];

/** Calgary's white and red buses on the avenues, and a CTrain car on the line up the north-east. */
const DECOR: readonly Decor[] = [
  decor("veh_calgary-bus", [51098, -114040], 14, 0),
  decor("veh_calgary-bus", [51067, -113950], 13, 0),
  decor("veh_calgary-bus", [51120, -114005], 13, 88),
  decor("veh_ctrain-car", [51095, -113980], 15, 88),
];

/** The tall tower downtown, across the river from the north-east. */
const LANDMARKS = { tower: at([51044, -114068]) } as const;

const STRIP_LANDMARKS: readonly StripMark[] = [{ id: "tower", at: LANDMARKS.tower, draw: () => <Tower at={[0, 0]} /> }];

/** The neighbourhoods, north to south: the airport, the north-east, downtown. */
const CARDS: readonly Card[] = [
  card("airport", "prop_racking", at([51116, -114002]), 220),
  card("north-east", "bld_strip-mall", at([51084, -113975]), 140),
  card("downtown", "prop_desk-pod", at([51048, -114058]), 250),
];

/** The districts, as rules read in order; the first that holds a position is its card. */
const RULES: readonly Rule[] = [{ card: "airport", latMin: 51104 }, { card: "downtown", lonMax: -114030 }, { card: "north-east" }];

export const CALGARY: PaperCity = abroadPaper({
  country: CANADA,
  fit: CALGARY_FIT,
  paper: CALGARY_PAPER,
  homeSpot: CALGARY_HOME_SPOT,
  inset: null,
  land: LAND,
  beach: [],
  roads: ROADS,
  rails: RAILS,
  rules: RULES,
  ruleCard: "north-east",
  names: { labels: [...LABELS, ...WATER_LABELS], letters: 12 },
  landmarks: { at: Object.values(LANDMARKS), reach: 16 },
  parks: PARKS,
  labels: LABELS,
  waterLabels: WATER_LABELS,
  decor: DECOR,
  cards: CARDS,
  fallbackCard: "north-east",
  strip: {
    top: at([51134, 0])[1],
    bottom: at([51038, 0])[1],
    minis: DECOR.slice(0, 3).map((item) => ({ model: item.model, at: item.at, size: 14 })),
    landmarks: STRIP_LANDMARKS,
  },
  over: () => <Tower at={LANDMARKS.tower} />,
  // The north-east a little below the middle of the first look, so the airport comes into it from the north.
  opening: { phone: [0, -120], wide: [0, -80] },
  words: calgaryMapWords,
  sizes: { "place.calgary-north-east": 108, "place.calgary-airport": 112 },
});

/** The folding map handed Calgary: what the map screen loads in Canada, in this chunk with its drawing. */
export function CalgaryPaperMap(props: Omit<PaperMapProps, "city">) {
  return <PaperMap {...props} city={CALGARY} />;
}
