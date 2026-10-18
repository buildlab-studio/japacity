// A look made the player's own (prologue:player-colours-on-looks), on the shipped model and no other: the people are
// painted a palette colour a vertex, so a part is found once through the skeleton and its vertices are given another
// palette colour. The hands' colour that the head shares is the skin (a bag in the hand is commoner there than the
// hand); the head's commonest dark colour that is not skin is the hair, the eyes kept as they are; the chest's and
// arms' commonest colour that is not skin is the top, painted wherever the body wears it but the head, hands and feet,
// so a dress or a suit changes whole. A top printed on the chest is the fabric material's, and its print is drawn
// again from the look's own pattern with the chosen ground, or another fabric, or none.
// A figure wears a copy: the colours of its own, sharing every other part of the model, and a print material of its
// own. Painting runs once a pick, never a frame.
import { linearToSrgb, nearestPaletteName, type PaletteName, paletteRgb, srgbToLinear } from "@japacity/assets";
import { drawPattern, type PatternSpec } from "@japacity/assets/pattern";
import { ALL_PEOPLE } from "@japacity/models/people/people.data";
import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  NearestFilter,
  type Object3D,
  RepeatWrapping,
  type SkinnedMesh,
  SRGBColorSpace,
  type Texture,
} from "three";

import { type Fabric, isMade, type LookStyle, type OwnColours, type Part, styleKey } from "./style";

/** The material a shipped person's one print is drawn with (assets:flat-and-smooth-shading). */
const PRINT = "pattern";
const HANDS = new Set(["handL", "handR"]);
const HEAD = "head";
/** Where a top shows its colour: the chest and the arms. */
const TOP_READ = new Set(["chest", "upperArmL", "upperArmR", "forearmL", "forearmR"]);
/** Where the top's colour is never the top's: the face, the hands and the shoes. */
const NOT_TOP = new Set(["head", "handL", "handR", "footL", "footR"]);
/** A colour this dark (8-bit sRGB channels summed) can be hair. */
const DARK = 200;
/** How far round the eyes' whites the eyes reach, in metres, so the pupils keep their colour under any hair colour. */
const EYE_MARGIN = 0.012;
const EYE_FRONT = 0.03;

/** The prints a look can take that it was not made with, each drawn from the pattern code with a fixed seed. */
const OTHER_PRINTS: Readonly<Record<Exclude<Fabric, "plain">, PatternSpec>> = {
  ankara: { kind: "ankara", seed: 4, cols: ["indigo", "gold", "orange", "cream"] },
  adire: { kind: "adire", seed: 2 },
  "aso-oke": { kind: "asoOke", seed: 6, cols: ["wine", "gold", "cream"] },
};

const fabricOfKind = (kind: PatternSpec["kind"]): Exclude<Fabric, "plain"> => (kind === "asoOke" ? "aso-oke" : kind);

/** A print's ground: the first of its colours, or adire's indigo, which takes none. */
function groundOf(spec: PatternSpec): PaletteName {
  if (spec.kind === "adire") return "indigo";
  return spec.cols?.[0] ?? (spec.kind === "ankara" ? "indigo" : "wine");
}

interface MeshReading {
  /** The colours as made, three a vertex, linear. */
  made: Float32Array;
  /** Each vertex's part, or null. */
  parts: (Part | null)[];
  print: boolean;
}

interface LookReading {
  own: OwnColours;
  /** The look's own print where its top is printed. */
  spec: PatternSpec | null;
  meshes: Map<BufferGeometry, MeshReading>;
}

const readings = new WeakMap<BufferGeometry, LookReading>();

function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (mesh.isMesh) found.push(mesh);
  });
  return found;
}

const materialsOf = (mesh: Mesh): Material[] => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
const isPrint = (mesh: Mesh): boolean => materialsOf(mesh).some((material) => material.name === PRINT);

/** The look's own print, by the shipped person's name the model's root carries. */
function specOf(root: Object3D): PatternSpec | null {
  let spec: PatternSpec | null = null;
  root.traverse((object) => {
    if (spec !== null || object.name === "") return;
    spec = ALL_PEOPLE.find((person) => person.name === object.name)?.patterns?.[0] ?? null;
  });
  return spec;
}

interface Tally {
  key: string[];
  bone: string[];
  x: number[];
  y: number[];
  z: number[];
}

