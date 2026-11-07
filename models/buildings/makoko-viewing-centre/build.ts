// The viewing centre of Makoko (city.md place.makoko), where the young men watch the football: one plank room on stilts, its walls
// painted blue below and white above and worn back to grey planks in places, a porch in front with the generator that runs the
// screens and a heavy plank down to the walk, a board over the door. Seen two ways, as the room on the water is: from the channel
// as a house (`buildViewingHouse`), and from inside with its roof off and its near walls at the knee (`buildViewingRoom`,
// world:room-seen-down-its-length), each outer side twice, full and low. Every piece faces +z (the porch) with its lowest point
// on the water at y = 0.
import { type FootprintBox, type PaletteName, setFootprint, type SignStyle, wallNode, type WallSide } from "@japacity/model-kit";
import { beam, box, floorQuad, generator, onWall, quad, seeded, signboard, solid, type Vec3 } from "@japacity/model-kit/kit";
import { Group, type Object3D } from "three";

/** The room's width along x and depth along z, the porch's depth, the floor's height over the water, the walls' height, the plank's run. */
export const VIEWING = { width: 6.0, depth: 4.4, porch: 1.3, floor: 0.85, walls: 2.3, ramp: 1.5 } as const;
/** The door in the front wall, its middle along x and its width. */
export const VIEWING_DOOR = { x: 1.6, width: 0.9, height: 1.95 } as const;
/** Where the plank comes down from the porch, its middle along x. */
export const VIEWING_RAMP_X = 1.6;
/** Where the paint stops and the white starts, over the floor. */
const DADO = 1.25;

/** The z of the back wall, the front wall, the porch's edge and the plank's foot, in the building's own frame. */
export function viewingLines(): { back: number; front: number; edge: number; foot: number } {
  const { depth, porch, ramp } = VIEWING;
  const back = -(depth + porch) / 2;
  const front = back + depth;
  const edge = front + porch;
  return { back, front, edge, foot: edge + ramp };
}

interface Side {
  side: WallSide;
  from: readonly [number, number];
  to: readonly [number, number];
}

function sides(): Side[] {
  const hw = VIEWING.width / 2;
  const { back, front } = viewingLines();
  return [
    { side: "back", from: [-hw, back], to: [hw, back] },
    { side: "left", from: [-hw, front], to: [-hw, back] },
    { side: "front", from: [hw, front], to: [-hw, front] },
    { side: "right", from: [hw, back], to: [hw, front] },
  ];
}

/** A wall's own frame: along x from its middle, its inner face toward +z, the floor at y = 0 of the frame. */
function frameOf(g: Object3D, wall: Side, floor: number): { frame: Group; length: number } {
  const [x0, z0] = wall.from;
  const [x1, z1] = wall.to;
  const frame = new Group();
  frame.position.set((x0 + x1) / 2, floor, (z0 + z1) / 2);
  frame.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
  g.add(frame);
  return { frame, length: Math.hypot(x1 - x0, z1 - z0) };
}

/** The front wall's door and the left wall's window, as [middle along the wall, width, sill, top]. */
function holesOf(wall: Side): [number, number, number, number][] {
  if (wall.side === "front") return [[-VIEWING_DOOR.x, VIEWING_DOOR.width, 0, VIEWING_DOOR.height]];
  if (wall.side === "left") return [[0.4, 0.8, 1.0, 1.65]];
  return [];
}

/**
 * Planks across a wall between its openings, blue below the dado and white over it, a few worn back to grey. `faces` 1 draws the
 * outer face; 2 draws both, so the room sees its own paint.
 */
function plankWall(frame: Group, random: () => number, length: number, height: number, holes: readonly [number, number, number, number][], faces: 1 | 2): void {
  const plank = 0.3;
  for (let x = -length / 2 + plank / 2; x < length / 2; x += plank) {
    const hole = holes.find(([at, w]) => Math.abs(x - at) < w / 2 + plank / 2 - 0.02);
    const worn = random() < 0.12;
    const low: PaletteName = worn ? "concreteWorn" : "blue";
    const high: PaletteName = worn ? "concrete" : random() < 0.2 ? "wallCreamWorn" : "white";
    const pieces: [number, number, PaletteName][] = [];
    if (hole === undefined) {
      pieces.push([0, DADO, low], [DADO, height - DADO, high]);
    } else {
      const [, , sill, top] = hole;
      if (sill > 0) pieces.push([0, Math.min(sill, DADO), low]);
      if (sill > DADO) pieces.push([DADO, sill - DADO, high]);
      if (top < height) pieces.push([Math.max(top, DADO), height - Math.max(top, DADO), high]);
    }
    for (const [y, h, colour] of pieces) {
      quad(frame, plank - 0.02, h, x, y, -0.03, colour, Math.PI);
      if (faces === 2) quad(frame, plank - 0.02, h, x, y, 0.03, colour);
    }
  }
  for (const [at, w, sill, top] of holes) {
    // The frame round each opening, and the door's leaf swung back against the wall outside.
    for (const s of [-1, 1]) box(frame, 0.06, top - sill, 0.08, at + s * (w / 2 + 0.03), sill, 0, "darkWood");
    if (sill === 0) box(frame, w - 0.05, top - 0.05, 0.04, at - w - 0.02, 0, -0.08, "wood");
  }
}

