// The 3D scene of a place, loaded only where WebGL exists. One sun and one sky light set by the
// place (R-ASSET-006), fog near or far by mode, and one frame loop that moves the clock, the crowd's
// idling, the walk and the camera. In the world (docs/rules/world.md) the camera is the place's
// raised shot, turned by one finger and zoomed by the pinch to the whole place or close on the
// character (R-WORLD-009); the things carry quiet marks, and a tap on one walks the character straight
// to it and floats its name and acts over it (R-WORLD-005, 010). The street camera at a person's eyes, the plan
// view while the screen is held and the routed walks stay for the city behind the panels and for
// `tuning.city.roam`. Nothing here sends a command (city.md R-CITY-001).
import { type Footprint, footprintOf, onWalkable } from "@japacity/assets";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { WorldClock } from "@japacity/sim";
import { Box3, type Camera, Color, type DirectionalLight, Fog, type HemisphereLight, type Mesh, type Object3D, PerspectiveCamera, PointLight, Vector3 } from "three";

import { keptStyleOf } from "../../authority/person";
import { wear } from "../../shared/frontdoor/colours";
import type { Act, Shot, Thing } from "../../shared/world/contract";
import { bubbleSpot, NEAR_SPEAKER } from "../../shared/world/Lines";
import { advanceClock } from "../../shared/three/clock";
import { loadModel } from "../../shared/three/load";
import { loadManifest } from "../../shared/three/manifest";
import { glowAt, loadGrids } from "../../shared/three/motion";
import { poseFigure } from "../../shared/three/people";
import { BEHIND, cameraAim, EYE, FOV } from "./camera";
import { limitMotion } from "./limits";
import { lightKindOf, type Look, lookAt, mixLooks, ownHeightOf, PLACE_LIGHT, placeLook, ROOM_LIGHT, skyLightOf, skyOf, sunAt, useDayClock } from "./daylight";
import { filesOf, type Room, showsFor, type Spot, type Stage, stageOf } from "./placeFile";
import { misfit, turned } from "./arrange";
import { dropLifted, floorAt, LIFT_DRAG_PX, LIFT_HOLD_MS, LIFT_Y, liftHintNode, liftNode, liftShadow, SHAKE_MS } from "./lift";
import { liftable, ownedThingId } from "./owned";
import type { CityProbe, ScenePick, SceneProps } from "./scene.types";
import { anchorFan } from "./fan/anchor";
import { markNode, showMark } from "./mark";
import { bedLie, othersSeen, sleepMarkNode } from "./sleep";
import { type LabelBox, spreadLabels } from "./labels";
import { aimRoom, aimShot, clampTurn, EASE, easeZoom, homeTap, quarterTurns, ROOM_EASE, ROOM_SETTLE, roomAt, roomFirst, roomShot, SETTLE, SHOT_FOV, SHOT_NEAR_PLANE, shotOf, snapTilt, snapTurn, snapZoom, turnedShot, turnsRound, turnToward, widthEnds } from "./shot";
import { showWalls, wallsQuarter } from "./walls";
import { thingSpot, walkBeforeAct, walkSpot } from "./things";
import { standAt, stepWalk, strideOf, WALK_SPEED, type Walker, walkRoute, walkTo } from "./walk";
import { walkableOf } from "./walk/map";
import { findRoute } from "./walk/route";
import { SHEET_KINDS } from "../../../../../tools/assets/world-check";
import { animateWorld, buildWorld, colourOf, lampsOf, motionOf, type World } from "./world";
import { failureOf } from "../../shared/net/http";

/** How much further the fog stands while looking from above, so the plan is not lost in it. */
const PLAN_FOG = 90;
const HOLD_MS = 450;
/** Behind the panels the scene only idles: a frame a second, so the panels keep the processor. */
const IDLE_MS = 1000;
/** A finger that moves further than this before it lifts turned the view; it did not tap. */
const DRAG_PX = 8;
/** Degrees the view turns for each pixel a finger moves across the screen. */
const TURN_PER_PX = 0.25;
/** A wide home turns quicker under the finger: half a quarter, where a release snaps on round, in about a third of a phone's width. */
const HOME_TURN_PER_PX = 0.4;
/** Pixels a finger moves up a wide home's view for it to rise from the normal view to the view from above. */
const TILT_PX = 220;
/** Pixels the fingers of a pinch move apart for the view to go from the whole place to close. */
const PINCH_PX = 260;
/** How close to the screen's edge a label or the marker may stand. */
const EDGE_MARGIN = 8;
/** How high the character lies when the act names no top to lie on (`Act.top`): about a mattress's top. */
const LIE_Y = 0.5;
/** The back's depth behind a figure's middle when the figure cannot be measured. */
const BACK_DEPTH = 0.12;
/** The length of the lying body, feet to head, so it is centred on the seat. */
const LIE_LENGTH = 1.6;
/** A label, and a thing's acts, float this high over the thing's spot. */
const LABEL_Y = 2.6;
/** The fan's hinge stands on the thing's body, under its label (docs/design/13-the-lively-layer.md section 3). */
const FAN_Y = 0.9;
/** How high over the bed the sleep mark floats, clear of the lying figure (R-WORLD-025). */
const SLEEP_MARK_Y = 1.5;
/** The sun's shadow covers the place's width and this much round it, in metres. */
const SHADOW_MARGIN = 4;
const SHADOW_BIAS = -0.0005;
const SHADOW_NORMAL_BIAS = 0.04;
/** How quickly the day's light eases to a new look, a share a second: about 600 ms to settle when the part changes (R-CLOCK-033). */
const DAY_EASE = 5;
/** How long an act's answer takes to grow in where it stands, and to go: short, on its scale alone (R-WORLD-005). */
const FX_MS = 200;

/** Whether two looks of the day stand close enough to stop easing. */
function settled(a: Look, b: Look): boolean {
  return a.sun === b.sun && a.tint === b.tint && Math.abs(a.sunStrength - b.sunStrength) < 0.002 && Math.abs(a.skyStrength - b.skyStrength) < 0.002 && Math.abs((a.height ?? 0) - (b.height ?? 0)) < 0.05 && Math.abs(a.turn - b.turn) < 0.05 && Math.abs(a.tintShare - b.tintShare) < 0.002 && Math.abs(a.groundShare - b.groundShare) < 0.002 && Math.abs(a.lamps - b.lamps) < 0.002 && Math.abs(a.softness - b.softness) < 0.01;
}

/** Frees what an act's answer drew once it has gone; the halo's shared texture stays. */
function disposeFx(object: Object3D): void {
  object.removeFromParent();
  object.traverse((part) => {
    const mesh = part as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material.dispose();
  });
}

/** How far the figure's back stands behind its middle, measured on the figure standing at its spot. */
function backDepth(root: Object3D): number {
  const rotation = root.rotation.clone();
  const position = root.position.clone();
  root.rotation.set(0, 0, 0, "XYZ");
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root);
  root.rotation.copy(rotation);
  root.position.copy(position);
  root.updateMatrixWorld(true);
  const parent = new Vector3().setFromMatrixPosition(root.parent?.matrixWorld ?? root.matrixWorld);
  const depth = parent.z - box.min.z;
  return box.isEmpty() || !Number.isFinite(depth) || depth <= 0 ? BACK_DEPTH : depth;
}

/** What a ray landed on, before the scene reads it as a thing. */
type Hit = { kind: "own" } | { kind: "person"; slot: number } | { kind: "model"; file: string; signs: string[] } | { kind: "stander"; thing: string };

function hitOf(object: Object3D | null): Hit | null {
  let at: Object3D | null = object;
  while (at !== null) {
    const data = at.userData as { slot?: number; own?: boolean; file?: string; signs?: string[]; stander?: string };
    if (data.own === true) return { kind: "own" };
    if (typeof data.stander === "string") return { kind: "stander", thing: data.stander };
    if (typeof data.slot === "number") return { kind: "person", slot: data.slot };
    if (typeof data.file === "string") return { kind: "model", file: data.file, signs: data.signs ?? [] };
    at = at.parent;
  }
  return null;
}

