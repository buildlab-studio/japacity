// The kit of parts (R-ASSET-016), ported from the design's city.js and extended with the
// parts asked for. Sizes come from the part table on
// docs/rules/assets.md; KIT_SIZES holds them so the tests can check every part.
// Parts fixed to a wall are drawn in the wall's own frame: the face is z = 0 and
// looks along +z. `onWall` gives that frame.
import { ExtrudeGeometry, Group, Mesh, type Object3D, Path, Quaternion, Shape, Vector2, Vector3 } from "three";

import type { PaletteName } from "../palette";
import { addSignAnchor, type SignStyle } from "../sign";
import { beam, box, cylinder, extrude, floorQuad, paletteMaterial, quad, solid, type Vec3 } from "./shapes";

export const KIT_SIZES = {
  storey: 3.0,
  shopStorey: 3.6,
  wall: 0.23,
  slab: 0.15,
  block: { length: 0.45, height: 0.225 },
  roof: { pitchMinDeg: 20, pitchMaxDeg: 30, eaves: 0.6 },
  parapet: { height: 1.0, thickness: 0.15, coping: 0.05 },
  balcony: { depthMin: 1.2, depthMax: 1.5, rail: 1.0 },
  stairs: { rise: 0.17, going: 0.27, widthMin: 1.0, widthMax: 1.2, maxRisers: 12 },
  door: { width: 0.9, doubleWidth: 1.2, height: 2.1 },
  window: { size: 1.2, sill: 0.9 },
  gate: { widthMin: 3.0, widthMax: 3.6, heightMin: 2.1, heightMax: 2.4, doorWidth: 0.9, doorHeight: 2.1 },
  fence: { height: 2.4, thickness: 0.15 },
  tank: { smallAcross: 1.2, smallHigh: 1.0, largeAcross: 1.4, largeHigh: 1.4, standMin: 3, standMax: 6 },
  generator: { small: [0.6, 0.45, 0.45] as Vec3, large: [2.0, 1.3, 1.0] as Vec3 },
  dish: { across: 0.85, elevationDeg: 50 },
  fascia: { heightMin: 0.6, heightMax: 0.9 },
  poleSign: { width: 1.2, height: 0.8, bottom: 2.4 },
  awning: { depthMin: 1.0, depthMax: 1.5, edgeMin: 2.2, fallMinDeg: 5, fallMaxDeg: 10 },
  bay: { widthMin: 3.0, widthMax: 4.0, height: 3.0, shutterBox: 0.3, opening: 2.25 },
  drain: { width: 0.45, depth: 0.6 },
  pole: { height: 9, spanMin: 30, spanMax: 40 },
} as const;

const DEG = Math.PI / 180;

/** A frame on a wall face at (x, y, z), looking along +z turned ry: draw wall parts in it. */
export function onWall(g: Object3D, x: number, y: number, z: number, ry = 0): Group {
  const frame = new Group();
  frame.position.set(x, y, z);
  frame.rotation.y = ry;
  g.add(frame);
  return frame;
}

/** The worn shade of a wall colour (R-ASSET-017): wear is a darker named colour, never a texture. */
const WORN: Partial<Record<PaletteName, PaletteName>> = {
  wallCream: "wallCreamWorn",
  wallPeach: "wallPeachWorn",
  wallMint: "wallMintWorn",
  wallSky: "wallSkyWorn",
  white: "wallCreamWorn",
};

export function wornShade(colour: PaletteName): PaletteName {
  return WORN[colour] ?? "concreteWorn";
}

// ---------------------------------------------------------------------------
// Openings, in a wall frame. `y` is the floor the opening stands on.
// ---------------------------------------------------------------------------

/** A window sill 0.06 thick standing 0.12 proud: its front and its top are all a viewer sees. */
function windowSill(w: Object3D, x: number, y: number, width: number): void {
  quad(w, width, 0.06, x, y - 0.06, 0.12, "concrete");
  floorQuad(w, width, 0.12, x, y, 0.06, "concrete");
}

