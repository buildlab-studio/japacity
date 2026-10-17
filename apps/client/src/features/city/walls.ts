// The walls follow the view: a wide home's shell carries each outer side twice,
// full and knee-high (`wall_<side>_full`, `wall_<side>_low`, packages/assets walls.ts). The scene shows the far pair full
// and the near pair low for the way the view looks: at rest on a quarter, the side it looks at and the one on its left;
// on the way round, the two sides that face away from the camera, so a wall that rises always rises behind the rooms and
// never in front of them. A hidden wall costs no draw call and takes no tap.
import { fullSides, quarterOf, wallOf, type WallSide } from "@japacity/assets";
import type { Object3D } from "three";

/** The parts of a shell's pairs, by side. */
export type WallParts = ReadonlyMap<WallSide, { full: readonly Object3D[]; low: readonly Object3D[] }>;

/**
 * Degrees past its own stretch of the circle the pair shown on the way round is kept, so a finger moving to and fro across
 * a quarter does not swap the side walls at every crossing; a side wall that far round still stands almost edge on.
 */
export const WALL_SLACK = 20;

/** The pairs of a place's shell among `root`'s meshes, each part made to take no tap while it is hidden. */
export function wallsOf(root: Object3D): WallParts {
  const parts = new Map<WallSide, { full: Object3D[]; low: Object3D[] }>();
  root.traverse((object) => {
    const wall = wallOf(object.name);
    if (wall === null || !(object as { isMesh?: boolean }).isMesh) return;
    const side = parts.get(wall.side) ?? { full: [], low: [] };
    side[wall.state].push(object);
    parts.set(wall.side, side);
    const raycast = object.raycast.bind(object);
    object.raycast = (raycaster, hits) => {
      if (object.visible) raycast(raycaster, hits);
    };
  });
  // A side with one of its two parts only is no pair: it stands as built.
  for (const [side, { full, low }] of parts) if (full.length === 0 || low.length === 0) parts.delete(side);
  return parts;
}

/**
 * Which quarter's pair stands full for a view looking along `yaw` degrees (0 looks along +z): at rest, the quarter it rests
 * on; on the way round, the pair `shown` while the view is still within WALL_SLACK of that pair's stretch (from its
 * quarter a quarter on), else the pair of the stretch the view is in, whose two sides both face away from the camera.
 */
export function wallsQuarter(yaw: number, shown: number, resting: boolean): 0 | 1 | 2 | 3 {
  if (resting) return quarterOf(yaw);
  const y = ((yaw % 360) + 360) % 360;
  const past = (((y - quarterOf(shown * 90) * 90) % 360) + 360) % 360;
  if (past <= 90 + WALL_SLACK || past >= 360 - WALL_SLACK) return quarterOf(shown * 90);
  return quarterOf(Math.floor(y / 90) * 90);
}

/** Shows the pair for `quarter`: its two sides full, the other two knee-high. */
export function showWalls(parts: WallParts, quarter: number): void {
  const full = new Set<WallSide>(fullSides(quarter));
  for (const [side, { full: high, low }] of parts) {
    for (const object of high) object.visible = full.has(side);
    for (const object of low) object.visible = !full.has(side);
  }
}
