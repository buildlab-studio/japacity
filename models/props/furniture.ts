// The furniture of the interior places (world:things-are-tappable-models, world:place-is-one-screen): every piece
// a thing the player taps or a piece that dresses a room, each its own model so a label can stand
// over it. Every piece stands on its base at y = 0, faces +Z (assets:metre-units-and-origin), and its tops keep clear
// of each other by more than a centimetre where they overlap (world:faces-never-share-height). Laid flat on the floor,
// a mat or a rug sits two centimetres up or more.
import { type FootprintBox, type PaletteName, setFootprint } from "@japacity/model-kit";
import { beam, box, cylinder, quad } from "@japacity/model-kit/kit";
import { Group, type Object3D } from "three";

import { at, legs, monitor } from "./parts";

/** An office chair on its star base, facing +Z in its frame. */
function officeChair(g: Object3D, colour: PaletteName = "black"): void {
  for (const turn of [0, Math.PI / 2]) box(g, 0.56, 0.04, 0.05, 0, turn === 0 ? 0.03 : 0.05, 0, "hub", turn);
  cylinder(g, 0.03, 0.42, 0, 0.05, 0, "hub", 6);
  box(g, 0.48, 0.08, 0.46, 0, 0.45, 0, colour);
  box(g, 0.46, 0.5, 0.06, 0, 0.6, -0.22, colour);
}

/** An open laptop, its screen leaning back, facing +Z. */
function laptop(g: Object3D, x: number, y: number, z: number, ry = 0, lid: PaletteName = "hub"): void {
  const f = at(g, x, z, ry, y);
  box(f, 0.34, 0.02, 0.24, 0, 0, 0, lid);
  const screen = new Group();
  screen.position.set(0, 0.02, -0.12);
  screen.rotation.x = -0.25;
  f.add(screen);
  box(screen, 0.34, 0.22, 0.012, 0, 0, 0, lid);
  quad(screen, 0.3, 0.18, 0, 0.02, 0.007, "glass");
}

/** A stack of papers on a surface at y: each sheet's top two centimetres over the last. */
function papers(g: Object3D, x: number, y: number, z: number, count: number, colours: readonly PaletteName[] = ["white", "cream"]): void {
  for (let i = 0; i < count; i++) box(g, 0.24, 0.02, 0.32, x + i * 0.03, y + i * 0.02, z - i * 0.02, colours[i % colours.length] ?? "white", i * 0.15);
}

// ---------------------------------------------------------------------------
// Pieces for every room
// ---------------------------------------------------------------------------

/** The way out of a room: a door in its frame, standing against a wall, a mat before it and the green light over it. */
export function buildRoomDoor(): Group {
  const g = new Group();
  g.name = "prop_room-door";
  // The frame, a little proud of the wall, and the leaf in it.
  box(g, 0.08, 2.18, 0.12, -0.49, 0, 0, "white");
  box(g, 0.08, 2.18, 0.12, 0.49, 0, 0, "white");
  box(g, 1.06, 0.08, 0.12, 0, 2.18, 0, "white");
  box(g, 0.9, 2.1, 0.05, 0, 0, -0.01, "darkWood");
  quad(g, 0.7, 0.9, 0, 1.0, 0.016, "wood");
  quad(g, 0.7, 0.6, 0, 0.25, 0.016, "wood");
  box(g, 0.14, 0.04, 0.06, 0.32, 1.0, 0.04, "hub");
  // The exit light: a green box over the frame.
  box(g, 0.36, 0.16, 0.08, 0, 2.36, 0.02, "green");
  quad(g, 0.28, 0.08, 0, 2.4, 0.061, "white");
  // The mat, two centimetres up.
  box(g, 1.0, 0.025, 0.6, 0, 0, 0.42, "seat");
  return setFootprint(g, [{ x: 0, z: 0, width: 1.1, depth: 0.14 }]);
}

