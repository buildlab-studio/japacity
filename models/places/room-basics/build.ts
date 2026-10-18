// The basics a room holds (world:room-seen-down-its-length): the cooking corner, the water drum with
// the water that rises in it once fetched, the bag by the door and the lantern on the table. Each
// stands on its base at y = 0 and faces +Z (assets:metre-units-and-origin); every face that looks up stands well over
// the floor, so none shares a height with the ground (world:faces-never-share-height). The state is drawn, not counted:
// the pot's steam is the room's smoke motion, the fetched water a model of its own over the drum.
import { setFootprint } from "@japacity/assets";
import { beam, box, cylinder, quad } from "@japacity/assets/kit";
import { Group } from "three";

import { at } from "../../props/parts";

/** Where the pot sits in the cooking corner's frame, for the steam over it. */
export const POT_AT: [number, number, number] = [-0.2, 0.82, 0.02];

/**
 * The cooking corner: a low wooden table with a two-ring gas cooker on it, the pot on the left ring
 * with its lid on, a pan on the right, the green gas bottle on the floor beside the table and an
 * enamel basin under it. About 1.4 m across.
 */
export function buildCookingCorner(): Group {
  const g = new Group();
  g.name = "prop_cooking-corner";
  const w = 1.0;
  const d = 0.55;
  const h = 0.6;
  // The table, its top and four legs.
  box(g, w, 0.05, d, 0, h - 0.05, 0, "wood");
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, 0.05, h - 0.05, 0.05, x * (w / 2 - 0.04), 0, z * (d / 2 - 0.04), "darkWood");
  box(g, w - 0.1, 0.03, d - 0.1, 0, 0.18, 0, "darkWood");
  // The cooker: its tray, two black rings and the knobs at the front.
  box(g, 0.66, 0.08, 0.4, 0, h, 0, "zinc");
  for (const x of [-0.2, 0.2]) cylinder(g, 0.1, 0.012, x, h + 0.08, 0.02, "black", 10);
  for (const x of [-0.08, 0.08]) box(g, 0.04, 0.04, 0.02, x, h + 0.02, 0.21, "black");
  // The pot on the left ring, its lid and handle.
  cylinder(g, 0.15, 0.2, POT_AT[0], h + 0.092, POT_AT[2], "charcoal", 12, 0.16);
  cylinder(g, 0.165, 0.025, POT_AT[0], h + 0.292, POT_AT[2], "hub", 12);
  box(g, 0.08, 0.03, 0.03, POT_AT[0], h + 0.317, POT_AT[2], "black");
  // A pan on the right ring, its handle out to the side.
  cylinder(g, 0.13, 0.05, 0.2, h + 0.092, 0.02, "black", 10);
  beam(g, [0.33, h + 0.13, 0.02], [0.52, h + 0.15, 0.02], 0.025, "black");
  // The gas bottle on the floor at the table's end, its hose up to the cooker.
  cylinder(g, 0.14, 0.42, 0.68, 0, 0.05, "green", 10);
  cylinder(g, 0.05, 0.06, 0.68, 0.42, 0.05, "zinc", 6);
  beam(g, [0.68, 0.48, 0.05], [0.33, h + 0.04, 0.0], 0.015, "black");
  // An enamel basin of yams under the table.
  cylinder(g, 0.18, 0.14, -0.2, 0.0, 0.0, "basin", 10, 0.24);
  for (const [x, z] of [[-0.26, -0.03], [-0.14, 0.04], [-0.2, -0.08]] as const) box(g, 0.16, 0.06, 0.07, x, 0.14, z, "tan", 0.4);
  return setFootprint(g, [
    { x: 0, z: 0, width: w, depth: d },
    { x: 0.68, z: 0.05, width: 0.3, depth: 0.3 },
  ]);
}

/** The drum's height and the radius of the water in it. */
const DRUM_H = 0.9;
const WATER_R = 0.27;

/**
 * The blue water drum and the red bucket at its foot. From above the
 * inside reads dark: the water is low until it is fetched (buildDrumWater).
 */
