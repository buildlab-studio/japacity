// Calgary's city bus for the ride abroad (world:ride-abroad-and-workplace; design page 15
// section 6): a low-floor single-decker, white with a red skirt and a red nose, its window band one sweep of dark
// glass, a grey pod on the roof; no operator's mark, route number or words (assets:no-real-brands-on-assets). Built to be sat in as
// London's bus is: the walls, the floor and the roof are thin slabs, the glass a pane facing out, so from outside the
// band is dark and from a seat the street runs past it. Canada drives on the right: the doors and the ride's seat are
// on the right of its facing, the kerb side. Built along +x as the design's vehicles are, then turned to face +z
// (assets:metre-units-and-origin).
import { lowBox, setFootprint } from "@japacity/assets";
import { quad } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ, wheel } from "../lab";
import type { RideSeat } from "../ride";

/** The bus's numbers in metres, in the frame it is built in: length along x, the kerb side at +z. */
export const CALGARY_BUS = { length: 12.2, width: 2.55, floor: 0.38, sill: 1.05, head: 2.45, roof: 2.95 } as const;

/** The ride's seat in the built frame: a window seat on the kerb side behind the middle door, facing ahead. */
export const CALGARY_BUS_SEAT_BUILT: RideSeat = { eye: [-2.6, 1.6, 0.86], window: [0.5, 1.2, 6], ahead: [12, 1.4, 0.4] };

/**
 * The same seat in the turned model's own frame (facing +z, the kerb side at -x), as the ride reads it: the eye over
 * the cushion of the kerb-side window seat, a point out of the window beside it, a little ahead, and a point ahead.
 */
export const CALGARY_BUS_SEAT: RideSeat = { eye: [-0.86, 1.6, -2.61], window: [-6, 1.2, 0.49], ahead: [-0.4, 1.4, 11.99] };

