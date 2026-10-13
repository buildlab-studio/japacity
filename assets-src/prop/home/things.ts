// The things the market sells for the home: each stands in the room as the very model the phone's
// market shows on its sticker tile. Small things stand on a stool so they read from the raised camera. Each stands on
// its base at y = 0 and faces +Z (R-ASSET-003); a thing laid on the floor keeps its top faces two centimetres apart
// from each other and the floor (R-WORLD-012). Palette only.
import { type PaletteName, setFootprint } from "@japacity/assets";
import { beam, box, cylinder, floorQuad, quad, type Vec3 } from "@japacity/assets/kit";
import { Group, type Object3D, Quaternion, Vector3 } from "three";

/** A group at (x, y, z) turned ry, to draw a part in its own frame. */
function at(g: Object3D, x: number, z: number, ry = 0, y = 0): Group {
  const frame = new Group();
  frame.position.set(x, y, z);
  frame.rotation.y = ry;
  g.add(frame);
  return frame;
}

/** A group at (x, y, z) tipped rx about x: a lid leaning back, a panel tilted to the sun. */
function tilt(g: Object3D, x: number, y: number, z: number, rx: number): Group {
  const frame = new Group();
  frame.position.set(x, y, z);
  frame.rotation.x = rx;
  g.add(frame);
  return frame;
}

/** A low wooden stool of w by d, h high: a board on four legs. */
function woodStool(g: Object3D, x: number, z: number, w: number, d: number, h: number): void {
  box(g, w, 0.03, d, x, h - 0.03, z, "wood");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.04, h - 0.03, 0.04, x + sx * (w / 2 - 0.04), 0, z + sz * (d / 2 - 0.04), "darkWood");
}

/** A round plastic stool h high, its four legs splayed out to the floor. */
function plasticStool(g: Object3D, x: number, z: number, h: number, colour: PaletteName): void {
  cylinder(g, 0.16, 0.035, x, h - 0.035, z, colour, 10);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(g, [x + sx * 0.14, 0.01, z + sz * 0.14], [x + sx * 0.09, h - 0.03, z + sz * 0.09], 0.045, colour);
}

/** A round thing facing +Z, its back on the face it stands out of: a speaker's driver, a knob. */
function disc(g: Object3D, r: number, h: number, x: number, y: number, z: number, colour: PaletteName, segments = 10): void {
  const frame = tilt(g, x, y, z, Math.PI / 2);
  cylinder(frame, r, h, 0, 0, 0, colour, segments);
}

/** A cable laid along the floor through the points given in x and z, low enough to step over. */
function floorCable(g: Object3D, points: readonly [number, number][], colour: PaletteName): void {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    beam(g, [a[0], 0.02, a[1]], [b[0], 0.02, b[1]], 0.016, colour);
  }
}

/** A run of straight cable pieces through the points given. */
function cable(g: Object3D, points: readonly Vec3[], colour: PaletteName, w = 0.02): void {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a !== undefined && b !== undefined) beam(g, a, b, w, colour);
  }
}

/** A small transistor radio in red, its dial and grille, the telescopic aerial drawn out, on a low wooden stool. */
export function buildRadio(): Group {
  const g = new Group();
  g.name = "prop_radio";
  const top = 0.3;
  woodStool(g, 0, 0, 0.38, 0.28, top);
  const w = 0.3;
  const h = 0.17;
  const d = 0.1;
  box(g, w, h, d, 0, top, 0, "red");
  // The grille on the left of its face, the dial window on the right with its needle, and the tuning knob on top.
  quad(g, 0.13, 0.12, -0.065, top + 0.025, d / 2 + 0.002, "black");
  quad(g, 0.11, 0.06, 0.085, top + 0.07, d / 2 + 0.002, "cream");
  quad(g, 0.012, 0.06, 0.07, top + 0.07, d / 2 + 0.004, "red");
  disc(g, 0.022, 0.02, 0.085, top + 0.035, d / 2, "black", 8);
  cylinder(g, 0.022, 0.025, 0.08, top + h, 0, "black", 8);
  // The carrying strap over the top and the aerial drawn out and leaning.
  cable(g, [[-w / 2 + 0.02, top + h, 0], [-0.08, top + h + 0.06, 0], [0.02, top + h + 0.06, 0], [0.04, top + h, 0]], "black", 0.015);
  beam(g, [w / 2 - 0.03, top + h, -0.02], [w / 2 + 0.06, top + h + 0.3, -0.05], 0.012, "hub");
  box(g, 0.025, 0.02, 0.025, w / 2 + 0.06, top + h + 0.3, -0.05, "hub");
  return setFootprint(g, [{ x: 0, z: 0, width: 0.38, depth: 0.28 }]);
}

