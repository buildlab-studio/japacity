// London as a painted city (docs/rules/world.md R-WORLD-038; design page 14 section 3): south-east London on paper, the
// Thames across the top with the City across the water, the railway through Peckham Rye, the main roads, the district
// names, five neighbourhood cards, every built place of the UK as its sticker, the home sticker at the home spot off
// Choumert Road, and Heathrow on an inset in the paper's south-west corner with its plane, since it lies far to the west.
// Its own chunk, loaded only when the map shows the UK, so a first visit at home carries none of it. Authored in the
// thousandths of a degree content keeps positions in, laid on the paper through London's own fit; rough on purpose, as
// the positions are (city.md R-CITY-008): a stylised London, not a survey.
import { content } from "@japacity/content";

import { mapWords } from "../map.words";
import type { PaperCity, StripMark } from "./city";
import { type Card, cardByRules, type Rule } from "./districts";
import type { DrawSource } from "./draw";
import { type Fit, fitOf, type Point, type Position } from "./fit";
import type { Decor, Label, Road } from "./geometry";
import { Tower, Towers } from "./landmarks";
import type { Clear, Ground } from "./scatter";

/** [lat, lon] in thousandths of a degree. */
type LatLon = readonly [number, number];

/**
 * London's fit: north up, a thousandth of a degree twenty-two paper units south and fourteen east, so the paper keeps
 * London's true shape (a thousandth of a degree of longitude is about 69 m at 51.5 degrees north against 111 m of
 * latitude, R-PLACE-010 as amended). The paper runs from 0.108 to 0.040 west and from 51.520 down to 51.458 north.
 */
export const LONDON_FIT: Fit = { xLon: 14, xLat: 0, x0: 1512, yLon: 0, yLat: -22, y0: 1133440 };
export const LONDON_PAPER = { width: 952, height: 1364 } as const;

const fitted = fitOf(LONDON_FIT);
const at = ([latE3, lonE3]: LatLon): Point => fitted.toPaper({ latE3, lonE3 });
const ring = (points: readonly LatLon[]): Point[] => points.map(at);

/** The home's spot on the map, off Choumert Road: the room abroad has no position of its own (design page 14 section 4). */
export const LONDON_HOME_SPOT: Position = { latE3: 51471, lonE3: -73 };
const HOME = "place.the-room";

/** The Thames's two banks, west to east, as it bends from Blackfriars past London Bridge and Tower Bridge to Rotherhithe. */
const SOUTH_BANK: readonly LatLon[] = [
  [51503, -160],
  [51505, -118],
  [51507, -104],
  [51506, -88],
  [51505, -80],
  [51503, -75],
  [51502, -68],
  [51500, -62],
  [51498, -55],
  [51499, -48],
  [51503, -42],
  [51507, -34],
  [51510, -20],
  [51512, 10],
];
const NORTH_BANK: readonly LatLon[] = [
  [51508, -160],
  [51510, -118],
  [51511, -104],
  [51510, -88],
  [51509, -80],
  [51507, -75],
  [51506, -68],
  [51504, -62],
  [51503, -55],
  [51504, -48],
  [51508, -42],
  [51512, -34],
  [51515, -20],
  [51517, 10],
];

/** The land on either side of the river; everything else on the paper is the Thames. It runs on past the paper's edges. */
const LAND: Readonly<Record<string, readonly Point[]>> = {
  south: ring([...SOUTH_BANK, [51420, 10], [51420, -160]]),
  north: ring([...NORTH_BANK, [51560, 10], [51560, -160]]),
};

/** The junctions the roads share, by name; a route turns only at a point two roads share. */
const J = {
  elephant: [51495, -100],
  borough: [51500, -93],
  lbS: [51506, -88],
  lbN: [51510, -88],
  tbS: [51503, -75],
  tbN: [51507, -75],
  bfS: [51507, -104],
  bfN: [51511, -104],
  bricklayers: [51494, -83],
  camberwell: [51474, -92],
  peckham: [51474, -69],
  phs: [51474, -66],
  queens: [51474, -55],
  newCross: [51476, -40],
  okr: [51486, -65],
  ryeMid: [51465, -68],
  ryeS: [51458, -68],
  nunhead: [51466, -55],
  dhS: [51456, -90],
  oldKentE: [51479, -50],
  jamaica: [51500, -62],
} as const satisfies Record<string, LatLon>;