/** The view the player has made with the pinch and one finger (R-WORLD-009), shared by the gestures and the frame loop. */
interface Rig {
  /** 1 the whole place, 0 close on the character; between while a pinch is held. */
  zoom: number;
  /** Where the zoom is easing to: always 0 or 1. */
  zoomTo: 0 | 1;
  /** Degrees either side of the shot's facing; a wide home's, any number of degrees round, at rest on a quarter. */
  turn: number;
  /** Where a wide home's turn is easing to: always a whole number of quarters. */
  turnTo: number;
  /** A wide home: 0 the normal view, 1 the view from above; between while a finger lifts it, and where it eases to. */
  tilt: number;
  tiltTo: 0 | 1;
  /** A finger is turning or tilting a wide home's view live: it follows the finger and eases nowhere until it lifts. */
  turning: boolean;
  pinching: boolean;
  /** A wide home's room the view eases in on (R-WORLD-029 as the home's wave asks it amended); null for the room the character stands in. */
  room: string | null;
}

/** Buy mode's lifted thing: `good` is the last spot it fitted, where a shake sends it back and where it is set down. */
interface Lifted {
  thing: string;
  file: string;
  from: Spot;
  at: Spot;
  good: Spot;
  copy: Object3D;
  shadow: Mesh;
  y: number;
  turn: number;
  shake: number | null;
  down: boolean;
}

const wholeRig = (turn = 0): Rig => ({ zoom: 1, zoomTo: 1, turn, turnTo: turn, tilt: 0, tiltTo: 0, turning: false, pinching: false, room: null });

/** The room a wide home's view eases in on: the one asked for, else the one the character stands in, else the first. */
export function roomInView(rooms: readonly Room[], asked: string | null, at: { x: number; z: number }): Room | undefined {
  return rooms.find((room) => room.id === asked) ?? roomAt(rooms, at.x, at.z) ?? rooms[0];
}

/** Where a point of the place falls on the screen, in CSS pixels, or null when it is off it or behind the camera. */
/** How far a resident may stand from the player's figure and still be heard (the talk budget), in metres. */
const NEAR_M = 7;
/** How far over a resident's feet their emote stands. */
const EMOTE_Y = 2.2;
const emoteAt = new Vector3();
const nearAt = new Vector3();

/** The spot of the resident nearest the player's figure within NEAR_M, as [x, z], or null when none stands near. */
function nearestResident(world: { crowd: readonly { figure: { root: Object3D } }[] } | null, x: number, z: number): [number, number] | null {
  let best: [number, number] | null = null;
  let far = NEAR_M;
  for (const entry of world?.crowd ?? []) {
    entry.figure.root.getWorldPosition(nearAt);
    const distance = Math.hypot(nearAt.x - x, nearAt.z - z);
    if (distance < far) [far, best] = [distance, [nearAt.x, nearAt.z]];
  }
  return best;
}

function onScreen(camera: Camera, size: { width: number; height: number }, x: number, y: number, z: number, margin = 1): { x: number; y: number } | null {
  const at = new Vector3(x, y, z).project(camera);
  if (at.z > 1 || Math.abs(at.x) > margin || Math.abs(at.y) > margin) return null;
  return { x: ((at.x + 1) / 2) * size.width, y: ((1 - at.y) / 2) * size.height };
}

/** The street camera behind the character along the start's facing, or the plan view as far as `plan` has risen. */
function aimStreet(camera: Camera, walker: Walker, heading: number, plan: number, aspect: number): void {
  const { position, target } = cameraAim(walker, heading, plan, aspect);
  camera.position.set(...position);
  camera.lookAt(...target);
}

function lens(camera: Camera, fov: number, near: number): void {
  if (!(camera instanceof PerspectiveCamera) || (camera.fov === fov && camera.near === near)) return;
  camera.fov = fov;
  camera.near = near;
  camera.updateProjectionMatrix();
}

/** Where the character stands and walks, the act that waits on the walk, and the start of the place they stand in. */
interface WalkState {
  walker: Walker;
  pending: { thing: Thing; act: Act } | null;
  /** The start of the stage they stand on: a place dressed or shown anew keeps its start, so they keep their spot (R-WORLD-029). */
  standing: Spot | null;
  /** The character sat down on a plain act and stays so until they walk. */
  sitting: boolean;
  /** The character lies on the thing (the bed, the couch) until they walk; lying raises them onto it. */
  lying: boolean;
  /** How high the lying figure's middle stands: its back on the top of what it lies on. */
  lieY: number;
  /** The pace of the walk in hand: whatever the distance, a walk to a thing takes about WALK_SECONDS (R-WORLD-010). */
  speed: number;
}

/** A walk to a thing takes about this long whatever the distance; a second tap ends it at once (R-WORLD-010). */
export const WALK_SECONDS = 1;

interface PlaceProps extends SceneProps {
  /** The DOM box the labels and the acts are laid out in. */
  markBox: HTMLDivElement | null;
  /** How far toward the plan view the street camera stands, 0 to 1. */
  plan: number;
  /** The raised view's state, moved by the gestures. */
  rig: MutableRefObject<Rig>;
  /** The character's walk and the act waiting on it, held outside the canvas so a remount keeps them (R-WORLD-010). */
  walk: MutableRefObject<WalkState>;
  /** The place's shot. */
  shot: Shot;
  /** True when the view is the raised shot; false for the street camera. */
  raised: boolean;
  takeTap: () => boolean;
  /** The part of the world's day and its minute, which set the sun and the sky (R-CLOCK-033). */
  day: Pick<WorldClock, "part" | "minute">;
}

function Idle({ looking }: { looking: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (looking) return;
    const timer = window.setInterval(() => invalidate(), IDLE_MS);
    return () => window.clearInterval(timer);
  }, [looking, invalidate]);
  return null;
}

