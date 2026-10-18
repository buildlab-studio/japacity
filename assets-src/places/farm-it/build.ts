// The fields inland of Castel Volturno (docs/design/15-the-three-countries-on-the-mold.md section 3; city.md
// place.farm-it): where the farm's cash job is done, reached by the gangmaster's van. Rows of low tomato plants on
// the brown earth, the gangmaster's table under a blue tarpaulin with the clipboard the day is signed on, crates of
// the morning's picking stacked on a pallet, a water tap on its pipe and a tree to stand under. Each piece stands on
// its base at y = 0 facing +Z (R-ASSET-003), records the ground it blocks (R-ASSET-030) and shows no real farm's or
// company's name or mark (R-ASSET-010).
import { type PaletteName, setFootprint, type SignStyle } from "@japacity/assets";
import { beam, box, cylinder, floorQuad, quad, seeded, signboard, solid } from "@japacity/assets/kit";
import { Group } from "three";

import { at } from "../../prop/parts";
import { lump } from "../../veh/lab";

/** A row of the field: low tomato plants along +z, the drip line at their foot, a few fruit showing red. */
export const CROP_ROW = { length: 9.0, spacing: 0.6 } as const;

export function buildCropRow(): Group {
  const g = new Group();
  g.name = "prop_crop-row";
  const random = seeded(4417);
  const { length, spacing } = CROP_ROW;
  const count = Math.floor(length / spacing);
  // The drip line along the row's foot.
  box(g, 0.03, 0.08, length, 0.12, 0, 0, "black");
  for (let k = 0; k < count; k += 1) {
    const z = -length / 2 + spacing * (k + 0.5);
    const r = 0.26 + random() * 0.08;
    lump(g, r, (random() - 0.5) * 0.08, r * 0.8, z, k % 3 === 0 ? "green" : "pepper", [1, 0.9, 1]);
    if (random() < 0.6) box(g, 0.08, 0.08, 0.08, (random() - 0.5) * 0.3, 0.12 + random() * 0.2, z + (random() - 0.5) * 0.3, "tomato");
  }
  return setFootprint(g, [{ x: 0, z: 0, width: 0.6, depth: length }]);
}

/**
 * The gangmaster's table: a folding table under a tarpaulin on four poles, the clipboard and a cash tin on it, his chair,
 * and a square of cardboard tied to the front pole with a few words in marker (its words a text key, R-ASSET-012).
 */
export function buildTarpTable(signKey: string, style: SignStyle): Group {
  const g = new Group();
  g.name = "prop_tarp-table";
  const [w, d, h] = [3.0, 2.6, 2.3];
  // Four poles, the tarpaulin over them sagging in the middle, tied off with a rope at one corner.
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]] as const) cylinder(g, 0.04, h, x, 0, z, "wood", 5);
  const sag = h - 0.25;
  const c: [number, number, number][] = [[-w / 2 - 0.1, h, -d / 2 - 0.1], [w / 2 + 0.1, h, -d / 2 - 0.1], [w / 2 + 0.1, h + 0.1, d / 2 + 0.1], [-w / 2 - 0.1, h + 0.1, d / 2 + 0.1], [0, sag, 0]];
  // Top and underside, so the sheet shows from the camera above and from the table below.
  solid(g, c, [[0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0]], "basin");
  solid(g, c, [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]], "blue");
  beam(g, [w / 2 + 0.1, h + 0.1, d / 2 + 0.1], [w / 2 + 0.9, 0, d / 2 + 0.6], 0.02, "tan");
  // The folding table: a white top on grey legs.
  const tw = 1.6;
  const td = 0.7;
  for (const [x, z] of [[-tw / 2 + 0.06, -td / 2 + 0.06], [tw / 2 - 0.06, -td / 2 + 0.06], [-tw / 2 + 0.06, td / 2 - 0.06], [tw / 2 - 0.06, td / 2 - 0.06]] as const) box(g, 0.04, 0.72, 0.04, x, 0, z, "hub");
  box(g, tw, 0.04, td, 0, 0.72, 0, "white");
  // The clipboard the day's names are signed on, its pen, the tin for the cash, a bottle of water.
  const board = at(g, -0.3, 0.05, 0.2, 0.76);
  box(board, 0.26, 0.015, 0.34, 0, 0, 0, "wood");
  box(board, 0.22, 0.005, 0.28, 0, 0.015, 0.01, "white");
  box(board, 0.1, 0.02, 0.03, 0, 0.015, -0.14, "hub");
  for (let k = 0; k < 4; k += 1) floorQuad(board, 0.16, 0.012, 0, 0.0215, 0.08 - k * 0.05, "charcoal");
  box(g, 0.012, 0.012, 0.14, -0.08, 0.76, 0.08, "blue");
  box(g, 0.22, 0.1, 0.16, 0.45, 0.76, -0.05, "red");
  cylinder(g, 0.04, 0.26, 0.15, 0.76, -0.18, "wallSky", 6);
  // The cardboard on the front pole, facing the field's way in.
  const card = at(g, -w / 2 + 0.3, d / 2 + 0.03);
  box(card, 0.62, 0.46, 0.02, 0, 1.25, -0.01, style.board);
  signboard(g, at(card, 0, -0.05), signKey, style, 0, 1.27, 0.58, 0.42);
  // His chair behind the table, facing out under the sheet.
  const chair = at(g, 0.1, -0.75);
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const) box(chair, 0.03, 0.44, 0.03, x, 0, z, "hub");
  box(chair, 0.42, 0.04, 0.42, 0, 0.44, 0, "white");
  box(chair, 0.42, 0.4, 0.04, 0, 0.48, -0.2, "white");
  return setFootprint(g, [
    { x: 0, z: -0.15, width: tw + 0.1, depth: td + 0.9 },
    { x: w / 2 + 0.5, z: d / 2 + 0.35, width: 0.4, depth: 0.4 },
  ]);
}

