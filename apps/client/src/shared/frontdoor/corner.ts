// The tailor's corner behind "Who are you?" (prologue.md R-PROLOGUE-016): its one fixed camera and the bolts' prints.
// Plain numbers and plain three.js objects, so the framing and the cost are tested without a canvas.
import { paletteCss } from "@japacity/assets";
import { type BoltFabric, boltFaces, TAILOR, type TailorSpec } from "@japacity/assets-src/bld/tailor/tailor";
import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry, type Texture } from "three";

/** The corner's folder under places/. */
export const CORNER = "tailor-corner";

/** The most draw calls the corner may cost, its prints included. */
export const CORNER_DRAW_CALLS = 8;

/** The camera stands at about the figure's middle, as the turntable's does, so the corner is seen from the front at the figure's height. */
export const EYE = 1.3;
/** Where the eye's line falls on the screen, a share of its height from the top: the middle of the space above the sheet. */
export const EYE_AT = 0.3;
/** The metres of back wall the screen's height spans, so a phone held upright shows about four of the corner's six metres across. */
export const WALL_SPAN = 9.4;
/** How far in front of the back wall the camera stands. */
export const BACK = 12;

export interface CornerCamera {
  /** The field of view, top to bottom of the full frame, in degrees. */
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
  /** The full frame the screen is cut from, so the eye's line falls at `EYE_AT` with no tilt: a shifted lens, not a turned camera. */
  fullHeight: number;
  offsetY: number;
}

/**
 * The corner's one fixed camera for a canvas `height` pixels high: square to the back wall at the figure's height,
 * the wall's verticals upright, the eye's line `EYE_AT` down the screen and `WALL_SPAN` metres of wall top to bottom.
 * The width follows the screen's shape, so a wide screen sees more of the nook and the same wall as high.
 */
export function cornerCamera(height: number, spec: TailorSpec = TAILOR): CornerCamera {
  const high = Math.max(1, height);
  const eye = EYE_AT * high;
  // A frame whose middle is the eye's line, twice the larger of the parts above and below it.
  const fullHeight = 2 * Math.max(eye, high - eye);
  const offsetY = fullHeight / 2 - eye;
  const metres = (WALL_SPAN * fullHeight) / high;
  const fov = (2 * Math.atan(metres / 2 / BACK) * 180) / Math.PI;
  const back = -spec.room.size[1] / 2;
  return { fov, position: [0, EYE, back + BACK], target: [0, EYE, back], fullHeight, offsetY };
}

/** The size of one repeat of a print on a bolt, in metres, about as it reads on the figure. */
export const PRINT_TILE = 0.24;

/**
 * The bolts' prints (R-PROLOGUE-016): a face for each bolt's folded front and its top, one material a fabric, its map
 * the print `printOf` draws for that fabric with the figure's own pattern code. Three draw calls.
 */
export function boltPrints(printOf: (fabric: BoltFabric) => Texture, spec: TailorSpec = TAILOR): Group {
  const group = new Group();
  group.name = "bolt-prints";
  const materials = new Map<BoltFabric, MeshStandardMaterial>();
  const byFabric = new Map<BoltFabric, PlaneGeometry[]>();
  for (const face of boltFaces(spec)) {
    const plane = new PlaneGeometry(face.width, face.high);
    // Each face repeats its print at the cloth's own scale.
    const uv = plane.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, (uv.getX(i) * face.width) / PRINT_TILE, (uv.getY(i) * face.high) / PRINT_TILE);
    if (face.facing === "top") plane.rotateX(-Math.PI / 2);
    plane.translate(...face.centre);
    byFabric.set(face.fabric, [...(byFabric.get(face.fabric) ?? []), plane]);
  }
  for (const [fabric, planes] of byFabric) {
    let material = materials.get(fabric);
    if (material === undefined) {
      material = new MeshStandardMaterial({ map: printOf(fabric), color: new Color(paletteCss("white")), flatShading: true });
      material.name = `print-${fabric}`;
      materials.set(fabric, material);
    }
    const mesh = new Mesh(mergePlanes(planes), material);
    mesh.name = `bolt-${fabric}`;
    group.add(mesh);
  }
  return group;
}

/** The planes of one fabric as one geometry: positions, normals and UVs end to end, indexed. */
function mergePlanes(planes: readonly PlaneGeometry[]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (const plane of planes) {
    const base = positions.length / 3;
    positions.push(...plane.getAttribute("position").array);
    normals.push(...plane.getAttribute("normal").array);
    uvs.push(...plane.getAttribute("uv").array);
    for (const at of plane.getIndex()?.array ?? []) index.push(base + at);
    plane.dispose();
  }
  const merged = new BufferGeometry();
  merged.setIndex(index);
  merged.setAttribute("position", new Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  merged.computeBoundingSphere();
  return merged;
}