/** A row of four linked waiting chairs on a steel beam, blue moulded seats. */
export function buildWaitingChairs(): Group {
  const g = new Group();
  g.name = "prop_waiting-chairs";
  const seats = 4;
  const pitch = 0.56;
  const span = seats * pitch;
  box(g, span, 0.05, 0.06, 0, 0.36, -0.02, "hub");
  for (const x of [-span / 2 + 0.2, span / 2 - 0.2]) {
    box(g, 0.05, 0.36, 0.05, x, 0, -0.02, "hub");
    box(g, 0.05, 0.03, 0.56, x, 0, -0.02, "hub");
  }
  for (let i = 0; i < seats; i++) {
    const x = -span / 2 + pitch / 2 + i * pitch;
    box(g, 0.48, 0.05, 0.44, x, 0.41, 0.02, "blue");
    const back = at(g, x, -0.2, 0, 0.46);
    back.rotation.x = -0.15;
    box(back, 0.46, 0.42, 0.04, 0, 0, 0, "blue");
    if (i > 0) box(g, 0.05, 0.2, 0.36, x - pitch / 2, 0.46, 0.0, "hub");
  }
  // The beam and the backs only: the seats are where people sit.
  return setFootprint(g, [{ x: 0, z: -0.22, width: span, depth: 0.1 }]);
}

/** A counter desk with its officer's chair behind and a visitor's stool before it: the visa desk, the agent's desk, the nurse's. */
export function buildOfficeDesk(): Group {
  const g = new Group();
  g.name = "prop_office-desk";
  const w = 1.6;
  const d = 0.8;
  const h = 0.76;
  // The top, the modesty panel the visitor faces, and two side panels.
  box(g, w, 0.04, d, 0, h - 0.04, 0, "wood");
  box(g, w - 0.1, h - 0.18, 0.03, 0, 0.1, d / 2 - 0.06, "darkWood");
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) box(g, 0.04, h - 0.04, d - 0.04, x, 0, 0, "darkWood");
  // A drawer pedestal on the officer's side.
  box(g, 0.42, 0.6, 0.6, w / 2 - 0.3, 0.02, -0.05, "darkWood");
  // The screen, turned to the officer, the keyboard, a tray of papers and a stamp.
  monitor(g, -0.25, h, -0.2, Math.PI);
  box(g, 0.44, 0.02, 0.15, -0.25, h, 0.08, "black");
  papers(g, 0.42, h, 0.1, 3);
  cylinder(g, 0.03, 0.08, 0.15, h, 0.22, "red", 6);
  // The officer's chair behind, facing the visitor.
  officeChair(at(g, 0, -0.85));
  // The visitor's stool before the desk.
  cylinder(at(g, 0, 0.85), 0.2, 0.06, 0, 0.44, 0, "charcoal", 8);
  cylinder(at(g, 0, 0.85), 0.03, 0.44, 0, 0, 0, "hub", 6);
  cylinder(at(g, 0, 0.85), 0.2, 0.03, 0, 0, 0, "hub", 8);
  // The desk only: the officer sits in the chair behind it and the visitor on the stool before it.
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** A bed with its mattress, pillow and wrapper, and the metal box of papers pulled half out from under it. */
export function buildBed(): Group {
  const g = new Group();
  g.name = "prop_bed";
  const w = 1.4;
  const l = 2.0;
  // The frame and headboard at -Z.
  box(g, w, 0.28, l, 0, 0.12, 0, "darkWood");
  legs(g, w, l, 0.12, "darkWood", 0.07);
  box(g, w + 0.06, 1.0, 0.08, 0, 0, -l / 2 - 0.04, "darkWood");
  box(g, w - 0.04, 0.2, l - 0.06, 0, 0.4, 0.02, "white");
  box(g, 0.9, 0.12, 0.38, 0, 0.6, -l / 2 + 0.28, "cream");
  // A wrapper thrown over the foot of the bed.
  box(g, w + 0.02, 0.04, 0.8, 0, 0.6, 0.45, "indigo");
  quad(at(g, w / 2 + 0.012, 0.45, Math.PI / 2), 0.8, 0.3, 0, 0.34, 0, "indigo");
  // The papers box is its own thing at the bed's foot (world:phone-holds-what-phones-hold), so the bed carries no tin.
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: l }]);
}

// ---------------------------------------------------------------------------
// The parlour
// ---------------------------------------------------------------------------

/**
 * The tin box the family keeps its papers in (world:phone-holds-what-phones-hold): blue, the lid a shade lighter, the paint
 * worn to the metal along the lid's front edge, a padlock on its hasp and the edge of a sheet caught
 * under the lid. Its front faces +Z, the way it is pulled out from under the bed. Every face that looks
 * up stands over FLOOR_MAX, so it never shares a height with the floor or a rug.
 */
