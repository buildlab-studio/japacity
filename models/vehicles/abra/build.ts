// An abra, the wooden water taxi of the Dubai creek (city.md place.deira): a long open hull with a
// raised bow, a white gunwale, one long bench down the middle where the passengers sit back to back
// facing the water, a flat canopy on posts, the engine box amidships with its exhaust, and old tyres
// hung over the sides as fenders. Built along +Z, bow forward (assets:metre-units-and-origin). It rides the water in
// the place's shader (`bob` in the stage), not in a loop of its own.
import { lowBox, setFootprint } from "@japacity/model-kit";
import { beam, box, part, solid, type Vec3 } from "@japacity/model-kit/kit";
import { Group } from "three";

import { ccyl } from "../centred";

export const ABRA = { length: 9.0, beam: 2.4, freeboard: 0.75, canopy: 2.3 } as const;

export function buildAbra(): Group {
  const g = new Group();
  g.name = "vehicle_abra";
  const { length, beam: width, freeboard } = ABRA;
  const half = width / 2;
  const stern = -length / 2;
  const bowStart = length / 2 - 1.6;
  const bow = length / 2;
  // The hull: a flat-bottomed box that narrows and rises to a point at the bow.
  const corners: Vec3[] = [
    [-half + 0.25, 0, stern], [half - 0.25, 0, stern], [half - 0.25, 0, bowStart], [0, 0.35, bow],
    [-half + 0.25, 0, bowStart],
    [-half, freeboard, stern], [half, freeboard, stern], [half, freeboard, bowStart], [0, freeboard + 0.35, bow + 0.2], [-half, freeboard, bowStart],
  ];
  solid(g, corners, [
    [0, 4, 3, 2, 1],
    [5, 6, 7, 8, 9],
    [0, 1, 6, 5],
    [1, 2, 7, 6],
    [2, 3, 8, 7],
    [3, 4, 9, 8],
    [4, 0, 5, 9],
  ], "wood");
  // The deck inside the gunwale, and the white rubbing strake round the top.
  box(g, width - 0.3, 0.02, bowStart - stern - 0.3, 0, freeboard - 0.02, (stern + bowStart) / 2, "darkWood");
  for (const side of [-1, 1]) {
    beam(g, [side * half, freeboard - 0.08, stern], [side * half, freeboard - 0.08, bowStart], 0.1, "white");
    beam(g, [side * half, freeboard - 0.08, bowStart], [0, freeboard + 0.27, bow + 0.2], 0.1, "white");
  }
  // The bench down the middle, its back between the two rows.
  box(g, 0.9, 0.42, 5.2, 0, freeboard, -0.4, "darkWood");
  box(g, 0.1, 0.45, 5.2, 0, freeboard + 0.42, -0.4, "wood");
  // The engine box amidships aft, its exhaust up through the canopy.
  box(g, 0.9, 0.6, 1.0, 0, freeboard, stern + 0.9, "white");
  ccyl(g, 0.05, 2.0, 0.3, freeboard + 1.5, stern + 0.8, "black", "y", 6);
  // The canopy on six posts.
  for (const z of [stern + 0.4, -0.4, bowStart - 0.4]) for (const side of [-1, 1]) box(g, 0.07, ABRA.canopy - freeboard, 0.07, side * (half - 0.15), freeboard, z, "white");
  box(g, width + 0.2, 0.06, bowStart - stern + 0.2, 0, ABRA.canopy, (stern + bowStart) / 2, "cream");
  box(g, width + 0.24, 0.12, 0.08, 0, ABRA.canopy - 0.06, bowStart + 0.14, "teal");
  box(g, width + 0.24, 0.12, 0.08, 0, ABRA.canopy - 0.06, stern - 0.06, "teal");
  // Tyres over the sides as fenders.
  // The tyres are round parts, shown smooth (assets:flat-and-smooth-shading).
  const tyres = part(g, "tyres");
  tyres.userData.smooth = true;
  for (const z of [-2.4, 0.2, 2.2]) for (const side of [-1, 1]) ccyl(tyres, 0.24, 0.12, side * (half + 0.07), freeboard - 0.38, z, "tyre", "x", 10);
  return setFootprint(g, [lowBox(g)]);
}
