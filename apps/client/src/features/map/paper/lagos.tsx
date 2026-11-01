// Lagos as a painted city (world:map-is-painted-lagos, world:lantern-canoe-on-map): the drawing, the districts, the strip and the
// landmarks of geometry.ts, districts.ts and fit.ts gathered into one city, and the context every part of the folding map
// reads its city from. Lagos is the context's own value, so the map draws Lagos unless it is handed another city.
import { createContext, use } from "react";

import { mapWords } from "../map.words";
import type { PaperCity, StripMark } from "./city";
import { CARDS, cardOf } from "./districts";
import { LAGOS_DRAW } from "./draw";
import { at, fromPaper, PAPER, toPaper } from "./fit";
import { DECOR, LABELS, LANDMARKS, LANTERN_CANOE, PARKS, SEA_FROM, WATER_LABELS } from "./geometry";
import { Cranes, Ferry, Pylon, Theatre, Toll, Tower, Towers } from "./landmarks";

/** How much larger than the rest a place's sticker stands: the stadium's bowl, the buildings, then the rooms' things. */
export const LAGOS_SIZES: Readonly<Record<string, number>> = {
  "place.national-stadium": 150,
  "place.family-house": 118,
  "place.airport-lagos": 120,
  "place.ojuelegba": 112,
  "place.computer-village": 110,
  "place.tejuosho-market": 108,
  "place.bode-thomas": 106,
  "place.makoko": 104,
  "place.compound-room": 96,
};

/**
 * The landmarks that say the folded paper is the whole city, standing upright on it as the folded strip draws them:
 * the theatre's hat on the mainland's shore, the island's towers, Victoria Island's and the one by the toll gate.
 * Each is the open map's own drawing at its own shape, not squeezed with the paper.
 */
const STRIP_LANDMARKS: readonly StripMark[] = [
  { id: "theatre", at: LANDMARKS.theatre, draw: () => <Theatre at={[0, 0]} /> },
  { id: "towers", at: LANDMARKS.towers, draw: () => <Towers at={[0, 0]} /> },
  { id: "towers-vi", at: LANDMARKS.towersVi, draw: () => <Towers at={[0, 0]} size={50} /> },
  { id: "tower", at: LANDMARKS.tower, draw: () => <Tower at={[0, 0]} /> },
];

export const LAGOS: PaperCity = {
  id: "lagos",
  paper: PAPER,
  toPaper,
  fromPaper,
  cardOf,
  draw: LAGOS_DRAW,
  aerial: true,
  seaFrom: SEA_FROM,
  parks: PARKS,
  labels: LABELS,
  waterLabels: WATER_LABELS,
  decor: DECOR,
  cards: CARDS,
  fallbackCard: "ojuelegba",
  strip: {
    // The paper rows the strip folds: from the top of Ikeja to the beach.
    top: at([6612, 3290])[1],
    bottom: at([6407, 3290])[1],
    // The few pictures that stay standing on the folded paper: Makoko's huts and two canoes.
    minis: [
      ...DECOR.filter((item) => item.model.startsWith("building_makoko") || item.model === "building_stilt-house")
        .slice(0, 3)
        .map((item) => ({ model: item.model, at: item.at, size: 13 })),
      ...DECOR.filter((item) => item.kind === "boat")
        .slice(1, 3)
        .map((item) => ({ model: item.model, at: item.at, size: 16 })),
    ],
    landmarks: STRIP_LANDMARKS,
  },
  under: (uid, d) => (
    <>
      <path d={d.ferry} className="ferry-line" />
      <path id={`${uid}-tmb`} d={d.bridgeName} fill="none" />
      {/* The halo under the bridge's name is a text of its own, so no letter's halo covers the one before along the curve. */}
      <text className="bridge-name halo" aria-hidden>
        <textPath href={`#${uid}-tmb`} startOffset="50%">
          {mapWords("map.bridge.third-mainland")}
        </textPath>
      </text>
      <text className="bridge-name">
        <textPath href={`#${uid}-tmb`} startOffset="50%">
          {mapWords("map.bridge.third-mainland")}
        </textPath>
      </text>
    </>
  ),
  over: (d) => (
    <>
      <path d={d.palmTrunks} className="palm-trunk" />
      <path d={d.palmFronds} className="palm" />
      <Pylon at={LANDMARKS.pylon} />
      <Theatre at={LANDMARKS.theatre} />
      <Towers at={LANDMARKS.towers} />
      <Towers at={LANDMARKS.towersVi} size={50} />
      <Tower at={LANDMARKS.tower} />
      <Toll at={LANDMARKS.toll} />
      <Ferry at={LANDMARKS.ferry} />
      <Cranes at={LANDMARKS.cranes} />
    </>
  ),
  // The district a little up and to the left of the middle, so the lagoon, its bridge and the island come into the same look.
  opening: { phone: [70, 150], wide: [90, 110] },
  canoe: LANTERN_CANOE.at,
  words: mapWords,
  sizes: LAGOS_SIZES,
};

/** The painted city the folding map draws: Lagos unless the map is handed another. */
export const PaperCityContext = createContext<PaperCity>(LAGOS);

export function usePaperCity(): PaperCity {
  return use(PaperCityContext);
}
