// The tailor's corner (prologue.md R-PROLOGUE-016): the room's builder draws the nook's two walls, and the shelf, the
// bolts, the rail with its hangers and the mirror stand against the back wall, all in the one vertex-coloured
// material, so the kit is one draw call. The bolts' bodies are painted their prints' grounds; the prints themselves
// are drawn by the door at load, by the same pattern code the figure wears (R-ASSET-013).
import { type FootprintBox, setFootprint } from "@japacity/assets";
import { beam, box, quad } from "@japacity/assets/kit";
import type { Group } from "three";

import { buildRoom } from "../room/build";
import { boltsOf, TAILOR, type TailorSpec } from "./tailor";

export function buildTailorCorner(spec: TailorSpec = TAILOR): Group {
  const g = buildRoom(spec.room);
  g.name = spec.name;
  const back = -spec.room.size[1] / 2;

  // The shelf: two sides, a back board and the boards across, its foot a little off the floor.
  const { shelf } = spec;
  const sz = back + shelf.depth / 2;
  for (const side of [-1, 1]) box(g, 0.04, shelf.high, shelf.depth, shelf.x + side * (shelf.width / 2 - 0.02), 0, sz, shelf.colour);
  box(g, shelf.width, shelf.high, 0.02, shelf.x, 0, back + 0.01, "darkWood");
  for (const y of shelf.boards) box(g, shelf.width - 0.08, 0.03, shelf.depth - 0.02, shelf.x, y, sz + 0.01, shelf.colour);
  box(g, shelf.width, 0.04, shelf.depth, shelf.x, shelf.high, sz, shelf.colour);
  // A pile of plain folded cloth on the bottom board, under the three bolts.
  box(g, spec.bolt.width * 0.8, 0.18, spec.bolt.deep, shelf.x, (shelf.boards[0] ?? 0) + 0.03, sz + 0.02, "cream");

  // The bolts, lying flat, their folded edge to the front.
  for (const bolt of boltsOf(spec)) box(g, spec.bolt.width, spec.bolt.high, spec.bolt.deep, bolt.x, bolt.y, bolt.z, bolt.ground);

  // The rail: two stands on flat feet, the bar across, and the two hangers with a garment on each.
  const { rail } = spec;
  const rz = back + rail.off;
  for (const side of [-1, 1]) {
    const x = rail.x + (side * rail.width) / 2;
    beam(g, [x, 0, rz], [x, rail.high, rz], 0.035, rail.colour);
    box(g, 0.06, 0.03, 0.5, x, 0, rz, rail.colour);
  }
  beam(g, [rail.x - rail.width / 2, rail.high, rz], [rail.x + rail.width / 2, rail.high, rz], 0.03, rail.colour);
  for (const hanger of spec.hangers) {
    const x = rail.x + hanger.at;
    // The hook over the bar and the hanger's shoulders.
    beam(g, [x, rail.high - 0.1, rz], [x, rail.high + 0.02, rz], 0.012, "charcoal");
    beam(g, [x - 0.2, rail.high - 0.16, rz], [x, rail.high - 0.1, rz], 0.015, "darkWood");
    beam(g, [x + 0.2, rail.high - 0.16, rz], [x, rail.high - 0.1, rz], 0.015, "darkWood");
    // A long kaftan: the body, its sleeves out at the shoulders and a dark band at the neck.
    box(g, 0.42, 1.0, 0.1, x, rail.high - 1.17, rz, hanger.colour);
    box(g, 0.13, 0.42, 0.09, x - 0.27, rail.high - 0.6, rz, hanger.colour);
    box(g, 0.13, 0.42, 0.09, x + 0.27, rail.high - 0.6, rz, hanger.colour);
    quad(g, 0.14, 0.06, x, rail.high - 0.25, rz + 0.051, "charcoal");
  }

  // The mirror on the back wall: the frame, and the light glass over it.
  const { mirror } = spec;
  quad(g, mirror.width + 0.08, mirror.high + 0.08, mirror.x, mirror.bottom - 0.04, back + 0.012, mirror.frame);
  quad(g, mirror.width, mirror.high, mirror.x, mirror.bottom, back + 0.02, mirror.glass);

  // The walls' boxes as the room set them, and the shelf and the rail, which nobody walks through.
  const walls = g.userData.footprint as FootprintBox[];
  return setFootprint(g, [
    ...walls,
    { x: shelf.x, z: sz, width: shelf.width, depth: shelf.depth },
    { x: rail.x, z: rz, width: rail.width + 0.1, depth: 0.5 },
  ]);
}
