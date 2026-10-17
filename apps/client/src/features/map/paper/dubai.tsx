// Dubai as a painted city (docs/rules/world.md R-WORLD-038; design page 15 sections 2 and 6): Deira on paper,
// the Gulf along the north-west, the creek cutting in from it to the south-east, the metro's lines, the airport to the
// south-east, the camp to the east, the site among the towers south across the creek, four neighbourhood cards, every
// built place of the UAE as its sticker and the home sticker at the country's home spot from content (the bed space at
// the camp). Its own chunk, loaded only when the map shows the UAE, so a first visit at home carries none of it. Authored
// in the thousandths of a degree content keeps positions in, laid on the paper through Dubai's own fit; rough on
// purpose, as the positions are (city.md R-CITY-008): a stylised Dubai, not a survey.
import { content } from "@japacity/content";

import { mapWords } from "../map.words";
import type { PaperCity, StripMark } from "./city";
import { type Card, cardByRules, type Rule } from "./districts";
import type { DrawSource } from "./draw";
import { type Fit, fitOf, type Point, type Position } from "./fit";
import type { Decor, Label, Road } from "./geometry";
import { Cranes, Tower, Towers } from "./landmarks";
import { PaperMap, type PaperMapProps } from "./PaperMap";
import type { Clear, Ground } from "./scatter";

/** [lat, lon] in thousandths of a degree. */
type LatLon = readonly [number, number];

export const UAE = "country.uae";

/**
 * Dubai's fit: north up, a thousandth of a degree seven paper units south and six east, so the paper keeps the city's
 * true shape (a thousandth of a degree of longitude is about 100 m at 25 degrees north against 111 m of latitude,
 * R-PLACE-010). The paper runs from 55.250 to 55.408 east and from 25.290 down to 25.176 north: wider than
 * tall, since the camp lies east of Deira and the site far to the south-west.
 */
export const DUBAI_FIT: Fit = { xLon: 6, xLat: 0, x0: -331500, yLon: 0, yLat: -7, y0: 177030 };
export const DUBAI_PAPER = { width: 948, height: 798 } as const;

const fitted = fitOf(DUBAI_FIT);
const at = ([latE3, lonE3]: LatLon): Point => fitted.toPaper({ latE3, lonE3 });
const ring = (points: readonly LatLon[]): Point[] => points.map(at);

/** The home's spot on the map, from content's country table: the bed space at the camp (design page 15 section 3). */
export const DUBAI_HOME_SPOT: Position = content.country[UAE]?.homeSpot ?? { latE3: 25270, lonE3: 55395 };
const HOME = "place.the-room";

/**
 * The land: one shore along the Gulf, cut deep by the creek from its mouth by Deira south-east to its end at the
 * lagoon, Deira on its north-east bank and Bur Dubai on its south-west; it runs on past the paper's edges.
 */
const LAND: Readonly<Record<string, readonly Point[]>> = {
  dubai: ring([
    // The Gulf's shore north-east of the creek's mouth, along Deira's corniche.
    [25330, 55362],
    [25300, 55345],
    [25290, 55322],
    [25284, 55305],
    [25279, 55292],
    // The creek's north-east bank, Deira's, down to the lagoon at its end.
    [25275, 55296],
    [25267, 55304],
    [25259, 55313],
    [25251, 55323],
    [25243, 55334],
    [25230, 55343],
    [25214, 55347],
    [25199, 55349],
    [25193, 55345],
    // Back up the south-west bank, Bur Dubai's, to the mouth.
    [25198, 55340],
    [25210, 55338],
    [25225, 55335],
    [25236, 55328],
    [25243, 55319],
    [25251, 55309],
    [25258, 55300],
    [25266, 55291],
    [25274, 55284],
    // The shore south-west of the mouth, along the beaches toward the towers.
    [25268, 55276],
    [25255, 55265],
    [25238, 55255],
    [25215, 55243],
    [25190, 55232],
    [25160, 55220],
    [25120, 55200],
    [25120, 55470],
    [25330, 55470],
  ]),
};

/** The junctions the roads share, by name; a route turns only at a point two roads share. */
const J = {
  deira: [25271, 55309],
  union: [25265, 55313],
  rigga: [25263, 55322],
  garhoudN: [25246, 55340],
  garhoudS: [25234, 55325],
  airport: [25254, 55362],
  ittihad: [25268, 55345],
  qusais: [25272, 55388],
  camp: [25272, 55398],
  bridgeN: [25258, 55320],
  bridgeS: [25250, 55305],
  karama: [25240, 55298],
  szr: [25215, 55280],
  site: [25190, 55267],
  corniche: [25280, 55315],
} as const satisfies Record<string, LatLon>;

const road = (points: readonly LatLon[], main: boolean, bridge?: string): Road => ({ points: points.map(at), main, ...(bridge === undefined ? {} : { bridge }) });

