// The design's market stall (models.js): a table, an umbrella, a basin of tomatoes, peppers, yams and a crate.
import { lowBox, setFootprint } from "@japacity/assets";
import { seeded, solid, type Vec3 } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, ccyl, facePlusZ, lump } from "../veh/lab";

export function buildStall(): Group {
  const g = new Group();
  cbox(g, 1.6, 0.06, 0.9, 0, 0.8, 0, "wood");
  for (const x of [-0.72, 0.72]) for (const z of [-0.38, 0.38]) cbox(g, 0.07, 0.8, 0.07, x, 0.4, z, "darkWood");
  ccyl(g, 0.03, 2.4, 0, 1.2, -0.55, "darkWood", "y", 6);
  // The umbrella: eight panels, red and cream in turn, seen from above and from below.
  const apex: Vec3 = [0, 2.675, -0.55];
  const rim = (i: number): Vec3 => {
    const a = (i / 8) * Math.PI * 2;
    return [Math.sin(a) * 1.35, 2.225, -0.55 + Math.cos(a) * 1.35];
  };
  for (let i = 0; i < 8; i++) solid(g, [apex, rim(i), rim(i + 1)], [[0, 1, 2], [0, 2, 1]], i % 2 !== 0 ? "red" : "cream");
  // The produce: a basin of tomatoes, a heap of peppers, yam tubers, a crate.
  ccyl(g, 0.26, 0.12, -0.45, 0.89, 0.05, "basin", "y", 10);
  const random = seeded(7);
  for (let i = 0; i < 14; i++) {
    const r = random() * 0.2;
    const an = random() * 6.28;
    lump(g, 0.065, -0.45 + Math.cos(an) * r, 0.97 + random() * 0.08, 0.05 + Math.sin(an) * r, "tomato");
  }
  for (let i = 0; i < 10; i++) lump(g, 0.05, 0.12 + random() * 0.3, 0.87 + random() * 0.05, -0.15 + random() * 0.3, i % 3 !== 0 ? "pepper" : "tomato", [1, 1.5, 1]);
  for (let i = 0; i < 4; i++) cbox(g, 0.42, 0.11, 0.12, 0.5, 0.89 + (i > 1 ? 0.11 : 0), 0.18 + (i % 2) * 0.14 - (i > 1 ? 0.07 : 0), "darkWood");
  cbox(g, 0.5, 0.3, 0.36, -1.15, 0.15, 0.2, "wood");
  cbox(g, 0.44, 0.06, 0.3, -1.15, 0.31, 0.2, "pepper");
  // The design drew the stall facing +z already: the umbrella's pole stands at the seller's back.
  const root = facePlusZ(g, "prop_stall", false);
  return setFootprint(root, [lowBox(root)]);
}
