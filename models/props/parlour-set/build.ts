// The front room's furniture as the family keeps it on an ordinary day: a three-seater and two
// armchairs in wine with cream covers on the backs, a low centre table with a glass top, a rug,
// the television on its stand against the wall, a standing fan. Laid out round the origin, the
// television at the back (-Z) and the seats facing it.
import { setFootprint } from "@japacity/model-kit";
import { box, cylinder, floorQuad, quad } from "@japacity/model-kit/kit";
import { Group, type Object3D } from "three";

import { at } from "../parts";

function seat(g: Object3D, width: number, x: number, z: number, ry: number): void {
  const frame = at(g, x, z, ry);
  box(frame, width, 0.42, 0.78, 0, 0, 0, "wine");
  box(frame, width, 0.48, 0.2, 0, 0.42, -0.29, "wine");
  for (const side of [-1, 1]) box(frame, 0.18, 0.62, 0.78, side * (width / 2 - 0.09), 0, 0, "wine");
  box(frame, width * 0.6, 0.3, 0.02, 0, 0.58, -0.18, "cream");
  box(frame, width - 0.36, 0.06, 0.62, 0, 0.42, 0.06, "seat");
}

export function buildParlourSet(): Group {
  const g = new Group();
  g.name = "prop_parlour-set";
  floorQuad(g, 3.2, 2.2, 0, 0.02, 0.3, "indigo");
  floorQuad(g, 2.8, 1.8, 0, 0.024, 0.3, "gold");
  floorQuad(g, 2.4, 1.4, 0, 0.028, 0.3, "wine");
  seat(g, 2.0, 0, 1.9, Math.PI);
  seat(g, 0.95, -2.2, 0.4, Math.PI / 2);
  seat(g, 0.95, 2.2, 0.4, -Math.PI / 2);
  // The centre table.
  for (const [x, z] of [[-0.5, 0.05], [0.5, 0.05], [-0.5, 0.55], [0.5, 0.55]] as const) box(g, 0.05, 0.4, 0.05, x, 0, z, "darkWood");
  box(g, 1.2, 0.04, 0.7, 0, 0.4, 0.3, "darkWood");
  box(g, 1.1, 0.02, 0.6, 0, 0.44, 0.3, "glass");
  box(g, 0.2, 0.03, 0.15, 0.3, 0.46, 0.2, "white");
  // The television on its stand, against the wall behind.
  box(g, 1.6, 0.55, 0.45, 0, 0, -1.4, "darkWood");
  quad(g, 0.7, 0.4, -0.35, 0.08, -1.17, "black");
  box(g, 1.1, 0.66, 0.06, 0, 0.62, -1.45, "black");
  quad(g, 1.0, 0.56, 0, 0.67, -1.418, "glass");
  box(g, 0.25, 0.07, 0.15, 0, 0.55, -1.45, "black");
  // The standing fan in the corner.
  cylinder(g, 0.16, 0.04, -1.5, 0, -1.2, "black", 8);
  cylinder(g, 0.025, 1.15, -1.5, 0.04, -1.2, "white", 6);
  const head = new Group();
  head.position.set(-1.5, 1.25, -1.1);
  head.rotation.x = Math.PI / 2;
  g.add(head);
  cylinder(head, 0.24, 0.08, 0, -0.04, 0, "white", 10);
  cylinder(head, 0.1, 0.12, 0, -0.16, 0, "hub", 8);
  // The three-seater, the armchairs, the centre table, the television's stand and the fan; the rug is floor.
  return setFootprint(g, [
    { x: 0, z: 1.9, width: 2.0, depth: 0.8 },
    { x: -2.2, z: 0.4, width: 0.8, depth: 0.95 },
    { x: 2.2, z: 0.4, width: 0.8, depth: 0.95 },
    { x: 0, z: 0.3, width: 1.2, depth: 0.7 },
    { x: 0, z: -1.4, width: 1.6, depth: 0.5 },
    { x: -1.5, z: -1.15, width: 0.4, depth: 0.45 },
  ]);
}
