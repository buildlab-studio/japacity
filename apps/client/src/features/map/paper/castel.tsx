// Castel Volturno as a painted city (docs/rules/world.md R-WORLD-038; design page 15 sections 2 and 6): the
// coast on paper, the sea along the west, the Domitiana running the length of the paper by the pinewood, the Volturno
// across the top, the fields inland, three neighbourhood cards, every built place of Italy as its sticker, the home
// sticker at the country's home spot from content, and Naples airport on an inset in the paper's south-east corner with
// its plane, since it lies far inland. Its own chunk, loaded only when the map shows Italy, so a first visit at home
// carries none of it. Authored in the thousandths of a degree content keeps positions in, laid on the paper through the
// coast's own fit; rough on purpose, as the positions are (city.md R-CITY-008).
import { content } from "@japacity/content";

import { mapWords } from "../map.words";
import type { PaperCity, StripMark } from "./city";
import { type Card, cardByRules, type Rule } from "./districts";
import type { DrawSource } from "./draw";
import { type Fit, fitOf, type Point, type Position } from "./fit";
import type { Decor, Label, Road } from "./geometry";
import { PaperMap, type PaperMapProps } from "./PaperMap";
import type { Clear, Ground } from "./scatter";

/** [lat, lon] in thousandths of a degree. */
type LatLon = readonly [number, number];

export const ITALY = "country.italy";

/**
 * The coast's fit: north up, a thousandth of a degree eight paper units south and six east, so the paper keeps the
 * coast's true shape (a thousandth of a degree of longitude is about 84 m at 41 degrees north against 111 m of latitude,
 * R-PLACE-010). The paper runs from 13.905 to 14.050 east and from 41.062 down to 40.905 north.
 */
export const CASTEL_FIT: Fit = { xLon: 6, xLat: 0, x0: -83430, yLon: 0, yLat: -8, y0: 328496 };
export const CASTEL_PAPER = { width: 870, height: 1256 } as const;

const fitted = fitOf(CASTEL_FIT);
const at = ([latE3, lonE3]: LatLon): Point => fitted.toPaper({ latE3, lonE3 });
const ring = (points: readonly LatLon[]): Point[] => points.map(at);

/** The home's spot on the map, from content's country table: the room in a shared flat on the Domitiana (design page 15 section 3). */
export const CASTEL_HOME_SPOT: Position = content.country[ITALY]?.homeSpot ?? { latE3: 40950, lonE3: 14010 };
const HOME = "place.the-room";

/** The shore, north-west to south-east, from beyond the river's mouth down past the pinewood to Licola. */
const SHORE: readonly LatLon[] = [
  [41090, 13895],
  [41060, 13908],
  [41041, 13918],
  [41020, 13932],
  [41000, 13945],
  [40975, 13962],
  [40950, 13980],
  [40925, 14000],
  [40900, 14018],
  [40860, 14045],
];

/** The Volturno's two banks, from its mouth on the shore inland to the paper's east. */
const RIVER_NORTH: readonly LatLon[] = [
  [41044, 13915],
  [41047, 13934],
  [41049, 13955],
  [41046, 13975],
  [41051, 14000],
  [41055, 14030],
  [41059, 14090],
];
const RIVER_SOUTH: readonly LatLon[] = [
  [41038, 13919],
  [41042, 13935],
  [41044, 13955],
  [41041, 13975],
  [41046, 14000],
  [41050, 14030],
  [41054, 14090],
];

/** The land: the town, the pinewood and the fields south of the Volturno, and the plain north of it; the sea lies west. */
const LAND: Readonly<Record<string, readonly Point[]>> = {
  south: ring([[41038, 13919], [41020, 13932], ...SHORE.slice(4), [40820, 14090], ...[...RIVER_SOUTH].reverse()]),
  north: ring([...RIVER_NORTH, [41140, 14090], [41140, 13875], [41090, 13895], [41060, 13908], [41044, 13915]]),
};

/** The junctions the roads share, by name; a route turns only at a point two roads share. */
const J = {
  north: [41075, 13922],
  bridgeN: [41049, 13931],
  bridgeS: [41039, 13938],
  town: [41033, 13944],
  shop: [41029, 13951],
  pinetamare: [41000, 13966],
  home: [40952, 14004],
  varcaturo: [40930, 14020],
  south: [40895, 14045],
  farm: [41012, 13992],
  coastN: [41030, 13934],
  coastS: [40935, 13995],
} as const satisfies Record<string, LatLon>;

const road = (points: readonly LatLon[], main: boolean, bridge?: string): Road => ({ points: points.map(at), main, ...(bridge === undefined ? {} : { bridge }) });

