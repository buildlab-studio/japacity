// Builds a place from its stage and its loaded models: ground and roads, the models instanced at
// their spots, the crowd posed at theirs, the player's own character, what moves, and the route map
// the walks run on; and moves the crowd once a frame on the place's one clock.
import { footprintOf, isPaletteName, type PaletteName, paletteCss, quarterOf } from "@japacity/assets";
import { attachSigns, findSignAnchors, type SignText } from "@japacity/assets/load";
import type { SignAnchor } from "@japacity/assets";
import type { PoseName } from "@japacity/models/people/poses";
import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshLambertMaterial, type Object3D, Quaternion, type SkinnedMesh, Sphere, Vector3 } from "three";

import { stripTops } from "../../../../../tools/assets/faces-check";
import { instanceModel } from "../three/instance";
import { ownIndicator, nameTag } from "../three/marks";
import { danceFigure } from "../three/dance";
import { poseFigure } from "../three/people";
import { bunting, drops, flicker, frondGeometry, glow, instancedSheets, leaves, type MeshLevel, rideWater, sheet, sheetGeometry, smoke, stripedFlag, water } from "../three/motion";
import { type Figure, figureOf } from "../three/people";
import { crossAt } from "./cross";
import { actPose, placeCrowd, type Shown, walkPose } from "./crowd";
import type { ModeSettings } from "./mode";
import { DANCER_SLOT, type DanceName, type Lamp, type Motion, type Stage, type Strip } from "./placeFile";
import { strideOf, WALK_SPEED } from "./walk";
import { showWalls, type WallParts, wallsOf } from "./walls";
import { routeMap, type RouteMap } from "./walk/map";
import { advanceStrolls, type Strolls, strollsOf } from "./walk/stroll";

export function colourOf(name: string): Color {
  return new Color(paletteCss(isPaletteName(name) ? name : "concrete"));
}

export interface Placed {
  figure: Figure;
  slot: number;
  /** How they walk: a hawker steadies her tray, everyone else swings both arms. */
  walk: PoseName;
  /** A crosser walks from `from` to `to` and back, `phase` seconds along the round. */
  cross?: { from: [number, number]; to: [number, number]; phase: number };
  /** A stroller's place in the strolls, when they stroll between spots (city:players-shown-present-not-tracked). */
  stroll?: number;
}

export interface World {
  root: Group;
  crowd: Placed[];
  /** People on a dance loop, posed by `danceFigure` in the scene's one frame loop. */
  dancers: { figure: Figure; dance: DanceName }[];
  /** People standing still at a thing of their own (world:nobody-picked-from-list), idling where they stand. */
  standers: Figure[];
  own: Figure;
  indicator: Mesh;
  /**
   * The place's route map, built once here from the footprints and the walkable ground (city.md
   * city:tap-to-walk), or null when nothing roams (world:nothing-roams) and walks are straight.
   */
  routes: RouteMap | null;
  strolls: Strolls;
  /** A wide home's outer walls in pairs, full and knee-high, the pair for the view's quarter shown; empty elsewhere. */
  walls: WallParts;
}

/** Which prefixes cast a shadow in the high mode: characters and vehicles only (assets:lighting-set-by-place). */
function castsShadow(file: string): boolean {
  const name = file.split("/").pop() ?? "";
  return name.startsWith("chr_") || name.startsWith("veh_");
}

function flat(colour: string): MeshLambertMaterial {
  return new MeshLambertMaterial({ color: colourOf(colour), flatShading: true });
}

/** Where the indicator floats over the player's own head. */
const INDICATOR_Y = 1.98;

