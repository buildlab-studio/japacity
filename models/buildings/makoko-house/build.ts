// The houses of Makoko on the lagoon (city.md place.makoko), as the settlement builds them: plank
// rooms on stilts driven into the lagoon bed, zinc roofs rusting in patches, every board a little
// different. Three shapes: (a) a one-room house low over the water with a porch at the walkway's
// height, a raised plank bunk on it under the roof's overhang and the door up a step, the room a
// character may rent; (b) a taller house up a ladder, its veranda railed, a board hung on the rail;
// and the classroom on stilts, long and painted, its window band open, its board on the rail. No
// real building is copied. Every piece faces +z with its lowest point on the water at y = 0.
import { type PaletteName, setFootprint, type SignStyle } from "@japacity/assets";
import { box, floorQuad, generator, onWall, quad, seeded, signboard, solid, type Vec3 } from "@japacity/assets/kit";
import { Group } from "three";

import { WALKWAY } from "../../props/plank-walkway/build";

const PLANKS: PaletteName[] = ["wood", "darkWood", "khaki", "wood", "tan"];
const PLANK = 0.32;

/** Stilts: a pole at each point, black where the water reaches, each leaning a little. */
function stilts(root: Group, random: () => number, xs: readonly number[], zs: readonly number[], height: number): void {
  for (const x of xs) {
    for (const z of zs) {
      const lean = (random() - 0.5) * 0.06;
      box(root, 0.12, height, 0.12, x + lean, 0, z, "darkWood");
      box(root, 0.13, Math.min(0.45, height * 0.5), 0.13, x + lean, 0, z, "black");
    }
  }
}

/** Planks across a wall face, each its own shade, or painted with the worn shade low down. */
function planks(face: Group, random: () => number, width: number, height: number, paint: PaletteName | null): void {
  for (let x = -width / 2 + PLANK / 2; x < width / 2 - 0.01; x += PLANK) {
    const shade = paint ?? PLANKS[Math.floor(random() * PLANKS.length)] ?? "wood";
    quad(face, PLANK - 0.015, height, x, 0, 0.005, shade);
  }
  if (paint !== null) quad(face, width - 0.02, 0.45, 0, 0, 0.008, worn(paint));
}

function worn(paint: PaletteName): PaletteName {
  const shades: Partial<Record<PaletteName, PaletteName>> = { wallSky: "wallSkyWorn", wallMint: "wallMintWorn", wallCream: "wallCreamWorn", wallPeach: "wallPeachWorn" };
  return shades[paint] ?? "darkWood";
}

/** A gable of zinc with its ridge along x, rusting in patches, and the gable ends in plank. */
function gableRoof(root: Group, width: number, back: number, front: number, eaves: number, rise: number, rust: readonly [number, number, 1 | -1][]): number {
  const over = 0.35;
  const hw = width / 2;
  const zc = (back + front) / 2;
  const ridge = eaves + rise;
  const corners: Vec3[] = [[-hw - over, eaves - 0.1, back - over], [-hw - over, eaves - 0.1, front + over], [-hw - over, ridge, zc], [hw + over, ridge, zc], [hw + over, eaves - 0.1, front + over], [hw + over, eaves - 0.1, back - over]];
  solid(root, corners, [[1, 4, 3, 2], [5, 0, 2, 3], [4, 1, 2, 3], [0, 5, 3, 2]], "zinc");
  const half = (front - back) / 2 + over;
  const slope = (along: number, share: number, side: 1 | -1): Vec3 => [along, eaves - 0.1 + share * (ridge - eaves + 0.1) + 0.01, zc + side * (1 - share) * half];
  for (const [from, to, side] of rust) {
    const quadOn = [slope(from, 0.15, side), slope(to, 0.15, side), slope(to, 0.6, side), slope(from, 0.6, side)];
    solid(root, quadOn, side === 1 ? [[0, 1, 2, 3]] : [[0, 3, 2, 1]], "zincRust");
  }
  for (const x of [-hw, hw]) solid(root, [[x, eaves, back], [x, eaves, front], [x, ridge - 0.05, zc]], x < 0 ? [[0, 1, 2]] : [[0, 2, 1]], "wood");
  return ridge;
}

