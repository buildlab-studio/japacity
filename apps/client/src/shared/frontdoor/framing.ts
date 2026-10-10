// How the figure on its turntable is framed (prologue.md R-PROLOGUE-009): whole from hair to
// shoes, about nine tenths of the space between the caption and the sheet, its disc at the sheet's edge, at every phone
// height. Plain numbers, so the framing is tested without a canvas.
import { MathUtils } from "three";

/** The plinth: a low round the figure stands on, this wide and this high. */
export const PLINTH_RADIUS = 0.7;
export const PLINTH_HIGH = 0.1;
/** The camera's field of view, top to bottom, in degrees. */
export const FOV = 30;
/** The share of the space's height the figure and its disc fill. */
export const FILL = 0.9;
/** How far above the framing's middle the camera stands, so the disc reads as a round seen from a little above. */
export const LIFT = 0.35;
/** A figure's height when its own cannot be read: a body of 1.70 m with its hair. */
export const STANDING = 1.8;

/**
 * The camera for a figure `high` metres tall on its disc: the distance at which the disc's foot and the hair's top take
 * `FILL` of the space's height, and the height its middle is seen at. The camera's field of view runs top to bottom,
 * so the framing holds at every phone height: a short space frames the same figure smaller, never cut.
 */
export function framing(high: number, fov: number = FOV): { distance: number; middle: number; seen: number } {
  const seen = (high + PLINTH_HIGH) / FILL;
  const distance = seen / 2 / Math.tan(MathUtils.degToRad(fov) / 2);
  // The disc's front lip sits nearer the camera than the figure, so the framing's foot sits a little below the disc.
  const middle = -PLINTH_RADIUS * 0.12 + seen / 2;
  return { distance, middle, seen };
}
