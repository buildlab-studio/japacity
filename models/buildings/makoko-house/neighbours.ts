// The neighbours on Makoko's channel (city.md place.makoko), so the channel reads as a neighbourhood built by many hands and
// never as one house copied: each house is a set of numbers given to one builder (assets:variants-are-numbers-not-code). Three
// shapes stand on the water: the low one-room house on short stilts with its porch on the water side; the taller house up its
// ladder, its balcony railed in vertical boards; and the two-room house with an annex leaning off its side, wrapped in tarps
// and sacks. The walls are grey sawn planks, close bamboo stems or planks painted once and worn back, black at the waterline;
// the roofs rusty iron, iron painted green or blue and faded, a newer zinc sheet over a hole, or thick palm thatch. Each leans a
// little, as the older houses do. No real building is copied. Every house faces +z, its lowest point on the water at y = 0.
import { type FootprintBox, type PaletteName, setFootprint } from "@japacity/model-kit";
import { beam, box, cylinder, floorQuad, onWall, quad, seeded, solid, type Vec3 } from "@japacity/model-kit/kit";
import { Group, type Object3D } from "three";

/** What the porch or the walls keep where the channel sees them. */
type Clutter = "drum" | "jerrycans" | "laundry" | "net" | "firewood" | "basins";

/** One neighbour as numbers: its shape, sizes, walls, roof, lean and what stands on its porch. */
export interface NeighbourSpec {
  name: string;
  seed: number;
  shape: "low" | "tall" | "annex";
  /** The room's width along x, depth along z, the floor's height over the water, the walls' height over the floor, the porch's depth. */
  width: number;
  depth: number;
  floor: number;
  walls: number;
  porch: number;
  /** Grey sawn planks, close bamboo stems, or planks painted once in `paint` and worn back to `band` low down. */
  wall: "planks" | "bamboo" | "painted";
  paint?: PaletteName;
  band?: PaletteName;
  /** Rusty iron, palm thatch, or iron painted this colour and faded in patches. */
  roof: "rust" | "thatch" | PaletteName;
  /** A newer sheet laid over a hole in the roof, or a tarp held down by stones. */
  patch: PaletteName | null;
  /** Radians the walls and roof lean over to the left. */
  lean: number;
  /** The shutters' and the door's colour. */
  shutter: PaletteName;
  clutter: readonly Clutter[];
}

/** The neighbours the channel stands, by the variant letter they ship under (`building_makoko-house_<letter>`). */
export const NEIGHBOURS: Readonly<Record<"c" | "d" | "e" | "f" | "g", NeighbourSpec>> = {
  // A low hut of close bamboo stems under thick thatch, its floor near the water.
  c: { name: "building_makoko-house_c", seed: 3101, shape: "low", width: 3.8, depth: 3.2, floor: 0.6, walls: 2.0, porch: 1.0, wall: "bamboo", roof: "thatch", patch: null, lean: 0.03, shutter: "darkWood", clutter: ["basins", "firewood"] },
  // The taller house up its ladder, painted once and faded, its blue roof rusting at the edges.
  d: { name: "building_makoko-house_d", seed: 3102, shape: "tall", width: 4.6, depth: 3.6, floor: 1.4, walls: 2.3, porch: 1.2, wall: "painted", paint: "wallPeach", band: "darkWood", roof: "roofBlue", patch: "zincRust", lean: -0.015, shutter: "blue", clutter: ["laundry", "jerrycans"] },
  // The two-room house with its annex under tarp, rusty iron over both.
  e: { name: "building_makoko-house_e", seed: 3103, shape: "annex", width: 5.4, depth: 3.8, floor: 0.9, walls: 2.2, porch: 1.3, wall: "planks", roof: "rust", patch: "blue", lean: 0.02, shutter: "darkWood", clutter: ["drum", "net"] },
  // The plain one-room house of grey planks, a new zinc sheet bright over its rust.
  f: { name: "building_makoko-house_f", seed: 3104, shape: "low", width: 4.6, depth: 3.6, floor: 1.0, walls: 2.2, porch: 1.4, wall: "planks", roof: "rust", patch: "zinc", lean: -0.025, shutter: "darkWood", clutter: ["drum", "jerrycans", "laundry"] },
  // A one-room house painted green over its planks, black low down, under faded green iron.
  g: { name: "building_makoko-house_g", seed: 3105, shape: "low", width: 4.2, depth: 3.4, floor: 0.8, walls: 2.1, porch: 1.1, wall: "painted", paint: "wallMint", band: "black", roof: "roofGreen", patch: "zinc", lean: 0.012, shutter: "orange", clutter: ["basins", "net"] },
};