/** The pieces of a strip along its length: every other `every` metres in the dash colour when it has one. */
function stripPieces(strip: Strip): { from: number; to: number; colour: string }[] {
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
 * one draw call however many roads, kerbs and gutters it has. A raised strip is a block with its top
 * and sides. Each strip lies a step over the strips under it (world:faces-never-share-height), as the place
 * check reads them, so no two of its faces fight for a pixel.
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
  const tops = stripTops(stage.roads);
  stage.roads.forEach((strip, index) => {
    const [x, z, turn] = strip.at;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const half = strip.size[1] / 2;
    const top = tops[index] ?? 0;
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

/** The floor of a place as the scene draws it: one mesh, drawn a little behind its depth. */
export function groundOf(stage: Stage): Group {
  const group = new Group();
  group.name = "ground";
  // The floor draws a little behind its true depth, so a model's floor laid on it always wins the pixel (world:faces-never-share-height).
  const ground = new Mesh(groundGeometry(stage), new MeshLambertMaterial({ vertexColors: true, flatShading: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
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
    case "drops": {
      const falling = drops(fewer, width, height, motion.at[1], first);
      falling.position.copy(at);
      return falling;
    }
    case "flicker": {
      const screen = flicker(width, height, first);
      screen.position.copy(at);
      screen.rotation.y = motion.ry ?? 0;
      return screen;
    }
    case "glow": {
      const point = glow(width / 2, first, false);
      point.position.copy(at);
      return point;
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

/** No one strolls: the strolls of a place where nothing roams. */
function stayPut(seed: string, stage: Pick<Stage, "people">): Strolls {
  return { seed, spots: stage.people, open: [], spotPart: new Int32Array(0), holder: new Int32Array(0), strollers: [], begun: null };
}

/** Every phase of the crowd differs, from the slot, so no two people breathe together. */
const phaseOf = (slot: number): number => slot * 1.7;
const OWN_PHASE = 99;
/** The phases of those standing at a thing start past every crowd slot's. */
const STANDER_PHASE = 60;

/** A building's sign anchors with each key replaced by this copy's own, in the anchors' order. */
function copySigns(anchors: readonly SignAnchor[], keys: readonly string[] | undefined): SignAnchor[] {
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

/**
 * The place built from its stage and loaded models. `seed` is the place's id, from which the crowd's
 * strolls are drawn, so the same place walks its people the same way on every screen.
 */
export function buildWorld(stage: Stage, models: ReadonlyMap<string, Object3D>, people: readonly Shown[], ownFile: string, settings: ModeSettings, text: SignText = () => undefined, seed = "place", roam = true): World {
  const root = new Group();
  root.name = "place";
  root.add(groundOf(stage));
  for (const model of stage.models) {
    const loaded = models.get(model.file);
    if (loaded === undefined || model.at.length === 0) continue;
    const copies = model.signs === undefined ? instanceModel(loaded, model.at, model.file) : buildingCopies(loaded, model.at, model.signs, model.file, text);
    if (model.signs === undefined) copies.userData = { file: model.file, signs: findSignAnchors(loaded).map((anchor) => anchor.key), ...(model.owned === undefined ? {} : { owned: model.owned }) };
    copies.traverse((object) => {
      object.castShadow = settings.shadows && castsShadow(model.file);
    });
    if (model.bob === true || model.glide !== undefined) rideWater(copies, model.glide);
    root.add(copies);
  }
  // A wide home stands with the pair its whole view looks over at rest; the scene turns it after.
  const walls = wallsOf(root);
  showWalls(walls, quarterOf(stage.shot?.yaw ?? 0));
  const crowd: Placed[] = [];
  const acts = stage.acts ?? [];
  const standing: { slot: number; index: number; placed: Placed }[] = [];
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
    const placed: Placed = to === undefined ? { figure, slot: shown.slot, walk: walkPose(shown.person) } : { figure, slot: shown.slot, walk: walkPose(shown.person), cross: { from: [spot[0], spot[1]], to, phase: phaseOf(shown.slot) } };
    crowd.push(placed);
    standing.push({ slot: shown.slot, index, placed });
  }
  // Nothing roams in the world (world:nothing-roams): no route map is built and nobody strolls, unless tuning turns roaming on.
  const routes = roam
    ? routeMap(stage, (file) => {
        const model = models.get(file);
        return model === undefined ? null : footprintOf(model);
      })
    : null;
  // Spots kept for a role or an act keep their people: the trader at her stall, the conductor, the crossers.
  const kept = new Set<number>([...Object.values(stage.prefer ?? {}).flatMap((indices) => indices ?? []), ...acts.map((act) => act.spot)]);
  const strolls = routes === null ? stayPut(seed, stage) : strollsOf(seed, stage.people, standing, kept, routes);
  strolls.strollers.forEach((stroller, at) => {
    const found = standing.find((entry) => entry.slot === stroller.slot);
    if (found !== undefined) found.placed.stroll = at;
  });
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
  // A person met in a place stands still at their thing, idling, and a tap on them is a tap on the thing (world:nobody-picked-from-list).
  const standers: Figure[] = [];
  (stage.standing ?? []).forEach((stander, index) => {
    const loaded = models.get(stander.file);
    if (loaded === undefined) return;
    const figure = figureOf(loaded, "stand", phaseOf(STANDER_PHASE + index));
    figure.root.position.set(stander.at[0], 0, stander.at[1]);
    figure.root.rotation.y = stander.at[2];
    figure.root.userData = { stander: stander.thing };
    figure.root.traverse((object) => {
      object.castShadow = settings.shadows;
    });
    cullAsPerson(figure.root);
    root.add(figure.root);
    standers.push(figure);
  });
  // The player's own character is drawn beside the sample, not in one of its slots, so a place shows the sample plus one.
  const ownModel = models.get(ownFile);
  if (ownModel === undefined) throw new Error(`${ownFile} did not load`);
  const own = figureOf(ownModel, "stand", phaseOf(OWN_PHASE));
  own.root.userData = { own: true };
  own.root.traverse((object) => {
    object.castShadow = settings.shadows;
  });
  cullAsPerson(own.root);
  const indicator = ownIndicator();
  indicator.position.set(0, INDICATOR_Y, 0);
  own.root.add(indicator);
  root.add(own.root);
  for (const motion of stage.motion) root.add(motionOf(motion, settings.mesh));
  return { root, crowd, dancers, standers, own, indicator, routes, strolls, walls };
}

/**
 * One frame of the place's people at the clock's `time`, `seconds` after the last: the crowd idling,
 * crossing and strolling, the dancers dancing, the indicator bobbing. The player's own walk and the
 * camera are the scene's. Moving people costs no draw call: the same figures stand somewhere else.
 */
export function animateWorld(world: World, time: number, seconds: number): void {
  if (world.routes !== null) advanceStrolls(world.strolls, world.routes, time, Math.min(Math.max(0, seconds), 0.25));
  for (const { figure, cross, stroll, walk } of world.crowd) {
    if (cross !== undefined) {
      const pace = crossAt(cross.from, cross.to, time, WALK_SPEED, cross.phase);
      figure.root.position.set(pace.x, 0, pace.z);
      figure.root.rotation.y = pace.facing;
      if (pace.walking) poseFigure(figure, time, walk, pace.stride);
      else poseFigure(figure, time);
      continue;
    }
    const walker = stroll === undefined ? undefined : world.strolls.strollers[stroll]?.walker;
    if (walker === undefined) {
      poseFigure(figure, time);
      continue;
    }
    figure.root.position.set(walker.x, 0, walker.z);
    figure.root.rotation.y = walker.facing;
    if (walker.target === null) poseFigure(figure, time);
    else poseFigure(figure, time, walk, strideOf(walker));
  }
  for (const { figure, dance } of world.dancers) danceFigure(figure, time, dance);
  for (const figure of world.standers) poseFigure(figure, time);
  world.indicator.position.y = INDICATOR_Y + Math.sin(time * 2.4) * 0.05;
  world.indicator.rotation.y = time * 1.5;
}

/** The warm colour of a lamp's glow: a bulb or a lantern's flame at night. */
const LAMP_COLOUR = 0xffb46a;

/** The place's lamps as warm points of light, out until the day's light sets how bright they stand (clock:game-day-on-real-time). */
export function lampsOf(lamps: readonly Lamp[]): Object3D[] {
  return lamps.map((lamp) => {
    const point = glow(lamp.size / 2, new Color(LAMP_COLOUR), lamp.bulb === true);
    point.position.set(...lamp.at);
    point.name = "lamp";
    return point;
  });
}

/** The sky behind the place and the colour of its fog: each leans from the sky's colour toward the ground's by the mode's haze. */
export function skyColours(sky: PaletteName, ground: PaletteName, haze: ModeSettings["haze"]): { sky: Color; background: Color; fog: Color } {
  const top = colourOf(sky);
  const below = colourOf(ground);
  return { sky: top, background: top.clone().lerp(below, haze.sky), fog: top.clone().lerp(below, haze.fog) };
}
