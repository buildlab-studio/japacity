// What the painted cities abroad share (docs/rules/world.md R-WORLD-038): the pen that lays a position in thousandths of a
// degree on a country's paper through its fit, and the city built from its drawing, so each country's file holds only
// what is its own. The room abroad has no position of its own and stands at the country's home spot; a place far off the
// fit (Heathrow, Naples' airport) stands on an inset in a corner of the paper. Imported only by the four countries'
// chunks, so a first visit at home carries none of it.
import { content } from "@japacity/content";

import type { PaperCity } from "./city";
import { type Card, cardByRules, type Rule } from "./districts";
import type { DrawSource } from "./draw";
import { type Fit, fitOf, type Point, type Position } from "./fit";
import type { Decor, Label, Road } from "./geometry";
import type { Clear, Ground } from "./scatter";

/** [lat, lon] in thousandths of a degree. */
export type LatLon = readonly [number, number];

const HOME = "place.the-room";

/** Laying positions on one country's paper: a point, a line of points, a name and a vehicle standing on a road. */
export function paperPen(fit: Fit) {
  const fitted = fitOf(fit);
  const at = ([latE3, lonE3]: LatLon): Point => fitted.toPaper({ latE3, lonE3 });
  return {
    fitted,
    at,
    ring: (points: readonly LatLon[]): Point[] => points.map(at),
    label: (key: string, where: LatLon, tilt: number, size: number): Label => ({ key, at: at(where), tilt, size }),
    decor: (model: string, where: LatLon, size: number, tilt: number): Decor => ({ model, at: at(where), size, tilt, kind: "car" }),
  };
}

/** A neighbourhood card, named by its id in the paper's words. */
export const card = (id: string, model: string, centre: Point, zoom: number): Card => ({ id, key: `map.card.${id}`, model, centre, zoom });

/** A place drawn on an inset in a corner of the paper, far off the fit: its id, the panel, its sticker's spot and its card. */
export interface Inset {
  id: string;
  /** The panel, [x0, y0, x1, y1] on the paper. */
  box: readonly [number, number, number, number];
  at: Point;
  card: string;
}

/** One country's paper: its drawing and how it reads, beside what every country's paper does alike. */
export interface AbroadSpec extends Pick<PaperCity, "paper" | "parks" | "labels" | "waterLabels" | "decor" | "cards" | "fallbackCard" | "strip" | "over" | "opening" | "words" | "sizes"> {
  country: string;
  fit: Fit;
  homeSpot: Position;
  inset: Inset | null;
  land: DrawSource["land"];
  beach: DrawSource["beach"];
  roads: readonly Road[];
  rails: DrawSource["rails"];
  /** The districts, as rules read in order, and the card a position no rule holds falls on. */
  rules: readonly Rule[];
  ruleCard: string;
  /** The names the scatter keeps clear of, and how many letters of a name its size spans. */
  names: { labels: readonly Label[]; letters: number };
  /** The landmarks the scatter keeps clear of, and how far around each. */
  landmarks: { at: readonly Point[]; reach: number };
}

/** The places of the country with a position, as content keeps them, the inset's place aside. */
function placesOf(spec: AbroadSpec): Position[] {
  return Object.values(content.place)
    .filter((place) => place.where === "abroad" && place.country === spec.country && place.position !== null && place.id !== spec.inset?.id)
    .map((place) => place.position ?? spec.homeSpot);
}

/** What the scatter keeps clear of: every place of the country, the home, the names, the landmarks, the decor and the inset. */
function groundOf(spec: AbroadSpec, at: (where: LatLon) => Point): Ground {
  const places: Clear[] = [...placesOf(spec), spec.homeSpot].map((position) => {
    const [x, y] = at([position.latE3, position.lonE3]);
    return [x, y, 9];
  });
  const names: Clear[] = spec.names.labels.map((item) => [item.at[0], item.at[1] - 3, Math.round((item.size * item.key.length) / spec.names.letters) + 4]);
  const landmarks: Clear[] = spec.landmarks.at.map(([x, y]) => [x, y, spec.landmarks.reach]);
  const decorClear: Clear[] = spec.decor.map((item) => [item.at[0], item.at[1], Math.round(item.size / 2) + 2]);
  const inset: Clear[] = [];
  if (spec.inset !== null) {
    const [x0, y0, x1, y1] = spec.inset.box;
    inset.push([Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2), Math.round((x1 - x0) * 0.75)]);
  }
  return {
    land: Object.values(spec.land),
    roads: [...spec.roads.map((item) => ({ points: item.points, reach: item.bridge === undefined ? (item.main ? 8 : 6) : 9 })), ...spec.rails.map((points) => ({ points, reach: 6 }))],
    clear: [...places, ...names, ...landmarks, ...decorClear, ...inset],
    box: [-140, -200, spec.paper.width + 140, spec.paper.height + 200],
  };
}

/** A country's painted city from its spec. */
export function abroadPaper(spec: AbroadSpec): PaperCity {
  const { fitted, at } = paperPen(spec.fit);
  const { width, height } = spec.paper;
  const cardOf = (position: Position): string => cardByRules(spec.rules, spec.ruleCard, position);
  return {
    id: spec.country,
    paper: spec.paper,
    // A place whose position is off the paper stands at its nearest edge, never off it.
    toPaper: (position) => {
      const [x, y] = fitted.toPaper(position);
      return [Math.min(width - 20, Math.max(20, x)), Math.min(height - 20, Math.max(20, y))];
    },
    fromPaper: fitted.fromPaper,
    cardOf,
    // The room stands at the home spot, and the inset's place on its inset, whatever position the map is handed for them.
    fixed: (stop) => {
      if (spec.inset !== null && stop.id === spec.inset.id) return { at: spec.inset.at, card: spec.inset.card };
      if (stop.id === HOME) return { at: fitted.toPaper(spec.homeSpot), card: cardOf(spec.homeSpot) };
      return null;
    },
    draw: { land: spec.land, beach: spec.beach, roads: spec.roads, rails: spec.rails, ferry: [], bridgeName: [], palms: [], ground: () => groundOf(spec, at) },
    seaFrom: null,
    parks: spec.parks,
    labels: spec.labels,
    waterLabels: spec.waterLabels,
    decor: spec.decor,
    cards: spec.cards,
    fallbackCard: spec.fallbackCard,
    strip: spec.strip,
    under: () => null,
    over: spec.over,
    opening: spec.opening,
    canoe: null,
    words: spec.words,
    sizes: spec.sizes,
  };
}