const road = (points: readonly LatLon[], main: boolean, bridge?: string): Road => ({ points: points.map(at), main, ...(bridge === undefined ? {} : { bridge }) });

const ROADS: readonly Road[] = [
  // Borough High Street and Newington Causeway, London Bridge down to the Elephant.
  road([J.lbS, [51503, -90], J.borough, [51498, -97], J.elephant], true),
  // Walworth Road and Camberwell Road, the Elephant down to Camberwell Green.
  road([J.elephant, [51488, -96], [51481, -94], J.camberwell], true),
  // The New Kent Road, the Elephant to the Bricklayers Arms.
  road([J.elephant, [51495, -92], J.bricklayers], true),
  // The Old Kent Road, from the Bricklayers Arms down to New Cross.
  road([J.bricklayers, [51490, -76], J.okr, [51483, -58], J.oldKentE, J.newCross, [51476, -20]], true),
  // Tower Bridge Road, the bridge down to the Bricklayers Arms.
  road([J.tbS, [51499, -78], J.bricklayers], true),
  // Peckham Road and the High Street, Camberwell Green to Peckham, on as Queen's Road to New Cross.
  road([J.camberwell, [51474, -85], [51474, -77], J.peckham, J.phs, [51474, -60], J.queens, [51475, -47], J.newCross], true),
  // Rye Lane, Peckham down to the Rye.
  road([J.peckham, [51469, -69], J.ryeMid, J.ryeS], true),
  // Denmark Hill, Camberwell Green down past the hospital.
  road([J.camberwell, [51468, -91], J.dhS], true),
  // Camberwell New Road, west toward the Oval.
  road([J.camberwell, [51477, -100], [51481, -110], [51484, -160]], true),
  // Nunhead Lane and Evelina Road, the Rye across to Nunhead.
  road([J.ryeMid, [51465, -61], J.nunhead, [51468, -44], [51470, -20]], true),
  // Peckham Hill Street, the High Street up to the Old Kent Road.
  road([J.phs, [51480, -65], J.okr], true),
  // Tooley Street and Jamaica Road along the south bank, London Bridge to Rotherhithe.
  road([J.lbS, [51504, -80], J.tbS, J.jamaica, [51495, -50], [51488, -40], [51484, -20]], true),
  // Southwark Street along the south bank to Blackfriars.
  road([J.bfS, [51505, -96], J.lbS], true),
  // The north bank: Upper and Lower Thames Street through the City.
  road([[51512, -160], J.bfN, [51511, -96], J.lbN, [51509, -80], J.tbN, [51508, -60], [51512, -40], [51518, 10]], true),
  // Queen's Road to the Old Kent Road by the gasholders.
  road([J.queens, [51480, -55], [51483, -58]], false),
  // Minor streets for the grain of the city.
  road([[51484, -96], [51484, -80], [51486, -74]], false),
  road([[51471, -75], [51466, -74], [51461, -74]], false),
  road([[51473, -76], [51471, -73], [51470, -70]], false),
  road([[51472, -90], [51462, -87]], false),
  road([[51477, -92], [51479, -82], [51476, -74]], false),
  road([[51486, -55], [51492, -55], [51497, -57]], false),
  road([J.elephant, [51499, -103], [51503, -108]], false),
  road([J.borough, [51497, -88], J.bricklayers], false),
  road([[51511, -100], [51519, -100]], false),
  road([[51510, -88], [51519, -86]], false),
  road([[51509, -80], [51519, -78]], false),
  road([[51466, -82], [51468, -76], [51471, -75]], false),
  road([[51462, -62], [51466, -61]], false),
  road([[51490, -88], [51486, -84], [51481, -86]], false),
  // The bridges.
  road([J.bfS, J.bfN], true, "blackfriars"),
  road([J.lbS, J.lbN], true, "london-bridge"),
  road([J.tbS, J.tbN], true, "tower-bridge"),
];

