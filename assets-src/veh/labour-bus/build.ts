// A labour bus of the kind that carries workers between the camps and the sites (city.md
// place.deira; design page 15: the employer's shuttle to the site, place:employer-shuttle-rides-free): a long white coach
// body with a row of small windows, a roof hatch, the door at the front kerb side, a plain blue band;
// no operator's name or colours (assets:no-real-brands-on-assets). Built to be sat in for the ride (world:ride-abroad-and-workplace),
// as London's bus is: the walls, the floor and the roof are thin slabs, each
// small window a pane of glass facing out, so from outside the row is dark glass in a white body and
// from a seat the road shows through it. Rows of two and two face ahead; the ride sits by a window on
// the right of the facing, the kerb side. Built along +X as every vehicle is, then turned to
// face +Z.
import { lowBox, setFootprint } from "@japacity/assets";
import { part, quad } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ, wheel } from "../centred";
import type { RideSeat } from "../ride";

/** The bus's numbers in metres, in the frame it is built in: length along x, the kerb side at +z. */
export const LABOUR_BUS = { length: 7.3, width: 2.3, floor: 0.95, sill: 1.79, head: 2.41, roof: 2.8 } as const;

/** The ride's seat in the built frame: a window seat on the kerb side, in the row by the middle window. */
export const LABOUR_BUS_SEAT_BUILT: RideSeat = { eye: [-0.08, 2.1, 0.8], window: [0.6, 1.8, 6], ahead: [8, 1.9, 0.3] };

/** The same seat in the turned model's own frame (facing +z, the kerb side at -x), as the ride reads it. */
export const LABOUR_BUS_SEAT: RideSeat = { eye: [-0.8, 2.1, -0.08], window: [-6, 1.8, 0.6], ahead: [-0.3, 1.9, 8] };

