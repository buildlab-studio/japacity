// The room a character may rent in Makoko, one building seen from two sides: from the channel as a house on stilts
// (`buildWaterHouse`, the walk's copies of `building_makoko-house_a`), and from inside as a wide home seen whole, its
// roof off and its near walls at the knee (`buildWaterRoom`, world:room-seen-down-its-length). Built as the settlement
// builds: short stilts driven into the lagoon bed, a plank floor with gaps, walls of mixed grey planks with one side
// of close bamboo stems and a patch of blue tarp and woven sacks where planks are gone, a rusty iron roof with a tarp
// over a hole, the whole leaning a little; the porch on the water side under the eaves, and a heavy plank laid at a
// slant from the walk up to it. The two builders share the sizes, the plank shades and the seed, so the room seen
// inside is the house seen outside. Every piece faces +z (the porch) with its lowest point on the water at y = 0.
import { type FootprintBox, type PaletteName, setFootprint, wallNode, type WallSide } from "@japacity/model-kit";
import { beam, box, cylinder, floorQuad, quad, seeded, solid, type Vec3 } from "@japacity/model-kit/kit";
import { Group, type Object3D } from "three";

/** The row of floor boards, counted from the back wall, where a board is gone, and where along x the short board is nailed across. */
const GONE_ROW = 12;
const GONE_X = -0.35;

/**
 * The house's sizes in metres: the room `width` along x and `depth` along z, the porch's depth in front of it, the
 * floor's height over the water, the walls' height over the floor, and the ramp's run from the porch's edge to its foot.
 */
export const WATER_HOUSE = { width: 5.0, depth: 4.0, porch: 1.6, floor: 0.85, walls: 2.2, ramp: 1.5 } as const;

/** The z of the room's back wall, its front wall, the porch's edge and the ramp's foot, in the house's own frame. */
export function waterLines(): { back: number; front: number; edge: number; foot: number } {
  const { depth, porch, ramp } = WATER_HOUSE;
  const back = -(depth + porch) / 2;
  const front = back + depth;
  const edge = front + porch;
  return { back, front, edge, foot: edge + ramp };
}

/** Where the ramp runs along x, its middle. */
export const RAMP_X = 1.55;
/** The door in the front wall, its middle along x and its width. */
export const DOOR = { x: 0.9, width: 0.8, height: 1.85 } as const;

/** The weathered planks: silver grey, a brown one here and there. */
const GREYS: PaletteName[] = ["concrete", "concreteWorn", "hub", "concrete", "khaki", "concreteWorn", "zinc", "darkWood"];
const PLANK = 0.24;
const GAP = 0.025;
const T = 0.06;

/** One wall of the house: from and to on the floor, which way its outer face looks, what it is made of. */
interface Side {
  side: WallSide;
  from: readonly [number, number];
  to: readonly [number, number];
  kind: "planks" | "bamboo" | "patched";
}

function sides(): Side[] {
  const { width } = WATER_HOUSE;
  const { back, front } = waterLines();
  const hw = width / 2;
  return [
    { side: "back", from: [-hw, back], to: [hw, back], kind: "planks" },
    { side: "left", from: [-hw, front], to: [-hw, back], kind: "bamboo" },
    { side: "front", from: [hw, front], to: [-hw, front], kind: "planks" },
    { side: "right", from: [hw, back], to: [hw, front], kind: "patched" },
  ];
}

/** A wall's own frame: along x from its middle, its inner face toward +z (into the room), the floor at y = 0 of the frame. */
function frameOf(g: Object3D, wall: Side, floor: number): { frame: Group; length: number } {
  const [x0, z0] = wall.from;
  const [x1, z1] = wall.to;
  const frame = new Group();
  frame.position.set((x0 + x1) / 2, floor, (z0 + z1) / 2);
  frame.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
  g.add(frame);
  return { frame, length: Math.hypot(x1 - x0, z1 - z0) };
}

/** The spans of a wall between its openings, as [from, to] along it. */
function spans(length: number, holes: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  let start = -length / 2;
  for (const [at, width] of [...holes].sort((a, b) => a[0] - b[0])) {
    if (at - width / 2 > start + 0.01) out.push([start, at - width / 2]);
    start = at + width / 2;
  }
  if (length / 2 > start + 0.01) out.push([start, length / 2]);
  return out;
}

