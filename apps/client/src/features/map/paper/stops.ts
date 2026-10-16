// The places on the painted map (docs/rules/world.md R-WORLD-015): each built place stands on the paper as its own
// sticker, and the sticker is the pin. Where it stands comes from content's position through the one fit; places a
// few hundred metres apart are eased apart by a fixed, ordered spread so neither hides the other. One rule for rings
// and names in every zoom: a ring only where the player stands, on the stop picked and on the step's place; a name on
// those, on home, and on a place never visited (on a card only, a few at a time); on a card a place already visited
// carries its name too, so every sticker there is named; names that meet move clear of each other.
import type { PinState } from "../../../shared/world/contract";
import { type CardId, cardOf } from "./districts";
import { type Point, type Position, toPaper } from "./fit";

/** A stop as the paper needs it. */
export interface PaperStop {
  id: string;
  state: PinState;
  position: Position;
}

/** A stop placed: its paper point and its card. */
export interface Placed {
  id: string;
  state: PinState;
  at: Point;
  card: CardId;
}

/** Two places' stickers keep at least this many paper units apart. */
export const APART = 22;
/** The spread goes over the pairs this many times. */
const ROUNDS = 12;

/**
 * Eases points closer than `apart` away from each other along the line between them, each by half of what is missing,
 * in a fixed order (by id) for a fixed number of rounds, in whole units: the same points always give the same spread.
 * A pair standing on the very same point is parted east and west.
 */
