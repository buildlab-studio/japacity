// The dress's motion (docs/design/09-the-games-look.md, section 7) at a trailer's scale: a pop with a short overshoot, a sticker's wobble that
// settles, a slide that lands. Every value is read from the frame, so a render is the same every time.
import { interpolate, spring, type SpringConfig } from "remotion";

const BOUNCY: Partial<SpringConfig> = { damping: 12, stiffness: 170, mass: 0.7 };
const FIRM: Partial<SpringConfig> = { damping: 20, stiffness: 160, mass: 0.8 };

/** 0 to 1 with a small overshoot, from `delay` frames on. */
export function pop(frame: number, fps: number, delay = 0): number {
  return spring({ frame: frame - delay, fps, config: BOUNCY });
}

/** 0 to 1 with no overshoot, for a slide that lands. */
export function land(frame: number, fps: number, delay = 0, durationInFrames?: number): number {
  return spring({ frame: frame - delay, fps, config: FIRM, ...(durationInFrames === undefined ? {} : { durationInFrames }) });
}

/** A sticker's tilt as it wobbles in and settles on its own angle. */
export function wobble(frame: number, fps: number, delay: number, tilt: number): number {
  const settle = spring({ frame: frame - delay, fps, config: { damping: 8, stiffness: 140, mass: 0.6 } });
  return tilt + interpolate(settle, [0, 1], [-14, 0]);
}

/** A straight ramp between two frames, held at both ends. */
export function ramp(frame: number, from: number, to: number, a = 0, b = 1): number {
  return interpolate(frame, [from, to], [a, b], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}
