// The things of London's places (docs/design/14-london-on-the-lagos-mold.md section 4; docs/rules/world.md
// R-WORLD-005, R-WORLD-039): what stands on Rye Lane and at the station, and what furnishes the big shop, the
// care home, the ward, the office, the warehouse and the church. Each is its own model so a label can stand
// over it, written from the kit's shapes, standing on its base at y = 0 and facing +Z (R-ASSET-003), its tops
// clear of each other by more than a centimetre where they overlap (R-WORLD-012), with the ground it blocks as
// its footprint (R-ASSET-030). No real shop's, operator's or company's colours, marks or words (R-ASSET-010).
import { type PaletteName, setFootprint, type SignStyle } from "@japacity/assets";
import { beam, box, cylinder, onWall, quad, signboard, solid } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

/** A group at (x, y, z) turned ry, to draw a part in its own frame. */
function at(g: Object3D, x: number, z: number, ry = 0, y = 0): Group {
  const frame = new Group();
  frame.position.set(x, y, z);
  frame.rotation.y = ry;
  g.add(frame);
  return frame;
}

/** Four square legs under a top of w by d at height h. */
function legs(g: Object3D, w: number, d: number, h: number, colour: PaletteName, thick = 0.05): void {
  const ix = w / 2 - thick;
  const iz = d / 2 - thick;
  for (const [x, z] of [[-ix, -iz], [ix, -iz], [-ix, iz], [ix, iz]] as const) box(g, thick, h, thick, x, 0, z, colour);
}

/** A plain chair facing +Z in its frame: seat at 0.45, a back. */
function chair(g: Object3D, colour: PaletteName = "charcoal", frame: PaletteName = "hub"): void {
  legs(g, 0.42, 0.42, 0.43, frame, 0.03);
  box(g, 0.44, 0.04, 0.44, 0, 0.43, 0, colour);
  box(g, 0.44, 0.44, 0.04, 0, 0.47, -0.2, colour);
}

/** A flat screen on its foot, facing +Z. */
function monitor(g: Object3D, x: number, y: number, z: number, ry = 0): void {
  const f = at(g, x, z, ry, y);
  box(f, 0.18, 0.02, 0.14, 0, 0, 0, "black");
  box(f, 0.04, 0.16, 0.04, 0, 0.02, -0.02, "black");
  box(f, 0.54, 0.34, 0.04, 0, 0.14, -0.02, "black");
  quad(f, 0.5, 0.3, 0, 0.16, 0.001, "glass");
}

/** A row of goods on a shelf: boxes of the given colours side by side along x. */
function goods(g: Object3D, x0: number, x1: number, y: number, z: number, depth: number, height: number, colours: readonly PaletteName[], seed: number): void {
  const count = Math.max(1, Math.round((x1 - x0) / 0.5));
  const each = (x1 - x0) / count;
  for (let i = 0; i < count; i += 1) {
    const colour = colours[(i * 7 + seed) % colours.length] ?? "white";
    const high = height * (0.7 + (((i * 5 + seed) % 4) * 0.1));
    box(g, each - 0.04, high, depth, x0 + each * (i + 0.5), y, z, colour);
  }
}

// ---------------------------------------------------------------------------
// Rye Lane
// ---------------------------------------------------------------------------

/** The Nigerian shop's produce out front: a trestle of crates with yams, plantain and peppers, and more crates under it. */
export function buildProduceStand(): Group {
  const g = new Group();
  g.name = "prop_produce-stand";
  const w = 2.2;
  const d = 0.8;
  legs(g, w, d, 0.72, "hub", 0.04);
  box(g, w, 0.04, d, 0, 0.72, 0, "wood");
  // Four crates on the top, each with its load.
  const loads: [PaletteName, PaletteName][] = [["tan", "darkWood"], ["green", "danfoYellow"], ["red", "tomato"], ["pepper", "green"]];
  loads.forEach(([one, two], i) => {
    const x = -w / 2 + 0.3 + i * 0.53;
    box(g, 0.48, 0.18, 0.62, x, 0.76, 0, "darkWood");
    box(g, 0.42, 0.1, 0.56, x, 0.94, 0, one);
    box(g, 0.18, 0.08, 0.2, x - 0.1, 1.04, -0.12, two);
    box(g, 0.16, 0.08, 0.18, x + 0.12, 1.04, 0.14, two);
  });
  // A tilted tray of plantain at the front edge.
  const tray = at(g, 0, d / 2 - 0.05, 0, 0.98);
  tray.rotation.x = 0.4;
  box(tray, 0.9, 0.03, 0.3, -0.5, 0, 0, "wood");
  box(tray, 0.8, 0.08, 0.22, -0.5, 0.03, 0, "danfoYellow");
  // Crates stacked under the trestle, and a sack of yam beside it.
  for (const x of [-0.6, 0.0, 0.6]) box(g, 0.5, 0.3, 0.5, x, 0.02, -0.05, "basin");
  box(g, 0.5, 0.3, 0.5, -0.3, 0.32, -0.05, "basin");
  box(g, 0.42, 0.55, 0.38, w / 2 + 0.3, 0, 0, "khaki");
  return setFootprint(g, [{ x: 0.15, z: 0, width: w + 0.6, depth: d }]);
}

