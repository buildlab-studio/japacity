// What stands on Makoko's smoking deck (city.md place.makoko), where the women smoke and sell the catch: drums cut down into kilns
// with a fire door at the bottom and round wire trays of fish stacked on top; woven baskets of small fish, a basin and a cooler;
// the big black pot the fish are washed in, with its low stool; and the firewood stacked by the sacks of sawdust that make the
// smoke. Each faces +z with its lowest point at y = 0, on the deck it stands on.
import { type PaletteName, setFootprint } from "@japacity/model-kit";
import { beam, box, cylinder, floorQuad, quad, seeded } from "@japacity/model-kit/kit";
import { Group } from "three";

/** The kilns: how many, how far apart along x, a drum's radius and height, and the top of the stacked trays where the smoke rises. */
export const KILNS = { count: 3, apart: 0.85, radius: 0.29, height: 0.62, top: 0.62 + 3 * 0.09 + 0.06 } as const;

const SMOKED: PaletteName[] = ["darkWood", "tan", "wood", "darkWood", "gold"];

/** Three cut-down drums in a row, each a fire door low at the front with the embers in it, three round trays of fish on top. */
export function buildDrumKilns(): Group {
  const g = new Group();
  g.name = "prop_drum-kilns";
  const random = seeded(4501);
  const { count, apart, radius, height } = KILNS;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * apart;
    cylinder(g, radius, height, x, 0, 0, random() < 0.5 ? "black" : "charcoal", 8);
    // The fire door cut low in the front, the embers glowing in it, a stick pushed in.
    quad(g, 0.26, 0.2, x, 0.04, radius + 0.004, "black");
    quad(g, 0.2, 0.07, x, 0.06, radius + 0.008, "orange");
    beam(g, [x - 0.05, 0.08, radius - 0.05], [x + 0.25, 0.04, radius + 0.45], 0.05, "darkWood");
    // The round wire trays, a little wider than the drum, stacked a hand apart; the fish laid round the top one.
    for (let t = 0; t < 3; t++) cylinder(g, radius + 0.06, 0.025, x, height + t * 0.09, 0, t % 2 === 0 ? "hub" : "concrete", 8);
    const y = height + 2 * 0.09 + 0.025;
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * Math.PI * 2 + random() * 0.3;
      box(g, 0.08, 0.04, 0.24, x + Math.cos(a) * 0.17, y, Math.sin(a) * 0.17, SMOKED[Math.floor(random() * SMOKED.length)] ?? "darkWood", -a);
    }
  }
  const span = (count - 1) * apart + radius * 2 + 0.1;
  return setFootprint(g, [{ x: 0, z: 0, width: span, depth: radius * 2 + 0.1 }]);
}

/** Woven baskets of small fish, a black basin of the morning's catch, and a white cooler. */
export function buildFishBaskets(): Group {
  const g = new Group();
  g.name = "prop_fish-baskets";
  const random = seeded(4502);
  const baskets: [number, number, PaletteName, PaletteName][] = [
    [-0.55, 0.0, "tan", "darkWood"],
    [0.05, 0.1, "khaki", "tan"],
    [-0.25, 0.55, "tan", "hub"],
  ];
  for (const [x, z, weave, fish] of baskets) {
    cylinder(g, 0.24, 0.3, x, 0, z, weave, 8, 0.3);
    cylinder(g, 0.305, 0.03, x, 0.3, z, "wood", 8);
    for (let f = 0; f < 4; f++) box(g, 0.06, 0.04, 0.18, x + (random() - 0.5) * 0.3, 0.3, z + (random() - 0.5) * 0.3, fish, random() * Math.PI);
  }
  cylinder(g, 0.3, 0.16, 0.65, 0, -0.05, "black", 8, 0.38);
  floorQuad(g, 0.5, 0.5, 0.65, 0.14, -0.05, "hub");
  box(g, 0.5, 0.36, 0.34, 0.75, 0, 0.55, "white");
  box(g, 0.52, 0.05, 0.36, 0.75, 0.36, 0.55, "basin");
  return setFootprint(g, [{ x: 0.05, z: 0.2, width: 1.7, depth: 1.1 }]);
}

/** The big black pot the fish are washed in, water and fish in it, a low stool beside it and a basin for what is washed. */
export function buildWashPot(): Group {
  const g = new Group();
  g.name = "prop_wash-pot";
  cylinder(g, 0.34, 0.42, 0, 0, 0, "black", 10, 0.45);
  cylinder(g, 0.47, 0.04, 0, 0.42, 0, "charcoal", 10);
  floorQuad(g, 0.7, 0.7, 0, 0.38, 0, "lagoon");
  for (let f = 0; f < 3; f++) box(g, 0.07, 0.03, 0.22, -0.12 + f * 0.12, 0.39, (f - 1) * 0.08, "hub", f * 0.7);
  // The stool the washer sits on, and the basin beside her.
  box(g, 0.3, 0.05, 0.26, 0, 0.22, 0.62, "wood");
  for (const sx of [-0.11, 0.11]) for (const sz of [-0.09, 0.09]) box(g, 0.04, 0.22, 0.04, sx, 0, 0.62 + sz, "darkWood");
  cylinder(g, 0.26, 0.13, 0.62, 0, 0.3, "basin", 8, 0.31);
  return setFootprint(g, [{ x: 0.15, z: 0.05, width: 1.2, depth: 0.95 }]);
}

/** Cut branches stacked in a crib, and sacks of sawdust leaning on it, one open. */
export function buildFirewoodSacks(): Group {
  const g = new Group();
  g.name = "prop_firewood-sacks";
  const random = seeded(4503);
  for (let layer = 0; layer < 4; layer++) {
    const y = 0.06 + layer * 0.1;
    for (let i = 0; i < 3; i++) {
      const z = -0.25 + i * 0.25 + (random() - 0.5) * 0.06;
      beam(g, [-0.75, y, z], [0.55, y + (random() - 0.5) * 0.04, z + (random() - 0.5) * 0.1], 0.08 + random() * 0.03, (layer + i) % 3 === 0 ? "wood" : "darkWood");
    }
  }
  const sacks: [number, number, PaletteName][] = [
    [0.95, -0.2, "white"],
    [1.0, 0.3, "cream"],
    [1.5, 0.05, "white"],
  ];
  for (const [x, z, colour] of sacks) {
    const turn = (random() - 0.5) * 0.4;
    box(g, 0.48, 0.62, 0.36, x, 0, z, colour, turn);
    box(g, 0.49, 0.06, 0.37, x, 0.4, z, "khaki", turn);
  }
  // The open sack's sawdust spilling on the boards.
  floorQuad(g, 0.5, 0.35, 1.5, 0.035, 0.45, "tan");
  return setFootprint(g, [{ x: 0.35, z: 0.05, width: 2.4, depth: 0.95 }]);
}
