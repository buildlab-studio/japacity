// A CTrain car for the ride abroad in Calgary (world:ride-abroad-and-workplace; design page 15
// section 6): a light rail car of two sections on three bogies with the bellows between them, white over red, a cab at
// each end with its deep windscreen, the pantograph on the roof; no operator's mark, line number or words
// (assets:no-real-brands-on-assets). Built to be sat in as London's carriage is: walls, floor and roof thin slabs, the glass a pane facing
// out, seats in bays of two facing two by the windows, yellow poles at the doors. The ride's seat is on the right of
// the facing, the outer side where the line runs past. Built along +x as every vehicle is, then turned to face
// +z (assets:metre-units-and-origin).
import { lowBox, setFootprint } from "@japacity/assets";
import { beam, quad } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ, wheel } from "../centred";
import type { RideSeat } from "../ride";

/** The car's numbers in metres: length along x as built, the floor at the high platform's height. */
export const CTRAIN = { length: 24.0, width: 2.65, floor: 1.0, sill: 1.75, head: 2.7, roof: 3.35 } as const;

/** The ride's seat in the built frame: a window seat facing ahead in the back section's middle bay, on the right (+z). */
export const CTRAIN_SEAT_BUILT: RideSeat = { eye: [-7.72, 2.2, 1.04], window: [-4.5, 1.9, 8], ahead: [6, 2.0, 0.6] };

/** The same seat in the turned model's own frame (facing +z, the window side at -x), as the ride reads it. */
export const CTRAIN_SEAT: RideSeat = { eye: [-1.04, 2.2, -7.72], window: [-8, 1.9, -4.5], ahead: [-0.6, 2, 6] };

