// What a room on the water in Makoko holds (city.md place.makoko, home:home-is-the-home-point), as the settlement's
// homes keep it: a thin mattress on the floor with a raffia mat rolled beside it and the mosquito net knotted up on its
// rope; the black water drum with its lid, yellow jerrycans and a bucket with a lid; the tin trunk the papers are kept
// in; a low cupboard with clothes piled on top, buckets with lids and a low stool; and the pale bundle of net with its
// floats that every porch and the net shed keep; a small pot on three stones where the cooking is done; a woven sack of clothes;
// and the bucket stood under the leak. Poor and worn, cared for. Each faces +z with its lowest point at y = 0.
import { type PaletteName, setFootprint } from "@japacity/model-kit";
import { beam, box, cylinder, seeded } from "@japacity/model-kit/kit";
import { Group } from "three";

/** The mattress's size and its top, where the character lies. */
export const FLOOR_BED = { length: 1.9, width: 0.95, top: 0.11 } as const;

/** The mattress on the floor, its sheet and pillow, the rolled mat, and the net knotted up above it on its rope. */
export function buildFloorBed(): Group {
  const g = new Group();
  g.name = "prop_floor-bed";
  const { length, width, top } = FLOOR_BED;
  box(g, length, top - 0.02, width, 0, 0, 0, "cream");
  box(g, length - 0.06, 0.02, width - 0.04, 0, top - 0.02, 0.01, "wine");
  box(g, length * 0.42, 0.025, width - 0.02, length * 0.22, top - 0.01, 0.01, "gold");
  box(g, 0.32, 0.09, width - 0.25, -length / 2 + 0.22, top, 0, "white");
  // A wrapper folded at the foot.
  box(g, 0.3, 0.06, 0.5, length / 2 - 0.25, top, -0.1, "teal");
  // The raffia mat rolled and stood against the wall behind the mattress's foot.
  const mat = new Group();
  mat.position.set(length / 2 + 0.25, 0, -width / 2 + 0.15);
  g.add(mat);
  cylinder(mat, 0.12, 0.95, 0, 0, 0, "tan", 8);
  cylinder(mat, 0.125, 0.06, 0, 0.3, 0, "khaki", 8);
  cylinder(mat, 0.125, 0.06, 0, 0.7, 0, "khaki", 8);
  // The net, knotted up for the day: a pale cone from the rope over the mattress, its knot, its loose skirt.
  cylinder(g, 0.34, 0.55, -0.15, 1.05, 0.05, "white", 8, 0.06);
  cylinder(g, 0.07, 0.12, -0.15, 1.6, 0.05, "cream", 6);
  beam(g, [-0.15, 1.72, 0.05], [-0.15, 1.97, 0.05], 0.015, "black");
  return setFootprint(g, [{ x: 0, z: 0, width: length, depth: width }]);
}

/** The black drum with its lid and dipper, two yellow jerrycans, a white bucket with its lid. */
export function buildDrumJerrycans(): Group {
  const g = new Group();
  g.name = "prop_drum-jerrycans";
  cylinder(g, 0.3, 0.88, 0, 0, 0, "black", 10);
  cylinder(g, 0.305, 0.05, 0, 0.3, 0, "charcoal", 10);
  cylinder(g, 0.32, 0.04, 0, 0.88, 0, "charcoal", 10);
  cylinder(g, 0.09, 0.06, 0.06, 0.92, 0.05, "basin", 8, 0.11);
  beam(g, [0.12, 0.96, 0.08], [0.32, 1.0, 0.18], 0.025, "basin");
  for (const [x, z, turn] of [[0.5, 0.12, 0.2], [0.78, -0.08, -0.15]] as const) {
    box(g, 0.24, 0.38, 0.17, x, 0, z, "danfoYellow", turn);
    box(g, 0.06, 0.06, 0.06, x - 0.06, 0.38, z, "red", turn);
    box(g, 0.1, 0.05, 0.04, x + 0.04, 0.4, z, "danfoYellow", turn);
  }
  cylinder(g, 0.15, 0.3, -0.45, 0, 0.22, "white", 8, 0.17);
  cylinder(g, 0.18, 0.03, -0.45, 0.3, 0.22, "blue", 8);
  return setFootprint(g, [{ x: 0.15, z: 0.05, width: 1.25, depth: 0.7 }]);
}

