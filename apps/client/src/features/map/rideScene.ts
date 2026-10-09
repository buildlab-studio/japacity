// The ride's scene (docs/rules/world.md R-WORLD-017): the street the ride goes along, the vehicle,
// and the people on it. A ride by danfo, keke or okada opens on a short pre-roll close to the
// vehicle (the okada at the kerb with the character climbing on behind the rider, the keke with its
// driver and the character on the back bench, the danfo from inside, behind the character's head),
// then cuts to the street from above for the rest. On foot there is no pre-roll: the character walks.
// Everything here is plain three.js with no renderer, so a test can read the scene it builds.
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

/** The two parts of a ride: the close pre-roll, then the street from above. */
export type Phase = "pre" | "ride";

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
  setPhase: (phase: Phase) => void;
  /** Poses everything and places the camera `ms` after the ride began. */
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
 * The danfo's front from inside, in its own frame: the dashboard, the windscreen's pillars and
 * header, the roof, both front doors with their sills, the bench, the wheel and the kerb mirror.
 * One draw call. Seen only in the pre-roll; from above the danfo is its model.
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
  ];
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
  const seat = [part(1.62, 0.12, 0.5, 0, 0.84, 1.18), part(1.62, 0.36, 0.1, 0, 1.08, 0.9)];
  // One draw call: each piece carries its colour in its vertices.
  const pieces: BufferGeometry[] = [];
  for (const [group, colour] of [
    [body, palette.danfoYellow],
    [trim, palette.charcoal],
    [seat, palette.seat],
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
  const look = new Vector3();
  const spot = new Vector3();

  const setPhase = (next: Phase): void => {
    phase = next;
    if (way !== "danfo") return;
    // From above the danfo is its model, with nothing drawn inside it.
    const inside = next === "pre";
    shell.visible = !inside;
    if (cab !== null) cab.visible = inside;
    for (const seat of seats) seat.group.visible = inside;
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
    if (way === "okada" && phase === "pre") {
      // Climbing on: from beside the bike at the kerb, a short lift onto the seat behind the rider.
      const at = seatsOf(way).find((spec) => spec.role === "own")?.at ?? [0, 0, 0];
      const share = ease((ms - 200) / 700);
      own.group.position.set(-0.72 + (at[0] + 0.72) * share, at[1] * share + Math.sin(share * Math.PI) * 0.14, -0.62 + (at[2] + 0.62) * share);
      own.group.rotation.y = (Math.PI / 2) * (1 - share);
      if (share <= 0) poseFigure(figure, time, "stand");
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

  const frame = (ms: number, aspect: number): void => {
    const time = ms / 1000;
    if (ms < pre) {
      const t = ms / 1000;
      vehicle.position.z = way === "danfo" ? -(PULL * t * t) / 2 : 0;
      vehicle.position.y = way === "danfo" ? Math.sin(time * 9) * 0.006 : Math.abs(Math.sin(time * 40)) * 0.004;
      posePeople(ms, time);
      const push = ease(ms / pre) * 0.12;
      camera.fov = way === "danfo" ? 75 : 46;
      camera.near = way === "danfo" ? 0.05 : 0.2;
      if (way === "danfo") aimFrom([-0.2, 1.66, 0.2 + push], [-0.9, 1.17, 3]);
      else if (way === "keke") aimFrom([-3.6 + push * 2, 1.35, 1.6], [-0.1, 1.0, -0.2]);
      else aimFrom([-3.6 + push * 2, 1.45, 1.5 - push], [-0.25, 0.9, -0.3]);
    } else {
      const share = Math.min(1, (ms - pre) / Math.max(1, rideMs));
      // Pull away, cruise, and slow into the stop.
      const eased = share < 0.15 ? (share * share) / 0.3 : share > 0.85 ? 1 - ((1 - share) * (1 - share)) / 0.3 : share - 0.075;
      const z = -pulled - eased * travel;
      vehicle.position.z = z;
      vehicle.position.y = way === "walk" ? 0 : Math.abs(Math.sin(time * 11)) * 0.05;
      posePeople(ms, time);
      camera.fov = 42;
      camera.near = 0.5;
      if (way === "walk") {
        camera.position.set(VERGE_X + 2, 14, z + 8);
        camera.lookAt(VERGE_X - 1, 0, z - 4);
      } else {
        camera.position.set(8, 34, z + 18);
        camera.lookAt(0, 0, z - 10);
      }
    }
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
    frame,
    dispose: () => {
      for (const thing of disposables) thing.dispose();
      // The renderer, the vehicles and the people are shared and kept loaded (load.ts, sharedRenderer.ts).
    },
  };
}
