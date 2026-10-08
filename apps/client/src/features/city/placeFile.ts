// A place's `place.json` under public/assets/places/<folder>/: which shared and own assets it shows
// (counted by the build check, R-ASSET-007) and, in `stage`, where the city puts them, where the
// crowd stands, the light, and what moves. A place with no file, or no `stage`, is drawn as open
// ground with its crowd, so every place can be entered before its models are built.
import type { PaletteName } from "@japacity/assets";

import type { Shown } from "./crowd";
import { personOf, type Role } from "./roster";

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
  /** A flag's band along its pinned edge, a quarter of its width; its `colours` are then stripes from the top down. */
  hoist?: PaletteName;
}

/**
 * A strip of the ground: road, pavement, kerb or gutter, centred at x and z and turned, `size` its
 * length along its own x and its width. `raise` lifts it into a block that high (a kerb); `dash`
 * paints every other `every` metres of its length in a second colour (a painted kerb, slabs over a drain).
 */
export interface Strip {
  at: Spot;
  size: [number, number];
  colour: PaletteName;
  raise?: number;
  dash?: { colour: PaletteName; every: number };
}

export interface Stage {
  /** Width and depth of the ground in metres, centred on the origin. */
  ground: { size: [number, number]; colour: PaletteName };
  /** Strips of road, pavement, kerb and gutter, drawn after the ground and over it in list order. */
  roads: Strip[];
  /** One sun and one sky light, set by the place (R-ASSET-006). */
  light: { sun: Vec3; sky: PaletteName; ground: PaletteName };
  /** Where the player's character stands on entering, and which way it faces. */
  start: Spot;
  /**
   * Every model and where each copy stands. `signs`, for a building whose file carries only its sign
   * anchors, gives each copy its own text keys in the anchors' order, so two copies never show the same boards.
   */
  models: { file: string; at: Spot[]; signs?: string[][]; bob?: boolean }[];
  /** Where people of the crowd stand, in order of use: the low mode's sample takes the first spots. At least the high mode's crowd. */
  people: Spot[];
  /** Spots, by index into `people`, kept for someone of a role when the sample has one: a hawker among the vehicles, a trader at the stall. */
  prefer?: Partial<Record<Role, number[]>>;
  motion: Motion[];
  /** People on the floor on a dance loop of their own, apart from the sampled crowd. */
  dancers?: Dancer[];
  /** How the place is dressed while an offer it stages is open. */
  dressings?: Dressing[];
}

/** The party room's two dance loops, written in code (R-CITY-037). */
export type DanceName = "twoStep" | "shuffle";

/** Someone a dressing puts on the floor: who, where, and which loop. */
export interface Dancer {
  file: string;
  at: Spot;
  dance: DanceName;
}

/**
 * A place dressed while an offer it stages is open (R-CITY-011): its models and motion join the
 * stage's, the files in `hide` leave it, its spots and crowd figures replace the place's own, and
 * its dancers take the floor.
 */
export interface Dressing {
  offer: string;
  models: Stage["models"];
  hide?: string[];
  people: Spot[];
  prefer?: Stage["prefer"];
  motion: Motion[];
  dancers: Dancer[];
  /** The guests' sample, in place of the entry's figures (R-CITY-014). */
  crowd: { low: number; high: number; target: number };
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

/** Every file a place needs before it is drawn: its models, its dancers and the people its sample may use. */
export function filesOf(file: PlaceFile, people: readonly string[]): string[] {
  const stage = stageOf(file);
  return [...new Set([...stage.models.map((model) => model.file), ...(stage.dancers ?? []).map((dancer) => dancer.file), ...people])];
}

/** A place file as the open offers dress it, with the crowd figures its dressing sets, or null for the entry's own. */
export function dressPlace(file: PlaceFile, open: readonly string[]): { file: PlaceFile; crowd: Dressing["crowd"] | null } {
  const plain = stageOf(file);
  const dressing = plain.dressings?.find((one) => open.includes(one.offer));
  if (dressing === undefined) return { file, crowd: null };
  const hidden = new Set(dressing.hide ?? []);
  const dressed: Stage = {
    ground: plain.ground,
    roads: plain.roads,
    light: plain.light,
    start: plain.start,
    models: [...plain.models.filter((model) => !hidden.has(model.file)), ...dressing.models],
    people: dressing.people,
    prefer: dressing.prefer ?? {},
    motion: [...plain.motion, ...dressing.motion],
    dancers: [...(plain.dancers ?? []), ...dressing.dancers],
  };
  return { file: { ...file, stage: dressed }, crowd: dressing.crowd };
}

/** A dancer's slot, after every slot a sample can have, so a tap on one is told from a tap on the crowd. */
export const DANCER_SLOT = 1000;

/** The dancer a tapped slot names, as a resident of the city (R-CITY-033), or undefined. */
export function dancerShown(stage: Stage, slot: number): Shown | undefined {
  const dancer = stage.dancers?.[slot - DANCER_SLOT];
  const person = dancer === undefined ? null : personOf(dancer.file);
  return person === null ? undefined : { slot, person, kind: "resident", tag: null };
}
