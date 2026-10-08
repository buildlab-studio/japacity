// The room behind a door (docs/rules/world.md R-WORLD-013): entering is a cut to the room as a scene
// of its own. A place whose file names `stage.inside` opens that place, an interior file like any
// other with its own things and shot. Until the places work ships interiors, the room is cut from
// the place's own file around the building, as the first example did; `roomOf` goes when
// every door names its room.
import type { Thing } from "../../shared/world/contract";
import { type PlaceFile, stageOf } from "./placeFile";
import { depthDistance } from "./shot";

/** The model whose building the player steps into when the place names no room of its own. */
export const HOUSE = "bld_family-house.glb";
/** Half the room cut from a place, in metres: about 18 by 16, the building's footprint and its yard. */
const HALF: [number, number] = [9, 8];

/** The room's door: the way back out, where the character comes in. */
export function doorThing(at: [number, number]): Thing {
  return { id: "door", file: "", copy: 0, label: "scene.thing.door", at, acts: [{ id: "out", label: "scene.act.out", kind: "out" }] };
}

/** The place a door of this file opens into, or null when the room is cut from the file itself. */
export function insideOf(file: PlaceFile | null): string | null {
  return file === null ? null : (stageOf(file).inside ?? null);
}

/**
 * The room inside a building as its own small scene cut from the place's file: the floor under the
 * building, the furniture and people that stand there, and the door as the start and the one thing.
 * The building itself is left out, so the room is seen from above like any place.
 */
export function roomOf(file: PlaceFile, building: string): PlaceFile {
  const stage = stageOf(file);
  const spot = stage.models.find((model) => model.file.endsWith(building))?.at[0] ?? stage.start;
  const [x, z] = [spot[0], spot[1]];
  const within = ([px, pz]: readonly number[]): boolean => Math.abs((px ?? 0) - x) <= HALF[0] && Math.abs((pz ?? 0) - z) <= HALF[1];
  const people = stage.people.filter(within);
  const door: [number, number] = [x, z + HALF[1] - 1];
  const room = {
    ...stage,
    // The floor is the building's footprint; the compound and the city beyond are gone.
    ground: { colour: "concrete" as const, size: [HALF[0] * 2, HALF[1] * 2] as [number, number] },
    roads: [],
    start: [door[0], door[1], Math.PI] as typeof stage.start,
    walkable: [[[x - HALF[0], z - HALF[1]], [x + HALF[0], z - HALF[1]], [x + HALF[0], z + HALF[1]], [x - HALF[0], z + HALF[1]]]] as NonNullable<typeof stage.walkable>,
    models: stage.models.filter((model) => !/\/bld_[^/]*\.glb$/.test(model.file)).map((model) => ({ ...model, at: model.at.filter(within) })).filter((model) => model.at.length > 0),
    people: people.length > 0 ? people : stage.people.slice(0, 2),
    // The room is seen whole from the door, a room's width across.
    shot: { centre: [x, 0, z] as [number, number, number], far: depthDistance(HALF[1] * 2 + 2, 58), near: 8, farPitch: 58, nearPitch: 42, turn: 20, yaw: 180, width: HALF[0] * 2 },
    things: [doorThing(door)],
  };
  delete room.inside;
  return { ...file, scope: "interior", stage: room };
}
