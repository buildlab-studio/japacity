// What the client does to a model after loading it (R-ASSET-005, R-ASSET-012). Flat shading does
// not survive compression (the design's known fault), so it is set here on every material, except where
// a node's extras name round parts to show smooth. Sign text is drawn here, at run time, from the
// place's text keys, onto one canvas per model.
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  SRGBColorSpace,
} from "three";

import { paletteCss } from "./palette";
import { packSigns, SIGN_ATLAS, type SignAnchor, type SignStyle } from "./sign";

/** The font every sign is lettered in: listed in the register with its licence (R-ASSET-012). */
export const SIGN_FONT = "Danfo";

function materialsOf(object: Object3D): Material[] {
  const mesh = object as Mesh;
  if (!mesh.isMesh) return [];
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** What a node's extras say about its round parts, looking up from a mesh to the model's root. */
export function smoothOf(object: Object3D): string[] | true | null {
  let at: Object3D | null = object;
  while (at !== null) {
    const smooth = (at.userData as { smooth?: unknown }).smooth;
    if (smooth === true) return true;
    if (Array.isArray(smooth) && smooth.length > 0) return smooth.filter((part): part is string => typeof part === "string");
    at = at.parent;
  }
  return null;
}

/**
 * Shades a loaded model, once, after loading and before the first frame. Every material is flat
 * shaded, except a mesh whose node names round parts: with a list of parts, its file carries
 * normals that draw those parts smooth and the rest flat, so its material is left smooth; with
 * `true`, the whole node is round, so its normals are computed here and its material left smooth.
 * A material a flat mesh also uses is copied for the smooth one.
 */
export function prepareModel(root: Object3D): void {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh);
  });
  const roundOf = (mesh: Mesh): boolean => {
    const smooth = smoothOf(mesh);
    if (smooth === true) return true;
    return smooth !== null && mesh.geometry.getAttribute("normal") !== undefined;
  };
  const usedFlat = new Set<Material>();
  for (const mesh of meshes) if (!roundOf(mesh)) for (const material of materialsOf(mesh)) usedFlat.add(material);
  const copies = new Map<Material, Material>();
  for (const mesh of meshes) {
    const round = roundOf(mesh);
    if (round && smoothOf(mesh) === true) mesh.geometry.computeVertexNormals();
    const shaded = materialsOf(mesh).map((material) => {
      const standard = material as MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) return material;
      if (!round) {
        if (!standard.flatShading) {
          standard.flatShading = true;
          standard.needsUpdate = true;
        }
        return material;
      }
      let smooth = usedFlat.has(material) ? copies.get(material) : standard;
      if (smooth === undefined) {
        smooth = standard.clone();
        copies.set(material, smooth);
      }
      const target = smooth as MeshStandardMaterial;
      if (target.flatShading) {
        target.flatShading = false;
        target.needsUpdate = true;
      }
      return target;
    });
    mesh.material = Array.isArray(mesh.material) ? shaded : (shaded[0] ?? mesh.material);
  }
}

/** The sign anchors a model carries in its extras, wherever the loader put them. */
export function findSignAnchors(root: Object3D): SignAnchor[] {
  let found: SignAnchor[] = [];
  root.traverse((object) => {
    const signs = (object.userData as { signs?: unknown }).signs;
    if (found.length === 0 && Array.isArray(signs)) found = signs as SignAnchor[];
  });
  return found;
}

/** Text for a key, or undefined. The client passes the content's text table; the stage passes its drafts. */
export type SignText = (key: string) => string | undefined;

/**
 * Draws one sign into its rectangle of a canvas: the board, a border, the lines of text shrunk to fit,
 * hand-painted letters with a little jitter and a round-jointed outline, and an optional glyph.
 */
