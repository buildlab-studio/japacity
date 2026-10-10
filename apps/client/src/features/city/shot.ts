// The camera of a place (docs/rules/world.md R-WORLD-009). The whole view looks at the place's centre
// from far enough back that its width fits the screen; the close view looks at the character. Pure:
// the scene feeds in the view and the screen's shape and reads back where to stand.
import type { Shot } from "../../shared/world/contract";
import type { Point } from "./camera";
import type { Stage } from "./placeFile";
import { thingSpot, thingsOf } from "./things";

/** The lens, in degrees from the top of the screen to the bottom. */
export const SHOT_FOV = 50;
/**
 * The camera's near plane, in metres. The raised view never comes closer than a few metres, so
 * the depth buffer is spent on the place and faces a centimetre apart stay apart (R-WORLD-012).
 */
export const SHOT_NEAR_PLANE = 1;
/** A little room round the place's width, so its edge is not cut by the screen's. */
export const FIT_MARGIN = 1.06;
/** Where the close view looks: about the chest, a little ahead of the character, so a phone held upright shows what is in front. */
export const CLOSE_LOOK_Y = 1;
export const CLOSE_AHEAD = 2.5;

/**
 * The shot a place file without one is given: the frontage ahead of the start, as the earlier camera
 * looked, widened and pulled back until the start and every thing stand in it with `margin` metres round them.
 */
export const DEFAULT_SHOT = { ahead: 8, width: 24, near: 10, farPitch: 52, nearPitch: 38, turn: 25, margin: 3 } as const;
/** The share of the lens's height the whole view keeps its depth inside, clear of the top band and the thumb buttons. */
export const DEPTH_SHARE = 0.7;

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const mix = (from: number, to: number, share: number): number => from + (to - from) * share;

/** What the player has done to the view: how far toward the whole place (1) from close (0), and the turn in degrees. */
export interface View {
  zoom: number;
  turn: number;
}

/** Entering a place always shows the whole of it, facing the way the place faces. */
export const WHOLE: View = { zoom: 1, turn: 0 };

/**
 * How far back a view at `pitch` degrees must stand for ground `depth` metres deep through the point
 * it looks at to stand inside DEPTH_SHARE of the lens's height. Whatever the screen's shape, as the
 * lens's height does not change with it.
 */
export function depthDistance(depth: number, pitch: number, fov = SHOT_FOV): number {
  const down = radians(pitch);
  const reach = radians((fov / 2) * DEPTH_SHARE);
  const within = (distance: number, along: number): boolean => {
    const ahead = Math.cos(down) * distance + along;
    return ahead > 0 && Math.abs(down - Math.atan2(Math.sin(down) * distance, ahead)) <= reach;
  };
  let distance = 1;
  while (distance < 500 && !(within(distance, -depth / 2) && within(distance, depth / 2))) distance += 0.5;
  return distance;
}

/** A shot for a place that declares none: facing the start's way, over the frontage ahead of it and every thing in it. */
export function defaultShot(stage: Pick<Stage, "start" | "models" | "things">): Shot {
  const [x, z, facing] = stage.start;
  const forward: [number, number] = [Math.sin(facing), Math.cos(facing)];
  const right: [number, number] = [-Math.cos(facing), Math.sin(facing)];
  const spots: [number, number][] = [[x, z], [x + forward[0] * DEFAULT_SHOT.ahead * 2, z + forward[1] * DEFAULT_SHOT.ahead * 2]];
  for (const thing of thingsOf(stage)) {
    const spot = thingSpot(stage, thing);
    if (spot !== null) spots.push(spot);
  }
  const along = spots.map(([px, pz]) => (px - x) * forward[0] + (pz - z) * forward[1]);
  const across = spots.map(([px, pz]) => (px - x) * right[0] + (pz - z) * right[1]);
  const [alongLow, alongHigh, acrossLow, acrossHigh] = [Math.min(...along), Math.max(...along), Math.min(...across), Math.max(...across)];
  const [middleAlong, middleAcross] = [(alongLow + alongHigh) / 2, (acrossLow + acrossHigh) / 2];
  return {
    centre: [x + forward[0] * middleAlong + right[0] * middleAcross, 0, z + forward[1] * middleAlong + right[1] * middleAcross],
    far: depthDistance(alongHigh - alongLow + DEFAULT_SHOT.margin * 2, DEFAULT_SHOT.farPitch),
    near: DEFAULT_SHOT.near,
    farPitch: DEFAULT_SHOT.farPitch,
    nearPitch: DEFAULT_SHOT.nearPitch,
    turn: DEFAULT_SHOT.turn,
    yaw: (facing * 180) / Math.PI,
    width: Math.max(DEFAULT_SHOT.width, acrossHigh - acrossLow + DEFAULT_SHOT.margin * 2),
  };
}

// until the places work's files carry `stage.shot`, every place is given the default shot from its start and its things.
/** The place's own shot, or the default one from its start and its things. */
export function shotOf(stage: Pick<Stage, "start" | "models" | "things" | "shot">): Shot {
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
  const close: [number, number] = [walker.x + Math.sin(yaw) * CLOSE_AHEAD, walker.z + Math.cos(yaw) * CLOSE_AHEAD];
  const target: Point = [mix(close[0], shot.centre[0], zoom), mix(CLOSE_LOOK_Y, shot.centre[1], zoom), mix(close[1], shot.centre[2], zoom)];
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