const ROADS: readonly Road[] = [
  // The Domitiana: from the north over the Volturno, through the town and down the length of the coast.
  road([J.north, J.bridgeN], true),
  road([J.bridgeS, J.town, [41018, 13955], J.pinetamare, [40975, 13984], J.home, J.varcaturo, J.south], true),
  // The town's streets to the shops and on inland to the fields.
  road([J.town, J.shop, [41022, 13968], J.farm], true),
  // The track from the Domitiana up to the fields and on inland.
  road([J.pinetamare, [41006, 13980], J.farm, [41018, 14020], [41022, 14060]], true),
  // The shore road through the pinewood.
  road([J.town, J.coastN, [41008, 13945], [40980, 13963], [40955, 13981], J.coastS, J.varcaturo], false),
  // Lanes for the grain of the coast.
  road([J.home, [40962, 14020], [40968, 14045]], false),
  road([J.pinetamare, [40990, 13985], [40985, 14010]], false),
  road([[41000, 14010], J.farm], false),
  road([J.shop, [41036, 13960], [41040, 13975]], false),
  road([[40930, 14020], [40945, 14040]], false),
  road([[41075, 13950], [41068, 13990]], false),
  // The bridge over the Volturno.
  road([J.bridgeN, J.bridgeS], true, "volturno"),
];

/** The parks, as [x, y, rx, ry] on the paper: the pinewood along the shore and the fields' green rows inland. */
const PARKS: readonly (readonly [number, number, number, number])[] = [
  [...at([40990, 13958]), 22, 34],
  [...at([40942, 13994]), 18, 26],
  [...at([41020, 14010]), 34, 20],
  [...at([40990, 14030]), 30, 22],
  [...at([41066, 14010]), 40, 18],
];

const label = (key: string, where: LatLon, tilt: number, size: number): Label => ({ key, at: at(where), tilt, size });

const LABELS: readonly Label[] = [
  label("map.area.castel.town", [41024, 13968], -4, 13),
  label("map.area.castel.pinetamare", [40978, 13978], -36, 11),
  label("map.area.castel.fields", [41000, 14025], 0, 12),
  label("map.area.castel.varcaturo", [40912, 14012], -30, 11),
];

const WATER_LABELS: readonly Label[] = [label("map.water.tyrrhenian", [40975, 13925], -60, 15), label("map.water.volturno", [41053, 13975], 0, 12)];

const decor = (model: string, where: LatLon, size: number, tilt: number): Decor => ({ model, at: at(where), size, tilt, kind: "car" });

/** The coast road's blue bus on the Domitiana and the gangmaster's white van on the track to the fields. */
const DECOR: readonly Decor[] = [
  decor("veh_italy-bus", [40988, 13975], 14, -56),
  decor("veh_italy-bus", [40940, 14012], 13, -52),
  decor("veh_van", [41008, 13984], 12, 40),
  decor("veh_van", [41020, 14040], 12, 10),
];

/** The coast has no landmark standing upright on the strip: its buses and its van stand there instead. */
const STRIP_LANDMARKS: readonly StripMark[] = [];

/**
 * Naples airport's inset (R-WORLD-038): a framed panel in the paper's south-east corner with the runway and
 * the plane, the airport's sticker standing in it, and a dashed arrow off its east side, since the airport lies inland.
 */
export const NAPLES = "place.naples-airport";
export const INSET = {
  /** The panel, [x0, y0, x1, y1] on the paper. */
  box: [742, 1124, 852, 1234] as const,
  /** Where the airport's sticker stands. */
  at: [790, 1178] as Point,
  /** The card it shows on: the Domitiana's, the paper's south. */
  card: "domitiana",
};

function Inset() {
  const [x0, y0, x1, y1] = INSET.box;
  const middle = (x0 + x1) / 2;
  return (
    <g className="inset" data-inset={NAPLES}>
      <path d={`M ${String(x1)},${String(y0 + 60)} L ${String(x1 + 24)},${String(y0 + 60)}`} className="inset-west" />
      <path d={`M ${String(x1 + 24)},${String(y0 + 60)} l -7,-5 l 0,10 z`} className="inset-arrow" />
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx="8" className="inset-frame" />
      <rect x={x0 + 12} y={y0 + 70} width={x1 - x0 - 24} height="7" rx="2" className="inset-runway" />
      <path d={`M ${String(x0 + 16)},${String(y0 + 73.5)} h ${String(x1 - x0 - 32)}`} className="inset-dash" />
      <g transform={`translate(${String(x0 + 26)},${String(y0 + 40)}) rotate(24) scale(0.7)`} className="lm">
        <path d="M -16,0 L 14,0 Q 20,0 20,3 Q 20,6 14,6 L -16,6 Q -19,6 -19,3 Q -19,0 -16,0 Z" fill="#FFFFFF" className="lm-edge" />
        <path d="M -2,1 L -10,-12 L -5,-12 L 7,1 Z M -2,5 L -10,18 L -5,18 L 7,5 Z M -15,1 L -19,-6 L -15,-6 L -10,1 Z" fill="#3D7CC9" className="lm-edge" />
      </g>
      <text className="inset-name" x={middle} y={y0 + 18}>
        {castelWords("map.inset.naples")}
      </text>
      <text className="inset-note" x={middle} y={y1 - 9}>
        {castelWords("map.inset.inland")}
      </text>
    </g>
  );
}