/** A market stall on the lane: a pop-up canopy on four legs over a table of cloth, bags and shoes. */
export function buildGazeboStall(): Group {
  const g = new Group();
  g.name = "prop_gazebo-stall";
  const w = 2.8;
  const d = 2.4;
  const top = 2.25;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]] as const) box(g, 0.05, top, 0.05, x, 0, z, "hub");
  // The canopy: a low pyramid of four faces, white with blue edges hanging.
  const peak = top + 0.55;
  const c: [number, number, number][] = [[-w / 2, top, -d / 2], [w / 2, top, -d / 2], [w / 2, top, d / 2], [-w / 2, top, d / 2], [0, peak, 0]];
  solid(g, c, [[0, 4, 1], [1, 4, 2], [2, 4, 3], [3, 4, 0], [0, 1, 2, 3]], "white");
  for (const [x, z, ry, len] of [[0, d / 2, 0, w], [0, -d / 2, Math.PI, w], [w / 2, 0, Math.PI / 2, d], [-w / 2, 0, -Math.PI / 2, d]] as const) quad(at(g, x, z, ry), len, 0.22, 0, top - 0.22, 0.005, "blue");
  // The table at the front, a rail of hanging cloth at the back.
  const tw = 2.4;
  legs(at(g, 0, 0.55), tw, 0.8, 0.74, "hub", 0.04);
  box(g, tw, 0.04, 0.8, 0, 0.74, 0.55, "white");
  goods(g, -tw / 2 + 0.1, tw / 2 - 0.1, 0.78, 0.55, 0.5, 0.16, ["wine", "indigo", "orange", "teal", "gold", "black"], 3);
  beam(g, [-1.1, 1.8, -0.8], [1.1, 1.8, -0.8], 0.03, "hub");
  for (let i = 0; i < 6; i += 1) quad(at(g, -0.95 + i * 0.38, -0.8), 0.32, 0.9, 0, 0.9, 0.02, (["wine", "teal", "gold", "indigo", "green", "orange"] as const)[i] ?? "white");
  return setFootprint(g, [
    { x: 0, z: 0.55, width: tw, depth: 0.8 },
    { x: 0, z: -0.8, width: 2.3, depth: 0.2 },
  ]);
}

/** The chicken shop's kitchen door at its side: a steel door in a frame against the wall, a step, a bin and the extractor. */
export function buildSideDoor(): Group {
  const g = new Group();
  g.name = "prop_side-door";
  box(g, 1.2, 2.3, 0.12, 0, 0, 0, "charcoal");
  box(g, 0.94, 2.1, 0.04, 0, 0.04, 0.07, "zinc");
  quad(g, 0.8, 0.12, 0, 1.0, 0.095, "hub");
  box(g, 0.14, 0.05, 0.06, 0.32, 1.05, 0.12, "black");
  box(g, 1.3, 0.08, 0.4, 0, 0, 0.22, "concrete");
  // The extractor's box and duct over the door.
  box(g, 0.7, 0.45, 0.4, 0, 2.5, 0.12, "hub");
  box(g, 0.3, 0.6, 0.3, 0, 2.95, 0.12, "hub");
  // A wheelie bin beside it.
  box(g, 0.58, 0.95, 0.7, 1.0, 0.06, 0.35, "green");
  box(g, 0.62, 0.06, 0.74, 1.0, 1.01, 0.35, "black");
  for (const x of [0.78, 1.22]) cylinder(at(g, x, 0.0), 0.06, 0.04, 0, 0.02, 0.02, "tyre", 8);
  return setFootprint(g, [
    { x: 0, z: 0, width: 1.2, depth: 0.14 },
    { x: 1.0, z: 0.35, width: 0.62, depth: 0.74 },
  ]);
}

// ---------------------------------------------------------------------------
// Peckham Rye station
// ---------------------------------------------------------------------------

/** The ticket machine at the station: a dark cabinet with its screen, card reader and slot under a little hood. */
export function buildTicketMachine(): Group {
  const g = new Group();
  g.name = "prop_ticket-machine";
  box(g, 0.8, 1.75, 0.5, 0, 0.04, 0, "indigo");
  box(g, 0.9, 0.04, 0.6, 0, 0, 0, "charcoal");
  box(g, 0.86, 0.1, 0.62, 0, 1.79, 0.04, "charcoal");
  quad(g, 0.46, 0.36, 0, 1.2, 0.252, "glass");
  quad(g, 0.5, 0.06, 0, 1.6, 0.252, "danfoYellow");
  box(g, 0.2, 0.14, 0.08, -0.15, 0.95, 0.27, "black");
  box(g, 0.16, 0.04, 0.06, 0.18, 0.98, 0.27, "hub");
  box(g, 0.4, 0.12, 0.08, 0, 0.45, 0.25, "black");
  quad(g, 0.66, 0.08, 0, 0.75, 0.252, "white");
  return setFootprint(g, [{ x: 0, z: 0, width: 0.9, depth: 0.6 }]);
}

