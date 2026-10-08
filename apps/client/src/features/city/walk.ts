// Tap to walk (city.md R-CITY-030): the character walks to the spot tapped at walking pace, along a
// route round the things in the way that walk/route.ts finds on the place's route map. Client state
// only: no command, no turn, nothing the authority hears of (city.md R-CITY-001).
import type { Point } from "./walk/map";

/** Walking pace in metres a second: tuning.city.walkMmPerS. */
export const WALK_SPEED = 1.4;
/** Closer than this, the character has arrived. */
export const ARRIVED = 0.05;

export interface Walker {
  x: number;
  z: number;
  /** The turn about +Y; zero faces +Z, as every model does. */
  facing: number;
  /** Where the walk ends, or null while standing. */
  target: Point | null;
  /** The waypoints still ahead, the last of them the target. */
  route: Point[];
  /** Metres walked since the walk began, for the stride. */
  walked: number;
}

export function standAt(x: number, z: number, facing: number): Walker {
  return { x, z, facing, target: null, route: [], walked: 0 };
}

/** The walker set off along a route; an empty route leaves it standing. */
export function walkRoute(walker: Walker, route: readonly Point[]): Walker {
  const target = route[route.length - 1] ?? null;
  return { ...walker, target, route: [...route], walked: 0 };
}

/** The walker set off in a straight line, for open ground with no route map. */
export function walkTo(walker: Walker, x: number, z: number): Walker {
  return walkRoute(walker, [{ x, z }]);
}

/** The walker after `seconds` more of walking, carrying on past each waypoint without losing pace. */
export function stepWalk(walker: Walker, seconds: number, speed = WALK_SPEED): Walker {
  if (walker.target === null) return walker;
  let { x, z, facing, walked } = walker;
  let budget = speed * Math.max(0, seconds);
  const route = [...walker.route];
  while (route.length > 0) {
    const next = route[0] ?? { x, z };
    const dx = next.x - x;
    const dz = next.z - z;
    const left = Math.hypot(dx, dz);
    if (left > ARRIVED) facing = Math.atan2(dx, dz);
    if (left <= budget || left <= ARRIVED) {
      x = next.x;
      z = next.z;
      walked += left;
      budget -= left;
      route.shift();
      continue;
    }
    x += (dx * budget) / left;
    z += (dz * budget) / left;
    walked += budget;
    break;
  }
  return { x, z, facing, target: route.length === 0 ? null : walker.target, route, walked };
}

/** How far through one stride the walker is, 0 to 1, for the walk pose. */
export function strideOf(walker: Pick<Walker, "walked">, strideMetres = 1.3): number {
  return (walker.walked % strideMetres) / strideMetres;
}
