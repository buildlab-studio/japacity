// A labour bus of the kind that carries workers between the camps and the sites (city.md
// place.deira): a long white coach body with a row of small windows, a roof hatch, the door at the
// front kerb side, a plain blue band; no operator's name or colours (R-ASSET-010). Built along +X as
// the design built its vehicles, then turned to face +Z.
import { part } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ, profile, wheel } from "../lab";

export function buildLabourBus(): Group {
  const g = new Group();
  const width = 2.3;
  const half = width / 2;
  profile(g, [[-3.6, 0.45], [3.6, 0.45], [3.65, 1.3], [3.45, 2.75], [-3.55, 2.8], [-3.65, 1.3]], width, "white");
  for (const side of [1, -1]) {
    cbox(g, 7.2, 0.18, 0.02, 0, 1.15, side * (half + 0.01), "blue");
    for (let k = 0; k < 7; k += 1) cbox(g, 0.75, 0.62, 0.02, -2.95 + k * 0.92, 2.1, side * (half + 0.01), "glass");
    cbox(g, 7.2, 0.06, 0.02, 0, 0.55, side * (half + 0.01), "hub");
  }
  // The door at the front, kerb side, and its step.
  cbox(g, 0.85, 1.95, 0.02, 2.85, 1.45, half + 0.012, "glass");
  cbox(g, 0.02, 1.95, 0.03, 2.42, 1.45, half + 0.016, "black");
  cbox(g, 0.9, 0.12, 0.25, 2.85, 0.42, half + 0.08, "black");
  // Windscreen, rear window, lights, bumpers, mirrors.
  cbox(g, 0.04, 0.95, 2.05, 3.57, 2.15, 0, "glass", 0.12);
  cbox(g, 0.04, 0.7, 1.9, -3.64, 2.15, 0, "glass");
  for (const x of [3.7, -3.7]) cbox(g, 0.14, 0.24, 2.3, x, 0.55, 0, "hub");
  for (const side of [1, -1]) {
    cbox(g, 0.05, 0.16, 0.3, 3.66, 0.95, side * 0.85, "cream");
    cbox(g, 0.05, 0.22, 0.16, -3.66, 0.95, side * 0.9, "red");
    cbox(g, 0.06, 0.32, 0.06, 3.5, 2.2, side * (half + 0.22), "black");
  }
  cbox(g, 0.8, 0.12, 0.8, -0.8, 2.86, 0, "hub");
  // The wheels are round parts, shown smooth (R-ASSET-005).
  const wheels = part(g, "wheels");
  wheels.userData.smooth = true;
  for (const x of [2.35, -2.2]) for (const side of [1, -1]) wheel(wheels, 0.42, 0.28, x, 0.42, side * 0.98);
  return facePlusZ(g, "veh_labour-bus");
}
