import { readFileSync } from "node:fs";

import { BoxGeometry, type BufferAttribute, Group, type Material, Mesh, MeshStandardMaterial, type Object3D, SphereGeometry } from "three";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, test } from "vitest";

import { findSignAnchors, prepareModel } from "./load";

const flatOf = (mesh: Mesh): boolean => (mesh.material as MeshStandardMaterial).flatShading;

async function loadShipped(file: string): Promise<Object3D> {
  const bytes = readFileSync(new URL(`../../../apps/client/public/assets/${file}`, import.meta.url));
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  return gltf.scene;
}

describe("loading a model", () => {
  test("[R-ASSET-005] given a model whose materials lost flat shading in compression, when the loader prepares it, then every material is flat shaded", () => {
    const root = new Group();
    const a = new MeshStandardMaterial({ flatShading: false });
    const b = new MeshStandardMaterial({ flatShading: false });
    root.add(new Mesh(new BoxGeometry(), a));
    const child = new Group();
    child.add(new Mesh(new BoxGeometry(), [b, a]));
    root.add(child);
    prepareModel(root);
    expect(a.flatShading).toBe(true);
    expect(b.flatShading).toBe(true);
  });

  test("[R-ASSET-005] given nodes whose extras name round parts, when the loader prepares them, then those are smooth and every other mesh flat", () => {
    const root = new Group();
    const shared = new MeshStandardMaterial({ flatShading: false });
    const hard = new Mesh(new BoxGeometry(), shared);
    const person = new Mesh(new SphereGeometry(), shared);
    person.userData = { smooth: ["head", "hands"] };
    const pot = new Mesh(new SphereGeometry().deleteAttribute("normal"), new MeshStandardMaterial({ flatShading: true }));
    const holder = new Group();
    holder.userData = { smooth: true };
    holder.add(pot);
    const listedWithoutNormals = new Mesh(new BoxGeometry().deleteAttribute("normal"), new MeshStandardMaterial());
    listedWithoutNormals.userData = { smooth: ["head"] };
    root.add(hard, person, holder, listedWithoutNormals);
    prepareModel(root);
    expect(flatOf(hard)).toBe(true);
    expect(flatOf(person)).toBe(false);
    expect(person.material).not.toBe(shared);
    expect(flatOf(pot)).toBe(false);
    expect(pot.geometry.getAttribute("normal")).toBeDefined();
    expect(flatOf(listedWithoutNormals)).toBe(true);
  });

  test("[R-ASSET-005] given a baked person, when the loader prepares it, then the head is smooth and the torso flat", async () => {
    const root = await loadShipped("shared/chr/chr_tunde.glb");
    prepareModel(root);
    const meshes: Mesh[] = [];
    root.traverse((object) => {
      if ((object as Mesh).isMesh) meshes.push(object as Mesh);
    });
    const body = meshes[0];
    if (body === undefined) throw new Error("no mesh");
    expect(meshes).toHaveLength(1);
    expect((body.material as Material & { flatShading: boolean }).flatShading).toBe(false);
    const geometry = body.geometry;
    const normal = geometry.getAttribute("normal") as BufferAttribute;
    const joints = geometry.getAttribute("skinIndex") as BufferAttribute;
    const weights = geometry.getAttribute("skinWeight") as BufferAttribute;
    const index = geometry.getIndex();
    if (index === null) throw new Error("no index");
    const HEAD = 4;
    const TORSO = [0, 1, 2];
    const spread = (i: number, j: number, k: number): number => {
      let most = 0;
      for (const [a, b] of [[i, j], [j, k], [k, i]] as const) {
        most = Math.max(most, Math.hypot(normal.getX(a) - normal.getX(b), normal.getY(a) - normal.getY(b), normal.getZ(a) - normal.getZ(b)));
      }
      return most;
    };
    let head = 0;
    let headSmooth = 0;
    let torso = 0;
    let torsoFlat = 0;
    for (let t = 0; t < index.count; t += 3) {
      const tri = [index.getX(t), index.getX(t + 1), index.getX(t + 2)] as const;
      if (tri.every((v) => joints.getX(v) === HEAD && weights.getX(v) > 0.99)) {
        head += 1;
        if (spread(...tri) > 0.02) headSmooth += 1;
      }
      if (tri.every((v) => TORSO.includes(joints.getX(v)) && weights.getX(v) > 0.99)) {
        torso += 1;
        if (spread(...tri) < 0.02) torsoFlat += 1;
      }
    }
    expect(head).toBeGreaterThan(100);
    expect(headSmooth / head).toBeGreaterThan(0.9);
    expect(torso).toBeGreaterThan(20);
    expect(torsoFlat).toBe(torso);
  });

  test("[R-ASSET-012] given a model whose node extras carry sign anchors, when the loader looks for them, then it finds the text keys, not words", () => {
    const root = new Group();
    const node = new Group();
    node.userData = { signs: [{ key: "place.ojuelegba.sign.1", centre: [0, 3, 2], width: 3, height: 0.7, ry: 0, style: { board: "blue", ink: "white" } }] };
    root.add(node);
    expect(findSignAnchors(root).map((sign) => sign.key)).toEqual(["place.ojuelegba.sign.1"]);
  });
});
