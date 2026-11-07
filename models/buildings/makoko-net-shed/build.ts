// The net shed of Makoko (city.md place.makoko): a plank platform on thin poles over the lagoon, a rusty striped iron
// roof on the poles and no walls but one end of woven sacks, where nets are mended, gear is kept and people sit out of
// the sun. Pale nets hang folded over the back rail and from a roof beam, a plank bench runs along the sacks, clothes
// hang on a pole, an upturned crate stands where the nets are mended, and a heavy plank comes down from the deck's front to the walk. The deck faces +z; the poles stand in
// the water at y = 0, the deck at `NET_SHED.floor` over it.
import { type FootprintBox, type PaletteName, setFootprint } from "@japacity/model-kit";
import { beam, box, floorQuad, quad, seeded, solid, type Vec3 } from "@japacity/model-kit/kit";
import { Group } from "three";

/** The deck's width along x and depth along z, its height over the water, the eave over the deck, the plank's run. */
export const NET_SHED = { width: 6.0, depth: 4.4, floor: 0.8, eave: 2.35, ramp: 1.4 } as const;
/** Where the plank comes down from the deck's front edge, along x: at its left, by the bench. */
export const SHED_RAMP_X = -1.6;
/** The upturned crate the fisherman sits on to mend his net, its middle. */
export const SHED_CRATE = { x: 0.35, z: -0.5 } as const;
/** The bench along the sacks: its middle along z, its x, its length and its top. */
export const SHED_BENCH = { x: -2.45, z: -0.3, length: 2.6, top: 0.45 } as const;

const BOARDS: PaletteName[] = ["concrete", "concreteWorn", "wood", "khaki", "concreteWorn", "darkWood", "concrete"];

