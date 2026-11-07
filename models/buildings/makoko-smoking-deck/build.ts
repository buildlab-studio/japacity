// The smoking deck of Makoko (city.md place.makoko): a wide plank deck at the walk's height where the women smoke and sell the
// catch, half open to the channel. A lean-to of rusty iron on poles shades its back, a striped tarp is stretched on poles over the
// right half of its front, its back is walled in planks and woven sacks, and washing hangs on a line along its side. The kilns, the baskets, the pot
// and the firewood stand on it as props of their own. The deck faces +z, its front edge meeting the walk's back edge; its posts
// stand in the water at y = 0.
import { type FootprintBox, type PaletteName, setFootprint } from "@japacity/model-kit";
import { beam, box, floorQuad, quad, seeded, solid, type Vec3 } from "@japacity/model-kit/kit";
import { Group } from "three";

import { WALKWAY } from "../../props/plank-walkway/build";

/** The deck's width along x and depth along z, its height (the walk's top), and the lean-to's height at its back and its front edge. */
/** Where along x the striped tarp starts: it shades the deck's right half. */
export const TARP_FROM = 0.2;

export const SMOKING_DECK = { width: 7.2, depth: 5.0, floor: WALKWAY.top + 0.005, back: 3.0, eave: 2.35, roofDepth: 2.8 } as const;

const BOARDS: PaletteName[] = ["concrete", "wood", "concreteWorn", "khaki", "darkWood", "wood", "concrete"];

export function buildSmokingDeck(): Group {
  const g = new Group();
  g.name = "building_makoko-smoking-deck";
  const random = seeded(5120);
  const { width, depth, floor, back, eave, roofDepth } = SMOKING_DECK;
  const hw = width / 2;
  const hd = depth / 2;
  const footprint: FootprintBox[] = [];

  // Short posts in the lagoon bed, bearers across, the boards along x with a finger's gap, a few darker where they were changed.
  // The bearers stop a finger under the boards, so their tops never share the boards' height.
  for (const x of [-hw + 0.1, -hw / 3, hw / 3, hw - 0.1]) for (const z of [-hd + 0.1, 0, hd - 0.1]) box(g, 0.1, floor - 0.08, 0.1, x, 0, z, "black");
  for (const z of [-hd + 0.1, 0, hd - 0.1]) box(g, width, 0.04, 0.1, 0, floor - 0.08, z, "darkWood");
  const board = 0.25;
  for (let z = -hd + board / 2; z < hd; z += board) {
    const shade = BOARDS[Math.floor(random() * BOARDS.length)] ?? "concrete";
    floorQuad(g, width + (random() - 0.5) * 0.1, board - 0.03, (random() - 0.5) * 0.04, floor, z, shade);
  }

  // The lean-to over the back: poles at its back and its front edge, the iron sheet falling to the front, its corrugations.
  const front = -hd + roofDepth;
  for (const x of [-hw + 0.1, 0, hw - 0.1]) {
    box(g, 0.1, back, 0.1, x, floor, -hd + 0.1, "darkWood");
    box(g, 0.1, eave, 0.1, x, floor, front, "darkWood");
    footprint.push({ x, z: front, width: 0.14, depth: 0.14 });
  }
  const over = 0.3;
  const top = (z: number): number => floor + back + ((z + hd) / roofDepth) * (eave - back);
  const roofAt = (x: number, z: number, lift = 0): Vec3 => [x, top(z) + 0.05 + lift, z];
  solid(g, [roofAt(-hw - over, -hd - over), roofAt(hw + over, -hd - over), roofAt(hw + over, front + over), roofAt(-hw - over, front + over)], [[3, 2, 1, 0], [0, 1, 2, 3]], "zincRust");
  for (let x = -hw - over + 0.2; x < hw + over; x += 0.45) {
    const colour: PaletteName = random() < 0.25 ? "laterite" : "darkWood";
    const w = colour === "darkWood" ? 0.05 : 0.32;
    solid(g, [roofAt(x, -hd - over, 0.012), roofAt(x + w, -hd - over, 0.012), roofAt(x + w, front + over, 0.012), roofAt(x, front + over, 0.012)], [[3, 2, 1, 0]], colour);
  }
  // A newer sheet over a hole, bright among the rust.
  solid(g, [roofAt(0.8, -hd + 0.4, 0.02), roofAt(1.9, -hd + 0.4, 0.02), roofAt(1.9, front - 0.3, 0.02), roofAt(0.8, front - 0.3, 0.02)], [[3, 2, 1, 0]], "zinc");

  // The striped tarp stretched over the front on two poles and tied back to the lean-to's edge, sagging between.
  const tarpFront = hd - 0.3;
  // Over the deck's right half only: the kilns at its left stand in the open, so their smoke rises free.
  for (const x of [TARP_FROM, hw - 0.6]) {
    box(g, 0.08, eave - 0.2, 0.08, x, floor, tarpFront, "darkWood");
    footprint.push({ x, z: tarpFront, width: 0.12, depth: 0.12 });
  }
  const stripes: PaletteName[] = ["blue", "white", "blue", "white", "blue"];
  const tx0 = TARP_FROM;
  const tw = (hw - 0.6 - TARP_FROM) / stripes.length;
  const sag = (z: number): number => floor + eave - 0.25 - 0.18 * Math.sin(((z - front) / (tarpFront - front)) * Math.PI);
  stripes.forEach((colour, i) => {
    const x0 = tx0 + i * tw;
    const x1 = x0 + tw;
    const mid = (front + tarpFront) / 2;
    const corners: Vec3[] = [
      [x0, floor + eave - 0.08, front],
      [x1, floor + eave - 0.08, front],
      [x1, sag(mid), mid],
      [x0, sag(mid), mid],
      [x0, floor + eave - 0.2, tarpFront],
      [x1, floor + eave - 0.2, tarpFront],
    ];
    solid(g, corners, [[0, 3, 2, 1], [3, 4, 5, 2], [1, 2, 3, 0], [2, 5, 4, 3]], colour);
  });

  // The back walled in planks below and woven sacks above, both faces, so the deck is open to the channel and at both ends.
  const sacks: PaletteName[] = ["white", "cream", "danfoYellow", "white", "khaki", "basin", "white", "cream", "danfoYellow"];
  const panel = 0.78;
  for (let i = 0; i * panel < width - 0.4; i++) {
    const x = -hw + 0.2 + (i + 0.5) * panel;
    const shade = BOARDS[i % BOARDS.length] ?? "concrete";
    for (const ry of [0, Math.PI]) {
      quad(g, panel - 0.04, 0.9, x, floor, -hd + 0.06, shade, ry);
      quad(g, panel - 0.04, 1.35, x, floor + 0.92, -hd + 0.06, sacks[i % sacks.length] ?? "white", ry);
    }
  }
  footprint.push({ x: 0, z: -hd + 0.06, width: width - 0.3, depth: 0.15 });

  // The washing line along the right side between the back pole and the tarp's pole, wrappers and a shirt on it.
  const lx = hw - 0.1;
  beam(g, [lx, floor + 2.0, -hd + 0.1], [lx, floor + 2.0, tarpFront], 0.02, "black");
  const wash: [number, PaletteName][] = [[-1.4, "orange"], [-0.6, "indigo"], [0.4, "wine"], [1.2, "gold"]];
  for (const [z, colour] of wash) {
    quad(g, 0.55, 0.7, lx, floor + 1.32, z, colour, Math.PI / 2);
    quad(g, 0.55, 0.7, lx, floor + 1.32, z, colour, -Math.PI / 2);
  }
  return setFootprint(g, footprint);
}
