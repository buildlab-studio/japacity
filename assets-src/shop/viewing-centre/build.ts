// A football viewing centre (streets.md R-STREET-011): a shed of planks under a zinc lean-to, open to the
// street at the front, a wide dark screen on the back wall with the decoder under it, three rows of benches
// facing it, a hand-painted board over the opening with a ball and the flag's green and white, a dish on the
// roof and the generator at the side for when the light goes at half time. Built facing +Z (R-ASSET-003).
import { setFootprint } from "@japacity/assets";
import { box, cylinder, dish, extrude, floorQuad, generator, onWall, posters, quad, seeded, stain } from "@japacity/assets/kit";
import { Group, type Mesh } from "three";

export const VIEWING_CENTRE = { width: 4.0, depth: 3.6, front: 3.1, back: 2.7, slab: 0.08, seat: 0.44 } as const;

/** The benches' rows, front to back: the z of each bench's middle in the shed's frame. */
export const VIEWING_ROWS: readonly number[] = [-0.55, 0.25, 1.05];

/** A disc facing +Z: a cylinder laid on its side. */
function disc(g: Group, r: number, x: number, y: number, z: number, colour: "white" | "black", segments = 8): Mesh {
  const mesh = cylinder(g, r, 0.02, 0, 0, 0, colour, segments);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildViewingCentre(dishYaw: number): Group {
  const g = new Group();
  g.name = "shop_viewing-centre";
  const random = seeded(90);
  const { width: w, depth: d, front, back, slab, seat } = VIEWING_CENTRE;
  const hw = w / 2;
  const hd = d / 2;
  // The slab floor, a step proud of the pavement.
  box(g, w, slab, d, 0, 0, 0, "concrete");
  // The back wall and the two side walls of planks, the battens dark between them.
  box(g, w, back - slab, 0.06, 0, slab, -hd + 0.03, "wood");
  for (const sx of [-hw + 0.03, hw - 0.03]) {
    extrude(g, [[-hd, slab], [hd, slab], [hd, front], [-hd, back]], 0.06, "wood", sx, 0, 0, -Math.PI / 2);
  }
  const left = onWall(g, -hw - 0.001, 0, 0, -Math.PI / 2);
  const right = onWall(g, hw + 0.001, 0, 0, Math.PI / 2);
  for (let i = 1; i < 6; i++) {
    const at = -hd + (i * d) / 6;
    quad(left, 0.03, back - slab - 0.1, at, slab, 0, "darkWood");
    quad(right, 0.03, back - slab - 0.1, at, slab, 0, "darkWood");
  }
  // The two front posts and the beam the roof and the board hang from.
  for (const sx of [-hw + 0.06, hw - 0.06]) box(g, 0.1, front - slab, 0.1, sx, slab, hd - 0.05, "darkWood");
  box(g, w, 0.12, 0.12, 0, front - 0.12, hd - 0.05, "darkWood");
  // The zinc lean-to falling to the back, overhanging the front and the sides, rust where water stands.
  const fall = Math.atan2(front - back, d);
  const roof = new Group();
  roof.position.set(0, (front + back) / 2 + 0.02, 0);
  roof.rotation.x = -fall;
  g.add(roof);
  box(roof, w + 0.3, 0.04, d + 0.5, 0, 0, 0.1, "zinc");
  floorQuad(roof, 1.1, 0.8, -1.0, 0.045, 0.4, "zincRust");
  floorQuad(roof, 0.6, 0.5, 1.4, 0.045, -0.9, "zincRust");
  // The wide dark screen on the back wall, its frame, the decoder on a shelf under it and the cables down the wall.
  const wall = onWall(g, 0, 0, -hd + 0.061);
  box(wall, 2.1, 1.2, 0.08, 0, 1.2, 0.04, "black");
  quad(wall, 1.94, 1.06, 0, 1.27, 0.081, "glass");
  box(wall, 0.6, 0.04, 0.28, 0, 0.82, 0.14, "darkWood");
  box(wall, 0.36, 0.07, 0.22, -0.08, 0.86, 0.14, "black");
  quad(wall, 0.03, 0.85, 0.95, 0.08, 0.004, "black");
  // Three rows of benches facing the screen: a plank seat on three trestles each.
  for (const bz of VIEWING_ROWS) {
    box(g, 3.0, 0.05, 0.32, 0, slab + seat - 0.05, bz, "wood");
    for (const bx of [-1.3, 0, 1.3]) box(g, 0.08, seat - 0.05, 0.28, bx, slab, bz, "darkWood");
  }
  // The hand-painted board over the opening: yellow, edged red, a ball in the middle, the flag's green and white either side.
  const board = onWall(g, 0, 0, hd + 0.02);
  const low = front - 0.86;
  box(board, 3.2, 0.7, 0.05, 0, low, 0, "red");
  quad(board, 3.08, 0.58, 0, low + 0.06, 0.026, "danfoYellow");
  disc(board, 0.24, 0, low + 0.35, 0.04, "white");
  for (const [px, py] of [[0, 0.04], [-0.12, -0.08], [0.12, -0.08]] as const) disc(board, 0.06, px, low + 0.35 + py, 0.052, "black", 5);
  for (const side of [-1, 1]) {
    for (const [i, colour] of (["green", "white", "green"] as const).entries()) quad(board, 0.26, 0.4, side * (0.78 + i * 0.26), low + 0.15, 0.03, colour);
  }
  // The dish on a bracket on the left wall, the generator in the back corner behind the benches, posters and rust on the left.
  dish(g, onWall(g, -hw - 0.04, 0, 0, -Math.PI / 2), 1.3, 1.5, 0.06, dishYaw + Math.PI / 2);
  generator(g, hw - 0.4, slab, -hd + 0.4, false, -Math.PI / 2, "orange");
  posters(left, -0.8, 1.1, random, 3);
  stain(left, 0, slab, d, 0.4, "darkWood");
  // The shed's walls and the generator; the benches are seats inside, and the board and the roof pass overhead.
  return setFootprint(g, [
    { x: 0, z: -hd + 0.03, width: w, depth: 0.1 },
    { x: -hw + 0.03, z: 0, width: 0.1, depth: d },
    { x: hw - 0.03, z: 0, width: 0.1, depth: d },
    { x: hw - 0.4, z: -hd + 0.4, width: 0.5, depth: 0.65 },
  ]);
}
