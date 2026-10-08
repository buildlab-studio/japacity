// The city as the map (docs/rules/world.md R-WORLD-015), as plain numbers before any drawing: where a
// position lands, where the water is, the road grid and its bridges, the plots and what stands on
// them, and the route along the roads from one stop to another. Lagos only for now: the mainland
// above the lagoon, the island below, every stop at the real position content gives its place.

/** Thousandths of a degree, as content keeps positions. */
export interface Position {
  latE3: number;
  lonE3: number;
}

/** A point on the map's ground: x to the east, z to the south, in map units. */
export type XZ = readonly [number, number];

/** One map unit is a hundred metres. */
export const UNIT_M = 100;
const METRES_PER_E3 = 111.32;
/** The middle of the map, between Yaba and Surulere. */
export const CENTRE: Position = { latE3: 6520, lonE3: 3365 };
const COS = Math.cos((CENTRE.latE3 / 1000) * (Math.PI / 180));

export function toXZ(position: Position): XZ {
  return [((position.lonE3 - CENTRE.lonE3) * METRES_PER_E3 * COS) / UNIT_M, (-(position.latE3 - CENTRE.latE3) * METRES_PER_E3) / UNIT_M];
}

/** The edges of the map, in the same thousandths of a degree. */
export const EDGE = { north: 6625, south: 6410, west: 3290, east: 3445 } as const;

const corner = (latE3: number, lonE3: number): XZ => toXZ({ latE3, lonE3 });

/** The ground the map covers: x from west to east, z from north to south. */
export const BOUNDS = (() => {
  const [west, north] = corner(EDGE.north, EDGE.west);
  const [east, south] = corner(EDGE.south, EDGE.east);
  return { west, east, north, south };
})();

/**
 * The water, drawn by hand from the shape of the city: the lagoon east of the mainland, the channel
 * between the mainland and the island, the harbour west of the island, and the sea along the foot.
 * Each ring is [lat, lon] in thousandths of a degree.
 */
/** Past the map's edges, so the water runs on when the view is panned to the edge. */
const BEYOND = { north: 6700, south: 6300, west: 3230, east: 3500 } as const;

const WATER_RINGS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [BEYOND.north, 3420],
    [BEYOND.north, BEYOND.east],
    [6470, BEYOND.east],
    [6466, 3430],
    [6467, 3412],
    [6468, 3398],
    [6467, 3388],
    [6460, 3384],
    [6448, 3383],
    [6436, 3385],
    [6422, 3388],
    [6422, 3372],
    [6440, 3373],
    [6452, 3372],
    [6460, 3368],
    [6462, 3352],
    [6463, 3338],
    [6466, 3330],
    [6470, 3332],
    [6471, 3350],
    [6474, 3366],
    [6477, 3378],
    [6484, 3386],
    [6495, 3390],
    [6510, 3393],
    [6528, 3396],
    [6545, 3400],
    [6560, 3407],
    [6580, 3412],
    [6600, 3415],
    [6625, 3418],
  ],
  [
    [6422, BEYOND.west],
    [6422, BEYOND.east],
    [BEYOND.south, BEYOND.east],
    [BEYOND.south, BEYOND.west],
  ],
];

export const WATER: readonly (readonly XZ[])[] = WATER_RINGS.map((ring) => ring.map(([lat, lon]) => corner(lat, lon)));