/** The front wall's window, its middle along x in the house's frame, its width, sill and top. */
const WINDOW = { x: -1.2, width: 0.7, sill: 0.95, top: 1.6 } as const;
/** The front wall runs from +x to -x, so along it the door and the window stand at minus their x. */
const DOOR_AT = -DOOR.x;
const WINDOW_AT = -WINDOW.x;

function holesOf(wall: Side): [number, number][] {
  return wall.side === "front" ? [[DOOR_AT, DOOR.width], [WINDOW_AT, WINDOW.width]] : [];
}

/**
 * Vertical planks across a span, each its own grey, a finger's gap between them. `faces` 1 draws the outer face only
 * (the house from outside, a dark room behind); 2 draws both, so the room sees the light through the gaps.
 */
function plankSpan(frame: Group, random: () => number, from: number, to: number, height: number, faces: 1 | 2, bottom = 0): void {
  for (let x = from; x < to - 0.04; x += PLANK) {
    const w = Math.min(PLANK, to - x) - GAP;
    const shade = GREYS[Math.floor(random() * GREYS.length)] ?? "concrete";
    const h = height - bottom - random() * 0.08;
    quad(frame, w, h, x + w / 2 + GAP / 2, bottom, -T / 2, shade, Math.PI);
    if (faces === 2) quad(frame, w, h, x + w / 2 + GAP / 2, bottom, T / 2, shade);
  }
}

/** The stems' shades: dry bamboo and palm, pale and brown, no two neighbours alike. */
const STEMS: PaletteName[] = ["khaki", "tan", "wood", "khaki", "tan", "darkWood", "khaki", "wood"];

/**
 * Close bamboo stems standing side by side as a fence does, each its own shade and height, a hair of light between them, and
 * two battens across holding them: never a board with lines drawn on it.
 */
function bambooSpan(frame: Group, random: () => number, from: number, to: number, height: number, faces: 1 | 2): void {
  const stem = 0.058;
  const step = 0.068;
  for (let x = from + step / 2; x < to - 0.01; x += step) {
    const shade = STEMS[Math.floor(random() * STEMS.length)] ?? "khaki";
    const h = height - random() * 0.12;
    quad(frame, stem, h, x, 0, -0.012, shade, Math.PI);
    if (faces === 2) quad(frame, stem, h, x, 0, 0.012, shade);
  }
  for (const y of [height * 0.28, height * 0.72]) {
    quad(frame, to - from, 0.05, (from + to) / 2, y, -0.03, "darkWood", Math.PI);
    if (faces === 2) quad(frame, to - from, 0.05, (from + to) / 2, y, 0.03, "darkWood");
  }
}

/** Where planks are gone on the right side: a blue tarp sagging over the hole and two woven sacks nailed below it. */
function patch(frame: Group, faces: 1 | 2): void {
  const tarp = (z: number, ry: number) => {
    quad(frame, 1.3, 0.55, 0.3, 1.0, z, "blue", ry);
    quad(frame, 1.25, 0.4, 0.32, 0.62, z, "basin", ry);
  };
  tarp(-T / 2 - 0.01, Math.PI);
  quad(frame, 0.6, 0.55, -0.55, 0.05, -T / 2 - 0.01, "white", Math.PI);
  quad(frame, 0.55, 0.5, 0.1, 0.08, -T / 2 - 0.012, "danfoYellow", Math.PI);
  quad(frame, 0.5, 0.04, -0.55, 0.32, -T / 2 - 0.014, "khaki", Math.PI);
  if (faces === 2) {
    tarp(T / 2 + 0.01, 0);
    quad(frame, 0.6, 0.55, 0.55, 0.05, T / 2 + 0.01, "white");
    quad(frame, 0.55, 0.5, -0.1, 0.08, T / 2 + 0.012, "danfoYellow");
  }
}