function Place(props: PlaceProps) {
  const { place, file, people, own, settings, text, onProgress, onFailed, onPick, onFrame, looking, labelsHidden = false, plan, takeTap, markBox, rig, shot, raised, marks, named, nudged = null, teaching = false } = props;
  const roam = props.overview !== true || props.roam === true;
  const things = useMemo(() => props.things ?? [], [props.things]);
  const [world, setWorld] = useState<World | null>(null);
  const { walk } = props;
  const planShare = useRef(0);
  const sun = useRef<DirectionalLight>(null);
  const skyLight = useRef<HemisphereLight>(null);
  const frames = useRef<number[]>([]);
  /** The quarter whose wall pair a wide home's shell shows now, for the world it was shown in. */
  const wallsShown = useRef<{ world: World | null; quarter: number }>({ world: null, quarter: 0 });
  /** An act chosen while the character still walks to its thing: it follows on arrival (R-WORLD-010). */
  const labels = useRef<{ thing: Thing; node: HTMLButtonElement }[]>([]);
  const pick = useRef(onPick);
  pick.current = onPick;
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const plain = stageOf(file);
  const level = settings.mesh === "fine" ? "high" : "low";
  // The moving sheets a mode may draw, the cheapest kept (R-WORLD-011); the roaming city draws them all.
  const stage: Stage = useMemo(() => (roam ? plain : { ...plain, motion: limitMotion(plain.motion, level) }), [plain, roam, level]);
  const peopleKey = people.map((shown) => `${shown.person.file}:${String(shown.tag)}`).join("|");
  // The day's look by the world's clock, and the look the lights stand at now, easing toward it (R-CLOCK-033).
  const { part, minute } = props.day;
  // The layer's light (the design): a home's rooms, an office or a street, each warmed by day under a pale, cool sky.
  const kind = lightKindOf({ scope: file.scope, stage });
  const placeLight = PLACE_LIGHT[kind];
  const target = useMemo(() => placeLook(lookAt(part, minute, stage.light.sun), kind), [part, minute, stage.light.sun, kind]);
  const look = useRef<Look | null>(null);
  const daylit = useRef<{ look: Look | null; sun: [number, number, number]; sky: Color; light: Color; ground: Color; background: Color; fog: Color }>({ look: null, sun: [0, 0, 0], sky: new Color(), light: new Color(), ground: new Color(), background: new Color(), fog: new Color() });
  const lamps = useRef<Object3D[]>([]);
  /** The rooms' real lights at their lamps, each with its strength at full night (the design). */
  const lights = useRef<{ point: PointLight; strength: number }[]>([]);
  const fx = useRef<{ objects: Object3D[]; from: number; to: number }[]>([]);
  /** The models the place was last built from, for buy mode's copy of a lifted thing and its footprint. */
  const modelsRef = useRef<ReadonlyMap<string, Object3D>>(new Map());
  /** Buy mode's lifted thing: which, its model, where it was lifted from and where it is now, its copy and shadow, and a shake back running. */
  const lifted = useRef<Lifted | null>(null);
  const handles = useRef<{ thing: string; at: Spot; node: HTMLDivElement }[]>([]);
  const hint = useRef<HTMLDivElement | null>(null);
  /** A thing set down while the room is rebuilt around it: its copy stays until the new room stands, so nothing blinks. */
  const settling = useRef<{ lifted: Lifted; world: World } | null>(null);

  /** Starts the walk to a thing; false when the character already stands at it. */
  const walkFor = (thing: Thing): boolean => {
    const to = walkBeforeAct(stage, thing, walk.current.walker);
    if (to === null) return false;
    const far = Math.hypot(to[0] - walk.current.walker.x, to[1] - walk.current.walker.z);
    walk.current.speed = Math.max(WALK_SPEED, far / WALK_SECONDS);
    walk.current.walker = walkTo(walk.current.walker, to[0], to[1]);
    walk.current.sitting = false;
    walk.current.lying = false;
    return true;
  };
  const choose = (thing: Thing): void => {
    walkFor(thing);
    walk.current.pending = null;
    walk.current.sitting = false;
    walk.current.lying = false;
    pick.current({ kind: "thing", thing });
  };
  // A wide home's rooms (R-WORLD-029 as the home's wave asks it amended): a thing chosen from the whole house, or in
  // another room, eases the camera in on its room first, and its fan opens once the camera is there.
  const rooms = useMemo(() => (raised ? (stage.rooms ?? []) : []), [raised, stage.rooms]);
  const deferred = useRef<Thing | null>(null);
  const zoomed = props.onZoomed;
  const easeTo = (room: Room | null): void => {
    rig.current.room = room === null ? rig.current.room : room.id;
    rig.current.zoomTo = room === null ? 1 : 0;
    rig.current.pinching = false;
    zoomed?.(room !== null);
  };
  const pickThing = (thing: Thing): void => {
    const room = roomFirst(rooms, rig.current.zoomTo === 1, roomInView(rooms, rig.current.room, walk.current.walker), thingSpot(stage, thing));
    if (room !== null) {
      easeTo(room);
      deferred.current = thing;
      return;
    }
    choose(thing);
  };
  const walkForRef = useRef(walkFor);
  walkForRef.current = walkFor;
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  const pickRef = useRef(pickThing);
  pickRef.current = pickThing;

  // The marks live in the DOM box beside the canvas, one over each thing; the frame loop moves them (R-WORLD-005).
  useEffect(() => {
    if (markBox === null) return;
    const made = things.map((thing) => ({ thing, node: markNode(thing, () => pickRef.current(thing)) }));
    for (const { node } of made) markBox.append(node);
    labels.current = made;
    return () => {
      for (const { node } of made) node.remove();
      labels.current = [];
    };
  }, [things, markBox]);
  // Each mark as it stands: a dot, its name while it is named or taught, pulsing for the nudge, with its plan state.
  const namedKey = (named ?? []).join("|");
  useEffect(() => {
    const names = new Set(namedKey.split("|"));
    for (const { thing, node } of labels.current) showMark(node, { named: names.has(thing.id), teaching, pulse: nudged === thing.id, state: marks?.[thing.id] });
  }, [things, markBox, namedKey, nudged, teaching, marks]);

  /** An act chosen on a thing's fan: it follows once the character has walked to the thing (R-WORLD-010). */
  const actFor = (thing: Thing, act: Act): void => {
    const pending = walk.current.pending;
    // Tapping an act again ends the walk at once (R-WORLD-010).
    if (pending !== null && pending.thing.id === thing.id && pending.act.id === act.id && pending.act.stages === act.stages && walk.current.walker.target !== null) walk.current.walker = stepWalk(walk.current.walker, 3600, walk.current.speed);
    // Acts opened for a thing the character was not sent to (the nudge's way) still wait for the walk: the words start at the thing.
    else if (walk.current.walker.target === null) walkForRef.current(thing);
    walk.current.pending = { thing, act };
  };
  const actForRef = useRef(actFor);
  actForRef.current = actFor;
  // A button of the fan, which the shell draws, hands its act here to walk for (docs/design/13-the-lively-layer.md section 3).
  const actOn = props.actOn ?? null;
  useEffect(() => {
    if (actOn !== null) actForRef.current(actOn.thing, actOn.act);
  }, [actOn]);

  useEffect(() => {
    let alive = true;
    const wanted = filesOf(file, [...people.map((shown) => shown.person.file), own]);
    let done = 0;
    onProgress(0, wanted.length);
    void (async () => {
      const manifest = await loadManifest();
      const models = new Map<string, Object3D>();
      await Promise.all(
        wanted.map(async (path) => {
          models.set(path, await loadModel(manifest, path, text));
          done += 1;
          if (alive) onProgress(done, wanted.length);
        }),
      );
      await loadGrids(stage.motion.map((motion) => motion.kind), settings.mesh, (path) => loadModel(manifest, path, text));
      if (!alive) return;
      // A new place starts the character at its door. A rebuild of the same place (the crowd or the
      // mode changed) keeps where they stand and the act they are walking to (R-WORLD-010).
      if (walk.current.standing !== stage.start) {
        const [x, z, facing] = stage.start;
        walk.current.walker = standAt(x, z, facing);
        walk.current.pending = null;
        walk.current.standing = stage.start;
      }
      const built = buildWorld(stage, models, people, own, settings, text, place, roam);
      modelsRef.current = models;
      // The character wears the player's own colours (R-PROLOGUE-015): painted once, as the place is built.
      wear(built.own.root, keptStyleOf(own));
      setWorld(built);
    })().catch((error: unknown) => {
      // The screen says the place could not be shown in its own words; what went wrong is kept by kind, never as text.
      if (alive) onFailed(failureOf(error) ?? "fault");
    });
    return () => {
      alive = false;
    };
    // The world is rebuilt for a new place, a new crowd or a new mode; the callbacks are the screen's and may change freely.
  }, [place, file, peopleKey, own, settings.mesh, settings.shadows, roam]);

  // Buy mode: a hold area over each thing you own; a hold lifts it (a lift, a shadow, the
  // pop), a drag moves it on the floor and sets it down where it fits, a tap while it is lifted turns it a quarter, a tap
  // anywhere else sets it down. A spot that does not fit shakes it back to where it last stood. The room is rebuilt once,
  // as the thing is set down, from the arrangement the city keeps.
  const arrange = props.arrange ?? null;
  const arrangeRef = useRef(arrange);
  arrangeRef.current = arrange;
  const arranging = arrange !== null;
  useEffect(() => {
    const waiting = settling.current;
    if (waiting !== null && waiting.world !== world) {
      dropLifted(waiting.lifted.copy, waiting.lifted.shadow);
      settling.current = null;
    }
    if (markBox === null || world === null || !arranging) return;
    const items = liftable(file);
    const canvas = gl.domElement;
    const footprint = (path: string): Footprint | null => {
      const model = modelsRef.current.get(path);
      return model === undefined ? null : footprintOf(model);
    };
    const groupOf = (thing: string): Object3D | undefined => world.root.children.find((child) => (child.userData as { owned?: string }).owned === thing);
    const fits = (thing: string, path: string, spot: Spot): boolean => misfit(stage, thing, path, spot, footprint) === null;
    const lift = (item: (typeof items)[number]): void => {
      const loaded = modelsRef.current.get(item.file);
      const group = groupOf(item.thing);
      if (loaded === undefined || group === undefined) return;
      const copy = loaded.clone(true);
      copy.position.set(item.at[0], 0, item.at[1]);
      copy.rotation.y = item.at[2];
      const box = new Box3().setFromObject(loaded);
      const shadow = liftShadow(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2);
      shadow.position.set(item.at[0], 0.025, item.at[1]);
      world.root.add(copy, shadow);
      group.visible = false;
      lifted.current = { thing: item.thing, file: item.file, from: item.at, at: item.at, good: item.at, copy, shadow, y: 0, turn: item.at[2], shake: null, down: false };
      arrangeRef.current?.onLift?.();
    };
    const setDown = (): void => {
      const held = lifted.current;
      if (held === null || held.down) return;
      held.down = true;
      if (held.good[0] === held.from[0] && held.good[1] === held.from[1] && held.good[2] === held.from[2]) {
        // Nothing moved: the copy goes and the thing stands where it stood.
        dropLifted(held.copy, held.shadow);
        const group = groupOf(held.thing);
        if (group !== undefined) group.visible = true;
        lifted.current = null;
        return;
      }
      // The room is rebuilt with the thing where it was set down; the copy stays, on the floor, until the new room stands.
      held.copy.position.set(held.good[0], 0, held.good[1]);
      held.copy.rotation.y = held.good[2];
      held.shadow.visible = false;
      arrangeRef.current?.onSet(held.thing, held.good);
    };
    const shakeBack = (held: Lifted): void => {
      held.shake = performance.now();
      held.at = held.good;
      arrangeRef.current?.onMisfit?.();
    };
    const made = items.map((item) => {
      const node = liftNode(item.thing);
      let press: { x: number; y: number; timer: number; lifting: boolean; dragged: boolean; wasLifted: boolean } | null = null;
      node.onpointerdown = (event) => {
        if (!looking) return;
        event.stopPropagation();
        node.setPointerCapture(event.pointerId);
        const wasLifted = lifted.current?.thing === item.thing && !lifted.current.down;
        // Another thing lifted is set down first.
        if (lifted.current !== null && !wasLifted) setDown();
        press = {
          x: event.clientX,
          y: event.clientY,
          wasLifted,
          lifting: false,
          dragged: false,
          timer: wasLifted
            ? 0
            : window.setTimeout(() => {
                if (press === null) return;
                press.lifting = true;
                lift(item);
              }, LIFT_HOLD_MS),
        };
      };
      node.onpointermove = (event) => {
        if (press === null) return;
        const far = Math.hypot(event.clientX - press.x, event.clientY - press.y) > LIFT_DRAG_PX;
        const held = lifted.current;
        if (held === null || held.thing !== item.thing || held.down) {
          // A press that wanders before it lifts is not a hold.
          if (far) window.clearTimeout(press.timer);
          return;
        }
        if (!far && !press.dragged) return;
        event.stopPropagation();
        press.dragged = true;
        const point = floorAt(camera, canvas, event.clientX, event.clientY);
        if (point !== null) held.at = [point[0], point[1], held.at[2]];
      };
      const release = (event: PointerEvent): void => {
        if (press === null) return;
        window.clearTimeout(press.timer);
        const was = press;
        press = null;
        const held = lifted.current;
        event.stopPropagation();
        if (held === null || held.thing !== item.thing || held.down) {
          // A quick tap on a thing with acts of its own (the TV) chooses it as any thing.
          const thing = things.find((candidate) => candidate.id === ownedThingId(item.thing));
          if (thing !== undefined && !was.lifting) pickRef.current(thing);
          return;
        }
        if (was.dragged) {
          // A drag sets the thing down where it fits, or shakes it back to where it last stood.
          if (fits(held.thing, held.file, held.at)) {
            held.good = held.at;
            setDown();
          } else shakeBack(held);
          return;
        }
        if (was.wasLifted) {
          // A tap while lifted turns it a quarter, if it fits turned.
          const next = turned(held.at);
          if (fits(held.thing, held.file, next)) {
            held.at = next;
            held.good = next;
          } else shakeBack(held);
        }
      };
      node.onpointerup = release;
      node.onpointercancel = release;
      markBox.append(node);
      return { thing: item.thing, at: item.at, node };
    });
    handles.current = made;
    const note = liftHintNode();
    markBox.append(note);
    hint.current = note;
    // A tap anywhere else sets a lifted thing down.
    const elsewhere = (event: PointerEvent): void => {
      if (lifted.current === null || lifted.current.down) return;
      if (event.target instanceof HTMLElement && event.target.dataset.lift !== undefined) return;
      setDown();
    };
    window.addEventListener("pointerdown", elsewhere, true);
    return () => {
      window.removeEventListener("pointerdown", elsewhere, true);
      for (const { node } of made) node.remove();
      note.remove();
      handles.current = [];
      hint.current = null;
      const held = lifted.current;
      if (held?.down === true) settling.current = { lifted: held, world };
      else if (held !== null) dropLifted(held.copy, held.shadow);
      lifted.current = null;
    };
    // Rebuilt with each new room; the things, the camera and the canvas are read as they stand then.
  }, [markBox, world, arranging, file]);

  // The place's lamps glow as the light goes: the bulb, the lantern, the street's few lights (R-CLOCK-033).
  useEffect(() => {
    if (world === null) return;
    const made = lampsOf(stage.light.lamps ?? []);
    for (const lamp of made) {
      glowAt(lamp, look.current?.lamps ?? 0);
      world.root.add(lamp);
    }
    lamps.current = made;
    // A room's bulb and lantern light it at night: real lights, there by day at nothing so the room's shaders never change.
    const lit = (stage.light.lamps ?? []).flatMap((lamp) => {
      if (lamp.light === undefined) return [];
      const point = new PointLight(ROOM_LIGHT.lamp, lamp.light.strength * (look.current?.lamps ?? 0), lamp.light.reach, 1.6);
      point.position.set(...lamp.at);
      world.root.add(point);
      return [{ point, strength: lamp.light.strength }];
    });
    lights.current = lit;
    return () => {
      for (const lamp of made) disposeFx(lamp);
      for (const { point } of lit) {
        point.removeFromParent();
        point.dispose();
      }
      lamps.current = [];
      lights.current = [];
    };
  }, [world, stage.light.lamps]);

  // While the bed's sleep runs a small sleep mark floats over the bed; when it ends the figure gets up beside the bed
  // (R-WORLD-025). A sleep that never laid the figure down (a walk cut it short) has nothing to get up from.
  const asleep = props.asleep ?? null;
  const sleepMark = useRef<{ spot: [number, number]; node: HTMLDivElement } | null>(null);
  const sleptOn = useRef<string | null>(null);
  useEffect(() => {
    const was = sleptOn.current;
    sleptOn.current = asleep;
    if (asleep !== null || was === null || !walk.current.lying) return;
    walk.current.lying = false;
    const bed = things.find((thing) => thing.id === was);
    // Up where the walk to the bed ended, beside it, never on the mattress.
    const spot = bed === undefined ? null : walkSpot(stage, bed, walk.current.walker);
    if (spot !== null) walk.current.walker = standAt(spot[0], spot[1], walk.current.walker.facing);
    // Only the sleep's end gets the figure up; the bed and the stage are read as they stand then.
  }, [asleep]);
  // Eyes closed: the others in the place are not seen while the sleep runs, and are back when it ends (R-WORLD-025).
  useEffect(() => {
    if (world === null) return;
    othersSeen(world, asleep === null);
  }, [world, asleep]);
  useEffect(() => {
    if (markBox === null || asleep === null) return;
    const bed = things.find((thing) => thing.id === asleep);
    const seat = bed === undefined ? undefined : bedLie(bed)?.seat;
    const spot = seat === undefined ? (bed === undefined ? null : thingSpot(stage, bed)) : ([seat[0], seat[1]] as [number, number]);
    if (spot === null) return;
    const node = sleepMarkNode();
    markBox.append(node);
    sleepMark.current = { spot, node };
    return () => {
      node.remove();
      sleepMark.current = null;
    };
  }, [asleep, markBox, things, stage]);

  // An act done at once answers where it was done for a while (R-WORLD-005): the jollof's steam, the bath's drops, the
  // television's flicker, the lantern turned up. Read from the act's own time, so a place rebuilt meanwhile keeps it.
  const acted = props.acted ?? null;
  useEffect(() => {
    if (world === null || acted === null) return;
    const now = Date.now();
    const playing = showsFor(stage, acted.activity)
      .map((show) => ({ show, to: acted.at + (show.seconds ?? 0) * 1000 }))
      .filter(({ to }) => now < to)
      .map(({ show, to }) => {
        const objects = show.motion.map((motion) => motionOf(motion, settings.mesh));
        for (const object of objects) {
          object.scale.setScalar(0.001);
          world.root.add(object);
        }
        return { objects, from: acted.at, to };
      });
    fx.current = playing;
    return () => {
      for (const { objects } of playing) for (const object of objects) disposeFx(object);
      fx.current = [];
    };
  }, [world, acted, stage, settings.mesh]);

  useEffect(() => {
    if (world === null) return;
    const spotOf = (id: string): [number, number] | null => {
      const thing = things.find((candidate) => candidate.id === id);
      return thing === undefined ? null : thingSpot(stage, thing);
    };
    const probe: CityProbe = {
      place,
      ready: true,
      drawCalls: 0,
      triangles: 0,
      frames: [],
      walker: walk.current.walker,
      people: world.crowd.length + world.dancers.length + 1,
      sheets: stage.motion.filter((motion) => SHEET_KINDS.has(motion.kind)).length,
      ...(sun.current === null ? {} : { shadow: { bias: sun.current.shadow.bias, normalBias: sun.current.shadow.normalBias, reach: sun.current.shadow.camera.right } }),
      screenOf: (slot) => {
        const placed = world.crowd.find((entry) => entry.slot === slot);
        if (placed === undefined) return null;
        const at = new Vector3();
        placed.figure.root.getWorldPosition(at);
        return onScreen(camera, size, at.x, at.y + 1.1, at.z);
      },
      screenOfModel: (suffix) => {
        // Copies are instanced at the origin, so the spot comes from the stage, not the scene graph.
        const spot = stage.models.find((model) => model.file.endsWith(suffix))?.at[0];
        return spot === undefined ? null : onScreen(camera, size, spot[0], 1.5, spot[1]);
      },
      ...(raised
        ? {
            shot,
            zoom: rig.current.zoom,
            zoomTo: rig.current.zoomTo,
            screenOfThing: (id: string) => {
              const spot = spotOf(id);
              return spot === null ? null : onScreen(camera, size, spot[0], 1, spot[1]);
            },
            room: rig.current.room,
            ease: (id: string | null) => easeTo(id === null ? null : (rooms.find((one) => one.id === id) ?? null)),
            fits: () => {
              const turn = rig.current.turn;
              const ends = widthEnds(turnsRound(shot) ? turnedShot(shot, stage.ground.size, turn) : shot, turn).every(([x, y, z]) => onScreen(camera, size, x, y, z) !== null);
              const offScreen = things.filter((thing) => {
                const spot = thingSpot(stage, thing);
                return spot === null || onScreen(camera, size, spot[0], 0, spot[1]) === null;
              });
              return { width: ends, offScreen: offScreen.map((thing) => thing.id) };
            },
          }
        : {}),
    };
    window.__city = probe;
    return () => {
      if (window.__city === probe) delete window.__city;
    };
    // The probe's ease reads the rooms of the place it was made for.
  }, [world, place, camera, size, stage, things, raised, shot, rig, rooms]);

  useFrame((state, delta) => {
    const time = advanceClock(delta);
    if (world === null) return;
    const ms = delta * 1000;
    if (looking) {
      onFrame(ms);
      frames.current = [...frames.current, ms].slice(-100);
    }
    animateWorld(world, time, delta);
    const next = stepWalk(walk.current.walker, delta, walk.current.speed);
    walk.current.walker = next;
    // Lying raises the character onto the thing and lays them on their back along it, centred on the seat with the
    // head toward the facing; sitting and standing keep the ground. The figure is laid back first, then turned, so
    // any facing lies along the thing (the couch as much as the bed).
    if (walk.current.lying) {
      const half = LIE_LENGTH / 2;
      world.own.root.position.set(next.x - Math.sin(next.facing) * half, walk.current.lieY, next.z - Math.cos(next.facing) * half);
      world.own.root.rotation.set(-Math.PI / 2, next.facing + Math.PI, 0, "YXZ");
    } else {
      world.own.root.position.set(next.x, 0, next.z);
      world.own.root.rotation.set(0, next.facing, 0, "XYZ");
    }
    if (next.target === null) poseFigure(world.own, time, walk.current.sitting ? "sit" : "stand");
    else poseFigure(world.own, time, "walk", strideOf(next));
    // The act follows once the character has reached its thing; an act with a pose is seen on the thing (R-WORLD-005).
    const waiting = walk.current.pending;
    if (waiting !== null && next.target === null) {
      walk.current.pending = null;
      // The bed's Sleep lies on the bed as its nap does, on the same seat and top (R-WORLD-025).
      const lie = waiting.act.kind === "end" && waiting.act.pose === undefined ? bedLie(waiting.thing) : null;
      const posed = lie === null ? waiting.act : { ...waiting.act, ...lie };
      const pose = posed.pose ?? (posed.kind === "plain" && posed.id === "sit" ? "sit" : null);
      if (pose !== null) {
        const seat = posed.seat;
        if (seat !== undefined) walk.current.walker = standAt(seat[0], seat[1], seat[2]);
        walk.current.sitting = pose === "sit";
        walk.current.lying = pose === "lie";
        // The figure's back rests on the top the act names (the mattress), else the old fixed height.
        walk.current.lieY = posed.top === undefined ? LIE_Y : posed.top + backDepth(world.own.root);
      }
      pick.current({ kind: "act", thing: waiting.thing, act: waiting.act });
    }
    const aspect = state.size.width / Math.max(1, state.size.height);
    const view = rig.current;
    const room = roomInView(rooms, view.room, next);
    if (raised && room !== undefined) {
      if (!view.pinching) view.zoom = easeZoom(view.zoom, view.zoomTo, delta, ROOM_EASE, ROOM_SETTLE);
      // A quarter turn and the tilt ease as the zoom does, in under 400 ms, once no finger holds them.
      if (!view.turning) {
        view.turn = easeZoom(view.turn / 90, view.turnTo / 90, delta, ROOM_EASE, ROOM_SETTLE) * 90;
        view.tilt = easeZoom(view.tilt, view.tiltTo, delta, ROOM_EASE, ROOM_SETTLE);
      }
      const { position, target, fov } = aimRoom(shot, room, view.zoom, aspect, { turn: view.turn, tilt: view.tilt, ground: stage.ground.size });
      // The walls follow the view: the far pair full, the near pair knee-high, a rising wall always behind the rooms.
      if (world.walls.size > 0) {
        const shown = wallsShown.current;
        const quarter = wallsQuarter((shot.yaw ?? 0) + view.turn, shown.world === world ? shown.quarter : quarterTurns(shot.yaw ?? 0), !view.turning && view.turn === view.turnTo);
        if (shown.world !== world || shown.quarter !== quarter) {
          showWalls(world.walls, quarter);
          wallsShown.current = { world, quarter };
        }
      }
      state.camera.position.set(...position);
      state.camera.lookAt(...target);
      lens(state.camera, fov, SHOT_NEAR_PLANE);
      // Once the camera has eased in on its room, the thing chosen opens there.
      const waiting = deferred.current;
      if (waiting !== null && view.zoom === view.zoomTo) {
        deferred.current = null;
        chooseRef.current(waiting);
      }
    } else if (raised) {
      if (!view.pinching) view.zoom = easeZoom(view.zoom, view.zoomTo, delta, EASE, SETTLE);
      const { position, target } = aimShot(shot, view, next, aspect);
      state.camera.position.set(...position);
      state.camera.lookAt(...target);
      lens(state.camera, SHOT_FOV, SHOT_NEAR_PLANE);
    } else {
      planShare.current += (plan - planShare.current) * Math.min(1, delta * 4);
      aimStreet(state.camera, next, stage.start[2], planShare.current, aspect);
      lens(state.camera, FOV, 0.1);
    }
    if (state.scene.fog instanceof Fog) {
      if (raised) {
        // The raised view stands far back, so the fog starts beyond the place and only softens the edge of the city.
        const distance = state.camera.position.distanceTo(new Vector3(...shot.centre));
        state.scene.fog.near = distance + 30;
        state.scene.fog.far = distance * 2 + 90;
      } else {
        state.scene.fog.near = settings.fog.near + planShare.current * PLAN_FOG;
        state.scene.fog.far = settings.fog.far + planShare.current * PLAN_FOG;
      }
    }
    // The day's light eases toward the clock's look over about 600 ms, colour and strength only (R-CLOCK-033).
    const was = look.current;
    const day = was === null ? target : settled(was, target) ? target : mixLooks(was, target, 1 - Math.exp(-delta * DAY_EASE), ownHeightOf(stage.light.sun));
    look.current = day;
    const lit = daylit.current;
    if (lit.look !== day) {
      lit.look = day;
      lit.sun = sunAt(stage.light.sun, day);
      // Every place's sky is the layer's pale one and its sky light cool; a room's and an office's floor bounce warm, a
      // street's its own ground (the design). The pale sky stands behind in place of the old sand haze,
      // and a street's fog fades its far end into that sky; the clock tints it, so the night stays blue.
      lit.sky.copy(skyOf(new Color(placeLight.backdrop), day));
      lit.light.copy(skyLightOf(new Color(placeLight.sky), day));
      lit.ground.copy(placeLight.ground === null ? colourOf(stage.light.ground) : new Color(placeLight.ground)).multiplyScalar(day.groundShare);
      lit.background.copy(lit.sky);
      lit.fog.copy(lit.sky);
      for (const lamp of lamps.current) glowAt(lamp, day.lamps);
      for (const { point, strength } of lights.current) point.intensity = strength * day.lamps;
    }
    const light = sun.current;
    if (light !== null) {
      // In the world the sun stands over the place's centre, so its shadow covers the place and only the place (R-WORLD-012).
      const [cx, , cz] = raised ? shot.centre : [next.x, 0, next.z];
      light.position.set(cx + lit.sun[0], lit.sun[1], cz + lit.sun[2]);
      light.target.position.set(cx, 0, cz);
      light.target.updateMatrixWorld();
      light.color.setHex(day.sun);
      light.intensity = day.sunStrength;
      light.shadow.radius = day.softness;
    }
    const sky = skyLight.current;
    if (sky !== null) {
      sky.color.copy(lit.light);
      sky.groundColor.copy(lit.ground);
      sky.intensity = day.skyStrength;
    }
    if (state.scene.background instanceof Color) state.scene.background.copy(lit.background);
    if (state.scene.fog instanceof Fog) state.scene.fog.color.copy(lit.fog);
    // An act's answer grows in where it stands and goes again, on its scale alone.
    const clock = Date.now();
    for (const { objects, from, to } of fx.current) {
      const grown = Math.max(0.001, Math.min(1, (clock - from) / FX_MS, (to - clock) / FX_MS));
      for (const object of objects) object.scale.setScalar(grown);
    }
    // A label or the marker near the screen's edge is held inside it, since it is centred on its thing.
    const within = (x: number, node: HTMLElement): number => {
      const half = node.offsetWidth / 2 + EDGE_MARGIN;
      return Math.min(Math.max(x, half), Math.max(half, state.size.width - half));
    };
    // A person's words stand over them as the camera moves (R-WORLD-005): the bubble follows its speaker, whose label gives way to it.
    const bubble = document.querySelector<HTMLElement>("[data-speech]");
    const speaker = bubble === null ? undefined : things.find((thing) => thing.id === bubble.dataset.speech);
    // The street's line is given to the resident nearest the player's figure, and only while one stands near (the talk budget).
    const nearest = bubble?.dataset.speech === NEAR_SPEAKER ? nearestResident(world, next.x, next.z) : null;
    const voice = nearest ?? (speaker === undefined ? null : thingSpot(stage, speaker));
    if (bubble !== null) {
      if (voice === null) bubble.style.visibility = "hidden";
      else {
        const at = new Vector3(voice[0], LABEL_Y, voice[1]).project(state.camera);
        const bandBottom = document.querySelector("[data-band]")?.getBoundingClientRect().bottom ?? 0;
        const spot = bubbleSpot(at, state.size, { width: bubble.offsetWidth, height: bubble.offsetHeight }, bandBottom);
        bubble.style.transform = `translate(${String(spot.x)}px, ${String(spot.y)}px)`;
        bubble.style.visibility = spot.shown ? "visible" : "hidden";
      }
    }
    // The emotes stand over the residents they belong to, held over them as they idle (the talk budget's pictures).
    for (const node of document.querySelectorAll<HTMLElement>("[data-emote-slot]")) {
      const placed = world?.crowd.find((entry) => String(entry.slot) === node.dataset.emoteSlot);
      if (placed === undefined) {
        node.style.visibility = "hidden";
        continue;
      }
      placed.figure.root.getWorldPosition(emoteAt);
      const at = onScreen(state.camera, state.size, emoteAt.x, emoteAt.y + EMOTE_Y, emoteAt.z, 1.05);
      node.style.visibility = at === null ? "hidden" : "visible";
      if (at !== null) node.style.transform = `translate(${String(at.x)}px, ${String(at.y)}px)`;
    }
    // The fan follows its thing as the camera eases, as the marks do, and says where the thing first stood so the fan can
    // lay out its buttons once (docs/design/13-the-lively-layer.md section 3); off the screen it hides until the thing is back.
    const fan = document.querySelector<HTMLElement>("[data-fan]");
    const fanned = fan === null ? undefined : things.find((thing) => thing.id === fan.dataset.fan);
    if (fan !== null) {
      const spot = fanned === undefined ? null : thingSpot(stage, fanned);
      const at = spot === null ? null : onScreen(state.camera, state.size, spot[0], FAN_Y, spot[1]);
      anchorFan(fan.dataset.fan ?? "", at);
      fan.style.visibility = at === null ? "hidden" : "";
      if (at !== null) fan.style.transform = `translate(${String(at.x)}px, ${String(at.y)}px)`;
    }
    // The marker on the step's thing stands over it, its ring at the thing's feet, as the camera eases (the brief, design
    // page 13 section 4); off the screen both hide until the thing is back.
    const marker = document.querySelector<HTMLElement>("[data-marker]");
    const ring = document.querySelector<HTMLElement>("[data-marker-ring]");
    const markedId = marker?.dataset.marker ?? ring?.dataset.markerRing ?? null;
    const marked = markedId === null ? undefined : things.find((thing) => thing.id === markedId);
    const markSpot = marked === undefined ? null : thingSpot(stage, marked);
    for (const [node, height] of [
      [marker, LABEL_Y],
      [ring, 0.05],
    ] as const) {
      if (node === null) continue;
      const at = markSpot === null ? null : onScreen(state.camera, state.size, markSpot[0], height, markSpot[1], 1.05);
      node.style.visibility = at === null ? "hidden" : "visible";
      if (at !== null) node.style.transform = `translate(${String(node === marker ? within(at.x, node.firstElementChild instanceof HTMLElement ? node.firstElementChild : node) : at.x)}px, ${String(at.y)}px)`;
    }
    const laid: { node: HTMLElement; box: LabelBox }[] = [];
    for (const { thing, node } of labels.current) {
      const spot = thingSpot(stage, thing);
      const at = spot === null || fanned?.id === thing.id || marked?.id === thing.id || (voice !== null && speaker?.id === thing.id) ? null : onScreen(state.camera, state.size, spot[0], LABEL_Y, spot[1], 1.05);
      // No mark while the opening words stand over the world (R-WORLD-001).
      node.style.display = at === null || labelsHidden ? "none" : "";
      if (at !== null && !labelsHidden) laid.push({ node, box: { x: within(at.x, node), y: at.y, width: node.offsetWidth, height: node.offsetHeight } });
    }
    // Labels that would cover each other are lifted clear.
    const feet = spreadLabels(laid.map((one) => one.box));
    laid.forEach(({ node, box }, index) => {
      node.style.left = `${String(box.x)}px`;
      node.style.top = `${String(feet[index] ?? box.y)}px`;
    });
    // Buy mode: the lifted thing rides up off the floor and follows the finger, turns and shakes back with short eases,
    // and the hold areas and the hint follow the things as the camera moves.
    const held = lifted.current;
    if (held !== null) {
      const easing = 1 - Math.exp(-delta * 18);
      held.y += ((held.down ? 0 : LIFT_Y) - held.y) * easing;
      let turnBy = held.at[2] - held.turn;
      while (turnBy > Math.PI) turnBy -= Math.PI * 2;
      while (turnBy < -Math.PI) turnBy += Math.PI * 2;
      held.turn += turnBy * easing;
      const shaking = held.shake === null ? 0 : (performance.now() - held.shake) / SHAKE_MS;
      if (shaking >= 1) held.shake = null;
      const wobble = held.shake === null ? 0 : Math.sin(shaking * Math.PI * 6) * 0.12 * (1 - shaking);
      const x = held.copy.position.x + (held.at[0] - held.copy.position.x) * (held.shake === null ? 1 : easing) + wobble;
      const z = held.copy.position.z + (held.at[1] - held.copy.position.z) * (held.shake === null ? 1 : easing);
      held.copy.position.set(x, held.y, z);
      held.copy.rotation.y = held.turn;
      held.shadow.position.set(x, 0.025, z);
    }
    for (const handle of handles.current) {
      const spot = held !== null && held.thing === handle.thing ? [held.copy.position.x, held.copy.position.z] : [handle.at[0], handle.at[1]];
      const at = onScreen(state.camera, state.size, spot[0] ?? 0, 0.5, spot[1] ?? 0, 1.05);
      handle.node.style.display = at === null || labelsHidden ? "none" : "";
      handle.node.dataset.lifted = held !== null && held.thing === handle.thing && !held.down ? "true" : "false";
      if (at !== null) {
        handle.node.style.left = `${String(at.x)}px`;
        handle.node.style.top = `${String(at.y)}px`;
      }
    }
    const note = hint.current;
    if (note !== null) {
      const at = held === null || held.down ? null : onScreen(state.camera, state.size, held.copy.position.x, 0, held.copy.position.z, 1.05);
      note.style.display = at === null ? "none" : "";
      if (at !== null) {
        note.style.left = `${String(within(at.x, note))}px`;
        note.style.top = `${String(at.y + 30)}px`;
      }
    }
    const sleeping = sleepMark.current;
    if (sleeping !== null) {
      const at = onScreen(state.camera, state.size, sleeping.spot[0], SLEEP_MARK_Y, sleeping.spot[1], 1.05);
      sleeping.node.style.display = at === null ? "none" : "";
      if (at !== null) {
        sleeping.node.style.left = `${String(at.x)}px`;
        sleeping.node.style.top = `${String(at.y)}px`;
      }
    }
    const probe = window.__city;
    if (probe !== undefined) {
      probe.drawCalls = gl.info.render.calls;
      probe.triangles = gl.info.render.triangles;
      probe.frames = frames.current;
      probe.walker = next;
      if (raised) {
        probe.zoom = view.zoom;
        probe.zoomTo = view.zoomTo;
        probe.room = room?.id ?? null;
        probe.turn = view.turn;
        probe.tilt = view.tilt;
        probe.walls = wallsShown.current.world === world ? wallsShown.current.quarter : null;
      }
    }
  });

  /**
   * A tap on a wide home's floor or walls (R-WORLD-029 as the home's wave asks it amended): from the whole house it eases
   * in on the room tapped; eased in, a tap outside the room eases back out to the whole house. True when the tap was
   * the camera's; a tap inside the room eased in on walks as anywhere.
   */
  const roomTap = (x: number, z: number): boolean => {
    const whole = rig.current.zoomTo === 1;
    const tap = homeTap(rooms, whole, roomInView(rooms, rig.current.room, walk.current.walker), x, z);
    if (tap.kind === "in") easeTo(tap.room);
    if (tap.kind === "out") {
      deferred.current = null;
      easeTo(null);
    }
    // From the whole house even a tap past every room only looks: nothing walks until the camera is in.
    return tap.kind !== "walk" || whole;
  };

  const tapped = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    if (!looking || takeTap()) return;
    // A second tap while an act waits on a walk ends the walk at once (R-WORLD-010).
    if (walk.current.pending !== null && walk.current.walker.target !== null) {
      walk.current.walker = stepWalk(walk.current.walker, 3600, walk.current.speed);
      return;
    }
    const hit = hitOf(event.object);
    // A person standing at a thing of their own is that thing (R-WORLD-020).
    if (hit?.kind === "stander") {
      const thing = things.find((candidate) => candidate.id === hit.thing);
      if (thing !== undefined) choose(thing);
      return;
    }
    let picked: ScenePick | null = hit;
    if (hit?.kind === "model") {
      // Which copy was tapped: the one standing nearest the point the ray met.
      const copies = stage.models.find((model) => model.file === hit.file)?.at ?? [];
      let copy = -1;
      let best = Infinity;
      copies.forEach(([x, z], index) => {
        const far = Math.hypot(x - event.point.x, z - event.point.z);
        if (far < best) [best, copy] = [far, index];
      });
      const thing = things.find((candidate) => candidate.file === hit.file && candidate.copy === copy);
      if (thing !== undefined) {
        if (window.__city !== undefined) window.__city.lastTap = { picked: { kind: "thing", thing }, action: thing.acts[0]?.stages ?? thing.acts[0]?.kind ?? null };
        pickThing(thing);
        return;
      }
      // A wide home's walls: a tap on them is a tap on the room they stand in, and inside the room eased in on, a walk.
      if (rooms.length > 0 && hit.signs.length === 0) {
        if (roomTap(event.point.x, event.point.z)) return;
        picked = null;
      } else {
        // A shopfront with its signs opens a card; any other model is not a place to walk to.
        picked = hit.signs.length > 0 ? hit : null;
        if (picked === null) return;
      }
    }
    if (window.__city !== undefined) window.__city.lastTap = { picked, action: null };
    if (picked !== null) {
      // Someone in a wide home seen whole: the camera eases in on their room as their card opens.
      const room = rooms.length > 0 && rig.current.zoomTo === 1 ? roomAt(rooms, event.point.x, event.point.z) : null;
      if (room !== null) easeTo(room);
      onPick(picked);
      return;
    }
    if (world === null) return;
    if (rooms.length > 0 && roomTap(event.point.x, event.point.z)) return;
    walk.current.pending = null;
    props.onClear?.();
    const point = { x: event.point.x, z: event.point.z };
    // The roaming city routes round the things in the way; the world walks straight, and only on its walkable ground.
    if (world.routes !== null) walk.current.walker = walkRoute(walk.current.walker, findRoute(world.routes, walk.current.walker, point));
    else if (onWalkable(walkableOf(stage), point.x, point.z)) {
      walk.current.walker = walkTo(walk.current.walker, point.x, point.z);
      walk.current.sitting = false;
      walk.current.lying = false;
    }
  };

  // The first frame's colours, before the clock's look eases in: the layer's pale sky behind and in the fog.
  const { sky, background, fog } = useMemo(() => ({ sky: new Color(placeLight.sky), background: new Color(placeLight.backdrop), fog: new Color(placeLight.backdrop) }), [placeLight]);
  const reach = raised ? Math.max(shot.width ?? 0, 16) / 2 + SHADOW_MARGIN : 24;
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[fog, settings.fog.near, settings.fog.far]} />
      <hemisphereLight ref={skyLight} args={[sky, colourOf(stage.light.ground), 1.1]} />
      <directionalLight
        ref={sun}
        intensity={target.sunStrength}
        color={target.sun}
        castShadow={settings.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={SHADOW_BIAS}
        shadow-normalBias={SHADOW_NORMAL_BIAS}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        shadow-camera-far={140}
      />
      {world === null ? null : <primitive object={world.root} onClick={tapped} />}
    </>
  );
}