/** A big aluminium cooking pot with its lid on, the handles at its sides, and a wooden spoon resting across the lid. */
export function buildBigPot(): Group {
  const g = new Group();
  g.name = "prop_big-pot";
  const r = 0.22;
  const h = 0.3;
  // The foot blackened by the fire, the body, and the rolled rim.
  cylinder(g, r - 0.012, 0.07, 0, 0, 0, "concreteWorn", 14, r - 0.008);
  cylinder(g, r - 0.008, h - 0.07, 0, 0.07, 0, "zinc", 14, r);
  cylinder(g, r + 0.012, 0.025, 0, h - 0.03, 0, "hub", 14);
  // The lid, a shallow dome, and its knob.
  cylinder(g, r + 0.005, 0.02, 0, h, 0, "white", 14);
  cylinder(g, r - 0.01, 0.04, 0, h + 0.02, 0, "hub", 14, 0.08);
  cylinder(g, 0.03, 0.035, 0, h + 0.06, 0, "black", 8);
  // The two handles, loops of flat bar at either side.
  for (const s of [-1, 1]) {
    box(g, 0.05, 0.02, 0.1, s * (r + 0.03), h - 0.07, 0, "hub");
    box(g, 0.02, 0.04, 0.1, s * (r + 0.05), h - 0.09, 0, "hub");
  }
  // The wooden spoon laid across the lid, its bowl over the rim.
  const spoon = at(g, 0.02, 0.05, 0.5, h + 0.06);
  box(spoon, 0.03, 0.02, 0.48, 0, 0, -0.06, "wood");
  box(spoon, 0.07, 0.025, 0.1, 0, 0, 0.21, "wood");
  return setFootprint(g, [{ x: 0, z: 0, width: 2 * r + 0.1, depth: 2 * r + 0.02 }]);
}

/** A home data router, white with two aerials and its lit dots, and its yellow carton stood behind, on a low stool. */
export function buildRouter(): Group {
  const g = new Group();
  g.name = "prop_router";
  const top = 0.3;
  woodStool(g, 0, 0, 0.4, 0.3, top);
  // The carton, stood up at the back.
  box(g, 0.2, 0.17, 0.06, -0.06, top, -0.09, "danfoYellow");
  quad(g, 0.2, 0.05, -0.06, top + 0.06, -0.059, "white");
  // The router lying in front, its aerials up behind it.
  const w = 0.22;
  const d = 0.15;
  const hy = 0.045;
  box(g, w, hy, d, 0.03, top, 0.05, "white");
  box(g, w - 0.03, 0.01, d - 0.03, 0.03, top + hy, 0.05, "white");
  for (const s of [-1, 1]) {
    box(g, 0.025, 0.02, 0.025, 0.03 + s * (w / 2 - 0.02), top + hy - 0.01, 0.05 - d / 2 + 0.015, "white");
    beam(g, [0.03 + s * (w / 2 - 0.02), top + hy, 0.05 - d / 2 + 0.015], [0.03 + s * (w / 2 + 0.01), top + hy + 0.17, 0.05 - d / 2 - 0.01], 0.022, "charcoal");
  }
  // The row of lights on its front edge: the one lit green, the others blue.
  quad(g, 0.026, 0.016, -0.04, top + 0.015, 0.05 + d / 2 + 0.002, "green");
  for (const x of [0.0, 0.035, 0.07]) quad(g, 0.016, 0.012, x, top + 0.017, 0.05 + d / 2 + 0.002, "basin");
  return setFootprint(g, [{ x: 0, z: 0, width: 0.4, depth: 0.3 }]);
}

