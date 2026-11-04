// Lagos from the air (world:map-is-painted-lagos): side lanes off every street, building blocks laid along the streets
// and lanes and in the lots between, small lots packed into the ground left, and each cut into small roofs in rust,
// brown and zinc with a rare faded blue or green, packed at the heart of each neighbourhood card and looser toward its
// edges. Seeded, so the city is the same every time it opens.
//
// It is laid in two parts, each a generator that yields every few steps, so a phone lays it in idle slices and never
// in one long task. The skeleton (the dense roads, the lanes, the block slots along every street and lane) is laid once
// for the whole paper; then each 120-unit square of the grain is laid by itself, from the skeleton and its own seed
// alone, so the squares can be laid in any order (the ones a view shows first) and still give the same roofs.
import { CELL } from "../draw";
import { CARDS } from "../districts";
import { BRIDGE_NAME_PATH, PARKS, ROADS } from "../geometry";
import { inside, nearLine, sequence, type Ground } from "../scatter";
import { type Dense, kindOf, type RoadKind, sampled } from "./roads";

type XY = readonly [number, number];
/** A block or a lot: its four corners, in order round it. */
export type Quad = readonly [XY, XY, XY, XY];

export interface AerialTuning {
  seed: number;
  /** How far apart side lanes leave a street, at least and at most. */
  laneEvery: readonly [number, number];
  /** Out of 100, how often a lane leaves a street on a side. */
  laneIn100: number;
  laneLength: readonly [number, number];
  /** How far apart the lots of the infill are tried, in units. */
  infill: number;
  /** How long a roof is along its block, at least and at most, in tenths of a unit. */
  roof: readonly [number, number];
  /** The ground left between two roofs, at least and at most, in tenths of a unit. */
  gap: readonly [number, number];
  /** The most a roof turns off its block's line, in hundredths of a radian. */
  turn: number;
  /** Out of 100, how many roofs stand at a card's heart and far from every card. */
  keep: readonly [number, number];
  /** Out of 100, how often two roofs side by side are one bigger roof, at a card's heart and far from every card. */
  joined: readonly [number, number];
  /** In hundredths, how much larger a roof stands where the grain is coarsest than at a card's heart. */
  grow: number;
  /** Out of 100, how often a lot is joined to the next one where the grain is coarsest. */
  merged: number;
  /** Out of 1000, how many roofs show a lit window at night. */
  lit: number;
  /** How far apart the waves on the water stand, in units. */
  waves: number;
}

export const AERIAL: AerialTuning = { seed: 20261102, laneEvery: [12, 19], laneIn100: 84, laneLength: [16, 46], infill: 4.8, roof: [36, 50], gap: [3, 5], turn: 9, keep: [100, 20], joined: [24, 70], grow: 160, merged: 90, lit: 62, waves: 32 };

/** The roofs' colours, in the order of the roof classes, and how often each is drawn out of 100. */
export const ROOF_KINDS = ["rust", "brown", "zinc", "old-zinc", "blue", "green"] as const;
const ROOF_WEIGHTS = [31, 23, 22, 16, 4, 4] as const;

/** A street the blocks are laid along: its dense line, its running lengths and how far back from its middle a block stands. */
interface Street {
  line: Dense;
  sums: number[];
  setback: number;
  /** How near its middle nothing but the road may stand. */
  keep: number;
  /** A lane's blocks are smaller than a street's. */
  small: boolean;
}

/** A place along a street where a block is tried, with every draw it needs made in advance, so a slot is the same whichever square lays it. */
interface Slot {
  street: number;
  side: 1 | -1;
  along: number;
  want: number;
  deep: number;
  /** The rows behind the front one: whether each is tried (out of 100), its depth and how much shorter it is. */
  rows: readonly (readonly [number, number, number])[];
}

/** A point along a line, with the line's direction there as a unit vector. */
interface Station {
  x: number;
  y: number;
  ux: number;
  uy: number;
}

/** The point a distance along a line, found from the line's running lengths by halving. */
function stationAt(line: Dense, sums: readonly number[], distance: number): Station | undefined {
  if (distance < 0 || distance > (sums[sums.length - 1] ?? 0)) return undefined;
  let low = 0;
  let high = sums.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if ((sums[mid] ?? 0) <= distance) low = mid;
    else high = mid;
  }
  const a = line[low] ?? [0, 0];
  const b = line[low + 1] ?? a;
  const length = (sums[low + 1] ?? 0) - (sums[low] ?? 0);
  if (length === 0) return undefined;
  const t = (distance - (sums[low] ?? 0)) / length;
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ux: (b[0] - a[0]) / length, uy: (b[1] - a[1]) / length };
}

