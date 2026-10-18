// The street camera: a 32 degree lens at a person's eyes behind the player's character, along the
// way the place's start faces, rising to a plan view while the screen is held. On a screen taller
// than it is wide the camera stands to one side, so the character's back is not in the middle of
// the street the player is looking at. The world's camera is the place's raised shot (shot.ts); this
// one serves the city behind the panels and, in the world, only `tuning.city.roam` (world:camera-always-raised).
import type { Walker } from "../../../shared/scene/walk";

export type Point = [number, number, number];

/** The lens, in degrees from top to bottom of the screen. */
export const FOV = 32;
/** A person's eyes, and how far behind the character the street camera stands. */
export const EYE = 1.6;
export const BEHIND = 9;
/** Where the street camera looks: this far ahead of the character, at this height. */
export const AHEAD = 10;
export const LOOK_Y = 1.0;
/** How far the camera stands to the right on a wide screen, in metres. */
export const SIDE_WIDE = 0.9;
/** On a tall screen, how far the character stands from the middle toward the left edge, as a share of the half width: a quarter of the way in. */
export const SIDE_TALL = 0.5;
const PLAN_HEIGHT = 36;

/** The plan view stands higher on a narrow screen, so a phone held upright sees the street's width. */
export function planHeight(aspect: number): number {
  return PLAN_HEIGHT / Math.min(1, Math.max(aspect, 0.35));
}

/** How far to the right of the character the camera stands, so the character shows left of the middle. */
export function sideOffset(aspect: number): number {
  if (aspect >= 1) return SIDE_WIDE;
  const halfWidth = BEHIND * Math.tan(((FOV / 2) * Math.PI) / 180) * Math.max(aspect, 0.35);
  return halfWidth * SIDE_TALL;
}

/**
 * Where the camera stands and looks, `plan` of the way from the street view to the plan view.
 * `heading` is the turn about +Y the view faces, the place's start facing; a turn of zero faces +Z,
 * as every model does.
 */
export function cameraAim(walker: Pick<Walker, "x" | "z">, heading: number, plan: number, aspect: number): { position: Point; target: Point } {
  const ahead: [number, number] = [Math.sin(heading), Math.cos(heading)];
  // The camera's right hand when it looks along `ahead`.
  const right: [number, number] = [-ahead[1], ahead[0]];
  const side = sideOffset(aspect);
  const height = planHeight(aspect);
  const at = (along: number, across: number, y: number): Point => [walker.x + ahead[0] * along + right[0] * across, y, walker.z + ahead[1] * along + right[1] * across];
  const street = at(-BEHIND, side, EYE);
  const streetLook = at(AHEAD, side, LOOK_Y);
  const above = at(-height * 0.45, 0, height);
  const aboveLook = at(5, 0, 0);
  const mix = (from: Point, to: Point): Point => [from[0] + (to[0] - from[0]) * plan, from[1] + (to[1] - from[1]) * plan, from[2] + (to[2] - from[2]) * plan];
  return { position: mix(street, above), target: mix(streetLook, aboveLook) };
}
