// A place's `place.json` under public/assets/places/<folder>/: which shared and own assets it shows
// (counted by the build check, R-ASSET-007) and, in `stage`, where the city puts them, where the
// crowd stands, the light, and what moves. A place with no file, or no `stage`, is drawn as open
// ground with its crowd, so every place can be entered before its models are built.
import type { PaletteName, WalkablePolygon } from "@japacity/assets";
import type { PoseName } from "@japacity/assets-src/people/poses";
import type { Id, PlaceEntry } from "@japacity/sim";

import type { Shot, Thing } from "../../shared/world/contract";
import type { Shown } from "./crowd";
import { personOf, type Role } from "./roster";

/** x, z and the turn about +Y in radians. Models face +Z (R-ASSET-003). */
export type Spot = [number, number, number];
export type Vec3 = [number, number, number];

export type MotionKind = "flag" | "hang" | "frond" | "water" | "smoke" | "leaves" | "bunting" | "drops" | "flicker" | "glow";

/**
 * One moving thing. Sheets (`flag` pinned on the left edge, `hang` pinned along the top, `frond`
 * pinned at the stalk) are a `size` of width and height at `at`, turned by `ry`; `bunting` runs
 * `count` pennants from `at` to `to`; `water` is a `size` of width and depth; `smoke` rises from
 * `at`; `leaves` tumble across `size` around `at`; `drops` fall `count` drops off a rim of `size` (width and depth) at
 * `at` to the floor; `flicker` is a screen of `size` whose light flickers, its bottom edge at `at`, turned by `ry`;
 * `glow` is a warm point of light at `at`, its halo `size[0]` across.
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

/**
 * What the person at one spot does instead of idling where they stand: a pose of their own (the
 * conductor calling at the danfo's door), kept for a man or a woman of the sample, or a walk from
 * the spot to `to` and back on the shared clock (someone crossing at the stop).
 */
export interface Act {
  /** Index into `people`. */
  spot: number;
  /** Taken only by someone whose own pose is a plain stand; a hawker keeps her tray, a trader his sale. */
  pose?: PoseName;
  sex?: "f" | "m";
  /**
   * Someone who works the place or speaks for it (the officer, the teller, the invigilator, the family at home): a part
   * of the scene a resident keeps (city.md R-CITY-032). A seat left unmarked is a visitor's, and players take it first.
   */
  staff?: true;
  /** x and z in metres. */
  to?: [number, number];
}

export interface Stage {
  /** Width and depth of the ground in metres, centred on the origin. */
  ground: { size: [number, number]; colour: PaletteName };
  /** Strips of road, pavement, kerb and gutter, drawn after the ground and over it in list order. */
  roads: Strip[];
  /**
   * One sun and one sky light, set by the place (R-ASSET-006) and turned and tinted by the world's clock (R-CLOCK-033);
   * `lamps` are the warm points that glow as the light goes: the bulb, the lantern, the street's few lights.
   */
  light: { sun: Vec3; sky: PaletteName; ground: PaletteName; lamps?: Lamp[]; room?: boolean };
  /** Where the player's character stands on entering, and which way it faces. */
  start: Spot;
  /** The ground people may walk on, as polygons of [x, z] in metres (assets.md R-ASSET-030); the whole ground when absent. */
  walkable?: WalkablePolygon[];
  /**
   * Every model and where each copy stands. `signs`, for a building whose file carries only its sign
   * anchors, gives each copy its own text keys in the anchors' order, so two copies never show the same boards.
   * `bob` rides the copies on the water; `glide`, in metres, also sends each along its own length and
   * back on the shared clock (a canoe paddled along the channel, R-CITY-027).
   */
  models: { file: string; at: Spot[]; signs?: string[][]; bob?: boolean; glide?: number; owned?: string }[];
  /** Where people of the crowd stand, in order of use: the low mode's sample takes the first spots. At least the high mode's crowd. */
  people: Spot[];
  /** Spots, by index into `people`, kept for someone of a role when the sample has one: a hawker among the vehicles, a trader at the stall. */
  prefer?: Partial<Record<Role, number[]>>;
  acts?: Act[];
  motion: Motion[];
  /** People on the floor on a dance loop of their own, apart from the sampled crowd. */
  dancers?: Dancer[];
  /**
   * People who stand still at a thing of their own, apart from the sampled crowd: a computer partner met in this place
   * (world.md R-WORLD-020). The city keeps only those standing now (`features/city/meetings.ts`).
   */
  standing?: Stander[];
  /** How the place is dressed while an offer it stages is open. */
  dressings?: Dressing[];
  /** What a room shows of a choice the month's plan holds (world.md R-WORLD-029): the pot steaming, the drum filled. */
  shows?: Show[];
  /** The place's camera (world.md R-WORLD-009); a default from the start when absent. */
  shot?: Shot;
  /** The things the player can tap and what each does (world.md R-WORLD-005). */
  things?: Thing[];
  /** The place a door here opens into, as a place id (world.md R-WORLD-013): a room is just another place. */
  inside?: string;
  /** A home's car spot, in its yard or by its gate: the car stands there while the life has one, else it is empty. */
  car?: Spot;
  /** A wide home's rooms: a tap on one or a pinch eases the camera in on it from the whole house. */
  rooms?: Room[];
  /** A home's set spots for the market's things: where each stands once owned, until the player moves it. */
  owned?: OwnedSpot[];
}

