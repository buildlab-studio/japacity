// The houses, trees and waves of the painted map (docs/rules/world.md R-WORLD-015), placed by a seeded layout so the
// city is the same every time it opens: candidates drawn from a whole-number sequence, kept only on land (or, for a
// wave, on open water), clear of the coast, the roads, the places, the names and the landmarks, and a set distance from
// one another. Whole numbers throughout; nothing here reads the clock or the screen.
import type { Point } from "./fit";

/** A whole-number sequence from a seed (mulberry32): each call gives a whole number from 0 up to, not including, `below`. */
export function sequence(seed: number): (below: number) => number {
  let state = seed | 0;
  return (below) => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) % below;
  };
}

/** Whether a point is inside a closed ring (even-odd), in whole numbers. */
export function inside(ring: readonly Point[], [x, y]: Point): boolean {
  let within = false;
  for (let index = 0, before = ring.length - 1; index < ring.length; before = index, index += 1) {
    const [xi, yi] = ring[index] ?? [0, 0];
    const [xj, yj] = ring[before] ?? [0, 0];
    if (yi > y === yj > y) continue;
    const dy = yj - yi;
    const left = (x - xi) * dy;
    const right = (xj - xi) * (y - yi);
    if (dy > 0 ? left < right : left > right) within = !within;
  }
  return within;
}

/** Whether a point is within `reach` of the segment from a to b, in whole numbers (no square roots). */
export function near([px, py]: Point, [ax, ay]: Point, [bx, by]: Point, reach: number): boolean {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const dot = wx * vx + wy * vy;
  const length = vx * vx + vy * vy;
  if (dot <= 0 || length === 0) return wx * wx + wy * wy <= reach * reach;
  if (dot >= length) return (px - bx) * (px - bx) + (py - by) * (py - by) <= reach * reach;
  const cross = wx * vy - wy * vx;
  return cross * cross <= reach * reach * length;
}

/** Whether a point is within `reach` of any segment of a line (closed when `closed`). */
export function nearLine(point: Point, line: readonly Point[], reach: number, closed = false): boolean {
  const count = line.length;
  const last = closed ? count : count - 1;
  for (let index = 0; index < last; index += 1) {
    const a = line[index];
    const b = line[(index + 1) % count];
    if (a !== undefined && b !== undefined && near(point, a, b, reach)) return true;
  }
  return false;
}

/** A circle kept clear: [x, y, radius]. */
export type Clear = readonly [number, number, number];

export interface Ground {
  /** The land, each a closed ring. */
  land: readonly (readonly Point[])[];
  /** The roads as lines, each with how far either side to keep clear. */
  roads: readonly { points: readonly Point[]; reach: number }[];
  /** What to keep clear of: the places, the names, the landmarks. */
  clear: readonly Clear[];
  /** The box to scatter over: [x0, y0, x1, y1]. */
  box: readonly [number, number, number, number];
}

export interface House {
  x: number;
  y: number;
  /** Which of the roof colours, 0 to ROOFS - 1. */
  roof: number;
}

export interface Scattered {
  houses: House[];
  trees: Point[];
  waves: Point[];
  /** The closer grain shown only on a neighbourhood's card. */
  closeHouses: House[];
  closeTrees: Point[];
}

/** How many roof colours the paint has. */
export const ROOFS = 5;
/** Keep this clear of the coast, so the soft coast never cuts a house. */
const COAST = 7;

export interface ScatterTuning {
  seed: number;
  tries: number;
  /** At most this many houses and trees together, at least `spacing` apart. */
  most: number;
  spacing: number;
  closeMost: number;
  closeSpacing: number;
  waves: number;
  waveSpacing: number;
  /** Out of 100, how many of the grain are houses rather than trees. */
  housesIn100: number;
}

export const TUNING: ScatterTuning = { seed: 20261013, tries: 24000, most: 1500, spacing: 13, closeMost: 1300, closeSpacing: 8, waves: 320, waveSpacing: 34, housesIn100: 62 };

/** A grid of what has been placed, so "far enough from the rest" looks at the cells nearby only. */
function spacer(cell: number) {
  const cells = new Map<number, Point[]>();
  const keyOf = (cx: number, cy: number): number => cx * 4096 + cy;
  return {
    far([x, y]: Point, apart: number): boolean {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (const [qx, qy] of cells.get(keyOf(cx + dx, cy + dy)) ?? []) if ((qx - x) * (qx - x) + (qy - y) * (qy - y) < apart * apart) return false;
        }
      }
      return true;
    },
    add(point: Point): void {
      const key = keyOf(Math.floor(point[0] / cell), Math.floor(point[1] / cell));
      cells.set(key, [...(cells.get(key) ?? []), point]);
    },
  };
}

/** The seeded layout: the same ground and tuning always give the same houses, trees and waves, in the same order. */
export function scatter(ground: Ground, tuning: ScatterTuning = TUNING): Scattered {
  const next = sequence(tuning.seed);
  const [x0, y0, x1, y1] = ground.box;
  const pick = (): Point => [x0 + next(x1 - x0), y0 + next(y1 - y0)];
  const onLand = (point: Point): boolean => ground.land.some((piece) => inside(piece, point));
  const byCoast = (point: Point): boolean => ground.land.some((piece) => nearLine(point, piece, COAST, true));
  const byRoad = (point: Point): boolean => ground.roads.some((road) => nearLine(point, road.points, road.reach));
  const blocked = (point: Point, pad: number): boolean => ground.clear.some(([cx, cy, radius]) => (cx - point[0]) * (cx - point[0]) + (cy - point[1]) * (cy - point[1]) < (radius + pad) * (radius + pad));
  const grain = (count: number, apart: number, placed: ReturnType<typeof spacer>): { houses: House[]; trees: Point[] } => {
    const houses: House[] = [];
    const trees: Point[] = [];
    for (let attempt = 0; attempt < tuning.tries && houses.length + trees.length < count; attempt += 1) {
      const point = pick();
      if (!onLand(point) || byCoast(point) || byRoad(point) || blocked(point, 2) || !placed.far(point, apart)) continue;
      placed.add(point);
      if (next(100) < tuning.housesIn100) houses.push({ x: point[0], y: point[1], roof: next(ROOFS) });
      else trees.push(point);
    }
    // Drawn from the back to the front, so a nearer house overlaps the one behind it.
    houses.sort((a, b) => a.y - b.y || a.x - b.x);
    trees.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    return { houses, trees };
  };
  const placed = spacer(tuning.spacing);
  const wide = grain(tuning.most, tuning.spacing, placed);
  // The closer grain fills between the wide one, keeping its own smaller distance from both.
  const closer = spacer(tuning.spacing);
  for (const house of wide.houses) closer.add([house.x, house.y]);
  for (const tree of wide.trees) closer.add(tree);
  const close = grain(tuning.closeMost, tuning.closeSpacing, closer);
  const waves: Point[] = [];
  const wet = spacer(tuning.waveSpacing);
  for (let attempt = 0; attempt < tuning.tries && waves.length < tuning.waves; attempt += 1) {
    const point = pick();
    if (onLand(point) || byCoast(point) || byRoad(point) || blocked(point, 0) || !wet.far(point, tuning.waveSpacing)) continue;
    wet.add(point);
    waves.push(point);
  }
  return { houses: wide.houses, trees: wide.trees, waves, closeHouses: close.houses, closeTrees: close.trees };
}
