// The suya spot on the pavement (streets.md R-STREET-011): a long low grill box on four legs with
// its coals glowing in a strip, skewers of beef laid across, a tall umbrella over it with a bulb hung
// from the pole, a cooler of drinks beside it and old newspaper for the wrap. Built facing +Z
// (R-ASSET-003), the side the customer stands; the seller works from behind.
import { setFootprint } from "@japacity/assets";
import { beam, box, clutter, cylinder } from "@japacity/assets/kit";
import { Group } from "three";

export const SUYA_GRILL = { width: 1.4, depth: 0.5, top: 0.86, pole: 2.35, canopy: 1.25 } as const;

export function buildSuyaGrill(): Group {
  const g = new Group();
  g.name = "prop_suya-grill";
  const { width: w, depth: d, top, pole, canopy } = SUYA_GRILL;
  // The grill sits right of the middle, so the cooler on its left and the canopy over it centre the whole on the origin.
  const x0 = 0.25;
  // Four angle-iron legs and a shelf between them for the charcoal sack.
  for (const [lx, lz] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]] as const) {
    box(g, 0.05, top - 0.22, 0.05, x0 + lx, 0, lz, "black");
  }
  box(g, w - 0.1, 0.03, d - 0.1, x0, 0.22, 0, "concreteWorn");
  box(g, 0.5, 0.22, 0.3, x0 - 0.2, 0.25, 0, "khaki");
  // The firebox, its coals glowing in a strip, the rim standing proud of the coals.
  box(g, w, 0.2, d, x0, top - 0.22, 0, "black");
  box(g, w - 0.1, 0.03, d - 0.12, x0, top - 0.02, 0, "orange");
  for (const z of [-d / 2 + 0.02, d / 2 - 0.02]) box(g, w, 0.06, 0.04, x0, top - 0.02, z, "charcoal");
  // Skewers of beef across the coals, pepper dark on the meat; a few pale sticks waiting at the end.
  for (let i = 0; i < 6; i++) {
    const sx = x0 - w / 2 + 0.18 + i * 0.17;
    box(g, 0.02, 0.015, d + 0.08, sx, top + 0.04, 0, "tan");
    box(g, 0.05, 0.04, d - 0.18, sx, top + 0.045, 0, i % 2 === 0 ? "seat" : "darkWood");
  }
  // The tray of sliced onion and tomato, and the newspaper for the wrap, on the grill's right end.
  box(g, 0.3, 0.04, 0.26, x0 + w / 2 - 0.2, top + 0.04, 0, "white");
  box(g, 0.12, 0.03, 0.1, x0 + w / 2 - 0.24, top + 0.08, -0.04, "tomato");
  box(g, 0.24, 0.05, 0.3, x0 + w / 2 + 0.17, 0.62, -0.05, "cream");
  box(g, 0.22, 0.6, 0.04, x0 + w / 2 + 0.17, 0, -0.18, "black");
  // The umbrella: its pole at the grill's back corner, the canopy in red and white panels, a bulb hung from the pole.
  const px = x0 - w / 2 + 0.12;
  const pz = -d / 2 - 0.08;
  cylinder(g, 0.025, pole + 0.2, px, 0, pz, "hub", 6);
  cylinder(g, 0.2, 0.05, px, 0, pz, "concrete", 6);
  cylinder(g, canopy, 0.42, px + 0.35, pole, pz + 0.3, "red", 8, 0.04);
  cylinder(g, canopy + 0.02, 0.12, px + 0.35, pole - 0.1, pz + 0.3, "white", 8, canopy, true);
  beam(g, [px, pole - 0.05, pz], [px + 0.35, pole - 0.05, pz + 0.3], 0.03, "hub");
  beam(g, [px + 0.4, pole + 0.1, pz + 0.3], [px + 0.4, 1.95, pz + 0.3], 0.012, "black");
  box(g, 0.08, 0.12, 0.08, px + 0.4, 1.83, pz + 0.3, "cream");
  // The cooler of cold drinks on the grill's left, and the seller's stool behind.
  clutter(g, "cooler", x0 - w / 2 - 0.42, 0, 0.02);
  box(g, 0.32, 0.4, 0.32, x0 + 0.2, 0, -d / 2 - 0.42, "wood");
  // The grill on its legs, the board for the wrap and the cooler; the umbrella passes overhead and the stool is a seat.
  return setFootprint(g, [
    { x: x0 + 0.08, z: 0, width: w + 0.6, depth: d + 0.04 },
    { x: x0 - w / 2 - 0.42, z: 0.02, width: 0.62, depth: 0.44 },
  ]);
}
