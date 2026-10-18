// The flag mast on the forecourt of the departures building (city.md place.airport-lagos): a
// tapering steel mast on a stepped plinth with its halyard cleat and the ball at the top. The flag
// is not in the model: it is a sheet on the place's wind, pinned at the mast (city:motion-in-vertex-shader).
import { boxesIn, setFootprint } from "@japacity/assets";
import { beam, box, cylinder } from "@japacity/assets/kit";
import { Group } from "three";

import { facePlusZ } from "../../veh/lab";

export const FLAGPOLE = { height: 6.2, flagTop: 5.9, plinth: 1.6 } as const;

export function buildFlagpole(): Group {
  const g = new Group();
  const { height, plinth } = FLAGPOLE;
  box(g, plinth, 0.25, plinth, 0, 0, 0, "concrete");
  box(g, plinth - 0.5, 0.35, plinth - 0.5, 0, 0.25, 0, "white");
  box(g, plinth - 0.9, 0.12, plinth - 0.9, 0, 0.6, 0, "concreteWorn");
  cylinder(g, 0.1, height - 0.72, 0, 0.72, 0, "hub", 8, 0.05);
  cylinder(g, 0.09, 0.14, 0, height, 0, "gold", 8, 0.02);
  cylinder(g, 0.06, 0.06, 0, height - 0.02, 0, "gold", 8, 0.09);
  // The halyard down the mast's face to its cleat at hand height.
  beam(g, [0.08, height - 0.15, 0.02], [0.08, 1.3, 0.02], 0.012, "white");
  box(g, 0.05, 0.16, 0.04, 0.11, 1.2, 0.02, "black");
  // A painted ring of kerb round the plinth, black and white blocks as the kerbs are.
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    box(g, 0.5, 0.12, 0.18, Math.sin(angle) * 1.05, 0, Math.cos(angle) * 1.05, i % 2 === 0 ? "black" : "white", angle);
  }
  const root = facePlusZ(g, "prop_flagpole", false);
  // The plinth; the painted kerb blocks round it are a step people stand on.
  return setFootprint(root, boxesIn(root, g, [{ x: 0, z: 0, width: plinth, depth: plinth }]));
}