/**
 * A satellite TV set: a small white dish on a short black tripod, tipped up and out, the decoder box on the floor
 * beside it with its lights, a remote on top, and the cable between.
 */
export function buildDecoder(): Group {
  const g = new Group();
  g.name = "prop_decoder";
  // The tripod: three legs to a hub, a short mast up from it.
  const foot: Vec3 = [-0.2, 0, -0.05];
  const hub: Vec3 = [foot[0], 0.42, foot[2]];
  for (const turn of [0.3, 2.4, 4.5]) beam(g, [foot[0] + Math.sin(turn) * 0.24, 0.02, foot[2] + Math.cos(turn) * 0.24], hub, 0.03, "black");
  beam(g, hub, [hub[0], 0.62, hub[2]], 0.04, "black");
  // The dish, its face up and out toward the room, and the arm holding the head in front of it.
  const dir = new Vector3(-0.3, 0.85, 0.45).normalize();
  const centre = new Vector3(hub[0], 0.66, hub[2]).addScaledVector(dir, 0.04);
  const bowl = cylinder(g, 0.05, 0.16, 0, 0, 0, "white", 12, 0.3);
  bowl.geometry.translate(0, -0.08, 0);
  bowl.position.copy(centre);
  bowl.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir));
  const head = centre.clone().addScaledVector(dir, 0.34);
  const low = centre.clone().add(new Vector3(0, -0.24, 0)).addScaledVector(dir, 0.08);
  beam(g, [low.x, low.y, low.z], [head.x, head.y, head.z], 0.025, "black");
  box(g, 0.06, 0.08, 0.06, head.x, head.y - 0.04, head.z, "charcoal");
  // The decoder box on the floor, its display and lights, and the remote on it.
  const dx = 0.32;
  const dz = 0.15;
  box(g, 0.34, 0.07, 0.24, dx, 0, dz, "black");
  quad(g, 0.08, 0.025, dx - 0.06, 0.025, dz + 0.122, "red");
  quad(g, 0.02, 0.02, dx + 0.1, 0.027, dz + 0.122, "green");
  box(g, 0.05, 0.02, 0.15, dx + 0.04, 0.07, dz - 0.01, "charcoal", 0.3);
  // The cable from the head down the mast and along the floor to the back of the box.
  cable(g, [[head.x, head.y - 0.04, head.z], [low.x, low.y, low.z], [hub[0], 0.4, hub[2]]], "charcoal", 0.015);
  beam(g, [hub[0] + 0.02, 0.4, hub[2]], [hub[0] + 0.02, 0.02, hub[2]], 0.015, "charcoal");
  floorCable(g, [[hub[0] + 0.02, hub[2]], [dx - 0.05, -0.02], [dx - 0.05, dz - 0.12]], "charcoal");
  return setFootprint(g, [
    { x: foot[0], z: foot[2], width: 0.5, depth: 0.5 },
    { x: dx, z: dz, width: 0.34, depth: 0.24 },
  ]);
}

/**
 * A two-burner table-top gas cooker on its small metal stand at worktop height, a red pot on one burner, and the
 * green gas cylinder on the floor beside it joined by its hose.
 */