export function buildCalgaryBus(): Group {
  const g = new Group();
  const { length: L, width: W, floor, sill, head, roof } = CALGARY_BUS;
  const hl = L / 2;
  const hw = W / 2;
  const faces = { kerb: 0, road: Math.PI } as const;
  const doors: readonly [number, number][] = [[hl - 1.65, hl - 0.4], [-0.15, 1.15]];
  const inDoor = (x0: number, x1: number): boolean => doors.some(([d0, d1]) => x0 < d1 && x1 > d0);

  // The underbody under the floor, red, with the floor on it.
  cbox(g, L - 0.1, floor - 0.26, W - 0.04, 0, (floor + 0.26) / 2, 0, "red");
  cbox(g, L - 0.12, 0.04, W - 0.12, 0, floor - 0.02, 0, "charcoal");

  // The sides: the lower wall from the floor to the sill, the upper wall from the head to the roof, white slabs; the
  // kerb side's lower wall cut at the two doors. Black posts between the panes, the glass laid outside over them.
  for (const s of [-1, 1]) {
    const z = s * (hw - 0.03);
    const spans: [number, number][] = s > 0 ? [[-hl, doors[1]?.[0] ?? 0], [doors[1]?.[1] ?? 0, doors[0]?.[0] ?? 0], [doors[0]?.[1] ?? 0, hl - 0.05]] : [[-hl, hl - 0.05]];
    for (const [x0, x1] of spans) cbox(g, x1 - x0, sill - floor, 0.06, (x0 + x1) / 2, (sill + floor) / 2, z, "white");
    cbox(g, L - 0.05, roof - head, 0.06, -0.025, (head + roof) / 2, z, "white");
    // The red skirt and its line, outside, under the window band.
    const out = s * (hw + 0.003);
    const ry = s > 0 ? faces.kerb : faces.road;
    for (const [x0, x1] of spans) quad(g, x1 - x0, 0.42, (x0 + x1) / 2, 0.3, out, "red", ry);
    for (const [x0, x1] of spans) quad(g, x1 - x0, 0.06, (x0 + x1) / 2, 0.8, out, "charcoal", ry);
    // A post behind every second row of seats, so each pair has its pane.
    for (let x = hl - 2.61; x > -hl + 0.4; x -= 1.64) {
      if (s > 0 && inDoor(x - 0.05, x + 0.05)) continue;
      cbox(g, 0.08, head - sill, 0.07, x, (sill + head) / 2, z, "black");
    }
    // The glass: the window band in pieces either side of the kerb side's doors.
    const bands: [number, number][] = s > 0 ? [[-hl + 0.3, doors[1]?.[0] ?? 0], [doors[1]?.[1] ?? 0, doors[0]?.[0] ?? 0]] : [[-hl + 0.3, hl - 0.4]];
    for (const [x0, x1] of bands) quad(g, x1 - x0, head - sill, (x0 + x1) / 2, sill, s * (hw + 0.006), "glass", ry);
  }
  // The doors: two leaves of tall glass each, in black frames, with a black seam between.
  for (const [x0, x1] of doors) {
    const x = (x0 + x1) / 2;
    const w = x1 - x0;
    quad(g, w + 0.08, head - floor + 0.06, x, floor - 0.02, hw + 0.004, "black", faces.kerb);
    quad(g, w - 0.08, head - floor - 0.1, x, floor + 0.06, hw + 0.008, "glass", faces.kerb);
    quad(g, 0.04, head - floor - 0.1, x, floor + 0.06, hw + 0.011, "black", faces.kerb);
    cbox(g, w, 0.1, 0.3, x, 0.2, hw - 0.1, "charcoal");
  }

  // The nose: a red mask under a deep windscreen, the blank sign box over it, lamps, and the bumper.
  const nose = hl - 0.03;
  cbox(g, 0.06, 0.95 - floor, W - 0.04, nose, (0.95 + floor) / 2, 0, "red");
  cbox(g, 0.06, roof - 2.75, W - 0.04, nose, (2.75 + roof) / 2, 0, "white");
  quad(g, W - 0.16, 1.8, hl + 0.004, 0.95, 0, "glass", Math.PI / 2);
  quad(g, W - 0.5, 0.22, hl + 0.008, 2.5, 0, "black", Math.PI / 2);
  for (const z of [-0.95, 0.95]) quad(g, 0.36, 0.14, hl + 0.008, 0.62, z, "cream", Math.PI / 2);
  cbox(g, 0.16, 0.24, W, hl + 0.05, 0.4, 0, "black");
  // Inside the nose, the dashboard and the driver's seat behind it on the road side.
  cbox(g, 0.5, 0.5, W - 0.2, hl - 0.3, floor + 0.5, 0, "charcoal");
  cbox(g, 0.5, 0.1, 0.5, hl - 1.2, floor + 0.45, -0.7, "black");
  cbox(g, 0.1, 0.7, 0.5, hl - 1.45, floor + 0.8, -0.7, "black");
  // Mirrors on stalks either side of the windscreen.
  for (const s of [-1, 1]) {
    cbox(g, 0.06, 0.06, 0.3, hl - 0.05, 2.2, s * (hw + 0.13), "black");
    cbox(g, 0.08, 0.34, 0.06, hl - 0.05, 2.0, s * (hw + 0.28), "black");
  }

  // The back: a white wall, the engine's grille, lamps, and a small high window.
  const tail = -hl + 0.03;
  cbox(g, 0.06, roof - floor, W - 0.04, tail, (roof + floor) / 2, 0, "white");
  quad(g, W - 0.2, 0.42, -hl - 0.003, 0.3, 0, "red", -Math.PI / 2);
  quad(g, W - 0.6, 0.55, -hl - 0.005, 0.75, 0, "black", -Math.PI / 2);
  quad(g, W - 0.5, 0.7, -hl - 0.005, 1.8, 0, "glass", -Math.PI / 2);
  for (const z of [-1.0, 1.0]) quad(g, 0.2, 0.4, -hl - 0.007, 0.9, z, "red", -Math.PI / 2);
  cbox(g, 0.14, 0.22, W, -hl - 0.04, 0.38, 0, "black");

  // The roof: the slab, white over and under, and the grey pod of its heating and cooling.
  cbox(g, L, 0.08, W, 0, roof + 0.04, 0, "white");
  cbox(g, 3.4, 0.26, 1.7, -2.2, roof + 0.21, 0, "hub");
  cbox(g, 1.2, 0.14, 1.0, 2.6, roof + 0.15, 0, "hub");

  // The wheels, and their wells inside under the seats over them.
  const axles = [hl - 2.7, -hl + 3.3];
  for (const x of axles) {
    for (const s of [-1, 1]) {
      wheel(g, 0.5, 0.3, x, 0.5, s * (hw - 0.22));
      quad(g, 1.25, 0.5, x, 0.32, s * (hw + 0.009), "black", s > 0 ? faces.kerb : faces.road);
      cbox(g, 1.2, 0.62, 0.5, x, floor + 0.31, s * (hw - 0.3), "charcoal");
    }
  }

  // The seats: pairs facing ahead down both sides, none in the kerb side's door spans; the bench across the back.
  const seat = (x: number, z: number, lift = 0): void => {
    const y = floor + lift;
    cbox(g, 0.44, 0.1, 0.9, x, y + 0.45, z, "denim");
    cbox(g, 0.08, 0.58, 0.9, x - 0.24, y + 0.78, z, "denim");
    if (lift === 0) cbox(g, 0.06, 0.4, 0.06, x - 0.1, y + 0.2, z, "hub");
  };
  for (let x = hl - 2.2; x > -hl + 1.2; x -= 0.82) {
    const lift = axles.some((axle) => Math.abs(axle - x) < 0.7) ? 0.3 : 0;
    seat(x, -0.66, lift);
    if (!inDoor(x - 0.5, x + 0.3)) seat(x, 0.66, lift);
  }
  cbox(g, 0.5, 0.1, W - 0.2, -hl + 0.55, floor + 0.75, 0, "denim");
  cbox(g, 0.08, 0.6, W - 0.2, -hl + 0.24, floor + 1.1, 0, "denim");
  cbox(g, 0.6, 0.7, W - 0.12, -hl + 0.4, floor + 0.35, 0, "charcoal");

  // Yellow poles at the doors and down the aisle, the grab rails along the ceiling.
  for (const [x0, x1] of doors) for (const x of [x0 - 0.05, x1 + 0.05]) cbox(g, 0.04, roof - floor, 0.04, x, (roof + floor) / 2, hw - 0.4, "danfoYellow");
  for (const x of [2.4, -2.2]) cbox(g, 0.04, roof - floor, 0.04, x, (roof + floor) / 2, -0.2, "danfoYellow");
  for (const s of [-1, 1]) cbox(g, L - 2.5, 0.035, 0.035, -0.5, roof - 0.35, s * 0.42, "hub");

  const root = facePlusZ(g, "veh_calgary-bus");
  return setFootprint(root, [lowBox(root)]);
}
