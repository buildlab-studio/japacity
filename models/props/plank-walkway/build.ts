// A length of plank walkway over the water in Makoko (city.md place.makoko): boards laid across two
// stringers on short posts driven into the lagoon bed, each board a little different, a few dark and
// one missing. Its top stands just over the water's highest ripple, so people walk on it and the
// lagoon laps under it. Copies laid end to end make the main walk; a single copy turned makes a spur
// to a house. Nobody is blocked by it: its footprint is none.
import { type PaletteName, setFootprint } from "@japacity/model-kit";
import { box, seeded } from "@japacity/model-kit/kit";
import { Group } from "three";

/** The walkway's length along z, its width, and the height of its top over the ground. */
export const WALKWAY = { length: 4.0, width: 1.4, top: 0.11 } as const;

const BOARDS: PaletteName[] = ["wood", "darkWood", "tan", "wood", "khaki", "darkWood"];

export function buildPlankWalkway(): Group {
  const g = new Group();
  g.name = "prop_plank-walkway";
  const random = seeded(2026);
  const { length, width, top } = WALKWAY;
  const board = 0.22;
  const thick = 0.035;
  // Posts at each end and the middle, both sides, and the two stringers along them.
  for (const z of [-length / 2 + 0.1, 0, length / 2 - 0.1]) for (const x of [-width / 2 + 0.12, width / 2 - 0.12]) box(g, 0.09, top - thick - 0.04, 0.09, x, 0, z, "black");
  for (const x of [-width / 2 + 0.12, width / 2 - 0.12]) box(g, 0.08, 0.04, length, x, top - thick - 0.04, 0, "darkWood");
  // The boards across, a finger's gap between them, one left out where it broke.
  const count = Math.floor(length / (board + 0.02));
  const missing = 1 + Math.floor(random() * (count - 2));
  for (let i = 0; i < count; i++) {
    if (i === missing) continue;
    const z = -length / 2 + (i + 0.5) * (length / count);
    const long = width + (random() - 0.5) * 0.16;
    const shade = BOARDS[Math.floor(random() * BOARDS.length)] ?? "wood";
    box(g, long, thick, board - 0.01 + random() * 0.02, (random() - 0.5) * 0.06, top - thick, z, shade, (random() - 0.5) * 0.05);
  }
  return setFootprint(g, "none");
}
