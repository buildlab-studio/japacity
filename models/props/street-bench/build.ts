// A bench on a London high street (city.md place.peckham): wooden slats on two black cast ends, the
// back leaning, room for three. Built facing +Z (assets:metre-units-and-origin), standing on its feet at y = 0. Its
// footprint is the slats' and the ends', so no one of the crowd stands inside it.
import { setFootprint } from "@japacity/model-kit";
import { box } from "@japacity/model-kit/kit";
import { Group } from "three";

export const BENCH = { width: 1.8, depth: 0.62, seat: 0.44 } as const;

export function buildStreetBench(): Group {
  const g = new Group();
  g.name = "prop_street-bench";
  const { width, seat } = BENCH;
  const half = width / 2;
  // The two cast ends: a front leg, a back leg, an arm and a foot rail low between them.
  for (const x of [-half + 0.04, half - 0.04]) {
    box(g, 0.06, seat, 0.06, x, 0, 0.22, "black");
    box(g, 0.06, 0.82, 0.06, x, 0, -0.24, "black", 0);
    box(g, 0.07, 0.04, 0.52, x, 0.62, 0, "black");
    box(g, 0.06, 0.18, 0.06, x, seat, 0.22, "black");
    box(g, 0.06, 0.05, 0.5, x, 0.14, -0.01, "black");
  }
  // The seat's three slats, a finger's gap between each.
  for (const z of [-0.16, 0.0, 0.16]) box(g, width - 0.12, 0.04, 0.13, 0, seat, z, "wood");
  // The back's two slats, leaning out.
  const back = new Group();
  back.position.set(0, seat + 0.06, -0.24);
  back.rotation.x = -0.18;
  g.add(back);
  for (const y of [0.08, 0.26]) box(back, width - 0.12, 0.12, 0.035, 0, y, 0, "wood");
  return setFootprint(g, [{ x: 0, z: 0, width, depth: BENCH.depth }]);
}
