// The coast road's bus at Castel Volturno for the ride abroad (world:ride-abroad-and-workplace; design
// page 11 section 6): a low-floor single-decker, white with a blue skirt and a blue band under the windows, plain,
// with no operator's colours, mark, route number or words (assets:no-real-brands-on-assets). Built to be sat in as London's bus is: the
// walls, floor and roof are thin slabs with an inner face, the seats stand in pairs facing the front, and the glass
// is a pane that faces out, so from outside the windows are dark and from a seat the coast road shows through them.
// Its doors are on the right of its facing, the kerb side in Italy. Built along +x as every vehicle is, then
// turned to face +z (assets:metre-units-and-origin).
import { lowBox, setFootprint } from "@japacity/assets";
import { quad } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ, wheel } from "../centred";

/** The bus's numbers, in metres, in the frame it is built in: length along x, the kerb side at +z. */
export const ITALY_BUS = { length: 12.0, width: 2.55, floor: 0.38, sill: 1.05, head: 2.4, roof: 2.95 } as const;

/**
 * Where the ride's camera sits, in the turned model's own frame (facing +z, the kerb side at -x): the window seat on
 * the kerb side in the second row behind the front door, eyes over the cushion; `window` is where it looks out of the
 * side glass at the verge, `ahead` where it looks down the bus to the windscreen. The same shape as London's seats.
 */
export const ITALY_BUS_SEAT = { eye: [-0.62, 1.62, 2.84], window: [-4.5, 1.0, 9.5], ahead: [-0.3, 1.5, 12] } as const;

