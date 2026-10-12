// The small things of a lived-in home that the kit did not have (the home redesign): the yard's generator and
// clothes line, the wardrobe, a rug, a potted plant, slippers by the door, the beer crates, the standing fan, the
// kitchenette's shelf, a bucket, a mattress on the floor, the hostel's bunk, a small shelf of one's own things, and a
// louvre window that stands in a cut wall. Each stands on its base at y = 0 and faces +Z (R-ASSET-003); a thing laid on
// the floor keeps its top faces two centimetres apart from each other and the floor (R-WORLD-012). Palette only.
import { type PaletteName, setFootprint } from "@japacity/assets";
import { beam, box, clutter, cylinder, generator, quad } from "@japacity/assets/kit";
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
 * The family's small petrol generator ("I better pass my neighbour") in red, its fuel keg beside it and the cable
 * running off toward the house, on a slab of concrete so it stands out of the rain.
 */
export function buildGenerator(): Group {
  const g = new Group();
  g.name = "prop_generator";
  box(g, 0.9, 0.06, 0.7, 0, 0, 0, "concrete");
  // The kit's small set, a little larger here so it reads from the raised view.
  const set = at(g, -0.1, 0, 0, 0.06);
  set.scale.setScalar(1.25);
  generator(set, 0, 0, 0, false, 0, "red");
  // The fuel keg, a yellow jerrycan, and the cable off to the house.
  const can = at(g, 0.33, 0.12, -0.3, 0.06);
  box(can, 0.22, 0.34, 0.14, 0, 0, 0, "danfoYellow");
  box(can, 0.05, 0.05, 0.05, 0.06, 0.34, 0, "danfoYellow");
  beam(g, [-0.42, 0.42, 0], [-0.6, 0.08, -0.2], 0.025, "black");
  beam(g, [-0.6, 0.08, -0.2], [-0.6, 0.08, -0.34], 0.025, "black");
  return setFootprint(g, [{ x: 0, z: 0, width: 0.9, depth: 0.7 }]);
}

/**
 * The clothes line in the yard: two poles three metres apart with a line between, and the wash pegged on it:
 * two wrappers, a shirt, a towel, a pair of trousers and a child's dress. Each piece is a thin board so it reads from
 * either side.
 */
export function buildClothesLine(): Group {
  const g = new Group();
  g.name = "prop_clothes-line";
  const span = 3.2;
  const top = 1.85;
  for (const x of [-span / 2, span / 2]) {
    box(g, 0.07, top + 0.1, 0.07, x, 0, 0, "darkWood");
    box(g, 0.3, 0.05, 0.05, x, top, 0, "darkWood");
  }
  beam(g, [-span / 2, top + 0.02, 0], [0, top - 0.06, 0], 0.015, "white");
  beam(g, [0, top - 0.06, 0], [span / 2, top + 0.02, 0], 0.015, "white");
  // The wash, left to right: width, drop, colour, and a second colour for a band across it.
  const wash: [number, number, PaletteName, PaletteName | null][] = [
    [0.62, 0.95, "indigo", "gold"],
    [0.42, 0.55, "white", null],
    [0.5, 0.7, "orange", "wine"],
    [0.32, 0.8, "denim", null],
    [0.4, 0.5, "pepper", "white"],
    [0.36, 0.42, "tomato", null],
  ];
  let x = -span / 2 + 0.2;
  for (const [width, drop, colour, band] of wash) {
    const centre = x + width / 2;
    const sag = 0.08 * (1 - Math.abs(centre) / (span / 2));
    const hang = top - sag - drop;
    box(g, width, drop, 0.02, centre, hang, 0, colour);
    if (band !== null) {
      quad(g, width, 0.1, centre, hang + drop * 0.35, 0.011, band);
      quad(g, width, 0.1, centre, hang + drop * 0.35, -0.011, band, Math.PI);
    }
    x += width + 0.08;
  }
  return setFootprint(g, [
    { x: -span / 2, z: 0, width: 0.12, depth: 0.12 },
    { x: span / 2, z: 0, width: 0.12, depth: 0.12 },
  ]);
}

/**
 * A two-door wardrobe in wood, a long mirror on one door, a box and a bag kept on its top, a towel hung on the other
 * door's handle.
 */
