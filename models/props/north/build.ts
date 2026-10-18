// The things of Calgary's and Dubai's places (docs/design/11-the-three-countries-on-the-mold.md section 3; docs/rules/
// world:things-are-tappable-models, world:ride-abroad-and-workplace): the bare trees of a Calgary winter, the CTrain's shelter, the
// library's shelves, tables and course desk, Union station's Nol machine and escalator, and the site's hoarding, crane,
// guard's post, cleaner's trolley and water cooler. Each is its own model so a label can stand over it, written from
// the kit's shapes, standing on its base at y = 0 and facing +Z (assets:metre-units-and-origin), its low tops clear of the ground's
// strips (world:faces-never-share-height), with the ground it blocks as its footprint (assets:models-record-their-footprint). No real operator's, shop's or
// company's colours, marks or words (assets:no-real-brands-on-assets).
import { type PaletteName, setFootprint } from "@japacity/assets";
import { beam, box, cylinder, quad } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

import { at, legs } from "../parts";

/** A plain chair facing +Z in its frame: seat at 0.45, a back. */
function chair(g: Object3D, colour: PaletteName, frame: PaletteName = "charcoal"): void {
  legs(g, 0.42, 0.42, 0.43, frame, 0.03);
  box(g, 0.44, 0.04, 0.44, 0, 0.43, 0, colour);
  box(g, 0.44, 0.44, 0.04, 0, 0.47, -0.2, colour);
}

/** A row of books on a shelf: thin boxes of the given colours side by side along x, of slightly different heights. */
function books(g: Object3D, x0: number, x1: number, y: number, z: number, depth: number, colours: readonly PaletteName[], seed: number): void {
  const count = Math.max(1, Math.round((x1 - x0) / 0.36));
  const each = (x1 - x0) / count;
  for (let i = 0; i < count; i += 1) {
    const colour = colours[(i * 5 + seed) % colours.length] ?? "wine";
    const high = 0.26 + (((i * 3 + seed) % 4) * 0.025);
    box(g, each - 0.02, high, depth, x0 + each * (i + 0.5), y, z, colour);
  }
}

// ---------------------------------------------------------------------------
// Calgary: the strip mall and the CTrain station
// ---------------------------------------------------------------------------

/** A bare tree of a Calgary winter: a grey trunk forking into branches and twigs, no leaves. */
export function buildBareTree(): Group {
  const g = new Group();
  g.name = "prop_bare-tree";
  cylinder(g, 0.16, 2.6, 0, 0, 0, "concreteWorn", 6, 0.11);
  // Each limb from the trunk's head, and two twigs off its end.
  const limbs: [number, number, number][] = [[1.3, 4.4, 0.3], [-1.1, 4.6, 0.6], [0.2, 5.2, -1.1], [-0.4, 4.2, 1.2], [0.9, 4.9, -0.6]];
  for (const [x, y, z] of limbs) {
    beam(g, [0, 2.5, 0], [x, y, z], 0.11, "concreteWorn");
    beam(g, [x, y, z], [x * 1.4 + 0.2, y + 0.9, z * 1.3], 0.05, "concreteWorn");
    beam(g, [x, y, z], [x * 1.1 - 0.3, y + 0.7, z * 1.5 + 0.3], 0.05, "concreteWorn");
  }
  beam(g, [0, 2.4, 0], [0.1, 5.8, 0.1], 0.09, "concreteWorn");
  // The snow ring round its foot, left where the shovel did not reach.
  cylinder(g, 0.55, 0.12, 0, 0, 0, "white", 8);
  return setFootprint(g, [{ x: 0, z: 0, width: 0.4, depth: 0.4 }]);
}

