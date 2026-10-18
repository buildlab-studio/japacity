// The market's enamel basins (city.md place.tejuosho-market): a seller's stock stacked in towers
// of three colours, and two on the ground heaped with tomatoes and peppers, the way produce is
// sold by the basin. Every part is round, so the whole model is shaded smooth (assets:flat-and-smooth-shading).
import { lowBox, type PaletteName, setFootprint } from "@japacity/assets";
import { cylinder, seeded } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

import { facePlusZ, lump } from "../../vehicles/centred";

/** One basin: a flared bowl on its base at y, closed over so a stack shows each rim as a band. */
function basin(g: Object3D, r: number, x: number, y: number, z: number, colour: PaletteName): void {
  cylinder(g, r * 0.55, r * 0.42, x, y, z, colour, 8, r);
}

export function buildBasins(): Group {
  const g = new Group();
  const random = seeded(4242);
  // Towers of basins in stock, nested, each a little wider than the one inside it.
  const towers: [number, number, PaletteName[]][] = [
    [-0.9, -0.3, ["basin", "red", "white"]],
    [-0.3, -0.45, ["white", "green", "green"]],
    [0.3, -0.4, ["red", "basin"]],
  ];
  for (const [x, z, colours] of towers) colours.forEach((colour, level) => basin(g, 0.3 + level * 0.008, x, level * 0.07, z, colour));
  // Two basins of produce on the ground: tomatoes heaped to a dome, and peppers.
  for (const [x, z, colour, fruit, count] of [[-0.55, 0.3, "basin", "tomato", 9], [0.25, 0.3, "white", "pepper", 7]] as const) {
    basin(g, 0.32, x, 0, z, colour);
    for (let i = 0; i < count; i++) {
      const ring = random() * 0.22;
      const angle = random() * Math.PI * 2;
      lump(g, fruit === "tomato" ? 0.065 : 0.05, x + Math.cos(angle) * ring, 0.14 + (0.22 - ring) * 0.55 + random() * 0.04, z + Math.sin(angle) * ring, i % 5 === 0 && fruit === "pepper" ? "tomato" : fruit, fruit === "pepper" ? [1, 1.5, 1] : [1, 1, 1]);
    }
  }
  // A small bowl of loose peppers balanced on the nearest tower.
  basin(g, 0.18, 0.25, 0.3, -0.4, "danfoYellow");
  for (let i = 0; i < 3; i++) lump(g, 0.045, 0.2 + random() * 0.1, 0.42, -0.45 + random() * 0.1, "pepper", [1, 1.4, 1]);
  g.userData.smooth = true;
  const root = facePlusZ(g, "prop_basins", false);
  return setFootprint(root, [lowBox(root)]);
}