/** A ground-floor window with burglar bars: 1.2 by 1.2, sill 0.9 above the floor. */
export function barredWindow(w: Object3D, x: number, floorY: number): void {
  const { size, sill } = KIT_SIZES.window;
  const y = floorY + sill;
  quad(w, size + 0.16, size + 0.16, x, y - 0.08, 0.004, "concrete");
  quad(w, size, size, x, y, 0.01, "glass");
  windowSill(w, x, y, size + 0.2);
  for (let i = 1; i < 5; i++) quad(w, 0.035, size, x - size / 2 + (i * size) / 5, y, 0.06, "black");
  for (const by of [0.3, 0.9]) quad(w, size, 0.035, x, y + by, 0.062, "black");
}

/** An upper window with glass louvres: the Lagos window. Silver slat edges across dark glass read at phone size. */
export function louvreWindow(w: Object3D, x: number, floorY: number): void {
  const { size, sill } = KIT_SIZES.window;
  const y = floorY + sill;
  quad(w, size + 0.16, size + 0.16, x, y - 0.08, 0.004, "white");
  quad(w, size, size, x, y, 0.01, "glass");
  for (let i = 0; i < 4; i++) quad(w, size - 0.04, 0.04, x, y + 0.16 + i * 0.27, 0.02, "hub");
  quad(w, 0.04, size, x, y, 0.022, "white");
  windowSill(w, x, y, size + 0.2);
}

/** A door leaf in its frame: 0.9 by 2.1, or 1.2 by 2.1 for a double door (R-ASSET-004). */
export function door(w: Object3D, x: number, floorY: number, double = false, colour: PaletteName = "darkWood"): void {
  const width = double ? KIT_SIZES.door.doubleWidth : KIT_SIZES.door.width;
  const { height } = KIT_SIZES.door;
  quad(w, width + 0.14, height + 0.07, x, floorY, 0.004, "concrete");
  quad(w, width, height, x, floorY, 0.01, colour);
  if (double) quad(w, 0.03, height, x, floorY, 0.014, "black");
  quad(w, 0.06, 0.12, x + width / 2 - 0.12, floorY + 1.0, 0.016, "hub");
}

/**
 * A shopfront bay's opening: a 2.4 m opening under a roller shutter box 0.3 deep.
 * Open shows the dark shop and its goods; shut shows the ribbed shutter.
 */
export function shopOpening(w: Object3D, x: number, floorY: number, width: number, open: boolean, random: () => number): void {
  const { opening, shutterBox } = KIT_SIZES.bay;
  box(w, width + 0.1, shutterBox, shutterBox, x, floorY + opening, shutterBox / 2, "black");
  if (!open) {
    quad(w, width, opening, x, floorY, 0.01, "zinc");
    for (let i = 1; i < 5; i++) quad(w, width, 0.03, x, floorY + (i * opening) / 5, 0.014, "hub");
    quad(w, 0.3, 0.05, x, floorY + 0.15, 0.016, "black");
    return;
  }
  quad(w, width, opening, x, floorY, 0.01, "canvas");
  // Goods brought to the front of the opening: a shelf of tins and packets, and something hung at the door.
  box(w, width * 0.7, 0.05, 0.3, x, floorY + 0.9, 0.18, "wood");
  const goods: PaletteName[] = ["red", "danfoYellow", "white", "green", "blue", "orange"];
  for (let i = 0; i < 3; i++) {
    const colour = goods[Math.floor(random() * goods.length)] ?? "red";
    box(w, 0.3, 0.2 + random() * 0.1, 0.18, x - width * 0.3 + (i + 0.5) * (width * 0.6) / 3, floorY + 0.95, 0.18, colour);
  }
  quad(w, 0.35, 0.6, x - width / 2 + 0.3, floorY + 1.6, 0.03, goods[Math.floor(random() * goods.length)] ?? "orange");
}

// ---------------------------------------------------------------------------
// Signs. The board is in the body; the face is an anchor the client draws (R-ASSET-012).
// ---------------------------------------------------------------------------

