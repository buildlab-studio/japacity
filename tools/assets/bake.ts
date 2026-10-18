// Baking (decision 0009 section 3): every part of a builder's group merged into one mesh
// per material, with the palette colour on the vertices. Signs leave the body: a building
// keeps only their anchors, a shopfront ships their faces as a second primitive whose
// texture the client draws at run time (assets:sign-text-drawn-in-code).
import { packSigns, palette, SIGN_ATLAS, signAnchorsOf, srgbToLinear, isPaletteName, type SignAnchor } from "@japacity/assets";
import { type BufferGeometry, Matrix4, type Mesh, type Object3D, Vector3 } from "three";

import type { RgbaImage } from "./png";

export type MaterialRole = "body" | "sign" | "pattern";

interface BakedPrimitive {
  material: MaterialRole;
  positions: number[];
  /** Unit normals, three a vertex: only where a model has round parts drawn smooth (assets:flat-and-smooth-shading). */
  normals?: number[];
  /** Linear RGB, three a vertex, as glTF stores vertex colours. */
  colours?: number[];
  uvs?: number[];
  joints?: number[];
  weights?: number[];
  indices: number[];
}

interface BakedPart {
  node: string;
  primitives: BakedPrimitive[];
  /**
   * The node's extras. `smooth` names the round parts the loader leaves smooth (assets:flat-and-smooth-shading): a list
   * of part names where the primitives carry normals, or true for a whole node shaded smooth.
   */
  extras?: { smooth?: string[] | true };
}

export interface Bone {
  name: string;
  parent: number;
  /** Relative to the parent bone, in metres. */
  position: [number, number, number];
}

export interface BakedModel {
  name: string;
  parts: BakedPart[];
  extras: Record<string, unknown>;
  pattern?: RgbaImage;
  bones?: Bone[];
}

/** The linear colour of a palette entry, as the vertex carries it. */
export function linearColour(name: string): [number, number, number] {
  if (!isPaletteName(name)) throw new Error(`Not a palette colour: ${name}`);
  const value = palette[name];
  return [srgbToLinear(((value >> 16) & 0xff) / 255), srgbToLinear(((value >> 8) & 0xff) / 255), srgbToLinear((value & 0xff) / 255)];
}

/** A builder marks a round node with `userData.smooth = true`; it ships smooth (assets:flat-and-smooth-shading). */
function isSmooth(object: Object3D, root: Object3D): boolean {
  let at: Object3D | null = object;
  while (at !== null && at !== root) {
    if ((at.userData as { smooth?: unknown }).smooth === true) return true;
    at = at.parent;
  }
  return false;
}

function partOf(object: Object3D, root: Object3D): string {
  let at: Object3D | null = object;
  while (at !== null && at !== root) {
    const node = (at.userData as { node?: unknown }).node;
    if (typeof node === "string") return node;
    at = at.parent;
  }
  return "body";
}

class Welder {
  readonly positions: number[] = [];
  readonly colours: number[] = [];
  readonly indices: number[] = [];
  private readonly seen = new Map<string, number>();