export function buildPapersBox(): Group {
  const g = new Group();
  g.name = "prop_papers-box";
  const w = 0.4;
  const d = 0.3;
  const body = 0.15;
  const lid = 0.03;
  box(g, w, body, d, 0, 0, 0, "blue");
  box(g, w + 0.02, lid, d + 0.02, 0, body, 0, "basin");
  // Worn to the metal: the lid's front edge and one bottom corner where it is dragged out.
  quad(g, 0.2, lid - 0.008, -0.09, body + 0.004, d / 2 + 0.011, "hub");
  quad(g, 0.1, 0.05, w / 2 - 0.06, 0.004, d / 2 + 0.001, "zinc");
  // A sheet caught under the lid, its edge out at the front.
  box(g, 0.18, 0.008, 0.06, 0.1, body + 0.002, d / 2 + 0.01, "cream");
  // The hasp and its padlock, and a handle at each end.
  box(g, 0.05, 0.07, 0.012, -0.12, 0.08, d / 2 + 0.006, "hub");
  box(g, 0.04, 0.05, 0.02, -0.12, 0.06, d / 2 + 0.018, "gold");
  for (const side of [-1, 1]) box(g, 0.02, 0.025, 0.12, side * (w / 2 + 0.01), 0.1, 0, "hub");
  return setFootprint(g, [{ x: 0, z: 0, width: w + 0.02, depth: d + 0.02 }]);
}

/** A seat of the parlour suite in wine with a cream cover on its back, in its own frame facing +Z. */
function seat(g: Object3D, width: number): void {
  box(g, width, 0.42, 0.78, 0, 0, 0, "wine");
  box(g, width, 0.5, 0.2, 0, 0.42, -0.29, "wine");
  for (const side of [-1, 1]) box(g, 0.18, 0.62, 0.78, side * (width / 2 - 0.09), 0, 0, "wine");
  box(g, width * 0.6, 0.3, 0.02, 0, 0.6, -0.18, "cream");
  box(g, width - 0.36, 0.06, 0.6, 0, 0.42, 0.07, "seat");
}

/** The three-seater the family sits on to watch the television. */
export function buildSofa(): Group {
  const g = new Group();
  g.name = "prop_sofa";
  seat(g, 2.1);
  // Two cushions in the corners.
  box(g, 0.36, 0.34, 0.12, -0.7, 0.48, -0.12, "gold", 0.2);
  box(g, 0.36, 0.34, 0.12, 0.7, 0.48, -0.12, "teal", -0.2);
  // The back only: the seat in front is where someone sits.
  return setFootprint(g, [{ x: 0, z: -0.3, width: 2.1, depth: 0.22 }]);
}

/** One armchair of the suite: Mama's, and Papa's across from it. */
export function buildArmchair(): Group {
  const g = new Group();
  g.name = "prop_armchair";
  seat(g, 1.0);
  // The back only: the seat in front is where someone sits.
  return setFootprint(g, [{ x: 0, z: -0.3, width: 1.0, depth: 0.22 }]);
}

/** The centre table with its glass top on a rug of three borders, a bowl of fruit on it. */
export function buildCentreTable(): Group {
  const g = new Group();
  g.name = "prop_centre-table";
  // The rug's three rings, each a box two centimetres higher than the one under it.
  box(g, 3.0, 0.02, 2.1, 0, 0, 0, "indigo");
  box(g, 2.6, 0.02, 1.7, 0, 0.02, 0, "gold");
  box(g, 2.2, 0.02, 1.3, 0, 0.04, 0, "wine");
  legs(at(g, 0, 0, 0, 0.06), 1.2, 0.7, 0.34, "darkWood");
  box(g, 1.2, 0.04, 0.7, 0, 0.4, 0, "darkWood");
  box(g, 1.1, 0.02, 0.6, 0, 0.44, 0, "glass");
  cylinder(g, 0.14, 0.06, -0.2, 0.46, 0.05, "white", 8, 0.18);
  for (const [x, z, c] of [[-0.24, 0.02, "orange"], [-0.16, 0.08, "pepper"], [-0.2, 0.12, "danfoYellow"]] as const) box(g, 0.08, 0.07, 0.08, x, 0.5, z, c);
  box(g, 0.2, 0.025, 0.14, 0.3, 0.46, -0.1, "black");
  return setFootprint(g, [{ x: 0, z: 0, width: 1.2, depth: 0.7 }]);
}