/** The CTrain platform's shelter: a glass box with a curved steel roof, a bench inside and the timetable case. */
export function buildPlatformShelter(): Group {
  const g = new Group();
  g.name = "prop_platform-shelter";
  const w = 4.2;
  const d = 1.8;
  const h = 2.5;
  for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) box(g, 0.08, h, 0.08, x, 0, z, "charcoal");
  // The glass: the back and both ends, the front open between its posts, a kick rail at the foot.
  for (const x of [-w / 4, w / 4]) box(g, w / 2 - 0.1, h - 0.3, 0.03, x, 0.2, -d / 2, "glass");
  for (const x of [-w / 2, w / 2]) box(g, 0.03, h - 0.3, d - 0.1, x, 0.2, 0, "glass");
  box(g, w, 0.1, 0.05, 0, 0.12, -d / 2 + 0.03, "charcoal");
  // The roof: a shallow vault of three flats in red, the eaves over the front.
  box(g, w + 0.3, 0.08, d * 0.5, 0, h, 0, "red");
  for (const s of [-1, 1]) {
    const flat = at(g, 0, s * d * 0.38, 0, h - 0.05);
    flat.rotation.x = s * 0.35;
    box(flat, w + 0.3, 0.06, d * 0.34, 0, 0, 0, "red");
  }
  // The bench along the back, the heater over it, the timetable case on the end.
  box(g, w - 0.6, 0.06, 0.4, 0, 0.45, -d / 2 + 0.3, "wood");
  for (const x of [-1.4, 0, 1.4]) box(g, 0.06, 0.45, 0.3, x, 0, -d / 2 + 0.3, "charcoal");
  box(g, 1.2, 0.12, 0.2, 0, h - 0.35, -d / 2 + 0.15, "hub");
  quad(g, 0.1, 0.06, 0, h - 0.33, -d / 2 + 0.251, "orange");
  box(g, 0.6, 0.9, 0.06, -w / 2 + 0.5, 0.9, -d / 2 + 0.06, "white");
  quad(g, 0.5, 0.7, -w / 2 + 0.5, 1.0, -d / 2 + 0.092, "cream");
  return setFootprint(g, [
    { x: 0, z: -d / 2, width: w, depth: 0.1 },
    { x: -w / 2, z: 0, width: 0.1, depth: d },
    { x: w / 2, z: 0, width: 0.1, depth: d },
    { x: 0, z: -d / 2 + 0.3, width: w - 0.6, depth: 0.4 },
  ]);
}

// ---------------------------------------------------------------------------
// Calgary: the library
// ---------------------------------------------------------------------------

/** A tall shelf of books against a wall: five shelves in a wood case, the books in rows of colour. */
export function buildBookshelf(): Group {
  const g = new Group();
  g.name = "prop_bookshelf";
  const L = 3.6;
  const d = 0.4;
  const h = 2.1;
  box(g, L, h, 0.04, 0, 0, -d / 2 + 0.02, "darkWood");
  for (const x of [-L / 2, 0, L / 2]) box(g, 0.05, h, d, x, 0, 0, "wood");
  box(g, L + 0.05, 0.12, d, 0, 0, 0, "darkWood");
  box(g, L + 0.05, 0.05, d, 0, h, 0, "wood");
  const colours: PaletteName[] = ["wine", "indigo", "green", "cream", "teal", "orange", "denim", "tan", "red", "white"];
  [0.12, 0.52, 0.92, 1.32, 1.72].forEach((y, i) => {
    box(g, L, 0.025, d - 0.02, 0, y, 0.01, "wood");
    for (const [x0, x1] of [[-L / 2 + 0.05, -0.05], [0.05, L / 2 - 0.05]] as const) books(g, x0, x1, y + 0.025, 0.02, d - 0.12, colours, i * 3 + (x0 < 0 ? 1 : 4));
  });
  return setFootprint(g, [{ x: 0, z: 0, width: L + 0.05, depth: d }]);
}