export function buildWardrobe(): Group {
  const g = new Group();
  g.name = "prop_wardrobe";
  const w = 1.1;
  const d = 0.55;
  const h = 1.95;
  box(g, w, h, d, 0, 0.06, 0, "wood");
  box(g, w + 0.04, 0.06, d + 0.02, 0, 0, 0, "darkWood");
  box(g, w + 0.06, 0.05, d + 0.04, 0, h + 0.06, 0, "darkWood");
  // The two doors' seam, their handles, and the mirror on the left one.
  quad(g, 0.02, h - 0.1, 0, 0.11, d / 2 + 0.002, "darkWood");
  for (const x of [-0.06, 0.06]) box(g, 0.025, 0.18, 0.03, x, 1.0, d / 2, "gold");
  quad(g, 0.34, 1.3, -0.28, 0.4, d / 2 + 0.003, "wallSky");
  quad(g, 0.3, 1.26, -0.28, 0.42, d / 2 + 0.005, "glass");
  // A towel over the right door's handle.
  box(g, 0.24, 0.5, 0.02, 0.2, 0.62, d / 2 + 0.02, "teal");
  // A box and a folded wrapper kept on the top.
  box(g, 0.5, 0.26, 0.4, -0.2, h + 0.11, 0, "tan");
  box(g, 0.36, 0.1, 0.3, 0.28, h + 0.11, 0.02, "wine");
  return setFootprint(g, [{ x: 0, z: 0, width: w + 0.06, depth: d + 0.04 }]);
}

/** A rug of three bands and a fringe, laid on the floor, each band two centimetres over the one under it. */
export function buildRug(): Group {
  const g = new Group();
  g.name = "prop_rug";
  const w = 1.9;
  const d = 1.3;
  box(g, w, 0.02, d, 0, 0, 0, "wine");
  box(g, w - 0.24, 0.02, d - 0.24, 0, 0.02, 0, "cream");
  box(g, w - 0.5, 0.02, d - 0.5, 0, 0.04, 0, "teal");
  // A row of diamonds down the middle, a shade proud of the centre.
  for (const x of [-0.4, 0, 0.4]) box(g, 0.2, 0.02, 0.2, x, 0.06, 0, "gold", Math.PI / 4);
  // The fringe at either end.
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) box(g, 0.03, 0.012, 0.08, -0.45 + i * 0.15, 0, side * (d / 2 + 0.04), "cream");
  // A rug is walked on: it blocks nothing.
  return setFootprint(g, "none");
}

/**
 * A snake plant in a painted paint bucket, as a Lagos veranda keeps one: tall pointed blades of two greens leaning
 * out from the middle.
 */
export function buildPottedPlant(): Group {
  const g = new Group();
  g.name = "prop_potted-plant";
  cylinder(g, 0.2, 0.36, 0, 0, 0, "laterite", 10, 0.24);
  cylinder(g, 0.245, 0.03, 0, 0.36, 0, "zincRust", 10);
  cylinder(g, 0.21, 0.02, 0, 0.37, 0, "darkWood", 10);
  const blades: [number, number, number, PaletteName][] = [
    [0, 0.95, 0.0, "green"],
    [1.1, 0.8, 0.22, "pepper"],
    [2.2, 0.9, 0.18, "green"],
    [3.3, 0.7, 0.26, "pepper"],
    [4.4, 0.85, 0.2, "green"],
    [5.5, 0.75, 0.24, "pepper"],
    [0.6, 0.6, 0.3, "green"],
  ];
  for (const [turn, height, lean, colour] of blades) {
    const blade = at(g, Math.cos(turn) * 0.06, Math.sin(turn) * 0.06, -turn, 0.38);
    blade.rotation.z = lean;
    cylinder(blade, 0.05, height, 0, 0, 0, colour, 4, 0.004);
  }
  return setFootprint(g, [{ x: 0, z: 0, width: 0.5, depth: 0.5 }]);
}

/** One slipper's sole and strap, in its own frame, pointing +Z. */
function slipper(g: Object3D, x: number, z: number, ry: number, sole: PaletteName, strap: PaletteName): void {
  const s = at(g, x, z, ry);
  box(s, 0.1, 0.025, 0.26, 0, 0, 0, sole);
  box(s, 0.11, 0.035, 0.05, 0, 0.025, 0.04, strap);
}

