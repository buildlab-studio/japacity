// Castel Volturno as a painted city (world:painted-maps-abroad; design page 11 sections 2 and 6): the
// coast on paper, the sea along the west, the Domitiana running the length of the paper by the pinewood, the Volturno
// across the top, the fields inland, three neighbourhood cards, every built place of Italy as its sticker, the home
// sticker at the country's home spot from content, and Naples airport on an inset in the paper's south-east corner with
// its plane, since it lies far inland. Its own chunk, loaded only when the map shows Italy, so a first visit at home
// carries none of it. Authored in the thousandths of a degree content keeps positions in, laid on the paper through the
// coast's own fit; rough on purpose, as the positions are (city:positions-rough-on-purpose).
import { content } from "@japacity/content";

import { castelMapWords } from "./paper.words";
import { abroadPaper, card, type LatLon, paperPen } from "./abroad";
import type { PaperCity, StripMark } from "./city";
import type { Card, Rule } from "./districts";
import type { Fit, Point, Position } from "./fit";
import type { Decor, Label, Road } from "./geometry";
import { PaperMap, type PaperMapProps } from "./PaperMap";

export const ITALY = "country.italy";

/**
 * The coast's fit: north up, a thousandth of a degree eight paper units south and six east, so the paper keeps the
 * coast's true shape (a thousandth of a degree of longitude is about 84 m at 41 degrees north against 111 m of latitude,
 * place:rides-between-city-places). The paper runs from 13.905 to 14.050 east and from 41.062 down to 40.905 north.
 */
export const CASTEL_FIT: Fit = { xLon: 6, xLat: 0, x0: -83430, yLon: 0, yLat: -8, y0: 328496 };
export const CASTEL_PAPER = { width: 870, height: 1256 } as const;

const { at, ring, label, decor } = paperPen(CASTEL_FIT);

/** The home's spot on the map, from content's country table: the room in a shared flat on the Domitiana (design page 11 section 3). */
export const CASTEL_HOME_SPOT: Position = content.country[ITALY]?.homeSpot ?? { latE3: 40950, lonE3: 14010 };

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

const LABELS: readonly Label[] = [
  label("map.area.castel.town", [41024, 13968], -4, 13),
  label("map.area.castel.pinetamare", [40978, 13978], -36, 11),
  label("map.area.castel.fields", [41000, 14025], 0, 12),
  label("map.area.castel.varcaturo", [40912, 14012], -30, 11),
];

const WATER_LABELS: readonly Label[] = [label("map.water.tyrrhenian", [40975, 13925], -60, 15), label("map.water.volturno", [41053, 13975], 0, 12)];

/** The coast road's blue bus on the Domitiana and the gangmaster's white van on the track to the fields. */
const DECOR: readonly Decor[] = [
  decor("vehicle_italy-bus", [40988, 13975], 14, -56),
  decor("vehicle_italy-bus", [40940, 14012], 13, -52),
  decor("vehicle_van", [41008, 13984], 12, 40),
  decor("vehicle_van", [41020, 14040], 12, 10),
];

/** The coast has no landmark standing upright on the strip: its buses and its van stand there instead. */
const STRIP_LANDMARKS: readonly StripMark[] = [];

/**
 * Naples airport's inset (world:painted-maps-abroad): a framed panel in the paper's south-east corner with the runway and
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
        {castelMapWords("map.inset.naples")}
      </text>
      <text className="inset-note" x={middle} y={y1 - 9}>
        {castelMapWords("map.inset.inland")}
      </text>
    </g>
  );
}

/** The neighbourhoods, north to south: the town, the fields, the Domitiana. */
const CARDS: readonly Card[] = [
  card("town", "building_castel-row_a", at([41031, 13946]), 260),
  card("fields", "prop_tarp-table", at([41010, 13992]), 240),
  card("domitiana", "building_domitiana-block", [726, 1036], 150),
];

/** The districts, as rules read in order; the first that holds a position is its card. */
const RULES: readonly Rule[] = [{ card: "town", latMin: 41022, lonMax: 13970 }, { card: "fields", latMin: 40985 }, { card: "domitiana" }];

export const CASTEL: PaperCity = abroadPaper({
  country: ITALY,
  fit: CASTEL_FIT,
  paper: CASTEL_PAPER,
  homeSpot: CASTEL_HOME_SPOT,
  inset: { id: NAPLES, ...INSET },
  land: LAND,
  beach: ring(SHORE),
  roads: ROADS,
  rails: [],
  rules: RULES,
  ruleCard: "domitiana",
  names: { labels: [...LABELS, ...WATER_LABELS], letters: 12 },
  landmarks: { at: [], reach: 16 },
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
  over: () => <Inset />,
  // The town a little below the middle of the first look, so the river comes into it from the north.
  opening: { phone: [0, -120], wide: [0, -80] },
  words: castelMapWords,
  sizes: { "place.castel-volturno": 108, "place.naples-airport": 112, "place.via-domitiana": 104 },
});

/** The folding map handed the coast: what the map screen loads in Italy, in this chunk with its drawing. */
export function CastelPaperMap(props: Omit<PaperMapProps, "city">) {
  return <PaperMap {...props} city={CASTEL} />;
}
