// A bus shelter as a city abroad has them: a steel frame, a flat roof that overhangs the kerb, a
// back wall and one end of dark glass, a perch bench, a blank advert case at the other end and a
// stop flag on its own post at the kerb. No operator's mark, roundel or colours (R-ASSET-010):
// the flag plate is a plain red board, and the advert case is a block of colour.
import { setFootprint } from "@japacity/assets";
import { beam, box, cylinder, quad } from "@japacity/assets/kit";
import { Group } from "three";

export const SHELTER = { width: 4.0, depth: 1.5, roof: 2.55, glass: 1.95 } as const;

export function buildBusShelter(): Group {
  const g = new Group();
  g.name = "prop_bus-shelter";
  const { width: w, depth: d, roof, glass } = SHELTER;
  const back = -d / 2 + 0.1;
  // The frame: posts at the back corners and at the open end, a beam under the roof's front edge.
  for (const x of [-w / 2, 0, w / 2]) box(g, 0.08, roof, 0.08, x, 0, back, "charcoal");
  box(g, 0.08, roof, 0.08, w / 2, 0, back + 1.0, "charcoal");
  beam(g, [-w / 2, roof - 0.05, back], [w / 2, roof - 0.05, back], 0.08, "charcoal");
  // The roof: a thin slab with a deeper fascia along the kerb side.
  box(g, w + 0.3, 0.06, d + 0.25, 0, roof, 0.05, "charcoal");
  box(g, w + 0.3, 0.16, 0.06, 0, roof - 0.1, d / 2 + 0.15, "hub");
  // Dark glass: the back wall in two panes with a kick rail, and one end.
  for (const x of [-w / 4, w / 4]) box(g, w / 2 - 0.12, glass, 0.03, x, 0.3, back, "glass");
  box(g, w - 0.1, 0.06, 0.05, 0, 0.3, back + 0.01, "charcoal");
  box(g, 0.03, glass, 0.95, w / 2, 0.3, back + 0.52, "glass");
  // The advert case at the other end: a deep box with a lit face of plain colour each way.
  box(g, 0.18, 2.15, 1.2, -w / 2, 0.12, back + 0.62, "white");
  quad(g, 1.0, 1.7, -w / 2 - 0.095, 0.35, back + 0.62, "blue", -Math.PI / 2);
  quad(g, 1.0, 1.7, -w / 2 + 0.095, 0.35, back + 0.62, "danfoYellow", Math.PI / 2);
  // A perch bench along the back.
  box(g, 1.7, 0.05, 0.28, 0.6, 0.62, back + 0.2, "hub");
  for (const x of [-0.2, 1.4]) box(g, 0.05, 0.62, 0.05, x, 0, back + 0.2, "charcoal");
  // The stop flag at the kerb: a post, a plain red plate with a white band, and a timetable case.
  const flagX = w / 2 + 0.5;
  const flagZ = d / 2 + 0.2;
  cylinder(g, 0.045, 3.0, flagX, 0, flagZ, "charcoal", 6);
  box(g, 0.5, 0.36, 0.03, flagX, 2.55, flagZ, "red");
  for (const side of [-1, 1]) quad(g, 0.42, 0.1, flagX, 2.68, flagZ + side * 0.017, "white", side > 0 ? 0 : Math.PI);
  box(g, 0.3, 0.42, 0.05, flagX, 1.35, flagZ + 0.05, "white");
  // The kerb side of the shelter's own slab, so it stands on its pavement.
  box(g, w + 1.4, 0.04, d + 0.5, 0.4, 0, 0.05, "concrete");
  // The back wall, the glass end, the advert case and the stop flag's post; the bench is a seat and the inside is open.
  return setFootprint(g, [
    { x: 0, z: back, width: w + 0.1, depth: 0.12 },
    { x: w / 2, z: back + 0.52, width: 0.1, depth: 1.05 },
    { x: -w / 2, z: back + 0.62, width: 0.2, depth: 1.2 },
    { x: flagX, z: flagZ + 0.02, width: 0.32, depth: 0.12 },
  ]);
}