/**
 * A thing of the market as a home stands it once owned: the thing's id in content, its model and its
 * set spot, a model whose copies it takes the place of (the new mattress over the old bed), and the acts it carries
 * when tapped (the TV's evening, the laptop's portfolio, the gas cooker's pot).
 */
export interface OwnedSpot {
  thing: string;
  file: string;
  at: Spot;
  hides?: string;
  acts?: Thing["acts"];
}

/**
 * One room of a wide home (world.md R-WORLD-029): the floor it covers, as the corners
 * x0, z0, x1, z1 in metres, and the view eased in on it: where it looks, how many metres across it shows and how steeply
 * it looks down, in degrees, at the rooms' distance.
 */
export interface Room {
  id: string;
  floor: [number, number, number, number];
  centre: Vec3;
  width: number;
  pitch: number;
}

/** A warm point of light the place shows as the day goes (R-CLOCK-033): where, how wide its halo, and whether a bulb hangs there. */
export interface Lamp {
  at: Vec3;
  /** The halo's width in metres. */
  size: number;
  /** A bulb seen hanging there; a lantern or a window shows only its glow. */
  bulb?: boolean;
  /** A real light there as the lamps come on, its strength at full night and how far it reaches in metres: the rooms' light. */
  light?: { strength: number; reach: number };
}

/**
 * Someone standing still at a thing: the thing's id in `things`, the person model from the place's kit, and where they
 * stand. `person`, when two people share the thing, names whose model it is.
 */
export interface Stander {
  thing: string;
  person?: string;
  file: string;
  at: Spot;
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
 * A place dressed while an offer it stages is open (R-CITY-011), or for the person whose room it is (world.md
 * R-WORLD-020): its models and motion join the stage's, the files in `hide` leave it, its spots and crowd figures replace the
 * place's own (a person's room shows no crowd, only the partner), its dancers take the floor and
 * who it stands at a thing joins those the stage stands. A dressing names an offer or a person, never both.
 */
export interface Dressing {
  offer?: string;
  /** The person whose room the place is, read when it opens for a bond with them: their room dressed for them. */
  person?: Id<"person">;
  models: Stage["models"];
  hide?: string[];
  people: Spot[];
  prefer?: Stage["prefer"];
  motion: Motion[];
  dancers: Dancer[];
  /** Who stands still in the dressed place: the partner in their own room, at a thing of their own. */
  standing?: Stander[];
  /** The guests' sample, in place of the entry's figures (R-CITY-014); none in a person's room. */
  crowd: { low: number; high: number; target: number };
}

/**
 * A choice made this month, seen on its thing (world.md R-WORLD-029): while the month's plan holds the
 * activity, its models and motion join the stage's. Nothing is hidden and no one moves. A show with `seconds` is the
 * answer of an act done at once instead (R-WORLD-005): its motion plays that long where the act was done, each time the
 * act lands, and goes.
 */
