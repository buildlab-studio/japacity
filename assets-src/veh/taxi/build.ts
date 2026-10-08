// An airport taxi at the departures kerb (city.md place.airport-lagos): a plain saloon in the
// city's taxi yellow with a band of black and white checks down each side and a white roof light,
// no company's name or livery (R-ASSET-010). Built along +x like the design's vehicles, then turned to
// face +z. The wheels are round, so they are their own part, shaded smooth (R-ASSET-005).
import { lowBox, setFootprint } from "@japacity/assets";
import { part } from "@japacity/assets/kit";
import { Group } from "three";

import { cbox, facePlusZ, profile, wheel } from "../lab";

export const TAXI = { length: 4.5, width: 1.74, height: 1.46 } as const;

export function buildTaxi(): Group {
  const g = new Group();
  const { width: w } = TAXI;
  const hw = w / 2;
  // The body as one side profile: bonnet, windscreen, roof, rear window, boot.
  profile(g, [[-2.25, 0.32], [2.25, 0.32], [2.27, 0.78], [1.25, 0.9], [0.55, 1.4], [-0.95, 1.4], [-1.65, 0.92], [-2.27, 0.86]], w, "danfoYellow");
  // The glass: windscreen and rear window on their slopes, the side windows split by the pillar.
  cbox(g, 0.03, 0.62, w - 0.2, 0.9, 1.15, 0, "glass", 0.62);
  cbox(g, 0.03, 0.58, w - 0.2, -1.3, 1.16, 0, "glass", -0.6);
  for (const s of [1, -1]) {
    cbox(g, 0.62, 0.36, 0.02, 0.15, 1.13, s * (hw + 0.005), "glass");
    cbox(g, 0.66, 0.36, 0.02, -0.65, 1.13, s * (hw + 0.005), "glass");
    // The band of checks below the windows, in two rows.
    for (let i = 0; i < 14; i++) {
      for (let row = 0; row < 2; row++) cbox(g, 0.28, 0.07, 0.02, -1.82 + i * 0.28, 0.82 - row * 0.07, s * (hw + 0.006), (i + row) % 2 === 0 ? "black" : "white");
    }
    // Door seams and handles.
    for (const x of [0.55, -0.3, -1.05]) cbox(g, 0.02, 0.5, 0.02, x, 0.62, s * (hw + 0.008), "black");
    cbox(g, 0.12, 0.03, 0.02, 0.35, 0.92, s * (hw + 0.01), "black");
    cbox(g, 0.12, 0.03, 0.02, -0.45, 0.92, s * (hw + 0.01), "black");
    cbox(g, 0.08, 0.06, 0.12, 0.62, 1.0, s * (hw + 0.06), "black");
  }
  // Bumpers, lamps, plates, and the roof light.
  cbox(g, 0.12, 0.16, w + 0.02, 2.28, 0.4, 0, "black");
  cbox(g, 0.12, 0.16, w + 0.02, -2.28, 0.4, 0, "black");
  for (const s of [1, -1]) {
    cbox(g, 0.04, 0.12, 0.3, 2.265, 0.7, s * 0.6, "cream");
    cbox(g, 0.04, 0.14, 0.24, -2.275, 0.72, s * 0.62, "red");
  }
  cbox(g, 0.02, 0.11, 0.4, 2.35, 0.4, 0, "white");
  cbox(g, 0.02, 0.11, 0.4, -2.35, 0.4, 0, "white");
  cbox(g, 0.5, 0.16, 0.24, -0.2, 1.48, 0, "white");
  // The wheels.
  const wheels = part(g, "wheels");
  wheels.userData.smooth = true;
  for (const x of [1.4, -1.4]) for (const s of [1, -1]) wheel(wheels, 0.32, 0.2, x, 0.32, s * (hw - 0.08));
  const root = facePlusZ(g, "veh_taxi");
  return setFootprint(root, [lowBox(root)]);
}