/** Stilts in rows under the room and the porch, black where the water keeps them wet. */
function stilts(g: Group, random: () => number, floor: number): void {
  const hw = VIEWING.width / 2;
  const { back, front, edge } = viewingLines();
  for (const z of [back + 0.1, (back + front) / 2, front, edge - 0.1]) {
    for (const x of [-hw + 0.1, -hw / 3, hw / 3, hw - 0.1]) {
      const lean = (random() - 0.5) * 0.08;
      beam(g, [x, 0, z], [x + lean, floor - 0.1, z + lean * 0.5], 0.13, random() < 0.5 ? "black" : "darkWood");
    }
  }
}

/** Bearers, a black skirt and the boards along x a finger apart, over the room and the porch. */
function floorOf(g: Group, random: () => number, floor: number): void {
  const { width, depth, porch } = VIEWING;
  const { back, edge } = viewingLines();
  const all = depth + porch;
  for (const x of [-width / 2 + 0.1, 0, width / 2 - 0.1]) box(g, 0.14, 0.12, all, x, floor - 0.2, back + all / 2, "darkWood");
  // The skirt stops a finger under the boards, so its top never shares their height.
  box(g, width + 0.1, 0.1, 0.08, 0, floor - 0.12, back, "black");
  box(g, width + 0.1, 0.1, 0.08, 0, floor - 0.12, edge, "black");
  const shades: PaletteName[] = ["concrete", "concreteWorn", "hub", "khaki", "darkWood", "concrete"];
  const board = 0.27;
  for (let z = back + board / 2; z < edge; z += board) floorQuad(g, width + (random() - 0.5) * 0.08, board - 0.04, 0, floor + 0.002, z, shades[Math.floor(random() * shades.length)] ?? "concrete");
}

/** The heavy plank from the porch's edge down to the walk, two cleats across it. */
function plank(g: Group, floor: number, walkTop: number): FootprintBox {
  const { edge, foot } = viewingLines();
  const top: Vec3 = [VIEWING_RAMP_X, floor - 0.03, edge - 0.15];
  const low: Vec3 = [VIEWING_RAMP_X, walkTop, foot];
  beam(g, [top[0] - 0.12, top[1], top[2]], [low[0] - 0.12, low[1], low[2]], 0.07, "darkWood");
  beam(g, [top[0] + 0.12, top[1], top[2]], [low[0] + 0.12, low[1], low[2]], 0.07, "wood");
  for (const share of [0.35, 0.7]) box(g, 0.42, 0.03, 0.05, VIEWING_RAMP_X, top[1] + (low[1] - top[1]) * share + 0.04, top[2] + (low[2] - top[2]) * share, "black");
  return { x: VIEWING_RAMP_X, z: (edge + foot - 0.2) / 2, width: 0.4, depth: foot - 0.2 - edge };
}

/** The porch: the generator on its board by the door, its cable to the wall, the posts at the porch's edge. */
function porch(g: Group, floor: number): FootprintBox[] {
  const hw = VIEWING.width / 2;
  const { front, edge } = viewingLines();
  generator(g, -1.2, floor, front + 0.5, false, 0.2, "red");
  beam(g, [-1.0, floor + 0.4, front + 0.4], [-0.6, floor + 1.9, front + 0.02], 0.025, "black");
  for (const x of [-hw + 0.08, hw - 0.08]) box(g, 0.11, VIEWING.walls - 0.1, 0.11, x, floor, edge - 0.08, "darkWood");
  return [
    { x: -1.2, z: front + 0.5, width: 0.7, depth: 0.55 },
    { x: -hw + 0.08, z: edge - 0.08, width: 0.15, depth: 0.15 },
    { x: hw - 0.08, z: edge - 0.08, width: 0.15, depth: 0.15 },
  ];
}

