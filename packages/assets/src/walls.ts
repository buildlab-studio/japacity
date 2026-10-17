// A wide home's outer walls in pairs (turning the house): each side of the house and its yard is
// built twice, full height with the wall things and knee-high, as named parts of the one shell, so the view can turn a
// quarter at a time and always look over the near walls at the far ones standing full. The builder, the stage, the
// build check and the city read the same names from here.

/** The sides of a home in the place's own frame: the back at -z, the left at -x, the front at +z, the right at +x. */
export const WALL_SIDES = ["back", "left", "front", "right"] as const;
export type WallSide = (typeof WALL_SIDES)[number];
export type WallState = "full" | "low";

/** A pair's node in the shell: `wall_<side>_full` or `wall_<side>_low`. */
export function wallNode(side: WallSide, state: WallState): string {
  return `wall_${side}_${state}`;
}

const WALL_NODE = /^wall_(back|left|front|right)_(full|low)$/;

/** The side and the state a node of a pair names, or null for any other node. */
export function wallOf(name: string): { side: WallSide; state: WallState } | null {
  const match = WALL_NODE.exec(name);
  if (match === null) return null;
  return { side: match[1] as WallSide, state: match[2] as WallState };
}

/** How many sides carry both their full and their knee-high wall among these node names: one of each pair shows at a time. */
export function wallPairs(names: Iterable<string>): number {
  const seen = new Set<string>();
  for (const name of names) {
    const wall = wallOf(name);
    if (wall !== null) seen.add(`${wall.side}:${wall.state}`);
  }
  return WALL_SIDES.filter((side) => seen.has(`${side}:full`) && seen.has(`${side}:low`)).length;
}

/** A whole number of quarters of a turn, from 0 to 3, for a yaw in degrees (0 looks along +z). */
export function quarterOf(yaw: number): 0 | 1 | 2 | 3 {
  return ((((Math.round(yaw / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3);
}

/** The side a view looking along `quarter` quarters faces: 0 looks at the front, 1 the right, 2 the back, 3 the left. */
const FACING: readonly WallSide[] = ["front", "right", "back", "left"];

/**
 * The two sides that stand full for a view at rest on a quarter: the one it looks at and the one on its left hand, the far
 * pair; the other two, the one behind the camera and the one on its right, are knee-high. A view looking along the
 * home's length (180 degrees, the whole house) has the back and the left full.
 */
export function fullSides(quarter: number): readonly [WallSide, WallSide] {
  const q = quarterOf(quarter * 90);
  return [FACING[q] ?? "back", FACING[(q + 1) % 4] ?? "left"];
}