/** A signboard on a wall frame: the board in the body, its face recorded on `root` with its text key. */
export function signboard(
  root: Object3D,
  w: Object3D,
  key: string,
  style: SignStyle,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  // The face is drawn over the board's front; the board shows its edge from above and below.
  quad(w, width, height, x, y, 0.06, style.board);
  floorQuad(w, width, 0.06, x, y + height, 0.03, style.board);
  w.updateWorldMatrix(true, false);
  root.updateWorldMatrix(true, false);
  const centre = new Vector3(x, y + height / 2, 0.062).applyMatrix4(w.matrixWorld).applyMatrix4(root.matrixWorld.clone().invert());
  const facing = new Vector3(0, 0, 1).applyQuaternion(w.getWorldQuaternion(new Quaternion()));
  addSignAnchor(root, { key, centre: [centre.x, centre.y, centre.z], width, height, ry: Math.atan2(facing.x, facing.z), style });
}

/** An awning over a door or a bay: 1.0 to 1.5 deep, falling 5 to 10 degrees, front edge at least 2.2 m up. */
export function awning(w: Object3D, x: number, topY: number, width: number, depth: number, fallDeg: number, colour: PaletteName): void {
  const sheet = new Group();
  sheet.position.set(x, topY, 0);
  sheet.rotation.x = fallDeg * DEG;
  w.add(sheet);
  box(sheet, width, 0.04, depth, 0, -0.04, depth / 2, colour);
}

// ---------------------------------------------------------------------------
// Floors, roofs and parapets, in the building's frame.
// ---------------------------------------------------------------------------

/** The slab edge between storeys, a band of concrete 0.15 high round the walls. */
export function slabBand(g: Object3D, w: number, d: number, x: number, y: number, z: number): void {
  box(g, w + 0.06, KIT_SIZES.slab, d + 0.06, x, y, z, "concrete");
}

/** A parapet 1.0 above the roof slab, 0.15 thick, with a coping band 0.05 proud. */
export function parapet(g: Object3D, w: number, d: number, x: number, y: number, z: number, colour: PaletteName): void {
  const { height, thickness, coping } = KIT_SIZES.parapet;
  ring(g, w, d, thickness, x, y, z, height - 0.06, colour);
  ring(g, w + 2 * coping, d + 2 * coping, thickness + 2 * coping, x, y + height - 0.06, z, 0.06, "concrete");
}

/** A rectangular ring of wall, w by d outside and `thickness` thick, `height` high from y. */
function ring(g: Object3D, w: number, d: number, thickness: number, x: number, y: number, z: number, height: number, colour: PaletteName): void {
  const shape = new Shape([new Vector2(-w / 2, -d / 2), new Vector2(w / 2, -d / 2), new Vector2(w / 2, d / 2), new Vector2(-w / 2, d / 2)]);
  const iw = w / 2 - thickness;
  const id = d / 2 - thickness;
  shape.holes.push(new Path([new Vector2(-iw, -id), new Vector2(-iw, id), new Vector2(iw, id), new Vector2(iw, -id)]));
  const geometry = new ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geometry, paletteMaterial(colour));
  mesh.position.set(x, y, z);
  g.add(mesh);
}

/** A roof pitch in degrees inside the page's 20 to 30. */
export function roofPitch(random: () => number): number {
  const { pitchMinDeg, pitchMaxDeg } = KIT_SIZES.roof;
  return pitchMinDeg + Math.round(random() * (pitchMaxDeg - pitchMinDeg));
}

/**
 * A gable roof of sheet over a w by d block whose walls end at y: the ridge runs along x,
 * eaves 0.6 out, gable ends filled in the wall colour. A few sheets have rusted.
 */