function sumsOf(line: Dense): number[] {
  const sums = [0];
  for (let at = 0; at + 1 < line.length; at += 1) sums.push((sums[at] ?? 0) + Math.hypot((line[at + 1]?.[0] ?? 0) - (line[at]?.[0] ?? 0), (line[at + 1]?.[1] ?? 0) - (line[at]?.[1] ?? 0)));
  return sums;
}

/** A line with every fourth point, for the index: a curve's chord four units long stands within a hair of the curve. */
function coarse(line: Dense): Dense {
  const out: Dense = [];
  for (let index = 0; index < line.length; index += 4) out.push(line[index] ?? [0, 0]);
  const last = line[line.length - 1];
  if (last !== undefined && out[out.length - 1] !== last) out.push(last);
  return out;
}

interface Segment {
  ax: number;
  ay: number;
  vx: number;
  vy: number;
  /** The segment's length squared, and its direction as a unit vector. */
  length: number;
  ux: number;
  uy: number;
  keep: number;
  owner: number;
}

/** A segment index over the paper, so "is this near a street" looks at the few segments nearby. */
function segmentIndex(cell: number) {
  const cells = new Map<number, Segment[]>();
  const keyOf = (cx: number, cy: number): number => (cx + 1000) * 10000 + (cy + 1000);
  return {
    add(line: readonly XY[], keep: number, owner: number): void {
      for (let index = 0; index + 1 < line.length; index += 1) {
        const a = line[index] ?? [0, 0];
        const b = line[index + 1] ?? a;
        const vx = b[0] - a[0];
        const vy = b[1] - a[1];
        const length = vx * vx + vy * vy;
        const norm = Math.sqrt(length) || 1;
        const segment: Segment = { ax: a[0], ay: a[1], vx, vy, length, ux: vx / norm, uy: vy / norm, keep, owner };
        const x0 = Math.floor((Math.min(a[0], b[0]) - keep) / cell);
        const x1 = Math.floor((Math.max(a[0], b[0]) + keep) / cell);
        const y0 = Math.floor((Math.min(a[1], b[1]) - keep) / cell);
        const y1 = Math.floor((Math.max(a[1], b[1]) + keep) / cell);
        for (let cx = x0; cx <= x1; cx += 1) {
          for (let cy = y0; cy <= y1; cy += 1) {
            const key = keyOf(cx, cy);
            const list = cells.get(key);
            if (list === undefined) cells.set(key, [segment]);
            else list.push(segment);
          }
        }
      }
    },
    /** The direction of the nearest street within `reach` cells round a point, as a unit vector, or null. */
    nearest(x: number, y: number, reach: number): XY | null {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      let best = Infinity;
      let found: Segment | null = null;
      for (let dx = -reach; dx <= reach; dx += 1) {
        for (let dy = -reach; dy <= reach; dy += 1) {
          const list = cells.get(keyOf(cx + dx, cy + dy));
          if (list === undefined) continue;
          for (const segment of list) {
            if (segment.length === 0) continue;
            const t = Math.max(0, Math.min(1, ((x - segment.ax) * segment.vx + (y - segment.ay) * segment.vy) / segment.length));
            const ex = segment.ax + segment.vx * t - x;
            const ey = segment.ay + segment.vy * t - y;
            const gap = ex * ex + ey * ey;
            if (gap < best) {
              best = gap;
              found = segment;
            }
          }
        }
      }
      return found === null ? null : [found.ux, found.uy];
    },
    /** Whether a point stands within some street's keep, other than the owner's own when one is given. */
    near(x: number, y: number, extra = 0, skip = -1): boolean {
      const list = cells.get(keyOf(Math.floor(x / cell), Math.floor(y / cell)));
      if (list === undefined) return false;
      for (const segment of list) {
        if (segment.owner === skip) continue;
        const reach = segment.keep + extra;
        const wx = x - segment.ax;
        const wy = y - segment.ay;
        const t = segment.length === 0 ? 0 : Math.max(0, Math.min(1, (wx * segment.vx + wy * segment.vy) / segment.length));
        const dx = wx - segment.vx * t;
        const dy = wy - segment.vy * t;
        if (dx * dx + dy * dy < reach * reach) return true;
      }
      return false;
    },
  };
}

type SegmentIndex = ReturnType<typeof segmentIndex>;