export function buildWaterDrum(): Group {
  const g = new Group();
  g.name = "prop_water-drum";
  cylinder(g, 0.3, DRUM_H, 0, 0, 0, "blue", 14);
  // Two ribs round the drum and its dark inside, a little over the top.
  for (const y of [0.28, 0.6]) cylinder(g, 0.305, 0.03, 0, y, 0, "indigo", 14);
  cylinder(g, WATER_R, 0.02, 0, DRUM_H + 0.02, 0, "drain", 14);
  // The bucket and the cup in it.
  cylinder(g, 0.11, 0.26, 0.45, 0, 0.12, "red", 10, 0.14);
  cylinder(g, 0.04, 0.06, 0.45, 0.26, 0.12, "white", 8);
  return setFootprint(g, [
    { x: 0, z: 0, width: 0.6, depth: 0.6 },
    { x: 0.45, z: 0.12, width: 0.3, depth: 0.3 },
  ]);
}

/**
 * The water fetched (obligation:cooking-and-fetching-water): the drum filled to the brim, seen over its dark inside, and the
 * two yellow jerrycans it came in, set down beside it. Placed on the drum's own spot.
 */
export function buildDrumWater(): Group {
  const g = new Group();
  g.name = "prop_drum-water";
  cylinder(g, WATER_R, 0.02, 0, DRUM_H + 0.06, 0, "lagoon", 14);
  for (const [x, z, turn] of [[-0.48, 0.18, 0.3], [-0.42, -0.26, -0.2]] as const) {
    const can = at(g, x, z, turn);
    box(can, 0.26, 0.4, 0.16, 0, 0, 0, "danfoYellow");
    box(can, 0.06, 0.06, 0.06, 0.07, 0.4, 0, "danfoYellow");
    beam(can, [-0.08, 0.4, 0], [0.0, 0.46, 0], 0.03, "danfoYellow");
  }
  return setFootprint(g, [
    { x: -0.48, z: 0.18, width: 0.3, depth: 0.3 },
    { x: -0.42, z: -0.26, width: 0.3, depth: 0.3 },
  ]);
}

/**
 * The bag by the door: a Ghana-must-go bag in red, blue and white checks, zipped, with its handles
 * up, packed for the day the route is granted.
 */
export function buildTravelBag(): Group {
  const g = new Group();
  g.name = "prop_travel-bag";
  const w = 0.9;
  const h = 0.5;
  const d = 0.45;
  box(g, w, h, d, 0, 0, 0, "white");
  // The checks: bands of red and blue across the front, the back, the ends and the top.
  for (const [x, colour] of [[-0.3, "red"], [0.0, "blue"], [0.3, "red"]] as const) {
    quad(g, 0.14, h, x, 0, d / 2 + 0.006, colour);
    quad(g, 0.14, h, x, 0, -d / 2 - 0.006, colour, Math.PI);
    box(g, 0.14, 0.006, d, x, h, 0, colour);
  }
  for (const side of [-1, 1]) quad(g, d, 0.12, side * (w / 2 + 0.006), 0.2, 0, "blue", (side * Math.PI) / 2);
  // The zip along the top and the two handles over it.
  box(g, w - 0.06, 0.012, 0.03, 0, h + 0.006, 0, "black");
  for (const z of [-0.1, 0.1]) beam(g, [-0.22, h + 0.02, z], [0.22, h + 0.02, z], 0.03, "black");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/**
 * A hurricane lantern for the nights NEPA takes the light, on a low stool beside the table: its tin base
 * and cap, the glass glowing amber, the wire handle.
 */
export function buildLantern(): Group {
  const g = new Group();
  g.name = "prop_lantern";
  const seat = 0.45;
  box(g, 0.4, 0.04, 0.4, 0, seat - 0.04, 0, "wood");
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, 0.04, seat - 0.04, 0.04, x * 0.16, 0, z * 0.16, "darkWood");
  const lamp = at(g, 0, 0, 0, seat);
  cylinder(lamp, 0.09, 0.06, 0, 0, 0, "red", 10);
  cylinder(lamp, 0.06, 0.16, 0, 0.06, 0, "orange", 10, 0.05);
  cylinder(lamp, 0.07, 0.04, 0, 0.22, 0, "red", 10, 0.04);
  for (const side of [-1, 1]) beam(lamp, [side * 0.07, 0.04, 0], [side * 0.07, 0.24, 0], 0.012, "black");
  beam(lamp, [-0.07, 0.3, 0], [0.07, 0.3, 0], 0.012, "black");
  return setFootprint(g, [{ x: 0, z: 0, width: 0.4, depth: 0.4 }]);
}
