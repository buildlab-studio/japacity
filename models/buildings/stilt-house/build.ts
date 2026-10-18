// A house on stilts in the lagoon by the bridge (city.md place.third-mainland-bridge), as the water
// villages build them: a plank house on a platform of poles driven into the lagoon bed, a zinc roof
// patched with a tarpaulin, a veranda with a rail to the water, a ladder down to where the canoes
// tie up. Every plank a little different, the zinc rusting, the stilts darker where the water reaches.
import { type PaletteName, setFootprint } from "@japacity/model-kit";
import { box, floorQuad, onWall, quad, seeded, solid, type Vec3 } from "@japacity/model-kit/kit";
import { Group } from "three";

export const STILT_HOUSE = { floor: 1.7, width: 5.2, depth: 4.0, walls: 2.3, veranda: 1.4 } as const;

const PLANKS: PaletteName[] = ["wood", "darkWood", "khaki", "wood", "tan"];

export function buildStiltHouse(): Group {
  const root = new Group();
  root.name = "building_stilt-house";
  const random = seeded(1990);
  const { floor, width: w, depth: d, walls, veranda } = STILT_HOUSE;
  const hw = w / 2;
  const back = -(d + veranda) / 2;
  const front = back + d;
  const zc = (back + front) / 2;

  // Stilts: rows of poles under the house and the veranda, dark from the waterline down.
  for (let x = -hw + 0.1; x <= hw - 0.09; x += (w - 0.2) / 3) {
    for (const z of [back + 0.1, zc, front - 0.1, front + veranda - 0.1]) {
      const lean = (random() - 0.5) * 0.06;
      box(root, 0.12, floor, 0.12, x + lean, 0, z, "darkWood");
      box(root, 0.13, 0.5, 0.13, x + lean, 0, z, "black");
    }
  }
  // The platform and the veranda's boards.
  box(root, w + 0.1, 0.12, d + veranda, 0, floor - 0.12, back + (d + veranda) / 2, "darkWood");
  for (let x = -hw + 0.3; x < hw; x += 0.6) floorQuad(root, 0.02, d + veranda, x, floor + 0.002, back + (d + veranda) / 2, "black");

  // The walls: a box of planks, then plank faces in different woods, a door and two shutters.
  box(root, w, walls, d, 0, floor, zc, "wood");
  const face = onWall(root, 0, floor, front);
  const plank = 0.32;
  for (let x = -hw + plank / 2; x < hw; x += plank) quad(face, plank - 0.015, walls, x, 0, 0.005, PLANKS[Math.floor(random() * PLANKS.length)] ?? "wood");
  quad(face, 0.85, 1.95, -0.8, 0, 0.012, "black");
  quad(face, 0.4, 1.9, -1.05, 0, 0.016, "blue");
  for (const x of [1.0, 2.0]) {
    quad(face, 0.7, 0.6, x, 1.0, 0.012, "black");
    quad(face, 0.36, 0.62, x - 0.18, 0.99, 0.016, "darkWood");
  }
  for (const [x, ry] of [[-hw, -Math.PI / 2], [hw, Math.PI / 2]] as const) {
    const end = onWall(root, x, floor, zc, ry);
    for (let z = -d / 2 + plank / 2; z < d / 2; z += plank) quad(end, plank - 0.015, walls, z, 0, 0.005, PLANKS[Math.floor(random() * PLANKS.length)] ?? "wood");
    quad(end, 0.6, 0.5, 0.4, 1.1, 0.012, "black");
  }

  // The gable roof of zinc, rusting in patches, with a tarpaulin pegged over a hole.
  const ridge = floor + walls + 1.0;
  const eaves = floor + walls;
  const over = 0.35;
  const left: Vec3[] = [[-hw - over, eaves - 0.1, back - over], [-hw - over, eaves - 0.1, front + over], [-hw - over, ridge, zc], [hw + over, ridge, zc], [hw + over, eaves - 0.1, front + over], [hw + over, eaves - 0.1, back - over]];
  solid(root, left, [[1, 4, 3, 2], [5, 0, 2, 3], [4, 1, 2, 3], [0, 5, 3, 2]], "zinc");
  const slope = (along: number, share: number, side: 1 | -1): Vec3 => [along, eaves - 0.1 + share * (ridge - eaves + 0.1) + 0.01, zc + side * (1 - share) * (d / 2 + over)];
  solid(root, [slope(-1.8, 0.2, 1), slope(-0.6, 0.2, 1), slope(-0.6, 0.6, 1), slope(-1.8, 0.6, 1)], [[0, 1, 2, 3]], "zincRust");
  solid(root, [slope(0.6, 0.1, 1), slope(2.2, 0.1, 1), slope(2.2, 0.45, 1), slope(0.6, 0.45, 1)], [[0, 1, 2, 3]], "blue");
  solid(root, [slope(-2.2, 0.3, -1), slope(0.4, 0.3, -1), slope(0.4, 0.8, -1), slope(-2.2, 0.8, -1)], [[0, 3, 2, 1]], "zincRust");
  for (const x of [-hw, hw]) solid(root, [[x, eaves, back], [x, eaves, front], [x, ridge - 0.05, zc]], x < 0 ? [[0, 1, 2]] : [[0, 2, 1]], "wood");

  // The veranda rail, a ladder down to the water, a bucket and a jerrycan by the door.
  const railZ = front + veranda - 0.08;
  box(root, w, 0.06, 0.06, 0, floor + 0.9, railZ, "darkWood");
  for (let x = -hw + 0.05; x <= hw; x += 0.85) box(root, 0.06, 0.9, 0.06, x, floor, railZ, "darkWood");
  for (const s of [-1, 1]) box(root, 0.07, floor + 0.9, 0.07, hw - 0.9 + s * 0.25, 0, railZ + 0.25, "darkWood");
  for (let y = 0.3; y < floor; y += 0.35) box(root, 0.55, 0.05, 0.05, hw - 0.9, y, railZ + 0.25, "wood");
  box(root, 0.3, 0.32, 0.3, 0.3, floor, front + 0.4, "basin");
  box(root, 0.2, 0.4, 0.3, 0.75, floor, front + 0.3, "danfoYellow");
  // The stilts under the house and the veranda, and the ladder down to the water.
  return setFootprint(root, [{ x: 0, z: back + (d + veranda + 0.9) / 2, width: w + 0.2, depth: d + veranda + 1.1 }]);
}