export function drawSign(ctx: CanvasRenderingContext2D, rect: readonly [number, number, number, number], text: string, style: SignStyle, seed = 7): void {
  const [x0, y0, w, h] = rect;
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.fillStyle = paletteCss(style.board);
  ctx.fillRect(x0, y0, w, h);
  const edge = Math.max(2, Math.round(h * 0.05));
  if (style.border !== undefined) {
    ctx.strokeStyle = paletteCss(style.border);
    ctx.lineWidth = edge;
    ctx.strokeRect(x0 + edge, y0 + edge, w - 2 * edge, h - 2 * edge);
  }
  const glyphW = style.glyph === undefined ? 0 : Math.round(h * 0.7);
  if (style.glyph === "phone") {
    ctx.fillStyle = paletteCss(style.ink);
    ctx.fillRect(x0 + edge * 3, y0 + h * 0.18, glyphW * 0.55, h * 0.64);
    ctx.fillStyle = paletteCss(style.board);
    ctx.fillRect(x0 + edge * 3 + glyphW * 0.08, y0 + h * 0.26, glyphW * 0.39, h * 0.42);
  } else if (style.glyph === "tin") {
    // A tin of tomatoes: a red body, one white band, a dark elliptical lid. Not three stripes, which read as a flag.
    const tx = x0 + edge * 3;
    const tw = glyphW * 0.6;
    ctx.fillStyle = paletteCss("red");
    ctx.fillRect(tx, y0 + h * 0.24, tw, h * 0.56);
    ctx.fillStyle = paletteCss("white");
    ctx.fillRect(tx, y0 + h * 0.42, tw, h * 0.16);
    ctx.fillStyle = paletteCss("black");
    ctx.beginPath();
    ctx.ellipse(tx + tw / 2, y0 + h * 0.24, tw / 2, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const room = w - edge * 6 - glyphW;
  const rowH = (h - edge * 4) / Math.max(1, lines.length);
  let s = seed;
  const random = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  lines.forEach((line, row) => {
    let size = Math.floor(rowH * 0.92);
    const font = (px: number): string => `${String(px)}px ${SIGN_FONT}, sans-serif`;
    ctx.font = font(size);
    while (ctx.measureText(line).width > room && size > 8) {
      size -= 1;
      ctx.font = font(size);
    }
    const cy = y0 + edge * 2 + rowH * (row + 0.5);
    const total = ctx.measureText(line).width;
    let x = x0 + glyphW + edge * 3 + (room - total) / 2;
    if (style.painted === true) {
      for (const ch of line) {
        const cw = ctx.measureText(ch).width;
        ctx.save();
        ctx.translate(x + cw / 2, cy + (random() - 0.5) * size * 0.08);
        ctx.rotate((random() - 0.5) * 0.08);
        ctx.lineWidth = Math.max(2, size * 0.1);
        ctx.strokeStyle = paletteCss(style.outline ?? "black");
        ctx.strokeText(ch, -cw / 2, 0);
        ctx.fillStyle = paletteCss(style.ink);
        ctx.fillText(ch, -cw / 2, 0);
        ctx.restore();
        x += cw;
      }
    } else {
      ctx.fillStyle = paletteCss(style.ink);
      ctx.fillText(line, x, cy);
    }
  });
  ctx.restore();
}

/** One canvas holding every sign of a model, at the atlas size, each in its rectangle. */
export function drawSignAtlas(anchors: readonly SignAnchor[], text: SignText, doc: Document = document): HTMLCanvasElement {
  const canvas = doc.createElement("canvas");
  [canvas.width, canvas.height] = SIGN_ATLAS;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("drawSignAtlas: no 2D context");
  const none: [number, number, number, number] = [0, 0, 0, 0];
  const rects = anchors.some((anchor) => anchor.rect === undefined) ? packSigns(anchors) : anchors.map((anchor) => anchor.rect ?? none);
  anchors.forEach((anchor, i) => drawSign(ctx, rects[i] ?? none, text(anchor.key) ?? "", anchor.style, 7 + i));
  return canvas;
}

function signTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // glTF texture coordinates start at the top-left corner, so the canvas is not flipped.
  texture.flipY = false;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Draws a model's signs. A shopfront ships its sign faces in the file (a material named "sign"):
 * its texture is set. A building ships only anchors: one mesh of quads is added for all of them,
 * one more draw call for the place's shopfronts and signs (assets.md, budgets for one place).
 */
export function attachSigns(root: Object3D, text: SignText, doc: Document = document): Mesh | null {
  const anchors = findSignAnchors(root);
  if (anchors.length === 0) return null;
  const canvas = drawSignAtlas(anchors, text, doc);
  let shipped: Mesh | null = null;
  root.traverse((object) => {
    for (const material of materialsOf(object)) {
      if (material.name === "sign") {
        const standard = material as MeshStandardMaterial;
        standard.map = signTexture(canvas);
        standard.color.set(0xffffff);
        standard.needsUpdate = true;
        shipped = object as Mesh;
      }
    }
  });
  if (shipped !== null) return shipped;
  const rects = packSigns(anchors);
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  const [atlasW, atlasH] = SIGN_ATLAS;
  anchors.forEach((anchor, i) => {
    const [x, y, w, h] = rects[i] ?? [0, 0, 0, 0];
    const rx = Math.cos(anchor.ry);
    const rz = -Math.sin(anchor.ry);
    const [cx, cy, cz] = anchor.centre;
    const base = positions.length / 3;
    for (const [sx, sy, u, v] of [[-1, -1, x, y + h], [1, -1, x + w, y + h], [1, 1, x + w, y], [-1, 1, x, y]] as const) {
      positions.push(cx + rx * sx * (anchor.width / 2), cy + sy * (anchor.height / 2), cz + rz * sx * (anchor.width / 2));
      uvs.push(u / atlasW, v / atlasH);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ map: signTexture(canvas), roughness: 0.8, flatShading: true }));
  mesh.name = "signs";
  // The anchors are in the model's own frame: add the faces to the node that carries them.
  let holder: Object3D = root;
  root.traverse((object) => {
    if (Array.isArray((object.userData as { signs?: unknown }).signs)) holder = object;
  });
  holder.add(mesh);
  return mesh;
}
