// A route round the things in the way (city.md R-CITY-030), with this method: A* over the
// route map's free cells, eight ways and never across a corner, then pulled straight wherever the line
// is clear. A line already clear needs no search, and a goal is only ever sought in the part of the
// ground the walker stands on, so a tap the walker cannot reach costs a ring search and no more.
import { canStep, CELL, cellOf, centreOf, FREE, groundAt, HARD, type Point, type RouteMap } from "./map";

const DIAGONAL = Math.SQRT2;
const TIE = 1.001;

/** Whether every point along a line, every half cell, stands on a free cell. */
export function clearLine(map: RouteMap, from: Point, to: Point): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / (CELL / 2)));
  for (let step = 0; step <= steps; step += 1) {
    const share = step / steps;
    if (groundAt(map, from.x + (to.x - from.x) * share, from.z + (to.z - from.z) * share) !== FREE) return false;
  }
  return true;
}

/** Whether a line crosses no hard cell: the last short step from a free cell to a spot beside a thing. */
function openLine(map: RouteMap, from: Point, to: Point): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / (CELL / 2)));
  for (let step = 0; step <= steps; step += 1) {
    const share = step / steps;
    if (groundAt(map, from.x + (to.x - from.x) * share, from.z + (to.z - from.z) * share) === HARD) return false;
  }
  return true;
}

/** The free cell nearest a point, searching outward in rings, inside one part of the ground when `part` is given; -1 when there is none. */
export function nearestFree(map: RouteMap, point: Point, part = -1): number {
  const { nx, nz, cells } = map;
  const ix = Math.max(0, Math.min(nx - 1, Math.floor((point.x - map.x0) / CELL)));
  const iz = Math.max(0, Math.min(nz - 1, Math.floor((point.z - map.z0) / CELL)));
  const rings = Math.max(nx, nz);
  for (let ring = 0; ring < rings; ring += 1) {
    let best = -1;
    let bestDistance = Infinity;
    for (let dz = -ring; dz <= ring; dz += 1) {
      const edge = Math.abs(dz) === ring;
      for (let dx = -ring; dx <= ring; dx += edge ? 1 : 2 * ring) {
        const jx = ix + dx;
        const jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        const cell = jz * nx + jx;
        if (cells[cell] !== FREE || (part >= 0 && map.part[cell] !== part)) continue;
        const distance = dx * dx + dz * dz;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = cell;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

function push(map: RouteMap, cell: number, cost: number): void {
  const { heapCell, heapCost } = map.search;
  let at = heapCell.length;
  heapCell.push(cell);
  heapCost.push(cost);
  while (at > 0) {
    const parent = (at - 1) >> 1;
    if ((heapCost[parent] ?? 0) <= cost) break;
    heapCell[at] = heapCell[parent] ?? 0;
    heapCost[at] = heapCost[parent] ?? 0;
    at = parent;
  }
  heapCell[at] = cell;
  heapCost[at] = cost;
}

function pop(map: RouteMap): number {
  const { heapCell, heapCost } = map.search;
  const top = heapCell[0] ?? -1;
  const lastCell = heapCell.pop() ?? 0;
  const lastCost = heapCost.pop() ?? 0;
  const size = heapCell.length;
  if (size === 0) return top;
  let at = 0;
  for (;;) {
    let child = 2 * at + 1;
    if (child >= size) break;
    if (child + 1 < size && (heapCost[child + 1] ?? 0) < (heapCost[child] ?? 0)) child += 1;
    if ((heapCost[child] ?? 0) >= lastCost) break;
    heapCell[at] = heapCell[child] ?? 0;
    heapCost[at] = heapCost[child] ?? 0;
    at = child;
  }
  heapCell[at] = lastCell;
  heapCost[at] = lastCost;
  return top;
}

/** A* from one free cell to another of the same part; the cells of the way, start first. */
function search(map: RouteMap, start: number, goal: number): number[] {
  const { nx } = map;
  const state = map.search;
  state.round += 1;
  const round = state.round;
  state.heapCell.length = 0;
  state.heapCost.length = 0;
  const goalX = goal % nx;
  const goalZ = Math.floor(goal / nx);
  const guess = (cell: number): number => {
    const dx = Math.abs((cell % nx) - goalX);
    const dz = Math.abs(Math.floor(cell / nx) - goalZ);
    // A thousandth over the true distance breaks ties toward the goal, so open ground is not searched cell by cell.
    return (Math.max(dx, dz) + (DIAGONAL - 1) * Math.min(dx, dz)) * TIE;
  };
  state.cost[start] = 0;
  state.came[start] = -1;
  state.seen[start] = round;
  push(map, start, guess(start));
  while (state.heapCell.length > 0) {
    const cell = pop(map);
    if (cell === goal) break;
    if (state.closed[cell] === round) continue;
    state.closed[cell] = round;
    const x = cell % nx;
    const z = Math.floor(cell / nx);
    const here = state.cost[cell] ?? 0;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if ((dx === 0 && dz === 0) || !canStep(map, x, z, dx, dz)) continue;
        const next = (z + dz) * nx + x + dx;
        if (state.closed[next] === round) continue;
        const cost = here + (dx !== 0 && dz !== 0 ? DIAGONAL : 1);
        if (state.seen[next] === round && cost >= (state.cost[next] ?? Infinity)) continue;
        state.seen[next] = round;
        state.cost[next] = cost;
        state.came[next] = cell;
        push(map, next, cost + guess(next));
      }
    }
  }
  if (state.seen[goal] !== round) return [];
  const way: number[] = [];
  for (let cell = goal; cell >= 0; cell = cell === start ? -1 : (state.came[cell] ?? -1)) way.push(cell);
  return way.reverse();
}

/**
 * The waypoints from `from` to `to`, not including `from`. A goal on a thing or off the ground, or in
 * another part of the ground, becomes the nearest free cell the walker can reach. With `exact`, a goal
 * beside a thing (a spot by a stall) is walked to itself when the last short step crosses nothing; a tap
 * there stops at the free cell, the clearance short of the thing. Empty when the walker cannot move.
 */
export function findRoute(map: RouteMap, from: Point, to: Point, exact = false): Point[] {
  const here = cellOf(map, from.x, from.z);
  const start = here >= 0 && map.cells[here] === FREE ? here : nearestFree(map, from);
  if (start < 0) return [];
  const part = map.part[start] ?? -1;
  const there = cellOf(map, to.x, to.z);
  const onGoal = there >= 0 && map.cells[there] === FREE && map.part[there] === part;
  const goal = onGoal ? there : nearestFree(map, to, part);
  if (goal < 0) return [];
  const first = start === here ? from : centreOf(map, start);
  const last = onGoal ? to : centreOf(map, goal);
  const finish = (way: Point[]): Point[] => (exact && !onGoal && groundAt(map, to.x, to.z) !== HARD && openLine(map, last, to) ? [...way, to] : way);
  if (clearLine(map, first, last)) return finish(start === here ? [last] : [first, last]);
  const cells = search(map, start, goal).map((cell) => centreOf(map, cell));
  if (cells.length === 0) return [];
  cells[0] = first;
  cells[cells.length - 1] = last;
  const pulled: Point[] = [cells[0] ?? first];
  for (let at = 0; at < cells.length - 1; ) {
    let next = at + 1;
    while (next + 1 < cells.length && clearLine(map, cells[at] ?? first, cells[next + 1] ?? last)) next += 1;
    pulled.push(cells[next] ?? last);
    at = next;
  }
  return finish(start === here ? pulled.slice(1) : pulled);
}