export function buildGasCooker(): Group {
  const g = new Group();
  g.name = "prop_gas-cooker";
  const w = 0.62;
  const d = 0.42;
  const h = 0.72;
  // The stand: four legs, the top frame and a shelf low down.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.03, h, 0.03, sx * (w / 2 - 0.02), 0, sz * (d / 2 - 0.02), "charcoal");
  box(g, w, 0.03, d, 0, h - 0.03, 0, "charcoal");
  box(g, w - 0.04, 0.02, d - 0.04, 0, 0.16, 0, "charcoal");
  // The cooker: a steel body, a black top with two burners and their grates, knobs on the front.
  const cw = 0.56;
  const cd = 0.36;
  box(g, cw, 0.1, cd, 0, h, 0, "zinc");
  box(g, cw - 0.02, 0.012, cd - 0.02, 0, h + 0.1, 0, "black");
  for (const s of [-1, 1]) {
    const x = s * 0.14;
    cylinder(g, 0.075, 0.02, x, h + 0.112, 0, "charcoal", 10);
    cylinder(g, 0.035, 0.03, x, h + 0.112, 0, "hub", 8);
    box(g, 0.18, 0.012, 0.02, x, h + 0.13, 0, "charcoal");
    box(g, 0.02, 0.012, 0.18, x, h + 0.13, 0, "charcoal");
    disc(g, 0.022, 0.025, s * 0.09, h + 0.05, cd / 2, "black", 8);
  }
  // The pot on the left burner, red enamel with its lid and knob.
  cylinder(g, 0.11, 0.14, -0.14, h + 0.142, 0, "red", 10);
  cylinder(g, 0.115, 0.015, -0.14, h + 0.282, 0, "white", 10);
  cylinder(g, 0.022, 0.03, -0.14, h + 0.297, 0, "black", 6);
  // The gas cylinder on the floor, its collar and valve, and the hose up to the cooker's side.
  const gx = w / 2 + 0.22;
  const gz = 0.02;
  cylinder(g, 0.15, 0.42, gx, 0, gz, "green", 10);
  cylinder(g, 0.15, 0.08, gx, 0.42, gz, "green", 10, 0.06);
  cylinder(g, 0.08, 0.06, gx, 0.5, gz, "green", 10, 0.08, true);
  box(g, 0.05, 0.06, 0.05, gx, 0.5, gz, "hub");
  cable(g, [[gx, 0.56, gz], [gx - 0.1, 0.6, gz + 0.05], [cw / 2 + 0.03, h + 0.05, 0.05]], "black", 0.022);
  return setFootprint(g, [
    { x: 0, z: 0, width: w, depth: d },
    { x: gx, z: gz, width: 0.3, depth: 0.3 },
  ]);
}

