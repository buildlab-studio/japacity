// Your colours on the game's own looks (prologue:player-colours-on-looks): the parts are found through the skeleton of the
// shipped model and its vertices painted with palette colours on a copy the figure wears, once a pick.
import { type PaletteName, paletteRgb, srgbToLinear } from "@japacity/assets";
import { ALL_PEOPLE } from "@japacity/models/people/people.data";
import { drawPattern } from "@japacity/assets/pattern";
import { Bone, BufferAttribute, BufferGeometry, DataTexture, Group, type Mesh, MeshStandardMaterial, type Object3D, Skeleton, SkinnedMesh } from "three";
import { describe, expect, test } from "vitest";

import { figureOf } from "../three/people";
import { readLook, wear } from "./colours";

const BONES = ["hips", "spine", "chest", "neck", "head", "upperArmL", "forearmL", "handL", "handR", "upperLegL", "footL"] as const;
type BoneName = (typeof BONES)[number];
interface Vertex {
  colour: PaletteName;
  bone: BoneName;
  at?: [number, number, number];
}

const linear = (name: PaletteName): number[] => paletteRgb(name).map((channel) => srgbToLinear(channel / 255));

function meshOf(vertices: readonly Vertex[], material: MeshStandardMaterial, skeleton: Skeleton): SkinnedMesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices.flatMap((v) => v.at ?? [0, 1, 0])), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(vertices.flatMap((v) => linear(v.colour))), 3));
  geometry.setAttribute("skinIndex", new BufferAttribute(new Uint16Array(vertices.flatMap((v) => [BONES.indexOf(v.bone), 0, 0, 0])), 4));
  geometry.setAttribute("skinWeight", new BufferAttribute(new Float32Array(vertices.flatMap(() => [1, 0, 0, 0])), 4));
  const mesh = new SkinnedMesh(geometry, material);
  mesh.bind(skeleton);
  return mesh;
}

const times = (n: number, vertex: Vertex): Vertex[] => Array.from({ length: n }, () => vertex);

/** The eyes' whites and the pupils in front of them, as the shipped faces have them. */
const EYES: Vertex[] = [...times(2, { colour: "white", bone: "head", at: [0, 1.6, 0.1] }), ...times(2, { colour: "black", bone: "head", at: [0.01, 1.6, 0.11] })];

/** A look as the people builder makes one: a body of palette colours, and where `printed`, a print on the chest. */
function look(name: string, body: readonly Vertex[], printed = false): Group {
  const bones = BONES.map((bone) => Object.assign(new Bone(), { name: bone }));
  const skeleton = new Skeleton(bones);
  const root = new Group();
  root.name = name;
  root.add(bones[0]!);
  for (const bone of bones.slice(1)) bones[0]!.add(bone);
  const holder = new Group();
  root.add(holder);
  holder.add(meshOf(body, Object.assign(new MeshStandardMaterial({ vertexColors: true }), { name: "body" }), skeleton));
  if (printed) {
    const made = new DataTexture(new Uint8Array(4 * 4 * 4).fill(200), 4, 4);
    const print = Object.assign(new MeshStandardMaterial({ vertexColors: true, map: made }), { name: "pattern" });
    holder.add(meshOf([...times(6, { colour: "white", bone: "chest" }), ...times(3, { colour: "white", bone: "hips" })], print, skeleton));
  }
  return root;
}

/** A man in a green tee and denim trousers, a bag in his hand, green shoes, wine lips. */
const TEE: Vertex[] = [
  ...times(4, { colour: "skin4", bone: "handL" }),
  ...times(6, { colour: "darkWood", bone: "handL" }),
  ...times(10, { colour: "skin4", bone: "head" }),
  ...times(2, { colour: "skin4", bone: "neck" }),
  ...times(5, { colour: "hair", bone: "head", at: [0, 1.75, 0] }),
  ...EYES,
  { colour: "wine", bone: "head", at: [0, 1.5, 0.12] },
  ...times(6, { colour: "green", bone: "chest" }),
  { colour: "skin4", bone: "chest" },
  ...times(3, { colour: "green", bone: "upperArmL" }),
  ...times(2, { colour: "green", bone: "hips" }),
  ...times(6, { colour: "denim", bone: "hips" }),
  ...times(4, { colour: "denim", bone: "upperLegL" }),
  ...times(2, { colour: "green", bone: "footL" }),
];

function meshes(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Mesh).isMesh) found.push(object as Mesh);
  });
  return found;
}

/** Each vertex's colour on a figure, by the palette name it was given, in order. */
function painted(root: Object3D, at = 0): string[] {
  const colour = meshes(root)[at]!.geometry.getAttribute("color") as BufferAttribute;
  const names = (["skin4", "skin1", "hair", "gold", "white", "black", "wine", "darkWood", "green", "indigo", "denim", "teal"] as const).map((name) => [name, linear(name)] as const);
  return Array.from({ length: colour.count }, (_, i) => names.find(([, rgb]) => Math.abs(rgb[0]! - colour.getX(i)) < 1e-4 && Math.abs(rgb[1]! - colour.getY(i)) < 1e-4 && Math.abs(rgb[2]! - colour.getZ(i)) < 1e-4)?.[0] ?? "?");
}

