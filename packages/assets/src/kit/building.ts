// An ordinary building is data (assets:buildings-assembled-from-kit): a BuildingSpec given to the kit. The same
// spec builds the same building every time, because every choice the spec leaves open
// is drawn from its clutter seed (assets:buildings-carry-wear-and-clutter, assets:neighbours-never-identical). Signs are anchors with
// text keys, never letters in the mesh (assets:sign-text-drawn-in-code), so the body bakes to one material.
import { Group } from "three";

import { type FootprintBox, lowBox, setFootprint } from "../footprint";
import type { PaletteName } from "../palette";
import type { SignStyle } from "../sign";
import type { BuildingSpec } from "../types";
import {
  acUnit,
  awning,
  CLUTTER_PLAN,
  type ClutterKind,
  balcony,
  barredWindow,
  clutter,
  dish,
  door,
  drain,
  fenceWall,
  gableRoof,
  gate,
  generator,
  hipRoof,
  KIT_SIZES,
  louvreWindow,
  meterAndCable,
  onWall,
  parapet,
  posters,
  roofPitch,
  shopOpening,
  signboard,
  slabBand,
  stain,
  stairFlight,
  tank,
  wornShade,
} from "./parts";
import { box, pick, quad, seeded } from "./shapes";

/** The yaw every dish faces in a model's own frame when the place does not say (assets:dishes-face-one-satellite). */
export const DEFAULT_DISH_YAW = 0.6;

export interface BuildingOptions {
  /** The place's dish direction in this building's frame, so every dish in the place faces one way. */
  dishYaw?: number;
  /** A style per sign, in the order of `spec.signs`. Drawn from the seed when absent. */
  signStyles?: SignStyle[];
}

/** The clutter a building carries, recorded on the model for the tests and the reviewer (assets:buildings-carry-wear-and-clutter). */
export type ClutterItem = "tank" | "dish" | "generator" | "bars" | "stains" | "notice" | "wires";

/** The step a building stands on. A four-storey building stands on the ground, so its parapet stays inside 13 m. */
const STEP = 0.3;
/** The tallest an ordinary building may be (assets.md, the bld_ budget). */
export const BUILDING_HEIGHT_MAX = 13;
const PAVEMENT = 1.2;
const SIGN_STYLES: SignStyle[] = [
  { board: "danfoYellow", ink: "red", painted: true },
  { board: "blue", ink: "white" },
  { board: "white", ink: "blue", border: "blue" },
  { board: "green", ink: "danfoYellow", painted: true },
  { board: "black", ink: "danfoYellow" },
  { board: "white", ink: "green", border: "green" },
  { board: "red", ink: "white" },
];
const BAY_WALLS: PaletteName[] = ["wallCream", "wallSky", "wallPeach", "wallMint", "white"];
const SHEETS: PaletteName[] = ["zinc", "zincRust", "roofRed", "roofBlue", "roofGreen"];
const AWNINGS: PaletteName[] = ["roofRed", "roofBlue", "roofGreen", "zinc", "red", "blue"];
const GATES: PaletteName[] = ["green", "black", "blue", "zinc"];
const TANKS: PaletteName[] = ["black", "blue", "basin"];

/** Evenly spaced x positions for n openings across a wall w wide. */
function spread(n: number, w: number): number[] {
  return Array.from({ length: n }, (_, i) => -w / 2 + ((i + 0.5) * w) / n);
}