/** A ladder from the water up to a floor, its two rails and its rungs. */
function ladder(root: Group, x: number, z: number, floor: number): void {
  for (const s of [-1, 1]) box(root, 0.07, floor + 0.9, 0.07, x + s * 0.25, 0, z, "darkWood");
  for (let y = 0.3; y < floor; y += 0.35) box(root, 0.55, 0.05, 0.05, x, y, z, "wood");
}

/** A rail along the front of a veranda, its posts and its top bar. */
function rail(root: Group, width: number, floor: number, z: number): void {
  box(root, width, 0.06, 0.06, 0, floor + 0.9, z, "darkWood");
  for (let x = -width / 2 + 0.05; x <= width / 2; x += 0.85) box(root, 0.06, 0.9, 0.06, x, floor, z, "darkWood");
}

/** The room a character may rent: one room low over the water, a porch at the walkway's height, a plank bunk on it. */
export const ROOM_HOUSE = { width: 4.2, depth: 3.2, floor: 0.6, walls: 2.2, porch: 1.9 } as const;

/** Where the bunk stands on the porch and its top, in the piece's frame: `[x, z, top]`, the bunk along x. */
export function roomBunk(): [number, number, number] {
  const { width, depth, porch } = ROOM_HOUSE;
  const front = -(depth + porch) / 2 + depth;
  return [-width / 2 + 1.2, front + 0.7, 0.42];
}

export function buildRoomHouse(): Group {
  const root = new Group();
  root.name = "bld_makoko-house_a";
  const random = seeded(2310);
  const { width: w, depth: d, floor, walls, porch } = ROOM_HOUSE;
  const hw = w / 2;
  const back = -(d + porch) / 2;
  const front = back + d;
  const end = front + porch;
  const zc = (back + front) / 2;
  const top = WALKWAY.top;

  // Short stilts under the room, and the room's floor on them.
  stilts(root, random, [-hw + 0.15, 0, hw - 0.15], [back + 0.15, front - 0.15], floor);
  box(root, w + 0.1, 0.1, d, 0, floor - 0.1, zc, "darkWood");
  // The room: a box of planks, a door up a step at the right, a shuttered window at the left.
  box(root, w, walls, d, 0, floor, zc, "wood");
  const face = onWall(root, 0, floor, front);
  planks(face, random, w, walls, null);
  quad(face, 0.8, 1.9, 0.9, 0, 0.012, "black");
  quad(face, 0.38, 1.85, 1.15, 0, 0.016, "teal");
  quad(face, 0.7, 0.6, -1.0, 1.0, 0.012, "black");
  quad(face, 0.34, 0.62, -1.17, 0.99, 0.016, "darkWood");
  quad(face, 1.1, 0.35, -0.2, 0.05, 0.012, "darkWood");
  for (const [x, ry] of [[-hw, -Math.PI / 2], [hw, Math.PI / 2]] as const) planks(onWall(root, x, floor, zc, ry), random, d, walls, null);
  box(root, 0.8, 0.5, 0.36, 0.9, 0, front + 0.18, "darkWood");

  // The porch at the walkway's height: boards along x on bearers and posts.
  for (const x of [-hw, hw]) box(root, 0.1, top - 0.08, 0.1, x, 0, end - 0.1, "black");
  for (let i = 0; i < 6; i++) {
    const z = front + (i + 0.5) * (porch / 6);
    box(root, w + 0.2, 0.035, porch / 6 - 0.02, 0, top - 0.035, z, i % 3 === 1 ? "darkWood" : "wood");
  }
  // The bunk: planks on four legs, a mat on it and a rolled cloth for a pillow.
  const [bx, bz, bunkTop] = roomBunk();
  for (const sx of [-0.9, 0.9]) for (const sz of [-0.35, 0.35]) box(root, 0.08, bunkTop - top, 0.08, bx + sx, top, bz + sz, "darkWood");
  box(root, 2.0, 0.05, 0.85, bx, bunkTop - 0.05, bz, "wood");
  box(root, 1.85, 0.03, 0.75, bx, bunkTop, bz, "wine");
  box(root, 0.25, 0.1, 0.6, bx - 0.8, bunkTop + 0.03, bz, "cream");

  // One slope of zinc over the room and the porch, high at the porch, on two posts at its edge.
  const low = floor + walls + 0.05;
  const high = 3.25;
  for (const x of [-hw + 0.05, hw - 0.05]) box(root, 0.1, high - top, 0.1, x, top, end - 0.1, "darkWood");
  const over = 0.3;
  const sheet: Vec3[] = [
    [-hw - over, low, back - over], [hw + over, low, back - over], [hw + over, high, end + 0.15], [-hw - over, high, end + 0.15],
    [-hw - over, low + 0.06, back - over], [hw + over, low + 0.06, back - over], [hw + over, high + 0.06, end + 0.15], [-hw - over, high + 0.06, end + 0.15],
  ];
  solid(root, sheet, [[4, 7, 6, 5], [0, 1, 2, 3], [3, 2, 6, 7], [0, 4, 5, 1], [0, 3, 7, 4], [1, 5, 6, 2]], "zinc");
  // Rust where the sheets overlap, and a sheet of a newer zinc nailed over a hole.
  const on = (x: number, share: number): Vec3 => [x, low + 0.07 + share * (high - low), back - over + share * (end + 0.15 - back + over)];
  solid(root, [on(-1.8, 0.1), on(-0.7, 0.1), on(-0.7, 0.45), on(-1.8, 0.45)], [[0, 3, 2, 1]], "zincRust");
  solid(root, [on(0.6, 0.55), on(1.9, 0.55), on(1.9, 0.85), on(0.6, 0.85)], [[0, 3, 2, 1]], "zincRust");
  solid(root, [on(-0.4, 0.62), on(0.3, 0.62), on(0.3, 0.8), on(-0.4, 0.8)], [[0, 3, 2, 1]], "hub");

  // A jerrycan against the wall at the bunk's head, a basin turned over on the porch; the cooking and the drum are the place's own.
  box(root, 0.2, 0.36, 0.28, -hw + 0.15, top, front + 0.15, "danfoYellow");
  floorQuad(root, 0.4, 0.4, 0.3, top + 0.002, end - 0.35, "red");
  return setFootprint(root, [
    { x: 0, z: zc, width: w + 0.2, depth: d },
    { x: bx, z: bz, width: 2.0, depth: 0.85 },
  ]);
}