/** The railways: the line through Peckham Rye from Denmark Hill toward London Bridge, the branch to Nunhead, the line north to Blackfriars. */
const RAILS: readonly (readonly Point[])[] = [
  ring([
    [51466, -160],
    [51468, -89],
    [51470, -69],
    [51473, -57],
    [51482, -52],
    [51490, -58],
    [51498, -70],
    [51504, -84],
  ]),
  ring([
    [51470, -69],
    [51467, -52],
    [51465, -20],
  ]),
  ring([
    [51480, -112],
    [51495, -103],
    [51507, -106],
    [51520, -106],
  ]),
];

/** The parks, as [x, y, rx, ry] on the paper: Burgess Park, Peckham Rye, Nunhead's cemetery, Southwark Park, Ruskin Park. */
const PARKS: readonly (readonly [number, number, number, number])[] = [
  [...at([51482, -82]), 74, 22],
  [...at([51460, -65]), 34, 26],
  [...at([51463, -52]), 24, 18],
  [...at([51495, -56]), 28, 18],
  [...at([51465, -93]), 18, 14],
];

const label = (key: string, where: LatLon, tilt: number, size: number): Label => ({ key, at: at(where), tilt, size });

const LABELS: readonly Label[] = [
  label("map.area.peckham", [51468, -78], -4, 13),
  label("map.area.camberwell", [51478, -100], -3, 12),
  label("map.area.nunhead", [51460, -54], 2, 11),
  label("map.area.old-kent-road", [51490, -72], 34, 11),
  label("map.area.elephant", [51492, -104], 0, 10),
  label("map.area.london-bridge", [51502, -86], 0, 10),
  label("map.area.city", [51515, -92], -2, 13),
];

const WATER_LABELS: readonly Label[] = [label("map.water.thames", [51502, -58], -8, 14)];

const decor = (model: string, where: LatLon, size: number, tilt: number): Decor => ({ model, at: at(where), size, tilt, kind: "car" });

/** London's red buses standing on their roads, and a train on the line by the Rye. */
const DECOR: readonly Decor[] = [
  decor("veh_london-bus", [51474, -81], 14, 0),
  decor("veh_london-bus", [51490, -97], 13, 80),
  decor("veh_london-bus", [51484, -59], 13, 34),
  decor("veh_london-bus", [51503, -78], 12, -14),
  decor("veh_train-carriage", [51471, -80], 14, -4),
];

/** The landmarks drawn as symbols: the City's towers across the water and the tall glass tower by London Bridge. */
const LANDMARKS = {
  city: at([51515, -82]),
  cityWest: at([51516, -98]),
  shard: at([51504, -87]),
} as const;

/** The tall glass tower by London Bridge station: a thin pointed spire of glass. */
function Spire({ at: [x, y] }: { at: Point }) {
  return (
    <g transform={`translate(${String(x)},${String(y)}) scale(0.6)`} className="lm">
      <path d="M -10,8 L -2,-58 L 1,-62 L 10,8 Z" fill="#A9D7EE" className="lm-edge" />
      <path d="M -2,-58 L 3,8" stroke="#7DB9DA" strokeWidth="2" />
      <g className="lm-win">
        <path d="M -6,-18 h11 M -5,-30 h8 M -4,-42 h6 M -7,-6 h13" />
      </g>
    </g>
  );
}

/**
 * Heathrow's inset (R-WORLD-038): a framed panel in the paper's south-west corner with the airport's runways and its
 * plane, the airport's sticker standing in it, and a dashed arrow off its west side, since Heathrow lies far west.
 */
export const HEATHROW = "place.heathrow";
export const INSET = {
  /** The panel, [x0, y0, x1, y1] on the paper. */
  box: [36, 1186, 146, 1296] as const,
  /** Where Heathrow's sticker stands. */
  at: [70, 1238] as Point,
  /** The card it shows on: Camberwell's, the paper's west. */
  card: "camberwell",
};