/** A small single-door fridge in white on its feet, the handle down the door's edge, a few magnets on the door. */
export function buildFridge(): Group {
  const g = new Group();
  g.name = "prop_fridge";
  const w = 0.56;
  const d = 0.58;
  const h = 1.2;
  box(g, w - 0.04, 0.05, d - 0.06, 0, 0, -0.01, "charcoal");
  box(g, w, h, d - 0.04, 0, 0.05, -0.02, "white");
  // The door standing a little proud, its seal showing round it, and the handle on its right edge.
  box(g, w, h - 0.02, 0.04, 0, 0.06, d / 2 - 0.02, "white");
  quad(g, w + 0.004, 0.012, 0, h + 0.035, d / 2 - 0.045, "hub");
  box(g, 0.035, 0.42, 0.04, w / 2 - 0.06, 0.62, d / 2 + 0.02, "hub");
  // The magnets: a fruit, a flag of three bands, a small card.
  for (const [x, y, colour] of [[-0.14, 1.0, "red"], [-0.05, 1.06, "danfoYellow"], [-0.16, 0.86, "green"]] as const) box(g, 0.08, 0.08, 0.012, x, y, d / 2 + 0.02, colour);
  quad(g, 0.12, 0.16, -0.06, 0.62, d / 2 + 0.021, "cream");
  quad(g, 0.08, 0.02, -0.06, 0.72, d / 2 + 0.023, "basin");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** A long standing mirror in a wooden frame, tipped back a little between two uprights on their feet. */
export function buildMirror(): Group {
  const g = new Group();
  g.name = "prop_mirror";
  const w = 0.5;
  const h = 1.36;
  // The two feet and uprights, a pin at each side where the frame turns.
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.04);
    box(g, 0.05, 0.05, 0.42, x, 0, 0, "darkWood");
    box(g, 0.04, 0.95, 0.04, x, 0.05, 0, "darkWood");
    disc(g, 0.025, 0.02, x, 0.85, 0.02, "gold", 6);
  }
  box(g, w + 0.1, 0.04, 0.04, 0, 0.12, 0, "darkWood");
  // The frame and its glass, read as the wardrobe's mirror, with a streak of light across.
  const frame = tilt(g, 0, 0.12, 0, -0.08);
  box(frame, w, h, 0.04, 0, 0, 0, "wood");
  quad(frame, w - 0.08, h - 0.08, 0, 0.04, 0.021, "wallSky");
  quad(frame, w - 0.12, h - 0.12, 0, 0.06, 0.023, "glass");
  const streak = tilt(frame, 0, 0, 0, 0);
  streak.position.set(0.02, 0.8, 0.025);
  streak.rotation.z = 0.7;
  quad(streak, 0.05, 0.42, 0, -0.21, 0, "wallSky");
  quad(streak, 0.025, 0.22, 0.07, -0.05, 0, "wallSky");
  return setFootprint(g, [{ x: 0, z: 0, width: w + 0.13, depth: 0.42 }]);
}

/** A tall party speaker cabinet, black, a handle on top, a big driver with its light ring and a horn above. */
export function buildSpeaker(): Group {
  const g = new Group();
  g.name = "prop_speaker";
  const w = 0.46;
  const d = 0.38;
  const h = 0.86;
  box(g, w, h, d, 0, 0.03, 0, "charcoal");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.06, 0.03, 0.06, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), "black");
  // The front: the big driver in its blue light ring, the horn above, a strip of lights at the foot.
  const z = d / 2;
  disc(g, 0.19, 0.012, 0, 0.36, z, "basin", 14);
  disc(g, 0.165, 0.02, 0, 0.36, z, "black", 14);
  disc(g, 0.11, 0.03, 0, 0.36, z, "charcoal", 12);
  disc(g, 0.04, 0.04, 0, 0.36, z, "hub", 8);
  box(g, 0.26, 0.13, 0.025, 0, 0.66, z, "black");
  disc(g, 0.045, 0.03, 0, 0.725, z, "charcoal", 8);
  quad(g, 0.32, 0.02, 0, 0.62, z + 0.003, "basin");
  quad(g, 0.3, 0.03, 0, 0.1, z + 0.003, "purple");
  // The handle on top, a bar on two posts.
  for (const s of [-1, 1]) box(g, 0.03, 0.06, 0.04, s * 0.11, h + 0.03, 0, "black");
  box(g, 0.26, 0.03, 0.04, 0, h + 0.09, 0, "black");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** An inverter on the floor, grey with its small lit screen, two big batteries beside it and the cables between. */