/** The slippers left by the door: two pairs of rubber slippers and a pair of black shoes, the shoes on a small mat. */
export function buildSlippers(): Group {
  const g = new Group();
  g.name = "prop_slippers";
  box(g, 0.9, 0.02, 0.5, 0, 0, 0, "seat");
  slipper(g, -0.32, 0.02, 0.2, "blue", "white");
  slipper(g, -0.2, -0.04, 0.05, "blue", "white");
  slipper(g, 0.02, 0.06, -0.3, "tomato", "black");
  slipper(g, 0.14, -0.02, -0.1, "tomato", "black");
  for (const x of [0.3, 0.42]) {
    const shoe = at(g, x, 0, -0.05, 0.02);
    box(shoe, 0.11, 0.07, 0.27, 0, 0, 0, "black");
    box(shoe, 0.1, 0.04, 0.12, 0, 0.07, -0.06, "black");
  }
  return setFootprint(g, "none");
}

/** Crates of empty bottles stacked by the wall, the next to go back to the shop, and the cooler for a party beside. */
export function buildCrates(): Group {
  const g = new Group();
  g.name = "prop_crates";
  clutter(g, "crates", -0.3, 0, 0);
  // Bottle tops showing in the top crate.
  for (const x of [-0.37, -0.25, -0.13]) for (const z of [-0.08, 0.08]) cylinder(g, 0.03, 0.04, x, 0.64, z, "darkWood", 5);
  clutter(g, "cooler", 0.42, 0, 0.04);
  return setFootprint(g, [{ x: 0.05, z: 0, width: 1.3, depth: 0.5 }]);
}

/** A standing fan on its round foot, its head turned a little to the room. */
export function buildFan(): Group {
  const g = new Group();
  g.name = "prop_fan";
  cylinder(g, 0.2, 0.05, 0, 0, 0, "black", 10);
  cylinder(g, 0.025, 1.15, 0, 0.05, 0, "white", 6);
  const head = at(g, 0, 0.06, 0, 1.25);
  head.rotation.x = Math.PI / 2;
  cylinder(head, 0.26, 0.08, 0, -0.04, 0, "white", 12);
  cylinder(head, 0.21, 0.085, 0, -0.04, 0, "wallSky", 12);
  cylinder(head, 0.08, 0.16, 0, -0.2, 0, "white", 8);
  return setFootprint(g, [{ x: 0, z: 0, width: 0.4, depth: 0.4 }]);
}

/**
 * The kitchenette's shelf: a low cupboard with a kettle, a tin of milk, cups, a tin of tomato paste and a stack of plates on
 * it, and a bag of rice against its end. It stands free, so it can stand against a wall cut low.
 */
export function buildKitchenShelf(): Group {
  const g = new Group();
  g.name = "prop_kitchen-shelf";
  const w = 0.9;
  const d = 0.4;
  const h = 0.8;
  box(g, w, h, d, 0, 0, 0, "white");
  quad(g, 0.02, h - 0.1, 0, 0.05, d / 2 + 0.002, "concrete");
  for (const x of [-0.06, 0.06]) box(g, 0.02, 0.1, 0.02, x, 0.5, d / 2, "hub");
  box(g, w + 0.04, 0.03, d + 0.02, 0, h, 0, "wood");
  // The kettle.
  cylinder(g, 0.1, 0.2, -0.28, h + 0.03, 0.02, "hub", 10, 0.08);
  box(g, 0.12, 0.03, 0.03, -0.28, h + 0.26, 0.02, "black");
  beam(g, [-0.18, h + 0.12, 0.02], [-0.12, h + 0.2, 0.02], 0.025, "hub");
  // A stack of plates and a tin of milk.
  for (let i = 0; i < 4; i++) cylinder(g, 0.11, 0.015, 0.02, h + 0.03 + i * 0.02, 0.02, "white", 10);
  cylinder(g, 0.05, 0.12, 0.2, h + 0.03, 0.06, "blue", 8);
  // The bag of rice against the cupboard's end.
  box(g, 0.3, 0.42, 0.22, w / 2 + 0.2, 0, 0.02, "cream");
  quad(g, 0.3, 0.12, w / 2 + 0.2, 0.2, 0.131, "red");
  // Cups and the tin of tomato paste along the back of the top.
  for (const [x, colour] of [[0.24, "red"], [0.34, "white"], [-0.06, "tomato"]] as const) cylinder(g, 0.04, 0.1, x, h + 0.03, -0.12, colour, 6);
  return setFootprint(g, [
    { x: 0, z: 0, width: w + 0.04, depth: d + 0.02 },
    { x: w / 2 + 0.2, z: 0.02, width: 0.3, depth: 0.22 },
  ]);
}

