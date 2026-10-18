// The pub on the corner of Rye Lane (docs/design/10-london-on-the-lagos-mold.md section 4): a two-storey
// Victorian corner house, its ground floor faced in dark tiles with tall many-paned windows, a door cut across
// the corner, lanterns either side, a plain fascia with no words and a hanging board painted with a pint, never
// a real house's name or sign (assets:no-real-brands-on-assets). Brick above with sash windows under a cornice and parapet, chimneys,
// a dish facing the place's satellite (assets:dishes-face-one-satellite) and soot where the rain runs (assets:buildings-carry-wear-and-clutter). The corner is
// at its +x end, so its side shows windows too.
import { setFootprint } from "@japacity/model-kit";
import { box, cylinder, dish, onWall, quad, solid, stain } from "@japacity/model-kit/kit";
import { Group, type Object3D } from "three";

export const PUB = { width: 6.0, depth: 9.0, ground: 4.0, upper: 3.0, parapet: 0.8 } as const;

/** A tall pub window of small panes in its frame, on a wall frame. */
function pubWindow(w: Object3D, x: number, width: number): void {
  quad(w, width, 2.5, x, 0.55, 0.02, "darkWood");
  quad(w, width - 0.2, 2.2, x, 0.7, 0.026, "glass");
  for (let k = 1; k < 4; k += 1) quad(w, 0.04, 2.2, x - (width - 0.2) / 2 + (k * (width - 0.2)) / 4, 0.7, 0.03, "darkWood");
  quad(w, width - 0.2, 0.05, x, 2.15, 0.03, "darkWood");
  quad(w, width - 0.2, 0.5, x, 2.2, 0.028, "cream");
}

/** The brick floor above: sash windows under lintels. */
function sashes(w: Object3D, xs: readonly number[], y: number): void {
  for (const x of xs) {
    quad(w, 1.1, 1.8, x, y, 0.004, "white");
    quad(w, 0.95, 0.8, x, y + 0.08, 0.008, "glass");
    quad(w, 0.95, 0.8, x, y + 0.92, 0.008, "glass");
    quad(w, 1.3, 0.16, x, y + 1.8, 0.006, "concrete");
  }
}

export function buildCornerPub(dishYaw: number): Group {
  const g = new Group();
  g.name = "bld_corner-pub";
  const { width: w, depth: d, ground, upper, parapet } = PUB;
  const top = ground + upper;
  const cut = 1.4;
  const hw = w / 2;
  const hd = d / 2;
  // The body, its front-right corner cut across for the door.
  const c: [number, number, number][] = [
    [-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd - cut], [hw - cut, 0, hd], [-hw, 0, hd],
    [-hw, top, -hd], [hw, top, -hd], [hw, top, hd - cut], [hw - cut, top, hd], [-hw, top, hd],
  ];
  solid(g, c, [[1, 2, 3, 4, 0], [9, 8, 7, 6, 5], [5, 6, 1, 0], [6, 7, 2, 1], [7, 8, 3, 2], [8, 9, 4, 3], [9, 5, 0, 4]], "roofRed");
  box(g, w - 0.2, parapet, 0.3, -0.1, top, hd - 0.15, "roofRed");
  box(g, 0.3, parapet, d - 0.2, hw - 0.15, top, -0.1, "roofRed");
  box(g, w, 0.25, d, 0, top - 0.1, 0, "concrete");
  box(g, w + 0.04, 0.08, d + 0.04, 0, top + parapet - 0.08, 0, "concrete");

  const front = onWall(g, -cut / 2, 0, hd + 0.005);
  const side = onWall(g, hw + 0.005, 0, -cut / 2, Math.PI / 2);
  const corner = onWall(g, hw - cut / 2 + 0.004, 0, hd - cut / 2 + 0.004, Math.PI / 4);
  for (const [face, length] of [[front, w - cut], [side, d - cut]] as const) {
    // The tiled ground floor: dark green tiles to the fascia, a black plinth.
    quad(face, length, ground - 0.2, 0, 0, 0.004, "roofGreen");
    quad(face, length, 0.45, 0, 0, 0.008, "black");
    // The fascia over the windows, a plain dark board with a gold edge.
    quad(face, length, 0.7, 0, ground - 0.9, 0.012, "black");
    quad(face, length, 0.05, 0, ground - 0.2, 0.016, "gold");
    quad(face, length, 0.05, 0, ground - 0.9, 0.016, "gold");
  }
  pubWindow(front, -1.6, 2.2);
  pubWindow(front, 0.95, 1.9);
  pubWindow(side, -2.3, 2.2);
  pubWindow(side, 0.6, 2.2);
  sashes(front, [-1.6, 0.95], ground + 0.6);
  sashes(side, [-2.3, -0.3, 1.6], ground + 0.6);
  // The corner door: double doors with their glass and fanlight, a lantern either side.
  quad(corner, cut * 1.3, ground - 0.2, 0, 0, 0.004, "roofGreen");
  quad(corner, 1.3, 2.3, 0, 0, 0.01, "darkWood");
  quad(corner, 0.5, 1.2, -0.3, 0.9, 0.014, "glass");
  quad(corner, 0.5, 1.2, 0.3, 0.9, 0.014, "glass");
  quad(corner, 1.3, 0.5, 0, 2.4, 0.012, "glass");
  quad(corner, cut * 1.3, 0.7, 0, ground - 0.9, 0.012, "black");
  for (const s of [-1, 1]) {
    box(corner, 0.08, 0.08, 0.3, s * 0.9, 2.7, 0.15, "black");
    box(corner, 0.22, 0.34, 0.22, s * 0.9, 2.45, 0.3, "gold");
  }
  // The hanging board on its bracket over the corner, painted with a pint and no words.
  const bracket = onWall(g, hw - cut / 2, 0, hd - cut / 2, Math.PI / 4);
  box(bracket, 0.06, 0.06, 1.2, 0, ground + 0.4, 0.6, "black");
  box(bracket, 0.9, 1.0, 0.06, 0, ground - 0.62, 0.9, "black");
  quad(bracket, 0.8, 0.9, 0, ground - 0.57, 0.932, "darkWood");
  quad(bracket, 0.3, 0.5, 0, ground - 0.45, 0.936, "gold");
  quad(bracket, 0.3, 0.12, 0, ground - 0.02, 0.938, "cream");
  // Chimneys, soot, a soil pipe, the dish on the back.
  for (const x of [-hw + 0.6, hw - 1.4]) {
    box(g, 0.9, 1.3, 0.6, x, top + parapet - 0.2, -hd + 1.0, "roofRed");
    for (const dx of [-0.22, 0.22]) cylinder(g, 0.08, 0.3, x + dx, top + parapet + 1.1, -hd + 1.0, "laterite", 6);
  }
  stain(front, 0, top - 0.6, w - cut, 0.5, "darkWood");
  stain(side, 0, top - 0.6, d - cut, 0.5, "darkWood");
  stain(front, -2.6, ground, 0.3, 1.4, "darkWood");
  quad(side, 0.1, upper, -(d - cut) / 2 + 0.2, ground, 0.03, "black");
  const back = onWall(g, 0, 0, -hd - 0.005, Math.PI);
  quad(back, 1.0, 1.3, 1.5, 1.2, 0.002, "glass");
  quad(back, 1.0, 1.3, -1.5, 4.8, 0.002, "glass");
  dish(g, back, 0, top - 1.2, 0.3, dishYaw - Math.PI);
  return setFootprint(g, [
    { x: -cut / 2, z: 0, width: w - cut, depth: d },
    { x: hw - cut / 2, z: -cut / 2, width: cut, depth: d - cut },
  ]);
}
