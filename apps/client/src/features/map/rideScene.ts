// The ride's scene (docs/rules/world.md R-WORLD-017, R-WORLD-032): the street the ride goes along,
// the vehicle, and the people on it. A ride by danfo, keke or okada opens on a short pre-roll outside
// at the stop (the okada at the kerb with the character climbing on behind the rider, the keke with
// its driver and the character on the back bench, the danfo at its door with the two in front), then
// cuts by itself on its own clock: from above, then for the danfo the window and the seat inside it,
// and on a keke or an okada the rider ahead and the open street. On foot there is no pre-roll: the
// character walks, seen from above. Everything here is plain three.js with no renderer, so a test can
// read the scene it builds.
import { palette } from "@japacity/assets";
import type { PoseName } from "@japacity/assets-src/people/poses";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { blendFigure, type Figure, figureOf, poseFigure } from "../../shared/three/people";
import type { RideChoice } from "../../shared/world/contract";
import { sequence } from "./layout";

export type Way = RideChoice["id"];

/** How long a ride plays, pre-roll and all: about six seconds (R-WORLD-017). */
export const RIDE_MS = 6000;
/** The pre-roll before a ride by danfo, keke or okada: at most a second and a half (R-WORLD-017). */
export const PRE_MS = 1400;

/** The pre-roll's length for a way: none on foot. */
export function preMsOf(way: Way): number {
  return way === "walk" ? 0 : PRE_MS;
}

/** Who rides: the character, the okada's rider, or the keke's or danfo's driver. */
export type Role = "own" | "rider" | "driver";

/** The two parts of a ride: the close pre-roll, then the ride itself. */
export type Phase = "pre" | "ride";

/**
 * Where the ride is watched from (R-WORLD-032): outside at the stop, from above, the danfo's window
 * and seat, and on a keke or an okada the rider ahead. The ride picks them on its own clock.
 */
export type Angle = "outside" | "above" | "window" | "seat" | "ahead";

/** The most the ride's clock moves in one frame, so a slow frame never jumps the ride ahead (R-WORLD-032). */
export const STEP_MS = 100;

/** The ride's clock after a frame `dt` milliseconds long: the step clamped, never past the ride's end. */
export function stepClock(ms: number, dt: number): number {
  return Math.min(RIDE_MS, ms + Math.min(STEP_MS, Math.max(0, dt)));
}

/** The angles a way shows, each from the moment it starts: the pre-roll outside, then the rest of the ride shared out. */
export function anglesOf(way: Way): readonly { angle: Angle; from: number }[] {
  const rest = RIDE_MS - PRE_MS;
  switch (way) {
    case "danfo":
      return [
        { angle: "outside", from: 0 },
        { angle: "above", from: PRE_MS },
        { angle: "window", from: PRE_MS + Math.round(rest / 3) },
        { angle: "seat", from: PRE_MS + Math.round((rest * 2) / 3) },
      ];
    case "keke":
    case "okada":
      return [
        { angle: "outside", from: 0 },
        { angle: "above", from: PRE_MS },
        { angle: "ahead", from: PRE_MS + Math.round(rest / 2) },
      ];
    case "walk":
      return [{ angle: "above", from: 0 }];
    default: {
      const never: never = way;
      throw new Error(`Unknown way: ${String(never)}`);
    }
  }
}

/** The angle on screen `ms` after the ride began. */
export function angleAt(way: Way, ms: number): Angle {
  let angle: Angle = "above";
  for (const part of anglesOf(way)) if (ms >= part.from) angle = part.angle;
  return angle;
}

/** How long the screen holds fully dark at a cut, and how long it takes to darken and to clear either side. */
const CUT_HOLD_MS = 80;
const CUT_FADE_MS = 120;
/** A cut's whole dark, darkening, held and clearing: under half a second, as R-WORLD-013's cut. */
export const CUT_DARK_MS = CUT_HOLD_MS + 2 * CUT_FADE_MS;

/** How dark the screen is `ms` after the ride began, 0 clear to 1 dark: dark only around a cut between angles. */
export function darkAt(way: Way, ms: number): number {
  let dark = 0;
  for (const part of anglesOf(way).slice(1)) {
    const off = Math.abs(ms - part.from) - CUT_HOLD_MS / 2;
    dark = Math.max(dark, off <= 0 ? 1 : 1 - off / CUT_FADE_MS);
  }
  return Math.max(0, dark);
}