/** The taller house up a ladder: its floor, walls, veranda and the board on its rail. */
export const TALL_HOUSE = { width: 5.0, depth: 3.6, floor: 1.5, walls: 2.3, veranda: 1.3 } as const;

export function buildTallHouse(board: string, style: SignStyle): Group {
  const root = new Group();
  root.name = "bld_makoko-house_b";
  const random = seeded(1885);
  const { width: w, depth: d, floor, walls, veranda } = TALL_HOUSE;
  const hw = w / 2;
  const back = -(d + veranda) / 2;
  const front = back + d;
  const zc = (back + front) / 2;
  const railZ = front + veranda - 0.08;

  stilts(root, random, [-hw + 0.1, -hw / 3, hw / 3, hw - 0.1], [back + 0.1, zc, front, railZ], floor);
  box(root, w + 0.1, 0.12, d + veranda, 0, floor - 0.12, back + (d + veranda) / 2, "darkWood");
  for (let x = -hw + 0.3; x < hw; x += 0.6) floorQuad(root, 0.02, veranda, x, floor + 0.002, front + veranda / 2, "black");
  // The house painted once in sky blue, worn back to the planks low down; a door and two windows.
  box(root, w, walls, d, 0, floor, zc, "wallSky");
  const face = onWall(root, 0, floor, front);
  planks(face, random, w, walls, "wallSky");
  quad(face, 0.85, 1.95, -0.9, 0, 0.012, "black");
  quad(face, 0.4, 1.9, -1.15, 0, 0.016, "darkWood");
  for (const x of [0.7, 1.7]) {
    quad(face, 0.7, 0.6, x, 1.0, 0.012, "black");
    quad(face, 0.36, 0.62, x - 0.18, 0.99, 0.016, "blue");
  }
  for (const [x, ry] of [[-hw, -Math.PI / 2], [hw, Math.PI / 2]] as const) planks(onWall(root, x, floor, zc, ry), random, d, walls, x < 0 ? "wallSky" : null);
  gableRoof(root, w, back, front, floor + walls, 1.05, [[-2.0, -0.8, 1], [0.9, 2.1, -1]]);

  rail(root, w, floor, railZ);
  ladder(root, hw - 0.6, railZ + 0.25, floor);
  // The board hung on the rail, facing the walk.
  signboard(root, onWall(root, -0.45, floor, railZ + 0.04), board, style, 0, 0.12, 2.8, 0.62);
  // A small generator and a jerrycan on the veranda, a bucket on a rope by the ladder.
  generator(root, -1.9, floor, front + 0.45, false, 0.3, "red");
  box(root, 0.2, 0.36, 0.28, 1.2, floor, front + 0.3, "danfoYellow");
  box(root, 0.26, 0.28, 0.26, hw - 0.15, 0.55, railZ + 0.35, "basin");
  // The house over its stilts to the rail, and the ladder's foot in front of it.
  return setFootprint(root, [
    { x: 0, z: back + (d + veranda) / 2, width: w + 0.2, depth: d + veranda + 0.1 },
    { x: hw - 0.6, z: railZ + 0.25, width: 0.7, depth: 0.3 },
  ]);
}

