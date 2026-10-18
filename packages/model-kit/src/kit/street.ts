// A street of ordinary buildings from one layout seed (assets:neighbours-never-identical): the same seed lays the same
// street every time, and no two neighbours share footprint, storeys, roof and wall colour together.
import type { PaletteName } from "../palette";
import type { BuildingSpec } from "../types";
import { pick, seeded } from "./shapes";

const WIDTHS = [6.4, 7.2, 8.0, 9.6, 12.8] as const;
const DEPTHS = [6.0, 7.5, 9.0] as const;
const WALLS: PaletteName[] = ["wallCream", "wallPeach", "wallMint", "wallSky", "white"];
const ROOFS: BuildingSpec["roof"][] = ["hip", "gable", "flat"];

/** True when two buildings would read as one copied twice. */
export function sameLook(a: BuildingSpec, b: BuildingSpec): boolean {
  return a.footprint[0] === b.footprint[0] && a.footprint[1] === b.footprint[1] && a.storeys === b.storeys && a.roof === b.roof && a.wall === b.wall;
}

export function layoutStreet(seed: number, count: number): BuildingSpec[] {
  const random = seeded(seed);
  const street: BuildingSpec[] = [];
  for (let i = 0; i < count; i++) {
    const draw = (): BuildingSpec => {
      const storeys = pick(random, [1, 1, 2, 2, 3, 4] as const);
      return {
        footprint: [pick(random, WIDTHS), pick(random, DEPTHS)],
        storeys,
        roof: storeys >= 3 ? "flat" : pick(random, ROOFS),
        wall: pick(random, WALLS),
        wear: pick(random, [0, 1, 2, 3] as const),
        balconies: storeys > 1 ? Math.floor(random() * storeys) : 0,
        stairs: storeys > 1 ? pick(random, ["none", "side", "front"] as const) : "none",
        gate: random() < 0.5,
        clutterSeed: Math.floor(random() * 1_000_000),
        signs: [],
      };
    };
    let spec = draw();
    const before = street[i - 1];
    while (before !== undefined && sameLook(spec, before)) spec = draw();
    street.push(spec);
  }
  return street;
}