function insideRing(ring: readonly XZ[], x: number, z: number): boolean {
  let inside = false;
  for (let index = 0, before = ring.length - 1; index < ring.length; before = index, index += 1) {
    const [xi, zi] = ring[index] ?? [0, 0];
    const [xj, zj] = ring[before] ?? [0, 0];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function isWater(x: number, z: number): boolean {
  return WATER.some((ring) => insideRing(ring, x, z));
}

// The road grid: a road every GRID units, a main road every MAIN lines.
export const GRID = 5;
export const ROAD = 0.7;
export const MAIN_ROAD = 1.3;
const MAIN = 4;

/** The grid's first line on each axis and how many lines there are. */
export const LINES = (() => {
  const x0 = Math.ceil(BOUNDS.west / GRID) * GRID;
  const z0 = Math.ceil(BOUNDS.north / GRID) * GRID;
  return { x0, z0, columns: Math.floor((BOUNDS.east - x0) / GRID) + 1, rows: Math.floor((BOUNDS.south - z0) / GRID) + 1 };
})();

export const nodeX = (column: number): number => LINES.x0 + column * GRID;
export const nodeZ = (row: number): number => LINES.z0 + row * GRID;
const nodeId = (column: number, row: number): number => row * LINES.columns + column;

/** The bridges over the water: a column of the grid between two rows, both ends on land. */
export const BRIDGES: readonly { column: number; from: number; to: number }[] = [
  // The Third Mainland Bridge, along the lagoon's edge from the north down to the island.
  { column: Math.round((40 - LINES.x0) / GRID), from: Math.round((-35 - LINES.z0) / GRID), to: Math.round((60 - LINES.z0) / GRID) },
  // The bridge from Ebute Metta across the channel to the island.
  { column: Math.round((25 - LINES.x0) / GRID), from: Math.round((30 - LINES.z0) / GRID), to: Math.round((65 - LINES.z0) / GRID) },
];

function onBridge(column: number, row: number, nextRow: number): boolean {
  return BRIDGES.some((bridge) => bridge.column === column && Math.min(row, nextRow) >= bridge.from && Math.max(row, nextRow) <= bridge.to);
}

/** A stretch of road: from one point to another along one axis, its width, and whether it is a bridge. */
export interface Road {
  from: XZ;
  to: XZ;
  width: number;
  bridge: boolean;
}

/** Whether the segment of road between two neighbouring nodes is there: on land at both ends and the middle, or on a bridge. */
function segmentOpen(column: number, row: number, nextColumn: number, nextRow: number): boolean {
  if (column === nextColumn && onBridge(column, row, nextRow)) return true;
  const ax = nodeX(column);
  const az = nodeZ(row);
  const bx = nodeX(nextColumn);
  const bz = nodeZ(nextRow);
  return !isWater(ax, az) && !isWater(bx, bz) && !isWater((ax + bx) / 2, (az + bz) / 2);
}

export interface Grid {
  roads: Road[];
  /** For each node, the nodes a road joins it to. */
  links: number[][];
}

/** The roads of the grid, joined into runs along each line, and the links between nodes for routes. */
export function buildGrid(): Grid {
  const links: number[][] = Array.from({ length: LINES.columns * LINES.rows }, () => []);
  const roads: Road[] = [];
  const join = (a: number, b: number): void => {
    links[a]?.push(b);
    links[b]?.push(a);
  };
  // Along each row (east and west), then each column (north and south).
  for (let row = 0; row < LINES.rows; row += 1) {
    let start: number | null = null;
    const width = row % MAIN === 0 ? MAIN_ROAD : ROAD;
    for (let column = 0; column < LINES.columns; column += 1) {
      const open = column + 1 < LINES.columns && segmentOpen(column, row, column + 1, row);
      if (open) {
        join(nodeId(column, row), nodeId(column + 1, row));
        start ??= column;
      } else if (start !== null) {
        roads.push({ from: [nodeX(start), nodeZ(row)], to: [nodeX(column), nodeZ(row)], width, bridge: false });
        start = null;
      }
    }
  }
  for (let column = 0; column < LINES.columns; column += 1) {
    let start: number | null = null;
    let bridge = false;
    const width = column % MAIN === 0 ? MAIN_ROAD : ROAD;
    const close = (row: number): void => {
      if (start === null) return;
      roads.push({ from: [nodeX(column), nodeZ(start)], to: [nodeX(column), nodeZ(row)], width: bridge ? MAIN_ROAD : width, bridge });
      start = null;
    };
    for (let row = 0; row < LINES.rows; row += 1) {
      const open = row + 1 < LINES.rows && segmentOpen(column, row, column, row + 1);
      const isBridge = open && onBridge(column, row, row + 1);
      // A bridge is its own stretch, so it can stand above the water.
      if (start !== null && (!open || isBridge !== bridge)) close(row);
      if (open) {
        join(nodeId(column, row), nodeId(column, row + 1));
        if (start === null) {
          start = row;
          bridge = isBridge;
        }
      }
    }
  }
  return { roads, links };
}

/** The node with a road nearest a point. */
export function nearestNode(grid: Grid, [x, z]: XZ): number {
  let best = -1;
  let bestDistance = Infinity;
  for (let id = 0; id < grid.links.length; id += 1) {
    if ((grid.links[id]?.length ?? 0) === 0) continue;
    const column = id % LINES.columns;
    const row = Math.floor(id / LINES.columns);
    const distance = Math.hypot(nodeX(column) - x, nodeZ(row) - z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = id;
    }
  }
  return best;
}

export function nodePoint(id: number): XZ {
  return [nodeX(id % LINES.columns), nodeZ(Math.floor(id / LINES.columns))];
}

/** A turn costs a little, so a route keeps to one road while it can, as a driver does. */
const TURN_COST = 0.4;

/**
 * The route along the roads from one point to another: from the first point to its nearest road,
 * along the grid by the fewest blocks and turns, and off the road to the second point. The first
 * and last points are the two given.
 */
export function routeBetween(grid: Grid, from: XZ, to: XZ): XZ[] {
  const start = nearestNode(grid, from);
  const end = nearestNode(grid, to);
  if (start < 0 || end < 0) return [from, to];
  // Cheapest path over (node, heading) with a small cost for each turn.
  const headings = 5;
  const cost = new Float64Array(grid.links.length * headings).fill(Infinity);
  const back = new Int32Array(grid.links.length * headings).fill(-1);
  const queue: [number, number][] = [];
  const push = (state: number, value: number): void => {
    queue.push([value, state]);
    let at = queue.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if ((queue[parent]?.[0] ?? 0) <= value) break;
      [queue[at], queue[parent]] = [queue[parent] ?? [0, 0], queue[at] ?? [0, 0]];
      at = parent;
    }
  };
  const pop = (): [number, number] | undefined => {
    const top = queue[0];
    const last = queue.pop();
    if (queue.length > 0 && last !== undefined) {
      queue[0] = last;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let small = at;
        if ((queue[left]?.[0] ?? Infinity) < (queue[small]?.[0] ?? Infinity)) small = left;
        if ((queue[right]?.[0] ?? Infinity) < (queue[small]?.[0] ?? Infinity)) small = right;
        if (small === at) break;
        [queue[at], queue[small]] = [queue[small] ?? [0, 0], queue[at] ?? [0, 0]];
        at = small;
      }
    }
    return top;
  };
  const headingOf = (a: number, b: number): number => {
    const step = b - a;
    if (step === 1) return 1;
    if (step === -1) return 2;
    return step > 0 ? 3 : 4;
  };
  const first = start * headings;
  cost[first] = 0;
  push(first, 0);
  let reached = -1;
  for (let next = pop(); next !== undefined; next = pop()) {
    const [value, state] = next;
    if (value > (cost[state] ?? Infinity)) continue;
    const node = Math.floor(state / headings);
    const heading = state % headings;
    if (node === end) {
      reached = state;
      break;
    }
    for (const neighbour of grid.links[node] ?? []) {
      const turn = headingOf(node, neighbour);
      const step = value + 1 + (heading !== 0 && turn !== heading ? TURN_COST : 0);
      const target = neighbour * headings + turn;
      if (step < (cost[target] ?? Infinity)) {
        cost[target] = step;
        back[target] = state;
        push(target, step);
      }
    }
  }
  if (reached < 0) return [from, to];
  const nodes: number[] = [];
  for (let state = reached; state >= 0; state = back[state] ?? -1) nodes.push(Math.floor(state / headings));
  nodes.reverse();
  // Only the corners matter for drawing: drop the nodes in the middle of a straight run.
  const corners = nodes.filter((node, index) => {
    const before = nodes[index - 1];
    const after = nodes[index + 1];
    return before === undefined || after === undefined || headingOf(before, node) !== headingOf(node, after);
  });
  return [from, ...corners.map(nodePoint), to];
}

