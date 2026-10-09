// Where fish is smoked in Makoko (city.md place.makoko): a plank platform over the water at the
// walkway's height, a long kiln of mud brick with the fire's mouth at the front, wire trays of fish
// laid over it two high, a line of fish hung to dry, a basin of the day's catch, a low stool, and the
// seller's board on a post at the corner. The smoke is the place's motion over the trays.
import { type PaletteName, setFootprint, type SignStyle } from "@japacity/assets";
import { beam, box, onWall, seeded, signboard } from "@japacity/assets/kit";
import { Group } from "three";

import { lump } from "../../veh/lab";
import { WALKWAY } from "../plank-walkway/build";

/** The platform's width and depth, the kiln's top and where its smoke rises, in the piece's frame. */
export const RACKS = { width: 3.4, depth: 2.6, kilnTop: 0.72, smoke: [-0.2, 1.15, -0.55] as [number, number, number] } as const;

const FISH: PaletteName[] = ["darkWood", "tan", "wood", "darkWood"];

/** A tray of smoked fish: a wire frame and the fish laid in two rows across it, each a little askew. */
function tray(g: Group, random: () => number, y: number, z: number, width: number, depth: number): void {
  box(g, width, 0.03, depth, -0.2, y, z, "charcoal");
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const x = -0.2 - width / 2 + 0.3 + i * ((width - 0.6) / 3);
      box(g, 0.13, 0.06, 0.34, x, y + 0.03, z - depth / 4 + row * (depth / 2), FISH[Math.floor(random() * FISH.length)] ?? "darkWood", (random() - 0.5) * 0.5);
    }
  }
}

export function buildFishRacks(board: string, style: SignStyle): Group {
  const root = new Group();
  root.name = "prop_fish-racks";
  const random = seeded(1504);
  const { width, depth, kilnTop } = RACKS;
  const top = WALKWAY.top;
  // The platform: boards across two bearers on posts, at the walkway's height.
  for (const x of [-width / 2 + 0.15, width / 2 - 0.15]) for (const z of [-depth / 2 + 0.15, depth / 2 - 0.15]) box(root, 0.1, top - 0.08, 0.1, x, 0, z, "black");
  for (const z of [-depth / 2 + 0.15, depth / 2 - 0.15]) box(root, width, 0.05, 0.1, 0, top - 0.085, z, "darkWood");
  const boards = 7;
  for (let i = 0; i < boards; i++) {
    const x = -width / 2 + (i + 0.5) * (width / boards);
    box(root, width / boards - 0.02, 0.035, depth, x, top - 0.035, 0, i % 3 === 1 ? "darkWood" : i % 2 === 0 ? "wood" : "tan");
  }
  // The kiln: a long box of mud brick at the back, the fire's mouth black at the front with the embers in it.
  const kilnZ = -0.55;
  box(root, 1.9, kilnTop - top, 0.95, -0.2, top, kilnZ, "laterite");
  box(root, 1.95, 0.05, 1.0, -0.2, kilnTop - 0.05, kilnZ, "wallPeachWorn");
  box(root, 0.7, 0.28, 0.02, -0.2, top + 0.06, kilnZ + 0.48, "black");
  box(root, 0.5, 0.08, 0.02, -0.2, top + 0.07, kilnZ + 0.49, "orange");
  for (const x of [-0.5, 0.1]) beam(root, [x, top + 0.08, kilnZ + 0.9], [x + 0.1, top + 0.12, kilnZ + 0.45], 0.07, "darkWood");
  // Two trays of fish over the fire, the upper on four short posts.
  tray(root, random, kilnTop, kilnZ, 1.85, 0.9);
  for (const x of [-1.05, 0.65]) for (const z of [kilnZ - 0.4, kilnZ + 0.4]) box(root, 0.04, 0.28, 0.04, x, kilnTop, z, "black");
  tray(root, random, kilnTop + 0.28, kilnZ, 1.85, 0.9);
  // A line of fish hung to dry between two poles at the side.
  const lineX = width / 2 - 0.35;
  for (const z of [-depth / 2 + 0.3, 0.45]) box(root, 0.06, 1.7, 0.06, lineX, top, z, "darkWood");
  beam(root, [lineX, top + 1.62, -depth / 2 + 0.3], [lineX, top + 1.62, 0.45], 0.03, "charcoal");
  for (let i = 0; i < 4; i++) box(root, 0.05, 0.36, 0.12, lineX, top + 1.22, -depth / 2 + 0.5 + i * 0.36, i % 2 === 0 ? "darkWood" : "tan");
  // The day's catch in a basin, and the stool whoever minds the fire sits on.
  box(root, 0.55, 0.18, 0.55, 0.95, top, 0.75, "basin");
  for (let i = 0; i < 3; i++) lump(root, 0.08, 0.85 + (i % 2) * 0.2, top + 0.2, 0.65 + i * 0.1, "hub", [0.7, 0.4, 1.8]);
  box(root, 0.32, 0.3, 0.32, -0.7, top, 0.55, "wood");
  // The seller's board on a post at the front corner, facing the walk.
  const postX = -width / 2 + 0.25;
  const postZ = depth / 2 - 0.2;
  box(root, 0.08, 2.1, 0.08, postX, top, postZ, "darkWood");
  signboard(root, onWall(root, postX + 0.6, 0, postZ + 0.05), board, style, 0, top + 1.55, 1.5, 0.5);
  return setFootprint(root, [
    { x: -0.2, z: kilnZ, width: 1.95, depth: 1.0 },
    { x: lineX, z: (-depth / 2 + 0.3 + 0.45) / 2, width: 0.3, depth: 1.25 },
    { x: 0.95, z: 0.75, width: 0.6, depth: 0.6 },
  ]);
}
