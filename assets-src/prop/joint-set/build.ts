// The joint's corner of the pavement (streets.md R-STREET-011): four white plastic chairs round a low
// table with its bottles, a cooler, a crate of empties and a pole with one bulb hung over it all. One
// material (the prop's budget), so the chairs are the palette's white plastic, as the party's are.
// Built facing +Z (R-ASSET-003); the chairs are where people sit, so the footprint leaves them out.
import { setFootprint } from "@japacity/assets";
import { beam, box, clutter, cylinder, type Vec3 } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

export const JOINT_SET = { table: 0.62, tableTop: 0.5, seat: 0.44, ring: 0.78 } as const;

/** The seats round the table, `[x, z, facing]` in the model's frame: each chair faces the table. */
export const JOINT_SEATS: readonly Vec3[] = [
  [JOINT_SET.ring, 0, -Math.PI / 2],
  [-JOINT_SET.ring, 0, Math.PI / 2],
  [0, JOINT_SET.ring, Math.PI],
  [0, -JOINT_SET.ring, 0],
];

/** A moulded plastic chair facing +Z in its frame: the seat, a leaning back, four legs. */
function chair(g: Object3D, x: number, z: number, facing: number): void {
  const frame = new Group();
  frame.position.set(x, 0, z);
  frame.rotation.y = facing;
  g.add(frame);
  const { seat } = JOINT_SET;
  box(frame, 0.46, 0.04, 0.44, 0, seat, 0, "white");
  const back = new Group();
  back.position.set(0, seat + 0.04, -0.21);
  back.rotation.x = -0.2;
  frame.add(back);
  box(back, 0.44, 0.4, 0.04, 0, 0, 0, "white");
  for (const [lx, lz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]] as const) box(frame, 0.04, seat, 0.04, lx, 0, lz, "white");
}

export function buildJointSet(): Group {
  const g = new Group();
  g.name = "prop_joint-set";
  const { table, tableTop } = JOINT_SET;
  // The low table on its one leg and cross foot, bottles and glasses on it.
  box(g, table, 0.04, table, 0, tableTop - 0.04, 0, "wood");
  box(g, 0.06, tableTop - 0.04, 0.06, 0, 0, 0, "darkWood");
  for (const turn of [0, Math.PI / 2]) box(g, 0.5, turn === 0 ? 0.05 : 0.07, 0.06, 0, 0, 0, "darkWood", turn);
  for (const [bx, bz, colour] of [[-0.12, 0.06, "green"], [0.1, -0.08, "darkWood"], [0.14, 0.12, "green"]] as const) {
    cylinder(g, 0.035, 0.22, bx, tableTop, bz, colour, 6, 0.03);
    cylinder(g, 0.014, 0.07, bx, tableTop + 0.22, bz, colour, 4);
  }
  box(g, 0.07, 0.1, 0.07, -0.05, tableTop, -0.15, "cream");
  for (const [x, z, facing] of JOINT_SEATS) chair(g, x, z, facing);
  // The cooler of cold ones on the far side, the crate of empties on it, a few bottle tops showing.
  clutter(g, "cooler", 1.15, 0, -0.8);
  box(g, 0.44, 0.24, 0.32, -1.15, 0, -0.8, "red");
  for (let i = 0; i < 6; i++) box(g, 0.05, 0.12, 0.05, -1.3 + (i % 3) * 0.15, 0.24, -0.88 + Math.floor(i / 3) * 0.16, i % 2 === 0 ? "green" : "darkWood");
  // The pole by the cooler, its arm out over the table, one bulb hung on its flex.
  box(g, 0.07, 2.6, 0.07, 1.3, 0, -1.2, "black");
  cylinder(g, 0.16, 0.06, 1.3, 0, -1.2, "concrete", 6);
  beam(g, [1.3, 2.55, -1.2], [0.15, 2.55, -0.25], 0.04, "black");
  beam(g, [0.15, 2.55, -0.25], [0.15, 2.05, -0.25], 0.012, "black");
  box(g, 0.08, 0.12, 0.08, 0.15, 1.93, -0.25, "cream");
  // The table, the cooler, the crate and the pole's foot; the chairs are seats.
  return setFootprint(g, [
    { x: 0, z: 0, width: table, depth: table },
    { x: 1.15, z: -0.8, width: 0.62, depth: 0.44 },
    { x: -1.15, z: -0.8, width: 0.44, depth: 0.32 },
    { x: 1.3, z: -1.2, width: 0.32, depth: 0.32 },
  ]);
}
