// A Dubai metro car for the ride abroad (world:ride-abroad-and-workplace; design page 15
// section 6): the leading car of a driverless train, silver with a red band, its nose one raked sweep of dark glass;
// no operator's mark, line name or words (assets:no-real-brands-on-assets). With no driver, the front is the passengers': two pairs of
// seats face the windscreen, and the ride sits there, on the right, the line ahead and the city out of the side
// glass. Behind, benches run along the walls between the doors as a metro's do. Built to be sat in as London's
// carriage is, the glass a pane facing out. Built along +x as the design's vehicles are, then turned to face +z
// (assets:metre-units-and-origin).
import { lowBox, setFootprint } from "@japacity/assets";
import { quad, solid } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ, wheel } from "../lab";
import type { RideSeat } from "../ride";

/** The car's numbers in metres: length along x as built, the nose at +x, the floor at the viaduct platform's height. */
export const METRO = { length: 17.0, width: 2.9, floor: 1.1, sill: 1.55, head: 2.8, roof: 3.5 } as const;

/** The ride's seat in the built frame: the front seat on the right (+z), facing the windscreen. */
export const METRO_SEAT_BUILT: RideSeat = { eye: [6.55, 2.3, 1.05], window: [8, 1.9, 8], ahead: [20, 2.0, 0.5] };

/** The same seat in the turned model's own frame (facing +z, the window side at -x), as the ride reads it. */
export const METRO_SEAT: RideSeat = { eye: [-1.05, 2.3, 6.4], window: [-8, 1.9, 7.85], ahead: [-0.5, 2, 19.85] };