/** The ticket gates under the station's arch: four grey cabinets with their paddles, three ways through. */
export function buildTicketGates(): Group {
  const g = new Group();
  g.name = "prop_ticket-gates";
  const xs = [-1.65, -0.55, 0.55, 1.65];
  for (const x of xs) {
    box(g, 0.28, 1.0, 1.4, x, 0, 0, "concrete");
    box(g, 0.3, 0.04, 1.42, x, 1.0, 0, "charcoal");
    quad(g, 0.12, 0.12, x, 0.85, 0.71, "green");
    box(g, 0.22, 0.03, 0.2, x, 1.04, 0.45, "black");
  }
  // The paddles closed across each way.
  for (let i = 0; i < 3; i += 1) {
    const mid = ((xs[i] ?? 0) + (xs[i + 1] ?? 0)) / 2;
    for (const s of [-1, 1]) box(g, 0.36, 0.5, 0.03, mid + s * 0.2, 0.42, 0, "wine");
  }
  return setFootprint(g, xs.map((x) => ({ x, z: 0, width: 0.3, depth: 1.4 })));
}

/** The courier's bike propped on its stand: two wheels, a frame, the bars, and the square bag on the rack. */
export function buildCourierBike(): Group {
  const g = new Group();
  g.name = "prop_courier-bike";
  const wheelAt = (z: number): void => {
    const f = at(g, 0, z, 0, 0.34);
    f.rotation.z = Math.PI / 2;
    cylinder(f, 0.34, 0.05, 0, -0.025, 0, "tyre", 14);
    cylinder(f, 0.08, 0.07, 0, -0.035, 0, "hub", 8);
  };
  wheelAt(0.55);
  wheelAt(-0.5);
  beam(g, [0, 0.34, -0.5], [0, 0.85, -0.1], 0.04, "charcoal");
  beam(g, [0, 0.34, -0.5], [0, 0.4, 0.1], 0.04, "charcoal");
  beam(g, [0, 0.4, 0.1], [0, 0.85, -0.1], 0.04, "charcoal");
  beam(g, [0, 0.85, -0.1], [0, 0.92, 0.42], 0.04, "charcoal");
  beam(g, [0, 0.4, 0.1], [0, 0.92, 0.42], 0.04, "charcoal");
  beam(g, [0, 0.92, 0.42], [0, 0.34, 0.55], 0.035, "hub");
  beam(g, [0, 0.92, 0.42], [0, 1.08, 0.46], 0.035, "hub");
  box(g, 0.56, 0.03, 0.03, 0, 1.08, 0.46, "black");
  box(g, 0.12, 0.05, 0.24, 0, 0.9, -0.14, "black");
  beam(g, [0.08, 0.4, 0.1], [0.24, 0.015, 0.18], 0.025, "hub");
  // The rack over the back wheel and the insulated bag on it, plain, with a reflective band.
  box(g, 0.3, 0.03, 0.42, 0, 0.82, -0.5, "hub");
  box(g, 0.44, 0.46, 0.44, 0, 0.85, -0.5, "charcoal");
  quad(g, 0.44, 0.05, 0, 1.08, -0.278, "white", Math.PI);
  quad(at(g, 0.221, -0.5, Math.PI / 2), 0.44, 0.05, 0, 1.08, 0, "white");
  quad(at(g, -0.221, -0.5, -Math.PI / 2), 0.44, 0.05, 0, 1.08, 0, "white");
  return setFootprint(g, [{ x: 0, z: 0, width: 0.6, depth: 1.8 }]);
}

/** The station's name board on its two posts, where the way up to the platforms starts. */
export function buildPlatformSign(key: string, style: SignStyle): Group {
  const g = new Group();
  g.name = "prop_platform-sign";
  for (const x of [-1.1, 1.1]) box(g, 0.1, 2.9, 0.1, x, 0, 0, "charcoal");
  box(g, 2.5, 0.75, 0.08, 0, 2.05, -0.02, "charcoal");
  signboard(g, onWall(g, 0, 0, 0.02), key, style, 0, 2.1, 2.3, 0.6);
  // A plain arrow board under it pointing up the stair, no words.
  box(g, 0.9, 0.36, 0.05, 0, 1.4, -0.02, "white");
  quad(g, 0.1, 0.24, 0, 1.46, 0.006, "blue");
  quad(at(g, 0, 0.007, Math.PI / 4), 0.16, 0.05, 0.04, 1.62, 0, "blue");
  quad(at(g, 0, 0.007, -Math.PI / 4), 0.16, 0.05, -0.04, 1.62, 0, "blue");
  return setFootprint(g, [
    { x: -1.1, z: 0, width: 0.14, depth: 0.14 },
    { x: 1.1, z: 0, width: 0.14, depth: 0.14 },
  ]);
}

// ---------------------------------------------------------------------------
// The big shop
// ---------------------------------------------------------------------------