export function buildItalyBus(): Group {
  const g = new Group();
  const { length: L, width: W, floor, sill, head, roof } = ITALY_BUS;
  const hl = L / 2;
  const hw = W / 2;
  // The two doors on the kerb side: one ahead of the front wheel, one in the middle. [centre x, width]
  const middle = 0.2;
  const doors: readonly (readonly [number, number])[] = [[hl - 1.1, 1.2], [middle, 1.3]];
  const out = { kerb: 0, road: Math.PI } as const;

  // The underframe below the low floor, and the floor itself, dark inside.
  cbox(g, L - 0.1, floor - 0.26, W - 0.04, 0, (floor + 0.26) / 2, 0, "white");
  cbox(g, L - 0.12, 0.02, W - 0.12, 0, floor + 0.01, 0, "charcoal");
  // The side walls from the floor to the sill, thin slabs; on the kerb side the door openings are left out.
  const kerbPanels: [number, number][] = [];
  let from = -hl;
  for (const [x, width] of [...doors].sort((a, b) => a[0] - b[0])) {
    kerbPanels.push([from, x - width / 2]);
    from = x + width / 2;
  }
  kerbPanels.push([from, hl]);
  for (const [x0, x1] of kerbPanels) cbox(g, x1 - x0, sill - floor, 0.06, (x0 + x1) / 2, (floor + sill) / 2, hw - 0.03, "white");
  cbox(g, L, sill - floor, 0.06, 0, (floor + sill) / 2, -hw + 0.03, "white");
  // Outside: the blue skirt along the foot and the blue band under the windows, each side.
  for (const [z, ry] of [[hw + 0.004, out.kerb], [-hw - 0.004, out.road]] as const) {
    for (const [x0, x1] of z > 0 ? kerbPanels : [[-hl, hl] as [number, number]]) {
      quad(g, x1 - x0, 0.32, (x0 + x1) / 2, 0.26, z, "blue", ry);
      quad(g, x1 - x0, 0.14, (x0 + x1) / 2, sill - 0.24, z, "blue", ry);
    }
  }
  // The doors: glass leaves in black frames, a seam down each, the step's edge yellow.
  for (const [x, width] of doors) {
    quad(g, width + 0.1, head - 0.25, x, floor - 0.02, hw + 0.002, "black", out.kerb);
    quad(g, width - 0.04, head - 0.4, x, floor + 0.05, hw + 0.006, "glass", out.kerb);
    quad(g, 0.04, head - 0.4, x, floor + 0.05, hw + 0.01, "black", out.kerb);
    cbox(g, width, 0.03, 0.12, x, floor + 0.015, hw - 0.06, "danfoYellow");
  }
  // The window band: one dark pane each side, facing out, black posts over it outside and white posts inside.
  for (const s of [-1, 1]) {
    const z = s * (hw + 0.004);
    const ry = s > 0 ? out.kerb : out.road;
    for (let x = -hl + 0.3; x < hl - 1.8; x += 1.4) {
      const onDoor = s > 0 && doors.some(([dx, width]) => Math.abs(x - dx) < width / 2 + 0.1);
      if (onDoor) continue;
      quad(g, 0.08, head - sill, x, sill, z + s * 0.003, "black", ry);
      cbox(g, 0.08, head - sill, 0.05, x, (sill + head) / 2, s * (hw - 0.04), "white");
    }
    // The glass, broken by the doors on the kerb side.
    const spans: [number, number][] = s > 0 ? kerbPanels.map(([a, b]) => [a + 0.1, b - 0.1]) : [[-hl + 0.1, hl - 0.1]];
    for (const [x0, x1] of spans) quad(g, x1 - x0, head - sill, (x0 + x1) / 2, sill, z, "glass", ry);
    // Over the windows to the roof: a white band, thin, its inside white too.
    cbox(g, L, roof - head, 0.06, 0, (head + roof) / 2, s * (hw - 0.03), "white");
  }
  // Over each door the band runs on, so the doors stand in a frame.
  for (const [x, width] of doors) cbox(g, width, head - (floor + head - 0.25), 0.06, x, head - 0.125, hw - 0.03, "white");
  // The roof: a white slab and the air conditioner's pod on top.
  cbox(g, L, 0.08, W, 0, roof + 0.04, 0, "white");
  cbox(g, 3.2, 0.24, 1.6, 0.8, roof + 0.2, 0, "hub");
  cbox(g, 3.0, 0.03, 1.4, 0.8, roof + 0.335, 0, "white");

  // The front: the deep windscreen, the black band where the route board would be (no words), lamps, a plain plate.
  const front = hl + 0.005;
  cbox(g, 0.06, 0.6, W, hl - 0.03, floor + 0.3, 0, "white");
  quad(g, W - 0.12, 0.42, front, 0.26, 0, "blue", Math.PI / 2);
  quad(g, W - 0.14, head - 0.95 + 0.12, front, 0.98, 0, "glass", Math.PI / 2);
  quad(g, W - 0.3, 0.26, front + 0.002, head + 0.02, 0, "black", Math.PI / 2);
  cbox(g, 0.06, roof - head, W, hl - 0.03, (head + roof) / 2, 0, "white");
  for (const z of [-0.95, 0.95]) quad(g, 0.34, 0.14, front + 0.003, 0.72, z, "cream", Math.PI / 2);
  quad(g, 0.52, 0.12, front + 0.003, 0.4, 0, "white", Math.PI / 2);
  cbox(g, 0.14, 0.18, W, hl + 0.05, 0.38, 0, "black");
  for (const s of [-1, 1]) {
    cbox(g, 0.05, 0.05, 0.36, hl - 0.04, 2.25, s * (hw + 0.16), "black");
    cbox(g, 0.07, 0.34, 0.06, hl - 0.04, 2.0, s * (hw + 0.34), "black");
  }
  // The back: the engine's wall to the sill, a rear window over it, lamps, the grille and a plain plate.
  const back = -hl - 0.005;
  cbox(g, 0.06, sill + 0.4 - floor, W, -hl + 0.03, (floor + sill + 0.4) / 2, 0, "white");
  quad(g, W - 0.6, head - sill - 0.4, back, sill + 0.4, 0, "glass", -Math.PI / 2);
  cbox(g, 0.06, roof - head, W, -hl + 0.03, (head + roof) / 2, 0, "white");
  quad(g, W - 0.12, 0.42, back, 0.26, 0, "blue", -Math.PI / 2);
  quad(g, W - 0.8, 0.4, back - 0.002, 0.75, 0, "black", -Math.PI / 2);
  for (const z of [-1.0, 1.0]) quad(g, 0.2, 0.46, back - 0.002, 0.9, z, "red", -Math.PI / 2);
  quad(g, 0.52, 0.12, back - 0.002, 0.4, 0, "white", -Math.PI / 2);
  cbox(g, 0.12, 0.18, W, -hl - 0.04, 0.38, 0, "black");
  // The wheels stand just proud of the sides in black arches, so they read from the street.
  for (const x of [hl - 2.7, -hl + 3.2]) {
    for (const s of [-1, 1]) {
      quad(g, 1.25, 0.62, x, 0.2, s * (hw + 0.008), "black", s > 0 ? out.kerb : out.road);
      wheel(g, 0.5, 0.3, x, 0.5, s * (hw - 0.12));
    }
  }

  // Inside: the driver's place at the front on the road side, then pairs of seats facing the front, the middle
  // door's space left clear on the kerb side, grey poles and the stop buttons red on them.
  cbox(g, 0.5, 0.75, 0.9, hl - 0.6, floor + 0.375, -hw + 0.55, "charcoal");
  cbox(g, 0.5, 0.08, 0.5, hl - 1.3, floor + 0.5, -hw + 0.6, "black");
  cbox(g, 0.08, 0.6, 0.5, hl - 1.55, floor + 0.84, -hw + 0.6, "black");
  const seat = (x: number, z: number): void => {
    cbox(g, 0.44, 0.1, 0.9, x, floor + 0.45, z, "denim");
    cbox(g, 0.08, 0.6, 0.9, x - 0.24, floor + 0.78, z, "denim");
    cbox(g, 0.36, 0.4, 0.06, x - 0.05, floor + 0.2, z, "hub");
  };
  for (let row = 0; row < 10; row += 1) {
    const x = hl - 2.2 - row * 0.85;
    if (x < -hl + 0.6) break;
    // The road side has a pair in every row past the driver.
    seat(x, -0.62);
    // The kerb side keeps clear round the middle door for a pram or a chair.
    if (Math.abs(x - middle) > 1.2) seat(x, 0.62);
  }
  for (const [x, z] of [[hl - 1.9, 0.1], [middle + 0.8, 0.1], [middle - 0.8, 0.1], [-hl + 2.5, 0.1]] as const) {
    cbox(g, 0.05, head - floor + 0.4, 0.05, x, (floor + head + 0.4) / 2, z, "hub");
    cbox(g, 0.08, 0.08, 0.08, x, 1.45, z, "red");
  }
  cbox(g, L - 2.5, 0.04, 0.04, -0.8, head + 0.1, 0.35, "hub");
  cbox(g, L - 2.5, 0.04, 0.04, -0.8, head + 0.1, -0.35, "hub");

  const root = facePlusZ(g, "veh_italy-bus");
  return setFootprint(root, [lowBox(root)]);
}
