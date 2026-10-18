// A luggage trolley at the departures kerb (city.md place.airport-lagos), loaded the way a family
// loads one for a long flight: two big cases, a chequered carrier bag of foodstuff tied shut, a
// cooler and a small case on top. The frame is the airport's grey tube; the wheels are small.
import { lowBox, type PaletteName, setFootprint } from "@japacity/assets";
import { beam, box, cylinder, quad, type Vec3 } from "@japacity/assets/kit";
import { Group, type Object3D } from "three";

import { facePlusZ } from "../../veh/centred";

export const TROLLEY = { width: 0.62, length: 1.05, deck: 0.22, handle: 1.05 } as const;

function suitcase(g: Object3D, w: number, h: number, d: number, x: number, y: number, z: number, colour: PaletteName, trim: PaletteName): void {
  box(g, w, h, d, x, y, z, colour);
  box(g, w + 0.01, 0.03, d + 0.01, x, y + h * 0.5, z, trim);
  box(g, 0.14, 0.03, 0.03, x, y + h, z, "black");
}

export function buildTrolley(): Group {
  const g = new Group();
  const { width: w, length: l, deck, handle } = TROLLEY;
  const hw = w / 2;
  // The frame: a deck of bars, two side rails rising to the handle at the back (-z).
  box(g, w, 0.03, l, 0, deck, 0, "hub");
  for (const s of [-1, 1]) {
    const foot: Vec3 = [s * hw, deck, -l / 2];
    const top: Vec3 = [s * hw, handle, -l / 2 - 0.08];
    beam(g, foot, top, 0.03, "hub");
    beam(g, [s * hw, deck + 0.02, l / 2], [s * hw, deck + 0.02, -l / 2], 0.03, "hub");
    beam(g, [s * hw, deck + 0.45, -l / 2 - 0.02], [s * hw, deck, -l / 2 + 0.35], 0.025, "hub");
  }
  beam(g, [-hw - 0.04, handle, -l / 2 - 0.08], [hw + 0.04, handle, -l / 2 - 0.08], 0.045, "black");
  box(g, w, 0.4, 0.02, 0, deck + 0.05, -l / 2, "hub");
  // Four small wheels on stubs under the corners.
  for (const s of [-1, 1]) {
    for (const z of [-l / 2 + 0.08, l / 2 - 0.08]) {
      box(g, 0.03, deck - 0.09, 0.03, s * (hw - 0.05), 0.09, z, "black");
      const wheel = new Group();
      wheel.position.set(s * (hw - 0.05), 0, z);
      wheel.rotation.z = Math.PI / 2;
      g.add(wheel);
      cylinder(wheel, 0.09, 0.05, 0.09, -0.025, 0, "tyre", 8);
    }
  }
  // The load: two big cases standing, the carrier bag on its side, a cooler, a small case on top.
  suitcase(g, 0.55, 0.72, 0.28, 0, deck + 0.03, -0.3, "indigo", "gold");
  suitcase(g, 0.5, 0.62, 0.26, 0, deck + 0.03, -0.02, "wine", "black");
  box(g, 0.6, 0.38, 0.36, 0, deck + 0.03, 0.3, "white");
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      if ((col + row) % 2 === 0) continue;
      quad(g, 0.15, 0.19, -0.225 + col * 0.15, deck + 0.03 + row * 0.19, 0.484, col % 2 === 0 ? "red" : "blue");
    }
  }
  box(g, 0.62, 0.04, 0.04, 0, deck + 0.24, 0.3, "black");
  box(g, 0.42, 0.3, 0.3, 0.02, deck + 0.75, -0.25, "basin");
  box(g, 0.44, 0.04, 0.32, 0.02, deck + 1.05, -0.25, "white");
  suitcase(g, 0.36, 0.22, 0.42, 0.04, deck + 0.65, 0.08, "black", "red");
  const root = facePlusZ(g, "prop_trolley", false);
  return setFootprint(root, [lowBox(root)]);
}
