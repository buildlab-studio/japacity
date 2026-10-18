// The railway over Rye Lane by Peckham Rye station (city.md place.peckham): a brick viaduct whose
// arches are let as shops, stores and the station's way in, and a plate girder span over the street
// itself. Left to right as the street sees it: a market arch, the station's mouth with its canopy
// and board, the girder over the road, a lock-up arch behind its shutter and a second market arch.
// Boards are anchors with text keys (assets:sign-text-drawn-in-code); the brick is a palette colour (assets:colours-from-named-palette).
import { setFootprint, type SignStyle } from "@japacity/model-kit";
import { beam, box, extrude, onWall, quad, seeded, signboard, stain } from "@japacity/model-kit/kit";
import { Group, type Object3D } from "three";

export const BRIDGE = {
  arch: 6.0,
  pier: 1.4,
  road: 14.0,
  deck: 7.2,
  depth: 9.0,
  springing: 3.2,
} as const;

/** An arch's opening as a profile: straight sides to the springing, then a half circle in six steps. */
function archHole(span: number, springing: number): [number, number][] {
  const half = span / 2;
  const points: [number, number][] = [[-half, 0], [half, 0], [half, springing]];
  for (let step = 1; step < 6; step += 1) {
    const turn = (step / 6) * Math.PI;
    points.push([Math.cos(turn) * half, springing + Math.sin(turn) * half]);
  }
  points.push([-half, springing]);
  return points;
}

/** The brick face of one bay of the viaduct with its arch cut out, as a slab `thick` deep. */
function archBay(g: Object3D, x: number, z: number, span: number, height: number, thick: number): void {
  const half = span / 2 + BRIDGE.pier / 2;
  const { springing } = BRIDGE;
  const hole = archHole(span, springing);
  const outline: [number, number][] = [[-half, 0], [-span / 2, 0], ...hole.slice(2).reverse().map(([px, py]): [number, number] => [px, py]), [span / 2, 0], [half, 0], [half, height], [-half, height]];
  extrude(g, outline.map(([px, py]) => [px, py] as const), thick, "laterite", x, 0, z);
}