/** A bucket with its cup and a sponge on the rim: bathing water fetched. Placed in rows, it is the hostel's line of buckets. */
export function buildBucket(): Group {
  const g = new Group();
  g.name = "prop_bucket";
  cylinder(g, 0.15, 0.36, 0, 0, 0, "basin", 10, 0.19);
  cylinder(g, 0.17, 0.02, 0, 0.36, 0, "blue", 10);
  cylinder(g, 0.16, 0.01, 0, 0.33, 0, "lagoon", 10);
  beam(g, [-0.18, 0.37, 0], [0, 0.52, 0], 0.012, "hub");
  beam(g, [0, 0.52, 0], [0.18, 0.37, 0], 0.012, "hub");
  cylinder(g, 0.05, 0.08, 0.08, 0.35, 0.05, "white", 6);
  return setFootprint(g, [{ x: 0, z: 0, width: 0.4, depth: 0.4 }]);
}

/** Your corner at the family house: a foam mattress on the floor, its sheet, a wrapper and a pillow, the phone charging. */
export function buildMattress(): Group {
  const g = new Group();
  g.name = "prop_mattress";
  const w = 1.1;
  const l = 1.9;
  box(g, w, 0.16, l, 0, 0, 0, "cream");
  box(g, w + 0.01, 0.03, l - 0.1, 0, 0.16, 0.02, "wallSky");
  box(g, 0.6, 0.1, 0.34, 0, 0.19, -l / 2 + 0.24, "white");
  box(g, w + 0.03, 0.04, 0.7, 0, 0.19, 0.4, "orange");
  quad(at(g, w / 2 + 0.016, 0.4, Math.PI / 2), 0.7, 0.18, 0, 0.04, 0, "orange");
  // The phone on the floor by the head and its lead to the wall.
  box(g, 0.08, 0.012, 0.16, w / 2 + 0.16, 0, -l / 2 + 0.3, "black", 0.2);
  beam(g, [w / 2 + 0.17, 0.01, -l / 2 + 0.2], [w / 2 + 0.3, 0.01, -l / 2 - 0.05], 0.012, "white");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: l }]);
}

/**
 * The hostel's bed: a steel bunk, the lower bunk made with a thin mattress and a wrapper, the upper bare slats holding
 * the bag and a carton, as a single room's bunk is used.
 */
export function buildBunkBed(): Group {
  const g = new Group();
  g.name = "prop_bunk-bed";
  const w = 0.95;
  const l = 1.95;
  const posts: [number, number][] = [[-w / 2, -l / 2], [w / 2, -l / 2], [-w / 2, l / 2], [w / 2, l / 2]];
  for (const [x, z] of posts) box(g, 0.05, 1.7, 0.05, x, 0, z, "hub");
  for (const y of [0.3, 1.2]) {
    for (const x of [-w / 2, w / 2]) box(g, 0.04, 0.06, l, x, y, 0, "hub");
    for (const z of [-l / 2, l / 2]) box(g, w, 0.06, 0.04, 0, y, z, "hub");
  }
  // The ladder at the foot.
  for (const y of [0.55, 0.85]) box(g, w - 0.05, 0.03, 0.03, 0, y, l / 2, "hub");
  // The lower bunk made: a thin mattress, a wrapper over the foot, a pillow.
  box(g, w - 0.04, 0.12, l - 0.04, 0, 0.36, 0, "cream");
  box(g, w - 0.02, 0.03, 0.75, 0, 0.48, 0.45, "indigo");
  box(g, 0.5, 0.08, 0.3, 0, 0.48, -l / 2 + 0.22, "white");
  // The upper: slats, a bag and a carton kept on them.
  for (let i = 0; i < 6; i++) box(g, w - 0.04, 0.02, 0.1, 0, 1.26, -l / 2 + 0.18 + i * 0.32, "wood");
  box(g, 0.6, 0.32, 0.36, 0, 1.28, -0.4, "danfoYellow");
  box(g, 0.45, 0.3, 0.4, 0.05, 1.28, 0.45, "tan");
  return setFootprint(g, [{ x: 0, z: 0, width: w + 0.05, depth: l + 0.05 }]);
}