/** One wall full height: its spans of planks or stems, the door's and the window's frames, the patch where it has one. */
function fullWall(g: Object3D, wall: Side, random: () => number, floor: number, faces: 1 | 2): FootprintBox[] {
  const { walls } = WATER_HOUSE;
  const { frame, length } = frameOf(g, wall, floor);
  const holes = holesOf(wall);
  for (const [a, b] of spans(length, holes)) {
    if (wall.kind === "bamboo") bambooSpan(frame, random, a, b, walls, faces);
    else plankSpan(frame, random, a, b, walls, faces);
  }
  if (wall.kind === "patched") patch(frame, faces);
  if (wall.side === "front") {
    // Over the door and round the window, planks across; the door's leaf swung out against the wall, Z-braced; the
    // window's plank shutter hung on its side and open.
    const over = walls - DOOR.height;
    box(frame, DOOR.width + 0.1, over, T, DOOR_AT, DOOR.height, 0, "concreteWorn");
    for (const s of [-1, 1]) box(frame, 0.06, DOOR.height, T + 0.02, DOOR_AT + s * (DOOR.width / 2 + 0.03), 0, 0, "darkWood");
    box(frame, DOOR.width - 0.05, DOOR.height - 0.05, 0.04, DOOR_AT - DOOR.width - 0.02, 0, -T / 2 - 0.04, "wood");
    beam(frame, [DOOR_AT - DOOR.width * 0.65, 0.3, -T / 2 - 0.07], [DOOR_AT - DOOR.width * 1.35, 1.5, -T / 2 - 0.07], 0.06, "darkWood");
    box(frame, WINDOW.width + 0.1, WINDOW.sill, T, WINDOW_AT, 0, 0, "concrete");
    box(frame, WINDOW.width + 0.1, walls - WINDOW.top, T, WINDOW_AT, WINDOW.top, 0, "concreteWorn");
    box(frame, 0.36, WINDOW.top - WINDOW.sill, 0.04, WINDOW_AT + WINDOW.width / 2 + 0.2, WINDOW.sill, -T / 2 - 0.04, "darkWood");
  }
  // The wall blocks the ground under its spans; only the door lets anyone through, the window keeps its sill.
  const [x0, z0] = wall.from;
  const [x1, z1] = wall.to;
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  return spans(length, holes.filter(([at]) => at === DOOR_AT)).map(([a, b]) => {
    const share = (a + b) / 2 / length + 0.5;
    return { x: x0 + (x1 - x0) * share, z: z0 + (z1 - z0) * share, width: along ? b - a : 0.12, depth: along ? 0.12 : b - a };
  });
}

/** The same wall cut to the knee: three boards across both faces with the top capped, the stems for the bamboo side, the door kept as its frame. */
function lowWall(g: Object3D, wall: Side, floor: number, random: () => number): void {
  const { frame, length } = frameOf(g, wall, floor);
  const knee = 0.6;
  const holes = wall.side === "front" ? [[DOOR_AT, DOOR.width] as [number, number]] : [];
  for (const [a, b] of spans(length, holes)) {
    if (wall.kind === "bamboo") {
      bambooSpan(frame, random, a, b, knee, 2);
      continue;
    }
    const shades: PaletteName[] = ["concrete", "concreteWorn", "hub"];
    shades.forEach((shade, i) => {
      quad(frame, b - a, 0.17, (a + b) / 2, i * 0.2, -T / 2, shade, Math.PI);
      quad(frame, b - a, 0.17, (a + b) / 2, i * 0.2, T / 2, shade);
    });
    floorQuad(frame, b - a, T, (a + b) / 2, 0.57, 0, "concreteWorn");
  }
  if (wall.side === "front") {
    // The door kept as its frame, so the way in still reads over the cut wall.
    for (const s of [-1, 1]) box(frame, 0.06, DOOR.height, T + 0.02, DOOR_AT + s * (DOOR.width / 2 + 0.03), 0, 0, "darkWood");
    box(frame, DOOR.width + 0.12, 0.07, T + 0.02, DOOR_AT, DOOR.height, 0, "darkWood");
  }
}

/** Stilts: crooked round poles in rows, black where the water keeps them wet, each leaning a little. */
function stilts(g: Group, random: () => number, floor: number): void {
  const { width } = WATER_HOUSE;
  const { back, front, edge } = waterLines();
  const hw = width / 2;
  for (const z of [back + 0.1, front, edge - 0.1]) {
    for (const x of [-hw + 0.1, -hw / 3, hw / 3, hw - 0.1]) {
      const lean = (random() - 0.5) * 0.08;
      beam(g, [x, 0, z], [x + lean, floor - 0.1, z + lean * 0.5], 0.13, random() < 0.5 ? "black" : "darkWood");
    }
  }
}