const GREYS: PaletteName[] = ["concrete", "concreteWorn", "hub", "khaki", "concrete", "darkWood", "concreteWorn"];
const STEMS: PaletteName[] = ["khaki", "tan", "wood", "khaki", "tan"];

/** Crooked poles from the lagoon bed to the floor, black where the water keeps them wet. */
function stilts(g: Group, random: () => number, xs: readonly number[], zs: readonly number[], floor: number): void {
  for (const x of xs) {
    for (const z of zs) {
      const lean = (random() - 0.5) * 0.1;
      beam(g, [x, 0, z], [x + lean, floor - 0.08, z + lean * 0.4], 0.12, random() < 0.5 ? "black" : "darkWood");
    }
  }
}

/** One wall face in its own frame (x along it, +z out): planks, stems or paint, its door and windows cut as dark shapes. */
function face(frame: Object3D, random: () => number, spec: NeighbourSpec, length: number, height: number, openings: readonly { x: number; w: number; sill: number; top: number }[]): void {
  if (spec.wall === "bamboo") {
    for (let x = -length / 2 + 0.035; x < length / 2; x += 0.075) quad(frame, 0.062, height - random() * 0.06, x, 0, 0.004, STEMS[Math.floor(random() * STEMS.length)] ?? "khaki");
    box(frame, length, 0.05, 0.05, 0, height * 0.3, 0.02, "darkWood");
    box(frame, length, 0.05, 0.05, 0, height * 0.75, 0.02, "darkWood");
  } else {
    for (let x = -length / 2 + 0.13; x < length / 2; x += 0.26) {
      const shade = spec.wall === "painted" ? (spec.paint ?? "wallCream") : (GREYS[Math.floor(random() * GREYS.length)] ?? "concrete");
      quad(frame, 0.24, height - random() * 0.05, x, 0, 0.004, shade);
    }
    // Black at the waterline, worn back to the planks low down where it was painted.
    quad(frame, length, 0.35, 0, 0, 0.008, spec.wall === "painted" ? (spec.band ?? "darkWood") : "black");
  }
  for (const opening of openings) {
    quad(frame, opening.w, opening.top - opening.sill, opening.x, opening.sill, 0.012, "black");
    // The plank shutter or the door's leaf swung open on its side.
    quad(frame, opening.w * 0.5, opening.top - opening.sill, opening.x - opening.w * 0.75, opening.sill, 0.016, spec.shutter);
  }
}