export interface Show {
  activity: string;
  models: Stage["models"];
  motion: Motion[];
  seconds?: number;
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

/**
 * Where a place's stage file is read (R-CITY-018; world.md R-WORLD-039): a country's entry abroad
 * on a scene London keeps (the superstore, the hypermarket and the discount supermarket on the big shop, Calgary's
 * warehouse, care home and office, the church hall and Castel Volturno's church) reads its own file, named for its id
 * beside the shared models (`places/<id's slug>/place.json`), where one is shipped, so its acts, its looks and its
 * colleague's lines are its country's; every other place reads its `assets` folder's file.
 */
export function stageFilePath(place: Pick<PlaceEntry, "id" | "assets" | "where">, shipped: (path: string) => boolean): string {
  const slug = place.id.slice("place.".length);
  const own = `places/${slug}/place.json`;
  return place.where === "abroad" && slug !== place.assets && shipped(own) ? own : `places/${place.assets}/place.json`;
}

/** The stage of a place file, or open ground when it has none. */
export function stageOf(file: PlaceFile): Stage {
  return file.stage ?? OPEN_STAGE;
}

/** Every file a place needs before it is drawn: its models, its dancers, who stands at a thing, and the people its sample may use. */
export function filesOf(file: PlaceFile, people: readonly string[]): string[] {
  const stage = stageOf(file);
  return [...new Set([...stage.models.map((model) => model.file), ...(stage.dancers ?? []).map((dancer) => dancer.file), ...(stage.standing ?? []).map((stander) => stander.file), ...people])];
}

/**
 * A place file as the open offers dress it, or else as the person whose room it is dresses it (R-WORLD-020), with the
 * crowd figures its dressing sets, or null for the entry's own. No dressing for either: the plain place.
 */
export function dressPlace(file: PlaceFile, open: readonly string[], person: Id<"person"> | null = null): { file: PlaceFile; crowd: Dressing["crowd"] | null } {
  const plain = stageOf(file);
  const dressing = plain.dressings?.find((one) => one.offer !== undefined && open.includes(one.offer)) ?? (person === null ? undefined : plain.dressings?.find((one) => one.person === person));
  if (dressing === undefined) return { file, crowd: null };
  const standing = [...(plain.standing ?? []), ...(dressing.standing ?? [])];
  const hidden = new Set(dressing.hide ?? []);
  const dressed: Stage = {
    ground: plain.ground,
    roads: plain.roads,
    light: plain.light,
    start: plain.start,
    ...(plain.walkable === undefined ? {} : { walkable: plain.walkable }),
    models: [...plain.models.filter((model) => !hidden.has(model.file)), ...dressing.models],
    people: dressing.people,
    prefer: dressing.prefer ?? {},
    motion: [...plain.motion, ...dressing.motion],
    dancers: [...(plain.dancers ?? []), ...dressing.dancers],
    ...(standing.length === 0 ? {} : { standing }),
    ...(plain.shot === undefined ? {} : { shot: plain.shot }),
    ...(plain.things === undefined ? {} : { things: plain.things }),
    ...(plain.inside === undefined ? {} : { inside: plain.inside }),
    ...(plain.car === undefined ? {} : { car: plain.car }),
    ...(plain.rooms === undefined ? {} : { rooms: plain.rooms }),
    ...(plain.owned === undefined ? {} : { owned: plain.owned }),
  };
  return { file: { ...file, stage: dressed }, crowd: dressing.crowd };
}

/** The car a home shows at its car spot. */
export const CAR_FILE = "shared/veh/veh_car.glb";

/**
 * A home as the life's car leaves it: while the life has a car it stands at the home's car spot, the
 * parents' yard or your own spot by the gate; with none the spot is empty. The same file when nothing changes. Parked
 * before the place is dressed, so a dressing that clears the yard (the send-off) takes the car out with it.
 */
export function parkCar(file: PlaceFile, owns: boolean): PlaceFile {
  const stage = stageOf(file);
  if (!owns || stage.car === undefined) return file;
  return { ...file, stage: { ...stage, models: [...stage.models, { file: CAR_FILE, at: [stage.car] }] } };
}

/**
 * The place as the month's plan shows it (R-WORLD-029): the models and motion of every show whose
 * activity is planned join the stage. The same file when the plan shows nothing here, so the scene
 * is rebuilt only when what it shows changes.
 */
export function showPlanned(file: PlaceFile, planned: readonly string[]): PlaceFile {
  const stage = stageOf(file);
  const shown = (stage.shows ?? []).filter((show) => show.seconds === undefined && planned.includes(show.activity));
  if (shown.length === 0) return file;
  return {
    ...file,
    stage: { ...stage, models: [...stage.models, ...shown.flatMap((show) => show.models)], motion: [...stage.motion, ...shown.flatMap((show) => show.motion)] },
  };
}

/** What an act done at once shows where it was done, each time it lands (R-WORLD-005): its shows that play for a while. */
export function showsFor(stage: Pick<Stage, "shows">, activity: string): Show[] {
  return (stage.shows ?? []).filter((show) => show.seconds !== undefined && show.activity === activity);
}

/** A dancer's slot, after every slot a sample can have, so a tap on one is told from a tap on the crowd. */
export const DANCER_SLOT = 1000;

/** The dancer a tapped slot names, as a resident of the city (R-CITY-033), or undefined. */
export function dancerShown(stage: Stage, slot: number): Shown | undefined {
  const dancer = stage.dancers?.[slot - DANCER_SLOT];
  const person = dancer === undefined ? null : personOf(dancer.file);
  return person === null ? undefined : { slot, person, kind: "resident", tag: null };
}
