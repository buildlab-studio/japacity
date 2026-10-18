// The roundabout at Castel Volturno (docs/design/11-the-three-countries-on-the-mold.md section 3; city.md
// place.castel-volturno): the town's hub, where the vans come at dawn. Low blocks of pastel plaster over shops, the
// bar with its awning and its coffee counter at the door, the African shop and the call shop with their boards
// (assets:sign-text-drawn-in-code), the roundabout's island at the road's end with its direction sign, the bus stop's pole and low
// palms. Each piece stands on its base at y = 0 facing +Z (assets:metre-units-and-origin), records the ground it blocks
// (assets:models-record-their-footprint) and shows no real shop's name, mark or colours (assets:no-real-brands-on-assets). The plaster row is also the
// Domitiana's low block, as data (assets:variants-are-numbers-not-code).
import { type PaletteName, setFootprint, type SignStyle } from "@japacity/assets";
import { acUnit, awning, balcony, beam, box, cylinder, dish, door, floorQuad, meterAndCable, onWall, parapet, posters, quad, seeded, shopOpening, signboard, solid, stain, tank, wornShade } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

import { at } from "../../prop/parts";

// ---------------------------------------------------------------------------
// The plaster row: a low block of shops with a floor of flats over them
// ---------------------------------------------------------------------------

/** What one unit of the row's ground floor is. */
export type RowUnitKind = "bar" | "shop" | "barber" | "shutter" | "door";

export interface RowUnit {
  kind: RowUnitKind;
  /** The unit's frontage in metres. */
  width: number;
  /** The awning's colour over the unit, when it has one. */
  awning?: PaletteName;
}

export interface PlasterRowSpec {
  name: string;
  storeys: 1 | 2;
  depth: number;
  /** The plaster's pastel; its worn shade is the wall's wear (assets:buildings-carry-wear-and-clutter). */
  wall: PaletteName;
  /** The window surrounds, the cornice and the parapet's coping. */
  trim: PaletteName;
  /** The flats' window shutters. */
  shutters: PaletteName;
  units: RowUnit[];
  /** One text key a board, in unit order: every bar, shop and barber has a board over it. */
  signs: string[];
  styles: SignStyle[];
  /** The units with a balcony over them. */
  balconies: number[];
  seed: number;
}

export const ROW = { shop: 3.6, storey: 3.0, board: 0.6 } as const;

/** Whether a unit carries a board over its front. */
export function hasBoard(kind: RowUnitKind): boolean {
  return kind === "bar" || kind === "shop" || kind === "barber";
}

/** An upper window with its surround, the glass and two shutter leaves folded open either side. */
function shutteredWindow(w: Object3D, x: number, floorY: number, trim: PaletteName, shutters: PaletteName, open: boolean): void {
  const y = floorY + 0.85;
  quad(w, 1.24, 1.54, x, y - 0.07, 0.004, trim);
  quad(w, 1.0, 1.4, x, y, 0.008, "glass");
  quad(w, 1.2, 0.06, x, y - 0.1, 0.03, trim);
  if (open) {
    for (const s of [-1, 1]) {
      quad(w, 0.5, 1.4, x + s * 0.88, y, 0.012, shutters);
      for (const dy of [0.35, 0.7, 1.05]) quad(w, 0.44, 0.03, x + s * 0.88, y + dy, 0.016, wornShade(shutters));
    }
    return;
  }
  // Shut against the afternoon: the two leaves meet over the glass.
  quad(w, 1.0, 1.4, x, y, 0.012, shutters);
  quad(w, 0.03, 1.4, x, y, 0.016, wornShade(shutters));
}

/** A barber's pole on its bracket, the stripes as bands. */
function barberPole(w: Object3D, x: number, y: number): void {
  box(w, 0.08, 0.08, 0.2, x, y + 0.9, 0.1, "hub");
  const pole = at(w, x, 0.24, 0, y);
  cylinder(pole, 0.07, 0.12, 0, 0, 0, "hub", 6);
  for (let k = 0; k < 4; k += 1) cylinder(pole, 0.06, 0.16, 0, 0.12 + k * 0.16, 0, (["red", "white", "blue", "white"] as const)[k] ?? "white", 6);
  cylinder(pole, 0.07, 0.1, 0, 0.76, 0, "hub", 6);
}