/** An aisle of shelves, both sides, its goods in rows of colour and a price strip along each shelf. */
export function buildShopAisle(): Group {
  const g = new Group();
  g.name = "prop_shop-aisle";
  const L = 4.0;
  const d = 1.0;
  box(g, L, 1.75, 0.08, 0, 0, 0, "white");
  box(g, L, 0.1, d, 0, 0, 0, "charcoal");
  for (const end of [-1, 1]) box(g, 0.06, 1.8, d, end * (L / 2 - 0.03), 0, 0, "white");
  const shelves = [0.12, 0.55, 0.98, 1.4];
  shelves.forEach((y, i) => {
    for (const s of [-1, 1]) {
      box(g, L - 0.12, 0.03, d / 2 - 0.06, 0, y, s * (d / 4 + 0.02), "hub");
      goods(g, -L / 2 + 0.12, L / 2 - 0.12, y + 0.03, s * (d / 4 + 0.02), d / 2 - 0.16, 0.3, ["red", "danfoYellow", "white", "green", "orange", "blue", "cream", "wine"], i * 3 + (s > 0 ? 1 : 5));
      quad(at(g, 0, s * (d / 2 - 0.02), s > 0 ? 0 : Math.PI), L - 0.12, 0.04, 0, y - 0.02, 0.003, "white");
    }
  });
  // The aisle's number board on top: a plain blue board, no words.
  box(g, 0.9, 0.36, 0.05, 0, 2.1, 0, "blue");
  box(g, 0.04, 0.32, 0.04, 0, 1.8, 0, "hub");
  return setFootprint(g, [{ x: 0, z: 0, width: L, depth: d }]);
}

/** The trolley bay by the door: four trolleys nested in a row against a rail, and a stack of baskets. */
export function buildTrolleyBay(): Group {
  const g = new Group();
  g.name = "prop_trolley-bay";
  box(g, 2.2, 0.05, 0.05, 0, 0.9, -0.62, "hub");
  for (const x of [-1.05, 1.05]) box(g, 0.05, 0.9, 0.05, x, 0, -0.62, "hub");
  for (let i = 0; i < 4; i += 1) {
    const z = -0.3 + i * 0.22;
    const t = at(g, 0, z);
    box(t, 0.56, 0.42, 0.8, 0, 0.48, 0, "zinc");
    quad(t, 0.5, 0.36, 0, 0.51, 0.401, "hub");
    box(t, 0.6, 0.04, 0.04, 0, 1.0, 0.42, "blue");
    for (const x of [-0.22, 0.22]) for (const dz of [-0.32, 0.32]) cylinder(t, 0.05, 0.1, x, 0.02, dz, "black", 6);
    for (const x of [-0.26, 0.26]) box(t, 0.03, 0.85, 0.03, x, 0.12, 0.38, "hub");
  }
  for (let k = 0; k < 4; k += 1) box(g, 0.44, 0.12, 0.32, 1.45, k * 0.13, 0.1, k % 2 === 0 ? "red" : "blue");
  return setFootprint(g, [
    { x: 0, z: 0.05, width: 2.2, depth: 1.5 },
    { x: 1.45, z: 0.1, width: 0.46, depth: 0.34 },
  ]);
}

/** The tills: two checkouts side by side, each a belt, a screen and a card reader, the bagging shelf and the seat behind. */
export function buildTills(): Group {
  const g = new Group();
  g.name = "prop_tills";
  for (const x of [-0.9, 0.9]) {
    const t = at(g, x, 0);
    box(t, 0.7, 0.85, 1.9, -0.05, 0, 0, "white");
    box(t, 0.5, 0.03, 1.4, -0.1, 0.85, 0.2, "black");
    box(t, 0.7, 0.04, 0.5, -0.05, 0.85, -0.7, "hub");
    monitor(t, 0.28, 0.85, -0.3, Math.PI / 2);
    box(t, 0.12, 0.2, 0.08, -0.32, 0.87, -0.25, "charcoal");
    // A bar across the belt and the light pole with its blue lamp.
    box(t, 0.5, 0.03, 0.06, -0.1, 0.9, 0.5, "red");
    cylinder(t, 0.025, 1.2, 0.3, 0.85, 0.8, "hub", 6);
    box(t, 0.18, 0.12, 0.18, 0.3, 2.05, 0.8, "blue");
    // The cashier's seat.
    cylinder(at(t, 0.65, -0.2), 0.2, 0.05, 0, 0.42, 0, "charcoal", 8);
    cylinder(at(t, 0.65, -0.2), 0.03, 0.42, 0, 0, 0, "hub", 6);
  }
  return setFootprint(g, [
    { x: -0.95, z: 0, width: 0.72, depth: 1.9 },
    { x: 0.85, z: 0, width: 0.72, depth: 1.9 },
  ]);
}

// ---------------------------------------------------------------------------
// The workplaces: the care home, the ward, the office, the warehouse
// ---------------------------------------------------------------------------

/** The care home's reception: a counter in two parts with its screen, the visitors' book and a vase, a chair behind. */
export function buildReceptionDesk(): Group {
  const g = new Group();
  g.name = "prop_reception-desk";
  box(g, 2.2, 1.05, 0.5, 0, 0, 0.25, "wood");
  box(g, 0.5, 1.05, 1.0, 1.1 - 0.25, 0, -0.5, "wood");
  box(g, 2.3, 0.04, 0.6, 0, 1.05, 0.25, "cream");
  box(g, 2.0, 0.04, 0.5, -0.1, 0.74, -0.35, "white");
  quad(g, 2.0, 0.6, 0, 0.3, 0.502, "darkWood");
  monitor(g, -0.3, 0.78, -0.45, 0);
  box(g, 0.3, 0.02, 0.22, 0.4, 1.09, 0.3, "wine");
  box(g, 0.26, 0.012, 0.2, 0.4, 1.11, 0.3, "white");
  cylinder(g, 0.07, 0.22, -0.8, 1.09, 0.3, "teal", 8);
  for (const [dx, colour] of [[-0.05, "red"], [0.05, "danfoYellow"], [0.0, "white"]] as const) cylinder(g, 0.05, 0.08, -0.8 + dx, 1.33, 0.3 + dx, colour, 6);
  chair(at(g, -0.3, -0.95), "teal");
  return setFootprint(g, [
    { x: 0, z: 0.25, width: 2.3, depth: 0.6 },
    { x: 0.85, z: -0.5, width: 0.5, depth: 1.0 },
  ]);
}

