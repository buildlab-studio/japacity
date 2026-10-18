// The place's route map (city.md R-CITY-030, assets.md R-ASSET-030): a grid of 25 cm cells over the
// place's walkable ground, built once on entering from the walkable polygons and every model's
// footprint and nothing else. A cell is hard where no one may stand (off the walkable ground, or under
// a footprint), near where it lies within the walker's clearance of a footprint, and free otherwise;
// routes run over free cells only. Free cells are labelled by the part of the ground they belong to,
// so a route never searches for a goal it cannot reach. Plain numbers: no drawing, no browser.
import { boxBounds, type Footprint, inBox, inPolygon, placeFootprint, type WalkablePolygon } from "@japacity/assets";

import type { Stage } from "../placeFile";

/** One cell's side in metres. */
export const CELL = 0.25;
/** How far a walker keeps from any footprint: tuning.city.stopShortMm, so a walk stops that far short of a thing. */
export const CLEARANCE = 0.3;

export const FREE = 0;
const NEAR = 1;
export const HARD = 2;

export interface Point {
  x: number;
  z: number;
}

export interface RouteMap {
  /** The place-frame corner of cell 0. */
  x0: number;
  z0: number;
  nx: number;
  nz: number;
  /** FREE, NEAR or HARD for each cell, row by row along x. */
  cells: Uint8Array;
  /** The part of the ground each free cell belongs to, or -1. */
  part: Int32Array;
  /** Working space for the route search, kept with the map so a tap allocates nothing. */
  search: { cost: Float32Array; came: Int32Array; seen: Uint32Array; closed: Uint32Array; round: number; heapCell: number[]; heapCost: number[] };
}

/** The walkable ground of a stage, or its whole ground for a place staged before walkable ground was recorded. */
export function walkableOf(stage: Pick<Stage, "ground" | "walkable">): WalkablePolygon[] {
  if (stage.walkable !== undefined && stage.walkable.length > 0) return stage.walkable;
  const [width, depth] = stage.ground.size;
  return [[[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]]];
}

function cellX(map: RouteMap, x: number): number {
  return Math.floor((x - map.x0) / CELL);
}

function cellZ(map: RouteMap, z: number): number {
  return Math.floor((z - map.z0) / CELL);
}

/** The cell a point falls in, or -1 off the map. */
export function cellOf(map: RouteMap, x: number, z: number): number {
  const ix = cellX(map, x);
  const iz = cellZ(map, z);
  return ix < 0 || iz < 0 || ix >= map.nx || iz >= map.nz ? -1 : iz * map.nx + ix;
}

export function centreOf(map: RouteMap, cell: number): Point {
  return { x: map.x0 + ((cell % map.nx) + 0.5) * CELL, z: map.z0 + (Math.floor(cell / map.nx) + 0.5) * CELL };
}

/** What a point stands on: FREE, NEAR, or HARD off the map. */
export function groundAt(map: RouteMap, x: number, z: number): number {
  const cell = cellOf(map, x, z);
  return cell < 0 ? HARD : (map.cells[cell] ?? HARD);
}

/**
 * The route map of a stage: its walkable ground less every footprint of its models, each grown by
 * the clearance. `footprintOf` gives a model file's footprint, or null when the file carries none.
 */
export function routeMap(stage: Pick<Stage, "ground" | "walkable" | "models">, footprintOf: (file: string) => Footprint | null): RouteMap {
  const walkable = walkableOf(stage);
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const polygon of walkable) {
    for (const [x, z] of polygon) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }
  const nx = Math.max(1, Math.ceil((maxX - minX) / CELL));
  const nz = Math.max(1, Math.ceil((maxZ - minZ) / CELL));
  const count = nx * nz;
  const cells = new Uint8Array(count).fill(HARD);
  const map: RouteMap = {
    x0: minX,
    z0: minZ,
    nx,
    nz,
    cells,
    part: new Int32Array(count).fill(-1),
    search: { cost: new Float32Array(count), came: new Int32Array(count), seen: new Uint32Array(count), closed: new Uint32Array(count), round: 0, heapCell: [], heapCost: [] },
  };
  for (const polygon of walkable) {
    const xs = polygon.map(([x]) => x);
    const zs = polygon.map(([, z]) => z);
    const fromX = Math.max(0, cellX(map, Math.min(...xs)));
    const toX = Math.min(nx - 1, cellX(map, Math.max(...xs)));
    const fromZ = Math.max(0, cellZ(map, Math.min(...zs)));
    const toZ = Math.min(nz - 1, cellZ(map, Math.max(...zs)));
    for (let iz = fromZ; iz <= toZ; iz += 1) {
      const z = minZ + (iz + 0.5) * CELL;
      for (let ix = fromX; ix <= toX; ix += 1) if (inPolygon(polygon, minX + (ix + 0.5) * CELL, z)) cells[iz * nx + ix] = FREE;
    }
  }
  for (const model of stage.models) {
    const footprint = footprintOf(model.file);
    if (footprint === null) continue;
    for (const at of model.at) {
      for (const box of placeFootprint(footprint, at)) {
        const [x0, z0, x1, z1] = boxBounds(box, CLEARANCE);
        const fromX = Math.max(0, cellX(map, x0));
        const toX = Math.min(nx - 1, cellX(map, x1));
        const fromZ = Math.max(0, cellZ(map, z0));
        const toZ = Math.min(nz - 1, cellZ(map, z1));
        for (let iz = fromZ; iz <= toZ; iz += 1) {
          for (let ix = fromX; ix <= toX; ix += 1) {
            const cell = iz * nx + ix;
            if (cells[cell] === HARD) continue;
            const { x, z } = centreOf(map, cell);
            if (inBox(box, x, z)) cells[cell] = HARD;
            else if (inBox(box, x, z, CLEARANCE)) cells[cell] = NEAR;
          }
        }
      }
    }
  }
  labelParts(map);
  return map;
}

/** Whether a step from one cell to its neighbour is allowed: onto a free cell, and never across a corner. */
export function canStep(map: RouteMap, x: number, z: number, dx: number, dz: number): boolean {
  const tx = x + dx;
  const tz = z + dz;
  if (tx < 0 || tz < 0 || tx >= map.nx || tz >= map.nz) return false;
  if (map.cells[tz * map.nx + tx] !== FREE) return false;
  return dx === 0 || dz === 0 || (map.cells[z * map.nx + tx] === FREE && map.cells[tz * map.nx + x] === FREE);
}

/** Labels each free cell with its part of the ground, by the same steps a route may take. */
function labelParts(map: RouteMap): void {
  const { cells, part, nx } = map;
  const queue = new Int32Array(cells.length);
  let label = 0;
  for (let seed = 0; seed < cells.length; seed += 1) {
    if (cells[seed] !== FREE || part[seed] !== -1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = seed;
    part[seed] = label;
    while (head < tail) {
      const cell = queue[head++] ?? 0;
      const x = cell % nx;
      const z = Math.floor(cell / nx);
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if ((dx === 0 && dz === 0) || !canStep(map, x, z, dx, dz)) continue;
          const next = (z + dz) * nx + x + dx;
          if (part[next] !== -1) continue;
          part[next] = label;
          queue[tail++] = next;
        }
      }
    }
    label += 1;
  }
}