/** Metres covered after the pre-roll; on foot a short way, so the stride reads as a walk. */
const TRAVEL = 150;
const WALK_TRAVEL = 30;
const STREET = 240;
/** The lane the ride keeps, kerb side of the road's middle; on foot, the verge beyond the kerb. */
const LANE_X = 1.8;
const VERGE_X = 4.8;
/** The danfo pulls away during its pre-roll, in metres a second squared. */
const PULL = 3;

const RIDER = "shared/chr/chr_rider.glb";
/** The keke's and the danfo's drivers, the second where the character is the first. */
const DRIVERS: Record<"keke" | "danfo", readonly [string, string]> = {
  keke: ["shared/chr/chr_kunle.glb", "shared/chr/chr_segun.glb"],
  danfo: ["shared/chr/chr_segun.glb", "shared/chr/chr_kunle.glb"],
};

/**
 * Where each person sits, in the vehicle's own frame: facing +z, the ground at y 0, the kerb on -x.
 * Heights are the figure's feet; the poses put the hips on the seat (assets-src/people/poses.ts).
 */
interface SeatSpec {
  role: Role;
  at: [number, number, number];
  pose: PoseName;
}

function seatsOf(way: Way): SeatSpec[] {
  switch (way) {
    case "okada":
      return [
        { role: "rider", at: [0, 0.08, -0.1], pose: "ride" },
        { role: "own", at: [0, 0.09, -0.48], pose: "pillion" },
      ];
    case "keke":
      return [
        { role: "driver", at: [0, 0.1, 0.2], pose: "ride" },
        { role: "own", at: [-0.25, 0.4, -0.7], pose: "sit" },
      ];
    case "danfo":
      return [
        { role: "driver", at: [0.42, 0.18, 1.2], pose: "ride" },
        { role: "own", at: [-0.44, 0.47, 1.2], pose: "sit" },
      ];
    case "walk":
      return [{ role: "own", at: [0, 0, 0], pose: "walk" }];
    default: {
      const never: never = way;
      throw new Error(`Unknown way: ${String(never)}`);
    }
  }
}

/** The people files a ride shows, by role: the character's own, and the rider or driver who carries them. */
export function peopleOf(way: Way, own: string): Partial<Record<Role, string>> {
  switch (way) {
    case "okada":
      return { own, rider: own === RIDER ? DRIVERS.keke[0] : RIDER };
    case "keke":
    case "danfo": {
      const [first, second] = DRIVERS[way];
      return { own, driver: own === first ? second : first };
    }
    case "walk":
      return { own };
    default: {
      const never: never = way;
      throw new Error(`Unknown way: ${String(never)}`);
    }
  }
}

export interface Seat {
  role: Role;
  /** Where the person sits; empty until their model has loaded, and counted as a figure from the start. */
  group: Group;
  pose: PoseName;
  figure: Figure | null;
}

export interface RideScene {
  scene: Scene;
  camera: PerspectiveCamera;
  /** Moves along the street; holds the vehicle and its people. */
  vehicle: Group;
  seats: Seat[];
  /** The vehicle's model is in; the stand-in goes. */
  setVehicle: (model: Object3D) => void;
  /** A person's model is in: their figure takes their seat. */
  setPerson: (role: Role, model: Object3D) => void;
  /** Shows the scene as the part's first angle shows it, until a frame says otherwise. */
  setPhase: (phase: Phase) => void;
  /** Shows what an angle shows: the danfo's model from outside and above, its inside from the window and the seat. */
  setAngle: (angle: Angle) => void;
  /** Poses everything and places the camera `ms` after the ride began, at the angle the ride's clock gives. */
  frame: (ms: number, aspect: number) => void;
  dispose: () => void;
}

/** The figure groups drawn on the vehicle now, by role. */
export function figuresOn(ride: RideScene): Role[] {
  return ride.seats.filter((seat) => seat.group.visible).map((seat) => seat.role);
}

/** A plain box in the way's colour until the real model arrives (or where it cannot); on foot, a body-sized one until the character's figure arrives. */
function standIn(way: Way): Mesh {
  const size = way === "danfo" ? [2.1, 2.2, 5.2] : way === "keke" ? [1.4, 1.7, 2.6] : way === "walk" ? [0.5, 1.7, 0.4] : [0.7, 1.3, 1.9];
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), new MeshLambertMaterial({ color: way === "okada" ? palette.red : way === "walk" ? palette.charcoal : palette.danfoYellow }));
  mesh.position.y = (size[1] ?? 1) / 2;
  return mesh;
}