describe("the parts, found through the skeleton", () => {
  test("[prologue:player-colours-on-looks] given a look whose hand holds a bag, when it is read, then the skin is the hands' colour the face shares, the hair the head's commonest dark colour, the top the chest's and arms' commonest, and it has no print", () => {
    expect(readLook(look("chr_test_tee", TEE))).toEqual({ skin: "skin4", hair: "hair", top: "green", fabric: null });
  });

  test("[prologue:player-colours-on-looks] given a head under a black cap, when it is read, then the cap is read as its hair but the pupils, the same black, are not", () => {
    const capped = look("chr_test_cap", [...TEE.filter((v) => v.colour !== "hair"), ...times(5, { colour: "black", bone: "head", at: [0, 1.8, 0] })]);
    expect(readLook(capped)?.hair).toBe("black");
    const figure = figureOf(capped, "stand", 0);
    wear(figure.root, { hair: "gold" });
    const after = painted(figure.root);
    expect(after.filter((name) => name === "gold")).toHaveLength(5);
    // The pupils, inside the eyes' whites, keep their black.
    expect(after.filter((name) => name === "black")).toHaveLength(2);
  });

  test("[prologue:player-colours-on-looks] given the look with a printed top, when it is read, then the fabric is its own print and the top colour the print's ground", () => {
    const ada = ALL_PEOPLE.find((person) => person.name === "chr_ada")!;
    const ground = ada.patterns![0]!.cols![0]!;
    expect(readLook(look("chr_ada", TEE.filter((v) => v.bone !== "chest" && v.bone !== "upperArmL"), true))).toEqual({ skin: "skin4", hair: "hair", top: ground, fabric: "ankara" });
  });
});

describe("the colours, painted on a copy", () => {
  test("[prologue:player-colours-on-looks] given a style, when a figure wears it, then the skin, the hair and the top change wherever the body wears them, and the eyes, the lips, the bag, the trousers and the shoes stay as made", () => {
    const model = look("chr_test_wear", TEE);
    const figure = figureOf(model, "stand", 0);
    const before = painted(figure.root);
    wear(figure.root, { skin: "skin1", hair: "gold", top: "indigo" });
    const after = painted(figure.root);
    after.forEach((name, i) => {
      const was = before[i];
      const want = was === "skin4" ? "skin1" : was === "hair" ? "gold" : was === "green" && TEE[i]!.bone !== "footL" ? "indigo" : was;
      expect(`${String(i)} ${name}`).toBe(`${String(i)} ${want ?? "?"}`);
    });
    // The tee's hem on the hips changes with it; the shoes of the same green do not.
    expect(after.filter((name) => name === "indigo")).toHaveLength(11);
    expect(after.filter((name) => name === "green")).toHaveLength(2);
  });

  test("[prologue:player-colours-on-looks] given a figure in a style, then the model and every other copy of it stay as made, and back to as made the figure wears the model's own colours again", () => {
    const model = look("chr_test_copy", TEE);
    const made = painted(model);
    const worn = figureOf(model, "stand", 0);
    const other = figureOf(model, "stand", 1);
    wear(worn.root, { skin: "skin1" });
    expect(painted(model)).toEqual(made);
    expect(painted(other.root)).toEqual(made);
    expect(meshes(worn.root)[0]!.geometry).not.toBe(meshes(model)[0]!.geometry);
    wear(worn.root, {});
    expect(meshes(worn.root)[0]!.geometry).toBe(meshes(model)[0]!.geometry);
    expect(painted(worn.root)).toEqual(made);
  });

  test("[prologue:player-colours-on-looks] given a style already worn, when it is worn again, then nothing is painted again: a pick paints once, never a frame", () => {
    const model = look("chr_test_once", TEE);
    const figure = figureOf(model, "stand", 0);
    wear(figure.root, { top: "teal" });
    const colour = meshes(figure.root)[0]!.geometry.getAttribute("color") as BufferAttribute;
    const version = colour.version;
    for (let frame = 0; frame < 60; frame += 1) wear(figure.root, { top: "teal" });
    expect(colour.version).toBe(version);
    wear(figure.root, { top: "white" });
    expect(colour.version).toBeGreaterThan(version);
  });

  test("[prologue:player-colours-on-looks] given a printed top, when the fabric is plain, ankara in a chosen ground, or as made, then the print goes and the cloth takes the top colour, the print is drawn again on that ground, or the made print returns", () => {
    const model = look("chr_ada", TEE.filter((v) => v.bone !== "chest" && v.bone !== "upperArmL"), true);
    const madeMap = (meshes(model)[1]!.material as MeshStandardMaterial).map;
    const figure = figureOf(model, "stand", 0);
    const print = () => meshes(figure.root)[1]!.material as MeshStandardMaterial;

    wear(figure.root, { fabric: "plain", top: "indigo" });
    expect(print().map).toBeNull();
    expect(new Set(painted(figure.root, 1))).toEqual(new Set(["indigo"]));
    // The model's own print material is untouched.
    expect((meshes(model)[1]!.material as MeshStandardMaterial).map).toBe(madeMap);

    wear(figure.root, { top: "indigo" });
    const drawn = print().map as DataTexture;
    expect(drawn).not.toBe(madeMap);
    const ada = ALL_PEOPLE.find((person) => person.name === "chr_ada")!.patterns![0]!;
    const own = drawPattern(ada);
    const [r, g, b] = paletteRgb("indigo");
    const ground = paletteRgb(ada.cols![0]!);
    const pixels = drawn.image.data as Uint8Array;
    for (let i = 0; i < own.pixels.length; i += 4) {
      const wasGround = own.pixels[i] === ground[0] && own.pixels[i + 1] === ground[1] && own.pixels[i + 2] === ground[2];
      expect([pixels[i], pixels[i + 1], pixels[i + 2]]).toEqual(wasGround ? [r, g, b] : [own.pixels[i], own.pixels[i + 1], own.pixels[i + 2]]);
    }
    expect(new Set(painted(figure.root, 1))).toEqual(new Set(["white"]));

    wear(figure.root, { skin: "skin1" });
    expect(print().map).toBe(madeMap);
  });
});