const ROADS: readonly Road[] = [
  // The corniche down to Deira, Union and Al Rigga.
  road([J.corniche, J.deira, J.union, J.rigga], true),
  // The airport road, Al Rigga to Garhoud and on to the airport.
  road([J.rigga, J.garhoudN, J.airport], true),
  // Al Ittihad and Damascus Street out to Al Qusais and the camp.
  road([J.rigga, J.ittihad, J.qusais, J.camp], true),
  // The airport up to Al Qusais.
  road([J.airport, [25262, 55378], J.qusais], true),
  // Union to the bridge.
  road([J.union, J.bridgeN], true),
  // Across the creek: Bur Dubai, Karama and Sheikh Zayed Road south-west to the towers and the site.
  road([J.bridgeS, J.karama, J.szr, J.site, [25176, 55258]], true),
  // Garhoud's bridge's south side joins Karama.
  road([J.garhoudS, [25236, 55312], J.karama], true),
  // The camp's own road on to the east.
  road([J.camp, [25268, 55410]], false),
  // Minor streets for the grain of the city.
  road([J.deira, [25276, 55325], J.ittihad], false),
  road([J.union, [25258, 55330], J.garhoudN], false),
  road([[25280, 55355], J.ittihad, [25255, 55350]], false),
  road([[25285, 55380], J.qusais, [25262, 55395]], false),
  road([J.karama, [25262, 55290]], false),
  road([[25230, 55262], J.szr, [25225, 55300]], false),
  road([[25200, 55250], [25195, 55290]], false),
  road([[25245, 55375], [25238, 55395]], false),
  // The two bridges over the creek.
  road([J.bridgeN, J.bridgeS], true, "al-maktoum"),
  road([J.garhoudN, J.garhoudS], true, "garhoud"),
];

/** The metro: the red line from the airport through Union, across the creek and down Sheikh Zayed Road past the site; the green line from Union out east toward the camp. */
const RAILS: readonly (readonly Point[])[] = [
  ring([
    [25248, 55385],
    [25252, 55366],
    [25258, 55345],
    [25264, 55326],
    [25267, 55313],
    [25262, 55301],
    [25250, 55292],
    [25230, 55282],
    [25205, 55272],
    [25187, 55262],
    [25174, 55256],
  ]),
  ring([
    [25267, 55313],
    [25274, 55330],
    [25276, 55360],
    [25276, 55385],
    [25270, 55405],
  ]),
];

/** The parks, as [x, y, rx, ry] on the paper: the green by the creek in Bur Dubai, Al Mamzar's beach park, the lagoon's reserve. */
const PARKS: readonly (readonly [number, number, number, number])[] = [
  [...at([25236, 55305]), 18, 11],
  [...at([25290, 55355]), 20, 10],
  [...at([25200, 55360]), 22, 14],
];

const label = (key: string, where: LatLon, tilt: number, size: number): Label => ({ key, at: at(where), tilt, size });

const LABELS: readonly Label[] = [
  label("map.area.dubai.deira", [25279, 55335], -4, 13),
  label("map.area.dubai.bur-dubai", [25248, 55280], -6, 12),
  label("map.area.dubai.garhoud", [25238, 55352], 0, 11),
  label("map.area.dubai.qusais", [25284, 55392], -3, 11),
  label("map.area.dubai.business-bay", [25202, 55298], 0, 11),
];

const WATER_LABELS: readonly Label[] = [label("map.water.creek", [25222, 55338], -62, 12), label("map.water.gulf", [25282, 55266], -30, 15)];

const decor = (model: string, where: LatLon, size: number, tilt: number): Decor => ({ model, at: at(where), size, tilt, kind: "car" });

/** The metro on its viaduct, the labour bus on the road to the site, and a taxi by the airport. */
const DECOR: readonly Decor[] = [
  decor("veh_dubai-metro", [25230, 55282], 15, -66),
  decor("veh_dubai-metro", [25276, 55372], 14, 88),
  decor("veh_labour-bus", [25226, 55289], 14, -58),
  decor("veh_labour-bus", [25270, 55370], 13, 80),
  decor("veh_taxi-dubai", [25250, 55354], 12, -20),
];

/** The landmarks drawn as symbols: the towers about the site, the tallest of them, and the cranes over the site. */
const LANDMARKS = {
  towers: at([25198, 55280]),
  tallest: at([25194, 55274]),
  cranes: at([25182, 55250]),
} as const;

const STRIP_LANDMARKS: readonly StripMark[] = [{ id: "towers", at: LANDMARKS.towers, draw: () => <Towers at={[0, 0]} /> }];

/** The neighbourhoods in the swipe's order: Deira, the airport, the camp, the site. */
const card = (id: string, model: string, centre: Point, zoom: number): Card => ({ id, key: `map.card.${id}`, model, centre, zoom });
const CARDS: readonly Card[] = [
  card("deira", "bld_metro-station", at([25269, 55312]), 260),
  card("airport", "veh_taxi-dubai", at([25254, 55364]), 240),
  card("camp", "veh_labour-bus", at([25270, 55390]), 240),
  card("site", "bld_site-frame", at([25190, 55266]), 240),
];

