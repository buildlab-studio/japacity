// Writing and reading the shipped files (decision 0009 sections 3 and 5). A model is written with
// gltf-transform's NodeIO, compressed with meshopt, and read back the same way by the check, so the
// register's figures are always what is in the file. Normals are left out of hard-edged models: glTF
// asks a loader for flat normals when none are given, which is the look assets:flat-and-smooth-shading wants for them.
// A model with round parts carries normals and names those parts in its node's extras.
import { type Document as GltfDocument, Document, type Node as GltfNode, NodeIO, type Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds, meshopt } from "@gltf-transform/functions";
import { wallPairs } from "@japacity/assets";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

import type { BakedModel, MaterialRole } from "./bake";
import { encodeIndexedPng } from "./png";

async function io(): Promise<NodeIO> {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
}

/** Builds the glTF document of a baked model: one material for the body, one more for a sign or a pattern. */
export function toDocument(model: BakedModel): GltfDocument {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const materials = new Map<MaterialRole, ReturnType<GltfDocument["createMaterial"]>>();
  const material = (role: MaterialRole): ReturnType<GltfDocument["createMaterial"]> => {
    let found = materials.get(role);
    if (found !== undefined) return found;
    found = doc.createMaterial(role).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.9).setMetallicFactor(0);
    if (role === "pattern" && model.pattern !== undefined) {
      const png = encodeIndexedPng(model.pattern);
      const texture = doc.createTexture("pattern").setMimeType("image/png").setImage(png);
      found.setBaseColorTexture(texture);
      found.getBaseColorTextureInfo()?.setWrapS(10497).setWrapT(10497);
    }
    materials.set(role, found);
    return found;
  };
  const accessor = (
    array: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer> | Uint32Array<ArrayBuffer> | Uint8Array<ArrayBuffer>,
    type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT4",
  ) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);

  const root = doc.createNode(model.name).setExtras(model.extras);
  const scene = doc.createScene(model.name).addChild(root);
  doc.getRoot().setDefaultScene(scene);

  let skin: ReturnType<GltfDocument["createSkin"]> | null = null;
  if (model.bones !== undefined) {
    const nodes = model.bones.map((bone) => doc.createNode(bone.name).setTranslation(bone.position));
    const world: [number, number, number][] = [];
    model.bones.forEach((bone, i) => {
      const parent = bone.parent >= 0 ? nodes[bone.parent] : undefined;
      const node = nodes[i];
      if (node === undefined) return;
      if (parent === undefined) root.addChild(node);
      else parent.addChild(node);
      const [ux, uy, uz] = bone.parent >= 0 ? (world[bone.parent] ?? [0, 0, 0]) : [0, 0, 0];
      world.push([ux + bone.position[0], uy + bone.position[1], uz + bone.position[2]]);
    });
    const inverse = new Float32Array(16 * nodes.length);
    world.forEach(([x, y, z], i) => inverse.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1], i * 16));
    skin = doc.createSkin(`${model.name}-skin`).setInverseBindMatrices(accessor(inverse, "MAT4"));
    for (const node of nodes) skin.addJoint(node);
    const first = nodes[0];
    if (first !== undefined) skin.setSkeleton(first);
  }

  for (const part of model.parts) {
    const mesh = doc.createMesh(part.node);
    for (const p of part.primitives) {
      const prim: Primitive = doc
        .createPrimitive()
        .setMaterial(material(p.material))
        .setAttribute("POSITION", accessor(new Float32Array(p.positions), "VEC3"))
        .setIndices(accessor(new Uint32Array(p.indices), "SCALAR"));
      if (p.normals !== undefined) prim.setAttribute("NORMAL", accessor(new Float32Array(p.normals), "VEC3"));
      if (p.colours !== undefined) prim.setAttribute("COLOR_0", accessor(new Float32Array(p.colours), "VEC3"));
      if (p.uvs !== undefined) prim.setAttribute("TEXCOORD_0", accessor(new Float32Array(p.uvs), "VEC2"));
      if (p.joints !== undefined) prim.setAttribute("JOINTS_0", accessor(new Uint8Array(p.joints), "VEC4"));
      if (p.weights !== undefined) prim.setAttribute("WEIGHTS_0", accessor(new Float32Array(p.weights), "VEC4"));
      mesh.addPrimitive(prim);
    }
    const node = doc.createNode(part.node).setMesh(mesh);
    if (part.extras !== undefined) node.setExtras(part.extras);
    if (skin !== null) node.setSkin(skin);
    root.addChild(node);
  }
  return doc;
}