export function spread(points: readonly { id: string; at: Point }[], apart = APART): Map<string, Point> {
  const order = [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const now = new Map<string, [number, number]>(order.map((point) => [point.id, [point.at[0], point.at[1]]]));
  for (let round = 0; round < ROUNDS; round += 1) {
    let moved = false;
    for (let first = 0; first < order.length; first += 1) {
      for (let second = first + 1; second < order.length; second += 1) {
        const a = now.get(order[first]?.id ?? "");
        const b = now.get(order[second]?.id ?? "");
        if (a === undefined || b === undefined) continue;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const gap = dx * dx + dy * dy;
        if (gap >= apart * apart) continue;
        const distance = Math.max(1, Math.round(Math.sqrt(gap)));
        const half = Math.ceil((apart - distance) / 2);
        const ux = gap === 0 ? 1 : dx;
        const uy = gap === 0 ? 0 : dy;
        const length = gap === 0 ? 1 : distance;
        const mx = Math.round((ux * half) / length);
        const my = Math.round((uy * half) / length);
        if (mx === 0 && my === 0) continue;
        a[0] -= mx;
        a[1] -= my;
        b[0] += mx;
        b[1] += my;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return new Map([...now].map(([id, [x, y]]) => [id, [x, y] as const]));
}

/** The stops on the paper, each at its eased point and with its card. */
export function placeStops(stops: readonly PaperStop[]): Placed[] {
  const eased = spread(stops.map((stop) => ({ id: stop.id, at: toPaper(stop.position) })));
  return stops.map((stop) => ({ id: stop.id, state: stop.state, at: eased.get(stop.id) ?? toPaper(stop.position), card: cardOf(stop.position) }));
}

/** What the player has in view now, for the ring and name rule. */
export interface Marks {
  home: string | null;
  picked: string | null;
  /** The place the live step points to, or null. */
  step: string | null;
}

/** A sticker's ring: where the player stands, the stop picked or the step's place, each its own; or none. */
export type Ring = "here" | "picked" | "step";

export function ringOf(stop: Pick<Placed, "id" | "state">, marks: Marks): Ring | null {
  if (stop.state === "here") return "here";
  if (stop.id === marks.picked) return "picked";
  if (stop.id === marks.step) return "step";
  return null;
}

/** A sticker's name: where the player stands, home, the stop picked, the step's place, a place visited (on a card), a place never visited; or none. */
export type Name = "here" | "home" | "picked" | "step" | "been" | "new";

/**
 * A sticker's name, by the one rule. `onCard` is a neighbourhood's card, where a place already visited carries its name
 * as well (16 Oct 2026: one sticker on a card had none while the rest had theirs).
 */
export function nameOf(stop: Pick<Placed, "id" | "state">, marks: Marks, onCard = false): Name | null {
  if (stop.state === "here") return "here";
  if (stop.id === marks.picked) return "picked";
  if (stop.id === marks.step) return "step";
  if (stop.id === marks.home || stop.state === "home") return "home";
  if (stop.state === "can") return "new";
  if (onCard && stop.state === "been") return "been";
  return null;
}

/** A name on the screen: its box's middle and size in pixels, and which kind of name it is. */
export interface NameBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: Name;
}

const RANK: Readonly<Record<Name, number>> = { here: 0, picked: 1, step: 2, home: 3, been: 4, new: 5 };

/** How the names are chosen in one view. */
export interface NameRule {
  /** The space kept between two names, in pixels. */
  gap?: number;
  /** The most never-visited names shown at once: a few on a card, none on the open map or the strip. */
  newest?: number;
  /** Where the view's middle stands, in the boxes' pixels: the never-visited names nearest it show first. */
  centre?: readonly [number, number] | null;
  /** The part of the view on screen, as x0, y0, x1, y1 in the boxes' pixels: a never-visited name not whole on it is not shown. */
  seen?: readonly [number, number, number, number] | null;
}

/** Where a shown name stands: how far it is moved from its own place under or over its sticker, in pixels. */
export type NameShift = readonly [number, number];

/**
 * Which names show and where. Every name that matters always shows (where the player stands, the stop picked, the
 * step's place, home, and on a card a place visited); where one would cover a name already placed, it moves clear: further down, then up, then to a
 * side, by its own height or half its width, so here, home and the hub never pile up where districts meet. A name of a
 * place never visited shows only where it covers none, and only the first few of them, the nearest the view's middle
 * first (else the nearer the foot of the screen), so the quiet names never crowd a card.
 */
export function placeNames(boxes: readonly NameBox[], rule: NameRule = {}): Map<string, NameShift> {
  const gap = rule.gap ?? 4;
  const newest = rule.newest ?? Number.POSITIVE_INFINITY;
  const centre = rule.centre ?? null;
  const seen = rule.seen ?? null;
  const away = (box: NameBox): number => (centre === null ? -box.y : Math.hypot(box.x - centre[0], box.y - centre[1]));
  const order = [...boxes].sort((a, b) => RANK[a.name] - RANK[b.name] || (a.name === "new" ? away(a) - away(b) : b.y - a.y) || (a.id < b.id ? -1 : 1));
  const kept: NameBox[] = [];
  const shifts = new Map<string, NameShift>();
  const covers = (box: NameBox): boolean =>
    kept.some((other) => Math.abs(other.x - box.x) * 2 < other.width + box.width + gap * 2 && Math.abs(other.y - box.y) * 2 < other.height + box.height + gap * 2);
  let fresh = 0;
  for (const box of order) {
    if (box.name === "new") {
      if (fresh >= newest || covers(box)) continue;
      // Whole on the part seen, or not at all: a quiet name cut by the card's edge says nothing.
      if (seen !== null && (box.x - box.width / 2 < seen[0] || box.x + box.width / 2 > seen[2] || box.y - box.height / 2 < seen[1] || box.y + box.height / 2 > seen[3])) continue;
      fresh += 1;
      kept.push(box);
      shifts.set(box.id, [0, 0]);
      continue;
    }
    const step = box.height + gap;
    const side = Math.round(box.width / 2 + gap);
    const tries: NameShift[] = [[0, 0], [0, step], [0, -step], [0, 2 * step], [side, 0], [-side, 0], [side, step], [-side, step]];
    const shift = tries.find(([dx, dy]) => !covers({ ...box, x: box.x + dx, y: box.y + dy })) ?? [0, 0];
    kept.push({ ...box, x: box.x + shift[0], y: box.y + shift[1] });
    shifts.set(box.id, shift);
  }
  return shifts;
}

/** Which names show, wherever each stands (`placeNames`). */
export function namesShown(boxes: readonly NameBox[], gap = 4): Set<string> {
  return new Set(placeNames(boxes, { gap }).keys());
}