/** A long reading table with three chairs a side and two green reading lamps. */
export function buildLibraryTable(): Group {
  const g = new Group();
  g.name = "prop_library-table";
  const w = 3.2;
  const d = 1.1;
  legs(g, w, d, 0.74, "darkWood", 0.07);
  box(g, w, 0.05, d, 0, 0.74, 0, "wood");
  for (const x of [-0.8, 0.8]) {
    box(g, 0.16, 0.03, 0.16, x, 0.79, 0, "darkWood");
    box(g, 0.03, 0.3, 0.03, x, 0.82, 0, "gold");
    box(g, 0.34, 0.12, 0.18, x, 1.1, 0, "green");
  }
  // A few books and a laptop left on the table.
  box(g, 0.3, 0.05, 0.22, -1.2, 0.79, 0.2, "wine");
  box(g, 0.28, 0.05, 0.2, -1.18, 0.84, 0.2, "teal");
  box(g, 0.34, 0.02, 0.24, 0.3, 0.79, -0.25, "charcoal");
  for (const x of [-1.05, 0, 1.05]) {
    chair(at(g, x, d / 2 + 0.3, Math.PI), "darkWood", "darkWood");
    chair(at(g, x, -d / 2 - 0.3), "darkWood", "darkWood");
  }
  // The table blocks its ground; the chairs are where readers sit.
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** The course desk: a desk with a laptop and a stack of leaflets, a chair each side, and the course's notice on a stand. */
export function buildCourseDesk(): Group {
  const g = new Group();
  g.name = "prop_course-desk";
  legs(g, 1.6, 0.8, 0.74, "charcoal", 0.04);
  box(g, 1.6, 0.04, 0.8, 0, 0.74, 0, "white");
  box(g, 1.5, 0.5, 0.03, 0, 0.24, -0.38, "charcoal");
  box(g, 0.34, 0.02, 0.24, -0.3, 0.78, -0.05, "charcoal");
  const lid = at(g, -0.3, -0.17, 0, 0.79);
  lid.rotation.x = -0.25;
  box(lid, 0.34, 0.24, 0.015, 0, 0, 0, "charcoal");
  for (let k = 0; k < 3; k += 1) box(g, 0.21, 0.02, 0.3, 0.35 + k * 0.03, 0.78 + k * 0.02, 0.1, k % 2 === 0 ? "danfoYellow" : "white");
  chair(at(g, 0, -0.65), "teal");
  chair(at(g, 0, 0.65, Math.PI), "teal");
  // The notice on its stand beside the desk: a board of the course's papers, a bright one at the top.
  const notice = at(g, 1.35, 0.1);
  box(notice, 0.05, 1.55, 0.05, 0, 0, 0, "charcoal");
  box(notice, 0.5, 0.04, 0.4, 0, 0, 0, "charcoal");
  box(notice, 0.8, 1.0, 0.04, 0, 0.9, 0.03, "tan");
  quad(notice, 0.6, 0.25, 0, 1.6, 0.052, "orange");
  for (let k = 0; k < 4; k += 1) quad(notice, 0.3, 0.22, -0.18 + (k % 2) * 0.36, 0.98 + Math.floor(k / 2) * 0.3, 0.052, k === 1 ? "danfoYellow" : "white");
  // The desk and the notice's stand block their ground; the chairs are where the tutor and a learner sit.
  return setFootprint(g, [
    { x: 0, z: 0, width: 1.6, depth: 0.8 },
    { x: 1.35, z: 0.1, width: 0.5, depth: 0.4 },
  ]);
}

// ---------------------------------------------------------------------------
// Dubai: Union station
// ---------------------------------------------------------------------------

/** The Nol machine at the metro's gates: a tall grey cabinet with its touch screen, the card pad and the coin slot. */
export function buildNolMachine(): Group {
  const g = new Group();
  g.name = "prop_nol-machine";
  box(g, 0.9, 1.9, 0.45, 0, 0, 0, "hub");
  box(g, 0.94, 0.14, 0.5, 0, 1.9, 0.02, "charcoal");
  quad(g, 0.94, 0.08, 0, 1.92, 0.272, "red");
  quad(g, 0.5, 0.42, 0, 1.15, 0.226, "glass");
  box(g, 0.2, 0.2, 0.06, -0.22, 0.85, 0.24, "charcoal");
  quad(g, 0.14, 0.14, -0.22, 0.88, 0.271, "green");
  box(g, 0.12, 0.05, 0.05, 0.22, 0.95, 0.24, "black");
  box(g, 0.44, 0.14, 0.08, 0, 0.42, 0.22, "black");
  box(g, 0.96, 0.12, 0.5, 0, 0, 0, "charcoal");
  return setFootprint(g, [{ x: 0, z: 0, width: 0.96, depth: 0.5 }]);
}

/** The escalator's foot: the steps rising at thirty degrees between glass balustrades with black handrails, the comb plate at the bottom. */
export function buildEscalator(): Group {
  const g = new Group();
  g.name = "prop_escalator";
  const w = 1.3;
  const rise = 4.2;
  const run = rise / Math.tan(Math.PI / 6);
  const pitch = Math.atan2(rise, run);
  // The landing at the foot, then the steps as one sloped band of treads; the truss under it in steel.
  box(g, w + 0.3, 0.12, 1.4, 0, 0, 0.7, "hub");
  const slope = at(g, 0, 0, 0, 0.12);
  const length = Math.hypot(rise, run);
  const band = at(slope, 0, 0);
  band.rotation.x = pitch;
  for (let k = 0; k < 12; k += 1) {
    const s = (k / 12) * length;
    box(band, w - 0.1, 0.05, length / 12 - 0.02, 0, 0, -s - length / 24, k % 2 === 0 ? "charcoal" : "black");
  }
  box(band, w + 0.3, 0.6, length - 1.2, 0, -0.62, -length / 2 - 0.6, "zinc");
  // The balustrades: glass panes on the slope, handrails along their tops, the newel at the foot.
  for (const s of [-1, 1]) {
    const side = at(band, s * (w / 2 + 0.06), 0);
    box(side, 0.03, 0.9, length, 0, 0.05, -length / 2, "glass");
    box(side, 0.08, 0.08, length + 0.6, 0, 0.95, -length / 2 + 0.3, "black");
    box(g, 0.14, 1.0, 0.6, s * (w / 2 + 0.06), 0.12, 0.95, "zinc");
    box(g, 0.1, 0.08, 0.7, s * (w / 2 + 0.06), 1.1, 0.95, "black");
  }
  return setFootprint(g, [{ x: 0, z: -run / 2 + 0.7, width: w + 0.4, depth: run + 1.4 }]);
}

// ---------------------------------------------------------------------------
// Dubai: the site
// ---------------------------------------------------------------------------

/** The site's hoarding: a run of white panels on posts with a blue band along the top and the foot, no words. */
export function buildHoarding(): Group {
  const g = new Group();
  g.name = "prop_hoarding";
  const L = 10;
  const h = 2.4;
  box(g, L, h - 0.15, 0.06, 0, 0.15, 0, "white");
  quad(g, L, 0.35, 0, h - 0.4, 0.031, "blue");
  quad(g, L, 0.25, 0, 0.15, 0.031, "blue");
  for (let x = -L / 2; x <= L / 2 + 1e-6; x += 2.5) {
    box(g, 0.1, h, 0.1, x, 0, -0.08, "hub");
    beam(g, [x, 1.6, -0.12], [x, 0.24, -1.0], 0.06, "hub");
    box(g, 0.4, 0.2, 0.4, x, 0, -1.0, "concrete");
  }
  // Dust along the foot, where the wind leaves the sand.
  quad(g, L, 0.12, 0, 0.15, 0.033, "tan");
  return setFootprint(g, [{ x: 0, z: -0.45, width: L, depth: 1.1 }]);
}

/** The tower crane's foot: a lattice mast rising off its concrete pad, the counterweight blocks and a ladder up. */
export function buildCraneFoot(): Group {
  const g = new Group();
  g.name = "prop_crane-foot";
  box(g, 4.2, 0.6, 4.2, 0, 0, 0, "concrete");
  const s = 0.8;
  const top = 12.5;
  for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]] as const) box(g, 0.14, top - 0.6, 0.14, x, 0.6, z, "danfoYellow");
  // The lattice: a zigzag on each face, every two metres.
  for (let y = 0.6; y < top - 1.5; y += 2.0) {
    for (const [a, b] of [[[-s, -s], [s, -s]], [[s, -s], [s, s]], [[s, s], [-s, s]], [[-s, s], [-s, -s]]] as const) {
      beam(g, [a[0], y, a[1]], [b[0], y + 2.0, b[1]], 0.07, "danfoYellow");
      beam(g, [a[0], y + 2.0, a[1]], [b[0], y + 2.0, b[1]], 0.06, "danfoYellow");
    }
  }
  // The counterweight blocks stacked on the pad, and the ladder up one face.
  for (let k = 0; k < 3; k += 1) box(g, 1.4, 0.5, 0.7, 1.3 + 0.0, 0.6 + k * 0.5, -1.4, "concreteWorn");
  for (const x of [-0.25, 0.25]) box(g, 0.04, top - 1.2, 0.04, x, 0.6, s + 0.15, "charcoal");
  return setFootprint(g, [{ x: 0, z: 0, width: 4.2, depth: 4.2 }]);
}

