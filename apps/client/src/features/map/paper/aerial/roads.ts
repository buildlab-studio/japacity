// The roads of Lagos seen from the air (world:map-is-painted-lagos): the drawing's roads sorted by kind, each as the
// dense line its drawn curve follows, and the few street names content already holds, each set along the road that
// runs where the real street does.
import type { Point } from "../fit";
import { type Road, ROADS } from "../geometry";

export type RoadKind = "express" | "main" | "minor";

/**
 * Which roads are expressways (Ikorodu Road, Western Avenue, the Gbagada road to the bridge and the Lekki road), by
 * their place in ROADS; the bridges are drawn as expressways too. The rest keep their main or minor.
 */
const EXPRESS: ReadonlySet<number> = new Set([1, 3, 6, 11]);

export function kindOf(road: Road, index: number): RoadKind {
  if (road.bridge !== undefined || EXPRESS.has(index)) return "express";
  return road.main ? "main" : "minor";
}

/** A line as dense points, about a unit apart. */
export type Dense = [number, number][];

/** A dense line along a road's drawn curve: the same Beziers smooth.ts draws, sampled every unit or so. */
export function sampled(points: readonly Point[]): Dense {
  const first = points[0];
  if (first === undefined) return [];
  const out: Dense = [];
  if (points.length < 3) {
    for (let index = 0; index + 1 < points.length; index += 1) {
      const a = points[index] ?? first;
      const b = points[index + 1] ?? a;
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let step = 0; step < steps; step += 1) out.push([a[0] + ((b[0] - a[0]) * step) / steps, a[1] + ((b[1] - a[1]) * step) / steps]);
    }
  } else {
    for (let index = 0; index + 1 < points.length; index += 1) {
      const a = points[index] ?? first;
      const b = points[index + 1] ?? a;
      const before = points[index - 1] ?? a;
      const after = points[index + 2] ?? b;
      const c1: Point = [a[0] + Math.round((b[0] - before[0]) / 6), a[1] + Math.round((b[1] - before[1]) / 6)];
      const c2: Point = [b[0] - Math.round((after[0] - a[0]) / 6), b[1] - Math.round((after[1] - a[1]) / 6)];
      const steps = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let step = 0; step < steps; step += 1) {
        const t = step / steps;
        const u = 1 - t;
        out.push([u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]]);
      }
    }
  }
  const last = points[points.length - 1] ?? first;
  out.push([last[0], last[1]]);
  return out;
}

/** A street's name set along it: the words key (content's own name for the street), the road and the stretch of it. */
export interface StreetName {
  key: string;
  /** The road's place in ROADS. */
  road: number;
  /** Where along the road's dense line the name is centred, from 0 to 1. */
  at: number;
  /** How far either way along the road the name may move to find room, where the street runs that far. */
  slack?: number;
}

/**
 * The street names content already holds, each on the road that runs where the real street does: the places named
 * for their street (Bode Thomas Street, Adeniran Ogunsanya Street, Herbert Macaulay Way, Ikorodu Road, Allen Avenue,
 * Broad Street, the Marina, the Lekki-Epe Expressway) and the two bridges content names.
 */
export const STREET_NAMES: readonly StreetName[] = [
  { key: "place.ikorodu-road.name", road: 1, at: 0.42 },
  { key: "place.herbert-macaulay-way.name", road: 2, at: 0.45 },
  { key: "place.bode-thomas.name", road: 14, at: 0.44, slack: 0.07 },
  { key: "place.adeniran-ogunsanya.name", road: 14, at: 0.14, slack: 0.1 },
  { key: "place.lekki-epe-expressway.name", road: 11, at: 0.62 },
  { key: "place.broad-street.name", road: 7, at: 0.41 },
  { key: "place.marina.name", road: 29, at: 0.5 },
  { key: "place.allen-avenue.name", road: 19, at: 0.5 },
  { key: "place.eko-bridge.name", road: 34, at: 0.5 },
  { key: "place.carter-bridge.name", road: 35, at: 0.5 },
];

/** The named roads as dense lines, by their place in ROADS, made the first time a name asks. */
const roadLines = new Map<number, Dense>();

/** The stretch of road a name lies along: its points in reading order, or null where the road ends or bends too hard. */
export function nameStretch(name: StreetName, at: number, half: number): Dense | null {
  let line = roadLines.get(name.road);
  if (line === undefined) {
    line = sampled(ROADS[name.road]?.points ?? []);
    roadLines.set(name.road, line);
  }
  if (line === undefined || line.length < 3) return null;
  const middle = Math.max(1, Math.min(line.length - 2, Math.round((line.length - 1) * at)));
  const walk = (step: 1 | -1): Dense | null => {
    const out: Dense = [];
    let gone = 0;
    for (let index = middle; index + step >= 0 && index + step < line.length; index += step) {
      const p = line[index] ?? [0, 0];
      const q = line[index + step] ?? p;
      out.push([q[0], q[1]]);
      gone += Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (gone >= half) return out;
    }
    return null;
  };
  const back = walk(-1);
  const ahead = walk(1);
  if (back === null || ahead === null) return null;
  const points: Dense = [...back.reverse(), [line[middle]?.[0] ?? 0, line[middle]?.[1] ?? 0], ...ahead];
  // A name bends with its road, but not round a corner: the stretch turns less than forty degrees end to end.
  const heading = (i: number): number => Math.atan2((points[i + 1]?.[1] ?? 0) - (points[i]?.[1] ?? 0), (points[i + 1]?.[0] ?? 0) - (points[i]?.[0] ?? 0));
  let turned = 0;
  for (let index = 1; index + 1 < points.length; index += 1) {
    let delta = heading(index) - heading(index - 1);
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    turned += delta;
  }
  if (Math.abs(turned) > (40 * Math.PI) / 180) return null;
  const first = points[0] ?? [0, 0];
  const last = points[points.length - 1] ?? first;
  // Read left to right, or top to bottom where the road runs straight down.
  return last[0] < first[0] - 1 || (Math.abs(last[0] - first[0]) <= 1 && last[1] < first[1]) ? points.reverse() : points;
}

/** The shifts along its road a name may try, its own place first. */
export function shiftsOf(name: StreetName): number[] {
  return [0, -0.035, 0.035, -0.07, 0.07, -0.105, 0.105, -0.14, 0.14, -0.175, 0.175, -0.21, 0.21].filter((shift) => Math.abs(shift) <= (name.slack ?? 0.21) && name.at + shift > 0.02 && name.at + shift < 0.98);
}
