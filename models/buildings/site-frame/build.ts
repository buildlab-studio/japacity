// The towers' base at the site in Dubai (design page 11 section 3: the site across the creek): the concrete frame of a
// tower going up, its columns and slabs four floors high with block infill on the lowest, formwork and rebar on the
// top, the safety net hung on its edge. Only the base shows over the hoarding; the tower's floors above are out of
// the place's view. Plain concrete, no contractor's name or mark (assets:no-real-brands-on-assets). Wear where the rain of dust runs
// (assets:buildings-carry-wear-and-clutter).
import { setFootprint } from "@japacity/model-kit";
import { beam, box, onWall, quad, stain } from "@japacity/model-kit/kit";
import { Group } from "three";

export const SITE_FRAME = { width: 12.0, depth: 8.0, storey: 3.0, floors: 4 } as const;

export function buildSiteFrame(): Group {
  const g = new Group();
  g.name = "bld_site-frame";
  const { width: w, depth: d, storey, floors } = SITE_FRAME;
  const top = storey * floors;
  const xs = [-w / 2 + 0.25, -w / 6, w / 6, w / 2 - 0.25];
  const zs = [-d / 2 + 0.25, 0, d / 2 - 0.25];
  for (const x of xs) for (const z of zs) box(g, 0.5, top, 0.5, x, 0, z, "concrete");
  for (let floor = 1; floor <= floors; floor += 1) box(g, w + 0.2, 0.25, d + 0.2, 0, floor * storey - 0.25, 0, "concrete");
  // Block infill on the ground floor, most bays; one left open for the hoist.
  for (const [x0, x1] of [[xs[0] ?? 0, xs[1] ?? 0], [xs[2] ?? 0, xs[3] ?? 0]] as const) box(g, x1 - x0 - 0.5, storey - 0.25, 0.2, (x0 + x1) / 2, 0, d / 2 - 0.25, "wallCreamWorn");
  box(g, 0.2, storey - 0.25, d - 1, w / 2 - 0.25, 0, 0, "wallCreamWorn");
  // Formwork boxes on the top slab and rebar standing out of the columns, ready for the next floor.
  box(g, w / 2, 0.6, d / 2, -w / 4, top, -d / 4, "tan");
  for (const x of xs) for (const z of [zs[0] ?? 0, zs[2] ?? 0]) for (const dx of [-0.12, 0.12]) beam(g, [x + dx, top, z], [x + dx, top + 0.85, z], 0.04, "zincRust");
  // The green net hung along the top floor's front edge, the dust stains under the slab edges.
  const face = onWall(g, 0, 0, d / 2 + 0.11);
  quad(face, w * 0.6, 1.4, -w * 0.2, top - 1.6, 0, "green");
  for (let floor = 1; floor <= 2; floor += 1) stain(face, 0, floor * storey - 0.7, w, 0.4, "concreteWorn");
  // A hoist mast up the open bay at the side.
  for (const dz of [-0.4, 0.4]) box(g, 0.12, top + 0.6, 0.12, -w / 2 - 0.8, 0, d / 4 + dz, "danfoYellow");
  box(g, 1.2, 1.8, 1.0, -w / 2 - 0.8, 0.3, d / 4, "hub");
  return setFootprint(g, [
    { x: 0, z: 0, width: w, depth: d },
    { x: -w / 2 - 0.8, z: d / 4, width: 1.2, depth: 1.0 },
  ]);
}