function quadOf(cx: number, cy: number, ux: number, uy: number, length: number, depth: number): Quad {
  const nx = -uy;
  const ny = ux;
  const hl = length / 2;
  const hd = depth / 2;
  return [
    [cx - ux * hl - nx * hd, cy - uy * hl - ny * hd],
    [cx + ux * hl - nx * hd, cy + uy * hl - ny * hd],
    [cx + ux * hl + nx * hd, cy + uy * hl + ny * hd],
    [cx - ux * hl + nx * hd, cy - uy * hl + ny * hd],
  ];
}

const middleOf = (quad: Quad): XY => [(quad[0][0] + quad[2][0]) / 2, (quad[0][1] + quad[2][1]) / 2];

/** Whether two convex quads overlap, by the separating axis test, with a small gap kept between them. */
function overlap(p: Quad, q: Quad, gap: number): boolean {
  for (const shape of [p, q]) {
    for (let index = 0; index < 4; index += 1) {
      const a = shape[index] ?? [0, 0];
      const b = shape[(index + 1) % 4] ?? a;
      const ax = -(b[1] - a[1]);
      const ay = b[0] - a[0];
      const length = Math.hypot(ax, ay) || 1;
      let pl = Infinity;
      let ph = -Infinity;
      for (const [x, y] of p) {
        const value = (x * ax + y * ay) / length;
        pl = Math.min(pl, value);
        ph = Math.max(ph, value);
      }
      let ql = Infinity;
      let qh = -Infinity;
      for (const [x, y] of q) {
        const value = (x * ax + y * ay) / length;
        ql = Math.min(ql, value);
        qh = Math.max(qh, value);
      }
      if (ph + gap <= ql || qh + gap <= pl) return false;
    }
  }
  return true;
}

/** Whether a point is inside one of the parks' ellipses, with a margin. */
function inPark(x: number, y: number, margin: number): boolean {
  return PARKS.some(([px, py, rx, ry]) => {
    const dx = (x - px) / (rx + margin);
    const dy = (y - py) / (ry + margin);
    return dx * dx + dy * dy < 1;
  });
}

/** The square of the grain a point falls in, as its key. */
export const squareKey = (sx: number, sy: number): string => `${String(sx)},${String(sy)}`;

/** A seed of its own for each square and each part of it, so a square's draws never depend on another's. */
function seedOf(seed: number, sx: number, sy: number, part: number): number {
  return (seed ^ Math.imul(sx + 1009, 73856093) ^ Math.imul(sy + 2003, 19349663) ^ Math.imul(part + 7, 83492791)) | 0;
}

/** What the whole paper shares: the roads, the lanes, the block slots by square and the tests of where a block may stand. */
export interface Skeleton {
  roads: { line: Dense; kind: RoadKind; bridge: string | null }[];
  streets: Street[];
  lanes: (readonly [XY, XY])[];
  /** The slots each square lays, by the square of the block's middle, in the one order every square reads them. */
  slots: Map<string, Slot[]>;
  index: SegmentIndex;
  /** The squares of the grain with land in them or water round it, as [sx, sy]. */
  squares: readonly (readonly [number, number])[];
  /** Whether a point is open land: ashore, off the coast and out of the parks. */
  free: (x: number, y: number) => boolean;
  /** Whether a point is within `pad` of a circle kept clear (a place, a name, a landmark, the canoe). */
  cleared: (x: number, y: number, pad: number) => boolean;
  ground: Ground;
}

/** How many steps of work pass between two yields: small, so a slice ends close to its budget. */
const STEP = 24;