/** Each vertex's colour as a palette name where it is one (the people are painted on the palette), its bone and place. */
function tallyOf(mesh: Mesh): { tally: Tally; made: Float32Array } | null {
  const colour = mesh.geometry.getAttribute("color") as BufferAttribute | undefined;
  const index = mesh.geometry.getAttribute("skinIndex") as BufferAttribute | undefined;
  const weight = mesh.geometry.getAttribute("skinWeight") as BufferAttribute | undefined;
  const position = mesh.geometry.getAttribute("position") as BufferAttribute | undefined;
  const bones = (mesh as SkinnedMesh).skeleton?.bones;
  if (colour === undefined || index === undefined || weight === undefined || position === undefined || bones === undefined) return null;
  const made = new Float32Array(colour.count * 3);
  const tally: Tally = { key: [], bone: [], x: [], y: [], z: [] };
  for (let i = 0; i < colour.count; i += 1) {
    const rgb = [colour.getX(i), colour.getY(i), colour.getZ(i)] as const;
    made.set(rgb, i * 3);
    const eight = rgb.map((channel) => Math.round(linearToSrgb(channel) * 255)) as [number, number, number];
    tally.key.push(nearestPaletteName(eight, 2) ?? eight.join(","));
    let at = 0;
    for (let k = 1; k < 4; k += 1) if (weight.getComponent(i, k) > weight.getComponent(i, at)) at = k;
    tally.bone.push(bones[index.getComponent(i, at)]?.name ?? "");
    tally.x.push(position.getX(i));
    tally.y.push(position.getY(i));
    tally.z.push(position.getZ(i));
  }
  return { tally, made };
}

const rgbOfKey = (key: string): [number, number, number] => (key.includes(",") ? (key.split(",").map(Number) as [number, number, number]) : paletteRgb(key as PaletteName));
const brightness = (key: string): number => rgbOfKey(key).reduce((sum, channel) => sum + channel, 0);
const asPalette = (key: string | undefined): PaletteName | null => (key === undefined || key.includes(",") ? null : (key as PaletteName));

function count(into: Map<string, number>, key: string, by = 1): void {
  into.set(key, (into.get(key) ?? 0) + by);
}

const ranked = (counts: Map<string, number>): string[] => [...counts].sort((a, b) => b[1] - a[1]).map(([key]) => key);

/** Reads a look once: its parts through the skeleton and its colours as made. Held by the model's first geometry. */
function readingOf(root: Object3D): LookReading | null {
  const meshes = meshesOf(root);
  const first = meshes[0];
  if (first === undefined) return null;
  const held = readings.get(sourceOf(first.geometry));
  if (held !== undefined) return held;

  const read = meshes.map((mesh) => ({ mesh, print: isPrint(mesh), ...tallyOf(mesh) }));
  const hands = new Map<string, number>();
  const head = new Map<string, number>();
  const around = new Map<string, number>();
  const upper = new Map<string, number>();
  let printOnChest = false;
  for (const { tally, print } of read) {
    if (tally === undefined) continue;
    tally.key.forEach((key, i) => {
      const bone = tally.bone[i] ?? "";
      if (print) {
        if (bone === "chest") printOnChest = true;
        return;
      }
      if (HANDS.has(bone)) count(hands, key);
      if (bone === HEAD) count(head, key);
      if (HANDS.has(bone) || bone === HEAD || bone === "neck") count(around, key);
      if (TOP_READ.has(bone)) count(upper, key);
    });
  }
  // The skin is on the hands and on the face: of the hands' colours, the one the head and neck share most.
  const skin = [...hands.keys()].sort((a, b) => (around.get(b) ?? 0) - (around.get(a) ?? 0))[0];
  // The eyes' whites: the head's lightest colour that is not skin. The pupils sit in and just in front of them, so
  // nothing there is hair.
  const whites = ranked(head)
    .filter((key) => key !== skin)
    .sort((a, b) => brightness(b) - brightness(a))[0];
  const boxes = new Map(read.map(({ mesh, tally }) => [mesh, tally === undefined ? null : eyesBox(tally, whites)]));
  const hairs = new Map<string, number>();
  for (const { mesh, tally, print } of read) {
    if (tally === undefined || print) continue;
    tally.key.forEach((key, i) => {
      if (tally.bone[i] === HEAD && !inBox(boxes.get(mesh) ?? null, tally, i)) count(hairs, key);
    });
  }
  const hair = ranked(hairs).find((key) => key !== skin && brightness(key) < DARK);
  const spec = printOnChest ? specOf(root) : null;
  const plainTop = spec === null ? ranked(upper).find((key) => key !== skin) : undefined;

  const reading: LookReading = {
    own: {
      skin: asPalette(skin),
      hair: asPalette(hair),
      top: spec !== null ? groundOf(spec) : asPalette(plainTop),
      fabric: spec !== null ? fabricOfKind(spec.kind) : null,
    },
    spec,
    meshes: new Map(),
  };
  for (const { mesh, tally, made, print } of read) {
    if (tally === undefined || made === undefined) continue;
    const box = boxes.get(mesh) ?? null;
    const parts = tally.key.map((key, i): Part | null => {
      if (print) return null;
      const bone = tally.bone[i] ?? "";
      if (key === skin) return "skin";
      if (key === hair && bone === HEAD && !inBox(box, tally, i)) return "hair";
      if (key === plainTop && !NOT_TOP.has(bone)) return "top";
      return null;
    });
    reading.meshes.set(sourceOf(mesh.geometry), { made, parts, print });
  }
  readings.set(sourceOf(first.geometry), reading);
  return reading;
}