/** The length of a route in map units. */
export function routeLength(route: readonly XZ[]): number {
  let length = 0;
  for (let index = 1; index < route.length; index += 1) {
    const [ax, az] = route[index - 1] ?? [0, 0];
    const [bx, bz] = route[index] ?? [0, 0];
    length += Math.hypot(bx - ax, bz - az);
  }
  return length;
}

/** The point a share of the way along a route, from 0 at its start to 1 at its end. */
export function pointAlong(route: readonly XZ[], share: number): XZ {
  const total = routeLength(route);
  let left = Math.max(0, Math.min(1, share)) * total;
  for (let index = 1; index < route.length; index += 1) {
    const a = route[index - 1] ?? [0, 0];
    const b = route[index] ?? [0, 0];
    const piece = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= piece && piece > 0) return [a[0] + ((b[0] - a[0]) * left) / piece, a[1] + ((b[1] - a[1]) * left) / piece];
    left -= piece;
  }
  return route[route.length - 1] ?? [0, 0];
}

/** A plain deterministic sequence, so the city is the same every time the map opens. */
export function sequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** The four colours a roof can be from above, each one draw call. */
export const ROOF_GROUPS = ["rust", "zinc", "tile", "slab"] as const;
export type RoofGroup = (typeof ROOF_GROUPS)[number];

export interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  group: RoofGroup;
}

export interface Tree {
  x: number;
  z: number;
  size: number;
}

export interface Plots {
  /** The middle of each plot between the roads. */
  plots: XZ[];
  buildings: Building[];
  trees: Tree[];
}

/** Where the towers stand: the island's business streets and Victoria Island. */
function towerShare(x: number, z: number): number {
  return z > 58 && x > 18 ? 0.35 : 0;
}

/**
 * The plots between the roads and what stands on each: a few buildings on lots of their own, or
 * trees, or nothing. Plots stay clear round each stop, so a board is never inside a building, and
 * under each district's name, so it reads on open ground.
 */
export function buildPlots(clear: readonly XZ[], clearRadius = 3, open: readonly { at: XZ; half: XZ }[] = []): Plots {
  const next = sequence(20261008);
  const plots: XZ[] = [];
  const buildings: Building[] = [];
  const trees: Tree[] = [];
  const inner = GRID - MAIN_ROAD;
  const lot = inner / 2;
  for (let row = 0; row + 1 < LINES.rows; row += 1) {
    for (let column = 0; column + 1 < LINES.columns; column += 1) {
      const x0 = nodeX(column);
      const z0 = nodeZ(row);
      const corners: XZ[] = [
        [x0, z0],
        [x0 + GRID, z0],
        [x0, z0 + GRID],
        [x0 + GRID, z0 + GRID],
      ];
      if (corners.some(([x, z]) => isWater(x, z))) continue;
      const middle: XZ = [x0 + GRID / 2, z0 + GRID / 2];
      plots.push(middle);
      for (let lx = 0; lx < 2; lx += 1) {
        for (let lz = 0; lz < 2; lz += 1) {
          const cx = x0 + MAIN_ROAD / 2 + lot * (lx + 0.5);
          const cz = z0 + MAIN_ROAD / 2 + lot * (lz + 0.5);
          const roll = next();
          const shape: readonly [number, number, number, number] = [next(), next(), next(), next()];
          const pickShape = (index: number): number => shape[index % 4] ?? 0.5;
          if (clear.some(([x, z]) => Math.hypot(x - cx, z - cz) < clearRadius)) continue;
          // A district's name is painted on open ground, so nothing stands on it.
          if (open.some(({ at: [x, z], half: [hx, hz] }) => Math.abs(x - cx) < hx + lot / 2 && Math.abs(z - cz) < hz + lot / 2)) continue;
          if (roll < 0.14) {
            const count = 1 + Math.floor(shape[0] * 3);
            for (let tree = 0; tree < count; tree += 1) trees.push({ x: cx + (pickShape(tree + 1) - 0.5) * lot * 0.6, z: cz + (pickShape(tree + 2) - 0.5) * lot * 0.6, size: 0.45 + pickShape(tree) * 0.35 });
            continue;
          }
          if (roll < 0.22) continue;
          const tower = next() < towerShare(cx, cz);
          const group = ROOF_GROUPS[Math.floor(shape[3] * ROOF_GROUPS.length)] ?? "slab";
          buildings.push({
            x: cx + (shape[0] - 0.5) * 0.2,
            z: cz + (shape[1] - 0.5) * 0.2,
            width: lot * (0.62 + shape[2] * 0.3),
            depth: lot * (0.62 + shape[0] * 0.3),
            height: tower ? 1.6 + shape[1] * 2.4 : 0.3 + shape[2] * 0.6,
            group: tower ? "slab" : group,
          });
        }
      }
    }
  }
  return { plots, buildings, trees };
}