  add(p: Vector3, colour: string): void {
    const key = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)},${colour}`;
    let index = this.seen.get(key);
    if (index === undefined) {
      index = this.positions.length / 3;
      this.seen.set(key, index);
      this.positions.push(p.x, p.y, p.z);
      this.colours.push(...linearColour(colour));
    }
    this.indices.push(index);
  }
}

function triangles(geometry: BufferGeometry): number[][] {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const count = index === null ? position.count : index.count;
  const out: number[][] = [];
  for (let i = 0; i + 2 < count; i += 3) {
    out.push(index === null ? [i, i + 1, i + 2] : [index.getX(i), index.getX(i + 1), index.getX(i + 2)]);
  }
  return out;
}

/** Bakes a builder's group: one primitive per part in the body material, every vertex coloured by its palette name. */
export function bakeGroup(root: Object3D, name: string, options: { shipSigns: boolean }): BakedModel {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const welders = new Map<string, Welder>();
  const smooth = new Set<string>();
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (Array.isArray(material)) throw new Error(`${name}: a part has more than one material`);
    const colour = (material.userData as { palette?: unknown }).palette;
    if (typeof colour !== "string") throw new Error(`${name}: a part's material names no palette colour (assets:colours-from-named-palette)`);
    const matrix = new Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld);
    const mirrored = matrix.determinant() < 0;
    const node = partOf(mesh, root);
    if (isSmooth(mesh, root)) smooth.add(node);
    let welder = welders.get(node);
    if (welder === undefined) {
      welder = new Welder();
      welders.set(node, welder);
    }
    const position = mesh.geometry.getAttribute("position");
    for (const tri of triangles(mesh.geometry)) {
      const [i0 = 0, i1 = 0, i2 = 0] = mirrored ? [tri[0], tri[2], tri[1]] : tri;
      a.fromBufferAttribute(position, i0).applyMatrix4(matrix);
      b.fromBufferAttribute(position, i1).applyMatrix4(matrix);
      c.fromBufferAttribute(position, i2).applyMatrix4(matrix);
      const area = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).length();
      if (area < 1e-9) continue;
      welder.add(a, colour);
      welder.add(b, colour);
      welder.add(c, colour);
    }
  });
  const parts: BakedPart[] = [...welders].map(([node, welder]) => ({
    node,
    primitives: [{ material: "body", positions: welder.positions, colours: welder.colours, indices: welder.indices }],
    ...(smooth.has(node) ? { extras: { smooth: true as const } } : {}),
  }));
  const anchors = signAnchorsOf(root).map((anchor) => ({ ...anchor, centre: [...anchor.centre] as [number, number, number] }));
  const extras: Record<string, unknown> = {};
  if (anchors.length > 0) {
    if (options.shipSigns) {
      const rects = packSigns(anchors);
      anchors.forEach((anchor, i) => {
        anchor.rect = rects[i] ?? [0, 0, 0, 0];
      });
      const body = parts.find((part) => part.node === "body");
      if (body === undefined) throw new Error(`${name}: signs with no body`);
      body.primitives.push(signFaces(anchors));
    }
    extras.signs = anchors;
    extras.signAtlas = SIGN_ATLAS;
  }
  const dishes = (root.userData as { dishes?: unknown }).dishes;
  if (Array.isArray(dishes)) extras.dishes = dishes;
  const clutter = (root.userData as { clutter?: unknown }).clutter;
  if (Array.isArray(clutter)) extras.clutter = clutter;
  const footprint = (root.userData as { footprint?: unknown }).footprint;
  if (footprint !== undefined) extras.footprint = footprint;
  return { name, parts, extras };
}

/** The faces of every sign, each a quad mapped onto its rectangle of the one sign atlas. */
function signFaces(anchors: readonly SignAnchor[]): BakedPrimitive {
  const [atlasW, atlasH] = SIGN_ATLAS;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const anchor of anchors) {
    const [x, y, w, h] = anchor.rect ?? [0, 0, 0, 0];
    const right = [Math.cos(anchor.ry), 0, -Math.sin(anchor.ry)];
    const [cx, cy, cz] = anchor.centre;
    const base = positions.length / 3;
    // Left bottom, right bottom, right top, left top. UVs run down from the atlas's top-left corner, as glTF's do.
    for (const [sx, sy, u, v] of [[-1, -1, x, y + h], [1, -1, x + w, y + h], [1, 1, x + w, y], [-1, 1, x, y]] as const) {
      positions.push(cx + (right[0] ?? 0) * sx * (anchor.width / 2), cy + sy * (anchor.height / 2), cz + (right[2] ?? 0) * sx * (anchor.width / 2));
      uvs.push(u / atlasW, v / atlasH);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { material: "sign", positions, uvs, indices };
}
