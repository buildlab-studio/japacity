// A place's `place.json` under public/assets/places/<folder>/: which shared and own assets it shows
// (counted by the build check, R-ASSET-007) and, in `stage`, where the city puts them, where the
// crowd stands, the light, and what moves. A place with no file, or no `stage`, is drawn as open
// ground with its crowd, so every place can be entered before its models are built.
import type { PaletteName } from "@japacity/assets";

/** x, z and the turn about +Y in radians. Models face +Z (R-ASSET-003). */
export type Spot = [number, number, number];
export type Vec3 = [number, number, number];

export type MotionKind = "flag" | "hang" | "frond" | "water" | "smoke" | "leaves" | "bunting";

/**
 * One moving thing. Sheets (`flag` pinned on the left edge, `hang` pinned along the top, `frond`
 * pinned at the stalk) are a `size` of width and height at `at`, turned by `ry`; `bunting` runs
 * `count` pennants from `at` to `to`; `water` is a `size` of width and depth; `smoke` rises from
 * `at`; `leaves` tumble across `size` around `at`.
 */
export interface Motion {
  kind: MotionKind;
  at: Vec3;
  to?: Vec3;
  ry?: number;
  size?: [number, number];
  count?: number;
  colours: PaletteName[];
}

export interface Stage {
  /** Width and depth of the ground in metres, centred on the origin. */
  ground: { size: [number, number]; colour: PaletteName };
  /** Strips of road: centre x and z, width, depth, turn. */
  roads: { at: Spot; size: [number, number]; colour: PaletteName }[];
  /** One sun and one sky light, set by the place (R-ASSET-006). */
  light: { sun: Vec3; sky: PaletteName; ground: PaletteName };
  /** Where the player's character stands on entering, and which way it faces. */
  start: Spot;
  /** Every model and where each copy stands. */
  models: { file: string; at: Spot[] }[];
  /** Where people of the crowd stand, in slot order. At least the high mode's crowd. */
  people: Spot[];
  motion: Motion[];
}

export interface PlaceFile {
  place: string;
  scope: "exterior" | "interior";
  hub: boolean;
  instances: { file: string; count: number }[];
  people: { low: number; high: number; sample: string[] };
  stage?: Stage;
}

/** Open ground, for a place whose models are not built yet. */
export function openGround(place: string): PlaceFile {
  return { place, scope: "exterior", hub: false, instances: [], people: { low: 0, high: 0, sample: [] }, stage: OPEN_STAGE };
}

const RING = 16;

/** A ring of spots around the start, so a crowd has somewhere to stand on open ground. */
function ringSpots(): Spot[] {
  return Array.from({ length: RING }, (_, slot) => {
    const angle = (slot * Math.PI * 2) / RING;
    const radius = 4 + (slot % 3) * 2.5;
    return [Math.sin(angle) * radius, Math.cos(angle) * radius - 4, angle + Math.PI];
  });
}

export const OPEN_STAGE: Stage = {
  ground: { size: [80, 80], colour: "laterite" },
  roads: [{ at: [0, 6, 0], size: [80, 7], colour: "asphalt" }],
  light: { sun: [8, 14, 6], sky: "sky", ground: "laterite" },
  start: [0, 8, Math.PI],
  models: [],
  people: ringSpots(),
  motion: [],
};

/** The stage of a place file, or open ground when it has none. */
export function stageOf(file: PlaceFile): Stage {
  return file.stage ?? OPEN_STAGE;
}

/** Every file a place needs before it is drawn: its models and the people its sample may use. */
export function filesOf(file: PlaceFile, people: readonly string[]): string[] {
  return [...new Set([...stageOf(file).models.map((model) => model.file), ...people])];
}