/** The gate's guard post: a white cabin with windows on three sides, its door, an air conditioner, and the barrier arm. */
export function buildGuardPost(): Group {
  const g = new Group();
  g.name = "prop_guard-post";
  const w = 1.8;
  const d = 1.6;
  box(g, w, 2.4, d, 0, 0, 0, "white");
  box(g, w + 0.3, 0.12, d + 0.3, 0, 2.4, 0, "charcoal");
  quad(g, 1.2, 0.8, -0.1, 1.1, d / 2 + 0.005, "glass");
  quad(at(g, w / 2 + 0.005, 0, Math.PI / 2), 0.9, 0.8, 0, 1.1, 0, "glass");
  quad(at(g, -w / 2 - 0.005, 0, -Math.PI / 2), 0.9, 0.8, 0.2, 1.1, 0, "glass");
  quad(at(g, -w / 2 - 0.005, 0, -Math.PI / 2), 0.7, 2.0, -0.35, 0.05, 0, "charcoal");
  box(g, 0.7, 0.45, 0.3, 0.3, 1.9, -d / 2 - 0.15, "hub");
  box(g, w + 0.1, 0.25, d + 0.1, 0, 0, 0, "concrete");
  // The barrier: its striped arm out to the side from a post at the cabin's corner.
  box(g, 0.3, 1.0, 0.3, w / 2 + 0.35, 0, d / 2 - 0.2, "danfoYellow");
  for (let k = 0; k < 8; k += 1) box(g, 0.45, 0.1, 0.08, w / 2 + 0.6 + k * 0.45, 0.85, d / 2 - 0.2, k % 2 === 0 ? "red" : "white");
  box(g, 0.08, 0.8, 0.08, w / 2 + 4.0, 0, d / 2 - 0.2, "charcoal");
  return setFootprint(g, [
    { x: 0, z: 0, width: w + 0.1, depth: d + 0.1 },
    { x: w / 2 + 0.35, z: d / 2 - 0.2, width: 0.3, depth: 0.3 },
  ]);
}

