// Small parts the props and the places draw with: a part's own frame, four legs under a top and a screen on its foot.
import type { PaletteName } from "@japacity/assets";
import { box, quad } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

/** A group at (x, y, z) turned ry, to draw a part in its own frame. */
export function at(g: Object3D, x: number, z: number, ry = 0, y = 0): Group {
  const frame = new Group();
  frame.position.set(x, y, z);
  frame.rotation.y = ry;
  g.add(frame);
  return frame;
}

/** Four square legs under a top of w by d at height h. */
export function legs(g: Object3D, w: number, d: number, h: number, colour: PaletteName, thick = 0.05): void {
  const ix = w / 2 - thick;
  const iz = d / 2 - thick;
  for (const [x, z] of [[-ix, -iz], [ix, -iz], [-ix, iz], [ix, iz]] as const) box(g, thick, h, thick, x, 0, z, colour);
}

/** A flat screen on its foot, facing +Z. */
export function monitor(g: Object3D, x: number, y: number, z: number, ry = 0): void {
  const f = at(g, x, z, ry, y);
  box(f, 0.18, 0.02, 0.14, 0, 0, 0, "black");
  box(f, 0.04, 0.16, 0.04, 0, 0.02, -0.02, "black");
  box(f, 0.54, 0.34, 0.04, 0, 0.14, -0.02, "black");
  quad(f, 0.5, 0.3, 0, 0.16, 0.001, "glass");
}