/** The floor: bearers on the stilts, a black skirt round the edge, boards with gaps over the room and the porch. */
function floorOf(g: Group, random: () => number, floor: number, gaps: boolean): void {
  const { width, depth, porch } = WATER_HOUSE;
  const { back, edge } = waterLines();
  const hw = width / 2;
  const all = depth + porch;
  for (const x of [-hw + 0.1, 0, hw - 0.1]) box(g, 0.14, 0.12, all, x, floor - 0.2, back + all / 2, "darkWood");
  // The skirt stops a finger under the boards, so its top never shares their height.
  box(g, width + 0.12, 0.1, 0.08, 0, floor - 0.12, back, "black");
  box(g, width + 0.12, 0.1, 0.08, 0, floor - 0.12, edge, "black");
  for (const s of [-1, 1]) box(g, 0.08, 0.1, all, s * (hw + 0.02), floor - 0.12, back + all / 2, "black");
  if (!gaps) {
    box(g, width, 0.06, depth, 0, floor - 0.06, back + depth / 2, "concreteWorn");
  }
  // Boards along x: across the room where a room is seen, and over the porch always. Seen from inside they lie a hand's width
  // apart in places, so the dark water shows between them; one by the door is gone, a short board nailed across the hole.
  const board = 0.26;
  const from = gaps ? back : back + depth;
  let row = 0;
  for (let z = from + board / 2; z < edge; z += board) {
    const shade = GREYS[Math.floor(random() * GREYS.length)] ?? "concrete";
    const plank: PaletteName = shade === "zinc" ? "khaki" : shade;
    const gap = gaps ? (row % 3 === 1 ? 0.075 : 0.045) : 0.03;
    if (gaps && row === GONE_ROW) {
      // Only the board's two ends are left; between them the water, and a short board nailed across.
      const end = width / 2 - 0.65;
      for (const s of [-1, 1]) floorQuad(g, end, board - gap, s * (width / 2 - end / 2), floor + 0.002, z, plank);
      floorQuad(g, 0.32, board + 0.2, GONE_X, floor + 0.016, z, "wood", 0.12);
    } else floorQuad(g, width + (random() - 0.5) * 0.1, board - gap, (random() - 0.5) * 0.05, floor + 0.002, z, plank);
    row += 1;
  }
}

/** The heavy plank laid at a slant from the walk up to the porch, a cleat or two nailed across it for the feet. */
function ramp(g: Group, floor: number, footY: number): FootprintBox {
  const { edge, foot } = waterLines();
  const top: Vec3 = [RAMP_X, floor - 0.03, edge - 0.15];
  const low: Vec3 = [RAMP_X, footY, foot];
  beam(g, [top[0] - 0.12, top[1], top[2]], [low[0] - 0.12, low[1], low[2]], 0.07, "darkWood");
  beam(g, [top[0] + 0.12, top[1], top[2]], [low[0] + 0.12, low[1], low[2]], 0.07, "wood");
  for (const share of [0.3, 0.65]) {
    const y = top[1] + (low[1] - top[1]) * share + 0.04;
    const z = top[2] + (low[2] - top[2]) * share;
    box(g, 0.42, 0.03, 0.05, RAMP_X, y, z, "black");
  }
  // The ramp blocks the water beside the walk, never the walk its foot rests on.
  return { x: RAMP_X, z: (edge + foot - 0.2) / 2, width: 0.4, depth: foot - 0.2 - edge };
}

/** The porch's posts at the corners of its edge, a line between them for the washing. */
function porchPosts(g: Group, floor: number, height: number): void {
  const { width } = WATER_HOUSE;
  const { edge } = waterLines();
  const hw = width / 2;
  for (const x of [-hw + 0.08, hw - 0.08]) box(g, 0.11, height, 0.11, x, floor, edge - 0.08, "darkWood");
}

/** The house's dark inside, seen through the gaps from the channel. */
function darkInside(g: Group, floor: number): void {
  const { width, depth, walls } = WATER_HOUSE;
  const { back } = waterLines();
  box(g, width - 0.1, walls - 0.05, depth - 0.1, 0, floor, back + depth / 2, "charcoal");
}