/** The skeleton, laid in steps. */
export function* laySkeleton(ground: Ground, tuning: AerialTuning = AERIAL): Generator<undefined, Skeleton> {
  const next = sequence(tuning.seed);
  const between = ([low, high]: readonly [number, number]): number => low + next(high - low + 1);
  const onLand = (x: number, y: number): boolean => ground.land.some((piece) => inside(piece, [Math.round(x), Math.round(y)]));
  const byCoast = (x: number, y: number, reach: number): boolean => ground.land.some((piece) => nearLine([Math.round(x), Math.round(y)], piece, reach, true));
  // The circles kept clear, filed by the squares they reach, so a point looks at a few.
  const CLEAR = 16;
  const circles = new Map<number, (typeof ground.clear)[number][]>();
  for (const circle of ground.clear) {
    const [cx, cy, radius] = circle;
    const reach = radius + 3;
    for (let sx = Math.floor((cx - reach) / CLEAR); sx <= Math.floor((cx + reach) / CLEAR); sx += 1) {
      for (let sy = Math.floor((cy - reach) / CLEAR); sy <= Math.floor((cy + reach) / CLEAR); sy += 1) {
        const key = (sx + 1000) * 10000 + sy + 1000;
        circles.set(key, [...(circles.get(key) ?? []), circle]);
      }
    }
  }
  const cleared = (x: number, y: number, pad: number): boolean =>
    (circles.get((Math.floor(x / CLEAR) + 1000) * 10000 + Math.floor(y / CLEAR) + 1000) ?? []).some(([cx, cy, radius]) => (cx - x) * (cx - x) + (cy - y) * (cy - y) < (radius + pad) * (radius + pad));
  // Squares of the paper wholly inland, clear of the coast and the parks, answer at once; the rest are reckoned exactly.
  const SQUARE = 8;
  const inland = new Map<number, number>();
  const free = (x: number, y: number): boolean => {
    const sx = Math.floor(x / SQUARE);
    const sy = Math.floor(y / SQUARE);
    const key = (sx + 1000) * 10000 + sy + 1000;
    let kind = inland.get(key);
    if (kind === undefined) {
      const mx = sx * SQUARE + SQUARE / 2;
      const my = sy * SQUARE + SQUARE / 2;
      // 2: wholly open land; 0: wholly water, far from the coast; 1: reckoned point by point.
      const ashore = onLand(mx, my);
      kind = byCoast(mx, my, 3 + SQUARE) ? 1 : ashore ? (inPark(mx, my, 2 + SQUARE) ? 1 : 2) : 0;
      inland.set(key, kind);
    }
    if (kind !== 1) return kind === 2;
    return onLand(x, y) && !byCoast(x, y, 3) && !inPark(x, y, 2);
  };

  const roads = ROADS.map((road, index) => ({ line: sampled(road.points), kind: kindOf(road, index), bridge: road.bridge ?? null }));
  yield;
  const streets: Street[] = roads.filter((road) => road.bridge === null).map((road) => ({ line: road.line, sums: sumsOf(road.line), setback: road.kind === "minor" ? 5 : 7, keep: road.kind === "minor" ? 3.5 : 5.5, small: false }));
  const index = segmentIndex(12);
  streets.forEach((street, owner) => index.add(coarse(street.line), street.keep, owner));
  // The bridges keep their water clear, and the bridge's name its line.
  roads.filter((road) => road.bridge !== null).forEach((road) => index.add(coarse(road.line), 6, -2));
  index.add(coarse(sampled(BRIDGE_NAME_PATH)), 4, -2);
  yield;

  // Side lanes: straight, a little off square, off each street at intervals, ending where they meet another street or a lane.
  const lanes: (readonly [XY, XY])[] = [];
  const firstStreets = streets.length;
  let work = 0;
  function* addLanes(street: Street, owner: number, every: readonly [number, number], chance: number, length: readonly [number, number]): Generator<undefined> {
    const step = between(every);
    const total = street.sums[street.sums.length - 1] ?? 0;
    for (let along = 8; along <= total; along += step) {
      const station = stationAt(street.line, street.sums, along);
      if (station === undefined) continue;
      for (const side of [1, -1] as const) {
        if (next(100) >= chance) continue;
        const turn = (next(21) - 10) / 100;
        const nx = -station.uy * side + station.ux * turn;
        const ny = station.ux * side + station.uy * turn;
        const norm = Math.hypot(nx, ny) || 1;
        const dx = nx / norm;
        const dy = ny / norm;
        const want = between(length);
        const begin = street.keep - 1;
        let reached = begin;
        for (let stride = begin; stride <= want; stride += 1.5) {
          const px = station.x + dx * stride;
          const py = station.y + dy * stride;
          if (!free(px, py) || cleared(px, py, 3)) break;
          reached = stride;
          if (stride > begin + 6 && index.near(px, py, 0.5, owner)) break;
        }
        if (reached - begin < 10) continue;
        const from: XY = [station.x + dx * begin, station.y + dy * begin];
        const to: XY = [station.x + dx * reached, station.y + dy * reached];
        lanes.push([from, to]);
        const line: Dense = [
          [from[0], from[1]],
          [to[0], to[1]],
        ];
        const lane: Street = { line, sums: sumsOf(line), setback: 3.4, keep: 1.8, small: true };
        streets.push(lane);
        index.add(line, lane.keep, streets.length - 1);
      }
      work += 1;
      if (work % 8 === 0) yield;
    }
  }
  for (let owner = 0; owner < firstStreets; owner += 1) {
    const street = streets[owner];
    if (street !== undefined) yield* addLanes(street, owner, tuning.laneEvery, tuning.laneIn100, tuning.laneLength);
  }
  // A second rank of lanes across the longer lanes, so the blocks between read as a neighbourhood's grain.
  const firstRank = streets.length;
  for (let owner = firstStreets; owner < firstRank; owner += 1) {
    const lane = streets[owner];
    if (lane === undefined || (lane.sums[1] ?? 0) < 20) continue;
    yield* addLanes(lane, owner, [10, 15], 78, [10, 28]);
  }

  // The block slots along every street and lane, each side, drawn in advance and filed by the square of the block's middle.
  const slots = new Map<string, Slot[]>();
  for (let at = 0; at < streets.length; at += 1) {
    const street = streets[at];
    if (street === undefined) continue;
    const draw = sequence(seedOf(tuning.seed, at, 0, 1));
    const total = street.sums[street.sums.length - 1] ?? 0;
    for (const side of [1, -1] as const) {
      for (let along = 3; along < total - 3; ) {
        const want = street.small ? 5 + draw(6) : 6 + draw(9);
        const deep = street.small ? 4 + draw(3) : 5 + draw(4);
        const rows = [0, 1, 2].map((row) => [draw(100) + row * 15, 3 + draw(4), draw(3)] as const);
        const middle = stationAt(street.line, street.sums, along + want / 2);
        if (middle !== undefined) {
          const out = street.setback + deep / 2;
          const x = middle.x - middle.uy * side * out;
          const y = middle.y + middle.ux * side * out;
          const key = squareKey(Math.floor(x / CELL), Math.floor(y / CELL));
          const slot: Slot = { street: at, side, along, want, deep, rows };
          const list = slots.get(key);
          if (list === undefined) slots.set(key, [slot]);
          else list.push(slot);
        }
        along += want + 1.3 + draw(3) / 2;
      }
    }
    if (at % STEP === 0) yield;
  }

  const [x0, y0, x1, y1] = ground.box;
  const squares: [number, number][] = [];
  for (let sy = Math.floor(y0 / CELL); sy * CELL < y1; sy += 1) for (let sx = Math.floor(x0 / CELL); sx * CELL < x1; sx += 1) squares.push([sx, sy]);
  return { roads, streets, lanes, slots, index, squares, free, cleared, ground };
}

