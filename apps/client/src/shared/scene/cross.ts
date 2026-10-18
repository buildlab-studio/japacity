// Someone crossing at the stop (an act with `to`, placeFile.ts): from their spot to the far side at
// walking pace, a wait there, and back, read off the place's one clock. Pure: the crowd's one update
// asks where each crosser is at the clock's time; nobody keeps a loop or a clock of their own.

/** Seconds a crosser waits at each side before walking back. */
export const CROSS_WAIT = 3;
/** Metres of one full stride, as the player's own walk. */
const STRIDE = 1.3;

export interface Pace {
  x: number;
  z: number;
  /** The turn about +Y; zero faces +Z, as every model does. */
  facing: number;
  /** How far through one stride, 0 to 1, while walking. */
  stride: number;
  walking: boolean;
}

/**
 * Where a crosser is `time` seconds into the place's clock: `phase` seconds along their own round so
 * no two cross together, walking at `speed` metres a second.
 */
export function crossAt(from: readonly [number, number], to: readonly [number, number], time: number, speed: number, phase = 0): Pace {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const leg = length / Math.max(speed, 0.01);
  const round = 2 * (leg + CROSS_WAIT);
  const into = (((time + phase) % round) + round) % round;
  const out = Math.atan2(dx, dz);
  const back = Math.atan2(-dx, -dz);
  const along = (share: number, facing: number, walked: number): Pace => ({
    x: from[0] + dx * share,
    z: from[1] + dz * share,
    facing,
    stride: (walked % STRIDE) / STRIDE,
    walking: true,
  });
  if (into < leg) return along(into / leg, out, into * speed);
  if (into < leg + CROSS_WAIT) return { x: to[0], z: to[1], facing: back, stride: 0, walking: false };
  if (into < 2 * leg + CROSS_WAIT) {
    const returned = into - leg - CROSS_WAIT;
    return along(1 - returned / leg, back, returned * speed);
  }
  return { x: from[0], z: from[1], facing: out, stride: 0, walking: false };
}