/** A gable of rusty iron over the room, its ridge along x, and a lean-to over the porch from the front eave. */
function roof(g: Group, random: () => number, floor: number): void {
  const { width, walls } = WATER_HOUSE;
  const { back, front, edge } = waterLines();
  const hw = width / 2 + 0.3;
  const eave = floor + walls;
  const ridge = eave + 0.75;
  const zc = (back + front) / 2;
  const b = back - 0.3;
  const f = front + 0.05;
  const sheet = (corners: Vec3[]) => solid(g, corners, [[0, 1, 2, 3], [3, 2, 1, 0]], "zincRust");
  sheet([[-hw, eave - 0.05, b], [hw, eave - 0.05, b], [hw, ridge, zc], [-hw, ridge, zc]]);
  sheet([[hw, eave - 0.05, f], [-hw, eave - 0.05, f], [-hw, ridge, zc], [hw, ridge, zc]]);
  const low = floor + 2.1;
  const end = edge + 0.25;
  sheet([[hw, low, end], [-hw, low, end], [-hw, eave - 0.03, front - 0.1], [hw, eave - 0.03, front - 0.1]]);
  // The gable ends in planks.
  for (const x of [-width / 2, width / 2]) solid(g, [[x, eave, back], [x, eave, front], [x, ridge - 0.04, zc]], [[0, 1, 2], [2, 1, 0]], "concreteWorn");
  // The corrugations, darker lines down each slope; a newer sheet and a blue tarp over a hole, two stones on the tarp.
  const on = (x: number, share: number, side: 1 | -1, lift = 0.012): Vec3 => {
    const z0 = side === 1 ? f : b;
    return [x, eave - 0.05 + share * (ridge - eave + 0.05) + lift, z0 + share * (zc - z0)];
  };
  for (const side of [1, -1] as const) {
    for (let x = -hw + 0.25; x < hw; x += 0.45) {
      const strip = [on(x, 0, side), on(x + 0.06, 0, side), on(x + 0.06, 1, side), on(x, 1, side)];
      solid(g, strip, side === 1 ? [[0, 1, 2, 3]] : [[0, 3, 2, 1]], random() < 0.3 ? "laterite" : "darkWood");
    }
  }
  solid(g, [on(0.9, 0.15, 1, 0.02), on(2.0, 0.15, 1, 0.02), on(2.0, 0.85, 1, 0.02), on(0.9, 0.85, 1, 0.02)], [[0, 1, 2, 3]], "zinc");
  solid(g, [on(-2.0, 0.25, 1, 0.025), on(-0.7, 0.25, 1, 0.025), on(-0.7, 0.95, 1, 0.025), on(-2.0, 0.95, 1, 0.025)], [[0, 1, 2, 3]], "blue");
  for (const x of [-1.7, -1.0]) {
    const [sx, sy, sz] = on(x, 0.6, 1, 0.03);
    box(g, 0.2, 0.12, 0.18, sx, sy, sz, "concreteWorn");
  }
  for (let x = -hw + 0.3; x < hw; x += 0.5) {
    const strip: Vec3[] = [[x, low + 0.012, end], [x + 0.06, low + 0.012, end], [x + 0.06, eave - 0.018, front - 0.1], [x, eave - 0.018, front - 0.1]];
    solid(g, strip, [[0, 1, 2, 3]], "darkWood");
  }
}

/** The water things on the porch the channel sees: the black drum with its lid, a yellow jerrycan, washing on a line. */
function porchThings(g: Group, floor: number): void {
  const { width } = WATER_HOUSE;
  const { front, edge } = waterLines();
  const hw = width / 2;
  cylinder(g, 0.3, 0.85, -hw + 0.45, floor, front + 0.4, "black", 8);
  cylinder(g, 0.31, 0.04, -hw + 0.45, floor + 0.85, front + 0.4, "charcoal", 8);
  box(g, 0.22, 0.36, 0.3, -hw + 0.95, floor, front + 0.3, "danfoYellow");
  box(g, 0.22, 0.36, 0.3, -hw + 1.2, floor, front + 0.32, "danfoYellow", 0.3);
  beam(g, [-hw + 0.08, floor + 1.75, edge - 0.08], [-hw + 0.08, floor + 1.75, front + 0.05], 0.02, "black");
  for (const [z, w, h, colour] of [[front + 0.45, 0.5, 0.62, "wine"], [front + 1.0, 0.45, 0.52, "teal"]] as const) {
    quad(g, w, h, -hw + 0.08, floor + 1.74 - h, z, colour, Math.PI / 2);
    quad(g, w, h, -hw + 0.08, floor + 1.74 - h, z, colour, -Math.PI / 2);
  }
}