export function buildInverter(): Group {
  const g = new Group();
  g.name = "prop_inverter";
  // The inverter, stood up on its feet, its screen and buttons on its face and vents on its side.
  const ix = -0.32;
  const iw = 0.34;
  const ih = 0.46;
  const id = 0.22;
  box(g, iw, ih, id, ix, 0.03, 0, "hub");
  box(g, iw - 0.04, 0.03, id - 0.04, ix, 0, 0, "charcoal");
  quad(g, iw - 0.06, 0.16, ix, 0.27, id / 2 + 0.002, "charcoal");
  quad(g, 0.15, 0.07, ix - 0.04, 0.32, id / 2 + 0.004, "wallSky");
  for (const [x, colour] of [[0.08, "green"], [0.08, "red"]] as const) quad(g, 0.03, 0.025, ix + x, colour === "green" ? 0.37 : 0.32, id / 2 + 0.004, colour);
  for (let i = 0; i < 3; i++) quad(g, 0.18, 0.02, ix, 0.1 + i * 0.04, id / 2 + 0.002, "concrete");
  // The two batteries, black with a white label, their red and black posts.
  const bw = 0.22;
  const bh = 0.36;
  const bd = 0.34;
  for (const bx of [0.04, 0.3]) {
    box(g, bw, bh, bd, bx, 0, 0.02, "black");
    box(g, bw - 0.02, 0.02, bd - 0.02, bx, bh, 0.02, "charcoal");
    quad(g, bw - 0.06, 0.14, bx, 0.12, 0.02 + bd / 2 + 0.002, "white");
    quad(g, bw - 0.06, 0.03, bx, 0.14, 0.02 + bd / 2 + 0.004, "red");
    box(g, 0.04, 0.04, 0.04, bx - 0.06, bh + 0.02, 0.12, "red");
    box(g, 0.04, 0.04, 0.04, bx + 0.06, bh + 0.02, 0.12, "charcoal");
  }
  // The cables: battery to battery, and the pair across to the inverter's side.
  cable(g, [[0.1, bh + 0.05, 0.12], [0.17, bh + 0.1, 0.12], [0.24, bh + 0.05, 0.12]], "red", 0.022);
  cable(g, [[-0.02, bh + 0.05, 0.12], [-0.08, bh + 0.12, 0.1], [ix + iw / 2, 0.36, 0.06]], "red", 0.022);
  cable(g, [[0.36, bh + 0.05, 0.12], [0.36, bh + 0.12, -0.06], [0.0, bh + 0.12, -0.08], [ix + iw / 2, 0.3, -0.04]], "black", 0.022);
  return setFootprint(g, [
    { x: ix, z: 0, width: iw, depth: id },
    { x: 0.17, z: 0.02, width: 0.48, depth: bd },
  ]);
}

/**
 * A solar panel of 1.6 by 1.0 metres on its tilted steel frame standing in the yard, its feet on small slabs, the
 * battery box beside it and the cable down to it.
 */
export function buildSolar(): Group {
  const g = new Group();
  g.name = "prop_solar";
  const pw = 1.6;
  const pd = 1.0;
  const rake = 0.45;
  const cy = 0.78;
  // The panel tipped to face up and out: its frame, then the cells in four columns and three rows.
  const panel = tilt(g, 0, cy, 0, rake);
  box(panel, pw, 0.04, pd, 0, -0.02, 0, "hub");
  const cols = 4;
  const rows = 3;
  const cw = (pw - 0.06) / cols;
  const cd = (pd - 0.06) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) floorQuad(panel, cw - 0.025, cd - 0.025, -pw / 2 + 0.03 + cw * (i + 0.5), 0.024, -pd / 2 + 0.03 + cd * (j + 0.5), "roofBlue");
  // The legs from the panel's edges down to their slabs, and a brace across the back.
  const front = pd / 2 - 0.08;
  const fy = cy - Math.sin(rake) * front - 0.03;
  const fz = Math.cos(rake) * front;
  const by = cy + Math.sin(rake) * front - 0.03;
  const bz = -Math.cos(rake) * front;
  for (const x of [-pw / 2 + 0.12, pw / 2 - 0.12]) {
    box(g, 0.04, fy - 0.05, 0.04, x, 0.05, fz, "charcoal");
    box(g, 0.04, by - 0.05, 0.04, x, 0.05, bz, "charcoal");
    beam(g, [x, 0.3, fz], [x, by - 0.05, bz], 0.03, "charcoal");
    for (const z of [fz, bz]) box(g, 0.14, 0.05, 0.14, x, 0, z, "concrete");
  }
  beam(g, [-pw / 2 + 0.12, 0.35, bz], [pw / 2 - 0.12, 0.35, bz], 0.03, "charcoal");
  // The battery box on the ground by the panel's end, its light, and the cable from under the panel to it.
  const bx = pw / 2 + 0.3;
  box(g, 0.32, 0.28, 0.22, bx, 0, 0.15, "white");
  quad(g, 0.2, 0.06, bx, 0.17, 0.261, "charcoal");
  quad(g, 0.03, 0.03, bx + 0.11, 0.19, 0.262, "green");
  cable(g, [[pw / 2 - 0.12, by - 0.1, bz], [pw / 2 - 0.1, 0.25, bz + 0.02], [bx - 0.1, 0.2, 0.06]], "black", 0.022);
  return setFootprint(g, [
    { x: 0, z: 0, width: pw, depth: Math.cos(rake) * pd },
    { x: bx, z: 0.15, width: 0.32, depth: 0.22 },
  ]);
}

