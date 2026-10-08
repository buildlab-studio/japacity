// Builds a place from its stage and its loaded models: ground and roads, the models instanced at
// their spots, the crowd posed at theirs, the player's own character, and what moves.
import { isPaletteName, type PaletteName, paletteCss } from "@japacity/assets";
import { attachSigns, findSignAnchors, type SignText } from "@japacity/assets/load";
import type { SignAnchor } from "@japacity/assets";
import type { PoseName } from "@japacity/assets-src/people/poses";
import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshLambertMaterial, type Object3D, Quaternion, type SkinnedMesh, Sphere, Vector3 } from "three";

import { instanceModel } from "../../shared/three/instance";
import { ownIndicator, nameTag } from "../../shared/three/marks";
import { danceFigure } from "../../shared/three/dance";
import { bunting, frondGeometry, instancedSheets, leaves, type MeshLevel, rideWater, sheet, sheetGeometry, smoke, stripedFlag, water } from "../../shared/three/motion";
import { type Figure, figureOf } from "../../shared/three/people";
import { actPose, placeCrowd, type Shown, walkPose } from "./crowd";
import type { ModeSettings } from "./mode";
import { DANCER_SLOT, type DanceName, type Motion, type Stage, type Strip } from "./placeFile";

export function colourOf(name: string): Color {
  return new Color(paletteCss(isPaletteName(name) ? name : "concrete"));
}

export interface Placed {
  figure: Figure;
  slot: number;
  /** A crosser walks from `from` to `to` and back in `walk`, `phase` seconds along the round. */
  cross?: { from: [number, number]; to: [number, number]; walk: PoseName; phase: number };
}

export interface World {
  root: Group;
  crowd: Placed[];
  /** People on a dance loop, posed by `danceFigure` in the scene's one frame loop. */
  dancers: { figure: Figure; dance: DanceName }[];
  own: Figure;
  indicator: Mesh;
}

/** Which prefixes cast a shadow in the high mode: characters and vehicles only (R-ASSET-006). */
function castsShadow(file: string): boolean {
  const name = file.split("/").pop() ?? "";
  return name.startsWith("chr_") || name.startsWith("veh_");
}

function flat(colour: string): MeshLambertMaterial {
  return new MeshLambertMaterial({ color: colourOf(colour), flatShading: true });
}

/** Strips lie this far apart in height, in list order, so no two fight for a pixel. */
const LIFT = 0.01;

/** The pieces of a strip along its length: every other `every` metres in the dash colour when it has one. */
export function stripPieces(strip: Strip): { from: number; to: number; colour: string }[] {
  const length = strip.size[0];
  const every = strip.dash?.every ?? 0;
  if (strip.dash === undefined || every <= 0) return [{ from: -length / 2, to: length / 2, colour: strip.colour }];
  const pieces: { from: number; to: number; colour: string }[] = [];
  for (let at = -length / 2, index = 0; at < length / 2; at += every, index += 1) {
    pieces.push({ from: at, to: Math.min(at + every, length / 2), colour: index % 2 === 0 ? strip.colour : strip.dash.colour });
  }
  return pieces;
}

/**
 * The ground and every strip on it as one mesh of vertex colours, so the whole floor of a place is
 * one draw call however many roads, kerbs and gutters it has. A raised strip is a block with its top and sides.
 */
