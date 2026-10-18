// Buy mode's floor rule: a thing you own set down in a home of your
// own fits where its footprint lies wholly on the walkable floor, clear of every other model's footprint (the house's
// walls, the bed, the drum, the other things you own), of the door you come in by and of where people stand and walk
// to a thing. A spot that does not fit shakes the thing back. Pure: the scene asks it as the finger lifts.
import { type Footprint, inPolygon, type PlacedBox, placeFootprint } from "@japacity/assets";

import type { Spot, Stage } from "../../../shared/scene/placeFile";

/** How far a thing keeps from the door's spot, a person's spot and the spot a thing is walked to, in metres. */
const KEEP_CLEAR = 0.2;
/** A quarter turn, the turn a tap gives a lifted thing. */
export const QUARTER = Math.PI / 2;

/** The four corners of a placed box: its centre, out along its width and its depth (the city's turn about +Y). */
function cornersOf(box: PlacedBox): [number, number][] {
  const ux = box.cos * box.halfWidth;
  const uz = -box.sin * box.halfWidth;
  const vx = box.sin * box.halfDepth;
  const vz = box.cos * box.halfDepth;
  return [
    [box.x + ux + vx, box.z + uz + vz],
    [box.x + ux - vx, box.z + uz - vz],
    [box.x - ux - vx, box.z - uz - vz],
    [box.x - ux + vx, box.z - uz + vz],
  ];
}

/** Two placed boxes overlap: no axis of either separates them (the separating axis test for two rectangles). */
export function boxesOverlap(a: PlacedBox, b: PlacedBox): boolean {
  const axes: [number, number][] = [
    [a.cos, -a.sin],
    [a.sin, a.cos],
    [b.cos, -b.sin],
    [b.sin, b.cos],
  ];
  const ca = cornersOf(a);
  const cb = cornersOf(b);
  return axes.every(([ax, az]) => {
    const pa = ca.map(([x, z]) => x * ax + z * az);
    const pb = cb.map(([x, z]) => x * ax + z * az);
    // Touching is not overlapping: a wardrobe may stand flush against a wall.
    return Math.min(...pa) < Math.max(...pb) - 1e-6 && Math.min(...pb) < Math.max(...pa) - 1e-6;
  });
}

/** Whether a point lies within `clear` metres of a placed box. */
function nearBox(box: PlacedBox, x: number, z: number, clear: number): boolean {
  const dx = x - box.x;
  const dz = z - box.z;
  const along = dx * box.cos - dz * box.sin;
  const across = dx * box.sin + dz * box.cos;
  return Math.abs(along) <= box.halfWidth + clear && Math.abs(across) <= box.halfDepth + clear;
}

/** Why a spot does not fit, or null when it does: off the floor, on another thing, or in someone's way. */
export type Misfit = "floor" | "thing" | "way" | null;

/**
 * Whether the owned thing `thing` (model `file`) fits at `spot` in the staged place: every corner of its footprint on
 * the walkable floor, its footprint clear of every other model's (its own entry left out), and clear of the door's
 * spot, the people's spots and the spots things are walked to. A thing with no footprint fits anywhere on the floor.
 */
export function misfit(stage: Pick<Stage, "models" | "walkable" | "start" | "people" | "things">, thing: string, file: string, spot: Spot, footprintOf: (file: string) => Footprint | null): Misfit {
  const own = footprintOf(file);
  const boxes = own === null || own === "none" ? [] : placeFootprint(own, spot);
  const walkable = stage.walkable ?? [];
  const onFloor = (x: number, z: number): boolean => walkable.length === 0 || walkable.some((polygon) => inPolygon(polygon, x, z));
  if (boxes.length === 0 ? !onFloor(spot[0], spot[1]) : !boxes.every((box) => cornersOf(box).every(([x, z]) => onFloor(x, z)))) return "floor";
  for (const model of stage.models) {
    if (model.owned === thing) continue;
    const other = footprintOf(model.file);
    if (other === null || other === "none") continue;
    for (const at of model.at) {
      const theirs = placeFootprint(other, at);
      if (boxes.some((box) => theirs.some((their) => boxesOverlap(box, their)))) return "thing";
    }
  }
  const ways: [number, number][] = [[stage.start[0], stage.start[1]], ...stage.people.map((at): [number, number] => [at[0], at[1]]), ...(stage.things ?? []).flatMap((one) => (one.at === undefined ? [] : [one.at]))];
  if (boxes.some((box) => ways.some(([x, z]) => nearBox(box, x, z, KEEP_CLEAR)))) return "way";
  return null;
}

/** The spot a quarter turn gives: the same place, turned a quarter, the turn kept within one whole turn. */
export function turned(spot: Spot): Spot {
  const next = spot[2] + QUARTER;
  return [spot[0], spot[1], next >= Math.PI * 2 - 1e-6 ? next - Math.PI * 2 : next];
}