export function gableRoof(
  g: Object3D,
  w: number,
  d: number,
  x: number,
  y: number,
  z: number,
  sheet: PaletteName,
  wall: PaletteName,
  pitchDeg: number,
  random: () => number,
): number {
  const { eaves } = KIT_SIZES.roof;
  const half = d / 2 + eaves;
  const rise = Math.tan(pitchDeg * DEG) * half;
  const t = 0.06;
  const drop = Math.tan(pitchDeg * DEG) * eaves;
  const eaveY = y - drop;
  extrude(g, [[-half, eaveY], [0, eaveY + rise], [half, eaveY], [half, eaveY - t], [0, eaveY + rise - t], [-half, eaveY - t]].map(([a, b]) => [-(a ?? 0), b ?? 0] as const), w + 2 * eaves, sheet, x, 0, z, Math.PI / 2);
  // The gable ends stop under the sheet, so the two never share a surface and fight for the pixel.
  extrude(g, [[-d / 2, y], [0, y + Math.tan(pitchDeg * DEG) * (d / 2) - t - 0.03], [d / 2, y]], w, wall, x, 0, z, Math.PI / 2);
  // Rust patches on the front slope.
  const slope = new Group();
  slope.position.set(x, eaveY + 0.004, z + half);
  slope.rotation.x = -(Math.PI / 2 - pitchDeg * DEG);
  g.add(slope);
  for (let i = 0; i < 3; i++) {
    if (random() < 0.4) continue;
    quad(slope, 0.9, 1.2 + random() * 1.2, (random() - 0.5) * (w - 1), 0.1 + random() * 0.4, 0.01, "zincRust");
  }
  return eaveY + rise;
}

/** A hip roof of sheet: four slopes and a ridge along the longer side, eaves 0.6 out. */
export function hipRoof(g: Object3D, w: number, d: number, x: number, y: number, z: number, sheet: PaletteName, pitchDeg: number): number {
  const { eaves } = KIT_SIZES.roof;
  const hw = w / 2 + eaves;
  const hd = d / 2 + eaves;
  const drop = Math.tan(pitchDeg * DEG) * eaves;
  const e = y - drop;
  const along = hw >= hd;
  const rise = Math.tan(pitchDeg * DEG) * Math.min(hw, hd);
  const ridge = Math.max(0, (along ? hw : hd) - Math.min(hw, hd));
  const top = e + rise;
  const corners: Vec3[] = [
    [x - hw, e, z + hd],
    [x + hw, e, z + hd],
    [x + hw, e, z - hd],
    [x - hw, e, z - hd],
    along ? [x - ridge, top, z] : [x, top, z + ridge],
    along ? [x + ridge, top, z] : [x, top, z - ridge],
  ];
  const faces = along
    ? [[0, 1, 5, 4], [2, 3, 4, 5], [1, 2, 5], [3, 0, 4], [0, 3, 2, 1]]
    : [[0, 1, 4], [2, 3, 5], [1, 2, 5, 4], [3, 0, 4, 5], [0, 3, 2, 1]];
  solid(g, corners, faces, sheet);
  return top;
}

// ---------------------------------------------------------------------------
// Balconies and stairs.
// ---------------------------------------------------------------------------

/** A balcony 1.2 to 1.5 deep on a wall frame, with a solid balustrade 1.0 high or a steel rail. */
export function balcony(w: Object3D, x: number, floorY: number, width: number, depth: number, colour: PaletteName, rail: boolean): void {
  box(w, width, KIT_SIZES.slab, depth, x, floorY - KIT_SIZES.slab, depth / 2, "concrete");
  const h = KIT_SIZES.balcony.rail;
  if (!rail) {
    box(w, width, h, 0.12, x, floorY, depth - 0.06, colour);
    for (const s of [-1, 1]) box(w, 0.12, h, depth - 0.12, x + s * (width / 2 - 0.06), floorY, (depth - 0.12) / 2, colour);
    return;
  }
  for (const ry of [floorY + h, floorY + 0.12]) beam(w, [x - width / 2, ry, depth - 0.03], [x + width / 2, ry, depth - 0.03], 0.05, "black");
  // Balusters face the street; from the side a steel rail is a line, which is how it reads in life.
  const posts = Math.max(2, Math.round(width / 0.3) + 1);
  for (let i = 0; i < posts; i++) quad(w, 0.03, h, x - width / 2 + (i * width) / (posts - 1), floorY, depth - 0.03, "black");
}

