// London's red bus for the ride abroad (world:ride-abroad-and-workplace): a two-deck city bus, plain red as
// every London bus is, with no operator's mark, roundel, route number or words (assets:no-real-brands-on-assets). The top deck is
// built to be sat in: its walls, floor and roof are thin slabs with an inner face, its seats stand in pairs down
// both sides, and the glass is a pane that faces out, so from outside the band of windows is dark glass and from
// a seat inside the street shows through it. The doors are on the left of its facing, the kerb side in the UK.
// Built along +x as every vehicle is, then turned to face +z (assets:metre-units-and-origin).
import { lowBox, setFootprint } from "@japacity/model-kit";
import { quad } from "@japacity/model-kit/kit";
import { Group } from "three";

import { cbox, facePlusZ, wheel } from "../centred";

/** The bus's numbers, in metres, in the frame it is built in: length along x, the kerb side at -z. */
export const BUS = { length: 10.6, width: 2.5, deck: 2.35, window: 3.15, roof: 4.05, sill: 0.32 } as const;

/**
 * Where the ride's camera sits on the top deck, in the turned model's own frame (facing +z, the kerb side at +x):
 * the front seat on the kerb side, eyes over the cushion, looking ahead through the front window and out of the
 * side glass beside it.
 */
export const BUS_TOP_SEAT = { eye: [0.62, 3.55, 4.25], ahead: [0.4, 3.2, 12], side: [5, 2.6, 3.4] } as const;

