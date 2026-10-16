// The white van the gangmaster sends at dawn (docs/rules/world.md R-WORLD-039 as amended, place.md R-PLACE-013;
// design page 15 section 6): a plain panel van, dusty along the sills, with no name, mark or livery (R-ASSET-010).
// The back is built to be ridden in: thin walls with plywood to shoulder height inside, a wooden bench down each
// side, and a small window cut through the wall over each bench, in the back doors and in the bulkhead, so from a
// bench the camera sits low and the road shows only in those few panes. Its side door is on the right of its
// facing, the kerb side in Italy. Built along +x as the design's vehicles are, then turned to face +z (R-ASSET-003).
import { lowBox, setFootprint } from "@japacity/assets";
import { quad, solid } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

import { cbox, facePlusZ, profile, wheel } from "../lab";

/** The van's numbers, in metres, in the frame it is built in: length along x, the kerb side at +z. */
export const VAN = { length: 5.4, width: 2.0, floor: 0.58, roof: 2.45, bulkhead: 1.05, back: -2.7, bench: 0.98, window: [1.34, 1.8] } as const;

/**
 * Where the ride's camera sits, in the turned model's own frame (facing +z, the kerb side at -x): on the bench along
 * the road side, low, eyes under the small window's top; `window` is where it looks across the back and out of the
 * small window in the kerb side's wall, `ahead` where it looks forward through the bulkhead's pane to the windscreen.
 */
export const VAN_SEAT = { eye: [0.72, 1.5, -0.98], window: [-6, 1.75, -0.4], ahead: [-2.16, 1.45, 7.0] } as const;

/** A wall cut by one small window: four slabs round the opening, so the pane in it can be seen through from inside. */
function cutWall(g: Object3D, x0: number, x1: number, y0: number, y1: number, z: number, hole: readonly [number, number, number, number]): void {
  const [hx0, hx1, hy0, hy1] = hole;
  cbox(g, x1 - x0, hy0 - y0, 0.05, (x0 + x1) / 2, (y0 + hy0) / 2, z, "white");
  cbox(g, x1 - x0, y1 - hy1, 0.05, (x0 + x1) / 2, (hy1 + y1) / 2, z, "white");
  cbox(g, hx0 - x0, hy1 - hy0, 0.05, (x0 + hx0) / 2, (hy0 + hy1) / 2, z, "white");
  cbox(g, x1 - hx1, hy1 - hy0, 0.05, (hx1 + x1) / 2, (hy0 + hy1) / 2, z, "white");
}

