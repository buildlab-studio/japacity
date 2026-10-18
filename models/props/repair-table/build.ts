// A phone repairer's pitch on the street (city.md place.computer-village): a glass display case on
// a trestle table under a big umbrella, phones laid out on it, an opened handset and its parts on a
// mat, a laptop with its lid up, the soldering stand, an extension board with its cable, the
// repairer's stool and a bench for whoever is waiting.
import { boxesIn, type PaletteName, setFootprint } from "@japacity/assets";
import { box, cylinder, floorQuad, quad, seeded, solid, type Vec3 } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ } from "../../vehicles/centred";

export const REPAIR_TABLE = { width: 1.8, depth: 0.8, top: 0.82 } as const;

const CASES: PaletteName[] = ["black", "white", "blue", "red", "gold", "charcoal"];

export function buildRepairTable(): Group {
  const g = new Group();
  const random = seeded(808);
  const { width: w, depth: d, top } = REPAIR_TABLE;
  // The table: a top on two trestles, a cloth skirt on the customer's side.
  box(g, w, 0.05, d, 0, top - 0.05, 0, "wood");
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) {
    cbox(g, 0.06, top, 0.06, x, (top - 0.05) / 2, 0.3, "darkWood", 0.12);
    cbox(g, 0.06, top, 0.06, x, (top - 0.05) / 2, -0.3, "darkWood", -0.12);
  }
  quad(g, w - 0.1, top - 0.25, 0, 0.2, d / 2 + 0.003, "blue");
  // The glass case: a white frame round a dark glass top, phones inside and on top of it.
  box(g, 1.0, 0.26, 0.5, -0.3, top, 0.05, "white");
  floorQuad(g, 0.92, 0.42, -0.3, top + 0.262, 0.05, "glass");
  quad(g, 0.92, 0.18, -0.3, top + 0.04, 0.302, "glass");
  for (let i = 0; i < 5; i++) box(g, 0.08, 0.012, 0.16, -0.7 + i * 0.2, top + 0.262, 0.05, CASES[Math.floor(random() * CASES.length)] ?? "black");
  for (let i = 0; i < 4; i++) box(g, 0.08, 0.15, 0.012, -0.62 + i * 0.22, top + 0.05, 0.27, CASES[i % CASES.length] ?? "black");
  // The mat with an opened phone, its screen beside it, and the laptop with its lid up.
  floorQuad(g, 0.5, 0.36, 0.55, top + 0.003, 0.15, "green");
  box(g, 0.08, 0.012, 0.16, 0.45, top + 0.004, 0.15, "charcoal");
  box(g, 0.08, 0.006, 0.16, 0.58, top + 0.004, 0.12, "glass");
  box(g, 0.36, 0.02, 0.25, 0.55, top, -0.22, "charcoal");
  const lid = new Group();
  lid.position.set(0.55, top + 0.02, -0.345);
  lid.rotation.x = -0.25;
  g.add(lid);
  box(lid, 0.36, 0.24, 0.015, 0, 0, 0, "charcoal");
  quad(lid, 0.32, 0.2, 0, 0.02, 0.009, "glass");
  // The soldering stand, the extension board and its cable over the edge to the floor.
  cylinder(g, 0.05, 0.02, 0.82, top, 0.25, "black", 6);
  cbox(g, 0.015, 0.18, 0.015, 0.82, top + 0.1, 0.25, "hub", 0.5);
  box(g, 0.24, 0.035, 0.07, 0.15, top, -0.28, "white");
  const cable: Vec3[] = [[0.15, top + 0.01, -0.33], [0.2, top + 0.01, -0.42], [0.25, 0.0, -0.55], [0.32, 0.0, -1.1], [0.36, 0.01, -1.1]];
  for (let i = 0; i + 1 < cable.length; i++) {
    const from = cable[i] ?? [0, 0, 0];
    const to = cable[i + 1] ?? [0, 0, 0];
    solid(g, [from, to, [to[0] + 0.02, to[1] + 0.01, to[2]]], [[0, 1, 2], [0, 2, 1]], "black");
  }
  // The umbrella over it all: a pole and eight panels in two colours, its pole at the repairer's side.
  cylinder(g, 0.03, 2.3, -0.75, 0, -0.5, "hub", 6);
  const apex: Vec3 = [-0.4, 2.65, -0.15];
  const rim = (i: number): Vec3 => {
    const angle = (i / 8) * Math.PI * 2;
    return [-0.4 + Math.sin(angle) * 1.45, 2.2, -0.15 + Math.cos(angle) * 1.45];
  };
  for (let i = 0; i < 8; i++) solid(g, [apex, rim(i), rim(i + 1)], [[0, 1, 2], [0, 2, 1]], i % 2 === 0 ? "blue" : "white");
  // The repairer's stool behind, and the bench for the one waiting.
  box(g, 0.32, 0.5, 0.32, 0.3, 0, -0.75, "red");
  box(g, 1.2, 0.05, 0.3, 0.2, 0.42, 0.95, "wood");
  for (const s of [-1, 1]) box(g, 0.06, 0.42, 0.28, 0.2 + s * 0.5, 0, 0.95, "darkWood");
  const root = facePlusZ(g, "prop_repair-table", false);
  // The table and the umbrella's pole; the repairer's stool and the bench are seats, and the umbrella passes overhead.
  return setFootprint(root, boxesIn(root, g, [
    { x: 0, z: 0, width: w, depth: d },
    { x: -0.75, z: -0.5, width: 0.1, depth: 0.1 },
  ]));
}