export function buildLondonBus(): Group {
  const g = new Group();
  const { length: L, width: W, deck, window: sill, roof } = BUS;
  const hl = L / 2;
  const hw = W / 2;
  const facing = { kerb: Math.PI, road: 0 } as const;

  // The lower deck: one solid red body from the sill to the upper floor, with its glass and doors laid on it.
  cbox(g, L, deck - BUS.sill, W, 0, (deck + BUS.sill) / 2, 0, "red");
  // A black skirt along the foot and the bumpers either end.
  cbox(g, L + 0.04, 0.16, W + 0.02, 0, BUS.sill + 0.04, 0, "black");
  // The lower windows, both sides, behind the front door to the back, each pane apart by a red pillar.
  for (const [z, ry] of [[-hw - 0.005, facing.kerb], [hw + 0.005, facing.road]] as const) {
    for (const [x0, x1] of [[-4.6, -3.1], [-2.9, -1.4], [1.0, 2.4], [2.6, 3.4]] as const) quad(g, x1 - x0, 0.95, (x0 + x1) / 2, 1.15, z, "glass", ry);
  }
  // The kerb side's two doors: tall glass leaves with a black seam down the middle and a black frame.
  for (const x of [3.95, -0.2]) {
    quad(g, 1.25, 1.85, x, 0.42, -hw - 0.006, "black", facing.kerb);
    quad(g, 1.1, 1.72, x, 0.48, -hw - 0.009, "glass", facing.kerb);
    quad(g, 0.04, 1.72, x, 0.48, -hw - 0.012, "black", facing.kerb);
  }
  // The driver's side window on the road side, at the front.
  quad(g, 1.3, 1.0, 4.3, 1.15, hw + 0.005, "glass", facing.road);
  // The front: a deep windscreen, the black band between the decks where a blind would be, lamps and a plain plate.
  const front = hl + 0.005;
  quad(g, W - 0.16, 1.25, front, 0.95, 0, "glass", Math.PI / 2);
  quad(g, W - 0.3, 0.22, front + 0.002, 2.1, 0, "black", Math.PI / 2);
  for (const z of [-0.95, 0.95]) quad(g, 0.32, 0.16, front + 0.003, 0.62, z, "cream", Math.PI / 2);
  quad(g, 0.52, 0.12, front + 0.003, 0.5, 0, "white", Math.PI / 2);
  cbox(g, 0.14, 0.2, W, hl + 0.05, 0.42, 0, "black");
  // Mirrors on stalks either side of the windscreen.
  for (const s of [-1, 1]) {
    cbox(g, 0.06, 0.06, 0.32, hl - 0.05, 2.0, s * (hw + 0.14), "black");
    cbox(g, 0.08, 0.36, 0.06, hl - 0.05, 1.8, s * (hw + 0.3), "black");
  }
  // The back: the engine's grille, the lamps and a plain plate.
  const back = -hl - 0.005;
  quad(g, W - 0.5, 0.5, back, 0.75, 0, "black", -Math.PI / 2);
  for (const z of [-1.0, 1.0]) quad(g, 0.22, 0.5, back - 0.002, 1.1, z, "red", -Math.PI / 2);
  quad(g, 0.52, 0.12, back - 0.002, 0.5, 0, "white", -Math.PI / 2);
  cbox(g, 0.12, 0.2, W, -hl - 0.04, 0.42, 0, "black");
  for (const x of [hl - 2.0, -hl + 2.6]) for (const s of [-1, 1]) wheel(g, 0.5, 0.3, x, 0.5, s * (hw - 0.2));

  // The top deck: the floor, the panels under the windows, the corner posts and the roof as thin slabs, cream
  // inside and red outside, so a camera on a seat sees a room and not the backs of the bus's faces.
  cbox(g, L - 0.12, 0.03, W - 0.12, 0, deck + 0.015, 0, "charcoal");
  for (const s of [-1, 1]) {
    cbox(g, L, sill - deck, 0.06, 0, (deck + sill) / 2, s * (hw - 0.03), "cream");
    quad(g, L, sill - deck, 0, deck, s * (hw + 0.002), "red", s < 0 ? facing.kerb : facing.road);
  }
  for (const [x, ry, h0] of [[hl - 0.03, Math.PI / 2, 3.1], [-hl + 0.03, -Math.PI / 2, 3.25]] as const) {
    const out = x + Math.sign(x) * 0.032;
    cbox(g, 0.06, h0 - deck, W, x, (deck + h0) / 2, 0, "cream");
    quad(g, W, h0 - deck, out, deck, 0, "red", ry);
    // The glass across the end, facing out, between red corner posts.
    quad(g, W - 0.3, roof - h0 - 0.06, out + Math.sign(x) * 0.002, h0, 0, "glass", ry);
    for (const s of [-1, 1]) cbox(g, 0.08, roof - h0, 0.16, x, (h0 + roof) / 2, s * (hw - 0.08), "red");
  }
  // The side glass: one dark band each side, facing out, with thin black posts over it.
  for (const s of [-1, 1]) {
    const z = s * (hw + 0.004);
    const ry = s < 0 ? facing.kerb : facing.road;
    quad(g, L - 0.24, roof - sill, 0, sill, z, "glass", ry);
    for (let x = -hl + 1.2; x < hl - 0.6; x += 1.3) quad(g, 0.07, roof - sill, x, sill, z + s * 0.003, "black", ry);
    // Inside, a post at each of those, cream, so the band reads as windows from a seat too.
    for (let x = -hl + 1.2; x < hl - 0.6; x += 1.3) cbox(g, 0.08, roof - sill, 0.05, x, (sill + roof) / 2, s * (hw - 0.04), "cream");
  }
  cbox(g, L, 0.16, W, 0, roof + 0.08, 0, "red");
  cbox(g, L - 0.14, 0.03, W - 0.14, 0, roof - 0.015, 0, "cream");
  // A rail across the front window, the ledge under it.
  cbox(g, 0.05, 0.05, W - 0.3, hl - 0.18, deck + 1.05, 0, "danfoYellow");
  cbox(g, 0.22, 0.04, W - 0.16, hl - 0.14, 3.08, 0, "charcoal");

  // The seats: pairs down both sides from the front window to the back, the stair's well left open on the kerb side.
  const seat = (x: number, z: number): void => {
    cbox(g, 0.44, 0.12, 0.92, x, deck + 0.44, z, "indigo");
    cbox(g, 0.08, 0.56, 0.92, x - 0.24, deck + 0.78, z, "indigo");
    cbox(g, 0.08, 0.38, 0.06, x - 0.1, deck + 0.19, z, "hub");
  };
  for (let row = 0; row < 8; row += 1) {
    const x = hl - 0.75 - row * 0.85;
    seat(x, 0.62);
    // Behind the third row the stair comes up on the kerb side; a yellow rail guards it.
    if (row !== 3 && row !== 4) seat(x, -0.62);
  }
  cbox(g, 1.5, 0.05, 0.05, hl - 3.7, deck + 0.95, -0.15, "danfoYellow");
  cbox(g, 0.05, 0.95, 0.05, hl - 2.95, deck + 0.48, -0.15, "danfoYellow");
  cbox(g, 1.5, 0.02, 0.9, hl - 3.7, deck + 0.04, -0.65, "black");

  const root = facePlusZ(g, "veh_london-bus");
  return setFootprint(root, [lowBox(root)]);
}