/** The cleaner's trolley: a grey cart with a bin bag on its frame, a mop bucket with its wringer, the mop and the bottles. */
export function buildCleanerTrolley(): Group {
  const g = new Group();
  g.name = "prop_cleaner-trolley";
  box(g, 1.0, 0.12, 0.5, 0, 0.1, 0, "charcoal");
  for (const x of [-0.42, 0.42]) for (const z of [-0.2, 0.2]) cylinder(g, 0.06, 0.13, x, 0, z, "black", 6);
  box(g, 0.04, 0.9, 0.5, 0.48, 0.22, 0, "hub");
  box(g, 0.04, 0.04, 0.5, 0.48, 1.08, 0, "hub");
  box(g, 0.42, 0.75, 0.42, 0.2, 0.22, 0, "black");
  box(g, 0.36, 0.08, 0.36, 0.2, 0.97, 0, "black");
  // The bucket and its wringer at the other end, the mop standing in it.
  box(g, 0.4, 0.32, 0.36, -0.28, 0.22, 0, "danfoYellow");
  box(g, 0.3, 0.12, 0.26, -0.28, 0.54, 0, "danfoYellow");
  beam(g, [-0.32, 0.4, 0.04], [-0.38, 1.45, -0.02], 0.03, "wood");
  // The shelf of bottles over the frame.
  box(g, 0.3, 0.03, 0.4, -0.05, 0.75, 0, "hub");
  for (const [z, colour] of [[-0.12, "blue"], [0.0, "green"], [0.12, "red"]] as const) cylinder(g, 0.04, 0.22, -0.05, 0.78, z, colour, 6);
  return setFootprint(g, [{ x: 0, z: 0, width: 1.05, depth: 0.55 }]);
}

/** The water cooler by the gate: an insulated drum on a steel stand with its tap, a sleeve of paper cups and a bin. */
export function buildWaterCooler(): Group {
  const g = new Group();
  g.name = "prop_water-cooler";
  legs(g, 0.6, 0.6, 0.8, "hub", 0.04);
  box(g, 0.62, 0.04, 0.62, 0, 0.8, 0, "hub");
  cylinder(g, 0.26, 0.6, 0, 0.84, 0, "orange", 10);
  cylinder(g, 0.27, 0.06, 0, 1.44, 0, "white", 10);
  box(g, 0.08, 0.06, 0.1, 0, 0.95, 0.28, "white");
  box(g, 0.05, 0.3, 0.05, 0.3, 1.0, 0.27, "white");
  box(g, 0.3, 0.38, 0.3, 0.55, 0, 0.1, "charcoal");
  return setFootprint(g, [{ x: 0.15, z: 0.05, width: 1.0, depth: 0.7 }]);
}