/** The rota board on its stand: a white board ruled into the week's shifts, names as coloured strips. */
export function buildRotaBoard(): Group {
  const g = new Group();
  g.name = "prop_rota-board";
  for (const x of [-0.85, 0.85]) {
    box(g, 0.05, 1.95, 0.05, x, 0, 0, "hub");
    box(g, 0.05, 0.04, 0.5, x, 0, 0, "hub");
  }
  box(g, 1.75, 1.05, 0.04, 0, 0.8, 0, "charcoal");
  quad(g, 1.65, 0.95, 0, 0.85, 0.021, "white");
  for (let r = 0; r < 7; r += 1) quad(g, 1.6, 0.012, 0, 0.9 + r * 0.12, 0.024, "hub");
  for (let c = 0; c < 6; c += 1) quad(g, 0.012, 0.85, -0.55 + c * 0.25, 0.9, 0.024, "hub");
  const colours: PaletteName[] = ["blue", "green", "red", "orange", "teal", "wine"];
  for (let i = 0; i < 14; i += 1) quad(g, 0.2, 0.07, -0.42 + (i % 5) * 0.25, 0.92 + Math.floor(i / 2) * 0.12, 0.027, colours[i % colours.length] ?? "blue");
  box(g, 1.2, 0.04, 0.08, 0, 0.8, 0.04, "hub");
  return setFootprint(g, [{ x: 0, z: 0, width: 1.75, depth: 0.5 }]);
}

/** The tea point: a counter with its kettle, mugs, a microwave and the fridge under it, and a small table with two chairs. */
export function buildTeaPoint(): Group {
  const g = new Group();
  g.name = "prop_tea-point";
  const w = 1.8;
  box(g, w, 0.88, 0.6, 0, 0, -0.3, "white");
  box(g, w + 0.04, 0.04, 0.64, 0, 0.88, -0.3, "charcoal");
  for (let i = 0; i < 3; i += 1) quad(g, 0.56, 0.7, -0.6 + i * 0.6, 0.1, 0.002, i === 2 ? "zinc" : "cream");
  box(g, 0.5, 0.3, 0.36, 0.55, 0.92, -0.4, "zinc");
  quad(g, 0.3, 0.2, 0.5, 0.97, -0.219, "black");
  cylinder(g, 0.08, 0.22, -0.55, 0.92, -0.35, "white", 8);
  box(g, 0.04, 0.12, 0.03, -0.45, 0.98, -0.35, "white");
  for (const [x, colour] of [[-0.25, "red"], [-0.12, "blue"], [0.0, "danfoYellow"], [0.12, "white"]] as const) cylinder(g, 0.04, 0.1, x, 0.92, -0.18, colour, 6);
  // Cupboards over the counter on the wall line.
  box(g, w, 0.6, 0.34, 0, 1.5, -0.43, "cream");
  // The table and its two chairs before the counter, where the line is said.
  cylinder(g, 0.35, 0.03, 0, 0.72, 0.85, "wood", 12);
  cylinder(g, 0.04, 0.72, 0, 0, 0.85, "hub", 6);
  cylinder(g, 0.22, 0.02, 0, 0.01, 0.85, "hub", 8);
  chair(at(g, -0.65, 0.85, Math.PI / 2), "teal");
  chair(at(g, 0.65, 0.85, -Math.PI / 2), "teal");
  cylinder(g, 0.04, 0.1, 0.08, 0.75, 0.8, "red", 6);
  return setFootprint(g, [
    { x: 0, z: -0.3, width: w + 0.04, depth: 0.64 },
    { x: 0, z: 0.85, width: 0.5, depth: 0.5 },
  ]);
}

/** The nurses' station: a long counter, two screens, the files, a phone and a chair behind. */
export function buildNursesStation(): Group {
  const g = new Group();
  g.name = "prop_nurses-station";
  const w = 2.6;
  box(g, w, 1.08, 0.3, 0, 0, 0.35, "white");
  box(g, w + 0.06, 0.04, 0.42, 0, 1.08, 0.35, "teal");
  box(g, w, 0.04, 0.6, 0, 0.74, -0.1, "cream");
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) box(g, 0.06, 0.74, 0.6, x, 0, -0.1, "white");
  monitor(g, -0.6, 0.78, -0.2);
  monitor(g, 0.2, 0.78, -0.2);
  for (let i = 0; i < 4; i += 1) box(g, 0.08, 0.3, 0.26, 0.8 + i * 0.1, 0.78, -0.15, (["blue", "red", "green", "danfoYellow"] as const)[i] ?? "blue");
  box(g, 0.2, 0.06, 0.16, -1.05, 0.78, 0.0, "charcoal");
  chair(at(g, -0.6, -0.75), "blue");
  chair(at(g, 0.2, -0.75), "blue");
  return setFootprint(g, [{ x: 0, z: 0.1, width: w + 0.06, depth: 0.9 }]);
}

