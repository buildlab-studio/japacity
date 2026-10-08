// The party's cooking in the yard: a big pot of jollof on three stones over a wood fire, the lid on,
// firewood stacked beside it and a stool for whoever is stirring. The smoke is the place's motion.
import { setFootprint } from "@japacity/assets";
import { beam, box, cylinder, paletteMaterial, seeded } from "@japacity/assets/kit";
import { Group, IcosahedronGeometry, Mesh } from "three";

export function buildCookingFire(): Group {
  const g = new Group();
  g.name = "prop_cooking-fire";
  const random = seeded(77);
  for (let i = 0; i < 3; i++) {
    const turn = (i / 3) * Math.PI * 2;
    const stone = new Mesh(new IcosahedronGeometry(0.17, 0), paletteMaterial("concreteWorn"));
    stone.scale.set(1, 0.9, 1);
    stone.position.set(Math.sin(turn) * 0.32, 0.15, Math.cos(turn) * 0.32);
    g.add(stone);
  }
  // Burning wood under the pot, ash round it.
  cylinder(g, 0.5, 0.02, 0, 0, 0, "charcoal", 10);
  for (let i = 0; i < 4; i++) {
    const turn = (i / 4) * Math.PI * 2 + 0.3;
    beam(g, [Math.sin(turn) * 0.7, 0.05, Math.cos(turn) * 0.7], [Math.sin(turn) * 0.05, 0.12, Math.cos(turn) * 0.05], 0.07, "darkWood");
  }
  box(g, 0.2, 0.1, 0.2, 0, 0.02, 0, "orange");
  // The pot and its lid.
  cylinder(g, 0.42, 0.55, 0, 0.28, 0, "black", 12, 0.48);
  cylinder(g, 0.47, 0.04, 0, 0.83, 0, "hub", 12);
  box(g, 0.12, 0.05, 0.05, 0, 0.87, 0, "black");
  // Firewood stacked, and the stool.
  for (let i = 0; i < 5; i++) beam(g, [0.9, 0.06 + (i % 2) * 0.1, 0.3 + i * 0.1 + random() * 0.04], [1.6, 0.06 + (i % 2) * 0.1, 0.25 + i * 0.1], 0.08, i % 2 === 0 ? "wood" : "darkWood");
  box(g, 0.32, 0.3, 0.32, -0.95, 0, 0.35, "wood");
  // The fire and its pot, and the stacked firewood; the stool is a seat.
  return setFootprint(g, [
    { x: 0, z: 0, width: 1.45, depth: 1.45 },
    { x: 1.25, z: 0.5, width: 0.8, depth: 0.65 },
  ]);
}