/**
 * Compresses with meshopt at the medium level and returns the file's bytes. Colours keep 16 bits so
 * dark palette entries survive the round trip within 1, and positions 16 bits so a 600 m bridge
 * still stands on y = 0 within 0.01 m (assets:metre-units-and-origin).
 */
export async function writeGlb(doc: GltfDocument): Promise<Uint8Array> {
  const reader = await io();
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium", quantizeColor: 16, quantizePosition: 16 }));
  return reader.writeBinary(doc);
}

export async function readGlb(bytes: Uint8Array): Promise<GltfDocument> {
  return (await io()).readBinary(bytes);
}

export interface Measured {
  triangles: number;
  /** Draw calls with the model shown: a wall pair's two parts show one at a time, so the pair costs one (assets:assets-and-places-within-budget). */
  drawCalls: number;
  /** The sides a home's shell builds twice, full and knee-high; 0 for any other model. */
  pairs: number;
  materials: number;
  bytes: number;
  /** Lowest and highest y over the default scene, in metres. */
  minY: number;
  maxY: number;
  size: [number, number, number];
}

function primitiveTriangles(prim: Primitive): number {
  const indices = prim.getIndices();
  const count = indices === null ? (prim.getAttribute("POSITION")?.getCount() ?? 0) : indices.getCount();
  return Math.floor(count / 3);
}

/** a times b, both 4 by 4 in glTF's column-major order. */
function multiply(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] = (out[c * 4 + r] ?? 0) + (a[k * 4 + r] ?? 0) * (b[c * 4 + k] ?? 0);
  return out;
}

/**
 * The bounds of a skinned mesh in its bind pose. Quantization moves a skinned mesh's dequantization
 * into its inverse bind matrices, so the positions alone are not metres: each vertex goes through
 * its first joint's world matrix times that joint's inverse bind matrix.
 */
function skinnedBounds(node: GltfNode, min: number[], max: number[]): void {
  const skin = node.getSkin();
  const mesh = node.getMesh();
  if (skin === null || mesh === null) return;
  const inverse = skin.getInverseBindMatrices();
  const joints = skin.listJoints();
  const matrices = joints.map((joint, j) => multiply(joint.getWorldMatrix(), inverse?.getElement(j, []) ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  for (const prim of mesh.listPrimitives()) {
    const position = prim.getAttribute("POSITION");
    const joint = prim.getAttribute("JOINTS_0");
    if (position === null) continue;
    const p: number[] = [];
    const jv: number[] = [];
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, p);
      joint?.getElement(i, jv);
      const m = matrices[jv[0] ?? 0] ?? matrices[0] ?? [];
      for (let axis = 0; axis < 3; axis++) {
        const v = (m[axis] ?? 0) * (p[0] ?? 0) + (m[4 + axis] ?? 0) * (p[1] ?? 0) + (m[8 + axis] ?? 0) * (p[2] ?? 0) + (m[12 + axis] ?? 0);
        min[axis] = Math.min(min[axis] ?? Infinity, v);
        max[axis] = Math.max(max[axis] ?? -Infinity, v);
      }
    }
  }
}

/** Triangles, draw calls, materials and bytes, as the register records them (assets:register-matches-every-file), and the bounds in metres. */
export function measure(doc: GltfDocument, bytes: number): Measured {
  let triangles = 0;
  let drawCalls = 0;
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  if (scene === undefined) throw new Error("measure: no scene");
  let skinned = false;
  const names: string[] = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  scene.traverse((node) => {
    const mesh = node.getMesh();
    if (mesh === null) return;
    names.push(node.getName());
    for (const prim of mesh.listPrimitives()) {
      triangles += primitiveTriangles(prim);
      drawCalls += 1;
    }
    if (node.getSkin() !== null) {
      skinned = true;
      skinnedBounds(node, min, max);
    }
  });
  if (!skinned) {
    const bounds = getBounds(scene);
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = bounds.min[axis] ?? 0;
      max[axis] = bounds.max[axis] ?? 0;
    }
  }
  const [x0 = 0, y0 = 0, z0 = 0] = min;
  const [x1 = 0, y1 = 0, z1 = 0] = max;
  // Both parts of a pair count their triangles and bytes; the one hidden costs no draw call.
  const pairs = wallPairs(names);
  return { triangles, drawCalls: drawCalls - pairs, pairs, materials: doc.getRoot().listMaterials().length, bytes, minY: y0, maxY: y1, size: [x1 - x0, y1 - y0, z1 - z0] };
}