/** A ward's bed: a frame with rails, the mattress at its tilt, a pillow, a cabinet, the drip stand and a curtain on its rail. */
export function buildHospitalBed(): Group {
  const g = new Group();
  g.name = "prop_hospital-bed";
  const w = 0.95;
  const L = 2.1;
  legs(g, w, L, 0.45, "hub", 0.05);
  for (const z of [-L / 2 + 0.05, L / 2 - 0.05]) cylinder(g, 0.06, 0.06, 0, 0, z, "black", 8);
  box(g, w, 0.08, L, 0, 0.45, 0, "hub");
  box(g, w - 0.06, 0.14, L - 0.5, 0, 0.53, 0.25, "white");
  const back = at(g, 0, -L / 2 + 0.25, 0, 0.55);
  back.rotation.x = 0.4;
  box(back, w - 0.06, 0.14, 0.7, 0, 0, -0.3, "white");
  box(back, 0.6, 0.12, 0.34, 0, 0.14, -0.38, "cream");
  box(g, w - 0.04, 0.05, L - 0.8, 0, 0.68, 0.38, "teal");
  box(g, w, 0.55, 0.05, 0, 0.45, -L / 2, "hub");
  box(g, w, 0.3, 0.05, 0, 0.45, L / 2, "hub");
  for (const s of [-1, 1]) box(g, 0.03, 0.2, 1.1, s * (w / 2 + 0.02), 0.62, 0.1, "hub");
  // The cabinet and the drip stand at the bed's head.
  box(g, 0.45, 0.8, 0.45, w / 2 + 0.4, 0, -0.75, "cream");
  cylinder(g, 0.03, 1.9, -w / 2 - 0.3, 0, -0.8, "hub", 6);
  box(g, 0.16, 0.24, 0.06, -w / 2 - 0.3, 1.6, -0.8, "white");
  cylinder(g, 0.2, 0.03, -w / 2 - 0.3, 0.02, -0.8, "hub", 6);
  // The curtain drawn back along its rail at the bed's foot side.
  beam(g, [-w / 2 - 0.55, 2.3, -L / 2 - 0.2], [-w / 2 - 0.55, 2.3, L / 2 + 0.2], 0.03, "hub");
  box(g, 0.05, 1.8, 0.7, -w / 2 - 0.55, 0.45, L / 2 - 0.2, "wallMint");
  return setFootprint(g, [
    { x: 0.2, z: -0.1, width: w + 0.9, depth: L + 0.1 },
    { x: -w / 2 - 0.42, z: 0.1, width: 0.4, depth: L - 0.2 },
  ]);
}

/** Two office desks facing each other, each with its screen, keyboard and chair: the hot desks. */
export function buildDeskPod(): Group {
  const g = new Group();
  g.name = "prop_desk-pod";
  const w = 1.6;
  for (const s of [-1, 1]) {
    // Each desk's user sits on the outside, facing across the screens to the other.
    const d = at(g, 0, s * 0.4, s > 0 ? 0 : Math.PI);
    legs(d, w, 0.8, 0.72, "hub", 0.04);
    box(d, w, 0.04, 0.8, 0, 0.72, 0, "white");
    monitor(d, -0.2, 0.76, -0.2);
    box(d, 0.44, 0.02, 0.15, -0.2, 0.76, 0.1, "black");
    box(d, 0.06, 0.02, 0.1, 0.15, 0.76, 0.12, "charcoal");
    cylinder(d, 0.04, 0.1, 0.55, 0.76, -0.1, s > 0 ? "red" : "white", 6);
    chair(at(d, -0.2, 0.75, Math.PI), "black");
  }
  box(g, w, 0.4, 0.04, 0, 0.76, 0, "teal");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: 1.6 }]);
}

/** The glass office at the end: framed panes on three sides, the door's gap, a desk with its screen and a chair inside. */
export function buildGlassOffice(): Group {
  const g = new Group();
  g.name = "prop_glass-office";
  const w = 3.2;
  const d = 2.6;
  const h = 2.4;
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0.45, d / 2], [-0.45, d / 2]] as const) box(g, 0.06, h, 0.06, x, 0, z, "charcoal");
  // Panes: the two sides and the front either side of the door; the back is the room's wall.
  for (const s of [-1, 1]) {
    box(g, 0.03, h - 0.1, d - 0.08, s * (w / 2), 0.05, 0, "glass");
    box(g, 0.04, 0.06, d, s * (w / 2), h - 0.06, 0, "charcoal");
  }
  for (const s of [-1, 1]) box(g, w / 2 - 0.48, h - 0.1, 0.03, s * (w / 4 + 0.24), 0.05, d / 2, "glass");
  box(g, w, 0.06, 0.06, 0, h - 0.06, d / 2, "charcoal");
  quad(g, w - 1.0, 0.1, 0, 1.2, d / 2 + 0.02, "white");
  // Inside: the desk, its screen, a chair either side, a plant.
  legs(at(g, 0, -0.5), 1.6, 0.8, 0.72, "darkWood");
  box(g, 1.6, 0.04, 0.8, 0, 0.72, -0.5, "darkWood");
  monitor(g, 0, 0.76, -0.7);
  chair(at(g, 0, -1.05), "black");
  chair(at(g, 0, 0.2, Math.PI), "charcoal");
  cylinder(g, 0.18, 0.4, w / 2 - 0.35, 0, -d / 2 + 0.35, "darkWood", 8);
  cylinder(g, 0.28, 0.5, w / 2 - 0.35, 0.4, -d / 2 + 0.35, "green", 6, 0.1);
  return setFootprint(g, [
    { x: -w / 2, z: 0, width: 0.08, depth: d },
    { x: w / 2, z: 0, width: 0.08, depth: d },
    { x: -(w / 4 + 0.24), z: d / 2, width: w / 2 - 0.42, depth: 0.08 },
    { x: w / 4 + 0.24, z: d / 2, width: w / 2 - 0.42, depth: 0.08 },
    { x: 0, z: -0.5, width: 1.6, depth: 0.8 },
  ]);
}

