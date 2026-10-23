// The figure on the plinth (prologue:front-door-builds-a-person): it turns slowly by itself, a
// finger drags it round, and let go it coasts back into its slow turn. Shared by the gate, which hears the finger,
// and the scene, which turns the figure each frame.

/** Turned by the finger since the last frame, and whether a finger is down. */
export interface Spin {
  dragging: boolean;
  /** Radians the finger turned since the last frame. */
  pending: number;
  /** Where the finger was, along the screen. */
  last: number;
}

/** Radians a pixel of drag turns the figure. */
export const DRAG_TURN = 0.012;
/** The slow turn, radians a second. */
export const SLOW_TURN = 0.45;
/** How quickly a coasting figure settles back into its slow turn, a share a second. */
const SETTLE = 2.5;

/**
 * One frame of the turn: the new angle and speed from the old, the finger's pull and the frame's length in seconds. Under Reduce Motion
 * (`still`) nothing turns on its own (world:reach-and-read): no slow turn and no coasting, only the finger's drag.
 */
export function turnFrame(spin: Spin, angle: number, speed: number, delta: number, still = false): { angle: number; speed: number } {
  if (spin.dragging) {
    const pulled = spin.pending;
    spin.pending = 0;
    return { angle: angle + pulled, speed: pulled / Math.max(delta, 1 / 120) };
  }
  if (still) return { angle, speed: 0 };
  const settled = speed + (SLOW_TURN - speed) * Math.min(1, delta * SETTLE);
  return { angle: angle + settled * delta, speed: settled };
}