/** A gable over the room, its ridge along x, its eaves `over` out: iron sheet with its corrugations and patches, or thatch. */
function roof(g: Object3D, random: () => number, spec: NeighbourSpec, width: number, back: number, front: number, eave: number, rise: number): void {
  const over = 0.3;
  const hw = width / 2 + over;
  const zc = (back + front) / 2;
  const b = back - over;
  const f = front + over;
  const ridge = eave + rise;
  if (spec.roof === "thatch") {
    // Thick palm thatch: two slabs a hand thick, a darker fringe hanging at the eaves, the ridge capped.
    for (const side of [1, -1] as const) {
      const edge = side === 1 ? f : b;
      const top: Vec3[] = [[-hw, eave - 0.15, edge], [hw, eave - 0.15, edge], [hw, ridge, zc], [-hw, ridge, zc]];
      const under: Vec3[] = top.map(([x, y, z]) => [x, y - 0.22, z]);
      const corners = [...top, ...under];
      solid(g, corners, side === 1 ? [[0, 1, 2, 3], [4, 5, 1, 0], [7, 6, 5, 4]] : [[3, 2, 1, 0], [0, 1, 5, 4], [4, 5, 6, 7]], random() < 0.5 ? "khaki" : "tan");
      quad(g, width + over * 2, 0.22, 0, eave - 0.37, edge + side * 0.01, "wood", side === 1 ? 0 : Math.PI);
    }
    // Darker strands of palm down each slope, so the thatch reads as bundles laid, never a board.
    for (let x = -hw + 0.18; x < hw; x += 0.34) {
      for (const side of [1, -1] as const) {
        const edge = side === 1 ? f : b;
        const strand: Vec3[] = [[x, eave - 0.15 + 0.01, edge], [x + 0.05, eave - 0.15 + 0.01, edge], [x + 0.05, ridge + 0.01, zc], [x, ridge + 0.01, zc]];
        solid(g, strand, side === 1 ? [[0, 1, 2, 3]] : [[3, 2, 1, 0]], random() < 0.5 ? "wood" : "darkWood");
      }
    }
    beam(g, [-hw, ridge + 0.04, zc], [hw, ridge + 0.04, zc], 0.2, "wood");
    for (const x of [-width / 2, width / 2]) solid(g, [[x, eave, back], [x, eave, front], [x, ridge - 0.1, zc]], x < 0 ? [[0, 1, 2], [2, 1, 0]] : [[0, 2, 1], [1, 2, 0]], "darkWood");
    return;
  }
  const sheet: PaletteName = spec.roof === "rust" ? "zincRust" : spec.roof;
  const slope = (side: 1 | -1, x: number, share: number, lift = 0.012): Vec3 => {
    const z0 = side === 1 ? f : b;
    return [x, eave - 0.06 + share * (ridge - eave + 0.06) + lift, z0 + share * (zc - z0)];
  };
  for (const side of [1, -1] as const) {
    const corners = [slope(side, -hw, 0, 0), slope(side, hw, 0, 0), slope(side, hw, 1, 0), slope(side, -hw, 1, 0)];
    solid(g, corners, side === 1 ? [[0, 1, 2, 3], [3, 2, 1, 0]] : [[0, 3, 2, 1], [1, 2, 3, 0]], sheet);
    // The corrugations as darker lines down the slope; on a painted sheet, rust where the paint has gone.
    for (let x = -hw + 0.22; x < hw; x += 0.48) {
      const colour: PaletteName = sheet === "zincRust" ? (random() < 0.3 ? "laterite" : "darkWood") : random() < 0.35 ? "zincRust" : "darkWood";
      const w = colour === "darkWood" ? 0.05 : 0.3;
      const strip = [slope(side, x, 0), slope(side, x + w, 0), slope(side, x + w, 0.92), slope(side, x, 0.92)];
      solid(g, strip, side === 1 ? [[0, 1, 2, 3]] : [[0, 3, 2, 1]], colour);
    }
  }
  if (spec.patch !== null) {
    // The newer sheet or the tarp over the hole, on the slope the channel sees; a tarp is held down by two stones.
    const x0 = -hw + 0.6 + random() * (hw - 0.8);
    const patch = [slope(1, x0, 0.2, 0.024), slope(1, x0 + 1.1, 0.2, 0.024), slope(1, x0 + 1.1, 0.8, 0.024), slope(1, x0, 0.8, 0.024)];
    solid(g, patch, [[0, 1, 2, 3]], spec.patch);
    if (spec.patch === "blue" || spec.patch === "hub") {
      for (const share of [0.35, 0.65]) {
        const [sx, sy, sz] = slope(1, x0 + 0.3 + share * 0.5, share, 0.03);
        box(g, 0.2, 0.12, 0.18, sx, sy, sz, "concreteWorn");
      }
    }
  }
  for (const x of [-width / 2, width / 2]) solid(g, [[x, eave, back], [x, eave, front], [x, ridge - 0.05, zc]], x < 0 ? [[0, 1, 2], [2, 1, 0]] : [[0, 2, 1], [1, 2, 0]], spec.wall === "painted" ? (spec.paint ?? "concreteWorn") : "concreteWorn");
}