/** The blocks one square lays: along its streets and lanes from its slots, then in the lots between on a lattice. */
export function* layBlocks(skeleton: Skeleton, sx: number, sy: number, tuning: AerialTuning = AERIAL): Generator<undefined, Quad[]> {
  const { free, cleared, index } = skeleton;
  const next = sequence(seedOf(tuning.seed, sx, sy, 2));
  const blocks: Quad[] = [];
  const byCell = new Map<number, Quad[]>();
  const fits = (quad: Quad): boolean => {
    const [cx, cy] = middleOf(quad);
    for (const [x, y] of [...quad, [cx, cy] as const]) if (!free(x, y) || cleared(x, y, 1) || index.near(x, y, 0.6)) return false;
    const kx = Math.floor(cx / 16);
    const ky = Math.floor(cy / 16);
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) for (const other of byCell.get((kx + dx) * 10000 + ky + dy) ?? []) if (overlap(quad, other, 1.2)) return false;
    return true;
  };
  const place = (quad: Quad) => {
    blocks.push(quad);
    const [cx, cy] = middleOf(quad);
    const key = Math.floor(cx / 16) * 10000 + Math.floor(cy / 16);
    const list = byCell.get(key);
    if (list === undefined) byCell.set(key, [quad]);
    else list.push(quad);
  };
  let work = 0;
  for (const slot of skeleton.slots.get(squareKey(sx, sy)) ?? []) {
    const street = skeleton.streets[slot.street];
    if (street === undefined) continue;
    const { want, deep, side } = slot;
    // The block that fits here: the length wanted, else shorter and shallower, down to a small house.
    let laid: { length: number; depth: number; middle: Station } | null = null;
    for (const [length, depth] of [[want, deep], [Math.max(4, want - 3), deep], [Math.max(4, want - 5), Math.max(4, deep - 1)], [4, 4]] as const) {
      const middle = stationAt(street.line, street.sums, slot.along + length / 2);
      if (middle === undefined) break;
      const out = street.setback + depth / 2;
      const front = quadOf(middle.x - middle.uy * side * out, middle.y + middle.ux * side * out, middle.ux, middle.uy, length, depth);
      if (fits(front)) {
        place(front);
        laid = { length, depth, middle };
        break;
      }
    }
    if (laid !== null) {
      const { length, depth, middle } = laid;
      const nx = -middle.uy * side;
      const ny = middle.ux * side;
      // Rows behind the front one, while there is room: a neighbourhood's grain fills back from its street.
      let behind = street.setback + depth + 1.4;
      for (const [roll, back, trim] of slot.rows) {
        if (roll >= 85) break;
        const at = behind + back / 2;
        const quad = quadOf(middle.x + nx * at, middle.y + ny * at, middle.ux, middle.uy, Math.max(4, length - trim), back);
        if (!fits(quad)) break;
        place(quad);
        behind += back + 1.4;
      }
    }
    work += 1;
    if (work % STEP === 0) yield;
  }
  // The lots between: a jittered lattice over the land near the streets, each block turned to its nearest street, so
  // a neighbourhood reads built up between its lanes and not only along them. Land far from any street stays open.
  const LOT = 9;
  const [bx, by] = skeleton.ground.box;
  const startX = bx + Math.ceil((sx * CELL - bx) / LOT) * LOT;
  const startY = by + Math.ceil((sy * CELL - by) / LOT) * LOT;
  for (let y = startY; y < (sy + 1) * CELL; y += LOT) {
    for (let x = startX; x < (sx + 1) * CELL; x += LOT) {
      const px = x + next(5) - 2;
      const py = y + next(5) - 2;
      const length = 5 + next(5);
      const depth = 4 + next(4);
      if (!free(px, py)) continue;
      const toward = index.nearest(px, py, 2);
      if (toward === null) continue;
      const quad = quadOf(px, py, toward[0], toward[1], length, depth);
      if (fits(quad)) place(quad);
    }
    yield;
  }
  return blocks;
}

