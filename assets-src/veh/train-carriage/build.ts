// A suburban train's carriage for the ride abroad (world:ride-abroad-and-workplace): white with a blue band
// under the windows, grey doors in two pairs a side, a yellow end as every train in the UK has, and no
// operator's colours, mark or words (assets:no-real-brands-on-assets). Built to be sat in: the walls, floor and roof are thin slabs
// with an inner face, the seats face each other in bays by the windows with yellow poles at the doors, and the
// glass is a pane that faces out, so from outside the windows are dark and from a seat the line runs past them.
// Built along +x as the design's vehicles are, then turned to face +z (assets:metre-units-and-origin).
import { lowBox, setFootprint } from "@japacity/assets";
import { quad } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ, wheel } from "../lab";

/** The carriage's numbers, in metres: length along x as built, the floor at platform height. */
export const CARRIAGE = { length: 19.6, width: 2.8, floor: 1.1, sill: 1.85, head: 2.75, roof: 3.3 } as const;

/**
 * Where the ride's camera sits, in the turned model's own frame (facing +z): a window seat in the middle bay on
 * the +x side facing the front, eyes over the cushion, looking out of the window beside it or along the carriage.
 */
export const CARRIAGE_SEAT = { eye: [1.05, 2.28, -1.2], window: [8, 1.9, -0.9], along: [0, 2.0, 9] } as const;

export function buildTrainCarriage(): Group {
  const g = new Group();
  const { length: L, width: W, floor, sill, head, roof } = CARRIAGE;
  const hl = L / 2;
  const hw = W / 2;
  const doors = [-hl + 4.6, hl - 4.6];
  const side = (s: number): number => (s < 0 ? Math.PI : 0);

  // The underframe and the floor: a dark frame, equipment boxes between the bogies, the floor slab on top.
  cbox(g, L - 1.2, 0.3, W - 0.5, 0, floor - 0.4, 0, "charcoal");
  for (const x of [-3.5, 0.2, 3.6]) cbox(g, 1.6, 0.42, W - 0.9, x, floor - 0.68, 0, "black");
  cbox(g, L, 0.12, W, 0, floor - 0.06, 0, "hub");
  cbox(g, L - 0.12, 0.02, W - 0.12, 0, floor + 0.01, 0, "charcoal");
  // Two bogies of four wheels under the ends.
  for (const x of [-hl + 3.0, hl - 3.0]) {
    cbox(g, 2.6, 0.36, W - 0.7, x, 0.55, 0, "black");
    for (const dx of [-0.9, 0.9]) for (const s of [-1, 1]) wheel(g, 0.42, 0.14, x + dx, 0.42, s * 0.72);
  }

  // The sides: below the windows and above them thin slabs, cream inside, white outside with the blue band; the
  // glass between, one dark pane a bay facing out, with the door pairs cut through the band.
  for (const s of [-1, 1]) {
    const inner = s * (hw - 0.03);
    const outer = s * (hw + 0.002);
    cbox(g, L, sill - floor, 0.06, 0, (floor + sill) / 2, inner, "cream");
    cbox(g, L, roof - 0.25 - head, 0.06, 0, (head + roof - 0.25) / 2, inner, "cream");
    quad(g, L, sill - floor + 0.3, 0, floor - 0.3, outer, "white", side(s));
    quad(g, L, roof - 0.25 - head, 0, head, outer, "white", side(s));
    quad(g, L, 0.16, 0, sill - 0.3, outer + s * 0.003, "blue", side(s));
    // The windows: a pane between posts, every bay of seats; inside each post a cream pillar.
    for (let x = -hl + 0.6; x <= hl - 0.6 + 1e-6; x += 1.9) {
      cbox(g, 0.12, head - sill, 0.06, x, (sill + head) / 2, inner, "cream");
      quad(g, 0.14, head - sill, x, sill, outer, "white", side(s));
    }
    quad(g, L - 1.2, head - sill, 0, sill, outer - s * 0.002, "glass", side(s));
    // The doors: grey leaves with tall glass, a yellow edge and a black seam, in two pairs a side.
    for (const x of doors) {
      quad(g, 1.5, 2.0, x, floor, outer + s * 0.006, "concrete", side(s));
      quad(g, 0.4, 1.0, x - 0.38, floor + 0.85, outer + s * 0.009, "glass", side(s));
      quad(g, 0.4, 1.0, x + 0.38, floor + 0.85, outer + s * 0.009, "glass", side(s));
      quad(g, 0.04, 2.0, x, floor, outer + s * 0.012, "black", side(s));
      quad(g, 1.56, 0.06, x, floor + 2.0, outer + s * 0.008, "danfoYellow", side(s));
    }
  }

  // The ends: the yellow front of a driving end at +x, a plain gangway end at -x, both closed with inner faces.
  for (const e of [-1, 1]) {
    const x = e * (hl - 0.03);
    cbox(g, 0.06, roof - 0.25 - floor, W, x, (floor + roof - 0.25) / 2, 0, "cream");
    const out = e * (hl + 0.002);
    const ry = e * (Math.PI / 2);
    quad(g, W, roof - 0.25 - floor + 0.3, out, floor - 0.3, 0, e > 0 ? "danfoYellow" : "white", ry);
    if (e > 0) {
      quad(g, W - 0.5, 0.75, out + 0.003, sill + 0.1, 0, "glass", ry);
      for (const z of [-0.95, 0.95]) quad(g, 0.3, 0.16, out + 0.004, floor + 0.2, z, "cream", ry);
      cbox(g, 0.3, 0.3, W - 0.6, hl + 0.1, floor - 0.25, 0, "black");
    } else {
      quad(g, 1.0, 2.0, out + -0.003, floor, 0, "charcoal", ry);
    }
  }

  // The roof: a ceiling slab, and over it a shallow curve of three flats in grey.
  cbox(g, L, 0.06, W, 0, roof - 0.22, 0, "white");
  cbox(g, L, 0.18, W - 0.9, 0, roof - 0.09, 0, "zinc");
  for (const s of [-1, 1]) cbox(g, L, 0.12, 0.5, 0, roof - 0.16, s * (hw - 0.22), "zinc");
  // Lights along the ceiling.
  for (const s of [-1, 1]) cbox(g, L - 2, 0.03, 0.18, 0, roof - 0.27, s * 0.55, "cream");

  // The seats: bays of two facing two on both sides of the aisle, each bay under its window, none at the doors.
  const seat = (x: number, z: number, faces: number): void => {
    cbox(g, 0.46, 0.12, 0.92, x, floor + 0.42, z, "blue");
    cbox(g, 0.1, 0.62, 0.92, x - faces * 0.26, floor + 0.78, z, "blue");
    cbox(g, 0.06, 0.36, 0.7, x, floor + 0.18, z, "charcoal");
  };
  for (let bay = -hl + 1.55; bay < hl - 1.0; bay += 1.9) {
    if (doors.some((door) => Math.abs(door - bay) < 1.2)) continue;
    for (const z of [-0.88, 0.88]) {
      seat(bay - 0.5, z, 1);
      seat(bay + 0.5, z, -1);
    }
  }
  // Yellow poles at each door and a grab rail along the ceiling.
  for (const x of doors) for (const dz of [-0.35, 0.35]) cbox(g, 0.05, roof - 0.28 - floor, 0.05, x, (floor + roof - 0.28) / 2, dz, "danfoYellow");
  for (const s of [-1, 1]) cbox(g, L - 2, 0.04, 0.04, 0, roof - 0.5, s * 0.45, "hub");

  const root = facePlusZ(g, "veh_train-carriage");
  return setFootprint(root, [lowBox(root)]);
}