/** The tin trunk the papers are kept in: zinc gone dull, rust at its edges, two bands, a hasp, on two wedges. */
export function buildTinTrunk(): Group {
  const g = new Group();
  g.name = "prop_tin-trunk";
  const w = 0.78;
  const d = 0.44;
  const h = 0.38;
  for (const x of [-0.25, 0.25]) box(g, 0.1, 0.05, d - 0.06, x, 0, 0, "darkWood");
  box(g, w, h, d, 0, 0.05, 0, "hub");
  box(g, w + 0.02, 0.06, d + 0.02, 0, 0.05 + h, 0, "zinc");
  for (const x of [-0.22, 0.22]) box(g, 0.05, h + 0.07, d + 0.03, x, 0.05, 0, "zincRust");
  box(g, w + 0.01, 0.05, d + 0.01, 0, 0.05, 0, "zincRust");
  box(g, 0.08, 0.1, 0.03, 0, h - 0.04, d / 2 + 0.01, "black");
  for (const s of [-1, 1]) box(g, 0.03, 0.06, 0.12, s * (w / 2 + 0.02), 0.28, 0, "black");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** A low wooden cupboard, clothes piled on top, two buckets with lids beside it and a low stool in front. */
export function buildCupboard(): Group {
  const g = new Group();
  g.name = "prop_cupboard-clothes";
  const random = seeded(77);
  const w = 1.0;
  const d = 0.45;
  const h = 0.85;
  box(g, w, h, d, 0, 0, 0, "wood");
  for (const x of [-0.245, 0.245]) box(g, w / 2 - 0.04, h - 0.12, 0.02, x, 0.08, d / 2 + 0.005, "darkWood");
  for (const x of [-0.05, 0.05]) box(g, 0.03, 0.08, 0.02, x, 0.45, d / 2 + 0.02, "hub");
  box(g, w + 0.04, 0.03, d + 0.04, 0, h, 0, "darkWood");
  // The clothes on top, folded and heaped.
  const cloth: PaletteName[] = ["orange", "indigo", "white", "wine", "gold", "denim", "teal", "red"];
  let y = h + 0.03;
  for (let i = 0; i < 6; i++) {
    const thick = 0.05 + random() * 0.05;
    box(g, 0.42 + random() * 0.2, thick, 0.32 + random() * 0.08, -0.15 + (random() - 0.5) * 0.25 + (i > 3 ? 0.3 : 0), i > 3 ? h + 0.03 + (i - 4) * 0.08 : y, (random() - 0.5) * 0.06, cloth[i % cloth.length] ?? "white", (random() - 0.5) * 0.3);
    if (i <= 3) y += thick;
  }
  // Buckets with lids: a blue and a white.
  for (const [x, colour, lid] of [[w / 2 + 0.25, "basin", "white"], [w / 2 + 0.25, "white", "red"]] as const) {
    const z = colour === "basin" ? -0.05 : 0.38;
    cylinder(g, 0.15, 0.32, x, 0, z, colour, 8, 0.18);
    cylinder(g, 0.19, 0.03, x, 0.32, z, lid, 8);
  }
  // The low stool.
  box(g, 0.32, 0.04, 0.28, -0.2, 0.26, d / 2 + 0.35, "wood");
  for (const sx of [-0.13, 0.13]) for (const sz of [-0.1, 0.1]) box(g, 0.04, 0.26, 0.04, -0.2 + sx, 0, d / 2 + 0.35 + sz, "darkWood");
  return setFootprint(g, [
    { x: 0, z: 0, width: w, depth: d },
    { x: w / 2 + 0.25, z: 0.17, width: 0.4, depth: 0.8 },
  ]);
}

/** A pale bundle of net folded on the planks, its floats along the top line, a coil of rope beside it. */
export function buildNetBundle(): Group {
  const g = new Group();
  g.name = "prop_net-bundle";
  const random = seeded(19);
  const folds: PaletteName[] = ["cream", "white", "khaki", "cream", "white"];
  folds.forEach((colour, i) => {
    const w = 1.1 - i * 0.12;
    box(g, w, 0.09, 0.55 - i * 0.05, (random() - 0.5) * 0.1, i * 0.08, (random() - 0.5) * 0.06, colour, (random() - 0.5) * 0.2);
  });
  for (let i = 0; i < 6; i++) box(g, 0.08, 0.05, 0.06, -0.42 + i * 0.17, 0.4, 0.2 - (i % 2) * 0.06, i % 3 === 0 ? "orange" : "danfoYellow");
  cylinder(g, 0.2, 0.08, 0.72, 0, 0.12, "darkWood", 8, 0.18);
  cylinder(g, 0.13, 0.04, 0.72, 0.08, 0.12, "wood", 8);
  return setFootprint(g, [{ x: 0.1, z: 0, width: 1.35, depth: 0.6 }]);
}

/** The small pot's top, where the steam rises from, over the stones' footing. */
export const STONES = { top: 0.42 } as const;

/** A small pot on three stones over a few sticks on a tin sheet, its lid on, a ladle across, the matches and a sachet beside. */
export function buildThreeStones(): Group {
  const g = new Group();
  g.name = "prop_three-stones";
  const random = seeded(31);
  // The tin sheet the fire is kept on, a hand over the boards.
  box(g, 0.75, 0.035, 0.6, 0, 0, 0, "hub");
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    box(g, 0.15, 0.17, 0.14, Math.cos(a) * 0.17, 0.02, Math.sin(a) * 0.17, i === 1 ? "concreteWorn" : "concrete", a);
  }
  // The sticks pushed in from the front, their ends in the embers.
  for (let i = 0; i < 3; i++) beam(g, [(i - 1) * 0.06, 0.06, 0.02], [(i - 1) * 0.18, 0.03, 0.38 + random() * 0.05], 0.035, i === 1 ? "wood" : "darkWood");
  box(g, 0.16, 0.03, 0.12, 0, 0.03, 0, "orange");
  // The pot: small, black from the fire, its lid and the lid's knob.
  cylinder(g, 0.13, 0.17, 0, 0.19, 0, "black", 10, 0.15);
  cylinder(g, 0.155, 0.025, 0, 0.36, 0, "charcoal", 10);
  box(g, 0.04, 0.03, 0.04, 0, 0.385, 0, "hub");
  beam(g, [-0.22, 0.4, -0.05], [0.25, 0.37, 0.08], 0.025, "wood");
  box(g, 0.05, 0.015, 0.035, 0.3, 0.02, 0.18, "danfoYellow");
  return setFootprint(g, [{ x: 0, z: 0.05, width: 0.75, depth: 0.7 }]);
}