type Box = [number, number, number, number, number, number] | null;

function eyesBox(tally: Tally, whites: string | undefined): Box {
  if (whites === undefined) return null;
  let box: Box = null;
  tally.key.forEach((key, i) => {
    if (key !== whites || tally.bone[i] !== HEAD) return;
    const x = tally.x[i] ?? 0;
    const y = tally.y[i] ?? 0;
    const z = tally.z[i] ?? 0;
    box = box === null ? [x, y, z, x, y, z] : [Math.min(box[0], x), Math.min(box[1], y), Math.min(box[2], z), Math.max(box[3], x), Math.max(box[4], y), Math.max(box[5], z)];
  });
  return box;
}

function inBox(box: Box, tally: Tally, i: number): boolean {
  if (box === null) return false;
  const x = tally.x[i] ?? 0;
  const y = tally.y[i] ?? 0;
  const z = tally.z[i] ?? 0;
  return x >= box[0] - EYE_MARGIN && x <= box[3] + EYE_MARGIN && y >= box[1] - EYE_MARGIN && y <= box[4] + EYE_MARGIN && z >= box[2] - EYE_MARGIN && z <= box[5] + EYE_FRONT;
}

/** The look's own colours, read from a loaded model or any figure copied from it; null where it carries no paint. */
export function readLook(root: Object3D): OwnColours | null {
  return readingOf(root)?.own ?? null;
}

// The worn copies. One a model's geometry: the colours of its own, every other attribute shared. A look carries one
// style at a time, which is all the game ever shows of the player at once.
interface Worn {
  geometry: BufferGeometry;
  material: Material | Material[];
  key: string;
}
const worn = new WeakMap<BufferGeometry, Worn>();
const sources = new WeakMap<BufferGeometry, { geometry: BufferGeometry; material: Material | Material[] }>();

function sourceOf(geometry: BufferGeometry): BufferGeometry {
  return sources.get(geometry)?.geometry ?? geometry;
}

function wornOf(mesh: Mesh): Worn {
  const source = sources.get(mesh.geometry) ?? { geometry: mesh.geometry, material: mesh.material };
  const held = worn.get(source.geometry);
  if (held !== undefined) return held;
  const geometry = new BufferGeometry();
  geometry.name = source.geometry.name;
  geometry.setIndex(source.geometry.index);
  for (const [name, attribute] of Object.entries(source.geometry.attributes)) {
    if (name !== "color") {
      geometry.setAttribute(name, attribute);
      continue;
    }
    const own = new BufferAttribute(new Float32Array(attribute.count * attribute.itemSize), attribute.itemSize);
    for (let i = 0; i < attribute.count; i += 1) for (let k = 0; k < attribute.itemSize; k += 1) own.setComponent(i, k, attribute.getComponent(i, k));
    geometry.setAttribute(name, own);
  }
  for (const group of source.geometry.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.boundingBox = source.geometry.boundingBox?.clone() ?? null;
  geometry.boundingSphere = source.geometry.boundingSphere?.clone() ?? null;
  const material = isPrint(mesh) ? (Array.isArray(source.material) ? source.material.map((one) => one.clone()) : source.material.clone()) : source.material;
  const made: Worn = { geometry, material, key: "" };
  worn.set(source.geometry, made);
  sources.set(geometry, source);
  return made;
}

const linear = (name: PaletteName): [number, number, number] => paletteRgb(name).map((channel) => srgbToLinear(channel / 255)) as [number, number, number];

const prints = new Map<string, DataTexture>();
/** Prints drawn and kept; a few picks on the door never draw more than this many at once. */
const PRINTS_KEPT = 12;

/** A print drawn from the pattern code, its ground swapped for `ground`, sampled as the made print is. */
const printKey = (spec: PatternSpec, ground: PaletteName): string => `${spec.kind}.${String(spec.seed)}.${(spec.cols ?? []).join(",")}.${ground}`;

function printOf(spec: PatternSpec, ground: PaletteName, like: Texture | null): DataTexture {
  const key = printKey(spec, ground);
  const held = prints.get(key);
  if (held !== undefined) return held;
  const image = drawPattern(spec);
  const from = paletteRgb(groundOf(spec));
  const to = paletteRgb(ground);
  const pixels = image.pixels;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === from[0] && pixels[i + 1] === from[1] && pixels[i + 2] === from[2]) {
      pixels[i] = to[0];
      pixels[i + 1] = to[1];
      pixels[i + 2] = to[2];
    }
  }
  const texture = new DataTexture(pixels, image.width, image.height);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = like?.magFilter ?? NearestFilter;
  texture.minFilter = like?.minFilter ?? NearestFilter;
  texture.generateMipmaps = like?.generateMipmaps ?? false;
  texture.flipY = like?.flipY ?? false;
  texture.needsUpdate = true;
  prints.set(key, texture);
  if (prints.size > PRINTS_KEPT) {
    // The bolts' prints stand in the corner for as long as the door is open, so they are never let go.
    const oldest = [...prints.keys()].find((held) => held !== key);
    if (oldest !== undefined) {
      prints.get(oldest)?.dispose();
      prints.delete(oldest);
    }
  }
  return texture;
}