/** What the porch keeps where the channel sees it, from the porch's left. */
function clutter(g: Object3D, spec: NeighbourSpec, floor: number, front: number, edge: number): void {
  const hw = spec.width / 2;
  let x = -hw + 0.4;
  for (const kind of spec.clutter) {
    switch (kind) {
      case "drum":
        cylinder(g, 0.28, 0.82, x + 0.05, floor, front + 0.35, "black", 8);
        x += 0.75;
        break;
      case "jerrycans":
        box(g, 0.22, 0.36, 0.16, x, floor, front + 0.3, "danfoYellow", 0.2);
        box(g, 0.22, 0.36, 0.16, x + 0.28, floor, front + 0.25, "danfoYellow", -0.15);
        x += 0.7;
        break;
      case "basins":
        cylinder(g, 0.3, 0.14, x + 0.1, floor, front + 0.45, "black", 8, 0.36);
        cylinder(g, 0.26, 0.12, x + 0.1, floor + 0.14, front + 0.45, "basin", 8, 0.32);
        x += 0.8;
        break;
      case "net":
        box(g, 0.9, 0.22, 0.45, x + 0.35, floor, front + 0.4, "cream", 0.1);
        box(g, 0.7, 0.14, 0.38, x + 0.38, floor + 0.22, front + 0.42, "white", -0.1);
        x += 1.1;
        break;
      case "firewood":
        for (let i = 0; i < 4; i++) beam(g, [x, floor + 0.08 + (i % 2) * 0.12, front + 0.25 + i * 0.1], [x + 0.9, floor + 0.08 + (i % 2) * 0.12, front + 0.3 + i * 0.1], 0.09, i % 2 === 0 ? "darkWood" : "wood");
        x += 1.1;
        break;
      case "laundry": {
        // A line under the eaves along the porch's side, a wrapper and a shirt pegged on it.
        const lx = hw - 0.08;
        beam(g, [lx, floor + 1.8, front + 0.05], [lx, floor + 1.8, edge - 0.1], 0.02, "black");
        quad(g, 0.5, 0.65, lx, floor + 1.14, front + 0.4, "wine", Math.PI / 2);
        quad(g, 0.5, 0.65, lx, floor + 1.14, front + 0.4, "wine", -Math.PI / 2);
        quad(g, 0.4, 0.5, lx, floor + 1.29, front + 0.95, "gold", Math.PI / 2);
        quad(g, 0.4, 0.5, lx, floor + 1.29, front + 0.95, "gold", -Math.PI / 2);
        break;
      }
      default: {
        const never: never = kind;
        throw new Error(`Unknown clutter: ${String(never)}`);
      }
    }
  }
}

/** The room's box, its four faces dressed, its door and windows: in the frame given, the floor at y = floor. */
function room(body: Object3D, random: () => number, spec: NeighbourSpec, width: number, back: number, front: number, floor: number, walls: number, door: boolean): void {
  const depth = front - back;
  const zc = (back + front) / 2;
  box(body, width - 0.04, walls - 0.02, depth - 0.04, 0, floor, zc, spec.wall === "painted" ? (spec.paint ?? "concreteWorn") : spec.wall === "bamboo" ? "tan" : "concreteWorn");
  const openings = door
    ? [
        { x: -width / 4, w: 0.8, sill: 0, top: 1.85 },
        { x: width / 4, w: 0.65, sill: 0.95, top: 1.6 },
      ]
    : [{ x: 0, w: 0.6, sill: 1.0, top: 1.6 }];
  face(onWall(body, 0, floor, front), random, spec, width, walls, openings);
  face(onWall(body, -width / 2, floor, zc, -Math.PI / 2), random, spec, depth, walls, [{ x: 0.2, w: 0.55, sill: 1.0, top: 1.55 }]);
  face(onWall(body, width / 2, floor, zc, Math.PI / 2), random, spec, depth, walls, []);
}