/** A district's name painted on the ground, at the middle of the places content puts in it. */
export interface District {
  area: string;
  at: XZ;
}

/** The lagoon's name sits on open water, away from the bridge's stop. */
const LAGOON: Position = { latE3: 6575, lonE3: 3430 };

/** How far a painted name reaches from its middle: half its width and half its depth. */
export const NAME_HALF: XZ = [12, 2.6];
/** Where a name may move to, in turn, to keep clear of the stops' boards and the water. */
const NUDGES: readonly XZ[] = [
  [0, 0],
  [0, 6],
  [0, -6],
  [0, 11],
  [0, -11],
  [8, 6],
  [-8, 6],
  [8, -6],
  [-8, -6],
];

function nameFits([x, z]: XZ, stops: readonly XZ[]): boolean {
  const [hx, hz] = NAME_HALF;
  const corners: XZ[] = [
    [x - hx, z - hz],
    [x + hx, z - hz],
    [x - hx, z + hz],
    [x + hx, z + hz],
  ];
  const onLand = corners.every(([cx, cz]) => !isWater(cx, cz) && cx > BOUNDS.west && cx < BOUNDS.east && cz > BOUNDS.north && cz < BOUNDS.south);
  // A board stands up from its stop and leans back, so it covers the ground a little north of the stop.
  const clear = stops.every(([sx, sz]) => Math.abs(sx - x) > hx + 6 || z - sz > hz + 3 || sz - z > hz + 9);
  return onLand && clear;
}

/**
 * The districts to name: those with words, at the middle of their places' positions on the map,
 * moved a little where a board or the water is in the way, and left out where no spot fits.
 */
export function districts(places: readonly { area: string | null; position: Position | null; where: string }[], named: (area: string) => boolean, stops: readonly XZ[] = []): District[] {
  const sums = new Map<string, { lat: number; lon: number; count: number }>();
  for (const place of places) {
    if (place.where !== "home" || place.area === null || place.position === null || place.area === "lagos-lagoon" || !named(place.area)) continue;
    const sum = sums.get(place.area) ?? { lat: 0, lon: 0, count: 0 };
    sum.lat += place.position.latE3;
    sum.lon += place.position.lonE3;
    sum.count += 1;
    sums.set(place.area, sum);
  }
  const placed: District[] = [];
  for (const [area, sum] of sums) {
    const [x, z] = toXZ({ latE3: sum.lat / sum.count, lonE3: sum.lon / sum.count });
    const spot = NUDGES.map(([dx, dz]): XZ => [x + dx, z + dz]).find((at) => nameFits(at, stops) && placed.every((other) => Math.abs(other.at[0] - at[0]) > NAME_HALF[0] * 2 || Math.abs(other.at[1] - at[1]) > NAME_HALF[1] * 2 + 1));
    if (spot !== undefined) placed.push({ area, at: spot });
  }
  return named("lagos-lagoon") ? [...placed, { area: "lagos-lagoon", at: toXZ(LAGOON) }] : placed;
}