/** The viewing centre from the channel: its walls full, a rusty roof over the room and the porch, its board over the door. */
export function buildViewingHouse(walkTop: number, board: string, style: SignStyle): Group {
  const root = new Group();
  root.name = "building_makoko-viewing-centre";
  const random = seeded(6301);
  const { width, depth, floor, walls } = VIEWING;
  const hw = width / 2;
  const { back, front, edge } = viewingLines();
  stilts(root, random, floor);
  floorOf(root, random, floor);
  box(root, width - 0.1, walls - 0.05, depth - 0.1, 0, floor, back + depth / 2, "charcoal");
  for (const wall of sides()) {
    const { frame, length } = frameOf(root, wall, floor);
    plankWall(frame, random, length, walls, holesOf(wall), 1);
  }
  // The roof: a low gable of rusty iron over the room and a lean-to over the porch.
  const eave = floor + walls;
  const ridge = eave + 0.7;
  const zc = (back + front) / 2;
  const over = 0.3;
  const sheet = (corners: Vec3[]) => solid(root, corners, [[0, 1, 2, 3], [3, 2, 1, 0]], "zincRust");
  sheet([[-hw - over, eave - 0.05, back - over], [hw + over, eave - 0.05, back - over], [hw + over, ridge, zc], [-hw - over, ridge, zc]]);
  sheet([[hw + over, eave - 0.05, front + 0.05], [-hw - over, eave - 0.05, front + 0.05], [-hw - over, ridge, zc], [hw + over, ridge, zc]]);
  sheet([[hw + over, floor + walls - 0.25, edge + 0.25], [-hw - over, floor + walls - 0.25, edge + 0.25], [-hw - over, eave - 0.03, front], [hw + over, eave - 0.03, front]]);
  for (let x = -hw - over + 0.2; x < hw + over; x += 0.5) {
    const strip: Vec3[] = [[x, eave - 0.04, front + 0.06], [x + 0.06, eave - 0.04, front + 0.06], [x + 0.06, ridge + 0.012, zc], [x, ridge + 0.012, zc]];
    solid(root, strip, [[0, 1, 2, 3]], random() < 0.3 ? "laterite" : "darkWood");
  }
  for (const x of [-hw, hw]) solid(root, [[x, eave, back], [x, eave, front], [x, ridge - 0.04, zc]], [[0, 1, 2], [2, 1, 0]], "white");
  // The board over the door, facing the walk.
  signboard(root, onWall(root, 0, eave - 0.62, front + 0.04), board, style, -0.4, 0, 2.6, 0.52);
  const footprint = porch(root, floor);
  footprint.push({ x: 0, z: back + depth / 2, width: width + 0.2, depth: depth + 0.1 });
  footprint.push(plank(root, floor, walkTop));
  return setFootprint(root, footprint);
}

/** The same wall cut to the knee: three boards across, the door kept as its frame. */
function lowWall(g: Object3D, wall: Side, floor: number): void {
  const { frame, length } = frameOf(g, wall, floor);
  const holes = wall.side === "front" ? [[-VIEWING_DOOR.x, VIEWING_DOOR.width] as const] : [];
  const spans: [number, number][] = [];
  let start = -length / 2;
  for (const [at, w] of holes) {
    spans.push([start, at - w / 2]);
    start = at + w / 2;
  }
  spans.push([start, length / 2]);
  for (const [a, b] of spans) (["blue", "roofBlue", "blue"] as const).forEach((shade, i) => box(frame, b - a, 0.17, 0.06, (a + b) / 2, i * 0.2, 0, shade));
  for (const [at, w] of holes) {
    for (const s of [-1, 1]) box(frame, 0.06, VIEWING_DOOR.height, 0.08, at + s * (w / 2 + 0.03), 0, 0, "darkWood");
    box(frame, w + 0.12, 0.07, 0.08, at, VIEWING_DOOR.height, 0, "darkWood");
  }
}

/** The wall pieces each full wall blocks: its spans between the door, the window's sill kept. */
function wallBoxes(wall: Side): FootprintBox[] {
  const [x0, z0] = wall.from;
  const [x1, z1] = wall.to;
  const length = Math.hypot(x1 - x0, z1 - z0);
  const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const door = wall.side === "front" ? [-VIEWING_DOOR.x, VIEWING_DOOR.width] : null;
  const spans: [number, number][] = door === null ? [[-length / 2, length / 2]] : [[-length / 2, (door[0] ?? 0) - (door[1] ?? 0) / 2], [(door[0] ?? 0) + (door[1] ?? 0) / 2, length / 2]];
  return spans.map(([a, b]) => {
    const share = (a + b) / 2 / length + 0.5;
    return { x: x0 + (x1 - x0) * share, z: z0 + (z1 - z0) * share, width: along ? b - a : 0.12, depth: along ? 0.12 : b - a };
  });
}

/**
 * The room seen whole from inside (world:room-seen-down-its-length): the roof off, every outer side twice, full and at the knee
 * (`wall_<side>_full`, `wall_<side>_low`), its paint on both faces. The scene stands it lowered by `VIEWING.floor`, so the floor is
 * where the character walks and the stilts go down into the lagoon.
 */
export function buildViewingRoom(walkTop: number): Group {
  const root = new Group();
  root.name = "building_makoko-viewing-room";
  const random = seeded(6302);
  const { floor, walls } = VIEWING;
  stilts(root, random, floor);
  floorOf(root, random, floor);
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
    const { frame, length } = frameOf(full, wall, floor);
    plankWall(frame, random, length, walls, holesOf(wall), 2);
    lowWall(low, wall, floor);
    footprint.push(...wallBoxes(wall));
  }
  footprint.push(...porch(root, floor));
  footprint.push(plank(root, floor, walkTop));
  return setFootprint(root, footprint);
}