export function buildVan(): Group {
  const g = new Group();
  const { length: L, width: W, floor, roof, bulkhead, back, bench } = VAN;
  const [wy0, wy1] = VAN.window;
  const hl = L / 2;
  const hw = W / 2;
  const out = { kerb: 0, road: Math.PI } as const;

  // The cab: a solid white body to the waist with the bonnet sloping off it, and over the waist an open shell (the
  // roof, the pillars, the doors' tops) whose glass faces out, so from the bench the road shows through the
  // bulkhead's pane and the windscreen beyond it.
  const waist = 1.25;
  const top = roof - 0.05;
  const foot = hl - 0.55;
  const brow = bulkhead + 0.55;
  profile(g, [[bulkhead, 0.32], [hl, 0.32], [hl + 0.02, 0.95], [foot, waist], [bulkhead, waist]], W, "white");
  cbox(g, brow - bulkhead + 0.1, 0.08, W, (bulkhead + brow) / 2, top - 0.04, 0, "white");
  const slope = Math.atan2(foot - brow, top - waist);
  const screen = new Group();
  screen.position.set(foot, waist, 0);
  screen.rotation.z = slope;
  g.add(screen);
  quad(screen, W - 0.16, Math.hypot(foot - brow, top - waist), 0, 0, 0, "glass", Math.PI / 2);
  for (const [z, ry] of [[hw, out.kerb], [-hw, out.road]] as const) {
    const side = Math.sign(z);
    // The windscreen's pillar, the door's back edge and the strip under the roof.
    cbox(g, 0.08, Math.hypot(foot - brow, top - waist), 0.08, (foot + brow) / 2, (waist + top) / 2, z - side * 0.04, "white", slope);
    cbox(g, 0.1, top - waist, 0.06, bulkhead + 0.05, (waist + top) / 2, z - side * 0.03, "white");
    // The door's window, cut to the windscreen's slope, facing out.
    const pane: [number, number, number][] = [[bulkhead + 0.1, waist, z], [foot - 0.02, waist, z], [brow, top - 0.08, z], [bulkhead + 0.1, top - 0.08, z]];
    solid(g, pane, [side > 0 ? [0, 1, 2, 3] : [3, 2, 1, 0]], "glass");
    quad(g, 0.03, waist - 0.5, bulkhead + 0.25, 0.5, z + side * 0.005, "black", ry);
    cbox(g, 0.06, 0.06, 0.28, foot - 0.2, 1.65, side * (hw + 0.14), "black");
    cbox(g, 0.06, 0.3, 0.06, foot - 0.2, 1.5, side * (hw + 0.28), "black");
  }
  // In the cab: the dashboard under the windscreen, the wheel on the left, the two seats' backs.
  cbox(g, 0.4, 0.12, W - 0.2, foot - 0.25, waist + 0.06, 0, "black");
  cbox(g, 0.04, 0.36, 0.36, foot - 0.55, waist + 0.2, -0.5, "black", 0.5);
  for (const z of [-0.5, 0.5]) cbox(g, 0.14, 0.62, 0.5, bulkhead + 0.3, waist + 0.31, z, "charcoal");
  // Lamps, the grille, the bumper and a plain plate at the front.
  const front = hl + 0.025;
  for (const z of [-0.72, 0.72]) quad(g, 0.36, 0.18, front, 0.78, z, "cream", Math.PI / 2);
  quad(g, 0.9, 0.22, front, 0.66, 0, "black", Math.PI / 2);
  cbox(g, 0.14, 0.2, W + 0.04, hl + 0.06, 0.3, 0, "black");
  quad(g, 0.52, 0.11, front + 0.06, 0.34, 0, "white", Math.PI / 2);

  // The back: the floor, the two long walls each cut by a small window, the roof, all thin with a white inside.
  const box0 = back;
  const box1 = bulkhead;
  const mid = (box0 + box1) / 2 - 0.15;
  cbox(g, box1 - box0, floor - 0.32, W, (box0 + box1) / 2, (floor + 0.32) / 2, 0, "white");
  cbox(g, box1 - box0 - 0.1, 0.02, W - 0.1, (box0 + box1) / 2, floor + 0.01, 0, "charcoal");
  for (const s of [-1, 1]) cutWall(g, box0, box1, floor, roof, s * (hw - 0.025), [mid - 0.36, mid + 0.36, wy0, wy1]);
  cbox(g, box1 - box0, 0.06, W, (box0 + box1) / 2, roof - 0.03, 0, "white");
  // The bulkhead behind the cab with its little pane, and the back doors with a pane in the kerb side's door; each
  // is drawn in a frame turned a quarter, so it stands across the van.
  for (const [x, hole] of [[box1 - 0.03, [-0.36, 0.36, 1.45, 1.88]], [box0 + 0.025, [-0.62, -0.22, 1.3, 1.75]]] as const) {
    const across = new Group();
    across.position.set(x, 0, 0);
    across.rotation.y = Math.PI / 2;
    g.add(across);
    cutWall(across, -hw, hw, floor, roof - 0.06, 0, hole);
  }
  // The second back door's pane: a dark square on the door, seen from outside only; its door is shut.
  quad(g, 0.4, 0.45, back - 0.003, 1.3, -0.42, "glass", -Math.PI / 2);
  quad(g, 0.03, roof - 0.5, back - 0.004, 0.4, 0, "black", -Math.PI / 2);
  // The panes in the cuts, facing out, so the back is dark glass from the street and open from a bench.
  for (const [z, ry] of [[hw + 0.002, out.kerb], [-hw - 0.002, out.road]] as const) quad(g, 0.72, wy1 - wy0, mid, wy0, z, "glass", ry);
  quad(g, 0.4, 0.45, back - 0.002, 1.3, 0.42, "glass", -Math.PI / 2);
  // The sliding door's seams on the kerb side, the lamps and the bumper at the back.
  for (const x of [box1 - 0.15, box1 - 1.4]) quad(g, 0.03, roof - floor - 0.2, x, floor - 0.1, hw + 0.004, "black", out.kerb);
  quad(g, 1.2, 0.03, box1 - 0.78, roof - 0.35, hw + 0.004, "black", out.kerb);
  for (const z of [-0.85, 0.85]) quad(g, 0.16, 0.42, back - 0.004, 0.75, z, "red", -Math.PI / 2);
  cbox(g, 0.14, 0.2, W + 0.04, back - 0.06, 0.3, 0, "black");
  quad(g, 0.52, 0.11, back - 0.13, 0.34, 0, "white", -Math.PI / 2);
  // Dust from the farm track along the sills.
  for (const [z, ry] of [[hw + 0.006, out.kerb], [-hw - 0.006, out.road]] as const) quad(g, L - 0.4, 0.22, 0, 0.32, z, "tan", ry);
  for (const x of [hl - 1.0, back + 0.95]) for (const s of [-1, 1]) wheel(g, 0.36, 0.24, x, 0.36, s * (hw - 0.14));

  // Inside the back: plywood to shoulder height on both walls, a bench down each side, a crate and a jerrycan.
  for (const s of [-1, 1]) {
    const z = s * (hw - 0.055);
    const ry = s > 0 ? Math.PI : 0;
    quad(g, box1 - box0 - 0.1, 1.3 - floor, (box0 + box1) / 2, floor + 0.02, z, "wood", ry);
    cbox(g, box1 - box0 - 0.5, 0.05, 0.36, (box0 + box1) / 2 + 0.1, bench - 0.05, s * (hw - 0.24), "darkWood");
    for (const x of [box0 + 0.5, mid, box1 - 0.4]) cbox(g, 0.05, bench - 0.05 - floor, 0.3, x, (floor + bench - 0.05) / 2, s * (hw - 0.24), "hub");
  }
  cbox(g, 0.5, 0.3, 0.36, box0 + 0.45, floor + 0.15, 0, "basin");
  cbox(g, 0.2, 0.4, 0.3, box0 + 0.95, floor + 0.2, 0.2, "red");

  const root = facePlusZ(g, "veh_van");
  return setFootprint(root, [lowBox(root)]);
}