/** The house from the channel: stilts, floor, the room's four walls full, the roof, the porch and the ramp to the walk. */
export function buildWaterHouse(walkTop: number): Group {
  const root = new Group();
  root.name = "building_makoko-house_a";
  const random = seeded(2310);
  const { floor, width, depth } = WATER_HOUSE;
  const { back } = waterLines();
  stilts(root, random, floor);
  floorOf(root, random, floor, false);
  // The walls and the roof lean a little to the left, as the settlement's older houses do.
  const leaning = new Group();
  leaning.position.set(width / 2, 0, 0);
  leaning.rotation.z = 0.022;
  root.add(leaning);
  const body = new Group();
  body.position.set(-width / 2, 0, 0);
  leaning.add(body);
  darkInside(body, floor);
  for (const wall of sides()) fullWall(body, wall, random, floor, 1);
  roof(body, random, floor);
  porchPosts(body, floor, 2.1);
  porchThings(body, floor);
  const rampBox = ramp(root, floor, walkTop);
  return setFootprint(root, [{ x: 0, z: back + depth / 2, width: width + 0.2, depth: depth + WATER_HOUSE.porch }, rampBox]);
}

/** The places in the room the scene stands its things at, in the house's own frame: `[x, z]`. */
export const ROOM_SPOTS = {
  /** The mattress on the floor along the back wall's left, its head to the bamboo side. */
  bed: [-1.25, -1.95],
  /** The cupboard against the back wall's right, clothes piled on it. */
  cupboard: [1.55, -2.5],
  /** The tin trunk by the bamboo wall, under the calendar. */
  trunk: [-2.15, -0.25],
  /** The lamp on its stool between the mattress and the door. */
  lamp: [-0.15, -1.15],
  /** The cooking on its tin sheet at the porch's left. */
  fire: [-0.45, 2.1],
  /** The drum and the jerrycans against the front wall on the porch's left. */
  drum: [-2.0, 1.55],
  /** The net bundle on the porch's right, by the ramp's head. */
  net: [2.1, 2.2],
} as const;

/** A wrapper hung as a curtain across the room's back right corner, half drawn on its rope; and the mosquito net's rope across. */
function curtain(g: Group, floor: number): void {
  const { back } = waterLines();
  const z = back + 1.35;
  beam(g, [0.3, floor + 1.95, back + 0.05], [0.3, floor + 1.95, z], 0.02, "black");
  beam(g, [0.3, floor + 1.95, z], [1.15, floor + 1.95, z], 0.02, "black");
  const bands: PaletteName[] = ["orange", "wine", "gold", "wine"];
  bands.forEach((colour, i) => {
    quad(g, 0.18, 1.75, 0.39 + i * 0.17, floor + 0.15, z + (i % 2) * 0.03, colour);
    quad(g, 0.18, 1.75, 0.39 + i * 0.17, floor + 0.15, z + (i % 2) * 0.03, colour, Math.PI);
  });
  // The rope the net hangs from, wall to wall over the mattress.
  beam(g, [-WATER_HOUSE.width / 2 + 0.05, floor + 1.95, back + 0.9], [-0.1, floor + 1.95, back + 0.9], 0.015, "black");
}

/** On the back wall: a calendar on a nail and clothes hung on nails, a shirt, a wrapper, a cap. */
function wallThings(full: Group, floor: number): void {
  const { back } = waterLines();
  const face = back + 0.05;
  const hang = (x: number, y: number, w: number, h: number, colour: PaletteName) => quad(full, w, h, x, floor + y, face, colour);
  hang(-0.55, 1.25, 0.42, 0.62, "white");
  hang(-0.55, 1.65, 0.36, 0.2, "green");
  for (let row = 0; row < 3; row++) hang(-0.55, 1.33 + row * 0.08, 0.34, 0.02, "concrete");
  hang(0.95, 1.0, 0.45, 0.65, "denim");
  hang(1.5, 0.75, 0.4, 0.95, "teal");
  hang(1.95, 1.2, 0.3, 0.45, "red");
  for (const x of [0.95, 1.5, 1.95]) box(full, 0.03, 0.03, 0.05, x, floor + 1.7, face, "black");
  // A newer plank nailed across where an old one split, and a plastic bag pushed into a gap against the rain.
  quad(full, 1.1, 0.2, -1.7, floor + 0.55, face + 0.012, "wood");
  for (const x of [-2.15, -1.25]) quad(full, 0.03, 0.03, x, floor + 0.63, face + 0.016, "black");
  quad(full, 0.16, 0.12, -2.05, floor + 1.75, face + 0.01, "basin");
}

