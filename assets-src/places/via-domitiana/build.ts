// The Domitiana (docs/design/15-the-three-countries-on-the-mold.md section 3; city.md place.via-domitiana): the coast
// road at Castel Volturno, lined with stone pines between the road and the sea. Its low block of shops is the plaster
// row's data (castel-volturno/build.ts, assets:variants-are-numbers-not-code); the pine is the one new piece. It stands on its base at y = 0
// facing +Z (assets:metre-units-and-origin) and records the ground it blocks (assets:models-record-their-footprint).
import { setFootprint } from "@japacity/assets";
import { beam, cylinder } from "@japacity/assets/kit";
import { Group } from "three";

import { lump } from "../../veh/lab";

/** A stone pine of the coast: a tall bare trunk leaning a little, and a broad flat crown like an umbrella. */
export function buildPine(): Group {
  const g = new Group();
  g.name = "prop_pine";
  const crown = 6.6;
  // The trunk in three pieces, each leaning a little more, the bark dark.
  cylinder(g, 0.24, 0.3, 0, 0, 0, "darkWood", 7);
  const knees: [number, number, number][] = [[0, 0.25, 0], [0.15, 2.6, 0.05], [0.45, 4.8, 0.1], [0.75, crown, 0.15]];
  knees.slice(1).forEach((knee, index) => {
    const from = knees[index] ?? [0, 0, 0];
    beam(g, from, knee, 0.34 - index * 0.06, "darkWood");
  });
  // Two boughs out to the crown's edges.
  beam(g, [0.45, 4.8, 0.1], [-1.2, crown - 0.2, 0.6], 0.14, "darkWood");
  beam(g, [0.6, 5.4, 0.12], [2.2, crown - 0.1, -0.5], 0.14, "darkWood");
  // The crown: a wide flat mass with two smaller ones under its edge, darker greens over lighter.
  lump(g, 2.6, 0.6, crown + 0.5, 0.1, "roofGreen", [1.25, 0.32, 1.1]);
  lump(g, 1.4, -1.3, crown + 0.15, 0.7, "pepper", [1.2, 0.4, 1.0]);
  lump(g, 1.3, 2.3, crown + 0.25, -0.5, "roofGreen", [1.2, 0.38, 1.1]);
  return setFootprint(g, [{ x: 0, z: 0, width: 0.5, depth: 0.5 }]);
}