/** The morning's picking: plastic crates stacked on a pallet, the top ones full of tomatoes, two more on the ground. */
export function buildFieldCrates(): Group {
  const g = new Group();
  g.name = "prop_field-crates";
  const [cw, cd, ch] = [0.6, 0.4, 0.26];
  // The pallet: three runners and the boards across them.
  for (const z of [-0.5, 0, 0.5]) box(g, 1.2, 0.1, 0.1, 0, 0, z, "darkWood");
  box(g, 1.2, 0.03, 1.1, 0, 0.1, 0, "wood");
  const crate = (x: number, y: number, z: number, colour: PaletteName, full: boolean): void => {
    box(g, cw, ch, cd, x, y, z, colour);
    quad(at(g, x, z + cd / 2 + 0.002), cw - 0.12, 0.06, 0, y + ch - 0.1, 0, "black");
    if (full) floorQuad(g, cw - 0.06, cd - 0.06, x, y + ch + 0.005, z, "tomato");
  };
  const colours: PaletteName[] = ["green", "black", "green", "basin"];
  for (const [i, x] of [-0.3, 0.3].entries()) {
    for (const [j, z] of [-0.25, 0.25].entries()) {
      const high = 3 + ((i + j) % 2);
      for (let k = 0; k < high; k += 1) crate(x, 0.13 + k * ch, z, colours[(i + j + k) % colours.length] ?? "green", k === high - 1);
    }
  }
  crate(1.0, 0, 0.3, "green", true);
  crate(1.05, 0, -0.2, "black", false);
  return setFootprint(g, [
    { x: 0, z: 0, width: 1.2, depth: 1.1 },
    { x: 1.02, z: 0.05, width: 0.7, depth: 0.95 },
  ]);
}

/** The water tap: a galvanised pipe along the ground rising to a tap on a stake, a bucket under it and the wet ground. */
export function buildWaterTap(): Group {
  const g = new Group();
  g.name = "prop_water-tap";
  // The wet patch under the tap, then the pipe along the ground and up its stake.
  floorQuad(g, 1.0, 0.8, 0, 0.015, 0.25, "drain");
  box(g, 1.8, 0.05, 0.05, -0.9, 0, -0.05, "hub");
  box(g, 0.08, 1.0, 0.08, 0, 0, -0.14, "wood");
  box(g, 0.05, 0.92, 0.05, 0, 0, -0.05, "hub");
  box(g, 0.05, 0.05, 0.16, 0, 0.88, 0.03, "hub");
  box(g, 0.04, 0.12, 0.04, 0, 0.78, 0.1, "hub");
  box(g, 0.14, 0.03, 0.03, 0, 0.94, 0.03, "red");
  // The bucket under it, a cup on the stake's top.
  cylinder(g, 0.15, 0.3, 0, 0, 0.18, "basin", 8, 0.18);
  cylinder(g, 0.04, 0.09, 0.0, 1.0, -0.14, "white", 6);
  return setFootprint(g, [{ x: 0, z: 0.05, width: 0.45, depth: 0.55 }]);
}

/** A broad tree at the field's edge to stand under: a short trunk and a round crown, its shade the place to rest. */
export function buildShadeTree(): Group {
  const g = new Group();
  g.name = "prop_shade-tree";
  cylinder(g, 0.22, 0.3, 0, 0, 0, "darkWood", 7);
  beam(g, [0, 0.25, 0], [0.1, 1.8, 0.05], 0.36, "darkWood");
  beam(g, [0.1, 1.6, 0.05], [-0.9, 2.8, 0.3], 0.18, "darkWood");
  beam(g, [0.1, 1.7, 0.05], [1.0, 2.9, -0.3], 0.18, "darkWood");
  lump(g, 1.9, 0.0, 3.4, 0.0, "pepper", [1.25, 0.75, 1.2]);
  lump(g, 1.2, -1.2, 3.0, 0.5, "green", [1.1, 0.8, 1.0]);
  lump(g, 1.2, 1.3, 3.1, -0.4, "green", [1.1, 0.8, 1.0]);
  lump(g, 1.0, 0.3, 4.3, 0.2, "roofGreen", [1.2, 0.7, 1.2]);
  return setFootprint(g, [{ x: 0.05, z: 0.02, width: 0.5, depth: 0.5 }]);
}
