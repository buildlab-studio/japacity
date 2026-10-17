// The one clock and the one wind every moving thing in the city reads. Shaders read them as uniforms; the scene moves them once a frame and nothing else
// runs a loop of its own for a flag, the water or the smoke.
import { Vector2 } from "three";

export interface MotionUniforms {
  [name: string]: { value: unknown };
  /** Seconds since the city opened. */
  uTime: { value: number };
  /** The direction the wind blows across the ground, x and z, of length one. */
  uWind: { value: Vector2 };
}

export const motionUniforms: MotionUniforms = {
  uTime: { value: 0 },
  uWind: { value: new Vector2(1, 0.3).normalize() },
};

/** Moves the clock on. A frame longer than a quarter second (a tab in the background) counts as one. */
export function advanceClock(seconds: number, uniforms: MotionUniforms = motionUniforms): number {
  uniforms.uTime.value += Math.min(seconds, 0.25);
  return uniforms.uTime.value;
}
