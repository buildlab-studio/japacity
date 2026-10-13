// The small things of a lived-in street and office that the kit did not have as models (the design):
// a board of posters, a drinks seller's cooler on its bench, a woven mat with a seller's few goods, and an office's
// filing cabinet with the calendar pinned on the board above it. Each stands on its base at y = 0 and faces +Z
// (R-ASSET-003); a thing laid on the ground keeps its top faces two centimetres clear of the ground and of each other
// (R-WORLD-012). Palette only, from the kit's parts.
import { type PaletteName, setFootprint } from "@japacity/assets";
import { box, clutter, cylinder, posters, seeded } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

/** A group at (x, y, z) turned ry, to draw a part in its own frame. */
function at(g: Object3D, x: number, z: number, ry = 0, y = 0): Group {
  const frame = new Group();
  frame.position.set(x, y, z);
  frame.rotation.y = ry;
  g.add(frame);
  return frame;
}

/**
 * A plywood board on two posts at the roadside, pasted over with posters (a crusade, a party's face, a lesson
 * centre, a lost-and-found), the paper in blocks of colour and not the words, a torn corner showing the older ones.
 */
export function buildPosterBoard(): Group {
  const g = new Group();
  g.name = "prop_poster-board";
  for (const x of [-0.85, 0.85]) box(g, 0.1, 2.1, 0.1, x, 0, -0.06, "darkWood");
  box(g, 1.9, 1.2, 0.05, 0, 0.85, 0, "wood");
  // Two rows of posters on the street side, pasted over each other.
  const face = at(g, -0.7, 0.026);
  const random = seeded(23);
  posters(face, 0, 1.55, random, 3);
  posters(face, 0.18, 1.0, random, 3);
  // The older ones under a torn corner, and the cap along the top that keeps the rain off.
  box(face, 0.3, 0.2, 0.004, 1.25, 1.62, 0.004, "cream");
  box(g, 2.0, 0.05, 0.16, 0, 2.05, 0, "darkWood");
  return setFootprint(g, [{ x: 0, z: 0, width: 1.9, depth: 0.2 }]);
}

/**
 * The drinks seller's spot: her cooler of minerals on a low bench, a crate of empties beside it on the ground, the
 * plastic stool she sits on, and a few bottles stood on the cooler's lid.
 */
export function buildCoolerStand(): Group {
  const g = new Group();
  g.name = "prop_cooler-stand";
  clutter(g, "bench", 0, 0, 0);
  clutter(g, "cooler", -0.3, 0.48, 0);
  for (const [x, colour] of [[-0.45, "green"], [-0.35, "darkWood"], [-0.2, "red"]] as const) cylinder(g, 0.035, 0.22, x, 1.0, 0.1, colour, 6);
  // A crate of empties on the ground at the bench's end, and her stool in front.
  box(g, 0.5, 0.32, 0.36, 0.95, 0, 0.05, "blue");
  for (const x of [0.85, 0.97, 1.09]) for (const z of [-0.03, 0.13]) cylinder(g, 0.03, 0.04, x, 0.32, z, "darkWood", 5);
  const stool = at(g, 0.3, 0.55);
  cylinder(stool, 0.17, 0.38, 0, 0, 0, "red", 8);
  return setFootprint(g, [{ x: 0.3, z: 0.1, width: 1.9, depth: 0.8 }]);
}

/** How thick the mat lies: its top a centimetre and a half over a forecourt's floor at two (R-WORLD-012). */
const MAT_TOP = 0.035;

/** One basin of goods on the mat, its heap in its own colour. */
function basin(g: Object3D, x: number, z: number, heap: PaletteName): void {
  cylinder(g, 0.2, 0.1, x, MAT_TOP, z, "basin", 10);
  cylinder(g, 0.15, 0.06, x, MAT_TOP + 0.1, z, heap, 8);
}

/** A woven mat on the ground in its stripes, a seller's few basins on it (pepper, tomatoes, garri) and her slippers off at the edge. */
export function buildMat(): Group {
  const g = new Group();
  g.name = "prop_mat";
  // The weave in bands side by side, one height, so no face lies over another.
  const bands = 9;
  const depth = 1.0 / bands;
  for (let i = 0; i < bands; i++) box(g, 1.6, MAT_TOP, depth, 0, 0, -0.5 + depth * (i + 0.5), i % 2 === 1 ? "wine" : "khaki");
  basin(g, -0.45, -0.15, "pepper");
  basin(g, 0.05, -0.2, "tomato");
  basin(g, 0.5, -0.1, "cream");
  // Her slippers at the mat's front edge.
  for (const x of [-0.12, 0.02]) box(g, 0.1, 0.025, 0.26, x, MAT_TOP + 0.004, 0.32, "blue");
  return setFootprint(g, "none");
}

/**
 * An office's grey filing cabinet against the wall, a box file and a tray on top, and the board above it where this
 * year's calendar is pinned: a bank's calendar, its picture on top and the month's grid of days under it.
 */
export function buildOfficeCabinet(): Group {
  const g = new Group();
  g.name = "prop_office-cabinet";
  box(g, 0.5, 1.3, 0.6, 0, 0, 0, "zinc");
  for (const y of [0.12, 0.54, 0.96]) {
    box(g, 0.44, 0.36, 0.01, 0, y, 0.3, "hub");
    box(g, 0.14, 0.03, 0.02, 0, y + 0.26, 0.31, "black");
  }
  box(g, 0.1, 0.3, 0.26, -0.1, 1.3, -0.05, "blue");
  box(g, 0.28, 0.05, 0.3, 0.1, 1.3, 0.05, "black");
  // The board fixed to the cabinet's back and the calendar pinned on it.
  box(g, 0.6, 0.9, 0.03, 0, 1.6, -0.285, "darkWood");
  box(g, 0.42, 0.26, 0.01, 0, 2.15, -0.265, "teal");
  box(g, 0.42, 0.34, 0.01, 0, 1.78, -0.265, "white");
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) box(g, 0.05, 0.04, 0.004, -0.14 + col * 0.07, 1.82 + row * 0.07, -0.258, row === 1 && col === 2 ? "red" : "charcoal");
  return setFootprint(g, [{ x: 0, z: 0, width: 0.5, depth: 0.6 }]);
}
