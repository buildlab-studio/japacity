// A dugout canoe on the lagoon by the bridge (city.md place.third-mainland-bridge): a long narrow
// hull, pointed at both ends and painted in a band below the gunwale, two thwarts, a paddle laid
// across it, a heap of net and a plastic bowl for bailing, a jerrycan. The hull's floor is y = 0;
// on the water the stage sets it in the lagoon's moving surface.
import { boxesIn, setFootprint } from "@japacity/assets";
import { box, cylinder, seeded, solid, type Vec3 } from "@japacity/assets/kit";
import { Group } from "three";

import { facePlusZ, lump } from "../../veh/lab";

export const CANOE = { length: 6.4, beam: 0.9, depth: 0.5 } as const;
/** Where the free floor a paddler sits on begins and ends along the hull, between the thwarts. */
export const CANOE_SEAT = { stern: -0.4, bow: 0.7 } as const;

const STATIONS = 10;

export function buildCanoe(): Group {
  const g = new Group();
  const random = seeded(31);
  const { length, beam: width, depth } = CANOE;
  // The hull as rings of four points along its length: the beam narrows to a point at each end and the sheer rises there.
  const rings: Vec3[][] = [];
  for (let i = 0; i <= STATIONS; i++) {
    const t = -1 + (i / STATIONS) * 2;
    const half = (width / 2) * Math.max(0.02, 1 - Math.abs(t) ** 2.2);
    const z = (t * length) / 2;
    const sheer = depth + 0.18 * t ** 2;
    const keel = 0.06 * t ** 2;
    rings.push([
      [-half, sheer, z],
      [-half * 0.55, keel, z],
      [half * 0.55, keel, z],
      [half, sheer, z],
    ]);
  }
  const hull: Vec3[] = rings.flat();
  const outside: number[][] = [];
  const inside: number[][] = [];
  for (let i = 0; i < STATIONS; i++) {
    const a = i * 4;
    const b = a + 4;
    outside.push([a, a + 1, b + 1, b], [a + 1, a + 2, b + 2, b + 1], [a + 2, a + 3, b + 3, b + 2]);
    inside.push([a, b, b + 1, a + 1], [a + 1, b + 1, b + 2, a + 2], [a + 2, b + 2, b + 3, a + 3]);
  }
  solid(g, hull, outside, "darkWood");
  solid(g, hull, inside, "wood");
  // The painted band under the gunwale on both sides, as the canoes on the lagoon carry.
  for (const side of [-1, 1]) {
    for (let i = 1; i < STATIONS - 1; i++) {
      const a = rings[i];
      const b = rings[i + 1];
      if (a === undefined || b === undefined) continue;
      const top = side < 0 ? 0 : 3;
      const p = a[top] ?? [0, 0, 0];
      const q = b[top] ?? [0, 0, 0];
      const lift = 0.004 * side;
      const band: Vec3[] = [
        [p[0] + lift, p[1] - 0.02, p[2]],
        [q[0] + lift, q[1] - 0.02, q[2]],
        [q[0] * 0.97 + lift, q[1] - 0.14, q[2]],
        [p[0] * 0.97 + lift, p[1] - 0.14, p[2]],
      ];
      solid(g, band, side < 0 ? [[0, 3, 2, 1]] : [[0, 1, 2, 3]], i % 2 === 0 ? "red" : "white");
    }
  }
  // Two thwarts, the paddle laid across them, a heap of net, a bailing bowl and a jerrycan.
  for (const z of [-1.3, 1.1]) box(g, width * 0.85, 0.04, 0.22, 0, depth - 0.08, z, "wood");
  box(g, 0.12, 0.03, 1.8, 0.15, depth - 0.02, 0.1, "darkWood", 0.2);
  box(g, 0.18, 0.03, 0.42, 0.33, depth - 0.02, -0.95, "darkWood", 0.2);
  for (let i = 0; i < 4; i++) lump(g, 0.14, -0.08 + random() * 0.16, 0.2, 1.5 + random() * 0.35, i % 2 === 0 ? "teal" : "khaki", [1.2, 0.6, 1.1]);
  cylinder(g, 0.13, 0.1, 0.1, 0.08, -0.9, "basin", 8, 0.17);
  box(g, 0.18, 0.32, 0.26, -0.1, 0.08, -0.4, "danfoYellow");
  const root = facePlusZ(g, "prop_canoe", false);
  // The bow and the stern; the floor amidships between the thwarts, where a paddler sits, is left free.
  return setFootprint(root, boxesIn(root, g, [
    { x: 0, z: (CANOE_SEAT.bow + length / 2) / 2, width, depth: length / 2 - CANOE_SEAT.bow },
    { x: 0, z: (CANOE_SEAT.stern - length / 2) / 2, width, depth: CANOE_SEAT.stern + length / 2 },
  ]));
}
