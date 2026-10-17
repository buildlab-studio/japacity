// The camera of a place (docs/rules/world.md R-WORLD-009). The whole view looks at the place's centre
// from far enough back that its width fits the screen; the close view looks at the character. Pure:
// the scene feeds in the view and the screen's shape and reads back where to stand.
import type { Shot } from "../../shared/world/contract";
import type { Point } from "./camera";
import type { Room, Stage } from "./placeFile";
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

/**
 * The pitch a room seen down its length is shown whole at (R-WORLD-029): from straight above a
 * standing figure is a dot in a room this long, so the whole view looks in from lower and the people stand up in it.
 */
export const ROOM_PITCH = 50;

/**
 * A room seen down its length (R-WORLD-029): an interior whose floor's long side runs up the screen, the shot turned a
 * quarter from the floor's own axes. Its whole view keeps the file's distance and width, from no higher than ROOM_PITCH.
 */
export function roomShot(shot: Shot, stage: Pick<Stage, "ground" | "shot">, scope: "exterior" | "interior"): Shot {
  const [across, deep] = stage.ground.size;
  const quarter = Math.abs(shot.yaw ?? 0) % 180 === 90;
  if (scope !== "interior" || stage.shot === undefined || !quarter || across <= deep) return shot;
  return { ...shot, farPitch: Math.min(shot.farPitch, ROOM_PITCH) };
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

/**
 * A shot that turns the full circle: a wide home's file sets its turn limit to
 * 360, and its view turns any way round, coming to rest on a quarter.
 */
export const FULL_TURN = 360;

/** Whether a shot turns the full circle in quarters, as a wide home's does, rather than within a limit either side. */
export function turnsRound(shot: Pick<Shot, "turn">): boolean {
  return shot.turn >= FULL_TURN;
}

/** A turn kept within the place's limit either side of straight; a shot that turns the full circle keeps any turn. */
export function clampTurn(shot: Pick<Shot, "turn">, turn: number): number {
  if (turnsRound(shot)) return turn;
  return Math.min(shot.turn, Math.max(-shot.turn, turn));
}

/** Where a turn released between quarters comes to rest: the nearest quarter. */
export function snapTurn(turn: number): number {
  return Math.round(turn / 90) * 90;
}

/** The turn for `quarter` (0 to 3) nearest a view at `turn`, so the view eases the short way round to it. */
export function turnToward(turn: number, quarter: number): number {
  const base = quarter * 90;
  return base + Math.round((turn - base) / 360) * 360;
}

/** The whole quarters, 0 to 3, of a turn. */
export function quarterTurns(turn: number): 0 | 1 | 2 | 3 {
  return ((((Math.round(turn / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3);
}

/**
 * The view from above: a vertical drag lifts a wide home's view from its own pitch to
 * this one, about 65 degrees, raised and never straight down (R-WORLD-009), and it comes to rest on one of the two.
 */
export const TOP_PITCH = 65;

/** Where a released tilt comes to rest: the normal view (0) or the view from above (1), never between. */
export function snapTilt(tilt: number): 0 | 1 {
  return tilt >= 0.5 ? 1 : 0;
}

/**
 * A wide home's whole view turned `turn` degrees from its file's facing: the width it must show across and the distance it
 * stands back for its depth, taken from the house's floor (`ground`, across and deep as the file faces it) as it lies
 * turned. A quarter turn swaps the floor's two sides; between quarters the floor is a diamond and the view stands back
 * far enough for its corners, so nothing is cut off on the way round.
 */
export function turnedShot(shot: Shot, ground: readonly [number, number], turn: number): Shot {
  if (turn % 360 === 0 || ground[0] <= 0 || ground[1] <= 0) return shot;
  const [across, deep] = ground;
  const t = radians(turn);
  const [c, s] = [Math.abs(Math.cos(t)), Math.abs(Math.sin(t))];
  const wide = c + (deep / across) * s;
  const far = c + (across / deep) * s;
  return { ...shot, far: shot.far * far, ...(shot.width === undefined ? {} : { width: shot.width * wide }) };
}

/** Where a released pinch comes to rest: the whole place, or close on the character, never between. */
export function snapZoom(zoom: number): 0 | 1 {
  return zoom >= 0.5 ? 1 : 0;
}

/** How quickly the view eases to where it is going, a share a second: the scene's easing for every place. */
export const EASE = 7;
/** How close to its end an easing view comes before it stands there. */
export const SETTLE = 0.002;
/**
 * The same easing for a wide home's rooms (world.md R-WORLD-029), quick enough that a
 * tap or a pinch has the camera in on the room, or back on the whole house, in under 400 ms.
 */
export const ROOM_EASE = 12;
export const ROOM_SETTLE = 0.01;

/**
 * One frame of the zoom's easing toward where it is going: a share of the way still to go, standing at the end once close.
 * Under reduced motion (`still`, world.md R-WORLD-023) it stands at the end at once, with no ease.
 */
export function easeZoom(zoom: number, to: number, delta: number, rate = EASE, settle = SETTLE, still = false): number {
  if (still) return to;
  const next = zoom + (to - zoom) * Math.min(1, delta * rate);
  return Math.abs(to - next) < settle ? to : next;
}

/** What a wide home's view eases each frame, and what holds it: a pinch holds the zoom, a finger the turn and the tilt. */
export interface ViewEase {
  zoom: number;
  zoomTo: number;
  turn: number;
  turnTo: number;
  tilt: number;
  tiltTo: number;
  pinching: boolean;
  turning: boolean;
}

/**
 * One frame of a wide home's view (R-WORLD-029): the ease in on a room or back out to the whole
 * house, a quarter turn and the tilt, each at the rooms' rate, in under 400 ms, once no finger holds it. Under reduced
 * motion (`still`, R-WORLD-023) each changes at once instead; a finger still moves the view live while it drags.
 */
export function easeRoomView(view: ViewEase, delta: number, still = false): Pick<ViewEase, "zoom" | "turn" | "tilt"> {
  const zoom = view.pinching ? view.zoom : easeZoom(view.zoom, view.zoomTo, delta, ROOM_EASE, ROOM_SETTLE, still);
  if (view.turning) return { zoom, turn: view.turn, tilt: view.tilt };
  return {
    zoom,
    turn: easeZoom(view.turn / 90, view.turnTo / 90, delta, ROOM_EASE, ROOM_SETTLE, still) * 90,
    tilt: easeZoom(view.tilt, view.tiltTo, delta, ROOM_EASE, ROOM_SETTLE, still),
  };
}

/** The room of a wide home whose floor holds a point, or null outside every room. */
export function roomAt(rooms: readonly Room[], x: number, z: number): Room | null {
  return rooms.find(({ floor: [x0, z0, x1, z1] }) => x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && z >= Math.min(z0, z1) && z <= Math.max(z0, z1)) ?? null;
}

/** What a tap on a wide home's floor or walls does to the camera: ease in on a room, ease out to the whole house, or nothing (a walk). */
export type HomeTap = { kind: "in"; room: Room } | { kind: "out" } | { kind: "walk" };

/**
 * A tap on a wide home's floor or walls (R-WORLD-029): from the whole house (`whole`)
 * it eases in on the room tapped; eased in on `current`, a tap outside it eases back out to the whole house, and a tap
 * inside it walks there as anywhere.
 */
export function homeTap(rooms: readonly Room[], whole: boolean, current: Room | undefined, x: number, z: number): HomeTap {
  const room = roomAt(rooms, x, z);
  if (whole) return room === null ? { kind: "walk" } : { kind: "in", room };
  return room === null || room.id !== current?.id ? { kind: "out" } : { kind: "walk" };
}

/**
 * The room a thing chosen in a wide home eases the camera in on first, so its chip or its fan opens at the rooms'
 * distance; null when the camera is already in on that room, or the thing stands in none.
 */
export function roomFirst(rooms: readonly Room[], whole: boolean, current: Room | undefined, spot: readonly [number, number] | null): Room | null {
  const room = spot === null ? null : roomAt(rooms, spot[0], spot[1]);
  if (room === null) return null;
  return whole || room.id !== current?.id ? room : null;
}

/** How a wide home's view is turned and tilted, and the floor it turns. */
export interface HomeView {
  /** Degrees turned from the file's facing; a whole number of quarters at rest. */
  turn?: number;
  /** 0 the normal view, 1 the view from above; between while a vertical drag is held or the tilt eases. */
  tilt?: number;
  /** The house's floor as the file faces it, across and deep (`stage.ground.size`), for the turned whole view's fit. */
  ground?: readonly [number, number];
}

/**
 * Where the camera stands and looks, and its lens, for a wide home (world.md R-WORLD-029): at
 * `zoom` 1 the whole house seen down its length on the shot's long lens, fitted
 * to its width; at 0 eased in on `room` at the rooms' distance on the scene's own lens, the rest of the house running off
 * the screen's edges; between, the two mixed. The view looks from the file's facing turned by `view.turn`, the house
 * fitted as it lies turned, and from its own pitch lifted toward the view from above by `view.tilt`.
 */
export function aimRoom(shot: Shot, room: Pick<Room, "centre" | "width" | "pitch" | "floor">, zoom: number, aspect: number, view: HomeView = {}): { position: Point; target: Point; fov: number } {
  const share = Math.min(1, Math.max(0, zoom));
  const turn = view.turn ?? 0;
  const tilt = Math.min(1, Math.max(0, view.tilt ?? 0));
  const turned = view.ground === undefined ? shot : turnedShot(shot, view.ground, turn);
  // From above the floor's depth stands taller on the screen, so the whole view stands back as far again as it rises.
  const whole = tilt === 0 ? turned : { ...turned, far: turned.far * mix(1, Math.sin(radians(TOP_PITCH)) / Math.sin(radians(shot.farPitch)), tilt) };
  const wide = shot.fov ?? SHOT_FOV;
  const fov = mix(SHOT_FOV, wide, share);
  const yawDegrees = (shot.yaw ?? 0) + turn;
  const wholePitch = mix(shot.farPitch, TOP_PITCH, tilt);
  const standBack = view.ground === undefined ? wholeDistance(whole, aspect, wide) : Math.max(wholeDistance(whole, aspect, wide), cornersDistance(shot, view.ground, yawDegrees, wholePitch, wide, aspect));
  const distance = mix(roomDistance(room, aspect, turn), standBack, share);
  const pitch = radians(mix(mix(room.pitch, shot.farPitch, share), TOP_PITCH, tilt));
  const yaw = radians(yawDegrees);
  const centre = roomTarget(room, turn);
  const target: Point = [mix(centre[0], shot.centre[0], share), mix(centre[1], shot.centre[1], share), mix(centre[2], shot.centre[2], share)];
  const back = Math.cos(pitch) * distance;
  return { position: [target[0] - Math.sin(yaw) * back, target[1] + Math.sin(pitch) * distance, target[2] - Math.cos(yaw) * back], target, fov };
}

/**
 * The width a room eased in on fits across the screen turned: unturned, the file's own width; turned,
 * the room's floor as it lies across the view from the point the camera looks at, with the margin the file gives round
 * its width, never under `least` metres, so a small nook is not seen nose to the wall, nor over `most`, so a long room seen
 * across its length (the yard down the family house's side, a quarter round) is eased in on its middle with people that
 * read, the rest of it running off the screen's sides as an unturned room's length runs off its top and bottom.
 */
export const ROOM_ACROSS = { least: 2.4, most: 7, margin: 0.6 } as const;

/**
 * Where the eased-in view of a room looks, turned: the file's `centre` is set for the view down the
 * house's length, a little ahead of or behind the floor's middle; turned, the same offset is taken along and across the
 * turned view from the floor's middle, so the room stands in the middle of the screen whichever way it is seen.
 */
export function roomTarget(room: Pick<Room, "centre" | "floor">, turn = 0): Point {
  if (turn % 360 === 0) return room.centre;
  const [x0, z0, x1, z1] = room.floor;
  const [mx, mz] = [(x0 + x1) / 2, (z0 + z1) / 2];
  const [along, across] = [-(room.centre[2] - mz), room.centre[0] - mx];
  const t = radians(turn);
  return [mx + along * -Math.sin(t) + across * Math.cos(t), room.centre[1], mz + along * -Math.cos(t) + across * -Math.sin(t)];
}

export function roomAcross(room: Pick<Room, "width" | "floor"> & { centre?: Room["centre"] }, turn = 0): number {
  if (turn % 360 === 0) return room.width;
  const [x0, z0, x1, z1] = room.floor;
  const [cx, , cz] = roomTarget({ floor: room.floor, centre: room.centre ?? [(x0 + x1) / 2, 0, (z0 + z1) / 2] }, turn);
  const t = radians(turn);
  // Across the turned view, measured from the point it looks at: the floor's farthest corner either side.
  const half = Math.max(...[x0, x1].flatMap((x) => [z0, z1].map((z) => Math.abs((x - cx) * Math.cos(t) - (z - cz) * Math.sin(t)))));
  // The file's margin round the width, as much as a turned room needs: a few files frame a neighbour too (the bathroom).
  const margin = Math.min(ROOM_ACROSS.margin, Math.max(0, room.width - Math.abs(x1 - x0)));
  return Math.min(ROOM_ACROSS.most, Math.max(ROOM_ACROSS.least, half * 2 + margin));
}

/**
 * How far back the eased-in view of a room stands. A phone held upright fits the room's width across the screen, its
 * length running off the top and bottom by design (R-WORLD-029). A screen wider than tall would come far too
 * close on the width alone, so there the room's floor along the view must stand inside the lens's height too, and a
 * thing at the room's near edge (the bed in the corner) stays on screen on a laptop as it does on a phone. Turned
 *, the width is the room's floor as it lies across the turned view (`roomAcross`) and the depth as
 * it lies along it.
 */
export function roomDistance(room: Pick<Room, "width" | "pitch" | "floor"> & { centre?: Room["centre"] }, aspect: number, turn = 0): number {
  const fit = fitDistance(roomAcross(room, turn), aspect, SHOT_FOV);
  if (aspect < 1) return fit;
  const t = radians(turn);
  const depth = Math.abs(room.floor[3] - room.floor[1]) * Math.abs(Math.cos(t)) + Math.abs(room.floor[2] - room.floor[0]) * Math.abs(Math.sin(t));
  return Math.max(fit, depthDistance(depth, room.pitch, SHOT_FOV));
}

/**
 * How far back a wide home's whole view must stand, looking along `yaw` from `pitch` degrees on a lens of `fov`, for every
 * corner of its floor (`ground` round the shot's centre) to stand inside the screen's width with the fit's margin. The
 * width's fit holds at the point the view looks at; turned, the floor's near corners stand closer than that point and
 * spread wider, and this keeps them on screen too.
 */
export function cornersDistance(shot: Pick<Shot, "centre">, ground: readonly [number, number], yaw: number, pitch: number, fov: number, aspect: number): number {
  const half = (Math.tan(radians(fov / 2)) * Math.max(aspect, 0.01)) / FIT_MARGIN;
  const [y, p] = [radians(yaw), radians(pitch)];
  const right: [number, number] = [-Math.cos(y), Math.sin(y)];
  const forward: [number, number, number] = [Math.sin(y) * Math.cos(p), -Math.sin(p), Math.cos(y) * Math.cos(p)];
  const [cx, cy, cz] = shot.centre;
  let distance = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // The floor lies centred on the place's origin, as its ground does; each corner from the point the view looks at.
      const [px, py, pz] = [(sx * ground[0]) / 2 - cx, -cy, (sz * ground[1]) / 2 - cz];
      const across = Math.abs(px * right[0] + pz * right[1]);
      const ahead = px * forward[0] + py * forward[1] + pz * forward[2];
      distance = Math.max(distance, across / half - ahead);
    }
  }
  return distance;
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
