// The design's vehicles (models.js), ported to the kit's shapes. Built along +x as drawn,
// then turned to face +z (R-ASSET-003). Plain colours from the palette; no real company's livery.
import { lowBox, setFootprint } from "@japacity/assets";
import { Group } from "three";

import { cbox, ccyl, facePlusZ, lump, profile, wheel } from "./lab";

/** The danfo: a yellow minibus with two black stripes and a loaded roof rack. */
export function buildDanfo(): Group {
  const g = new Group();
  const W = 1.75;
  const hw = W / 2;
  // The body as one extruded side profile: slanted nose and windscreen.
  profile(g, [[-2.25, 0.35], [2.25, 0.35], [2.28, 1.1], [1.95, 1.95], [-2.2, 1.95], [-2.25, 1.2]], W, "danfoYellow");
  for (const s of [1, -1]) {
    cbox(g, 4.5, 0.08, 0.02, 0, 1.0, s * (hw + 0.01), "black");
    cbox(g, 4.5, 0.08, 0.02, 0, 0.82, s * (hw + 0.01), "black");
  }
  for (const s of [1, -1]) {
    for (const [x0, x1] of [[1.0, 1.75], [0.0, 0.85], [-0.95, -0.1], [-2.0, -1.1]] as const) cbox(g, x1 - x0, 0.5, 0.02, (x0 + x1) / 2, 1.55, s * (hw + 0.01), "glass");
  }
  // The sliding door's seams, kerb side.
  cbox(g, 0.02, 1.25, 0.02, 0.92, 1.05, hw + 0.012, "black");
  cbox(g, 0.02, 1.25, 0.02, -0.02, 1.05, hw + 0.012, "black");
  // Windscreen on the slanted nose, and the rear window.
  const th = 0.3708;
  cbox(g, 0.03, 0.78, 1.5, 2.115 + Math.cos(th) * 0.02, 1.525 + Math.sin(th) * 0.02, 0, "glass", th);
  cbox(g, 0.03, 0.5, 1.3, -2.235, 1.58, 0, "glass", -0.06);
  // Bumpers, lights, grille, plates.
  cbox(g, 0.12, 0.18, 1.8, 2.3, 0.45, 0, "black");
  cbox(g, 0.12, 0.18, 1.8, -2.3, 0.45, 0, "black");
  cbox(g, 0.04, 0.14, 0.7, 2.285, 0.85, 0, "black");
  for (const s of [1, -1]) {
    cbox(g, 0.05, 0.16, 0.26, 2.285, 0.85, s * 0.62, "cream");
    cbox(g, 0.05, 0.22, 0.14, -2.27, 0.85, s * 0.72, "red");
  }
  cbox(g, 0.02, 0.12, 0.42, 2.37, 0.45, 0, "white");
  cbox(g, 0.02, 0.12, 0.42, -2.37, 0.45, 0, "white");
  for (const s of [1, -1]) {
    cbox(g, 0.04, 0.04, 0.16, 1.95, 1.5, s * (hw + 0.08), "black");
    cbox(g, 0.05, 0.2, 0.1, 1.95, 1.45, s * (hw + 0.2), "black");
  }
  for (const x of [1.45, -1.45]) for (const s of [1, -1]) wheel(g, 0.33, 0.22, x, 0.33, s * 0.8);
  // The roof rack and its load.
  for (const s of [1, -1]) cbox(g, 3.0, 0.04, 0.04, -0.4, 2.03, s * 0.7, "black");
  for (const x of [-1.8, -0.9, 0.0, 0.9]) cbox(g, 0.04, 0.04, 1.44, x, 2.03, 0, "black");
  cbox(g, 0.9, 0.34, 0.7, -1.2, 2.22, 0.1, "blue");
  cbox(g, 0.6, 0.26, 0.5, -0.3, 2.18, -0.25, "red");
  lump(g, 0.3, 0.45, 2.24, 0.2, "tan", [1.3, 0.75, 1]);
  cbox(g, 0.24, 0.36, 0.16, -0.25, 2.23, 0.42, "danfoYellow");
  const root = facePlusZ(g, "veh_danfo");
  return setFootprint(root, [lowBox(root)]);
}

