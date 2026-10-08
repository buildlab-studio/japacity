// Footprints and walkable ground (R-ASSET-030). A model records the ground it blocks as boxes in its
// own frame, in its root's extras; a place records the ground people may walk on as polygons in its
// stage. The build check and the client's route map read both through these few plain functions.
import { Box3, type Mesh, type Object3D, Vector3 } from "three";

/** A box of ground a model blocks, in metres in the model's own frame: its centre, its size along x and z, and its turn about +Y. */
export interface FootprintBox {
  x: number;
  z: number;
  width: number;
  depth: number;
  turn?: number;
}

/** The boxes a model blocks, or `none` for a thing people walk under or through (a flag, the water, a person). */
export type Footprint = FootprintBox[] | "none";

/** A polygon of walkable ground, as [x, z] corners in metres in the place's frame. */
export type WalkablePolygon = [number, number][];

/** Parts wholly higher than this pass over people's heads: an awning, an umbrella, a deck. */
export const HEAD_HEIGHT = 2.0;

/** A footprint box placed in a place: its centre, half sizes and the turn's cosine and sine. */
export interface PlacedBox {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  cos: number;
  sin: number;
}

export function isFootprintBox(value: unknown): value is FootprintBox {
  if (typeof value !== "object" || value === null) return false;
  const box = value as Record<string, unknown>;
  const finite = (key: string): boolean => typeof box[key] === "number" && Number.isFinite(box[key]);
  return finite("x") && finite("z") && finite("width") && finite("depth") && (box.width as number) > 0 && (box.depth as number) > 0 && (box.turn === undefined || finite("turn"));
}

export function isFootprint(value: unknown): value is Footprint {
  return value === "none" || (Array.isArray(value) && value.length > 0 && value.every(isFootprintBox));
}

/** Writes a model's footprint where the bake reads it, its root's user data, which becomes the root's extras; to the centimetre. */
export function setFootprint<T extends Object3D>(root: T, footprint: Footprint): T {
  root.userData.footprint =
    footprint === "none"
      ? "none"
      : footprint.map((box) => {
          const rounded: FootprintBox = { x: round(box.x), z: round(box.z), width: round(box.width), depth: round(box.depth) };
          if (box.turn !== undefined && box.turn !== 0) rounded.turn = round(box.turn);
          return rounded;
        });
  return root;
}

/** The footprint a loaded model carries in its root's extras, searching down from the scene the loader gives. */
export function footprintOf(model: Object3D): Footprint | null {
  let found: Footprint | null = null;
  model.traverse((object) => {
    const value = (object.userData as { footprint?: unknown }).footprint;
    if (found === null && isFootprint(value)) found = value;
  });
  return found;
}

/**
 * One box round the plan of every part of a group that reaches lower than `below`, in the root's
 * frame: the ground a simple prop blocks, leaving out what passes overhead.
 */
export function lowBox(root: Object3D, below = HEAD_HEIGHT): FootprintBox {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const bounds = new Box3();
  const part = new Box3();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    if (box === null) return;
    part.copy(box).applyMatrix4(mesh.matrixWorld).applyMatrix4(toRoot);
    if (part.min.y < below) bounds.union(part);
  });
  if (bounds.isEmpty()) throw new Error("lowBox: no part reaches below head height");
  const centre = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  return { x: round(centre.x), z: round(centre.z), width: round(size.x), depth: round(size.z) };
}

/**
 * Boxes written in the frame of a part of a model (a builder's own group before it is turned and
 * centred) carried into the model's root frame, so a builder can name its blocks where it draws them.
 */
export function boxesIn(root: Object3D, inner: Object3D, boxes: readonly FootprintBox[]): FootprintBox[] {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert().multiply(inner.matrixWorld);
  const origin = new Vector3().applyMatrix4(toRoot);
  const along = new Vector3(1, 0, 0).applyMatrix4(toRoot).sub(origin);
  const turn = Math.atan2(-along.z, along.x);
  return boxes.map((box) => {
    const at = new Vector3(box.x, 0, box.z).applyMatrix4(toRoot);
    const own = (box.turn ?? 0) + turn;
    return { x: at.x, z: at.z, width: box.width, depth: box.depth, ...(Math.abs(own) < 1e-6 ? {} : { turn: own }) };
  });
}

/** To the centimetre, so the extras read cleanly. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A model's boxes where one copy stands at x, z turned by `turn` about +Y, as the city instances it. */
export function placeFootprint(footprint: Footprint, at: readonly [number, number, number]): PlacedBox[] {
  if (footprint === "none") return [];
  const [x, z, turn] = at;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return footprint.map((box) => {
    const own = turn + (box.turn ?? 0);
    return { x: x + box.x * cos + box.z * sin, z: z - box.x * sin + box.z * cos, halfWidth: box.width / 2, halfDepth: box.depth / 2, cos: Math.cos(own), sin: Math.sin(own) };
  });
}

/** Whether a point lies inside a placed box grown by `grow` metres on every side. */
export function inBox(box: PlacedBox, x: number, z: number, grow = 0): boolean {
  const dx = x - box.x;
  const dz = z - box.z;
  // Into the box's own frame: the inverse of the turn the city gives the model.
  const along = dx * box.cos - dz * box.sin;
  const across = dx * box.sin + dz * box.cos;
  return Math.abs(along) <= box.halfWidth + grow && Math.abs(across) <= box.halfDepth + grow;
}

/** The plan bounds of a placed box grown by `grow`: min x, min z, max x, max z. */
export function boxBounds(box: PlacedBox, grow = 0): [number, number, number, number] {
  const reachX = Math.abs(box.cos) * (box.halfWidth + grow) + Math.abs(box.sin) * (box.halfDepth + grow);
  const reachZ = Math.abs(box.sin) * (box.halfWidth + grow) + Math.abs(box.cos) * (box.halfDepth + grow);
  return [box.x - reachX, box.z - reachZ, box.x + reachX, box.z + reachZ];
}

/** Whether a point lies inside a polygon, by the even-odd rule. */
export function inPolygon(polygon: readonly (readonly [number, number])[], x: number, z: number): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [ax, az] = polygon[index] ?? [0, 0];
    const [bx, bz] = polygon[previous] ?? [0, 0];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}

/** Whether a point is on any of a place's walkable polygons. */
export function onWalkable(walkable: readonly WalkablePolygon[], x: number, z: number): boolean {
  return walkable.some((polygon) => inPolygon(polygon, x, z));
}

/** A walkable polygon has at least three corners, each a pair of finite numbers. */
export function isWalkable(value: unknown): value is WalkablePolygon[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((polygon) => Array.isArray(polygon) && polygon.length >= 3 && polygon.every((corner) => Array.isArray(corner) && corner.length === 2 && corner.every((side) => typeof side === "number" && Number.isFinite(side))))
  );
}