/**
 * One flight of stairs: `risers` steps of 0.17 rise and 0.27 going, `width` wide, climbing along +x
 * of its own frame from (x, y, z), turned ry. A flight never has more than 12 risers.
 */
export function stairFlight(g: Object3D, x: number, y: number, z: number, risers: number, rise: number, width: number, ry: number, colour: PaletteName): void {
  const going = KIT_SIZES.stairs.going;
  if (risers > KIT_SIZES.stairs.maxRisers) throw new Error(`stairFlight: ${String(risers)} risers is more than a flight may have`);
  const frame = new Group();
  frame.position.set(x, y, z);
  frame.rotation.y = ry;
  g.add(frame);
  // The waist: a slab under the steps, seen from the side as the flight's slope.
  const run = risers * going;
  extrude(frame, [[0, 0], [going, 0], [run, risers * rise - 0.25], [run, risers * rise], [0, rise]], width, colour);
  // Each step's riser and tread, facing the way a person climbs, so the flight reads as steps from the front and above.
  const steps = new Group();
  steps.rotation.y = -Math.PI / 2;
  frame.add(steps);
  // In this frame +z points back down the flight, so step k sits at z = -k * going.
  for (let k = 0; k < risers; k++) {
    quad(steps, width, rise, 0, k * rise, -k * going + 0.002, colour);
    floorQuad(steps, width, going, 0, (k + 1) * rise + 0.002, -(k * going + going / 2), "concreteWorn");
  }
  beam(frame, [0, rise + 0.9, -width / 2 + 0.03], [run, risers * rise + 0.9, -width / 2 + 0.03], 0.05, "black");
}

// ---------------------------------------------------------------------------
// Gates, fence walls, drains.
// ---------------------------------------------------------------------------

/** A sheet-steel vehicle gate 3.0 to 3.6 wide and 2.1 to 2.4 high, with a 0.9 by 2.1 door cut in it. */
export function gate(w: Object3D, x: number, y: number, width: number, height: number, colour: PaletteName): void {
  for (const s of [-1, 1]) box(w, 0.3, height + 0.2, 0.3, x + s * (width / 2 + 0.15), y, 0, "concrete");
  box(w, width, height, 0.05, x, y + 0.04, 0, colour);
  const dx = x - width / 2 + 0.15 + KIT_SIZES.gate.doorWidth / 2;
  const { doorWidth, doorHeight } = KIT_SIZES.gate;
  for (const s of [-1, 1]) quad(w, 0.025, doorHeight, dx + (s * doorWidth) / 2, y + 0.06, 0.03, "black");
  quad(w, doorWidth, 0.025, dx, y + 0.06 + doorHeight, 0.03, "black");
  quad(w, 0.08, 0.08, dx + doorWidth / 2 - 0.12, y + 1.05, 0.032, "black");
  quad(w, width - doorWidth - 0.4, 0.025, x + doorWidth / 2, y + height - 0.3, 0.03, "black");
  quad(w, 0.025, height - 0.4, x + doorWidth / 2 + 0.15, y + 0.2, 0.03, "black");
}

/** A fence wall 2.4 high and 0.15 thick from x0 to x1 along a wall frame, with a coping band. */
export function fenceWall(w: Object3D, x0: number, x1: number, y: number, colour: PaletteName): void {
  const { height, thickness } = KIT_SIZES.fence;
  const length = Math.abs(x1 - x0);
  const cx = (x0 + x1) / 2;
  box(w, length, height - 0.06, thickness, cx, y, 0, colour);
  box(w, length + 0.04, 0.06, thickness + 0.1, cx, y + height - 0.06, 0, "concrete");
}

/**
 * An open drain along the street edge of a frontage, from x0 to x1 at z: a channel 0.45 wide between
 * two kerbs, with concrete slabs over it where people cross. The channel floor stays at ground level
 * (R-ASSET-003 keeps every model above y = 0); the street around it is lower in a place.
 */