/** The warehouse's clock-in: a terminal on its post with the card reader, the racks of cards beside it and a yellow line. */
export function buildClockIn(): Group {
  const g = new Group();
  g.name = "prop_clock-in";
  box(g, 0.12, 1.5, 0.12, 0, 0, 0, "charcoal");
  box(g, 0.4, 0.5, 0.18, 0, 1.2, 0.05, "charcoal");
  quad(g, 0.26, 0.16, 0, 1.45, 0.141, "glass");
  quad(g, 0.12, 0.08, 0, 1.28, 0.141, "green");
  // The racks of cards on their board.
  box(g, 1.0, 1.1, 0.06, 0.8, 0.7, -0.02, "white");
  for (let r = 0; r < 5; r += 1) for (let c = 0; c < 6; c += 1) quad(g, 0.1, 0.16, 0.42 + c * 0.15, 0.8 + r * 0.2, 0.012, (r + c) % 3 === 0 ? "danfoYellow" : "cream");
  box(g, 0.06, 0.7, 0.06, 0.34, 0, -0.02, "hub");
  box(g, 0.06, 0.7, 0.06, 1.26, 0, -0.02, "hub");
  // The yellow line across the floor before it, raised clear of the ground.
  box(g, 1.6, 0.02, 0.1, 0.5, 0.02, 0.6, "danfoYellow");
  return setFootprint(g, [
    { x: 0, z: 0.03, width: 0.42, depth: 0.2 },
    { x: 0.8, z: -0.02, width: 1.0, depth: 0.1 },
  ]);
}

/** A run of pallet racking: blue uprights, orange beams, pallets of boxes on three levels. */
export function buildRacking(): Group {
  const g = new Group();
  g.name = "prop_racking";
  const L = 5.4;
  const d = 1.1;
  const h = 3.6;
  for (const x of [-L / 2, 0, L / 2]) for (const z of [-d / 2, d / 2]) box(g, 0.08, h, 0.08, x, 0, z, "blue");
  const levels = [0.08, 1.25, 2.4];
  levels.forEach((y, li) => {
    for (const z of [-d / 2, d / 2]) box(g, L, 0.12, 0.06, 0, y + 0.0, z, "orange");
    for (const half of [-1, 1]) {
      const cx = (half * L) / 4;
      box(g, 1.2, 0.12, 1.0, cx, y + 0.12, 0, "wood");
      const loads = (li + (half > 0 ? 1 : 0)) % 3;
      if (loads === 0) box(g, 1.1, 0.8, 0.9, cx, y + 0.24, 0, "tan");
      else if (loads === 1) {
        box(g, 0.52, 0.7, 0.9, cx - 0.28, y + 0.24, 0, "tan");
        box(g, 0.52, 0.5, 0.9, cx + 0.28, y + 0.24, 0, "khaki");
      } else box(g, 1.1, 0.6, 0.9, cx, y + 0.24, 0, "cream");
    }
  });
  return setFootprint(g, [{ x: 0, z: 0, width: L + 0.08, depth: d + 0.08 }]);
}

/** A roll cage trolley of boxes for the next van. */
export function buildCageTrolley(): Group {
  const g = new Group();
  g.name = "prop_cage-trolley";
  const w = 0.8;
  const d = 0.7;
  box(g, w, 0.04, d, 0, 0.12, 0, "hub");
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) cylinder(g, 0.05, 0.12, x, 0, z, "black", 6);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k += 1) box(g, 0.02, 1.6, 0.02, s * (w / 2 - 0.01), 0.16, -d / 2 + 0.05 + k * 0.15, "hub");
    for (const y of [0.6, 1.1, 1.74]) box(g, 0.02, 0.02, d, s * (w / 2 - 0.01), y, 0, "hub");
  }
  for (let k = 0; k < 5; k += 1) box(g, w, 1.6, 0.02, 0, 0.16, -d / 2 + 0.01, "hub");
  box(g, 0.66, 0.5, 0.55, 0, 0.17, 0.02, "tan");
  box(g, 0.6, 0.4, 0.5, 0.0, 0.68, 0.04, "khaki");
  box(g, 0.36, 0.3, 0.4, -0.12, 1.09, 0.0, "tan");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** The smoking shelter by the door: a back wall and ends of clear sheet, a sloping roof, a bench and a sand bin. */