/** One box of the cab, placed and turned about x, ready to merge with its colour's others. */
function part(w: number, h: number, d: number, x: number, y: number, z: number, tilt = 0): BufferGeometry {
  const box = new BoxGeometry(w, h, d);
  if (tilt !== 0) box.rotateX(tilt);
  box.translate(x, y, z);
  return box;
}

/**
 * The danfo from inside, in its own frame: the dashboard, the windscreen's pillars and header, the
 * roof, both front doors with their sills, the bench, the wheel and the kerb mirror, and behind them
 * the sides with their yellow pillars and the sliding windows' rail, and the floor. One draw call.
 * Seen only from the window and the seat; outside and above the danfo is its model.
 */
function buildCab(keep: <T extends { dispose: () => void }>(thing: T) => T): Group {
  const cab = new Group();
  const slant = -0.37;
  const body = [
    part(0.08, 0.92, 0.08, 0.84, 1.52, 2.11, slant),
    part(0.08, 0.92, 0.08, -0.84, 1.52, 2.11, slant),
    part(1.76, 0.12, 0.16, 0, 1.93, 1.92),
    part(1.76, 0.04, 1.8, 0, 1.99, 1.05),
    part(0.06, 0.78, 1.4, 0.86, 0.83, 1.3),
    part(0.06, 0.78, 1.4, -0.86, 0.83, 1.3),
    part(0.08, 0.72, 0.08, 0.86, 1.61, 0.62),
    part(0.08, 0.72, 0.08, -0.86, 1.61, 0.62),
    // The roof back to the rear door, and each side's panel under the windows and band over them.
    part(1.76, 0.04, 2.6, 0, 1.99, -1.0),
    ...[0.86, -0.86].flatMap((x) => [part(0.06, 0.6, 2.9, x, 0.75, -0.85), part(0.06, 0.12, 2.9, x, 1.91, -0.85)]),
    // The pillars between the sliding windows.
    ...[0.86, -0.86].flatMap((x) => [-2.0, -1.2, -0.4].map((z) => part(0.08, 0.8, 0.1, x, 1.45, z))),
  ];
  const rail = [0.88, -0.88].map((x) => part(0.04, 0.04, 2.9, x, 1.45, -0.85));
  const wheel = new TorusGeometry(0.19, 0.025, 4, 14);
  wheel.rotateX(-0.75);
  wheel.translate(0.42, 1.24, 1.66);
  const trim = [
    part(1.72, 0.3, 0.46, 0, 0.97, 2.02),
    part(0.1, 0.04, 1.4, 0.86, 1.23, 1.3),
    part(0.1, 0.04, 1.4, -0.86, 1.23, 1.3),
    part(0.05, 0.18, 0.12, -1.06, 1.46, 1.9),
    wheel,
  ];
  const seat = [part(1.62, 0.12, 0.5, 0, 0.84, 1.18), part(1.62, 0.36, 0.1, 0, 1.08, 0.9), part(1.7, 0.04, 4.4, 0, 0.44, -0.1)];
  // One draw call: each piece carries its colour in its vertices.
  const pieces: BufferGeometry[] = [];
  for (const [group, colour] of [
    [body, palette.danfoYellow],
    [trim, palette.charcoal],
    [seat, palette.seat],
    [rail, palette.hub],
  ] as const) {
    const tint = new Color(colour);
    for (const piece of group) {
      const flat = piece.toNonIndexed();
      piece.dispose();
      const count = flat.getAttribute("position").count;
      const colours = new Float32Array(count * 3);
      for (let index = 0; index < count; index += 1) colours.set([tint.r, tint.g, tint.b], index * 3);
      flat.setAttribute("color", new BufferAttribute(colours, 3));
      pieces.push(flat);
    }
  }
  const merged = keep(mergeGeometries(pieces, false));
  for (const piece of pieces) piece.dispose();
  cab.add(new Mesh(merged, keep(new MeshLambertMaterial({ vertexColors: true }))));
  cab.name = "cab";
  return cab;
}

const ease = (share: number): number => {
  const s = Math.min(1, Math.max(0, share));
  return s * s * (3 - 2 * s);
};