/** A floor-standing air conditioner, tall and white, its louvres open at the top, a small display, the grille below. */
export function buildAc(): Group {
  const g = new Group();
  g.name = "prop_ac";
  const w = 0.5;
  const d = 0.32;
  const h = 1.72;
  box(g, w - 0.02, 0.05, d - 0.02, 0, 0, 0, "hub");
  box(g, w, h, d, 0, 0.05, 0, "white");
  box(g, w - 0.04, 0.03, d - 0.04, 0, h + 0.05, 0, "white");
  // The louvres: a dark mouth near the top with four white blades across it.
  const z = d / 2;
  quad(g, w - 0.1, 0.34, 0, 1.28, z + 0.002, "charcoal");
  for (let i = 0; i < 4; i++) box(g, w - 0.12, 0.02, 0.04, 0, 1.31 + i * 0.08, z, "white");
  // The display below it, lit blue, and the grille's slots low down.
  quad(g, 0.16, 0.08, 0, 1.08, z + 0.002, "black");
  quad(g, 0.08, 0.04, -0.02, 1.1, z + 0.004, "basin");
  quad(g, 0.02, 0.02, 0.05, 1.11, z + 0.004, "green");
  for (let i = 0; i < 6; i++) quad(g, w - 0.14, 0.018, 0, 0.18 + i * 0.07, z + 0.002, "hub");
  return setFootprint(g, [{ x: 0, z: 0, width: w, depth: d }]);
}

/** A small wooden desk with a laptop open on it, its screen lit, a mouse beside, and a plastic stool tucked in front. */
export function buildLaptopDesk(): Group {
  const g = new Group();
  g.name = "prop_laptop-desk";
  const w = 0.9;
  const d = 0.5;
  const h = 0.74;
  box(g, w, 0.03, d, 0, h - 0.03, 0, "wood");
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.04, h - 0.03, 0.04, sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04), "darkWood");
  box(g, w - 0.08, 0.08, 0.02, 0, h - 0.11, -d / 2 + 0.04, "darkWood");
  // The laptop: its base and keys, and the lid leaning back with the screen lit.
  const lz = -0.02;
  box(g, 0.34, 0.02, 0.23, -0.05, h, lz, "charcoal");
  floorQuad(g, 0.28, 0.1, -0.05, h + 0.022, lz - 0.02, "black");
  const lid = tilt(g, -0.05, h + 0.02, lz - 0.11, -0.28);
  box(lid, 0.34, 0.23, 0.012, 0, 0, 0, "charcoal");
  quad(lid, 0.3, 0.19, 0, 0.02, 0.008, "wallSky");
  quad(lid, 0.1, 0.03, -0.06, 0.13, 0.01, "white");
  // The mouse and a cup by it.
  box(g, 0.05, 0.025, 0.08, 0.2, h, 0.02, "black", -0.2);
  cylinder(g, 0.035, 0.09, 0.3, h, -0.12, "tomato", 8);
  // The stool, half under the desk.
  plasticStool(g, -0.05, d / 2 + 0.06, 0.42, "blue");
  return setFootprint(g, [
    { x: 0, z: 0, width: w, depth: d },
    { x: -0.05, z: d / 2 + 0.06, width: 0.32, depth: 0.32 },
  ]);
}