export function buildSmokingShelter(): Group {
  const g = new Group();
  g.name = "prop_smoking-shelter";
  const w = 2.4;
  const d = 1.3;
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) box(g, 0.07, z < 0 ? 2.3 : 2.1, 0.07, x, 0, z, "charcoal");
  const roof = at(g, 0, 0, 0, 2.2);
  roof.rotation.x = -0.08;
  box(roof, w + 0.2, 0.05, d + 0.25, 0, 0, 0, "zinc");
  box(g, w, 2.0, 0.03, 0, 0.15, -d / 2, "glass");
  for (const x of [-w / 2, w / 2]) box(g, 0.03, 2.0, d - 0.1, x, 0.15, 0, "glass");
  box(g, 1.6, 0.05, 0.36, 0, 0.45, -d / 2 + 0.25, "wood");
  for (const x of [-0.7, 0.7]) box(g, 0.05, 0.45, 0.05, x, 0, -d / 2 + 0.25, "charcoal");
  cylinder(g, 0.16, 0.7, w / 2 - 0.35, 0, d / 2 - 0.25, "red", 8);
  cylinder(g, 0.13, 0.02, w / 2 - 0.35, 0.7, d / 2 - 0.25, "sand", 8);
  return setFootprint(g, [
    { x: 0, z: -d / 2, width: w, depth: 0.08 },
    { x: -w / 2, z: 0, width: 0.08, depth: d },
    { x: w / 2, z: 0, width: 0.08, depth: d },
    { x: w / 2 - 0.35, z: d / 2 - 0.25, width: 0.34, depth: 0.34 },
  ]);
}

// ---------------------------------------------------------------------------
// The church
// ---------------------------------------------------------------------------

/** A pew: a long wooden bench with its back and ends, a shelf for the hymn books behind. */
export function buildPew(): Group {
  const g = new Group();
  g.name = "prop_pew";
  const L = 3.2;
  box(g, L, 0.06, 0.42, 0, 0.42, 0.02, "wood");
  box(g, L, 0.5, 0.05, 0, 0.5, -0.2, "wood");
  box(g, L, 0.06, 0.18, 0, 0.82, -0.3, "darkWood");
  for (const x of [-L / 2, L / 2]) box(g, 0.06, 0.9, 0.55, x, 0, -0.05, "darkWood");
  box(g, L - 0.1, 0.06, 0.06, 0, 0.08, -0.15, "darkWood");
  for (let i = 0; i < 4; i += 1) box(g, 0.12, 0.16, 0.08, -1.2 + i * 0.75, 0.88, -0.3, i % 2 === 0 ? "wine" : "indigo");
  return setFootprint(g, [
    { x: -L / 2, z: -0.05, width: 0.08, depth: 0.55 },
    { x: L / 2, z: -0.05, width: 0.08, depth: 0.55 },
    { x: 0, z: -0.24, width: L, depth: 0.16 },
  ]);
}

/** The front of the church: a low stage with the pulpit, the table under its white cloth, the drums and the keyboard. */
export function buildAltar(): Group {
  const g = new Group();
  g.name = "prop_altar";
  const w = 5.0;
  const d = 2.2;
  box(g, w, 0.2, d, 0, 0, 0, "wine");
  box(g, w - 0.04, 0.02, 0.3, 0, 0.2, d / 2 - 0.16, "gold");
  // The pulpit at the front middle.
  box(g, 0.7, 1.1, 0.5, 0, 0.2, 0.4, "darkWood");
  box(g, 0.8, 0.05, 0.6, 0, 1.3, 0.38, "wood");
  quad(g, 0.3, 0.5, 0, 0.5, 0.651, "gold");
  quad(g, 0.1, 0.5, 0, 0.5, 0.653, "white");
  quad(g, 0.3, 0.1, 0, 0.85, 0.653, "white");
  // The table under its cloth at the back, flowers either side.
  box(g, 1.6, 0.76, 0.6, 0, 0.2, -0.6, "white");
  box(g, 1.64, 0.02, 0.64, 0, 0.96, -0.6, "gold");
  for (const x of [-1.2, 1.2]) {
    cylinder(g, 0.12, 0.6, x, 0.2, -0.65, "white", 8);
    cylinder(g, 0.22, 0.3, x, 0.8, -0.65, "red", 6, 0.12);
  }
  // The drums on the left, the keyboard on its stand on the right.
  cylinder(g, 0.28, 0.4, -1.9, 0.2, -0.3, "wine", 10);
  for (const [x, z] of [[-1.55, 0.1], [-2.2, 0.15]] as const) {
    cylinder(g, 0.03, 0.55, x, 0.2, z, "hub", 6);
    cylinder(g, 0.17, 0.18, x, 0.75, z, "white", 10);
  }
  cylinder(g, 0.03, 0.95, -1.6, 0.2, -0.65, "hub", 6);
  cylinder(g, 0.24, 0.02, -1.6, 1.15, -0.65, "gold", 10);
  for (const x of [1.55, 2.25]) beam(g, [x, 0.2, 0.25], [x, 0.95, 0.25], 0.04, "black");
  box(g, 1.0, 0.1, 0.32, 1.9, 0.95, 0.25, "black");
  quad(at(g, 1.9, 0.25), 0.9, 0.02, 0, 1.05, 0.165, "white");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}
