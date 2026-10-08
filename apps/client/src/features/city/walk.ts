// Tap to walk: the character walks to the spot tapped, along a straight line
// at walking pace, through anything in the way (no collisions at launch). Client state only: no
// command, no turn, nothing the authority hears of (city.md R-CITY-001).

/** Walking pace in metres a second. */
export const WALK_SPEED = 1.4;
/** Closer than this, the character has arrived. */
export const ARRIVED = 0.05;

export interface Walker {
  x: number;
  z: number;
  /** The turn about +Y; zero faces +Z, as every model does. */
  facing: number;
  target: { x: number; z: number } | null;
  /** Metres walked since the walk began, for the stride. */
  walked: number;
}

export function standAt(x: number, z: number, facing: number): Walker {
  return { x, z, facing, target: null, walked: 0 };
}

export function walkTo(walker: Walker, x: number, z: number): Walker {
  return { ...walker, target: { x, z }, walked: 0 };
}

/** The walker after `seconds` more of walking. */
export function stepWalk(walker: Walker, seconds: number): Walker {
  const { target } = walker;
  if (target === null) return walker;
  const dx = target.x - walker.x;
  const dz = target.z - walker.z;
  const left = Math.hypot(dx, dz);
  if (left <= ARRIVED) return { ...walker, x: target.x, z: target.z, target: null };
  const step = Math.min(left, WALK_SPEED * Math.max(0, seconds));
  const arrived = step >= left;
  return {
    x: walker.x + (dx * step) / left,
    z: walker.z + (dz * step) / left,
    facing: Math.atan2(dx, dz),
    target: arrived ? null : target,
    walked: walker.walked + step,
  };
}

/** How far through one stride the walker is, 0 to 1, for the walk pose. */
export function strideOf(walker: Walker, strideMetres = 1.3): number {
  return (walker.walked % strideMetres) / strideMetres;
}