/** One square of the grain, laid: its paths by kind, and how much it holds. */
export interface Square {
  key: string;
  sx: number;
  sy: number;
  /** The paper the square's drawing reaches, [x0, y0, x1, y1]: a roof or a lane runs a little past its edges. */
  box: readonly [number, number, number, number];
  lanes: string;
  waves: string;
  /** The roofs by colour, in ROOF_KINDS's order. */
  roofs: string[];
  /** The lit windows, shown by the night paint alone. */
  windows: string;
  count: { roofs: number; windows: number };
}

const f = (value: number): string => (Math.round(value * 10) / 10).toString();

/**
 * How a point's roofs are laid, from what the cards show of it: `far`, from 0 on the paper a phone's card shows (so
 * every card is packed whole) to 1 that far again beyond the card's edge and more (the open map's far edges), where
 * roofs thin out; and `coarse`, from 0 to 1, how much larger and fewer its roofs stand, for the far edges and for a
 * card zoomed out (the island's), so they keep their size on its screen.
 */
export function grainAt(x: number, y: number): { far: number; coarse: number } {
  let far = 1;
  let zoom = 0;
  for (const card of CARDS) {
    // A phone's card shows about 175 screen pixels either side of its middle and 307 above and below it.
    const away = Math.max(Math.abs(x - card.centre[0]) / (17500 / card.zoom), Math.abs(y - card.centre[1]) / (30700 / card.zoom));
    const here = Math.min(1, Math.max(0, away - 1) / FADE);
    if (here < far || (here === far && card.zoom > zoom)) {
      far = here;
      zoom = card.zoom;
    }
  }
  return { far, coarse: Math.max(far, Math.min(ZOOMED_OUT, Math.max(0, SHARP / Math.max(1, zoom) - 1))) };
}

/** The most coarse a card's own roofs stand for its zoom alone. */
const ZOOMED_OUT = 0.6;

/** The closest cards' zoom, in screen pixels for a hundred paper units: their roofs keep the size the tuning gives. */
const SHARP = 290;

/** How many of a card's half widths past its edge the roofs take to thin from packed to sparse. */
const FADE = 1.2;

const lerp = ([heart, far]: readonly [number, number], t: number): number => heart + (far - heart) * t;

/** A wave on the water: a small double curl. */
const wave = (x: number, y: number): string => `M${f(x - 6)},${f(y)}q3,-3 6,0t6,0`;

