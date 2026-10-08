// The white plastic chair of every Lagos party and every veranda: a moulded seat, a slatted back
// that leans, four splayed legs. Stacked by the hundred for hire; instanced in a place.
import { box, solid, type Vec3 } from "@japacity/assets/kit";
import { Group } from "three";

export function buildPlasticChair(): Group {
  const g = new Group();
  g.name = "prop_plastic-chair";
  // The seat, a little wider at the front.
  const seat: Vec3[] = [
    [-0.22, 0.42, -0.2], [0.22, 0.42, -0.2], [0.24, 0.42, 0.22], [-0.24, 0.42, 0.22],
    [-0.22, 0.46, -0.2], [0.22, 0.46, -0.2], [0.24, 0.46, 0.22], [-0.24, 0.46, 0.22],
  ];
  solid(g, seat, [[4, 7, 6, 5], [0, 1, 2, 3], [3, 2, 6, 7], [1, 0, 4, 5], [0, 3, 7, 4], [2, 1, 5, 6]], "white");
  // The back, leaning out, with two dark gaps where the slats are moulded through.
  const lean = new Group();
  lean.position.set(0, 0.46, -0.2);
  lean.rotation.x = -0.22;
  g.add(lean);
  box(lean, 0.44, 0.42, 0.04, 0, 0, 0, "white");
  for (const x of [-0.1, 0.1]) box(lean, 0.05, 0.24, 0.045, x, 0.1, 0, "concrete");
  // Splayed legs.
  for (const [x, z] of [[-0.21, -0.18], [0.21, -0.18], [-0.23, 0.2], [0.23, 0.2]] as const) {
    const leg = new Group();
    leg.position.set(x, 0.42, z);
    leg.rotation.set(z > 0 ? 0.08 : -0.08, 0, x > 0 ? -0.08 : 0.08);
    g.add(leg);
    box(leg, 0.04, 0.42, 0.04, 0, -0.415, 0, "white");
  }
  return g;
}