/** Sets a bone of a figure outright, over its pose. */
function setBone(figure: Figure, name: string, x: number, y: number, z: number): void {
  figure.bones.get(name)?.rotation.set(x, y, z);
}

/** Turns a bone of a figure a little further than its pose. */
function turnBone(figure: Figure, name: string, x: number, y: number, z: number): void {
  const bone = figure.bones.get(name);
  if (bone === undefined) return;
  bone.rotation.x += x;
  bone.rotation.y += y;
  bone.rotation.z += z;
}

/** The street, the vehicle and its seats, for the way given. */
export function buildRide(way: Way): RideScene {
  const scene = new Scene();
  const air = new Color(palette.sky);
  scene.background = air;
  scene.fog = new Fog(air, 60, 140);
  scene.add(new HemisphereLight(0xffffff, new Color(palette.sand), 1.8));
  const sun = new DirectionalLight(0xfff0d0, 1.5);
  sun.position.set(-20, 40, 10);
  scene.add(sun);
  const camera = new PerspectiveCamera(42, 1, 0.5, 400);
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(thing: T): T => {
    disposables.push(thing);
    return thing;
  };

  const ground = new Mesh(keep(new PlaneGeometry(80, STREET + 60)), keep(new MeshLambertMaterial({ color: palette.laterite })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -STREET / 2 + 20;
  scene.add(ground);
  const road = new Mesh(keep(new PlaneGeometry(8, STREET + 60)), keep(new MeshLambertMaterial({ color: palette.asphalt })));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, -STREET / 2 + 20);
  scene.add(road);

  const holder = new Object3D();
  const marks = new InstancedMesh(keep(new BoxGeometry(0.25, 0.04, 2.4)), keep(new MeshLambertMaterial({ color: palette.marking })), Math.ceil(STREET / 6));
  for (let index = 0; index < marks.count; index += 1) {
    holder.position.set(0, 0.06, 20 - index * 6);
    holder.updateMatrix();
    marks.setMatrixAt(index, holder.matrix);
  }
  scene.add(marks);

  // Buildings both sides in two colours of wall, so the street passes in two draw calls.
  const next = sequence(17);
  const box = keep(new BoxGeometry(1, 1, 1));
  box.translate(0, 0.5, 0);
  const walls = [palette.wallCream, palette.wallPeach];
  const lots: { x: number; z: number; w: number; d: number; h: number }[][] = [[], []];
  for (const side of [-1, 1]) {
    for (let z = 20; z > -STREET; z -= 7 + next() * 3) {
      const w = 5 + next() * 4;
      lots[next() < 0.5 ? 0 : 1]?.push({ x: side * (6.5 + w / 2), z, w, d: 5 + next() * 2, h: 3 + next() * 7 });
    }
  }
  lots.forEach((group, colour) => {
    const mesh = new InstancedMesh(box, keep(new MeshLambertMaterial({ color: walls[colour] ?? palette.wallCream })), group.length);
    group.forEach((lot, index) => {
      holder.position.set(lot.x, 0, lot.z);
      holder.scale.set(lot.w, lot.h, lot.d);
      holder.updateMatrix();
      mesh.setMatrixAt(index, holder.matrix);
    });
    scene.add(mesh);
  });
  const trees = new InstancedMesh(keep(new IcosahedronGeometry(1.4, 0)), keep(new MeshLambertMaterial({ color: palette.green, flatShading: true })), 24);
  for (let index = 0; index < trees.count; index += 1) {
    holder.position.set((index % 2 === 0 ? -1 : 1) * 4.9, 2.2, 10 - index * 10 - next() * 4);
    holder.scale.setScalar(0.8 + next() * 0.5);
    holder.updateMatrix();
    trees.setMatrixAt(index, holder.matrix);
  }
  scene.add(trees);

  // The vehicle travels toward -z; its body is turned so its own frame faces +z like its model.
  const vehicle = new Group();
  vehicle.position.x = way === "walk" ? VERGE_X : LANE_X;
  const body = new Group();
  body.rotation.y = Math.PI;
  vehicle.add(body);
  const shell = new Group();
  const stand = standIn(way);
  keep(stand.geometry);
  keep(stand.material as MeshLambertMaterial);
  shell.add(stand);
  body.add(shell);
  const cab = way === "danfo" ? buildCab(keep) : null;
  if (cab !== null) body.add(cab);
  const seats: Seat[] = seatsOf(way).map((spec) => {
    const group = new Group();
    group.userData = { figure: spec.role };
    group.position.set(spec.at[0], spec.at[1], spec.at[2]);
    body.add(group);
    return { role: spec.role, group, pose: spec.pose, figure: null };
  });
  scene.add(vehicle);

  const pre = preMsOf(way);
  const rideMs = RIDE_MS - pre;
  const travel = way === "walk" ? WALK_TRAVEL : (TRAVEL * rideMs) / RIDE_MS;
  /** Where the pre-roll leaves the vehicle: the danfo has pulled away, the rest stand at the kerb. */
  const pulled = way === "danfo" ? (PULL * (pre / 1000) ** 2) / 2 : 0;
  let phase: Phase = pre > 0 ? "pre" : "ride";
  const angles = anglesOf(way);
  let angle: Angle = angles[0]?.angle ?? "above";
  const look = new Vector3();
  const spot = new Vector3();

  const setAngle = (next: Angle): void => {
    angle = next;
    if (way !== "danfo") return;
    // Outside and above the danfo is its model; from the window and the seat, its inside drawn
    // around the camera. From above nothing is drawn inside it; outside, the two in front sit in it.
    const inside = next === "window" || next === "seat";
    shell.visible = !inside;
    if (cab !== null) cab.visible = inside;
    for (const seat of seats) seat.group.visible = next !== "above";
  };
  const setPhase = (next: Phase): void => {
    phase = next;
    setAngle(next === "pre" ? (angles[0]?.angle ?? "above") : "above");
  };
  setPhase(phase);

  const seatOf = (role: Role): Seat | undefined => seats.find((seat) => seat.role === role);

  /** The camera at a point of the vehicle's own frame, looking at another. */
  const aimFrom = (from: [number, number, number], to: [number, number, number]): void => {
    vehicle.updateMatrixWorld(true);
    camera.position.copy(body.localToWorld(spot.set(from[0], from[1], from[2])));
    camera.lookAt(body.localToWorld(look.set(to[0], to[1], to[2])));
  };

  const posePeople = (ms: number, time: number): void => {
    const own = seatOf("own");
    const carrier = seatOf("rider") ?? seatOf("driver");
    const driving = carrier?.figure ?? null;
    if (driving !== null) {
      poseFigure(driving, time, "ride");
      // In the pre-roll the rider or driver turns to talk over his shoulder.
      if (phase === "pre") turnBone(driving, "head", 0, -0.75 * Math.sin(Math.min(1, ms / pre) * Math.PI), 0);
    }
    const figure = own?.figure ?? null;
    if (own === undefined || figure === null) return;
    if (way === "walk") {
      // One stride cycle for each metre and a half walked.
      poseFigure(figure, time, "walk", ((-vehicle.position.z / 1.5) % 1 + 1) % 1);
      return;
    }
    if (way === "okada") {
      // Climbing on: from beside the bike at the kerb, a short lift onto the seat behind the rider.
      // Once the ride is on she is seated, however few frames the pre-roll drew.
      const at = seatsOf(way).find((spec) => spec.role === "own")?.at ?? [0, 0, 0];
      const share = phase === "pre" ? ease((ms - 200) / 700) : 1;
      own.group.position.set(-0.72 + (at[0] + 0.72) * share, at[1] * share + Math.sin(share * Math.PI) * 0.14, -0.62 + (at[2] + 0.62) * share);
      own.group.rotation.y = (Math.PI / 2) * (1 - share);
      if (share <= 0) poseFigure(figure, time, "stand");
      else if (share >= 1) poseFigure(figure, time, "pillion");
      else blendFigure(figure, "stand", "pillion", share);
      return;
    }
    poseFigure(figure, time, own.pose);
    if (way === "danfo") {
      // Elbow on the door, the forearm out along the sill, the head turned a little to the window.
      setBone(figure, "upperArmR", -0.2, 0, -0.35);
      setBone(figure, "forearmR", -1.3, 0, 0);
      turnBone(figure, "head", 0, -0.3, 0);
    }
  };

  /** Where the camera sits for each angle but above, in the vehicle's own frame, and how wide it sees. */
  const placeCamera = (shown: Angle, ms: number): void => {
    const z = vehicle.position.z;
    const push = ease(ms / Math.max(1, pre)) * 0.12;
    switch (shown) {
      case "outside":
        camera.fov = 46;
        camera.near = 0.2;
        // At the stop: the danfo from the road's side, clear of the trees along the kerb; the keke and the okada close beside them at the kerb.
        if (way === "danfo") aimFrom([5.0 - push * 2, 2.2, 5.2], [0.2, 1.1, 0.4]);
        else if (way === "keke") aimFrom([-3.6 + push * 2, 1.35, 1.6], [-0.1, 1.0, -0.2]);
        else aimFrom([-3.6 + push * 2, 1.45, 1.5 - push], [-0.25, 0.9, -0.3]);
        return;
      case "above":
        camera.fov = 42;
        camera.near = 0.5;
        if (way === "walk") {
          camera.position.set(VERGE_X + 2, 14, z + 8);
          camera.lookAt(VERGE_X - 1, 0, z - 4);
        } else {
          camera.position.set(8, 34, z + 18);
          camera.lookAt(0, 0, z - 10);
        }
        return;
      case "window":
        // From the aisle out of one sliding window on the road's side, a pillar either side and the rail across
        // it: the road, its marks and the far side slide past (the kerb side is a wall of shops at arm's length).
        camera.fov = 62;
        camera.near = 0.05;
        aimFrom([-0.7, 1.5, -0.8], [3, 1.05, -0.6]);
        return;
      case "seat":
        // From a back seat: the two in front at the edges, the roof, the dashboard, the road through the windscreen.
        camera.fov = 60;
        camera.near = 0.05;
        aimFrom([0, 1.7, -0.3], [0, 1.05, 6]);
        return;
      case "ahead":
        // Where the character sits, a little up and out, past the rider's or driver's shoulder to the street ahead.
        camera.fov = 75;
        camera.near = 0.08;
        // The keke's windscreen is solid in its model, so the view goes ahead out of the open side on the road's
        // side, the driver beside it under the canopy.
        if (way === "keke") {
          camera.fov = 60;
          aimFrom([-0.2, 1.64, -0.55], [3.6, 0.9, 6]);
        }
        else aimFrom([0.16, 1.68, -0.62], [-0.05, 1.0, 9]);
        return;
      default: {
        const never: never = shown;
        throw new Error(`Unknown angle: ${String(never)}`);
      }
    }
  };

  const frame = (ms: number, aspect: number): void => {
    const time = ms / 1000;
    phase = ms < pre ? "pre" : "ride";
    const shown = angleAt(way, ms);
    if (shown !== angle) setAngle(shown);
    if (ms < pre) {
      vehicle.position.z = way === "danfo" ? -(PULL * time * time) / 2 : 0;
      vehicle.position.y = way === "danfo" ? Math.sin(time * 9) * 0.006 : Math.abs(Math.sin(time * 40)) * 0.004;
    } else {
      const share = Math.min(1, (ms - pre) / Math.max(1, rideMs));
      // Pull away, cruise, and slow into the stop.
      const eased = share < 0.15 ? (share * share) / 0.3 : share > 0.85 ? 1 - ((1 - share) * (1 - share)) / 0.3 : share - 0.075;
      vehicle.position.z = -pulled - eased * travel;
      // Inside, a gentler bob: the camera rides with the vehicle.
      const bob = shown === "above" ? 0.05 : 0.02;
      vehicle.position.y = way === "walk" ? 0 : Math.abs(Math.sin(time * 11)) * bob;
    }
    posePeople(ms, time);
    // Where the camera is the character's own eyes, her head is not drawn around it.
    seatOf("own")?.figure?.bones.get("head")?.scale.setScalar(shown === "ahead" ? 0.01 : 1);
    placeCamera(shown, ms);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  };

  return {
    scene,
    camera,
    vehicle,
    seats,
    setVehicle: (model) => {
      if (way === "walk") return;
      shell.clear();
      shell.add(model);
    },
    setPerson: (role, model) => {
      const seat = seatOf(role);
      if (seat === undefined || seat.figure !== null) return;
      const figure = figureOf(model, seat.pose, role === "own" ? 0.4 : 1.7);
      seat.figure = figure;
      seat.group.add(figure.root);
      if (way === "walk") shell.visible = false;
    },
    setPhase,
    setAngle,
    frame,
    dispose: () => {
      for (const thing of disposables) thing.dispose();
      // The renderer, the vehicles and the people are shared and kept loaded (load.ts, sharedRenderer.ts).
    },
  };
}