/** The television on its low cabinet, the decoder and the standing fan beside it. */
export function buildTvStand(): Group {
  const g = new Group();
  g.name = "prop_tv-stand";
  box(g, 1.7, 0.55, 0.45, 0, 0, 0, "darkWood");
  quad(g, 0.74, 0.4, -0.38, 0.08, 0.226, "black");
  quad(g, 0.74, 0.4, 0.38, 0.08, 0.226, "black");
  box(g, 0.3, 0.06, 0.2, 0.55, 0.55, 0.05, "black");
  // The screen on its foot.
  box(g, 0.3, 0.03, 0.18, 0, 0.55, 0, "black");
  box(g, 0.06, 0.12, 0.04, 0, 0.58, -0.02, "black");
  box(g, 1.2, 0.7, 0.06, 0, 0.66, -0.03, "black");
  quad(g, 1.1, 0.6, 0, 0.71, 0.001, "glass");
  // The standing fan.
  const fan = at(g, -1.15, 0.05);
  cylinder(fan, 0.18, 0.04, 0, 0, 0, "black", 8);
  cylinder(fan, 0.025, 1.15, 0, 0.04, 0, "white", 6);
  const head = new Group();
  head.position.set(0, 1.25, 0.1);
  head.rotation.x = Math.PI / 2;
  fan.add(head);
  cylinder(head, 0.24, 0.08, 0, -0.04, 0, "white", 10);
  cylinder(head, 0.1, 0.12, 0, -0.16, 0, "hub", 8);
  return setFootprint(g, [
    { x: 0, z: 0, width: 1.7, depth: 0.45 },
    { x: -1.15, z: 0.05, width: 0.4, depth: 0.4 },
  ]);
}