/** The classroom on stilts: long, painted, its window band open, the board on its rail. */
export const SCHOOL = { width: 8.4, depth: 4.0, floor: 1.3, walls: 2.3, veranda: 1.1 } as const;

export function buildSchool(board: string, style: SignStyle): Group {
  const root = new Group();
  root.name = "bld_makoko-school";
  const random = seeded(1914);
  const { width: w, depth: d, floor, walls, veranda } = SCHOOL;
  const hw = w / 2;
  const back = -(d + veranda) / 2;
  const front = back + d;
  const zc = (back + front) / 2;
  const railZ = front + veranda - 0.08;

  stilts(root, random, [-hw + 0.1, -hw / 2, 0, hw / 2, hw - 0.1], [back + 0.1, front, railZ], floor);
  box(root, w + 0.1, 0.12, d + veranda, 0, floor - 0.12, back + (d + veranda) / 2, "darkWood");
  // Painted cream with a blue band, the window band open on the room: dark, with the blackboard's frame showing.
  box(root, w, walls, d, 0, floor, zc, "wallCream");
  const face = onWall(root, 0, floor, front);
  quad(face, w - 0.02, 0.45, 0, 0, 0.008, "wallCreamWorn");
  quad(face, w, 0.12, 0, 0.92, 0.008, "blue");
  for (let x = -hw + 0.9; x < hw - 0.5; x += 1.5) {
    if (Math.abs(x - 2.4) < 0.5) continue;
    quad(face, 1.1, 0.8, x, 1.1, 0.012, "black");
    quad(face, 1.0, 0.04, x, 1.45, 0.016, "darkWood");
  }
  quad(face, 0.9, 1.95, 2.4, 0, 0.012, "black");
  quad(face, 0.45, 1.9, 2.67, 0, 0.016, "blue");
  for (const [x, ry] of [[-hw, -Math.PI / 2], [hw, Math.PI / 2]] as const) {
    const end = onWall(root, x, floor, zc, ry);
    quad(end, d - 0.02, 0.45, 0, 0, 0.008, "wallCreamWorn");
    quad(end, d, 0.12, 0, 0.92, 0.008, "blue");
    quad(end, 1.2, 0.8, 0, 1.1, 0.012, "black");
  }
  gableRoof(root, w, back, front, floor + walls, 1.1, [[-3.6, -2.2, 1], [1.2, 2.6, 1], [-1.0, 0.6, -1]]);

  rail(root, w, floor, railZ);
  ladder(root, hw - 0.7, railZ + 0.25, floor);
  signboard(root, onWall(root, -0.8, floor, railZ + 0.04), board, style, 0, 0.12, 3.4, 0.62);
  // Plastic chairs stacked at the end of the veranda, a hand bell on its post by the door.
  for (let i = 0; i < 3; i++) box(root, 0.45, 0.06, 0.45, -hw + 0.5, floor + 0.42 + i * 0.07, front + 0.4, "basin");
  box(root, 0.06, 1.0, 0.06, 1.7, floor, front + 0.15, "darkWood");
  box(root, 0.12, 0.14, 0.12, 1.7, floor + 1.0, front + 0.15, "gold");
  return setFootprint(root, [
    { x: 0, z: back + (d + veranda) / 2, width: w + 0.2, depth: d + veranda + 0.1 },
    { x: hw - 0.7, z: railZ + 0.25, width: 0.7, depth: 0.3 },
  ]);
}