export function buildNetShed(walkTop: number): Group {
  const g = new Group();
  g.name = "building_makoko-net-shed";
  const random = seeded(4417);
  const { width, depth, floor, eave, ramp } = NET_SHED;
  const hw = width / 2;
  const hd = depth / 2;
  const footprint: FootprintBox[] = [];

  // The poles, three rows of four, each from the lagoon bed through the deck to the roof, leaning a little.
  const top = floor + eave;
  for (const z of [-hd + 0.1, 0, hd - 0.1]) {
    for (const x of [-hw + 0.1, -hw / 3, hw / 3, hw - 0.1]) {
      const lean = (random() - 0.5) * 0.06;
      const ridgeRise = z === 0 ? 0.45 : 0;
      beam(g, [x, 0, z], [x + lean, top + ridgeRise, z + lean * 0.4], 0.11, random() < 0.4 ? "black" : "darkWood");
      if (Math.abs(x) > hw - 0.5 || Math.abs(z) > hd - 0.5) footprint.push({ x, z, width: 0.18, depth: 0.18 });
    }
  }
  // The deck: bearers, a black skirt, boards along x a finger apart.
  for (const x of [-hw + 0.1, -hw / 3, hw / 3, hw - 0.1]) box(g, 0.14, 0.12, depth, x, floor - 0.18, 0, "darkWood");
  // The skirt stops a finger under the boards, so its top never shares their height.
  for (const z of [-hd, hd]) box(g, width + 0.1, 0.1, 0.08, 0, floor - 0.12, z, "black");
  for (const x of [-hw, hw]) box(g, 0.08, 0.1, depth, x, floor - 0.12, 0, "black");
  const board = 0.26;
  for (let z = -hd + board / 2; z < hd; z += board) {
    const shade = BOARDS[Math.floor(random() * BOARDS.length)] ?? "concrete";
    floorQuad(g, width + (random() - 0.5) * 0.12, board - 0.025, (random() - 0.5) * 0.05, floor + 0.002, z, shade);
  }

  // The roof: a low gable of rusty iron, its ridge along x over the middle row, striped by its corrugations.
  const over = 0.35;
  const ridge = top + 0.45;
  const sheet = (corners: Vec3[]) => solid(g, corners, [[0, 1, 2, 3], [3, 2, 1, 0]], "zincRust");
  sheet([[-hw - over, top - 0.05, -hd - over], [hw + over, top - 0.05, -hd - over], [hw + over, ridge, 0], [-hw - over, ridge, 0]]);
  sheet([[hw + over, top - 0.05, hd + over], [-hw - over, top - 0.05, hd + over], [-hw - over, ridge, 0], [hw + over, ridge, 0]]);
  const on = (x: number, share: number, side: 1 | -1): Vec3 => [x, top - 0.05 + share * (ridge - top + 0.05) + 0.012, side * (hd + over) * (1 - share)];
  let stripe = 0;
  for (let x = -hw - over + 0.2; x < hw + over; x += 0.42) {
    const colour: PaletteName = stripe % 4 === 1 ? "laterite" : stripe % 4 === 3 ? "zinc" : "darkWood";
    for (const side of [1, -1] as const) {
      const w = colour === "darkWood" ? 0.06 : 0.36;
      const strip = [on(x, 0, side), on(x + w, 0, side), on(x + w, 1, side), on(x, 1, side)];
      solid(g, strip, side === 1 ? [[0, 1, 2, 3]] : [[0, 3, 2, 1]], colour);
    }
    stripe += 1;
  }
  // The beams the roof sits on, along x at the eaves.
  for (const z of [-hd + 0.1, hd - 0.1]) beam(g, [-hw - 0.1, top - 0.08, z], [hw + 0.1, top - 0.08, z], 0.1, "darkWood");

  // One end of woven sacks, stitched and sagging, from the deck to the eave, both faces.
  const sacks: PaletteName[] = ["white", "cream", "khaki", "danfoYellow", "white", "cream", "basin", "white"];
  const rows = 3;
  const cols = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const colour = sacks[(r * cols + c + r) % sacks.length] ?? "white";
      const z = -hd + 0.25 + (c + 0.5) * ((depth - 0.5) / cols);
      const y = floor + 0.05 + r * 0.72;
      const w = (depth - 0.5) / cols - 0.03;
      quad(g, w, 0.7, -hw + 0.06, y, z, colour, Math.PI / 2);
      quad(g, w, 0.7, -hw + 0.04, y, z, colour, -Math.PI / 2);
    }
  }
  footprint.push({ x: -hw + 0.05, z: 0, width: 0.15, depth: depth - 0.3 });

  // The bench along the sacks, a plank on three blocks.
  const { x: bx, z: bz, length: bl, top: bt } = SHED_BENCH;
  box(g, 0.36, 0.05, bl, bx, floor + bt - 0.05, bz, "wood");
  for (const dz of [-bl / 2 + 0.2, 0, bl / 2 - 0.2]) box(g, 0.3, bt - 0.05, 0.14, bx, floor, bz + dz, "darkWood");
  // Nobody is kept off the bench or the crate: people sit on them.
  const { x: cx, z: cz } = SHED_CRATE;
  box(g, 0.42, 0.42, 0.36, cx, floor, cz, "red");
  for (const dx of [-0.12, 0.0, 0.12]) quad(g, 0.05, 0.3, cx + dx, floor + 0.06, cz + 0.181, "black");

  // The back rail, nets folded over it in long pale bundles with their floats, and a net hung from the ridge beam.
  const railZ = -hd + 0.12;
  beam(g, [-hw + 0.3, floor + 0.95, railZ], [hw - 0.1, floor + 0.95, railZ], 0.07, "darkWood");
  for (const x of [-1.5, 0.2, 1.9]) box(g, 0.06, 0.95, 0.06, x, floor, railZ, "darkWood");
  footprint.push({ x: 0.3, z: railZ, width: width - 0.4, depth: 0.2 });
  const nets: [number, number, PaletteName][] = [[-1.9, 1.1, "cream"], [-0.5, 1.3, "white"], [1.1, 0.9, "khaki"], [2.3, 0.8, "cream"]];
  for (const [x, w, colour] of nets) {
    box(g, w, 0.75, 0.12, x, floor + 0.32, railZ + 0.08, colour);
    box(g, w, 0.55, 0.1, x + 0.05, floor + 0.42, railZ - 0.08, colour);
    for (let i = 0; i < 3; i++) box(g, 0.07, 0.05, 0.07, x - w / 2 + 0.2 + i * (w / 3), floor + 1.0, railZ, i % 2 === 0 ? "orange" : "danfoYellow");
  }
  box(g, 0.08, 0.08, 0.08, 1.2, ridge - 0.12, 0, "darkWood");
  box(g, 0.5, 1.2, 0.14, 1.2, ridge - 1.32, 0, "white");
  box(g, 0.42, 0.9, 0.12, 1.25, ridge - 1.02, 0.08, "cream");

  // Clothes hung on the front pole and a cap on a nail.
  const [px, pz] = [hw / 3, hd - 0.1];
  quad(g, 0.45, 0.6, px + 0.08, floor + 1.25, pz + 0.07, "orange");
  quad(g, 0.45, 0.6, px + 0.08, floor + 1.25, pz + 0.05, "orange", Math.PI);
  quad(g, 0.35, 0.5, -hw / 3 - 0.06, floor + 1.4, pz + 0.07, "denim");
  quad(g, 0.35, 0.5, -hw / 3 - 0.06, floor + 1.4, pz + 0.05, "denim", Math.PI);

  // The heavy plank down from the deck's front edge to the walk.
  const from: Vec3 = [SHED_RAMP_X, floor - 0.03, hd - 0.15];
  const to: Vec3 = [SHED_RAMP_X, walkTop, hd + ramp];
  beam(g, [from[0] - 0.12, from[1], from[2]], [to[0] - 0.12, to[1], to[2]], 0.07, "darkWood");
  beam(g, [from[0] + 0.12, from[1], from[2]], [to[0] + 0.12, to[1], to[2]], 0.07, "wood");
  footprint.push({ x: SHED_RAMP_X, z: hd + (ramp - 0.2) / 2, width: 0.4, depth: ramp - 0.2 });
  return setFootprint(g, footprint);
}