export function buildCtrainCar(): Group {
  const g = new Group();
  const { length: L, width: W, floor, sill, head, roof } = CTRAIN;
  const hl = L / 2;
  const hw = W / 2;
  const doors = [-hl + 3.0, -3.3, 3.3, hl - 3.0];
  const side = (s: number): number => (s < 0 ? Math.PI : 0);

  // The underframe: a red skirt from the bogies' tops to the floor, and the floor on it.
  cbox(g, L - 0.4, floor - 0.42, W - 0.06, 0, (floor + 0.42) / 2, 0, "red");
  cbox(g, L - 0.2, 0.04, W - 0.12, 0, floor - 0.02, 0, "charcoal");
  // Three bogies: under each cab and under the bellows.
  for (const x of [-hl + 2.4, 0, hl - 2.4]) {
    cbox(g, 2.2, 0.3, W - 0.6, x, 0.45, 0, "black");
    for (const dx of [-0.8, 0.8]) for (const s of [-1, 1]) wheel(g, 0.33, 0.12, x + dx, 0.33, s * 0.72);
  }

  // The sides: the wall under the windows and over them, white slabs; the red band outside from the skirt to the
  // sill; the glass one pane a side over black posts; the doors' grey leaves with tall glass laid over the lot.
  for (const s of [-1, 1]) {
    const inner = s * (hw - 0.03);
    const outer = s * (hw + 0.003);
    cbox(g, L - 0.1, sill - floor, 0.06, 0, (floor + sill) / 2, inner, "white");
    cbox(g, L - 0.1, roof - head, 0.06, 0, (head + roof) / 2, inner, "white");
    quad(g, L - 0.4, sill - 0.42 - 0.12, 0, 0.42, outer, "red", side(s));
    quad(g, L - 0.4, 0.05, 0, sill - 0.14, outer + s * 0.002, "charcoal", side(s));
    for (let x = -hl + 1.6; x < hl - 1.5; x += 1.6) cbox(g, 0.1, head - sill, 0.07, x, (sill + head) / 2, inner, "black");
    quad(g, L - 2.6, head - sill, 0, sill, outer + s * 0.004, "glass", side(s));
    for (const x of doors) {
      quad(g, 1.4, head - floor + 0.05, x, floor - 0.05, outer + s * 0.007, "concrete", side(s));
      for (const dx of [-0.36, 0.36]) quad(g, 0.5, 1.3, x + dx, floor + 0.65, outer + s * 0.01, "glass", side(s));
      quad(g, 0.04, head - floor, x, floor, outer + s * 0.012, "black", side(s));
      quad(g, 1.46, 0.05, x, head, outer + s * 0.009, "danfoYellow", side(s));
    }
  }

  // The bellows between the sections: a black band round the body.
  for (const s of [-1, 1]) quad(g, 0.7, roof - 0.42, 0, 0.42, s * (hw + 0.016), "black", side(s));
  cbox(g, 0.7, 0.04, W - 0.1, 0, roof + 0.02, 0, "black");

  // The cabs at both ends: a red mask under a deep raked windscreen, the blank sign over it, lamps and the coupler;
  // inside, a closed bulkhead behind the driver.
  for (const e of [-1, 1]) {
    const x = e * (hl - 0.03);
    const ry = e * (Math.PI / 2);
    const out = e * (hl + 0.004);
    cbox(g, 0.06, roof - 0.42, W - 0.04, x, (roof + 0.42) / 2, 0, "white");
    quad(g, W - 0.04, sill - 0.42, out, 0.42, 0, "red", ry);
    quad(g, W - 0.25, 1.25, out + e * 0.002, sill - 0.1, 0, "glass", ry);
    quad(g, W - 0.7, 0.2, out + e * 0.004, roof - 0.32, 0, "black", ry);
    for (const z of [-0.9, 0.9]) quad(g, 0.32, 0.14, out + e * 0.004, 1.05, z, "cream", ry);
    cbox(g, 0.4, 0.3, 0.5, e * (hl + 0.15), 0.62, 0, "black");
    cbox(g, 0.06, head - floor, W - 0.1, e * (hl - 1.6), (floor + head) / 2, 0, "hub");
    cbox(g, 0.5, 0.06, W - 0.1, e * (hl - 1.85), head + 0.03, 0, "hub");
  }

  // The roof: a white slab, the grey boxes of its gear, and the pantograph folded up over the front section.
  cbox(g, L - 0.1, 0.08, W, 0, roof + 0.04, 0, "white");
  for (const x of [-7.5, 5.5]) cbox(g, 3.2, 0.32, 1.4, x, roof + 0.24, 0, "hub");
  const p = 2.0;
  cbox(g, 1.4, 0.14, 1.2, p, roof + 0.15, 0, "charcoal");
  beam(g, [p - 0.5, roof + 0.22, 0], [p + 0.3, roof + 0.9, 0], 0.05, "charcoal");
  beam(g, [p + 0.3, roof + 0.9, 0], [p - 0.3, roof + 1.5, 0], 0.05, "charcoal");
  cbox(g, 0.12, 0.05, 1.5, p - 0.3, roof + 1.52, 0, "black");
  // The ceiling's lights, and the grab rails along it.
  for (const s of [-1, 1]) cbox(g, L - 4, 0.025, 0.16, 0, roof - 0.03, s * 0.5, "cream");
  for (const s of [-1, 1]) cbox(g, L - 4, 0.035, 0.035, 0, roof - 0.45, s * 0.42, "hub");

  // The seats: bays of two facing two on both sides of the aisle under the windows, none at the doors or the bellows.
  const seat = (x: number, z: number, faces: number): void => {
    cbox(g, 0.46, 0.12, 0.9, x, floor + 0.46, z, "indigo");
    cbox(g, 0.1, 0.64, 0.9, x - faces * 0.26, floor + 0.8, z, "indigo");
  };
  for (const [from, to] of [[-hl + 1.8, doors[0] ?? 0], [(doors[0] ?? 0) + 0.8, (doors[1] ?? 0) - 0.8], [(doors[1] ?? 0) + 0.8, -0.5], [0.5, (doors[2] ?? 0) - 0.8], [(doors[2] ?? 0) + 0.8, (doors[3] ?? 0) - 0.8], [(doors[3] ?? 0) + 0.8, hl - 1.8]] as const) {
    for (let bay = from + 0.95; bay + 0.95 <= to + 0.01; bay += 1.9) {
      for (const z of [-0.84, 0.84]) {
        seat(bay - 0.5, z, 1);
        seat(bay + 0.5, z, -1);
      }
    }
  }
  // Yellow poles at each door.
  for (const x of doors) for (const dz of [-0.4, 0.4]) cbox(g, 0.045, roof - floor, 0.045, x, (floor + roof) / 2, dz, "danfoYellow");

  const root = facePlusZ(g, "veh_ctrain-car");
  return setFootprint(root, [lowBox(root)]);
}