/** The neighbourhoods, north to south: the town, the fields, the Domitiana. */
const card = (id: string, model: string, centre: Point, zoom: number): Card => ({ id, key: `map.card.${id}`, model, centre, zoom });
const CARDS: readonly Card[] = [
  card("town", "bld_castel-row_a", at([41031, 13946]), 260),
  card("fields", "prop_tarp-table", at([41010, 13992]), 240),
  card("domitiana", "bld_domitiana-block", [726, 1036], 150),
];

/** The districts, as rules read in order; the first that holds a position is its card. */
const RULES: readonly Rule[] = [{ card: "town", latMin: 41022, lonMax: 13970 }, { card: "fields", latMin: 40985 }, { card: "domitiana" }];

/** The coast's own words: its districts, its cards, its sea and river, and Naples' inset. Content and the map's words win over these. */
export const castelText: Record<string, string> = {
  "map.area.castel.town": "Castel Volturno",
  "map.area.castel.pinetamare": "Pinetamare",
  "map.area.castel.fields": "The fields",
  "map.area.castel.varcaturo": "Varcaturo",
  "map.water.tyrrhenian": "The sea",
  "map.water.volturno": "The Volturno",
  "map.card.town": "The town",
  "map.card.fields": "The fields",
  "map.card.domitiana": "The Domitiana",
  "map.inset.naples": "Naples",
  "map.inset.inland": "Inland, by bus",
};

export function castelWords(key: string, params: Record<string, string | number> = {}): string {
  const own = castelText[key];
  if (own === undefined) return mapWords(key, params);
  return own.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** The places of Italy with a position, as content keeps them, Naples' airport aside on its inset. */
function italyPlaces(): Position[] {
  return Object.values(content.place)
    .filter((place) => place.where === "abroad" && place.country === ITALY && place.position !== null && place.id !== NAPLES)
    .map((place) => place.position ?? CASTEL_HOME_SPOT);
}

/** What the scatter keeps clear of: every place of the coast, the home, the names, the decor and the inset. */
function groundOf(): Ground {
  const places: Clear[] = [...italyPlaces(), CASTEL_HOME_SPOT].map((position) => {
    const [x, y] = at([position.latE3, position.lonE3]);
    return [x, y, 9];
  });
  const names: Clear[] = [...LABELS, ...WATER_LABELS].map((item) => [item.at[0], item.at[1] - 3, Math.round((item.size * item.key.length) / 12) + 4]);
  const decorClear: Clear[] = DECOR.map((item) => [item.at[0], item.at[1], Math.round(item.size / 2) + 2]);
  const [x0, y0, x1, y1] = INSET.box;
  const inset: Clear = [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), Math.round((x1 - x0) * 0.75)];
  return {
    land: Object.values(LAND),
    roads: ROADS.map((item) => ({ points: item.points, reach: item.bridge === undefined ? (item.main ? 8 : 6) : 9 })),
    clear: [...places, ...names, ...decorClear, inset],
    box: [-140, -200, CASTEL_PAPER.width + 140, CASTEL_PAPER.height + 200],
  };
}

const DRAW: DrawSource = { land: LAND, beach: ring(SHORE), roads: ROADS, rails: [], ferry: [], bridgeName: [], palms: [], ground: groundOf };

/** A position kept on the paper: a place whose position is off it stands at its nearest edge, never off the paper. */
function onPaper(position: Position): Point {
  const [x, y] = fitted.toPaper(position);
  return [Math.min(CASTEL_PAPER.width - 20, Math.max(20, x)), Math.min(CASTEL_PAPER.height - 20, Math.max(20, y))];
}

export const CASTEL: PaperCity = {
  id: ITALY,
  paper: CASTEL_PAPER,
  toPaper: onPaper,
  fromPaper: fitted.fromPaper,
  cardOf: (position) => cardByRules(RULES, "domitiana", position),
  // The room stands at the country's home spot, and Naples' airport on its inset, whatever position the map is handed for them.
  fixed: (stop) => {
    if (stop.id === NAPLES) return { at: INSET.at, card: INSET.card };
    if (stop.id === HOME) return { at: fitted.toPaper(CASTEL_HOME_SPOT), card: cardByRules(RULES, "domitiana", CASTEL_HOME_SPOT) };
    return null;
  },
  draw: DRAW,
  seaFrom: null,
  parks: PARKS,
  labels: LABELS,
  waterLabels: WATER_LABELS,
  decor: DECOR,
  cards: CARDS,
  fallbackCard: "town",
  strip: {
    top: at([41058, 0])[1],
    bottom: at([40910, 0])[1],
    minis: DECOR.slice(0, 3).map((item) => ({ model: item.model, at: item.at, size: 14 })),
    landmarks: STRIP_LANDMARKS,
  },
  under: () => null,
  over: () => <Inset />,
  // The town a little below the middle of the first look, so the river comes into it from the north.
  opening: { phone: [0, -120], wide: [0, -80] },
  canoe: null,
  words: castelWords,
  sizes: { "place.castel-volturno": 108, "place.naples-airport": 112, "place.via-domitiana": 104 },
};

/** The folding map handed the coast: what the map screen loads in Italy, in this chunk with its drawing. */
export function CastelPaperMap(props: Omit<PaperMapProps, "city">) {
  return <PaperMap {...props} city={CASTEL} />;
}
