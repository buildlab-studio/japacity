// The places on the painted map (docs/rules/world.md R-WORLD-015): each built place stands on the paper as its own
// sticker, and the sticker is the pin. Where it stands comes from content's position through the one fit; places a
// few hundred metres apart are eased apart by a fixed, ordered spread so neither hides the other. One rule for rings
// and names in every zoom: a ring only where the player stands, on the stop picked and on the step's place; a name on
// those, on home, and on a place never visited.
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

/** A sticker's name: where the player stands, home, the stop picked, the step's place, a place never visited; or none. */
export type Name = "here" | "home" | "picked" | "step" | "new";

export function nameOf(stop: Pick<Placed, "id" | "state">, marks: Marks): Name | null {
  if (stop.state === "here") return "here";
  if (stop.id === marks.picked) return "picked";
  if (stop.id === marks.step) return "step";
  if (stop.id === marks.home || stop.state === "home") return "home";
  if (stop.state === "can") return "new";
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

const RANK: Readonly<Record<Name, number>> = { here: 0, picked: 1, step: 2, home: 3, new: 4 };

/**
 * Which names show. Every name but a place never visited always shows; a never-visited place's name shows only where it
 * covers no name already shown, the nearer the foot of the screen first, so the quiet names never pile up.
 */
export function namesShown(boxes: readonly NameBox[], gap = 4): Set<string> {
  const order = [...boxes].sort((a, b) => RANK[a.name] - RANK[b.name] || b.y - a.y || (a.id < b.id ? -1 : 1));
  const kept: NameBox[] = [];
  for (const box of order) {
    const covers = kept.some((other) => Math.abs(other.x - box.x) * 2 < other.width + box.width + gap * 2 && Math.abs(other.y - box.y) * 2 < other.height + box.height + gap * 2);
    if (box.name !== "new" || !covers) kept.push(box);
  }
  return new Set(kept.map((box) => box.id));
}