export function groundGeometry(stage: Stage): BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const face = (corners: readonly Vector3[], colour: Color): void => {
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const corner = corners[index];
      if (corner === undefined) continue;
      positions.push(corner.x, corner.y, corner.z);
      colours.push(colour.r, colour.g, colour.b);
    }
  };
  const [width, depth] = stage.ground.size;
  face([new Vector3(-width / 2, 0, depth / 2), new Vector3(width / 2, 0, depth / 2), new Vector3(width / 2, 0, -depth / 2), new Vector3(-width / 2, 0, -depth / 2)], colourOf(stage.ground.colour));
  stage.roads.forEach((strip, index) => {
    const [x, z, turn] = strip.at;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const half = strip.size[1] / 2;
    const top = LIFT * (index + 1) + (strip.raise ?? 0);
    const point = (along: number, across: number, y: number): Vector3 => new Vector3(x + along * cos + across * sin, y, z - along * sin + across * cos);
    for (const piece of stripPieces(strip)) {
      const colour = colourOf(piece.colour);
      face([point(piece.from, half, top), point(piece.to, half, top), point(piece.to, -half, top), point(piece.from, -half, top)], colour);
      if (strip.raise === undefined) continue;
      const side = colour.clone().multiplyScalar(0.8);
      face([point(piece.from, half, 0), point(piece.to, half, 0), point(piece.to, half, top), point(piece.from, half, top)], side);
      face([point(piece.to, -half, 0), point(piece.from, -half, 0), point(piece.from, -half, top), point(piece.to, -half, top)], side);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function groundOf(stage: Stage): Group {
  const group = new Group();
  group.name = "ground";
  const ground = new Mesh(groundGeometry(stage), new MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  ground.receiveShadow = true;
  ground.name = "ground";
  group.add(ground);
  return group;
}

const UP = new Vector3(0, 1, 0);

function along(from: Vector3, to: Vector3, count: number): Matrix4[] {
  const turn = new Quaternion().setFromAxisAngle(UP, Math.atan2(-(to.z - from.z), to.x - from.x));
  return Array.from({ length: count }, (_, index) => {
    const share = count === 1 ? 0.5 : index / (count - 1);
    const at = new Vector3().lerpVectors(from, to, share);
    at.y -= Math.sin(share * Math.PI) * 0.25;
    return new Matrix4().compose(at, turn, new Vector3(1, 1, 1));
  });
}

/** A flag or a hang of one colour, or a row of them along a line when it runs `to` somewhere. */
function plainSheet(motion: Motion, level: MeshLevel, colours: readonly Color[]): Object3D {
  const kind = motion.kind === "flag" ? "flag" : "hang";
  const [width, height] = motion.size ?? [1, 1];
  const count = motion.count ?? 1;
  const at = new Vector3(...motion.at);
  if (motion.to !== undefined && count > 1) return instancedSheets(kind, sheetGeometry(kind, width, height, level), along(at, new Vector3(...motion.to), count), colours);
  const one = sheet(kind, width, height, level, colours[0] ?? new Color(0xffffff));
  one.position.copy(at);
  one.rotation.y = motion.ry ?? 0;
  return one;
}

/** One moving thing from the place's list, at the mesh level of the mode. */
export function motionOf(motion: Motion, level: MeshLevel): Object3D {
  const at = new Vector3(...motion.at);
  const colours = motion.colours.map(colourOf);
  const first = colours[0] ?? new Color(0xffffff);
  const [width, height] = motion.size ?? [1, 1];
  const count = motion.count ?? 1;
  const fewer = level === "fine" ? count : Math.max(1, Math.ceil((count * 2) / 3));
  switch (motion.kind) {
    case "flag": {
      if (motion.hoist === undefined && colours.length < 2) return plainSheet(motion, level, colours);
      const flag = stripedFlag(width, height, level, colours, motion.hoist === undefined ? null : colourOf(motion.hoist));
      flag.position.copy(at);
      flag.rotation.y = motion.ry ?? 0;
      return flag;
    }
    case "hang":
      return plainSheet(motion, level, colours);
    case "frond": {
      const palm = new Group();
      palm.name = "motion-palm";
      // The trunk leans a little and its top meets the crown at `at`; the crown's colours are all but the last, the trunk's the last.
      const lean = 0.09;
      const trunkHeight = motion.at[1] / Math.cos(lean);
      const trunk = new Mesh(new CylinderGeometry(0.13, 0.22, trunkHeight, 6), flat(motion.colours[motion.colours.length - 1] ?? "wood"));
      trunk.position.set(motion.at[0] - (Math.sin(lean) * trunkHeight) / 2, motion.at[1] / 2, motion.at[2]);
      trunk.rotation.z = -lean;
      const crown = Array.from({ length: count }, (_, index) => {
        const turn = new Quaternion().setFromAxisAngle(UP, (index / count) * Math.PI * 2 + (motion.ry ?? 0) + (index % 2) * 0.3);
        turn.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), index % 2 === 0 ? 0.42 : 0.05));
        return new Matrix4().compose(at, turn, new Vector3(1, 1, 1));
      });
      const leaves = colours.length > 1 ? colours.slice(0, -1) : colours;
      palm.add(trunk, instancedSheets("frond", frondGeometry(width, height, level), crown, leaves));
      return palm;
    }
    case "bunting":
      return bunting(at, new Vector3(...(motion.to ?? motion.at)), count, colours, level);
    case "water": {
      const surface = water(width, height, level, first);
      surface.position.copy(at);
      return surface;
    }
    case "smoke": {
      const puffs = smoke(fewer, colours.length === 0 ? [first] : colours);
      puffs.position.copy(at);
      return puffs;
    }
    case "leaves": {
      const blown = leaves(fewer, width, height, first);
      blown.position.copy(at);
      return blown;
    }
    default: {
      const never: never = motion.kind;
      throw new Error(`Unknown motion: ${String(never)}`);
    }
  }
}

/** Round a standing person, arms out or a tray up, in the body's own frame. */
const PERSON_BOUNDS = new Sphere(new Vector3(0, 0.95, 0), 1.3);

/**
 * A person is skipped where neither the camera nor the sun's shadow camera can see them. A skinned
 * body's own bounds do not follow its pose, so each is given a sphere that holds any pose.
 */
function cullAsPerson(root: Object3D): void {
  root.traverse((object) => {
    const skinned = object as SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    skinned.boundingSphere = PERSON_BOUNDS.clone();
    skinned.frustumCulled = true;
  });
}

/** Every phase of the crowd differs, from the slot, so no two people breathe together. */
const phaseOf = (slot: number): number => slot * 1.7;
const OWN_PHASE = 99;

/** A building's sign anchors with each key replaced by this copy's own, in the anchors' order. */
export function copySigns(anchors: readonly SignAnchor[], keys: readonly string[] | undefined): SignAnchor[] {
  return anchors.map((anchor, index) => ({ ...anchor, key: keys?.[index] ?? anchor.key }));
}

/** The node that carries a model's sign anchors, and its matrix in the model's own frame. */
function signHolder(model: Object3D): Matrix4 {
  model.updateMatrixWorld(true);
  let holder: Object3D = model;
  model.traverse((object) => {
    if (Array.isArray((object.userData as { signs?: unknown }).signs)) holder = object;
  });
  return new Matrix4().copy(model.matrixWorld).invert().multiply(holder.matrixWorld);
}

/** Copies of a building with every copy's own boards: the body instanced as one draw call, each copy's signs one more. */
function buildingCopies(model: Object3D, at: Stage["models"][number]["at"], signs: string[][], file: string, text: SignText): Group {
  const body = model.clone();
  const lettered: Object3D[] = [];
  body.traverse((object) => {
    if (object.name === "signs") lettered.push(object);
  });
  for (const object of lettered) object.removeFromParent();
  const copies = instanceModel(body, at, file);
  const anchors = findSignAnchors(model);
  const local = signHolder(model);
  const keys = new Set<string>();
  at.forEach(([x, z, turn], index) => {
    const own = copySigns(anchors, signs[index]);
    for (const anchor of own) keys.add(anchor.key);
    const holder = new Group();
    holder.userData = { signs: own };
    attachSigns(holder, text);
    holder.matrixAutoUpdate = false;
    holder.matrix.compose(new Vector3(x, 0, z), new Quaternion().setFromAxisAngle(UP, turn), new Vector3(1, 1, 1)).multiply(local);
    holder.userData = { file, signs: own.map((anchor) => anchor.key) };
    copies.add(holder);
  });
  copies.userData = { file, signs: [...keys] };
  return copies;
}

export function buildWorld(stage: Stage, models: ReadonlyMap<string, Object3D>, people: readonly Shown[], ownFile: string, settings: ModeSettings, text: SignText = () => undefined): World {
  const root = new Group();
  root.name = "place";
  root.add(groundOf(stage));
  for (const model of stage.models) {
    const loaded = models.get(model.file);
    if (loaded === undefined || model.at.length === 0) continue;
    const copies = model.signs === undefined ? instanceModel(loaded, model.at, model.file) : buildingCopies(loaded, model.at, model.signs, model.file, text);
    if (model.signs === undefined) copies.userData = { file: model.file, signs: findSignAnchors(loaded).map((anchor) => anchor.key) };
    if (model.bob === true) rideWater(copies);
    copies.traverse((object) => {
      object.castShadow = settings.shadows && castsShadow(model.file);
    });
    root.add(copies);
  }
  const crowd: Placed[] = [];
  const acts = stage.acts ?? [];
  for (const { shown, spot, index } of placeCrowd(people, stage.people, stage.prefer, acts)) {
    const loaded = models.get(shown.person.file);
    if (loaded === undefined) continue;
    const act = acts.find((entry) => entry.spot === index);
    const figure = figureOf(loaded, actPose(shown.person, act), phaseOf(shown.slot));
    figure.root.position.set(spot[0], 0, spot[1]);
    figure.root.rotation.y = spot[2];
    figure.root.userData = { slot: shown.slot };
    figure.root.traverse((object) => {
      object.castShadow = settings.shadows;
    });
    cullAsPerson(figure.root);
    if (shown.tag !== null) {
      const tag = nameTag(shown.tag);
      tag.position.set(0, 2.15, 0);
      figure.root.add(tag);
    }
    root.add(figure.root);
    const to = act?.to;
    crowd.push(to === undefined ? { figure, slot: shown.slot } : { figure, slot: shown.slot, cross: { from: [spot[0], spot[1]], to, walk: walkPose(shown.person), phase: phaseOf(shown.slot) } });
  }
  const dancers: World["dancers"] = [];
  (stage.dancers ?? []).forEach((dancer, index) => {
    const loaded = models.get(dancer.file);
    if (loaded === undefined) return;
    const slot = DANCER_SLOT + index;
    const figure = figureOf(loaded, "stand", phaseOf(slot));
    figure.root.position.set(dancer.at[0], 0, dancer.at[1]);
    figure.root.rotation.y = dancer.at[2];
    figure.root.userData = { slot };
    figure.root.traverse((object) => {
      object.castShadow = settings.shadows;
    });
    danceFigure(figure, 0, dancer.dance);
    root.add(figure.root);
    dancers.push({ figure, dance: dancer.dance });
  });
  // the player's own character is drawn beside the sample, not in one of its slots, so a place shows the sample plus one.
  const ownModel = models.get(ownFile);
  if (ownModel === undefined) throw new Error(`${ownFile} did not load`);
  const own = figureOf(ownModel, "stand", phaseOf(OWN_PHASE));
  own.root.userData = { own: true };
  own.root.traverse((object) => {
    object.castShadow = settings.shadows;
  });
  cullAsPerson(own.root);
  const indicator = ownIndicator();
  indicator.position.set(0, 1.98, 0);
  own.root.add(indicator);
  root.add(own.root);
  for (const motion of stage.motion) root.add(motionOf(motion, settings.mesh));
  return { root, crowd, dancers, own, indicator };
}

/** The sky behind the place and the colour of its fog: each leans from the sky's colour toward the ground's by the mode's haze. */
export function skyColours(sky: PaletteName, ground: PaletteName, haze: ModeSettings["haze"]): { sky: Color; background: Color; fog: Color } {
  const top = colourOf(sky);
  const below = colourOf(ground);
  return { sky: top, background: top.clone().lerp(below, haze.sky), fog: top.clone().lerp(below, haze.fog) };
}