export function buildDubaiMetro(): Group {
  const g = new Group();
  const { length: L, width: W, floor, sill, head, roof } = METRO;
  const hl = L / 2;
  const hw = W / 2;
  const doors = [-hl + 2.6, -1.4, 3.4];
  const side = (s: number): number => (s < 0 ? Math.PI : 0);
  // Where the straight body ends and the nose begins.
  const neck = hl - 1.4;

  // The underframe and the floor; two bogies.
  cbox(g, L - 1.6, floor - 0.45, W - 0.1, -0.4, (floor + 0.45) / 2, 0, "charcoal");
  cbox(g, L - 0.4, 0.04, W - 0.12, -0.1, floor - 0.02, 0, "hub");
  for (const x of [-hl + 2.4, hl - 3.2]) {
    cbox(g, 2.4, 0.32, W - 0.7, x, 0.42, 0, "black");
    for (const dx of [-0.85, 0.85]) for (const s of [-1, 1]) wheel(g, 0.36, 0.12, x + dx, 0.36, s * 0.74);
  }

  // The sides of the straight body: silver slabs under and over the windows, the red band, the glass over black
  // posts, and three pairs of doors a side.
  for (const s of [-1, 1]) {
    const inner = s * (hw - 0.03);
    const outer = s * (hw + 0.003);
    const x0 = -hl;
    const x1 = neck;
    cbox(g, x1 - x0, sill - 0.45, 0.06, (x0 + x1) / 2, (0.45 + sill) / 2, inner, "zinc");
    cbox(g, x1 - x0, roof - head, 0.06, (x0 + x1) / 2, (head + roof) / 2, inner, "zinc");
    quad(g, x1 - x0, 0.16, (x0 + x1) / 2, sill - 0.32, outer, "red", side(s));
    quad(g, x1 - x0, 0.05, (x0 + x1) / 2, 0.75, outer, "hub", side(s));
    for (let x = x0 + 0.9; x < x1 - 0.2; x += 1.7) cbox(g, 0.1, head - sill, 0.07, x, (sill + head) / 2, inner, "black");
    quad(g, x1 - x0 - 0.3, head - sill, (x0 + x1) / 2 + 0.15, sill, outer + s * 0.005, "glass", side(s));
    for (const x of doors) {
      quad(g, 1.5, head - floor + 0.05, x, floor - 0.05, outer + s * 0.008, "hub", side(s));
      for (const dx of [-0.38, 0.38]) quad(g, 0.56, 1.5, x + dx, floor + 0.5, outer + s * 0.011, "glass", side(s));
      quad(g, 0.04, head - floor, x, floor, outer + s * 0.013, "black", side(s));
    }
  }

  // The nose: the sides taper in plan and the roof falls to a raked windscreen, one solid of silver with the glass
  // laid on its faces, hollow behind a thin skin so the front seats look out through it.
  const tip = hl;
  const nw = hw - 0.25;
  const noseLow: [number, number, number][] = [[neck, 0.45, -hw], [neck, 0.45, hw], [tip, 0.45, nw], [tip, 0.45, -nw]];
  // The skirt and the panel under the windscreen, a box under the sill.
  solid(g, [...noseLow, [neck, sill, -hw], [neck, sill, hw], [tip, sill - 0.2, nw], [tip, sill - 0.2, -nw]], [[0, 3, 2, 1], [3, 7, 6, 2], [1, 2, 6, 5], [0, 4, 7, 3], [4, 5, 6, 7]], "zinc");
  quad(g, W - 0.6, 0.14, tip + 0.004, 0.6, 0, "red", Math.PI / 2);
  for (const z of [-0.85, 0.85]) quad(g, 0.36, 0.12, tip + 0.006, 0.9, z, "cream", Math.PI / 2);
  cbox(g, 0.4, 0.3, 0.6, tip + 0.1, 0.62, 0, "black");
  // The windscreen raked back from the sill at the tip to the roof at the neck; its frame and the roof cap.
  const rake: [number, number, number][] = [[tip, sill - 0.2, -nw], [tip, sill - 0.2, nw], [neck + 0.2, roof, hw - 0.05], [neck + 0.2, roof, -hw + 0.05]];
  solid(g, rake, [[0, 3, 2, 1]], "glass");
  // The side glass of the nose, a tapering pane each side.
  solid(g, [[neck, sill, hw + 0.004], [tip, sill - 0.2, nw + 0.004], [neck + 0.2, roof, hw + 0.004], [neck, head, hw + 0.004]], [[0, 1, 2, 3]], "glass");
  solid(g, [[neck, sill, -hw - 0.004], [neck, head, -hw - 0.004], [neck + 0.2, roof, -hw - 0.004], [tip, sill - 0.2, -nw - 0.004]], [[0, 1, 2, 3]], "glass");
  // A dark frame where the nose's glass meets the body.
  cbox(g, 0.08, roof - sill, 0.08, neck, (sill + roof) / 2, hw - 0.04, "black");
  cbox(g, 0.08, roof - sill, 0.08, neck, (sill + roof) / 2, -hw + 0.04, "black");

  // The back: a closed end with a gangway door, silver.
  cbox(g, 0.06, roof - 0.45, W - 0.04, -hl + 0.03, (roof + 0.45) / 2, 0, "zinc");
  quad(g, 1.0, 2.0, -hl - 0.004, floor, 0, "charcoal", -Math.PI / 2);

  // The roof: a silver slab, with the ceiling's light strips under it.
  cbox(g, neck + hl + 0.2, 0.1, W, (neck + 0.2 - hl) / 2, roof + 0.05, 0, "zinc");
  for (const s of [-1, 1]) cbox(g, L - 3, 0.025, 0.18, -0.6, roof - 0.03, s * 0.55, "white");

  // The seats: two pairs at the nose facing the windscreen, then benches along the walls between the doors, with
  // grab poles at each door and the rails along the ceiling.
  for (const z of [-0.85, 0.85]) {
    cbox(g, 0.5, 0.12, 0.95, neck - 0.6, floor + 0.46, z, "red");
    cbox(g, 0.1, 0.66, 0.95, neck - 0.88, floor + 0.8, z, "red");
    cbox(g, 0.4, 0.4, 0.8, neck - 0.6, floor + 0.06, z, "charcoal");
  }
  const runs: [number, number][] = [[-hl + 0.3, (doors[0] ?? 0) - 0.85], [(doors[0] ?? 0) + 0.85, (doors[1] ?? 0) - 0.85], [(doors[1] ?? 0) + 0.85, (doors[2] ?? 0) - 0.85], [(doors[2] ?? 0) + 0.85, neck - 1.2]];
  for (const [x0, x1] of runs) {
    for (const s of [-1, 1]) {
      cbox(g, x1 - x0, 0.1, 0.5, (x0 + x1) / 2, floor + 0.45, s * (hw - 0.32), "red");
      cbox(g, x1 - x0, 0.6, 0.08, (x0 + x1) / 2, floor + 0.85, s * (hw - 0.1), "red");
      cbox(g, x1 - x0, 0.4, 0.4, (x0 + x1) / 2, floor + 0.05, s * (hw - 0.3), "charcoal");
    }
  }
  for (const x of doors) for (const dz of [-0.45, 0.45]) cbox(g, 0.045, roof - floor, 0.045, x, (floor + roof) / 2, dz, "hub");
  for (const s of [-1, 1]) cbox(g, L - 4, 0.035, 0.035, -0.6, roof - 0.45, s * 0.5, "hub");

  const root = facePlusZ(g, "veh_dubai-metro");
  return setFootprint(root, [lowBox(root)]);
}