/** A small open shelf of one's own things: books, a radio, a mirror, the cream and the toothbrush cup, a cap. */
export function buildSmallShelf(): Group {
  const g = new Group();
  g.name = "prop_small-shelf";
  const w = 0.7;
  const d = 0.32;
  for (const x of [-w / 2, w / 2]) box(g, 0.03, 1.1, d, x, 0, 0, "darkWood");
  for (const y of [0.04, 0.55, 1.08]) box(g, w, 0.03, d, 0, y, 0, "darkWood");
  // Books on the lower board, a radio and a cup on the middle, a mirror and a cap on top.
  for (const [x, colour, height] of [[-0.25, "red", 0.26], [-0.2, "blue", 0.3], [-0.15, "danfoYellow", 0.24], [-0.1, "green", 0.28]] as const) box(g, 0.04, height, 0.22, x, 0.07, 0, colour);
  box(g, 0.26, 0.16, 0.12, 0.15, 0.07, 0, "black");
  cylinder(g, 0.04, 0.1, -0.2, 0.58, 0, "white", 6);
  cylinder(g, 0.035, 0.14, -0.08, 0.58, 0, "tomato", 6);
  box(g, 0.22, 0.12, 0.16, 0.15, 0.58, 0, "cream");
  quad(g, 0.24, 0.3, -0.12, 1.11, -d / 2 + 0.02, "wallSky");
  box(g, 0.2, 0.08, 0.2, 0.18, 1.11, 0, "charcoal");
  return setFootprint(g, [{ x: 0, z: 0, width: w + 0.03, depth: d }]);
}

/**
 * The bath corner of a yard: three sheets of zinc on wooden posts round a concrete slab with its drain, a wrapper hung
 * over the open side for a door, a bucket and its cup on the slab and the soap on a ledge. Its open side faces +Z.
 */
export function buildBathCorner(): Group {
  const g = new Group();
  g.name = "prop_bath-corner";
  const w = 1.3;
  const d = 1.2;
  const h = 1.75;
  box(g, w, 0.06, d, 0, 0, 0, "concrete");
  box(g, 0.14, 0.012, 0.14, 0.35, 0.06, 0.25, "drain");
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]] as const) box(g, 0.06, h + 0.1, 0.06, x, 0, z, "darkWood");
  // The zinc: the back and the two sides, standing a hand off the slab, ribbed in the rusted shade.
  box(g, w, h - 0.2, 0.02, 0, 0.2, -d / 2, "zinc");
  for (const s of [-1, 1]) box(g, 0.02, h - 0.2, d, s * (w / 2), 0.2, 0, "zinc");
  for (let i = 0; i < 5; i++) quad(g, 0.04, h - 0.2, -w / 2 + 0.15 + i * 0.25, 0.2, -d / 2 + 0.012, "zincRust");
  // The wrapper over the open side, drawn to one side on its line.
  beam(g, [-w / 2, h + 0.02, d / 2], [w / 2, h + 0.02, d / 2], 0.015, "black");
  box(g, 0.5, h - 0.35, 0.02, -w / 2 + 0.28, 0.3, d / 2, "wine");
  quad(g, 0.5, 0.12, -w / 2 + 0.28, 0.9, d / 2 + 0.011, "gold");
  // The bucket, its cup and the soap.
  cylinder(g, 0.15, 0.34, 0.12, 0.06, -0.12, "basin", 10, 0.18);
  cylinder(g, 0.05, 0.08, 0.2, 0.4, -0.06, "white", 6);
  box(g, 0.3, 0.03, 0.1, 0, 1.1, -d / 2 + 0.06, "darkWood");
  box(g, 0.1, 0.04, 0.06, -0.05, 1.13, -d / 2 + 0.06, "tomato");
  return setFootprint(g, [
    { x: 0, z: -d / 2, width: w, depth: 0.1 },
    { x: -w / 2, z: 0, width: 0.1, depth: d },
    { x: w / 2, z: 0, width: 0.1, depth: d },
  ]);
}
