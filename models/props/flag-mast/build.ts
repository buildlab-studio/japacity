// A flag mast on a stepped concrete base, 7 m to its finial, with the halyard cleat at hand height.
// The flag itself is the place's motion (city:motion-in-vertex-shader), pinned at the mast's top.
import { lowBox, setFootprint } from "@japacity/model-kit";
import { box, cylinder } from "@japacity/model-kit/kit";
import { Group } from "three";

export const MAST = { height: 7.0 } as const;

export function buildFlagMast(): Group {
  const g = new Group();
  g.name = "prop_flag-mast";
  box(g, 1.6, 0.25, 1.6, 0, 0, 0, "concrete");
  box(g, 1.0, 0.3, 1.0, 0, 0.25, 0, "white");
  cylinder(g, 0.09, MAST.height - 0.7, 0, 0.55, 0, "white", 8, 0.06);
  cylinder(g, 0.1, 0.15, 0, MAST.height - 0.15, 0, "gold", 8, 0.02);
  box(g, 0.05, 0.25, 0.08, 0.1, 1.4, 0, "hub");
  return setFootprint(g, [lowBox(g)]);
}
