// What stands over Makoko's channel beside its houses (city.md place.makoko): the steel pylons of the high-tension line that
// crosses the settlement, seen far off in the haze with their wires sagging between them, and the wires the houses take their
// light from, strung on tall bamboo poles over the water with a bare bulb hanging. Each faces +z with its lowest point at y = 0.
import { setFootprint } from "@japacity/model-kit";
import { beam, box, cylinder, seeded, wire } from "@japacity/model-kit/kit";
import { Group } from "three";

/** The pylon's height to its peak, its legs' spread at the water and at the waist, and how far its wires run either side. */
export const PYLON = { height: 30, base: 5, waist: 1.4, span: 28 } as const;

/** A lattice pylon standing in the water: four legs drawing in to a waist, braced across, two arms with hanging insulators. */
export function buildPylon(): Group {
  const g = new Group();
  g.name = "prop_pylon";
  const { height, base, waist, span } = PYLON;
  const neck = height - 6;
  const at = (share: number): number => (base + (waist - base) * share) / 2;
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const;
  // Each leg stands on a footing block in the water, so the tilted leg's corner never dips under it.
  for (const [sx, sz] of corners) {
    box(g, 0.5, 0.3, 0.5, sx * at(0), 0, sz * at(0), "concrete");
    beam(g, [sx * at(0), 0.15, sz * at(0)], [sx * at(1), neck, sz * at(1)], 0.22, "hub");
  }
  // The bracing on each face, an X in each of four bays.
  const levels = [0, 0.3, 0.55, 0.78, 1];
  for (let i = 0; i < levels.length - 1; i++) {
    const [l0 = 0, l1 = 1] = [levels[i], levels[i + 1]];
    const [y0, y1] = [l0 * neck, l1 * neck];
    const [h0, h1] = [at(l0), at(l1)];
    for (const side of [-1, 1]) {
      beam(g, [-h0, Math.max(y0, 0.3), side * h0], [h1, y1, side * h1], 0.09, "concrete");
      beam(g, [side * h0, Math.max(y0, 0.3), -h0], [side * h1, y1, h1], 0.09, "concrete");
    }
  }
  // The neck to the peak, the two arms across it and the insulators hanging under their ends.
  for (const [sx, sz] of corners) beam(g, [sx * at(1), neck, sz * at(1)], [0, height, 0], 0.16, "hub");
  const arms = [neck + 1.2, neck + 3.8];
  for (const [i, y] of arms.entries()) {
    const reach = i === 0 ? 6 : 4.5;
    box(g, reach * 2, 0.3, 0.35, 0, y, 0, "hub");
    for (const s of [-1, 1]) {
      cylinder(g, 0.1, 1.0, s * (reach - 0.3), y - 1.0, 0, "white", 5);
      // The line sags off to the next pylon either way, out of sight in the haze.
      wire(g, [s * (reach - 0.3), y - 1.0, 0], [s * (reach - 0.3), y - 4.5, s * span], 3.5, 3);
    }
  }
  return setFootprint(g, [{ x: 0, z: 0, width: base, depth: base }]);
}

/** The bamboo poles' height and how far apart they stand across the channel. */
export const BAMBOO = { height: 6.5, apart: 9 } as const;

/** Two bamboo poles leaning a little, a wire between them with a bare bulb hanging, and the wires on to the houses either side. */
export function buildBambooWires(): Group {
  const g = new Group();
  g.name = "prop_bamboo-wires";
  const random = seeded(611);
  const { height, apart } = BAMBOO;
  const tops: [number, number, number][] = [];
  for (const s of [-1, 1]) {
    const x = (s * apart) / 2;
    const lean = s * (0.15 + random() * 0.2);
    const top: [number, number, number] = [x + lean, height, (random() - 0.5) * 0.3];
    beam(g, [x, 0, 0], top, 0.11, "khaki");
    // The joints of the stem, darker rings up the pole.
    for (const share of [0.25, 0.5, 0.75]) {
      const y = height * share;
      box(g, 0.14, 0.05, 0.14, x + lean * share, y, top[2] * share, "wood");
    }
    tops.push(top);
  }
  const [left, right] = tops as [[number, number, number], [number, number, number]];
  wire(g, [left[0], left[1] - 0.2, left[2]], [right[0], right[1] - 0.2, right[2]], 0.7, 4);
  wire(g, [left[0], left[1] - 0.5, left[2]], [right[0], right[1] - 0.5, right[2]], 0.9, 4);
  // The bulb on its flex from the middle of the wire.
  beam(g, [0, height - 0.95, 0], [0, height - 1.6, 0], 0.02, "black");
  cylinder(g, 0.07, 0.12, 0, height - 1.72, 0, "cream", 6);
  // On to the eaves either side, sagging low.
  wire(g, [left[0], left[1] - 0.3, left[2]], [left[0] - 3.5, 3.0, -2.5], 0.5, 3);
  wire(g, [right[0], right[1] - 0.3, right[2]], [right[0] + 3.5, 3.1, -2.2], 0.5, 3);
  return setFootprint(g, [
    { x: -apart / 2, z: 0, width: 0.2, depth: 0.2 },
    { x: apart / 2, z: 0, width: 0.2, depth: 0.2 },
  ]);
}