export function buildLabourBus(): Group {
  const g = new Group();
  const { length: L, width, floor, sill, head, roof } = LABOUR_BUS;
  const hl = L / 2;
  const half = width / 2;
  const door: readonly [number, number] = [2.42, 3.28];
  const windows = Array.from({ length: 7 }, (_, k) => -2.95 + k * 0.92);

  // The underbody from the skirt to the floor, white, and the floor on it.
  cbox(g, L - 0.1, floor - 0.45, width, 0, (floor + 0.45) / 2, 0, "white");
  cbox(g, L - 0.2, 0.04, width - 0.12, 0, floor - 0.02, 0, "charcoal");
  for (const side of [1, -1]) {
    const z = side * (half - 0.03);
    const ry = side > 0 ? 0 : Math.PI;
    const out = side * (half + 0.004);
    // The lower wall to the sill and the upper wall from the head to the roof, the kerb side's lower wall cut at the door.
    const spans: [number, number][] = side > 0 ? [[-hl, door[0]], [door[1], hl - 0.05]] : [[-hl, hl - 0.05]];
    for (const [x0, x1] of spans) cbox(g, x1 - x0, sill - floor, 0.06, (x0 + x1) / 2, (sill + floor) / 2, z, "white");
    cbox(g, L - 0.05, roof - head, 0.06, -0.025, (head + roof) / 2, z, "white");
    // The posts between the small windows, and the panes over the windows, facing out.
    // The kerb side's last window gives way to the door; the posts run round it.
    const panes = side > 0 ? windows.filter((x) => x + 0.375 <= door[0]) : windows;
    const edges = [-hl, ...panes.flatMap((x) => [x - 0.375, x + 0.375]), hl - 0.05];
    for (let k = 0; k < edges.length; k += 2) {
      const x0 = edges[k] ?? 0;
      const x1 = edges[k + 1] ?? 0;
      const pieces: [number, number][] = side > 0 ? [[x0, Math.min(x1, door[0])], [Math.max(x0, door[1]), x1]] : [[x0, x1]];
      for (const [a, b] of pieces) if (b - a > 0.01) cbox(g, b - a, head - sill, 0.06, (a + b) / 2, (sill + head) / 2, z, "white");
    }
    for (const x of panes) quad(g, 0.75, 0.62, x, sill, out, "glass", ry);
    // The plain blue band and the grey line along the foot.
    for (const [x0, x1] of spans) quad(g, x1 - x0, 0.18, (x0 + x1) / 2, 1.06, out + side * 0.002, "blue", ry);
    quad(g, L - 0.1, 0.06, 0, 0.52, out, "hub", ry);
  }
  // The door at the front, kerb side: a tall pane with its black seam, and its step.
  quad(g, door[1] - door[0], 1.95, (door[0] + door[1]) / 2, 0.475, half + 0.006, "glass");
  quad(g, 0.04, 1.95, door[0] + 0.02, 0.475, half + 0.01, "black");
  cbox(g, 0.9, 0.12, 0.25, 2.85, 0.48, half + 0.08, "black");
  cbox(g, 0.8, 0.3, 0.6, 2.85, 0.62, half - 0.35, "charcoal");

  // The front: the panel under the windscreen, the windscreen facing out, lamps, mirrors; the dashboard and the
  // driver's seat inside on the road side.
  cbox(g, 0.06, 1.3 - 0.45, width, hl - 0.03, (1.3 + 0.45) / 2, 0, "white");
  cbox(g, 0.06, roof - 2.65, width, hl - 0.03, (2.65 + roof) / 2, 0, "white");
  quad(g, width - 0.25, 1.35, hl + 0.004, 1.3, 0, "glass", Math.PI / 2);
  cbox(g, 0.45, 0.4, width - 0.2, hl - 0.3, floor + 0.4, 0, "charcoal");
  cbox(g, 0.5, 0.1, 0.5, hl - 1.1, floor + 0.45, -0.55, "black");
  cbox(g, 0.1, 0.7, 0.5, hl - 1.36, floor + 0.8, -0.55, "black");
  // The back: a white wall with the rear window facing out.
  cbox(g, 0.06, roof - 0.45, width, -hl + 0.03, (roof + 0.45) / 2, 0, "white");
  quad(g, 1.9, 0.7, -hl - 0.004, 1.8, 0, "glass", -Math.PI / 2);
  for (const x of [hl + 0.05, -hl - 0.05]) cbox(g, 0.14, 0.24, width, x, 0.55, 0, "hub");
  for (const side of [1, -1]) {
    quad(g, 0.16, 0.3, hl + 0.006, 0.88, side * 0.85, "cream", Math.PI / 2);
    quad(g, 0.16, 0.22, -hl - 0.006, 0.88, side * 0.9, "red", -Math.PI / 2);
    cbox(g, 0.06, 0.32, 0.06, hl - 0.1, 2.2, side * (half + 0.22), "black");
    cbox(g, 0.06, 0.06, 0.24, hl - 0.1, 2.38, side * (half + 0.1), "black");
  }
  // The roof, white over and under, with its hatch.
  cbox(g, L, 0.08, width, 0, roof + 0.04, 0, "white");
  cbox(g, 0.8, 0.12, 0.8, -0.8, roof + 0.14, 0, "hub");

  // The seats: rows of two and two facing ahead, each by its window, the bench across the back; a grab rail down the aisle.
  const seat = (x: number, z: number, w = 0.86): void => {
    cbox(g, 0.42, 0.1, w, x, floor + 0.44, z, "seat");
    cbox(g, 0.08, 0.6, w, x - 0.22, floor + 0.76, z, "seat");
    cbox(g, 0.06, 0.4, 0.06, x - 0.08, floor + 0.2, z, "hub");
  };
  for (let x = 1.52; x > -hl + 0.9; x -= 0.82) {
    seat(x, -0.62);
    seat(x, 0.62);
  }
  seat(-hl + 0.45, 0, width - 0.2);
  for (const side of [1, -1]) cbox(g, L - 2, 0.035, 0.035, -0.6, roof - 0.32, side * 0.32, "hub");

  // The wheels are round parts, shown smooth (assets:flat-and-smooth-shading).
  const wheels = part(g, "wheels");
  wheels.userData.smooth = true;
  for (const x of [2.35, -2.2]) for (const side of [1, -1]) wheel(wheels, 0.42, 0.28, x, 0.42, side * 0.98);
  const root = facePlusZ(g, "veh_labour-bus");
  return setFootprint(root, [lowBox(root)]);
}