export function buildBuilding(spec: BuildingSpec, options: BuildingOptions = {}): Group {
  const root = new Group();
  root.name = "building";
  const PLINTH = spec.storeys >= 4 ? 0 : STEP;
  const random = seeded(spec.clutterSeed);
  const [w, d] = spec.footprint;
  const wall = spec.wall;
  const worn = wornShade(wall);
  const dishYaw = options.dishYaw ?? DEFAULT_DISH_YAW;
  const shops = spec.signs.length;
  const items = new Set<ClutterItem>();
  const front = d / 2;
  // The ground the building blocks (assets:models-record-their-footprint), kept as each part is placed: the awnings, the
  // balconies and the step out front are left out, as people walk under the first and on the last.
  const blocks: FootprintBox[] = [{ x: 0, z: 0, width: w, depth: d }];
  const block = (x: number, z: number, width: number, depth: number): void => {
    blocks.push({ x, z, width, depth });
  };
  const leftOut = (kind: ClutterKind, x: number, z: number): void => {
    const [width, depth, dx, dz] = CLUTTER_PLAN[kind];
    block(x + dx, z + dz, width, depth);
  };

  if (shops > 0) {
    const bay = w / shops;
    if (bay < KIT_SIZES.bay.widthMin || bay > KIT_SIZES.bay.widthMax) {
      throw new Error(`buildBuilding: ${String(shops)} shop bays across ${String(w)} m are ${bay.toFixed(2)} m each, outside 3.0 to 4.0`);
    }
  }

  // The frontage: a raised step the building stands on, running out to the drain.
  if (PLINTH > 0) box(root, w + 0.4, PLINTH, d + 0.2 + PAVEMENT, 0, 0, PAVEMENT / 2, "concrete");

  // Storeys.
  const groundH = shops > 0 ? KIT_SIZES.shopStorey : KIT_SIZES.storey;
  const floors: number[] = [PLINTH];
  for (let i = 1; i < spec.storeys; i++) floors.push(PLINTH + groundH + (i - 1) * KIT_SIZES.storey);
  const top = PLINTH + groundH + (spec.storeys - 1) * KIT_SIZES.storey;
  if (top + (spec.roof === "flat" ? KIT_SIZES.parapet.height : 0) > BUILDING_HEIGHT_MAX + 1e-9) {
    throw new Error(`buildBuilding: ${String(spec.storeys)} storeys${shops > 0 ? " over shops" : ""} rise past ${String(BUILDING_HEIGHT_MAX)} m`);
  }
  box(root, w, top - PLINTH, d, 0, PLINTH, 0, wall);
  for (const y of floors.slice(1)) slabBand(root, w, d, 0, y - KIT_SIZES.slab, 0);

  const face = onWall(root, 0, 0, front);
  const back = onWall(root, 0, 0, -front, Math.PI);

  // The ground floor: shop bays with their boards, or a door and barred windows.
  if (shops > 0) {
    const bay = w / shops;
    spread(shops, w).forEach((bx, i) => {
      const colour = i === 0 ? wall : pick(random, BAY_WALLS);
      quad(face, bay - 0.06, groundH - 0.1, bx, PLINTH, 0.005, colour);
      const open = random() > 0.25;
      shopOpening(face, bx, PLINTH, bay - 0.6, open, random);
      const style = options.signStyles?.[i] ?? pick(random, SIGN_STYLES);
      const boardH = 0.675;
      signboard(root, face, spec.signs[i] ?? "", style, bx, PLINTH + KIT_SIZES.bay.opening + KIT_SIZES.bay.shutterBox + 0.04, bay - 0.24, boardH);
      if (random() < 0.7) awning(face, bx, PLINTH + KIT_SIZES.bay.opening + KIT_SIZES.bay.shutterBox - 0.02, bay - 0.5, 1.2, 8, pick(random, AWNINGS));
    });
    for (let i = 1; i < shops; i++) quad(face, 0.14, groundH - 0.1, -w / 2 + (i * w) / shops, PLINTH, 0.012, "concreteWorn");
  } else {
    const xs = spread(Math.max(2, Math.floor(w / 2.6)), w);
    xs.forEach((x, i) => {
      if (i === 0) door(face, x, PLINTH, w > 8);
      else barredWindow(face, x, PLINTH);
    });
    items.add("bars");
  }
  for (const x of spread(Math.max(1, Math.floor(w / 5)), w)) barredWindow(back, x, PLINTH);
  if (spec.storeys === 1 && shops > 0) items.add("bars");

  // Upper floors: louvre windows, balconies with a door, AC units hung between windows.
  const windows = spread(Math.max(1, Math.floor(w / 3.0)), w);
  floors.slice(1).forEach((y, k) => {
    const hasBalcony = k < spec.balconies;
    windows.forEach((x) => louvreWindow(face, x, y));
    if (hasBalcony) {
      const bw = Math.min(w - 1.0, Math.max(3.0, w * 0.6));
      door(face, 0, y, true);
      balcony(face, 0, y, bw, KIT_SIZES.balcony.depthMin + Math.round(random() * 3) * 0.1, random() < 0.5 ? wall : "concrete", random() < 0.4);
    }
    const gaps = windows.slice(1).map((x, i) => (x + (windows[i] ?? x)) / 2).filter((x) => !hasBalcony || Math.abs(x) > 0.9);
    if (gaps.length > 0 && random() < 0.75) acUnit(face, pick(random, gaps), y + 1.5);
    if (k === 0 && windows.length > 1) louvreWindow(back, windows[0] ?? 0, y);
  });

  // A dish on the wall that faces the satellite most nearly, high up near a corner (assets:dishes-face-one-satellite).
  const wallDish = (): void => {
    const walls = [
      { ry: 0, x: 0, z: front, along: w },
      { ry: Math.PI / 2, x: w / 2, z: 0, along: d },
      { ry: Math.PI, x: 0, z: -front, along: w },
      { ry: -Math.PI / 2, x: -w / 2, z: 0, along: d },
    ];
    const off = (ry: number): number => Math.abs(Math.atan2(Math.sin(dishYaw - ry), Math.cos(dishYaw - ry)));
    const best = walls.reduce((a, b) => (off(b.ry) < off(a.ry) ? b : a));
    dish(root, onWall(root, best.x, 0, best.z, best.ry), best.along / 2 - 0.6, top - 0.9, 0.3, dishYaw - best.ry);
  };

  // The roof.
  let roofTop: number;
  if (spec.roof === "flat") {
    parapet(root, w, d, 0, top, 0, wall);
    roofTop = top + KIT_SIZES.parapet.height;
    const room = BUILDING_HEIGHT_MAX - top;
    // Tanks and the stair head go on the roof only where they stay under the height limit; otherwise the tank stands behind.
    if (room >= KIT_SIZES.tank.largeHigh) {
      tank(root, -w / 2 + 1.0, top, -d / 2 + 1.0, true, 0, pick(random, TANKS));
      if (w > 7) tank(root, -w / 2 + 2.6, top, -d / 2 + 1.0, false, 0, pick(random, TANKS));
    } else {
      tank(root, w / 2 - 1.0, 0, -d / 2 - 0.9, true, KIT_SIZES.tank.standMax, pick(random, TANKS));
      block(w / 2 - 1.0, -d / 2 - 0.9, KIT_SIZES.tank.largeAcross + 0.1, KIT_SIZES.tank.largeAcross + 0.1);
    }
    if (room >= 2.1) box(root, 2.0, 2.1, 2.2, w / 2 - 1.4, top, -d / 2 + 1.4, wall);
    if (room >= 1.4) dish(root, root, w / 2 - 0.5, top, 0, dishYaw);
    else wallDish();
    items.add("tank").add("dish");
  } else {
    const sheet = pick(random, SHEETS);
    const pitch = roofPitch(random);
    roofTop = spec.roof === "gable" ? gableRoof(root, w, d, 0, top, 0, sheet, wall, pitch, random) : hipRoof(root, w, d, 0, top, 0, sheet, pitch);
    const stand = Math.min(KIT_SIZES.tank.standMax, Math.max(KIT_SIZES.tank.standMin, roofTop - 0.6));
    tank(root, w / 2 - 1.0, 0, -d / 2 - 0.9, false, stand, pick(random, TANKS));
    block(w / 2 - 1.0, -d / 2 - 0.9, KIT_SIZES.tank.smallAcross + 0.1, KIT_SIZES.tank.smallAcross + 0.1);
    wallDish();
    items.add("tank").add("dish");
  }

  // Outside stairs to the first floor, on the left side wall.
  if (spec.stairs !== "none" && spec.storeys > 1) {
    // The flights in a group of their own, so the ground they stand on is read off them.
    const flights = new Group();
    root.add(flights);
    const height = groundH;
    const risers = Math.ceil(height / KIT_SIZES.stairs.rise);
    const rise = height / risers;
    const first = Math.min(KIT_SIZES.stairs.maxRisers, Math.ceil(risers / 2));
    const second = risers - first;
    const width = 1.1;
    const run1 = first * KIT_SIZES.stairs.going;
    const run2 = second * KIT_SIZES.stairs.going;
    const sideFits = d + 0.6 >= run1 + run2 + 2.6;
    if (spec.stairs === "side" && sideFits) {
      const sx = -w / 2 - width / 2 - 0.05;
      const z0 = front + 0.6;
      stairFlight(flights, sx, PLINTH, z0, first, rise, width, Math.PI / 2, "concrete");
      box(flights, width, 0.2, 1.0, sx, PLINTH + first * rise - 0.2, z0 - run1 - 0.5, "concrete");
      stairFlight(flights, sx, PLINTH + first * rise, z0 - run1 - 1.0, second, rise, width, Math.PI / 2, "concrete");
      const landing = z0 - run1 - 1.0 - run2 - 0.6;
      box(flights, width, 0.2, 1.2, sx, PLINTH + height - 0.2, landing, "concrete");
      for (const sz of [landing - 0.55, z0 - run1 - 0.5]) box(flights, 0.2, PLINTH + height - 0.2, 0.2, sx - width / 2 + 0.1, 0, sz, "concrete");
      door(onWall(root, -w / 2, 0, landing, -Math.PI / 2), 0, PLINTH + height, false);
    } else {
      const z0 = front + 0.6;
      stairFlight(flights, -w / 2 + 0.2, PLINTH, z0, first, rise, width, 0, "concrete");
      stairFlight(flights, -w / 2 + 0.2 + run1 + 1.0, PLINTH + first * rise, z0, second, rise, width, 0, "concrete");
    }
    blocks.push(lowBox(flights, Infinity));
  }

  // The gate and its fence wall, on the right; a small generator by the gate.
  let gateX = w / 2;
  if (spec.gate) {
    const gw = KIT_SIZES.gate.widthMin + Math.round(random() * 3) * 0.2;
    const gh = KIT_SIZES.gate.heightMin + Math.round(random() * 3) * 0.1;
    const fence = onWall(root, 0, 0, front);
    gateX = w / 2 + 0.45 + gw / 2;
    gate(fence, gateX, 0, gw, gh, pick(random, GATES));
    fenceWall(onWall(root, w / 2 + 0.6 + gw + 0.15, 0, 0, Math.PI / 2), -front, front, 0, wall);
    generator(root, gateX + gw / 2 - 0.2, 0, front + 0.6, false, 0.3, pick(random, ["red", "danfoYellow", "blue"] as PaletteName[]));
    block(gateX, front, gw + 0.9, 0.3);
    block(w / 2 + 0.6 + gw + 0.15, 0, 0.3, d);
    block(gateX + gw / 2 - 0.2, front + 0.6, 0.7, 0.6);
    items.add("generator");
  } else if (shops > 1) {
    generator(root, w / 2 + 1.4, 0, 0, true, Math.PI / 2, "gold");
    block(w / 2 + 1.4, 0, KIT_SIZES.generator.large[2], KIT_SIZES.generator.large[0]);
    items.add("generator");
  } else if (random() < 0.6) {
    generator(root, w / 2 - 0.8, PLINTH, front + 0.5, false, 0.2, "red");
    block(w / 2 - 0.8, front + 0.5, 0.7, 0.6);
    items.add("generator");
  }

  // Wear (assets:buildings-carry-wear-and-clutter): a worn band on the lower walls, damp under the roof edge, streaks under the windows.
  const band = 0.35 + 0.25 * spec.wear;
  for (const wf of [face, back]) stain(wf, 0, PLINTH, w, band, worn);
  for (const [sx, ry] of [[-w / 2, -Math.PI / 2], [w / 2, Math.PI / 2]] as const) stain(onWall(root, sx, 0, 0, ry), 0, PLINTH, d, band, worn);
  if (spec.wear > 0) {
    stain(face, 0, top - 0.3, w, 0.3, worn);
    // Streaks run down from the sills of the upper windows, or from the eaves of a single storey's side walls.
    const sides = [onWall(root, -w / 2, 0, 0, -Math.PI / 2), onWall(root, w / 2, 0, 0, Math.PI / 2)];
    for (let i = 0; i < spec.wear; i++) {
      const h = 1.2 + random();
      if (spec.storeys > 1) {
        const y = pick(random, floors.slice(1)) + KIT_SIZES.window.sill - 0.1;
        stain(face, pick(random, windows) + (random() - 0.5) * 0.4, y - h, 0.25 + random() * 0.2, h, worn);
      } else {
        stain(sides[i % 2] ?? face, (random() - 0.5) * (d - 1), top - 0.3 - h, 0.3 + random() * 0.3, h, worn);
      }
    }
    items.add("stains");
  }

  // A notice and posters on a side wall, at eye height.
  const left = onWall(root, -w / 2, 0, 0, -Math.PI / 2);
  posters(left, -d / 2 + 0.6, PLINTH + 1.1, random, 2);
  items.add("notice");

  // The meter and the service cable up the front wall: wires that end where they should, at the roof edge.
  if (random() < 0.8) {
    meterAndCable(face, w / 2 - 0.35, PLINTH, top - 0.15);
    items.add("wires");
  }

  // The street edge: an open drain with slabs where people cross, and something left out front.
  const slabs = shops > 0 ? spread(shops, w) : [spread(Math.max(2, Math.floor(w / 2.6)), w)[0] ?? 0];
  if (spec.gate) slabs.push(gateX);
  drain(root, -w / 2 - 0.2, Math.max(w / 2 + 0.2, spec.gate ? gateX + 2.0 : 0), front + PAVEMENT + 0.35, PLINTH, slabs);
  const kinds = ["crates", "bench", "cooler", "sacks", "jerrycans", "drum"] as const;
  const near = pick(random, kinds);
  clutter(root, near, -w / 2 + 0.6, PLINTH, front + 0.6);
  leftOut(near, -w / 2 + 0.6, front + 0.6);
  if (shops > 0) {
    const far = pick(random, kinds);
    clutter(root, far, w / 2 - 1.2, PLINTH, front + 0.7);
    leftOut(far, w / 2 - 1.2, front + 0.7);
  }

  setFootprint(root, blocks);
  root.userData.clutter = [...items];
  root.userData.top = roofTop;
  return root;
}