/** The districts, as rules read in order; the first that holds a position is its card. */
const RULES: readonly Rule[] = [{ card: "site", latMax: 25225 }, { card: "camp", lonMin: 55380 }, { card: "airport", lonMin: 55340 }, { card: "deira" }];

/** Dubai's own words: its districts, its cards and its water. Content and the map's words win over these. */
export const dubaiText: Record<string, string> = {
  "map.area.dubai.deira": "Deira",
  "map.area.dubai.bur-dubai": "Bur Dubai",
  "map.area.dubai.garhoud": "Al Garhoud",
  "map.area.dubai.qusais": "Al Qusais",
  "map.area.dubai.business-bay": "Business Bay",
  "map.water.creek": "Dubai Creek",
  "map.water.gulf": "The Gulf",
  "map.card.deira": "Deira",
  "map.card.airport": "The airport",
  "map.card.camp": "The camp",
  "map.card.site": "The site",
};

export function dubaiWords(key: string, params: Record<string, string | number> = {}): string {
  const own = dubaiText[key];
  if (own === undefined) return mapWords(key, params);
  return own.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** The places of the UAE with a position, as content keeps them. */
function uaePlaces(): Position[] {
  return Object.values(content.place)
    .filter((place) => place.where === "abroad" && place.country === UAE && place.position !== null)
    .map((place) => place.position ?? DUBAI_HOME_SPOT);
}

/** What the scatter keeps clear of: every place of Dubai, the home, the names, the landmarks and the decor. */
function groundOf(): Ground {
  const places: Clear[] = [...uaePlaces(), DUBAI_HOME_SPOT].map((position) => {
    const [x, y] = at([position.latE3, position.lonE3]);
    return [x, y, 9];
  });
  const names: Clear[] = [...LABELS, ...WATER_LABELS].map((item) => [item.at[0], item.at[1] - 3, Math.round((item.size * item.key.length) / 12) + 4]);
  const landmarks: Clear[] = Object.values(LANDMARKS).map(([x, y]) => [x, y, 18]);
  const decorClear: Clear[] = DECOR.map((item) => [item.at[0], item.at[1], Math.round(item.size / 2) + 2]);
  return {
    land: Object.values(LAND),
    roads: [...ROADS.map((item) => ({ points: item.points, reach: item.bridge === undefined ? (item.main ? 8 : 6) : 9 })), ...RAILS.map((points) => ({ points, reach: 6 }))],
    clear: [...places, ...names, ...landmarks, ...decorClear],
    box: [-140, -200, DUBAI_PAPER.width + 140, DUBAI_PAPER.height + 200],
  };
}

const DRAW: DrawSource = { land: LAND, beach: [], roads: ROADS, rails: RAILS, ferry: [], bridgeName: [], palms: [], ground: groundOf };

/** A position kept on the paper: a place whose position is off it stands at its nearest edge, never off the paper. */
function onPaper(position: Position): Point {
  const [x, y] = fitted.toPaper(position);
  return [Math.min(DUBAI_PAPER.width - 20, Math.max(20, x)), Math.min(DUBAI_PAPER.height - 20, Math.max(20, y))];
}

export const DUBAI: PaperCity = {
  id: UAE,
  paper: DUBAI_PAPER,
  toPaper: onPaper,
  fromPaper: fitted.fromPaper,
  cardOf: (position) => cardByRules(RULES, "deira", position),
  // The room stands at the country's home spot, the camp, whatever position the map is handed for it.
  fixed: (stop) => (stop.id === HOME ? { at: fitted.toPaper(DUBAI_HOME_SPOT), card: cardByRules(RULES, "deira", DUBAI_HOME_SPOT) } : null),
  draw: DRAW,
  seaFrom: null,
  parks: PARKS,
  labels: LABELS,
  waterLabels: WATER_LABELS,
  decor: DECOR,
  cards: CARDS,
  fallbackCard: "deira",
  strip: {
    top: at([25288, 0])[1],
    bottom: at([25180, 0])[1],
    minis: [DECOR[0], DECOR[2], DECOR[4]].flatMap((item) => (item === undefined ? [] : [{ model: item.model, at: item.at, size: 14 }])),
    landmarks: STRIP_LANDMARKS,
  },
  under: () => null,
  over: () => (
    <>
      <Towers at={LANDMARKS.towers} />
      <Tower at={LANDMARKS.tallest} />
      <Cranes at={LANDMARKS.cranes} />
    </>
  ),
  // Deira a little below the middle of the first look, so the creek and the Gulf come into it from the west.
  opening: { phone: [0, -100], wide: [0, -60] },
  canoe: null,
  words: dubaiWords,
  sizes: { "place.deira": 108, "place.dubai-airport": 114, "place.site-uae": 106 },
};

/** The folding map handed Dubai: what the map screen loads in the UAE, in this chunk with its drawing. */
export function DubaiPaperMap(props: Omit<PaperMapProps, "city">) {
  return <PaperMap {...props} city={DUBAI} />;
}