/** A smartphone lying on a plastic stool on charge, its screen lit, its lead down to the floor, and its box beside. */
export function buildPhone(): Group {
  const g = new Group();
  g.name = "prop_phone";
  const top = 0.45;
  plasticStool(g, 0, 0, top, "tomato");
  // The phone, a touch larger than life so it reads, its lit screen and its camera.
  const phone = at(g, 0, 0.01, -0.35, top);
  box(phone, 0.1, 0.014, 0.2, 0, 0, 0, "black");
  floorQuad(phone, 0.086, 0.17, 0, 0.016, 0.005, "wallSky");
  floorQuad(phone, 0.05, 0.03, -0.01, 0.018, -0.03, "white");
  // The lead from its foot over the stool's edge, down a leg and off along the floor.
  cable(g, [[0.06, top + 0.008, 0.08], [0.15, top - 0.01, 0.1], [0.19, 0.25, 0.12], [0.22, 0.02, 0.14]], "white", 0.014);
  floorCable(g, [[0.22, 0.14], [0.3, -0.05], [0.3, -0.22]], "white");
  box(g, 0.05, 0.05, 0.04, 0.3, 0, -0.24, "white");
  // The phone's box on the floor in front of the stool.
  const carton = at(g, -0.2, 0.2, 0.25);
  box(carton, 0.11, 0.06, 0.2, 0, 0, 0, "white");
  box(carton, 0.07, 0.012, 0.14, 0, 0.06, 0, "charcoal");
  return setFootprint(g, [
    { x: 0, z: 0, width: 0.36, depth: 0.36 },
    { x: -0.2, z: 0.2, width: 0.2, depth: 0.2 },
  ]);
}

/**
 * A bed of your own: a low wooden platform frame with a short headboard, a thick new foam mattress in its blue cover
 * with white piping, the clear wrap still on its foot end, and a pillow.
 */
export function buildFoamMattress(): Group {
  const g = new Group();
  g.name = "prop_foam-mattress";
  const w = 1.2;
  const l = 2.0;
  const base = 0.3;
  const mh = 0.22;
  // The frame on four short legs, its headboard at the back.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.08, 0.06, 0.08, sx * (w / 2 - 0.05), 0, sz * (l / 2 - 0.05), "darkWood");
  box(g, w + 0.04, base - 0.06, l + 0.04, 0, 0.06, 0, "wood");
  box(g, w + 0.08, 0.66, 0.06, 0, 0, -l / 2 - 0.04, "darkWood");
  box(g, w + 0.12, 0.04, 0.08, 0, 0.66, -l / 2 - 0.04, "darkWood");
  // The mattress and the piping round its top edge.
  const mw = w - 0.04;
  const ml = l - 0.06;
  box(g, mw, mh, ml, 0, base, 0, "blue");
  const py = base + mh - 0.012;
  for (const s of [-1, 1]) {
    box(g, 0.024, 0.024, ml + 0.024, s * (mw / 2), py, 0, "white");
    box(g, mw + 0.024, 0.024, 0.024, 0, py, s * (ml / 2), "white");
  }
  // The clear wrap still on its foot end, and the pillow at its head.
  box(g, mw + 0.03, mh + 0.015, 0.4, 0, base, ml / 2 - 0.19, "wallSky");
  box(g, 0.62, 0.1, 0.34, 0, base + mh, -ml / 2 + 0.24, "white");
  return setFootprint(g, [{ x: 0, z: -0.02, width: w + 0.12, depth: l + 0.1 }]);
}