export function drain(g: Object3D, x0: number, x1: number, z: number, top: number, slabsAt: readonly number[]): void {
  const length = x1 - x0;
  const cx = (x0 + x1) / 2;
  const { width } = KIT_SIZES.drain;
  for (const s of [-1, 1]) box(g, length, top, 0.12, cx, 0, z + s * (width / 2 + 0.06), "concrete");
  floorQuad(g, length, width, cx, 0.02, z, "drain");
  for (const sx of slabsAt) {
    floorQuad(g, 1.0, width + 0.3, sx, top + 0.06, z, "concreteWorn");
    quad(g, 1.0, 0.06, sx, top, z + width / 2 + 0.15, "concreteWorn");
  }
}

// ---------------------------------------------------------------------------
// Tanks, generators, dishes, AC units, poles, wires.
// ---------------------------------------------------------------------------

/** A polyethylene tank, 1,000 or 2,000 litres, on a steel stand 3 to 6 high, or flat when stand is 0. */
export function tank(g: Object3D, x: number, y: number, z: number, large: boolean, stand: number, colour: PaletteName): number {
  const s = KIT_SIZES.tank;
  const across = large ? s.largeAcross : s.smallAcross;
  const high = large ? s.largeHigh : s.smallHigh;
  let base = y;
  if (stand > 0) {
    const a = across / 2 - 0.05;
    for (const [sx, sz] of [[-a, -a], [a, -a], [-a, a], [a, a]] as const) box(g, 0.07, stand, 0.07, x + sx, y, z + sz, "black");
    beam(g, [x - a, y + 0.3, z + a], [x + a, y + stand - 0.3, z + a], 0.04, "black");
    beam(g, [x + a, y + 0.3, z - a], [x - a, y + stand - 0.3, z - a], 0.04, "black");
    box(g, across + 0.1, 0.08, across + 0.1, x, y + stand, z, "black");
    base = y + stand + 0.08;
  }
  // Eight sides and a cone lid: the shape of a ribbed plastic tank in 24 triangles.
  const r = across / 2;
  const rim: Vec3[] = [];
  const foot: Vec3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rim.push([x + r * Math.cos(a), base + high * 0.85, z - r * Math.sin(a)]);
    foot.push([x + r * Math.cos(a), base, z - r * Math.sin(a)]);
  }
  const corners: Vec3[] = [...foot, ...rim, [x, base + high, z]];
  const faces: number[][] = [];
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    faces.push([i, j, 8 + j, 8 + i], [8 + i, 8 + j, 16]);
  }
  solid(g, corners, faces, colour);
  return base + high;
}

/** A generator: a small petrol set (0.6 by 0.45 by 0.45) or a large soundproof diesel (2.0 by 1.0 by 1.3). */
export function generator(g: Object3D, x: number, y: number, z: number, large: boolean, ry: number, colour: PaletteName): void {
  const frame = new Group();
  frame.position.set(x, y, z);
  frame.rotation.y = ry;
  g.add(frame);
  const [l, h, w] = large ? KIT_SIZES.generator.large : KIT_SIZES.generator.small;
  if (large) {
    box(frame, l, h, w, 0, 0, 0, colour);
    for (let i = 0; i < 3; i++) quad(frame, l * 0.6, 0.04, 0, 0.4 + i * 0.25, w / 2 + 0.005, "black");
    cylinder(frame, 0.06, 0.4, l / 2 - 0.25, h, 0, "black", 6);
    return;
  }
  box(frame, l, h * 0.75, w, 0, 0.05, 0, colour);
  box(frame, l * 0.5, h * 0.25, w * 0.7, -l * 0.15, 0.05 + h * 0.75, 0, colour);
  quad(frame, l * 0.4, h * 0.35, l * 0.15, 0.12, w / 2 + 0.005, "black");
  beam(frame, [-l / 2 - 0.02, h + 0.05, w / 2], [l / 2 + 0.02, h + 0.05, w / 2], 0.025, "black");
}

