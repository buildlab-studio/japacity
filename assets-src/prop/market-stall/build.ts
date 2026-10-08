// A lock-up stall of the market's rows (city.md place.tejuosho-market): four timber posts under a
// zinc lean-to falling to the back, a plank back wall with a shelf, a counter piled with folded
// cloth and shoes in pairs, a stool for the seller. The cloth awning in front of the roof edge is
// not in the model: it is a sheet on the place's wind (city.md R-CITY-026), placed by the stage.
import type { PaletteName } from "@japacity/assets";
import { box, floorQuad, quad, seeded } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ } from "../../veh/lab";

export const MARKET_STALL = { width: 2.6, depth: 2.0, front: 2.45, back: 2.1, counter: 0.85 } as const;

const CLOTH: PaletteName[] = ["indigo", "gold", "wine", "teal", "orange", "purple", "green", "red", "cream"];

export function buildMarketStall(): Group {
  const g = new Group();
  const random = seeded(2604);
  const { width: w, depth: d, front, back, counter } = MARKET_STALL;
  const hw = w / 2;
  const hd = d / 2;
  // Posts, the front pair taller so the roof falls to the back and rain runs off behind the seller.
  for (const x of [-hw + 0.05, hw - 0.05]) {
    box(g, 0.09, front, 0.09, x, 0, hd - 0.05, "darkWood");
    box(g, 0.09, back, 0.09, x, 0, -hd + 0.05, "darkWood");
  }
  // The roof: one zinc sheet on two rafters, overhanging front and back, rust where water stands.
  const roof = new Group();
  roof.position.set(0, (front + back) / 2 + 0.06, 0);
  roof.rotation.x = -Math.atan2(front - back, d);
  g.add(roof);
  cbox(roof, w + 0.3, 0.04, d + 0.5, 0, 0, 0, "zinc");
  for (const x of [-hw + 0.05, hw - 0.05]) cbox(roof, 0.08, 0.1, d + 0.3, x, -0.07, 0, "darkWood");
  for (let x = -hw + 0.1; x < hw + 0.1; x += 0.3) floorQuad(roof, 0.03, d + 0.5, x, 0.022, 0, "hub");
  floorQuad(roof, 0.9, 0.7, -0.5, 0.021, -0.35, "zincRust");
  floorQuad(roof, 0.5, 0.4, 0.7, 0.021, 0.5, "zincRust");
  // The back wall of planks, a shelf of folded cloth on it, and a calendar of colour pinned up.
  box(g, w - 0.1, back - 0.1, 0.05, 0, 0, -hd + 0.02, "wood");
  for (let i = 1; i < 6; i++) quad(g, 0.02, back - 0.1, -hw + (i * w) / 6, 0, -hd + 0.047, "darkWood");
  box(g, w - 0.3, 0.04, 0.3, 0, 1.45, -hd + 0.2, "darkWood");
  for (let i = 0; i < 6; i++) box(g, 0.34, 0.12 + random() * 0.14, 0.26, -hw + 0.4 + i * 0.36, 1.49, -hd + 0.2, CLOTH[Math.floor(random() * CLOTH.length)] ?? "gold");
  quad(g, 0.4, 0.55, hw - 0.5, 1.75, -hd + 0.05, "white");
  // The counter: a plank top on a skirt board, cloth folded in stacks, shoes in pairs at one end.
  box(g, w - 0.2, counter - 0.04, 0.06, 0, 0, hd - 0.3, "wood");
  box(g, w - 0.1, 0.05, 0.8, 0, counter - 0.05, hd - 0.6, "darkWood");
  quad(g, w - 0.4, 0.3, 0, 0.25, hd - 0.265, "wallCreamWorn");
  for (let stack = 0; stack < 4; stack++) {
    let y = counter;
    const x = -hw + 0.45 + stack * 0.42;
    for (let fold = 0; fold < 3 + Math.floor(random() * 3); fold++) {
      const h = 0.06 + random() * 0.04;
      box(g, 0.36, h, 0.32, x + (random() - 0.5) * 0.04, y, hd - 0.6 + (random() - 0.5) * 0.06, CLOTH[Math.floor(random() * CLOTH.length)] ?? "indigo");
      y += h;
    }
  }
  for (let pair = 0; pair < 3; pair++) {
    const colour: PaletteName = pair === 1 ? "black" : pair === 2 ? "tan" : "wine";
    for (const s of [-1, 1]) box(g, 0.1, 0.08, 0.26, hw - 0.62 + pair * 0.2 + s * 0.055, counter, hd - 0.55, colour);
  }
  // A bolt of cloth unrolled down the counter's front, and the seller's stool behind it.
  quad(g, 0.5, counter - 0.1, -0.2, 0.1, hd - 0.255, "teal");
  box(g, 0.34, 0.45, 0.34, 0.6, 0, -0.2, "red");
  // A sack of stock under the counter at the side, and the price board on the post (no figure on it).
  box(g, 0.45, 0.5, 0.4, -hw + 0.35, 0, -0.1, "tan");
  quad(g, 0.3, 0.22, hw - 0.05, 1.5, hd + 0.001, "black");
  return facePlusZ(g, "prop_market-stall", false);
}
