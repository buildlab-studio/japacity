// The neighbourhoods (docs/rules/world.md R-WORLD-015): the painted map zoomed in on one district is a card, and the
// cards swipe sideways in the city's order, north to south. A place belongs to the card whose district holds its
// position, by the first rule that matches, so a new place with a position finds its card by itself.
import { at, type Point, type Position } from "./fit";

export const CARD_IDS = ["ikeja", "yaba", "ojuelegba", "surulere", "bode", "ebute", "makoko", "island", "lekki"] as const;
export type CardId = (typeof CARD_IDS)[number];

export interface Card {
  id: CardId;
  /** The words key of its name, folded into the card's top edge as a small pill. */
  key: string;
  /** The model whose tile sits in the pill. */
  model: string;
  /** The paper point at the card's middle. */
  centre: Point;
  /** How many screen pixels a hundred paper units take on the card. */
  zoom: number;
}

const card = (id: CardId, model: string, centre: readonly [number, number], zoom: number): Card => ({ id, key: `map.card.${id}`, model, centre: at(centre), zoom });

export const CARDS: readonly Card[] = [
  card("ikeja", "bld_phone-plaza", [6588, 3337], 230),
  card("yaba", "bld_market-block", [6505, 3375], 300),
  card("ojuelegba", "bld_flyover-span", [6512, 3361], 300),
  card("surulere", "lm_national-stadium", [6501, 3360], 290),
  card("bode", "bld_bode-thomas-betting", [6487, 3353], 290),
  card("ebute", "bld_railway-bridge", [6475, 3376], 260),
  card("makoko", "bld_makoko-house_b", [6497, 3395], 290),
  card("island", "bld_plaza", [6446, 3414], 150),
  card("lekki", "bld_shop-row", [6440, 3458], 220),
];

/** One rule of where a district is, in thousandths of a degree; a missing bound is open. */
interface Rule {
  card: CardId;
  latMin?: number;
  latMax?: number;
  lonMin?: number;
  lonMax?: number;
}

/** The districts, as rules read in order; the first that holds a position is its card. */
const RULES: readonly Rule[] = [
  { card: "ikeja", latMin: 6545 },
  { card: "makoko", latMin: 6484, latMax: 6506, lonMin: 3386 },
  { card: "lekki", lonMin: 3450 },
  { card: "island", latMax: 6470, lonMin: 3378 },
  { card: "yaba", latMin: 6500, lonMin: 3368 },
  { card: "ojuelegba", latMin: 6509 },
  { card: "surulere", latMin: 6492, lonMax: 3368 },
  { card: "bode", lonMax: 3362 },
  { card: "ebute" },
];

/** The card a position belongs to. */
export function cardOf(position: Position): CardId {
  const { latE3, lonE3 } = position;
  const rule = RULES.find((candidate) => (candidate.latMin === undefined || latE3 >= candidate.latMin) && (candidate.latMax === undefined || latE3 < candidate.latMax) && (candidate.lonMin === undefined || lonE3 >= candidate.lonMin) && (candidate.lonMax === undefined || lonE3 < candidate.lonMax));
  return rule?.card ?? "ebute";
}

export function cardById(id: CardId): Card {
  return CARDS.find((candidate) => candidate.id === id) ?? (CARDS[0] as Card);
}

/** Where a card stands in the swipe, from 0. */
export function cardIndex(id: CardId): number {
  return CARD_IDS.indexOf(id);
}

/** Whether a paper point shows on a card of the given size in pixels, with a margin kept clear at its edges. */
export function onCard(card: Card, [x, y]: Point, width: number, height: number, margin = 0): boolean {
  const dx = Math.abs(x - card.centre[0]) * card.zoom;
  const dy = Math.abs(y - card.centre[1]) * card.zoom;
  return dx * 2 <= (width - margin * 2) * 100 && dy * 2 <= (height - margin * 2) * 100;
}
