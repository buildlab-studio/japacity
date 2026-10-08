// The camera of a place (docs/rules/world.md R-WORLD-009): always raised, never at eye level and
// never straight down. The whole view looks at the place's centre from far enough back that the
// place's width fits the screen whatever its shape; the close view looks at the character. The
// pinch moves between them and snaps to one on release; one finger turns the view within the place's
// limit. Pure: the scene feeds in the view and the screen's shape and reads back where to stand.
import type { Shot } from "../../shared/world/contract";
import type { Point } from "./camera";
import type { Stage } from "./placeFile";

/** The lens, in degrees from the top of the screen to the bottom. */
export const SHOT_FOV = 50;
/**
 * The camera's near plane, in metres. The raised view never comes closer than a few metres, so
 * the depth buffer is spent on the place and faces a centimetre apart stay apart (R-WORLD-012).
 */
export const SHOT_NEAR_PLANE = 1;
/** A little room round the place's width, so its edge is not cut by the screen's. */
export const FIT_MARGIN = 1.06;
/** Where the close view looks on the character: about the chest. */
export const CLOSE_LOOK_Y = 1;

/** The shot a place file without one is given: the frontage ahead of the start, as the earlier camera looked. */
export const DEFAULT_SHOT = { ahead: 5, width: 24, near: 10, farPitch: 52, nearPitch: 38, turn: 25 } as const;

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const mix = (from: number, to: number, share: number): number => from + (to - from) * share;

/** What the player has done to the view: how far toward the whole place (1) from close (0), and the turn in degrees. */
export interface View {
  zoom: number;
  turn: number;
}

/** Entering a place always shows the whole of it, facing the way the place faces. */
export const WHOLE: View = { zoom: 1, turn: 0 };

/** A shot from the start of a place that declares none: its centre a few metres ahead of the start, facing the start's way. */
export function defaultShot(stage: Pick<Stage, "start">): Shot {
  const [x, z, facing] = stage.start;
  return {
    centre: [x + Math.sin(facing) * DEFAULT_SHOT.ahead, 0, z + Math.cos(facing) * DEFAULT_SHOT.ahead],
    far: 0,
    near: DEFAULT_SHOT.near,
    farPitch: DEFAULT_SHOT.farPitch,
    nearPitch: DEFAULT_SHOT.nearPitch,
    turn: DEFAULT_SHOT.turn,
    yaw: (facing * 180) / Math.PI,
    width: DEFAULT_SHOT.width,
  };
}

// until the places work's files carry `stage.shot`, every place is given the default shot from its start.
/** The place's own shot, or the default one from its start. */
export function shotOf(stage: Pick<Stage, "start" | "shot">): Shot {
  return stage.shot ?? defaultShot(stage);
}

/** How far back the camera stands for `width` metres to span the screen's width at the point it looks at. */
export function fitDistance(width: number, aspect: number, fov = SHOT_FOV): number {
  const half = Math.atan(Math.tan(radians(fov / 2)) * Math.max(aspect, 0.01));
  return ((width / 2) / Math.tan(half)) * FIT_MARGIN;
}

/** How far back the whole view stands: the shot's own distance, or further when the screen is too narrow for its width. */
export function wholeDistance(shot: Shot, aspect: number, fov = SHOT_FOV): number {
  return Math.max(shot.far, shot.width === undefined ? 0 : fitDistance(shot.width, aspect, fov));
}

/** A turn kept within the place's limit either side of straight. */
export function clampTurn(shot: Pick<Shot, "turn">, turn: number): number {
  return Math.min(shot.turn, Math.max(-shot.turn, turn));
}

/** Where a released pinch comes to rest: the whole place, or close on the character, never between. */
export function snapZoom(zoom: number): 0 | 1 {
  return zoom >= 0.5 ? 1 : 0;
}

/** Where the camera stands and looks for a view of the shot, with the character at `walker`. */
export function aimShot(shot: Shot, view: View, walker: { x: number; z: number }, aspect: number, fov = SHOT_FOV): { position: Point; target: Point } {
  const zoom = Math.min(1, Math.max(0, view.zoom));
  const distance = mix(shot.near, wholeDistance(shot, aspect, fov), zoom);
  const pitch = radians(mix(shot.nearPitch, shot.farPitch, zoom));
  const yaw = radians((shot.yaw ?? 0) + clampTurn(shot, view.turn));
  const target: Point = [mix(walker.x, shot.centre[0], zoom), mix(CLOSE_LOOK_Y, shot.centre[1], zoom), mix(walker.z, shot.centre[2], zoom)];
  const back = Math.cos(pitch) * distance;
  return {
    position: [target[0] - Math.sin(yaw) * back, target[1] + Math.sin(pitch) * distance, target[2] - Math.cos(yaw) * back],
    target,
  };
}

/** The ground the shot's whole view must show across: the two ends of its width through the centre, square to the view. */
export function widthEnds(shot: Shot, turn = 0): [Point, Point] {
  const yaw = radians((shot.yaw ?? 0) + clampTurn(shot, turn));
  const half = (shot.width ?? 0) / 2;
  const [x, y, z] = shot.centre;
  // The view's right hand when it looks along yaw.
  const right: [number, number] = [-Math.cos(yaw), Math.sin(yaw)];
  return [
    [x - right[0] * half, y, z - right[1] * half],
    [x + right[0] * half, y, z + right[1] * half],
  ];
}