/** The print material's map as the style has it: the made print, a print drawn again, or none for plain cloth. */
function printMap(reading: LookReading, style: LookStyle, made: Texture | null): Texture | null {
  const fabric = style.fabric;
  if (fabric === "plain") return null;
  if (fabric === undefined && style.top === undefined) return made;
  const own = reading.spec;
  const kind = fabric ?? reading.own.fabric;
  if (kind === null) return made;
  const spec = own !== null && fabricOfKind(own.kind) === kind ? own : OTHER_PRINTS[kind];
  return printOf(spec, style.top ?? reading.own.top ?? groundOf(spec), made);
}

const madeMaps = new WeakMap<Material, Texture | null>();

function paint(target: Worn, mesh: MeshReading, reading: LookReading, style: LookStyle): void {
  const colour = target.geometry.getAttribute("color") as BufferAttribute;
  const plain = mesh.print && style.fabric === "plain" ? linear(style.top ?? reading.own.top ?? "white") : null;
  const swap: Record<Part, [number, number, number] | null> = {
    skin: style.skin === undefined ? null : linear(style.skin),
    hair: style.hair === undefined ? null : linear(style.hair),
    top: style.top === undefined ? null : linear(style.top),
  };
  for (let i = 0; i < colour.count; i += 1) {
    const part = mesh.parts[i] ?? null;
    const to = plain ?? (part === null ? null : swap[part]);
    if (to !== null) colour.setXYZ(i, to[0], to[1], to[2]);
    else colour.setXYZ(i, mesh.made[i * 3] ?? 1, mesh.made[i * 3 + 1] ?? 1, mesh.made[i * 3 + 2] ?? 1);
  }
  colour.needsUpdate = true;
  if (!mesh.print) return;
  for (const material of Array.isArray(target.material) ? target.material : [target.material]) {
    if (material.name !== PRINT) continue;
    const print = material as MeshStandardMaterial;
    if (!madeMaps.has(print)) madeMaps.set(print, print.map);
    const map = printMap(reading, style, madeMaps.get(print) ?? null);
    if ((map === null) !== (print.map === null)) print.needsUpdate = true;
    print.map = map;
  }
}

/**
 * Dresses a figure in a style: each part's vertices take the chosen colour and the print its fabric, on a copy the
 * figure wears, so the model and every other copy of it stay as made. As made, the figure wears the model itself.
 * Call it on a pick; a style already worn is not painted again.
 */
export function wear(root: Object3D, style: LookStyle | undefined): void {
  const reading = readingOf(root);
  if (reading === null) return;
  const key = styleKey(style);
  for (const mesh of meshesOf(root)) {
    const source = sources.get(mesh.geometry) ?? { geometry: mesh.geometry, material: mesh.material };
    if (isMade(style) || style === undefined) {
      mesh.geometry = source.geometry;
      mesh.material = source.material;
      continue;
    }
    const own = reading.meshes.get(source.geometry);
    if (own === undefined) continue;
    const copy = wornOf(mesh);
    if (copy.key !== key) {
      paint(copy, own, reading, style);
      copy.key = key;
    }
    mesh.geometry = copy.geometry;
    mesh.material = copy.material;
  }
}