/** One neighbour from its numbers. */
export function buildNeighbour(spec: NeighbourSpec): Group {
  const root = new Group();
  root.name = spec.name;
  const random = seeded(spec.seed);
  const { width, depth, floor, walls, porch } = spec;
  const hw = width / 2;
  const back = -(depth + porch) / 2;
  const front = back + depth;
  const edge = front + porch;
  const annex = spec.shape === "annex" ? 2.0 : 0;
  const footprint: FootprintBox[] = [{ x: annex / 2, z: back + (depth + porch) / 2, width: width + annex + 0.2, depth: depth + porch + 0.1 }];

  // Stilts under the room and the porch, the platform and the porch's boards a finger apart.
  const xs = [-hw + 0.1, -hw / 3, hw / 3, hw - 0.1];
  stilts(root, random, xs, [back + 0.1, (back + front) / 2, front, edge - 0.1], floor);
  box(root, width + 0.1, 0.1, depth + porch, 0, floor - 0.12, back + (depth + porch) / 2, "darkWood");
  for (let x = -hw + 0.13; x < hw; x += 0.27) floorQuad(root, 0.24, porch - 0.02, x, floor + 0.002, front + porch / 2, GREYS[Math.floor(random() * GREYS.length)] ?? "concrete");

  // The walls and the roof lean over a little, pivoting on the porch's right corner.
  const leaning = new Group();
  leaning.position.set(hw, 0, 0);
  leaning.rotation.z = spec.lean;
  root.add(leaning);
  const body = new Group();
  body.position.set(-hw, 0, 0);
  leaning.add(body);
  room(body, random, spec, width, back, front, floor, walls, true);
  const eave = floor + walls;
  roof(body, random, spec, width, back, front, eave, spec.roof === "thatch" ? 1.1 : 0.8);
  // The porch's posts, its eave carried forward over it as a lean-to of the same sheet.
  for (const x of [-hw + 0.08, hw - 0.08]) box(body, 0.1, walls - 0.15, 0.1, x, floor, edge - 0.08, "darkWood");
  if (spec.roof !== "thatch") {
    const sheet: PaletteName = spec.roof === "rust" ? "zincRust" : spec.roof;
    const low = floor + walls - 0.2;
    solid(body, [[hw + 0.3, low, edge + 0.2], [-hw - 0.3, low, edge + 0.2], [-hw - 0.3, eave - 0.02, front], [hw + 0.3, eave - 0.02, front]], [[0, 1, 2, 3], [3, 2, 1, 0]], sheet);
  }

  if (spec.shape === "tall") {
    // An upper room over the first, its balcony railed in vertical boards, a ladder-stair down to the porch.
    const upper = eave;
    box(body, width + 0.1, 0.1, depth + porch, 0, upper - 0.1, back + (depth + porch) / 2, "darkWood");
    room(body, random, spec, width, back, front, upper, walls - 0.2, true);
    for (let x = -hw + 0.06; x < hw; x += 0.16) quad(body, 0.12, 0.85, x, upper, edge - 0.08, random() < 0.5 ? "darkWood" : "wood");
    box(body, width, 0.06, 0.08, 0, upper + 0.85, edge - 0.08, "darkWood");
    roof(body, random, spec, width, back, front, upper + walls - 0.2, 0.75);
    const lx = hw - 0.55;
    for (const s of [-1, 1]) beam(body, [lx + s * 0.22, floor, edge - 0.3], [lx + s * 0.22, upper + 0.02, front + 0.15], 0.06, "darkWood");
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      box(body, 0.48, 0.04, 0.12, lx, floor + t * (upper - floor), edge - 0.3 + t * (front + 0.15 - edge + 0.3), "wood");
    }
  }

  if (spec.shape === "annex") {
    // The annex off the right side: a lower room on its own stilts, its roof a lean-to sagging off the eave, wrapped in tarps and
    // woven sacks where the planks gave out.
    const ax = hw + annex / 2;
    const ad = depth - 0.6;
    const az = back + 0.3 + ad / 2;
    stilts(root, random, [hw + annex - 0.1, hw + annex / 2], [back + 0.4, back + ad + 0.2], floor - 0.1);
    box(body, annex, 0.1, ad, ax, floor - 0.2, az, "darkWood");
    box(body, annex - 0.05, walls - 0.45, ad - 0.05, ax, floor - 0.1, az, "concreteWorn");
    const wraps: [PaletteName, number, number][] = [["blue", -0.45, 1.2], ["hub", 0.55, 0.9], ["white", -0.4, 0.55], ["danfoYellow", 0.5, 0.5]];
    for (const [colour, x, y] of wraps) quad(body, annex * 0.55, y < 1 ? 0.6 : 0.85, ax + x, floor - 0.1 + y - 0.5, az + ad / 2 + 0.01, colour);
    for (let i = 0; i < 3; i++) quad(body, 0.6, 0.08, ax - 0.2 + i * 0.15, floor + 0.7 + i * 0.35, az + ad / 2 + 0.02, i % 2 === 0 ? "white" : "basin");
    const top = floor + walls - 0.55;
    solid(body, [[hw, eave - 0.1, back + 0.1], [hw, eave - 0.1, back + ad + 0.5], [hw + annex + 0.3, top, back + ad + 0.5], [hw + annex + 0.3, top, back + 0.1]], [[0, 1, 2, 3], [3, 2, 1, 0]], "zincRust");
    quad(body, annex * 0.7, 0.8, ax + 0.2, top - 0.5, back + ad + 0.52, "blue");
  }

  clutter(body, spec, floor, front, edge);
  return setFootprint(root, footprint);
}
