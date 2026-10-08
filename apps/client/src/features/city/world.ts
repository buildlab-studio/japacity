// Builds a place from its stage and its loaded models: ground and roads, the models instanced at
// their spots, the crowd posed at theirs, the player's own character, and what moves.
import { isPaletteName, type PaletteName, paletteCss } from "@japacity/assets";
import { findSignAnchors } from "@japacity/assets/load";
import { Color, CylinderGeometry, Group, Matrix4, Mesh, MeshLambertMaterial, type Object3D, PlaneGeometry, Quaternion, Vector3 } from "three";

import { instanceModel } from "../../shared/three/instance";
import { ownIndicator, nameTag } from "../../shared/three/marks";
import { bunting, frondGeometry, instancedSheets, leaves, type MeshLevel, sheet, sheetGeometry, smoke, water } from "../../shared/three/motion";
import { type Figure, figureOf } from "../../shared/three/people";
import type { Shown } from "./crowd";
import type { ModeSettings } from "./mode";
import type { Motion, Stage } from "./placeFile";

export function colourOf(name: string): Color {
  return new Color(paletteCss(isPaletteName(name) ? name : "concrete"));
}

export interface Placed {
  figure: Figure;
  slot: number;
}

export interface World {
  root: Group;
  crowd: Placed[];
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

function groundOf(stage: Stage): Group {
  const group = new Group();
  group.name = "ground";
  const ground = new Mesh(new PlaneGeometry(stage.ground.size[0], stage.ground.size[1]).rotateX(-Math.PI / 2), flat(stage.ground.colour));
  ground.receiveShadow = true;
  ground.name = "ground";
  group.add(ground);
  stage.roads.forEach((road, index) => {
    const strip = new Mesh(new PlaneGeometry(road.size[0], road.size[1]).rotateX(-Math.PI / 2), flat(road.colour));
    strip.position.set(road.at[0], 0.01 * (index + 1), road.at[1]);
    strip.rotation.y = road.at[2];
    strip.receiveShadow = true;
    strip.name = "ground";
    group.add(strip);
  });
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

/** One moving thing from the place's list, at the mesh level of the mode. */
export function motionOf(motion: Motion, level: MeshLevel): Object3D {
  const at = new Vector3(...motion.at);
  const colours = motion.colours.map(colourOf);
  const first = colours[0] ?? new Color(0xffffff);
  const [width, height] = motion.size ?? [1, 1];
  const count = motion.count ?? 1;
  const fewer = level === "fine" ? count : Math.max(1, Math.ceil((count * 2) / 3));
  switch (motion.kind) {
    case "flag":
    case "hang": {
      if (motion.to !== undefined && count > 1) return instancedSheets(motion.kind, sheetGeometry(motion.kind, width, height, level), along(at, new Vector3(...motion.to), count), colours);
      const one = sheet(motion.kind, width, height, level, first);
      one.position.copy(at);
      one.rotation.y = motion.ry ?? 0;
      return one;
    }
    case "frond": {
      const palm = new Group();
      palm.name = "motion-palm";
      const trunk = new Mesh(new CylinderGeometry(0.11, 0.2, motion.at[1], 6), flat(motion.colours[1] ?? "wood"));
      trunk.position.set(motion.at[0], motion.at[1] / 2, motion.at[2]);
      const crown = Array.from({ length: count }, (_, index) => {
        const turn = new Quaternion().setFromAxisAngle(UP, (index / count) * Math.PI * 2 + (motion.ry ?? 0));
        turn.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.12));
        return new Matrix4().compose(at, turn, new Vector3(1, 1, 1));
      });
      palm.add(trunk, instancedSheets("frond", frondGeometry(width, height, level), crown, [first]));
      return palm;
    }
    case "bunting":
      return bunting(at, new Vector3(...(motion.to ?? motion.at)), count, colours);
    case "water": {
      const surface = water(width, height, level, first);
      surface.position.copy(at);
      return surface;
    }
    case "smoke": {
      const puffs = smoke(fewer, first);
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

/** Every phase of the crowd differs, from the slot, so no two people breathe together. */
const phaseOf = (slot: number): number => slot * 1.7;
const OWN_PHASE = 99;

export function buildWorld(stage: Stage, models: ReadonlyMap<string, Object3D>, people: readonly Shown[], ownFile: string, settings: ModeSettings): World {
  const root = new Group();
  root.name = "place";
  root.add(groundOf(stage));
  for (const model of stage.models) {
    const loaded = models.get(model.file);
    if (loaded === undefined || model.at.length === 0) continue;
    const copies = instanceModel(loaded, model.at, model.file);
    copies.userData = { file: model.file, signs: findSignAnchors(loaded).map((anchor) => anchor.key) };
    copies.traverse((object) => {
      object.castShadow = settings.shadows && castsShadow(model.file);
    });
    root.add(copies);
  }
  const crowd: Placed[] = [];
  people.forEach((shown, index) => {
    const loaded = models.get(shown.person.file);
    const spot = stage.people[index % Math.max(1, stage.people.length)];
    if (loaded === undefined || spot === undefined) return;
    const figure = figureOf(loaded, shown.person.pose, phaseOf(shown.slot));
    figure.root.position.set(spot[0], 0, spot[1]);
    figure.root.rotation.y = spot[2];
    figure.root.userData = { slot: shown.slot };
    figure.root.traverse((object) => {
      object.castShadow = settings.shadows;
    });
    if (shown.tag !== null) {
      const tag = nameTag(shown.tag);
      tag.position.set(0, 2.15, 0);
      figure.root.add(tag);
    }
    root.add(figure.root);
    crowd.push({ figure, slot: shown.slot });
  });
  const ownModel = models.get(ownFile);
  if (ownModel === undefined) throw new Error(`${ownFile} did not load`);
  const own = figureOf(ownModel, "stand", phaseOf(OWN_PHASE));
  own.root.userData = { own: true };
  own.root.traverse((object) => {
    object.castShadow = settings.shadows;
  });
  const indicator = ownIndicator();
  indicator.position.set(0, 2.2, 0);
  own.root.add(indicator);
  root.add(own.root);
  for (const motion of stage.motion) root.add(motionOf(motion, settings.mesh));
  return { root, crowd, own, indicator };
}

/** The colour of the sky and of the haze, by the place's light and the mode's atmosphere. */
export function skyColours(sky: PaletteName, ground: PaletteName, atmosphere: boolean): { sky: Color; fog: Color } {
  const top = colourOf(sky);
  return { sky: top, fog: atmosphere ? top.clone().lerp(colourOf(ground), 0.18) : top };
}