function Inset() {
  const [x0, y0, x1, y1] = INSET.box;
  const middle = (x0 + x1) / 2;
  return (
    <g className="inset" data-inset={HEATHROW}>
      <path d={`M ${String(x0)},${String(y0 + 55)} L ${String(x0 - 24)},${String(y0 + 55)}`} className="inset-west" />
      <path d={`M ${String(x0 - 24)},${String(y0 + 55)} l 7,-5 l 0,10 z`} className="inset-arrow" />
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx="8" className="inset-frame" />
      <rect x={x0 + 10} y={y0 + 54} width={x1 - x0 - 20} height="7" rx="2" className="inset-runway" />
      <rect x={x0 + 18} y={y0 + 72} width={x1 - x0 - 30} height="7" rx="2" className="inset-runway" />
      <path d={`M ${String(x0 + 14)},${String(y0 + 57.5)} h ${String(x1 - x0 - 28)} M ${String(x0 + 22)},${String(y0 + 75.5)} h ${String(x1 - x0 - 38)}`} className="inset-dash" />
      <g transform={`translate(${String(x1 - 24)},${String(y0 + 36)}) rotate(-24) scale(0.7)`} className="lm">
        <path d="M -16,0 L 14,0 Q 20,0 20,3 Q 20,6 14,6 L -16,6 Q -19,6 -19,3 Q -19,0 -16,0 Z" fill="#FFFFFF" className="lm-edge" />
        <path d="M -2,1 L -10,-12 L -5,-12 L 7,1 Z M -2,5 L -10,18 L -5,18 L 7,5 Z M -15,1 L -19,-6 L -15,-6 L -10,1 Z" fill="#3D7CC9" className="lm-edge" />
      </g>
      <text className="inset-name" x={middle} y={y0 + 18}>
        {londonWords("map.inset.heathrow")}
      </text>
      <text className="inset-note" x={middle} y={y1 - 9}>
        {londonWords("map.inset.west")}
      </text>
    </g>
  );
}

/** The landmarks that say the folded paper is London: the City's towers and the glass spire by the bridge. */
const STRIP_LANDMARKS: readonly StripMark[] = [
  { id: "city", at: LANDMARKS.city, draw: () => <Towers at={[0, 0]} /> },
  { id: "spire", at: LANDMARKS.shard, draw: () => <Spire at={[0, 0]} /> },
];

/** The neighbourhoods, north to south: the Elephant and London Bridge, the Old Kent Road, Camberwell, Peckham, Nunhead. */
const card = (id: string, model: string, centre: Point, zoom: number): Card => ({ id, key: `map.card.${id}`, model, centre, zoom });
const CARDS: readonly Card[] = [
  card("elephant", "prop_desk-pod", [210, 450], 150),
  card("old-kent-road", "prop_racking", at([51486, -65]), 250),
  card("camberwell", "prop_hospital-bed", [140, 1190], 180),
  card("peckham", "bld_rye-lane-terrace_a", at([51471, -70]), 300),
  card("nunhead", "prop_reception-desk", at([51466, -56]), 250),
];

/** The districts, as rules read in order; the first that holds a position is its card. */
const RULES: readonly Rule[] = [{ card: "elephant", latMin: 51492 }, { card: "old-kent-road", latMin: 51479 }, { card: "nunhead", lonMin: -62 }, { card: "camberwell", lonMax: -80 }, { card: "peckham" }];

/** London's own words: its districts, its cards, its river and Heathrow's inset. Content and the map's words win over these. */
export const londonText: Record<string, string> = {
  "map.area.peckham": "Peckham",
  "map.area.camberwell": "Camberwell",
  "map.area.nunhead": "Nunhead",
  "map.area.old-kent-road": "Old Kent Road",
  "map.area.elephant": "Elephant and Castle",
  "map.area.london-bridge": "London Bridge",
  "map.area.city": "The City",
  "map.water.thames": "The Thames",
  "map.card.elephant": "Elephant and London Bridge",
  "map.card.old-kent-road": "Old Kent Road",
  "map.card.camberwell": "Camberwell",
  "map.card.peckham": "Peckham",
  "map.card.nunhead": "Nunhead",
  "map.inset.heathrow": "Heathrow",
  "map.inset.west": "Far west, by train",
};