/** The tarp screen over the water at the porch's back corner, round the hole in the planks. */
function screen(g: Group, floor: number): FootprintBox {
  const { width } = WATER_HOUSE;
  const { front } = waterLines();
  const x0 = -width / 2 - 1.0;
  const x1 = -width / 2 - 0.02;
  const z0 = front + 0.1;
  const z1 = front + 1.1;
  const high = 1.7;
  for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1]] as const) box(g, 0.07, high + 0.1, 0.07, x, floor - 0.1, z, "darkWood");
  // Two boards over the water inside it, the hole between them.
  for (const x of [x0 + 0.2, x1 - 0.25]) floorQuad(g, 0.3, z1 - z0, x, floor + 0.002, (z0 + z1) / 2, "concreteWorn");
  // The grey tarp round three sides, sagging a little, tied to a rope along the top.
  quad(g, z1 - z0, high - 0.05, x0, floor - 0.05, (z0 + z1) / 2, "hub", -Math.PI / 2);
  quad(g, z1 - z0, high - 0.05, x0, floor - 0.05, (z0 + z1) / 2, "hub", Math.PI / 2);
  quad(g, x1 - x0, high - 0.05, (x0 + x1) / 2, floor - 0.05, z0, "concrete");
  quad(g, x1 - x0, high - 0.05, (x0 + x1) / 2, floor - 0.05, z0, "concrete", Math.PI);
  quad(g, x1 - x0 - 0.35, high - 0.05, (x0 + x1) / 2 - 0.17, floor - 0.05, z1, "hub");
  quad(g, x1 - x0 - 0.35, high - 0.05, (x0 + x1) / 2 - 0.17, floor - 0.05, z1, "hub", Math.PI);
  beam(g, [x0, floor + high, z0], [x0, floor + high, z1], 0.02, "black");
  for (const x of [x0, x1]) beam(g, [x, 0, z1], [x, floor - 0.1, z1], 0.1, "black");
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, width: x1 - x0, depth: z1 - z0 };
}

/**
 * The room seen whole from inside (world:room-seen-down-its-length): the house with its roof off, every outer side twice,
 * full and at the knee (`wall_<side>_full`, `wall_<side>_low`), the planks drawn on both faces so the day shows through
 * their gaps, the floor's boards apart over the dark water. The scene stands it lowered by `WATER_HOUSE.floor`, so the
 * floor is where the character walks and the stilts go down into the lagoon.
 */
export function buildWaterRoom(walkTop: number): Group {
  const root = new Group();
  root.name = "building_makoko-room";
  const random = seeded(2310);
  const { floor, width } = WATER_HOUSE;
  const { front, edge } = waterLines();
  stilts(root, random, floor);
  floorOf(root, random, floor, true);
  const footprint: FootprintBox[] = [];
  for (const wall of sides()) {
    const full = new Group();
    full.name = wallNode(wall.side, "full");
    full.userData = { node: full.name };
    root.add(full);
    const low = new Group();
    low.name = wallNode(wall.side, "low");
    low.userData = { node: low.name };
    root.add(low);
    footprint.push(...fullWall(full, wall, random, floor, 2));
    lowWall(low, wall, floor, random);
    if (wall.side === "back") wallThings(full, floor);
  }
  curtain(root, floor);
  porchPosts(root, floor, 2.1);
  // The washing line from the left post to the house's corner, over the porch's side.
  beam(root, [-width / 2 + 0.08, floor + 1.85, edge - 0.08], [-width / 2 + 0.08, floor + 1.85, front + 0.05], 0.02, "black");
  footprint.push(screen(root, floor));
  footprint.push(ramp(root, floor, walkTop));
  // The posts at the porch's edge block where they stand; the room's floor and the porch are walked on.
  for (const x of [-width / 2 + 0.08, width / 2 - 0.08]) footprint.push({ x, z: edge - 0.08, width: 0.15, depth: 0.15 });
  return setFootprint(root, footprint);
}