export function buildRailwayBridge(signs: { mouth: string; girder: string; market: string; lockup: string; second: string }, styles: { mouth: SignStyle; girder: SignStyle; market: SignStyle }): Group {
  const g = new Group();
  g.name = "bld_railway-bridge";
  const random = seeded(1865);
  const { arch, pier, road, deck, depth, springing } = BRIDGE;
  const bay = arch + pier;
  const width = 4 * bay + road;
  const front = depth / 2;
  const left = -width / 2;
  const bays = [left + bay / 2, left + bay * 1.5, width / 2 - bay * 1.5, width / 2 - bay / 2];
  const roadHalf = road / 2;

  // The arched faces front and back, the vault of each arch, and its infill.
  for (const x of bays) {
    archBay(g, x, front - 0.4, arch, deck, 0.8);
    archBay(g, x, -front + 0.4, arch, deck, 0.8);
    box(g, arch, deck - springing - arch / 2, depth - 1.6, x, springing + arch / 2, 0, "laterite");
    box(g, arch, 0.02, depth - 1.6, x, springing + arch / 2 - 0.02, 0, "zincRust");
  }
  // The abutments either side of the road span, with their piers.
  for (const side of [-1, 1]) box(g, 1.2, deck, depth, side * (roadHalf + 0.6), 0, 0, "laterite");

  // The plate girder over the road: two deep girders, stiffeners, the deck between, a bridge board.
  for (const z of [front - 0.35, -front + 0.35]) {
    box(g, road + 2.4, 1.6, 0.35, 0, deck - 1.6, z, "teal");
    for (let x = -roadHalf; x <= roadHalf + 0.01; x += 1.75) box(g, 0.12, 1.5, 0.12, x, deck - 1.55, z + (z > 0 ? 0.22 : -0.22), "teal");
  }
  box(g, road + 2.4, 0.4, depth - 0.7, 0, deck - 1.6, 0, "concreteWorn");
  const girder = onWall(g, 0, 0, front - 0.17 + 0.2);
  signboard(g, girder, signs.girder, styles.girder, 0, deck - 1.42, 6.4, 0.9);
  for (let k = 0; k < 4; k += 1) stain(girder, -roadHalf + 1 + random() * (road - 2), deck - 1.6, 0.4, 0.8, "black");

  // The parapet along the top, the coping, a stretch of railing and the overhead line masts.
  box(g, width, 1.0, 0.35, 0, deck, front - 0.18, "laterite");
  box(g, width, 1.0, 0.35, 0, deck, -front + 0.18, "laterite");
  box(g, width + 0.1, 0.1, 0.5, 0, deck + 1.0, front - 0.18, "concrete");
  for (const x of [left + 3, 0, width / 2 - 3]) {
    box(g, 0.2, 4.0, 0.2, x, deck, -1.8, "hub");
    beam(g, [x, deck + 3.8, -1.8], [x, deck + 3.8, 1.6], 0.12, "hub");
  }
  box(g, width, 0.3, depth - 1.2, 0, deck - 0.3, 0, "concreteWorn");

  // The station's mouth (second bay): open, its floor tiled, a canopy over the way in, a board.
  const mouth = bays[1] ?? 0;
  const face = onWall(g, 0, 0, front + 0.01);
  quad(face, arch - 0.2, springing + arch / 2 - 0.1, mouth, 0, -1.2, "cream");
  quad(face, 1.2, 2.1, mouth - 1.4, 0, -1.18, "glass");
  quad(face, 1.2, 2.1, mouth + 1.4, 0, -1.18, "glass");
  box(g, arch + 0.6, 0.18, 1.6, mouth, springing + 0.2, front + 0.8, "charcoal");
  for (const dx of [-arch / 2, arch / 2]) beam(g, [mouth + dx, springing + 0.25, front + 1.5], [mouth + dx * 0.9, springing + 1.5, front], 0.08, "charcoal");
  signboard(g, face, signs.mouth, styles.mouth, mouth, springing + 0.45, arch - 0.4, 0.75);

  // A market arch (first bay): stalls go in front; the inside dark, a striped awning at the springing.
  const market = bays[0] ?? 0;
  quad(face, arch - 0.2, springing + arch / 2 - 0.1, market, 0, -0.9, "canvas");
  signboard(g, face, signs.market, styles.market, market, springing + 0.2, arch - 0.6, 0.6);
  // A lock-up behind its roller shutter (third bay) and a second market arch (fourth).
  const lockup = bays[2] ?? 0;
  quad(face, arch - 0.2, springing, lockup, 0, -0.5, "zinc");
  for (let k = 1; k < 8; k += 1) quad(face, arch - 0.2, 0.03, lockup, (k * springing) / 8, -0.48, "hub");
  quad(face, arch - 0.2, arch / 2 - 0.1, lockup, springing, -0.6, "laterite");
  signboard(g, face, signs.lockup, styles.market, lockup, springing - 0.75, 3.2, 0.6);
  const second = bays[3] ?? 0;
  quad(face, arch - 0.2, springing + arch / 2 - 0.1, second, 0, -0.9, "canvas");
  signboard(g, face, signs.second, styles.market, second, springing + 0.2, arch - 0.6, 0.6);

  // Wear: soot under the girder and the coping, a damp band at the foot of the piers, posters.
  stain(face, 0, deck - 0.4, width, 0.4, "zincRust");
  for (const side of [-1, 1]) stain(face, side * (roadHalf + (width / 2 - roadHalf) / 2), 0, width / 2 - roadHalf, 0.7, "zincRust");
  for (const x of bays) for (let k = 0; k < 2; k += 1) quad(face, 0.45, 0.6, x + arch / 2 + pier / 2 - 0.25 + k * 0.02, 1.2 + k * 0.7, 0.012 + k * 0.001, (["white", "danfoYellow", "red", "cream"] as const)[Math.floor(random() * 4)] ?? "white");
  // The viaduct behind each arch's shallow mouth (as deep as its backdrop is set in), the piers at the
  // front between the mouths, and the abutments; the street under the girder is open.
  const mouths = [0.9, 1.2, 0.5, 0.9];
  return setFootprint(g, [
    ...bays.map((x, index) => {
      const set = mouths[index] ?? 0.9;
      return { x, z: -set / 2, width: bay, depth: depth - set };
    }),
    ...bays.flatMap((x) => [-1, 1].map((side) => ({ x: x + side * (arch / 2 + pier / 4), z: front - 0.4, width: pier / 2, depth: 0.8 }))),
    ...[-1, 1].map((side) => ({ x: side * (roadHalf + 0.6), z: 0, width: 1.2, depth })),
  ]);
}