/** The row of plaster shops, built from its numbers: units side by side along x, the front at +z. */
export function buildPlasterRow(spec: PlasterRowSpec, dishYaw: number): Group {
  const g = new Group();
  g.name = spec.name;
  const random = seeded(spec.seed);
  const { shop, storey, board } = ROW;
  const w = spec.units.reduce((sum, unit) => sum + unit.width, 0);
  const d = spec.depth;
  const top = shop + (spec.storeys - 1) * storey;
  const worn = wornShade(spec.wall);
  box(g, w, top, d, 0, 0, 0, spec.wall);
  // A slab band between the shops and the flats, the cornice under the parapet, the parapet round the flat roof.
  if (spec.storeys > 1) box(g, w + 0.06, 0.16, d + 0.06, 0, shop - 0.08, 0, spec.trim);
  box(g, w + 0.16, 0.2, d + 0.16, 0, top - 0.04, 0, spec.trim);
  parapet(g, w, d, 0, top, 0, spec.wall);
  const face = onWall(g, 0, 0, d / 2 + 0.005);
  // The plinth where the street's dust and the rain splash the plaster.
  quad(face, w, 0.55, 0, 0, 0.002, worn);

  let left = -w / 2;
  let sign = 0;
  spec.units.forEach((unit, index) => {
    const x = left + unit.width / 2;
    left += unit.width;
    const inner = unit.width - 0.6;
    if (index > 0) quad(face, 0.3, top - 0.6, x - unit.width / 2, 0.55, 0.003, spec.trim);
    switch (unit.kind) {
      case "bar": {
        // A glazed front with its door in the middle, the counter's shelf of bottles behind the glass.
        quad(face, inner, 2.62, x, 0.0, 0.006, "charcoal");
        quad(face, inner - 0.16, 2.46, x, 0.08, 0.01, "glass");
        quad(face, 1.0, 2.2, x, 0.08, 0.014, "darkWood");
        quad(face, 0.84, 1.9, x, 0.2, 0.018, "glass");
        for (const s of [-1, 1]) {
          quad(face, (inner - 1.4) / 2, 0.05, x + s * (inner / 4 + 0.3), 1.4, 0.014, "wood");
          for (let k = 0; k < 4; k += 1) quad(face, 0.08, 0.26, x + s * (0.8 + k * 0.2), 1.45, 0.016, (["green", "danfoYellow", "red", "white"] as const)[k] ?? "green");
        }
        break;
      }
      case "shop":
        shopOpening(face, x, 0, inner, true, random);
        break;
      case "barber":
        // The barber's glass door and its window, and the pole on the pier beside the door.
        quad(face, inner, 2.5, x, 0, 0.006, "charcoal");
        quad(face, inner - 1.3, 2.0, x - 0.55, 0.4, 0.01, "glass");
        quad(face, 0.9, 2.2, x + inner / 2 - 0.55, 0.02, 0.01, "glass");
        quad(face, 0.04, 2.2, x + inner / 2 - 0.55, 0.02, 0.014, "black");
        quad(face, inner - 1.3, 0.12, x - 0.55, 1.4, 0.014, "white");
        barberPole(face, x + unit.width / 2 - 0.15, 1.2);
        break;
      case "shutter":
        // A unit let go: its shutter down, bills pasted over it, rust along the foot.
        shopOpening(face, x, 0, inner, false, random);
        posters(face, x - 0.7, 1.1, random, 3);
        stain(face, x, 0.0, inner, 0.3, "zincRust");
        break;
      case "door":
        door(face, x, 0, false, spec.shutters);
        box(face, 0.18, 0.3, 0.05, x + 0.75, 1.3, 0.02, "hub");
        break;
      default: {
        const never: never = unit.kind;
        throw new Error(`plaster row: no unit ${String(never)}`);
      }
    }
    if (unit.awning !== undefined) awning(face, x, 2.78, inner + 0.2, 1.3, 8, unit.awning);
    if (hasBoard(unit.kind)) {
      signboard(g, face, spec.signs[sign] ?? "", spec.styles[sign % spec.styles.length] ?? { board: "white", ink: "black" }, x, 2.84, inner, board);
      sign += 1;
    }
    // The flats over the shops: a shuttered window or two a unit, a balcony on some.
    for (let floor = 1; floor < spec.storeys; floor += 1) {
      const floorY = shop + (floor - 1) * storey;
      const windows = unit.width >= 4 ? [-unit.width / 4 - 0.1, unit.width / 4 + 0.1] : [0];
      windows.forEach((dx, k) => shutteredWindow(face, x + dx, floorY, spec.trim, spec.shutters, random() < 0.7 || k === 0));
      if (spec.balconies.includes(index)) balcony(face, x, floorY, Math.min(unit.width - 0.6, 3.2), 1.2, spec.trim, true);
      else if (random() < 0.6) acUnit(face, x + (windows.length > 1 ? 0 : unit.width / 2 - 0.6), floorY + 1.8);
      if (random() < 0.7) stain(face, x + (random() - 0.5) * (unit.width - 1), floorY + 0.2, 0.3, 0.9, worn);
    }
  });
  // Damp under the cornice, the meter and its cable up the front, a water tank and the dish on the roof.
  stain(face, 0, top - 0.55, w, 0.35, worn);
  meterAndCable(face, w / 2 - 0.35, 0, top);
  tank(g, -w / 2 + 1.2, top, -d / 2 + 1.4, false, 0, "white");
  dish(g, g, w / 2 - 1.4, top, -d / 2 + 1.2, dishYaw);
  // The back: a window a floor at each end.
  const back = onWall(g, 0, 0, -d / 2 - 0.005, Math.PI);
  for (let floor = 0; floor < spec.storeys; floor += 1) for (const x of [-w / 3, w / 3]) quad(back, 1.0, 1.2, x, 1.0 + floor * storey, 0.002, "glass");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

// ---------------------------------------------------------------------------
// The things on the roundabout's frontage
// ---------------------------------------------------------------------------

export const ISLAND = { radius: 3.4, kerb: 0.16 } as const;

/**
 * The roundabout's island at the road's end: a round kerb with dry grass inside, a planter at its heart, a blue
 * direction sign facing the road (its words a text key) and a give way triangle. The palms on it are their own model.
 */
export function buildRoundabout(signKey: string, style: SignStyle): Group {
  const g = new Group();
  g.name = "prop_roundabout";
  const { radius: r, kerb } = ISLAND;
  cylinder(g, r, kerb, 0, 0, 0, "concrete", 18);
  cylinder(g, r - 0.22, 0.03, 0, kerb, 0, "pepper", 18);
  // The kerb painted in bands where the cars brush it.
  for (let k = 0; k < 9; k += 1) {
    const a = (k / 9) * Math.PI * 2;
    box(g, 0.6, 0.012, 0.24, Math.sin(a) * (r - 0.1), kerb, Math.cos(a) * (r - 0.1), "white", a + Math.PI / 2);
  }
  // A low planter of plaster in the middle.
  cylinder(g, 0.9, 0.5, 0, kerb, 0, "wallCream", 10);
  cylinder(g, 0.8, 0.06, 0, kerb + 0.5, 0, "laterite", 10);
  // The direction sign on two posts at the island's road edge, facing the way in.
  const sign = at(g, 0.6, r - 0.5);
  for (const s of [-1, 1]) box(sign, 0.07, 2.6, 0.07, s * 0.75, kerb, 0, "hub");
  box(sign, 1.8, 1.0, 0.1, 0, kerb + 1.6, 0, style.board);
  signboard(g, sign, signKey, style, 0, kerb + 1.62, 1.7, 0.92);
  // The give way triangle, its point down, on its own post.
  const yieldSign = at(g, -1.5, r - 0.4);
  box(yieldSign, 0.06, 1.7, 0.06, 0, kerb, 0, "hub");
  solid(yieldSign, [[-0.4, kerb + 2.3, 0.04], [0.4, kerb + 2.3, 0.04], [0, kerb + 1.6, 0.04], [-0.4, kerb + 2.3, 0.0], [0.4, kerb + 2.3, 0.0], [0, kerb + 1.6, 0.0]], [[0, 2, 1], [3, 4, 5]], "red");
  solid(yieldSign, [[-0.28, kerb + 2.23, 0.045], [0.28, kerb + 2.23, 0.045], [0, kerb + 1.75, 0.045]], [[0, 2, 1]], "white");
  // The island's ground blocked as a cross of two boxes round the circle.
  return setFootprint(g, [
    { x: 0, z: 0, width: r * 2, depth: r * 1.2 },
    { x: 0, z: 0, width: r * 1.2, depth: r * 2 },
  ]);
}

/** The bar's counter out at its door: a narrow wooden counter with cups and saucers on it, two high stools, the chalkboard. */
export function buildBarCounter(): Group {
  const g = new Group();
  g.name = "prop_bar-counter";
  const w = 1.5;
  const d = 0.45;
  const h = 1.08;
  box(g, w, h - 0.05, d, 0, 0, 0, "darkWood");
  box(g, w + 0.1, 0.05, d + 0.1, 0, h - 0.05, 0, "wood");
  quad(at(g, 0, d / 2 + 0.002), w - 0.1, 0.12, 0, 0.12, 0, "black");
  // Cups on their saucers, the sugar and a napkin box.
  for (const [x, z] of [[-0.5, 0.06], [-0.2, -0.04], [0.35, 0.05]] as const) {
    cylinder(g, 0.06, 0.01, x, h, z, "white", 8);
    cylinder(g, 0.035, 0.06, x, h + 0.01, z, "white", 6);
  }
  cylinder(g, 0.05, 0.12, 0.62, h, -0.05, "hub", 6);
  box(g, 0.12, 0.08, 0.1, 0.05, h, -0.08, "white");
  // Two high stools before it.
  for (const x of [-0.45, 0.45]) {
    cylinder(g, 0.04, 0.72, x, 0, 0.55, "hub", 6);
    cylinder(g, 0.2, 0.03, x, 0, 0.55, "hub", 8);
    cylinder(g, 0.18, 0.05, x, 0.72, 0.55, "charcoal", 8);
  }
  // The chalkboard: an A-frame with a few lines of chalk and no words.
  const board = at(g, w / 2 + 0.55, 0.2, -0.3);
  const leaf = at(board, 0, 0.12);
  leaf.rotation.x = -0.18;
  box(leaf, 0.6, 0.9, 0.04, 0, 0, 0, "darkWood");
  quad(leaf, 0.5, 0.7, 0, 0.1, 0.021, "canvas");
  for (let k = 0; k < 4; k += 1) quad(leaf, 0.3 + (k % 2) * 0.1, 0.03, 0, 0.62 - k * 0.14, 0.024, "white");
  const back = at(board, 0, -0.12);
  back.rotation.x = 0.18;
  box(back, 0.6, 0.9, 0.04, 0, 0, 0, "darkWood");
  return setFootprint(g, [
    { x: 0, z: 0, width: w + 0.1, depth: d + 0.1 },
    { x: w / 2 + 0.55, z: 0.2, width: 0.7, depth: 0.5 },
  ]);
}

/** A low palm: a short scaled trunk and a crown of drooping fronds, each frond two pieces bent at the middle. */
export function buildPalm(): Group {
  const g = new Group();
  g.name = "prop_palm";
  const trunk = 2.2;
  cylinder(g, 0.3, 0.3, 0, 0, 0, "darkWood", 7, 0.26);
  cylinder(g, 0.26, trunk - 0.3, 0, 0.3, 0, "wood", 7, 0.2);
  // The old frond bases round the top of the trunk.
  cylinder(g, 0.3, 0.35, 0, trunk - 0.1, 0, "darkWood", 7, 0.22);
  const fronds = 9;
  for (let k = 0; k < fronds; k += 1) {
    // Each frond drawn in a frame turned to its own heading, so its blades lie flat across it.
    const frond = at(g, 0, 0, (k / fronds) * Math.PI * 2);
    const reach = 1.5 + (k % 3) * 0.25;
    const lift = (k % 2) * 0.15;
    const colour = k % 2 === 0 ? "pepper" : "green";
    const base: [number, number, number] = [0, trunk + 0.2, 0.15];
    const mid: [number, number, number] = [0, trunk + 0.75 + lift, reach * 0.55];
    const tip: [number, number, number] = [0, trunk + 0.15 + lift, reach];
    for (const [from, to] of [[base, mid], [mid, tip]] as const) beam(frond, from, to, 0.06, colour).scale.set(5, 1, 0.6);
  }
  return setFootprint(g, [{ x: 0, z: 0, width: 0.6, depth: 0.6 }]);
}

/** The bus stop: a grey pole with the stop's board at the top (its words a text key), the timetable's case and a bin. */
export function buildBusPole(signKey: string, style: SignStyle): Group {
  const g = new Group();
  g.name = "prop_bus-pole";
  cylinder(g, 0.05, 3.0, 0, 0, 0, "hub", 8);
  box(g, 0.66, 0.5, 0.05, 0, 2.4, 0.06, style.board);
  signboard(g, at(g, 0, 0.03), signKey, style, 0, 2.43, 0.6, 0.44);
  // The timetable's case, its sheet white behind the glass.
  box(g, 0.4, 0.56, 0.06, 0, 1.25, 0.08, "hub");
  quad(at(g, 0, 0.112), 0.32, 0.46, 0, 1.3, 0, "white");
  for (let k = 0; k < 5; k += 1) quad(at(g, 0, 0.114), 0.24, 0.02, 0, 1.38 + k * 0.07, 0, "charcoal");
  // A small bin on the pole.
  cylinder(g, 0.16, 0.45, 0.24, 0.5, -0.04, "green", 8);
  floorQuad(g, 0.2, 0.2, 0.24, 0.951, -0.04, "black");
  return setFootprint(g, [{ x: 0.1, z: 0, width: 0.6, depth: 0.4 }]);
}