/** A woven sack of clothes against the wall, bulging, its neck tied, a wrapper spilling from it, slippers in front. */
export function buildClothesSack(): Group {
  const g = new Group();
  g.name = "prop_clothes-sack";
  box(g, 0.55, 0.6, 0.42, 0, 0, 0, "white");
  box(g, 0.5, 0.12, 0.4, 0.02, 0.6, 0, "white", 0.2);
  for (const y of [0.18, 0.42]) box(g, 0.56, 0.04, 0.43, 0, y, 0, "basin");
  box(g, 0.12, 0.1, 0.12, 0.02, 0.72, 0, "khaki");
  box(g, 0.35, 0.05, 0.3, 0.42, 0, 0.12, "wine", 0.3);
  for (const [x, colour] of [[-0.2, "red"], [-0.05, "red"]] as const) box(g, 0.1, 0.025, 0.25, x, 0, 0.42, colour, 0.1);
  return setFootprint(g, [{ x: 0.1, z: 0.05, width: 0.85, depth: 0.55 }]);
}

/** The bucket stood under the leak in the roof, a little water in it, a rag beside it. */
export function buildLeakBucket(): Group {
  const g = new Group();
  g.name = "prop_leak-bucket";
  cylinder(g, 0.14, 0.3, 0, 0, 0, "basin", 8, 0.17);
  cylinder(g, 0.155, 0.01, 0, 0.2, 0, "lagoon", 8);
  box(g, 0.25, 0.035, 0.18, 0.28, 0, 0.05, "khaki", 0.4);
  return setFootprint(g, [{ x: 0.05, z: 0, width: 0.5, depth: 0.36 }]);
}

/** A raffia mat spread on the boards where the day is sat through, a low stool at its edge, an enamel basin and two cups on it. */
export function buildMatStool(): Group {
  const g = new Group();
  g.name = "prop_mat-stool";
  // The mat a little thick, so it never shares the boards' height; its woven bands across.
  box(g, 1.3, 0.03, 0.9, 0, 0, 0, "tan");
  for (const x of [-0.45, -0.15, 0.15, 0.45]) box(g, 0.05, 0.034, 0.9, x, 0, 0, "khaki");
  box(g, 0.3, 0.04, 0.26, 0.55, 0.26, -0.55, "wood");
  for (const sx of [-0.11, 0.11]) for (const sz of [-0.09, 0.09]) box(g, 0.04, 0.26, 0.04, 0.55 + sx, 0, -0.55 + sz, "darkWood");
  cylinder(g, 0.2, 0.08, -0.35, 0.03, 0.15, "white", 10, 0.24);
  cylinder(g, 0.205, 0.012, -0.35, 0.11, 0.15, "blue", 10);
  for (const [x, z] of [[0.1, 0.2], [0.22, 0.12]] as const) cylinder(g, 0.04, 0.09, x, 0.03, z, "red", 6);
  return setFootprint(g, [{ x: 0.55, z: -0.55, width: 0.34, depth: 0.3 }]);
}