/** The direction every dish in a place faces: toward the one satellite, at its yaw, up 50 degrees. */
export function dishDirection(yaw: number): Vec3 {
  const el = KIT_SIZES.dish.elevationDeg * DEG;
  return [Math.cos(el) * Math.sin(yaw), Math.sin(el), Math.cos(el) * Math.cos(yaw)];
}

/**
 * A satellite dish 0.85 across on a short mast at (x, y, z), facing the place's one satellite (R-ASSET-019).
 * `yaw` is in the model's frame; the place turns it so every dish faces the same way.
 */
export function dish(root: Object3D, g: Object3D, x: number, y: number, z: number, yaw: number): void {
  const dir = dishDirection(yaw);
  const r = KIT_SIZES.dish.across / 2;
  box(g, 0.05, 0.7, 0.05, x, y, z, "black");
  const centre: Vec3 = [x + dir[0] * 0.1, y + 0.75, z + dir[2] * 0.1];
  const bowl = cylinder(g, 0.06, 0.16, 0, 0, 0, "white", 10, r, true);
  bowl.geometry.translate(0, -0.08, 0);
  bowl.position.set(...centre);
  bowl.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...dir)));
  beam(g, centre, [centre[0] + dir[0] * 0.45, centre[1] + dir[1] * 0.45, centre[2] + dir[2] * 0.45], 0.03, "black");
  // Recorded in the model's own frame, so a test can see every dish faces one way.
  g.updateWorldMatrix(true, false);
  root.updateWorldMatrix(true, false);
  const turn = root.getWorldQuaternion(new Quaternion()).invert().multiply(g.getWorldQuaternion(new Quaternion()));
  const world = new Vector3(...dir).applyQuaternion(turn);
  const dishes = (root.userData.dishes ?? []) as Vec3[];
  dishes.push([world.x, world.y, world.z]);
  root.userData.dishes = dishes;
}

/** An air conditioner's outdoor unit on a wall bracket, hung between windows, never over glass. */
export function acUnit(w: Object3D, x: number, y: number): void {
  box(w, 0.8, 0.55, 0.3, x, y, 0.2, "white");
  quad(w, 0.42, 0.42, x - 0.12, y + 0.065, 0.352, "hub");
  box(w, 0.7, 0.04, 0.36, x, y - 0.04, 0.2, "black");
}

/** The electricity meter on a front wall and its cable running up to the roof edge, clipped flat to the wall. */
export function meterAndCable(w: Object3D, x: number, floorY: number, topY: number): void {
  box(w, 0.35, 0.45, 0.15, x, floorY + 1.5, 0.075, "white");
  quad(w, 0.03, topY - floorY - 1.95, x + 0.1, floorY + 1.95, 0.02, "black");
  quad(w, 0.03, topY - floorY - 1.95, x - 0.06, floorY + 1.95, 0.02, "black");
}

/** A wire sagging from a to b, drawn as a few straight pieces. */
export function wire(g: Object3D, a: Vec3, b: Vec3, sag: number, pieces = 4): void {
  let prev = a;
  for (let i = 1; i <= pieces; i++) {
    const t = i / pieces;
    const p: Vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    beam(g, prev, p, 0.025, "black");
    prev = p;
  }
}

/**
 * An electricity pole 9 m high with a cross-arm and three wires sagging to the next pole
 * `span` metres along +x (30 to 40 m). The pole is a prop; each pole carries the wires to its neighbour.
 */
export function pole(g: Object3D, x: number, y: number, z: number, span: number): void {
  const { height } = KIT_SIZES.pole;
  cylinder(g, 0.14, height, x, y, z, "concrete", 6, 0.1);
  box(g, 0.12, 0.12, 1.6, x, y + height - 0.6, z, "concrete");
  for (const s of [-0.65, 0, 0.65]) {
    cylinder(g, 0.04, 0.12, x, y + height - 0.48, z + s, "white", 4);
    wire(g, [x, y + height - 0.38, z + s], [x + span, y + height - 0.38, z + s], 0.9);
  }
  box(g, 0.45, 0.6, 0.35, x, y + height - 2.6, z + 0.25, "concreteWorn");
}