export function londonWords(key: string, params: Record<string, string | number> = {}): string {
  const own = londonText[key];
  if (own === undefined) return mapWords(key, params);
  return own.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** The places of the UK with a position, as content keeps them. */
function ukPlaces(): Position[] {
  return Object.values(content.place)
    .filter((place) => place.where === "abroad" && place.country === "country.uk" && place.position !== null && place.id !== HEATHROW)
    .map((place) => place.position ?? LONDON_HOME_SPOT);
}

/** What the scatter keeps clear of: every place of London with a position, the home, the names, the landmarks, the decor and the inset. */
function groundOf(): Ground {
  const places: Clear[] = [...ukPlaces(), LONDON_HOME_SPOT].map((position) => {
    const [x, y] = at([position.latE3, position.lonE3]);
    return [x, y, 9];
  });
  const names: Clear[] = LABELS.map((item) => [item.at[0], item.at[1] - 3, Math.round((item.size * item.key.length) / 9) + 4]);
  const landmarks: Clear[] = Object.values(LANDMARKS).map(([x, y]) => [x, y, 16]);
  const decorClear: Clear[] = DECOR.map((item) => [item.at[0], item.at[1], Math.round(item.size / 2) + 2]);
  const [x0, y0, x1, y1] = INSET.box;
  const inset: Clear = [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), Math.round((x1 - x0) * 0.75)];
  return {
    land: Object.values(LAND),
    roads: [...ROADS.map((item) => ({ points: item.points, reach: item.bridge === undefined ? (item.main ? 8 : 6) : 9 })), ...RAILS.map((points) => ({ points, reach: 6 }))],
    clear: [...places, ...names, ...landmarks, ...decorClear, inset],
    box: [-140, 0, LONDON_PAPER.width + 140, LONDON_PAPER.height],
  };
}

const DRAW: DrawSource = { land: LAND, beach: [], roads: ROADS, rails: RAILS, ferry: [], bridgeName: [], palms: [], ground: groundOf };

/** A position kept on the paper: a place whose position is off it stands at its nearest edge, never off the paper. */
function onPaper(position: Position): Point {
  const [x, y] = fitted.toPaper(position);
  return [Math.min(LONDON_PAPER.width - 20, Math.max(20, x)), Math.min(LONDON_PAPER.height - 20, Math.max(20, y))];
}

export const LONDON: PaperCity = {
  id: "country.uk",
  paper: LONDON_PAPER,
  toPaper: onPaper,
  fromPaper: fitted.fromPaper,
  cardOf: (position) => cardByRules(RULES, "peckham", position),
  // The room stands at the home spot, and Heathrow on its inset, whatever position the map is handed for them.
  fixed: (stop) => {
    if (stop.id === HEATHROW) return { at: INSET.at, card: INSET.card };
    if (stop.id === HOME) return { at: fitted.toPaper(LONDON_HOME_SPOT), card: cardByRules(RULES, "peckham", LONDON_HOME_SPOT) };
    return null;
  },
  draw: DRAW,
  seaFrom: null,
  parks: PARKS,
  labels: LABELS,
  waterLabels: WATER_LABELS,
  decor: DECOR,
  cards: CARDS,
  fallbackCard: "peckham",
  strip: {
    top: at([51518, 0])[1],
    bottom: at([51458, 0])[1],
    minis: DECOR.filter((item) => item.model === "veh_london-bus")
      .slice(0, 3)
      .map((item) => ({ model: item.model, at: item.at, size: 14 })),
    landmarks: STRIP_LANDMARKS,
  },
  under: () => null,
  over: () => (
    <>
      <Towers at={LANDMARKS.city} />
      <Tower at={LANDMARKS.cityWest} />
      <Spire at={LANDMARKS.shard} />
      <Inset />
    </>
  ),
  // The district a little below the middle, so the river and the City stay in the first look from the north.
  opening: { phone: [0, 90], wide: [0, 60] },
  canoe: null,
  words: londonWords,
  sizes: { "place.heathrow": 118, "place.peckham": 108, "place.rye-lane": 104 },
};