/** `children` stand in the scene beside the place: the bag by the door (R-WORLD-029). */
export default function CityScene(props: SceneProps & { children?: ReactNode }) {
  const [plan, setPlan] = useState(false);
  const pinch = useRef<{ gap: number; zoom: number } | null>(null);
  /** One finger on the view: where it went down, the turn and the tilt then, and which way it moves once it has moved. */
  const drag = useRef<{ x: number; y: number; turn: number; tilt: number; axis: "turn" | "tilt" | null } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const { settings, looking, file, zoomed = false, onZoomed, onTurned } = props;
  const day = useDayClock(props.worldClock ?? null);
  const raised = props.overview === true && props.roam !== true;
  const shot = useMemo(() => roomShot(shotOf(stageOf(file)), stageOf(file), file.scope), [file]);
  // A wide home's rooms, which the pinch and the wheel ease in on (R-WORLD-029 as the home's wave asks it amended).
  const rooms = useMemo(() => (raised ? (stageOf(file).rooms ?? []) : []), [raised, file]);
  // A wide home turns the full circle and opens on the quarter it was left on.
  const round = raised && turnsRound(shot);
  const keptTurn = (props.turn ?? 0) * 90;
  const rig = useRef<Rig>(wholeRig(round ? keptTurn : 0));
  const keptTurnRef = useRef(keptTurn);
  keptTurnRef.current = keptTurn;
  const roundRef = useRef(round);
  roundRef.current = round;
  const walk = useRef<WalkState>({ walker: standAt(0, 0, 0), pending: null, standing: null, sitting: false, lying: false, lieY: LIE_Y, speed: WALK_SPEED });
  const [markBox, setMarkBox] = useState<HTMLDivElement | null>(null);
  const holding = useRef<number | null>(null);
  const held = useRef(false);
  // Entering a place, or a room, always shows the whole of it (R-WORLD-009); the same place shown anew, dressed or with
  // what the month's acts show, keeps the view the player made, so a home eased in on stays on its room.
  useEffect(() => {
    rig.current = wholeRig(roundRef.current ? keptTurnRef.current : 0);
  }, [file.place, file.scope]);
  // The turn button's quarter: the view eases round to it the short way.
  const quarter = props.turn;
  useEffect(() => {
    if (!round || quarter === undefined || quarterTurns(rig.current.turnTo) === quarter) return;
    rig.current.turnTo = turnToward(rig.current.turn, quarter);
  }, [round, quarter]);
  // The shell's chip "See the whole place" sends the view back; the pinch reports where it rests.
  useEffect(() => {
    rig.current.zoomTo = zoomed ? 0 : 1;
  }, [zoomed]);
  const rest = (to: 0 | 1): void => {
    rig.current.zoomTo = to;
    rig.current.pinching = false;
    onZoomed?.(to === 0);
  };
  const release = (): void => {
    if (holding.current !== null) window.clearTimeout(holding.current);
    holding.current = null;
    setPlan(false);
  };
  // A wide home's finger lifts: a turn comes to rest on the nearest quarter and the tilt on the normal view or the view
  // from above, each easing there.
  const settleDrag = (): void => {
    const was = drag.current;
    drag.current = null;
    if (!roundRef.current || was === null || was.axis === null) return;
    rig.current.turning = false;
    if (was.axis === "tilt") {
      rig.current.tiltTo = snapTilt(rig.current.tilt);
      return;
    }
    rig.current.turnTo = snapTurn(rig.current.turn);
    onTurned?.(quarterTurns(rig.current.turnTo));
  };
  return (
    <div
      className="relative size-full touch-none"
      data-shot={raised ? "raised" : "street"}
      onPointerDown={(event) => {
        if (!looking) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (raised) {
          if (pointers.current.size === 1) {
            held.current = false;
            drag.current = { x: event.clientX, y: event.clientY, turn: rig.current.turn, tilt: rig.current.tilt, axis: null };
          }
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            if (a !== undefined && b !== undefined) pinch.current = { gap: Math.hypot(a.x - b.x, a.y - b.y), zoom: rig.current.zoom };
            rig.current.pinching = true;
            // From the whole house a pinch closes in on the room the character stands in.
            if (rooms.length > 0 && rig.current.zoomTo === 1) rig.current.room = roomInView(rooms, null, walk.current.walker)?.id ?? null;
            settleDrag();
            held.current = true;
          }
          return;
        }
        held.current = false;
        holding.current = window.setTimeout(() => {
          held.current = true;
          setPlan(true);
        }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        if (!raised || !pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const start = pinch.current;
        if (start !== null && pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()];
          if (a === undefined || b === undefined) return;
          // Fingers apart bring the view closer; together pull it back.
          const gap = Math.hypot(a.x - b.x, a.y - b.y);
          rig.current.zoom = Math.min(1, Math.max(0, start.zoom - (gap - start.gap) / PINCH_PX));
          return;
        }
        const turning = drag.current;
        if (turning === null) return;
        const moved = event.clientX - turning.x;
        const lifted = event.clientY - turning.y;
        if (turning.axis === null) {
          if (Math.max(Math.abs(moved), Math.abs(lifted)) < DRAG_PX && !held.current) return;
          // A wide home's finger turns the view sideways and tilts it up or down, whichever way it first moved.
          turning.axis = round && Math.abs(lifted) > Math.abs(moved) ? "tilt" : "turn";
        }
        held.current = true;
        if (!round) {
          rig.current.turn = clampTurn(shot, turning.turn - moved * TURN_PER_PX);
          return;
        }
        rig.current.turning = true;
        if (turning.axis === "tilt") rig.current.tilt = Math.min(1, Math.max(0, turning.tilt - lifted / TILT_PX));
        else rig.current.turn = turning.turn - moved * HOME_TURN_PER_PX;
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pinch.current !== null && pointers.current.size < 2) {
          pinch.current = null;
          rest(snapZoom(rig.current.zoom));
        }
        if (pointers.current.size === 0) settleDrag();
        release();
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        if (pinch.current !== null) {
          pinch.current = null;
          rest(snapZoom(rig.current.zoom));
        }
        settleDrag();
        release();
      }}
      onPointerLeave={release}
      onWheel={(event) => {
        if (!raised || !looking || event.deltaY === 0) return;
        if (rooms.length > 0 && event.deltaY < 0 && rig.current.zoomTo === 1) rig.current.room = roomInView(rooms, null, walk.current.walker)?.id ?? null;
        rest(event.deltaY < 0 ? 0 : 1);
      }}
    >
      <Canvas
        key={settings.antialias ? "smooth" : "plain"}
        dpr={settings.pixelRatio}
        gl={{ antialias: settings.antialias, powerPreference: "high-performance" }}
        shadows={settings.shadows ? "percentage" : false}
        frameloop={looking ? "always" : "demand"}
        camera={{ fov: FOV, near: 0.1, far: 240, position: [0, EYE, BEHIND] }}
        aria-hidden
        // A tap on nothing at all, past a wide home's walls, eases back out to the whole house.
        onPointerMissed={() => {
          if (rooms.length === 0 || !looking || held.current || rig.current.zoomTo === 1) return;
          rest(1);
        }}
      >
        <Idle looking={looking} />
        <Place
          {...props}
          markBox={markBox}
          plan={plan ? 1 : 0}
          rig={rig}
          walk={walk}
          shot={shot}
          raised={raised}
          day={day}
          takeTap={() => {
            const was = held.current;
            held.current = false;
            return was;
          }}
        />
        {props.children}
      </Canvas>
      <div ref={setMarkBox} className="pointer-events-none absolute inset-0" aria-hidden={props.things === undefined} data-marks />
    </div>
  );
}
