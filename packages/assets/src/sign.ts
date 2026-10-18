// Signs as data (assets:sign-text-drawn-in-code). A builder never bakes letters into a mesh: it leaves a
// board in the body and an anchor that names a text key, and the client draws the text
// at run time onto one canvas, so the spelling is exactly the text table's.
import type { Object3D } from "three";

import type { PaletteName } from "./palette";
import type { Vec3 } from "./kit/shapes";

export interface SignStyle {
  board: PaletteName;
  ink: PaletteName;
  border?: PaletteName;
  /** Hand painted: uneven letters with a dark outline. Printed when absent. */
  painted?: boolean;
  outline?: PaletteName;
  glyph?: "phone" | "tin";
}

/** Where a sign's face is, in the model's metres, and what it shows. */
export interface SignAnchor {
  key: string;
  /** The centre of the face. */
  centre: Vec3;
  width: number;
  height: number;
  /** The face looks along +z turned by ry about y. */
  ry: number;
  style: SignStyle;
  /** The face's pixels in the sign atlas, [x, y, w, h], set by the export for a piece that ships its sign face. */
  rect?: [number, number, number, number];
}

/** The largest sign canvas (assets:sign-text-drawn-in-code): 512 by 128 pixels, a power of two on each side. */
export const SIGN_ATLAS: readonly [number, number] = [512, 128];

/** Capital letters on a signboard are at least this tall, in metres (the kit's signboard rule). */
export const SIGN_MIN_LETTER = 0.2;

/** Records a sign's face on the builder's root, for the export and the stage to find. */
export function addSignAnchor(root: Object3D, anchor: SignAnchor): void {
  const signs = (root.userData.signs ?? []) as SignAnchor[];
  signs.push(anchor);
  root.userData.signs = signs;
}

export function signAnchorsOf(root: Object3D): SignAnchor[] {
  return (root.userData.signs ?? []) as SignAnchor[];
}

/**
 * Packs every face into one atlas at one scale, as large as fits: shelves of faces
 * side by side, tallest first. Every face keeps its shape, so letters are not stretched.
 */
export function packSigns(
  faces: readonly { width: number; height: number }[],
  atlas: readonly [number, number] = SIGN_ATLAS,
): [number, number, number, number][] {
  const [atlasW, atlasH] = atlas;
  const order = faces.map((_, i) => i).sort((a, b) => (faces[b]?.height ?? 0) - (faces[a]?.height ?? 0));
  const tryScale = (pxPerMetre: number): [number, number, number, number][] | null => {
    const rects: [number, number, number, number][] = faces.map(() => [0, 0, 0, 0]);
    let x = 0;
    let y = 0;
    let shelf = 0;
    for (const i of order) {
      const face = faces[i];
      if (face === undefined) continue;
      const w = Math.floor(face.width * pxPerMetre);
      const h = Math.floor(face.height * pxPerMetre);
      if (w > atlasW) return null;
      if (x + w > atlasW) {
        x = 0;
        y += shelf;
        shelf = 0;
      }
      if (y + h > atlasH) return null;
      rects[i] = [x, y, w, h];
      x += w;
      shelf = Math.max(shelf, h);
    }
    return rects;
  };
  let low = 1;
  let high = 4096;
  let best = tryScale(low);
  if (best === null) throw new Error("packSigns: the faces do not fit the atlas even at 1 pixel a metre");
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    const rects = tryScale(mid);
    if (rects === null) high = mid;
    else {
      low = mid;
      best = rects;
    }
  }
  return best;
}
