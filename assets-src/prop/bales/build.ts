// What a cloth trader brings to the market at dawn (city.md place.tejuosho-market): bales of cloth
// sewn into sacking and bound with rope, a chequered carrier bag of the kind every market uses,
// two sacks and a stack of crates, left in a heap at the end of a row.
import { box, quad, seeded, solid, type Vec3 } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

import { facePlusZ } from "../../veh/lab";

/** A bale: a box of sacking with two rope bands round it, the rope a little proud of the cloth. */
function bale(g: Object3D, w: number, h: number, d: number, x: number, y: number, z: number, cloth: "tan" | "cream" | "khaki"): void {
  box(g, w, h, d, x, y, z, cloth);
  for (const share of [-0.25, 0.25]) box(g, 0.05, h + 0.02, d + 0.02, x + share * w, y - 0.01, z, "darkWood");
  box(g, w + 0.02, 0.05, d + 0.02, x, y + h * 0.5, z, "darkWood");
}

/** The chequered carrier bag: a box with a grid of squares in two colours on its faces, and its handles. */
function carrier(g: Object3D, x: number, y: number, z: number): void {
  const w = 0.8;
  const h = 0.5;
  const d = 0.4;
  box(g, w, h, d, x, y, z, "white");
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 3; row++) {
      if ((col + row) % 2 === 0) continue;
      quad(g, w / 4, h / 3, x - w / 2 + (col + 0.5) * (w / 4), y + row * (h / 3), z + d / 2 + 0.004, col % 2 === 0 ? "red" : "blue");
    }
  }
  for (let col = 0; col < 4; col += 2) quad(g, w / 4, h / 3, x - w / 2 + (col + 0.5) * (w / 4), y + h / 3, z - d / 2 - 0.004, "blue", Math.PI);
  for (const s of [-1, 1]) box(g, 0.04, 0.12, 0.04, x + s * 0.15, y + h, z, "blue");
  box(g, 0.34, 0.04, 0.04, x, y + h + 0.1, z, "blue");
}

/** A sack of grain or garri, its top tied and slumped. */
function sack(g: Object3D, x: number, y: number, z: number, colour: "tan" | "white" | "khaki"): void {
  const corners: Vec3[] = [
    [x - 0.26, y, z - 0.2], [x + 0.26, y, z - 0.2], [x + 0.28, y, z + 0.2], [x - 0.28, y, z + 0.2],
    [x - 0.22, y + 0.6, z - 0.12], [x + 0.22, y + 0.6, z - 0.12], [x + 0.18, y + 0.68, z + 0.14], [x - 0.18, y + 0.68, z + 0.14],
  ];
  solid(g, corners, [[3, 2, 6, 7], [0, 3, 7, 4], [2, 1, 5, 6], [1, 0, 4, 5], [4, 7, 6, 5], [0, 1, 2, 3]], colour);
  box(g, 0.12, 0.1, 0.12, x, y + 0.66, z + 0.01, colour);
}

export function buildBales(): Group {
  const g = new Group();
  const random = seeded(1888);
  bale(g, 1.1, 0.7, 0.75, -0.7, 0, 0, "tan");
  bale(g, 1.0, 0.65, 0.7, -0.65, 0.7, -0.03, "cream");
  bale(g, 1.0, 0.6, 0.7, 0.5, 0, -0.15, "khaki");
  carrier(g, 0.45, 0.6, -0.1);
  sack(g, 1.35, 0, 0.1, "white");
  sack(g, 1.4, 0, -0.45, "tan");
  // A stack of crates leaning a little, and a loose roll of cloth on top of the heap.
  box(g, 0.5, 0.32, 0.36, -1.65, 0, 0.1, "blue", 0.1);
  box(g, 0.5, 0.32, 0.36, -1.63, 0.32, 0.12, "red", 0.05 + random() * 0.1);
  box(g, 0.75, 0.16, 0.18, -0.65, 1.35, 0.05, "wine");
  return facePlusZ(g, "prop_bales", false);
}