/** The small table where the homework and the laptop are: two chairs, books and an open laptop. */
export function buildDiningTable(): Group {
  const g = new Group();
  g.name = "prop_dining-table";
  const w = 1.2;
  const d = 0.75;
  const h = 0.74;
  legs(g, w, d, h - 0.04, "wood");
  box(g, w, 0.04, d, 0, h - 0.04, 0, "wood");
  laptop(g, -0.25, h, 0.0, 0);
  papers(g, 0.3, h, 0.05, 2, ["blue", "white"]);
  box(g, 0.2, 0.03, 0.28, 0.32, h + 0.04, -0.22, "red", 0.3);
  for (const [x, z, ry] of [[-0.25, 0.62, Math.PI], [0.35, -0.62, 0]] as const) {
    const chair = at(g, x, z, ry);
    legs(chair, 0.42, 0.42, 0.44, "darkWood", 0.04);
    box(chair, 0.44, 0.04, 0.44, 0, 0.44, 0, "darkWood");
    box(chair, 0.42, 0.46, 0.04, 0, 0.48, -0.2, "darkWood");
  }
  // The table only: someone may sit on either chair.
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

// ---------------------------------------------------------------------------
// The test room, the clinic, the bank
// ---------------------------------------------------------------------------

/** One candidate's place in the test room: a small desk with its screen and headphones, a chair. */
export function buildTestDesk(): Group {
  const g = new Group();
  g.name = "prop_test-desk";
  const w = 0.9;
  const d = 0.6;
  const h = 0.74;
  legs(g, w, d, h - 0.03, "hub", 0.04);
  box(g, w, 0.03, d, 0, h - 0.03, 0, "white");
  // A low divider at the back so no one sees the next screen.
  box(g, w, 0.4, 0.03, 0, h, -d / 2 + 0.02, "concrete");
  monitor(g, 0, h, -0.1);
  box(g, 0.4, 0.02, 0.14, 0, h, 0.15, "black");
  // The headphones on the desk.
  cylinder(g, 0.06, 0.04, 0.33, h, 0.12, "black", 8);
  cylinder(g, 0.06, 0.04, 0.33, h, -0.04, "black", 8);
  // The chair.
  const chair = at(g, 0, 0.55, Math.PI);
  legs(chair, 0.42, 0.42, 0.44, "hub", 0.03);
  box(chair, 0.44, 0.04, 0.42, 0, 0.44, 0, "blue");
  box(chair, 0.42, 0.4, 0.04, 0, 0.5, -0.2, "blue");
  // The desk only: the candidate sits on the chair.
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** The clinic's chest X-ray: the plate on its column, the tube on its arm, a screen on wheels beside it. */
export function buildXrayStand(): Group {
  const g = new Group();
  g.name = "prop_xray-stand";
  box(g, 0.6, 0.06, 0.5, 0, 0, 0, "hub");
  box(g, 0.14, 2.1, 0.14, 0, 0.06, -0.15, "white");
  box(g, 0.5, 0.5, 0.1, 0, 1.15, -0.02, "white");
  quad(g, 0.42, 0.42, 0, 1.19, 0.031, "concrete");
  // The tube on its own column, across the floor from the plate.
  box(g, 0.5, 0.06, 0.5, 0, 0, 1.9, "hub");
  box(g, 0.12, 1.9, 0.12, 0, 0.06, 1.95, "white");
  box(g, 0.14, 0.14, 0.7, 0, 1.4, 1.6, "white");
  box(g, 0.3, 0.3, 0.3, 0, 1.3, 1.22, "hub");
  // The folding screen.
  for (let i = 0; i < 3; i++) {
    const panel = at(g, 1.0 + i * 0.5, 0.6 + (i % 2) * 0.12, (i % 2 === 0 ? 1 : -1) * 0.25);
    box(panel, 0.04, 1.6, 0.04, -0.24, 0.12, 0, "hub");
    box(panel, 0.48, 1.3, 0.02, 0, 0.3, 0, "teal");
  }
  return setFootprint(g, [
    { x: 0, z: -0.05, width: 0.6, depth: 0.5 },
    { x: 0, z: 1.75, width: 0.5, depth: 0.8 },
    { x: 1.5, z: 0.65, width: 1.5, depth: 0.3 },
  ]);
}

/** The banking hall's counter: a long front, a worktop, and a glass screen with two windows, the tellers' chairs behind. */
export function buildBankCounter(): Group {
  const g = new Group();
  g.name = "prop_bank-counter";
  const w = 4.4;
  const d = 0.8;
  const h = 1.05;
  box(g, w, h, d, 0, 0, 0, "darkWood");
  quad(g, w - 0.2, 0.7, 0, 0.2, d / 2 + 0.005, "wood");
  box(g, w + 0.1, 0.05, d + 0.1, 0, h, 0, "concrete");
  // The glass screen on the worktop, three frames with two windows cut low in it.
  for (const x of [-w / 2 + 0.05, -w / 6, w / 6, w / 2 - 0.05]) box(g, 0.05, 0.75, 0.05, x, h + 0.05, -0.05, "hub");
  box(g, w, 0.05, 0.06, 0, h + 0.8, -0.05, "hub");
  for (const x of [-w / 3, 0, w / 3]) quad(g, w / 3 - 0.1, 0.55, x, h + 0.23, -0.01, "glass");
  // A ledger, a cash tray, a pen on its chain.
  papers(g, -w / 3, h + 0.05, 0.25, 2);
  box(g, 0.3, 0.04, 0.2, w / 3, h + 0.05, 0.25, "hub");
  // The tellers behind the glass: two chairs and their screens.
  for (const x of [-w / 3, w / 3]) {
    officeChair(at(g, x, -1.0, 0));
    monitor(g, x + 0.3, h + 0.05, -0.25, Math.PI);
  }
  // The counter only: the tellers sit in their chairs behind it.
  return setFootprint(g, [{ x: 0, z: 0, width: w + 0.1, depth: d + 0.1 }]);
}

// ---------------------------------------------------------------------------
// The hub
// ---------------------------------------------------------------------------

/** The hub's long table: four laptops, extension boards, benches down both sides. */
export function buildLongDesk(): Group {
  const g = new Group();
  g.name = "prop_long-desk";
  const w = 4.0;
  const d = 1.0;
  const h = 0.75;
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) box(g, 0.08, h - 0.04, d - 0.2, x, 0, 0, "black");
  box(g, w, 0.04, d, 0, h - 0.04, 0, "wood");
  laptop(g, -1.3, h, 0.22, 0, "hub");
  laptop(g, 0.4, h, 0.22, 0, "black");
  laptop(g, -0.5, h, -0.22, Math.PI, "black");
  laptop(g, 1.2, h, -0.22, Math.PI, "hub");
  box(g, 0.4, 0.04, 0.08, 0.0, h, 0.0, "white");
  cylinder(g, 0.04, 0.12, 1.5, h, 0.3, "red", 6);
  for (const z of [-0.85, 0.85]) {
    box(g, w - 0.2, 0.05, 0.32, 0, 0.42, z, "darkWood");
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) box(g, 0.06, 0.42, 0.28, x, 0, z, "black");
  }
  // The table only: people sit on the benches.
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** The jobs board on its two legs, cards of every colour pinned on it. */
export function buildJobsBoard(): Group {
  const g = new Group();
  g.name = "prop_jobs-board";
  for (const x of [-0.75, 0.75]) {
    box(g, 0.06, 1.9, 0.06, x, 0, 0, "black");
    box(g, 0.06, 0.04, 0.5, x, 0, 0, "black");
  }
  box(g, 1.6, 1.0, 0.04, 0, 0.8, 0, "tan");
  const cards: PaletteName[] = ["white", "danfoYellow", "cream", "green", "white", "orange", "cream", "blue"];
  cards.forEach((colour, i) => quad(g, 0.28, 0.2, -0.55 + (i % 4) * 0.37, 0.95 + Math.floor(i / 4) * 0.4 + (i % 3) * 0.04, 0.025, colour));
  return setFootprint(g, [{ x: 0, z: 0, width: 1.6, depth: 0.5 }]);
}

/** The meetup corner: a screen on a stand, a cluster of stools facing it, a cooler of drinks. */
export function buildMeetupCorner(): Group {
  const g = new Group();
  g.name = "prop_meetup-corner";
  // The screen on its stand at the back of the corner.
  box(g, 0.6, 0.04, 0.5, 0, 0, -1.0, "black");
  box(g, 0.08, 1.2, 0.08, 0, 0.04, -1.0, "black");
  box(g, 1.6, 0.92, 0.06, 0, 1.2, -1.02, "black");
  quad(g, 1.5, 0.82, 0, 1.25, -0.988, "blue");
  quad(g, 0.9, 0.1, -0.1, 1.75, -0.985, "white");
  quad(g, 0.6, 0.1, -0.25, 1.55, -0.985, "white");
  // Stools in two arcs.
  for (const [x, z] of [[-0.9, 0.1], [-0.3, 0.0], [0.3, 0.0], [0.9, 0.1], [-0.6, 0.75], [0.0, 0.7], [0.6, 0.75]] as const) {
    cylinder(g, 0.18, 0.05, x, 0.45, z, "orange", 8);
    cylinder(g, 0.03, 0.45, x, 0, z, "hub", 5);
  }
  // A cooler of drinks.
  box(g, 0.6, 0.45, 0.4, 1.4, 0, -0.7, "blue");
  box(g, 0.62, 0.06, 0.42, 1.4, 0.45, -0.7, "white");
  return setFootprint(g, [
    { x: 0, z: -1.0, width: 1.6, depth: 0.5 },
    { x: 1.4, z: -0.7, width: 0.62, depth: 0.42 },
  ]);
}

// ---------------------------------------------------------------------------
// The room abroad
// ---------------------------------------------------------------------------

/** A window of the room abroad standing against its wall: the frame, the grey sky in it, curtains drawn back, a sill. */
export function buildWindowFrame(): Group {
  const g = new Group();
  g.name = "prop_window-frame";
  const w = 1.4;
  const h = 1.4;
  const y = 0.9;
  box(g, w + 0.12, h + 0.12, 0.06, 0, y - 0.06, 0, "white");
  quad(g, w, h, 0, y, 0.031, "wallSkyWorn");
  quad(g, 0.05, h, 0, y, 0.034, "white");
  quad(g, w, 0.05, 0, y + h / 2, 0.034, "white");
  // The sill, a plant pot on it, and the radiator under it.
  box(g, w + 0.2, 0.04, 0.2, 0, y - 0.08, 0.08, "white");
  cylinder(g, 0.08, 0.14, 0.45, y - 0.04, 0.08, "orange", 6);
  box(g, 0.18, 0.2, 0.14, 0.45, y + 0.1, 0.08, "pepper");
  box(g, 1.0, 0.5, 0.08, 0, 0.15, 0.05, "white");
  for (const x of [-0.4, 0.4]) box(g, 0.05, 0.15, 0.05, x, 0, 0.05, "white");
  for (let i = 0; i < 6; i++) quad(g, 0.03, 0.46, -0.4 + i * 0.16, 0.17, 0.092, "concrete");
  // The curtains, drawn to either side.
  for (const side of [-1, 1]) box(g, 0.32, h + 0.5, 0.06, side * (w / 2 + 0.12), y - 0.25, 0.08, "denim");
  box(g, w + 0.9, 0.04, 0.04, 0, y + h + 0.28, 0.08, "hub");
  return setFootprint(g, [{ x: 0, z: 0.05, width: 1.2, depth: 0.2 }]);
}

/** A small table by the bed: the lamp, the phone face up on it, a charger lead hanging. */
export function buildSideTable(): Group {
  const g = new Group();
  g.name = "prop_side-table";
  box(g, 0.5, 0.55, 0.42, 0, 0, 0, "wood");
  quad(g, 0.42, 0.2, 0, 0.28, 0.211, "darkWood");
  cylinder(g, 0.08, 0.04, -0.12, 0.55, -0.08, "white", 8);
  cylinder(g, 0.015, 0.3, -0.12, 0.59, -0.08, "hub", 4);
  cylinder(g, 0.15, 0.18, -0.12, 0.85, -0.08, "cream", 8, 0.09);
  box(g, 0.09, 0.012, 0.17, 0.12, 0.55, 0.06, "black", 0.3);
  quad(g, 0.075, 0.15, 0.12, 0.562, 0.06, "blue", 0.3);
  return setFootprint(g, [{ x: 0, z: 0, width: 0.5, depth: 0.42 }]);
}

/** The post on the mat inside the door: three envelopes and a folded letter. */
export function buildPost(): Group {
  const g = new Group();
  g.name = "prop_post";
  box(g, 0.9, 0.025, 0.55, 0, 0, 0, "concreteWorn");
  const letters: [number, number, number, PaletteName][] = [
    [-0.18, 0.05, 0.3, "white"],
    [0.12, -0.08, -0.4, "cream"],
    [0.24, 0.12, 0.1, "white"],
    [-0.05, -0.12, 0.9, "tan"],
  ];
  letters.forEach(([x, z, ry, colour], i) => box(g, 0.24, 0.015, 0.13, x, 0.025 + i * 0.016, z, colour, ry));
  return setFootprint(g, "none");
}

// ---------------------------------------------------------------------------
// The arrivals hall
// ---------------------------------------------------------------------------

/** The barrier where families wait: steel posts and two rails, open in the middle where the travellers come through. */
export function buildArrivalsRail(): Group {
  const g = new Group();
  g.name = "prop_arrivals-rail";
  const half = 4.0;
  const gap = 1.0;
  for (const side of [-1, 1]) {
    const from = side * gap;
    const to = side * half;
    for (let x = from; Math.abs(x) <= half + 1e-6; x += side * 1.0) {
      box(g, 0.06, 1.05, 0.06, x, 0, 0, "hub");
      box(g, 0.24, 0.03, 0.24, x, 0, 0, "hub");
    }
    beam(g, [from, 1.0, 0], [to, 1.0, 0], 0.05, "zinc");
    beam(g, [from, 0.55, 0], [to, 0.55, 0], 0.04, "zinc");
  }
  // The gate's frame over the opening, where the travellers come out.
  box(g, 0.12, 2.6, 0.12, -gap, 0, -0.6, "charcoal");
  box(g, 0.12, 2.6, 0.12, gap, 0, -0.6, "charcoal");
  box(g, 2 * gap + 0.12, 0.4, 0.14, 0, 2.6, -0.6, "charcoal");
  quad(g, 2 * gap - 0.1, 0.24, 0, 2.68, -0.528, "danfoYellow");
  const footprint: FootprintBox[] = [-1, 1].map((side) => ({ x: (side * (half + gap)) / 2, z: 0, width: half - gap + 0.24, depth: 0.24 }));
  return setFootprint(g, footprint);
}

/** The board of flights on two posts: rows of yellow and white bars on black, no words. */
export function buildFlightBoard(): Group {
  const g = new Group();
  g.name = "prop_flight-board";
  for (const x of [-1.0, 1.0]) box(g, 0.1, 2.1, 0.1, x, 0, 0, "charcoal");
  box(g, 2.6, 1.3, 0.12, 0, 1.9, 0, "black");
  for (let row = 0; row < 6; row++) {
    const y = 2.02 + row * 0.18;
    quad(g, 0.5, 0.1, -0.9, y, 0.061, "danfoYellow");
    quad(g, 1.0, 0.1, -0.05, y, 0.061, "white");
    quad(g, 0.5, 0.1, 0.85, y, 0.061, row === 2 ? "green" : "danfoYellow");
  }
  return setFootprint(g, [
    { x: -1.0, z: 0, width: 0.2, depth: 0.2 },
    { x: 1.0, z: 0, width: 0.2, depth: 0.2 },
  ]);
}