/**
 * One square laid in full: its own blocks and those of the squares round it (laid once and kept by `blocksOf`), the
 * small lots packed into the ground the blocks leave, every block and lot cut into roofs, the lanes whose middles are
 * in it and the waves on its water.
 */
export function* laySquare(skeleton: Skeleton, sx: number, sy: number, blocksOf: (sx: number, sy: number) => Generator<undefined, Quad[]>, tuning: AerialTuning = AERIAL): Generator<undefined, Square> {
  const { free, index, ground } = skeleton;
  const around: Quad[][] = [];
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) around.push(yield* blocksOf(sx + dx, sy + dy));
  const own = around[4] ?? [];
  const byCell = new Map<number, Quad[]>();
  for (const quad of around.flat()) {
    const [cx, cy] = middleOf(quad);
    const key = Math.floor(cx / 16) * 10000 + Math.floor(cy / 16);
    const list = byCell.get(key);
    if (list === undefined) byCell.set(key, [quad]);
    else list.push(quad);
  }
  yield;
  // The infill: small lots on a close lattice, each turned to its nearest street, wherever the ground between the
  // blocks is still open. It fills the circles the blocks keep clear too: the stickers and the names stand over roofs,
  // as a city seen from the air has them. Sized under the lattice's step, so neighbours rarely meet.
  const next = sequence(seedOf(tuning.seed, sx, sy, 3));
  const step = tuning.infill;
  const lots: Quad[] = [];
  const [bx, by] = ground.box;
  const startX = bx + Math.ceil((sx * CELL - bx) / step) * step;
  const startY = by + Math.ceil((sy * CELL - by) / step) * step;
  for (let y = startY; y < (sy + 1) * CELL; y += step) {
    for (let x = startX; x < (sx + 1) * CELL; x += step) {
      // Where the grain is coarse a lot is joined to the next along its row, one lot of two: fewer, larger roofs.
      const joinNext = next(100) < tuning.merged * grainAt(x + step / 2, y).coarse;
      const px = x + (next(5) - 2) / 4 + (joinNext ? step / 2 : 0);
      const py = y + (next(5) - 2) / 4;
      const length = step * (joinNext ? 2 : 1) - 1 + next(10) / 10;
      const depth = step - 1.2 + next(8) / 10;
      if (joinNext) x += step;
      if (!free(px, py)) continue;
      const toward = index.nearest(px, py, 3);
      if (toward === null) continue;
      const quad = quadOf(px, py, toward[0], toward[1], length, depth);
      let clear = true;
      for (const [cx, cy] of [...quad, [px, py] as const]) {
        if (!free(cx, cy) || index.near(cx, cy, -1)) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      const kx = Math.floor(px / 16);
      const ky = Math.floor(py / 16);
      for (let dx = -1; dx <= 1 && clear; dx += 1) for (let dy = -1; dy <= 1 && clear; dy += 1) for (const other of byCell.get((kx + dx) * 10000 + ky + dy) ?? []) if (overlap(quad, other, 0.7)) clear = false;
      if (clear) lots.push(quad);
    }
    yield;
  }

  // The roofs: each block and lot cut into small roofs along its street, each turned a little, coloured from the list.
  const draw = sequence(seedOf(tuning.seed, sx, sy, 4));
  const between = ([low, high]: readonly [number, number]): number => (low + draw(high - low + 1)) / 10;
  const colour = (): number => {
    let roll = draw(100);
    for (let kind = 0; kind < ROOF_WEIGHTS.length; kind += 1) {
      roll -= ROOF_WEIGHTS[kind] ?? 0;
      if (roll < 0) return kind;
    }
    return 0;
  };
  const roofs: string[][] = ROOF_KINDS.map(() => []);
  const windows: string[] = [];
  // The paper the square's drawing reaches: a roof laid from a slot in it, or a lane from its middle, runs past its edges.
  const reach = [sx * CELL, sy * CELL, (sx + 1) * CELL, (sy + 1) * CELL];
  const cover = (x: number, y: number, pad: number): void => {
    reach[0] = Math.min(reach[0] ?? x, x - pad);
    reach[1] = Math.min(reach[1] ?? y, y - pad);
    reach[2] = Math.max(reach[2] ?? x, x + pad);
    reach[3] = Math.max(reach[3] ?? y, y + pad);
  };
  let count = 0;
  let work = 0;
  for (const quad of [...own, ...lots]) {
    const [a, b, , d] = quad;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const depth = Math.hypot(d[0] - a[0], d[1] - a[1]);
    if (length === 0 || depth === 0) continue;
    const ux = (b[0] - a[0]) / length;
    const uy = (b[1] - a[1]) / length;
    const nx = (d[0] - a[0]) / depth;
    const ny = (d[1] - a[1]) / depth;
    // Far from the cards the roofs stand larger, more of them joined and fewer kept: the same packed look in fewer roofs.
    const [mx, my] = middleOf(quad);
    const { far, coarse } = grainAt(mx, my);
    const scale = 1 + ((tuning.grow - 100) / 100) * coarse;
    const joined = lerp(tuning.joined, coarse);
    const kept = lerp(tuning.keep, far);
    const columns = Math.max(1, Math.round(length / (between(tuning.roof) * scale)));
    const rows = Math.max(1, Math.round(depth / (between(tuning.roof) * scale)));
    const across = length / columns;
    const down = depth / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const wide = column + 1 < columns && draw(100) < joined ? 2 : 1;
        const gap = between(tuning.gap);
        const along = (column + wide / 2) * across + (draw(5) - 2) / 10;
        const out = (row + 0.5) * down + (draw(5) - 2) / 10;
        const cx = a[0] + ux * along + nx * out;
        const cy = a[1] + uy * along + ny * out;
        const keep = draw(100) < kept;
        const turn = (draw(tuning.turn * 2 + 1) - tuning.turn) / 100;
        const kind = colour();
        const lit = draw(1000) < tuning.lit;
        column += wide - 1;
        if (!keep) continue;
        const hl = Math.max(0.6, (across * wide - gap) / 2);
        const hd = Math.max(0.6, (down - gap) / 2);
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        const rx = ux * cos - uy * sin;
        const ry = ux * sin + uy * cos;
        const x0 = cx - rx * hl + ry * hd;
        const y0 = cy - ry * hl - rx * hd;
        cover(cx, cy, hl + hd);
        roofs[kind]?.push(`M${f(x0)},${f(y0)}l${f(rx * hl * 2)},${f(ry * hl * 2)}l${f(-ry * hd * 2)},${f(rx * hd * 2)}l${f(-rx * hl * 2)},${f(-ry * hl * 2)}z`);
        count += 1;
        if (lit) windows.push(`M${f(cx + rx * hl * 0.3 - 0.6)},${f(cy + ry * hl * 0.3 - 0.6)}h1.2v1.2h-1.2z`);
      }
    }
    work += 1;
    if (work % STEP === 0) yield;
  }

  // The lanes whose middles are in the square, and the waves on its open water, on a jittered lattice clear of the
  // coast, the roads and every circle kept clear (the lantern canoe's among them).
  const lanes = skeleton.lanes
    .filter(([p, q]) => Math.floor((p[0] + q[0]) / 2 / CELL) === sx && Math.floor((p[1] + q[1]) / 2 / CELL) === sy)
    .map(([p, q]) => {
      cover(p[0], p[1], 3);
      cover(q[0], q[1], 3);
      return `M${f(p[0])},${f(p[1])}L${f(q[0])},${f(q[1])}`;
    })
    .join("");
  const ripple = sequence(seedOf(tuning.seed, sx, sy, 5));
  const waves: string[] = [];
  const onLand = (x: number, y: number): boolean => ground.land.some((piece) => inside(piece, [Math.round(x), Math.round(y)]));
  for (let y = sy * CELL + tuning.waves / 2; y < (sy + 1) * CELL; y += tuning.waves) {
    for (let x = sx * CELL + tuning.waves / 2; x < (sx + 1) * CELL; x += tuning.waves) {
      const px = Math.round(x + ripple(19) - 9);
      const py = Math.round(y + ripple(19) - 9);
      if (onLand(px, py) || ground.land.some((piece) => nearLine([px, py], piece, 7, true))) continue;
      if (ground.roads.some((road) => nearLine([px, py], road.points, road.reach))) continue;
      if (ground.clear.some(([cx, cy, radius]) => (cx - px) * (cx - px) + (cy - py) * (cy - py) < radius * radius)) continue;
      cover(px, py, 8);
      waves.push(wave(px, py));
    }
  }
  return {
    key: squareKey(sx, sy),
    sx,
    sy,
    box: [Math.floor(reach[0] ?? 0), Math.floor(reach[1] ?? 0), Math.ceil(reach[2] ?? 0), Math.ceil(reach[3] ?? 0)],
    lanes,
    waves: waves.join(""),
    roofs: roofs.map((paths) => paths.join("")),
    windows: windows.join(""),
    count: { roofs: count, windows: windows.length },
  };
}