/** The keke: a three-wheeled passenger tricycle. */
export function buildKeke(): Group {
  const g = new Group();
  // Floor, rear body, sills.
  cbox(g, 2.0, 0.1, 1.2, -0.35, 0.42, 0, "black");
  cbox(g, 0.55, 0.62, 1.26, -1.05, 0.78, 0, "danfoYellow");
  cbox(g, 0.56, 0.08, 1.27, -1.05, 0.9, 0, "black");
  for (const s of [1, -1]) {
    cbox(g, 1.0, 0.3, 0.04, -0.3, 0.62, s * 0.61, "danfoYellow");
    cbox(g, 1.0, 0.05, 0.045, -0.3, 0.7, s * 0.61, "black");
  }
  // Seats.
  cbox(g, 0.45, 0.14, 1.1, -0.72, 0.8, 0, "seat");
  cbox(g, 0.1, 0.5, 1.1, -0.95, 1.12, 0, "seat");
  cbox(g, 0.36, 0.12, 0.5, 0.3, 0.8, 0, "seat");
  cbox(g, 0.06, 0.5, 1.1, 0.08, 1.05, 0, "canvas");
  // The nose and its lamp.
  profile(g, [[0.6, 0.42], [1.35, 0.42], [1.42, 0.75], [1.15, 1.05], [0.6, 1.05]], 1.0, "danfoYellow");
  ccyl(g, 0.1, 0.06, 1.41, 0.82, 0, "cream", "x", 10);
  cbox(g, 0.03, 0.1, 0.5, 1.31, 0.55, 0, "black");
  // Windscreen and its pillars.
  const th = 0.2558;
  cbox(g, 0.03, 0.67, 0.98, 1.035, 1.375, 0, "glass", th);
  for (const s of [1, -1]) cbox(g, 0.05, 0.7, 0.05, 1.035, 1.375, s * 0.51, "danfoYellow", th);
  // Roof, rear pillars, back canvas.
  cbox(g, 2.3, 0.07, 1.3, -0.2, 1.74, 0, "canvas");
  cbox(g, 0.1, 0.075, 1.31, 0.93, 1.74, 0, "danfoYellow");
  for (const s of [1, -1]) {
    cbox(g, 0.05, 0.72, 0.05, -1.3, 1.38, s * 0.61, "danfoYellow");
    cbox(g, 0.05, 0.72, 0.05, 0.08, 1.38, s * 0.61, "danfoYellow");
  }
  cbox(g, 0.03, 0.66, 1.2, -1.31, 1.4, 0, "canvas");
  cbox(g, 0.02, 0.22, 0.6, -1.33, 1.48, 0, "glass");
  // Handlebar and fork.
  ccyl(g, 0.02, 0.7, 0.72, 1.12, 0, "black", "z", 6);
  cbox(g, 0.04, 0.5, 0.04, 0.8, 0.9, 0, "black", -0.25);
  for (const s of [1, -1]) cbox(g, 0.04, 0.34, 0.03, 1.02, 0.36, s * 0.08, "black", 0.2);
  cbox(g, 0.5, 0.04, 0.2, 1.05, 0.47, 0, "danfoYellow");
  // Wheels and tail lights.
  wheel(g, 0.22, 0.1, 1.05, 0.22, 0);
  for (const s of [1, -1]) wheel(g, 0.22, 0.12, -0.95, 0.22, s * 0.62);
  for (const s of [1, -1]) cbox(g, 0.03, 0.1, 0.12, -1.335, 0.72, s * 0.5, "red");
  const root = facePlusZ(g, "veh_keke");
  return setFootprint(root, [lowBox(root)]);
}

/** The okada: a small commuter motorcycle, as used for taxis. */
export function buildOkada(): Group {
  const g = new Group();
  wheel(g, 0.29, 0.09, 0.68, 0.29, 0);
  wheel(g, 0.29, 0.1, -0.62, 0.29, 0);
  // The fork from the bars down to the front axle, the frame, the engine.
  for (const s of [1, -1]) cbox(g, 0.04, 0.82, 0.03, 0.56, 0.68, s * 0.075, "hub", 0.306);
  cbox(g, 0.82, 0.06, 0.07, -0.02, 0.52, 0, "black", 0.12);
  cbox(g, 0.06, 0.4, 0.07, 0.3, 0.68, 0, "black", -0.5);
  cbox(g, 0.34, 0.26, 0.26, 0.02, 0.42, 0, "canvas");
  ccyl(g, 0.07, 0.3, 0.02, 0.42, 0, "hub", "z");
  // Tank, seat, rear rack.
  profile(g, [[0.36, 0.74], [0.42, 0.9], [0.12, 0.95], [-0.08, 0.86], [-0.08, 0.74]], 0.26, "red");
  cbox(g, 0.72, 0.09, 0.26, -0.42, 0.8, 0, "black");
  cbox(g, 0.3, 0.03, 0.24, -0.9, 0.8, 0, "hub");
  cbox(g, 0.03, 0.14, 0.24, -1.04, 0.86, 0, "hub");
  // Mudguards, foot pegs, lamp, bars, exhaust, lights, plate.
  cbox(g, 0.4, 0.03, 0.12, 0.68, 0.6, 0, "red");
  cbox(g, 0.5, 0.04, 0.14, -0.64, 0.605, 0, "red", 0.04);
  for (const s of [1, -1]) cbox(g, 0.12, 0.02, 0.06, -0.52, 0.36, s * 0.19, "black");
  ccyl(g, 0.085, 0.07, 0.56, 0.98, 0, "cream", "x", 10);
  cbox(g, 0.1, 0.16, 0.2, 0.5, 0.98, 0, "black");
  ccyl(g, 0.016, 0.7, 0.44, 1.1, 0, "black", "z", 6);
  for (const s of [1, -1]) ccyl(g, 0.022, 0.12, 0.44, 1.1, s * 0.31, "black", "z", 6);
  ccyl(g, 0.04, 0.8, -0.42, 0.36, 0.15, "hub", "x");
  cbox(g, 0.04, 0.08, 0.12, -1.06, 0.72, 0, "red");
  cbox(g, 0.02, 0.1, 0.2, -1.08, 0.6, 0, "danfoYellow");
  for (const s of [1, -1]) cbox(g, 0.12, 0.02, 0.06, -0.1, 0.34, s * 0.19, "black");
  const root = facePlusZ(g, "veh_okada");
  // The front wheel and fork, and the rear wheel and rack. The ground under the seat between them,
  // where a rider stands astride, is left free; grown by the walker's clearance the two boxes meet.
  const { x, z, width, depth } = lowBox(root);
  const front = z + depth / 2;
  const rear = z - depth / 2;
  return setFootprint(root, [
    { x, z: (front - 0.1) / 2, width, depth: front + 0.1 },
    { x, z: (rear - 0.6) / 2, width, depth: -0.6 - rear },
  ]);
}