// ---------------------------------------------------------------------------
// Containers and clutter.
// ---------------------------------------------------------------------------

/** A 20-foot container on two sleepers; the street side is ribbed, the back left plain. */
export function container(g: Object3D, w: number, h: number, d: number, x: number, y: number, z: number, colour: PaletteName, ribsFrom: number, ribsTo: number): void {
  for (const s of [-1, 1]) box(g, 0.4, y, d + 0.2, x + s * (w / 2 - 0.5), 0, z, "concreteWorn");
  box(g, w, h, d, x, y, z, colour);
  for (let rx = x - w / 2 + 0.3; rx < x + w / 2 - 0.1; rx += 0.3) {
    if (rx > ribsFrom && rx < ribsTo) continue;
    quad(g, 0.08, h - 0.2, rx, y + 0.1, z + d / 2 + 0.01, "black");
  }
  box(g, w + 0.06, 0.1, d + 0.06, x, y + h - 0.05, z, "zincRust");
}

/** A patch of wear, stain or damp on a wall frame: a darker named colour, never a texture. */
export function stain(w: Object3D, x: number, y: number, width: number, height: number, colour: PaletteName): void {
  quad(w, width, height, x, y, 0.006, colour);
}

/** Posters pasted on a wall: blocks of colour, the paper not the words. */
export function posters(w: Object3D, x: number, y: number, random: () => number, count = 3): void {
  const colours: PaletteName[] = ["white", "danfoYellow", "red", "blue", "green", "cream"];
  for (let i = 0; i < count; i++) {
    quad(w, 0.42, 0.6, x + i * 0.48, y + (random() - 0.5) * 0.15, 0.008 + i * 0.001, colours[Math.floor(random() * colours.length)] ?? "white");
  }
}

export type ClutterKind = "crates" | "drum" | "bench" | "cooler" | "sacks" | "jerrycans";

/** Street clutter: crates, a drum, a bench, a cooler, sacks, jerrycans. */
export function clutter(g: Object3D, kind: ClutterKind, x: number, y: number, z: number): void {
  switch (kind) {
    case "crates":
      box(g, 0.5, 0.32, 0.36, x, y, z, "blue");
      box(g, 0.5, 0.32, 0.36, x + 0.08, y + 0.32, z, "red");
      return;
    case "drum":
      cylinder(g, 0.29, 0.88, x, y, z, "blue", 8);
      return;
    case "bench":
      box(g, 1.4, 0.06, 0.32, x, y + 0.42, z, "wood");
      for (const s of [-1, 1]) box(g, 0.08, 0.42, 0.3, x + s * 0.6, y, z, "darkWood");
      return;
    case "cooler":
      box(g, 0.6, 0.48, 0.42, x, y, z, "white");
      box(g, 0.62, 0.06, 0.44, x, y + 0.48, z, "blue");
      return;
    case "sacks":
      for (const [dx, dz] of [[0, 0], [0.5, 0.1]] as const) {
        solid(
          g,
          [
            [x + dx - 0.24, y, z + dz - 0.18], [x + dx + 0.24, y, z + dz - 0.18], [x + dx + 0.26, y, z + dz + 0.18], [x + dx - 0.26, y, z + dz + 0.18],
            [x + dx - 0.2, y + 0.55, z + dz - 0.1], [x + dx + 0.2, y + 0.55, z + dz - 0.1], [x + dx + 0.16, y + 0.62, z + dz + 0.12], [x + dx - 0.16, y + 0.62, z + dz + 0.12],
          ],
          [[3, 2, 6, 7], [0, 3, 7, 4], [2, 1, 5, 6], [1, 0, 4, 5], [4, 7, 6, 5]],
          "tan",
        );
      }
      return;
    case "jerrycans":
      for (let i = 0; i < 3; i++) box(g, 0.18, 0.42, 0.3, x + i * 0.22, y, z, i === 1 ? "green" : "danfoYellow");
      return;
    default: {
      const never: never = kind;
      throw new Error(`clutter: ${String(never)}`);
    }
  }
}
