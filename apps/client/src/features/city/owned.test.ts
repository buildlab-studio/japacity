// The market's things in the room and buy mode's floor rule (the new rule R-WORLD-035 to
// come, cited meanwhile by R-WORLD-005 and R-WORLD-029): what is owned stands at its set spot or where it was set down,
// taking the place of the model it replaces; buy mode only in a home of your own; a thing set down fits only on the floor,
// clear of every other footprint and of the ways; the arrangement is kept beside the save by life.
import { type Footprint, type FootprintBox } from "@japacity/assets";
import { describe, expect, test } from "vitest";

import { arrangedIn, ARRANGED_KEY, forgetArranged, keepArranged, keepTurn, turnIn } from "../../shared/world/arranged";
import { boxesOverlap, misfit, QUARTER, turned } from "./arrange";
import { buyModeAt, liftable, ownedThingId, showOwned } from "./owned";
import type { PlaceFile, Stage } from "./placeFile";

const SHELL = "places/x/bld_x.glb";
const BED = "shared/prop/prop_bed.glb";
const NEW_BED = "shared/prop/prop_foam-mattress.glb";
const FAN = "shared/prop/prop_fan.glb";
const TV = "shared/prop/prop_tv.glb";

/** A room of 6 by 6 metres, its back wall a footprint along z = -3, the bed at the left, the door at the front. */
function room(): PlaceFile {
  const stage: Stage = {
    ground: { size: [6, 6], colour: "concrete" },
    roads: [],
    light: { sun: [5, 10, 5], sky: "sky", ground: "concrete" },
    start: [0, 2.6, Math.PI],
    walkable: [[[-3, -3], [3, -3], [3, 3], [-3, 3]]],
    models: [
      { file: SHELL, at: [[0, 0, 0]] },
      { file: BED, at: [[-2, 0, 0]] },
    ],
    people: [[2, 2, 0]],
    motion: [],
    things: [{ id: "bed", file: BED, copy: 0, label: "city.thing.mattress", at: [-1.2, 0], acts: [] }],
    owned: [
      { thing: "thing.fan", file: FAN, at: [1, -2, 0] },
      { thing: "thing.mattress", file: NEW_BED, at: [-2, 0, 0], hides: BED },
      { thing: "thing.tv", file: TV, at: [0, -2.5, 0], acts: [{ id: "watch-tv", label: "activity.watch-tv.name", kind: "sheet", stages: "activity.watch-tv" }] },
    ],
  };
  return { place: "place.compound-room", scope: "interior", hub: false, instances: [], people: { low: 0, high: 0, sample: [] }, stage };
}

const box = (width: number, depth: number, x = 0, z = 0): FootprintBox => ({ x, z, width, depth });
const FOOTPRINTS: Record<string, Footprint> = {
  [SHELL]: [box(6, 0.3, 0, -2.9)],
  [BED]: [box(1, 2)],
  [NEW_BED]: [box(1.2, 2.1)],
  [FAN]: [box(0.4, 0.4)],
  [TV]: [box(1, 0.4)],
};
const footprintOf = (file: string): Footprint | null => FOOTPRINTS[file] ?? null;

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

describe("the things in the room", () => {
  test("[R-WORLD-035] [R-WORLD-029] given a home with nothing owned standing, when it is staged, then it is the same file, so nothing is rebuilt", () => {
    const file = room();
    expect(showOwned(file, [])).toBe(file);
  });

  test("[R-WORLD-035] [R-WORLD-029] given a fan, a new mattress and a TV owned, when the room is staged, then each stands at its set spot as a model of its own, the new mattress takes the old bed's place and the TV is a thing with its act", () => {
    const staged = showOwned(room(), ["thing.fan", "thing.mattress", "thing.tv"]);
    const models = staged.stage?.models ?? [];
    expect(models.find((model) => model.file === BED)).toBeUndefined();
    expect(models.filter((model) => model.owned !== undefined)).toEqual([
      { file: FAN, at: [[1, -2, 0]], owned: "thing.fan" },
      { file: NEW_BED, at: [[-2, 0, 0]], owned: "thing.mattress" },
      { file: TV, at: [[0, -2.5, 0]], owned: "thing.tv" },
    ]);
    expect(staged.stage?.things?.map((thing) => thing.id)).toEqual(["bed", ownedThingId("thing.tv")]);
    expect(liftable(staged).map((item) => item.thing)).toEqual(["thing.fan", "thing.mattress", "thing.tv"]);
  });

  test("[R-WORLD-035] [R-WORLD-005] given a fan set down somewhere else, when the room is staged, then it stands where it was set down, turned as it was", () => {
    const staged = showOwned(room(), ["thing.fan"], { "thing.fan": [2, 1, QUARTER] });
    expect(staged.stage?.models.find((model) => model.owned === "thing.fan")?.at).toEqual([[2, 1, QUARTER]]);
  });

  test("[R-WORLD-035] [R-WORLD-005] given buy mode's homes, when it is asked where it stands, then only in the home lived in when it is a home of your own with something owned in it: never the family house, a street or someone else's room", () => {
    expect(buyModeAt("place.compound-room", "place.compound-room", ["thing.fan"])).toBe(true);
    expect(buyModeAt("place.hostel-room", "place.hostel-room", ["thing.fan"])).toBe(true);
    expect(buyModeAt("place.makoko", "place.makoko", ["thing.fan"])).toBe(true);
    expect(buyModeAt("place.family-house", "place.family-house", ["thing.fan"])).toBe(false);
    expect(buyModeAt("place.compound-room", "place.family-house", ["thing.fan"])).toBe(false);
    expect(buyModeAt("place.yaba", "place.compound-room", ["thing.fan"])).toBe(false);
    expect(buyModeAt("place.compound-room", "place.compound-room", [])).toBe(false);
  });
});

describe("buy mode's floor rule", () => {
  const stage = (): Stage => room().stage!;
  const staged = (): Stage => showOwned(room(), ["thing.fan", "thing.tv"]).stage!;

  test("[R-WORLD-035] [R-WORLD-005] given the fan lifted, when it is set down on open floor, then it fits", () => {
    expect(misfit(staged(), "thing.fan", FAN, [1.5, 0, 0], footprintOf)).toBeNull();
  });

  test("[R-WORLD-035] [R-WORLD-005] given the fan lifted, when it is set down past the floor's edge or half over it, then it does not fit: the floor", () => {
    expect(misfit(staged(), "thing.fan", FAN, [3.5, 0, 0], footprintOf)).toBe("floor");
    expect(misfit(staged(), "thing.fan", FAN, [2.9, 0, 0], footprintOf)).toBe("floor");
  });

  test("[R-WORLD-035] [R-WORLD-005] given the fan lifted, when it is set down on the bed, on the TV or through the wall, then it does not fit: another thing", () => {
    expect(misfit(staged(), "thing.fan", FAN, [-2, 0.5, 0], footprintOf)).toBe("thing");
    expect(misfit(staged(), "thing.fan", FAN, [0.3, -2.5, 0], footprintOf)).toBe("thing");
    expect(misfit(staged(), "thing.fan", FAN, [1, -2.75, 0], footprintOf)).toBe("thing");
  });

  test("[R-WORLD-035] [R-WORLD-005] given the fan lifted, when it is set down in the doorway, on a person's spot or where the bed is walked to, then it does not fit: the way", () => {
    expect(misfit(staged(), "thing.fan", FAN, [0, 2.6, 0], footprintOf)).toBe("way");
    expect(misfit(staged(), "thing.fan", FAN, [2, 2, 0], footprintOf)).toBe("way");
    expect(misfit(staged(), "thing.fan", FAN, [-1.2, 0, 0], footprintOf)).toBe("way");
  });

  test("[R-WORLD-035] [R-WORLD-005] given the fan lifted from its spot, when it is set down where it stood, then it fits: it never collides with itself", () => {
    expect(misfit(staged(), "thing.fan", FAN, [1, -2, 0], footprintOf)).toBeNull();
    expect(misfit(stage(), "thing.fan", FAN, [1, -2, 0], footprintOf)).toBeNull();
  });

  test("[R-WORLD-035] [R-WORLD-005] given a TV a quarter turned, when it is read, then a long thing turned takes the floor the other way, and a turn goes round in quarters", () => {
    expect(misfit(staged(), "thing.tv", TV, [2.7, 0, 0], footprintOf)).toBe("floor");
    expect(misfit(staged(), "thing.tv", TV, [2.7, 0, QUARTER], footprintOf)).toBeNull();
    expect(turned([0, 0, 0])).toEqual([0, 0, QUARTER]);
    expect(turned(turned(turned(turned([0, 0, 0]))))[2]).toBeCloseTo(0, 6);
  });

  test("[R-WORLD-035] [R-WORLD-005] given two boxes, when they only touch, then they do not overlap: a wardrobe may stand flush against a wall", () => {
    const a = { x: 0, z: 0, halfWidth: 0.5, halfDepth: 0.5, cos: 1, sin: 0 };
    expect(boxesOverlap(a, { ...a, x: 1 })).toBe(false);
    expect(boxesOverlap(a, { ...a, x: 0.9 })).toBe(true);
    expect(boxesOverlap(a, { ...a, x: 1.1, cos: Math.cos(Math.PI / 4), sin: Math.sin(Math.PI / 4) })).toBe(true);
  });
});

describe("the room's arrangement beside the save", () => {
  test("[R-WORLD-035] [R-WORLD-005] given a thing set down, when the arrangement is read back for the same life, then it is where it was set down; another life reads nothing, and a new life forgets it", () => {
    const storage = memoryStorage();
    keepArranged("place.compound-room", "thing.fan", [1, 2, QUARTER], "scenario.ada", storage);
    keepArranged("place.compound-room", "thing.tv", [0, 1, 0], "scenario.ada", storage);
    expect(arrangedIn("place.compound-room", "scenario.ada", storage)).toEqual({ "thing.fan": [1, 2, QUARTER], "thing.tv": [0, 1, 0] });
    expect(arrangedIn("place.hostel-room", "scenario.ada", storage)).toEqual({});
    expect(arrangedIn("place.compound-room", "scenario.tunde", storage)).toEqual({});
    forgetArranged(storage);
    expect(storage.data.has(ARRANGED_KEY)).toBe(false);
  });

  test("[R-WORLD-035] [R-WORLD-005] given a kept arrangement that is not well formed, when it is read, then the bad spots are dropped and nothing throws", () => {
    const storage = memoryStorage();
    storage.setItem(ARRANGED_KEY, JSON.stringify({ scenario: "scenario.ada", homes: { "place.compound-room": { "thing.fan": [1, "x", 0], "thing.tv": [0, 1, 0] } } }));
    expect(arrangedIn("place.compound-room", "scenario.ada", storage)).toEqual({ "thing.tv": [0, 1, 0] });
    storage.setItem(ARRANGED_KEY, "not json");
    expect(arrangedIn("place.compound-room", "scenario.ada", storage)).toEqual({});
  });

  test("[R-WORLD-009] [R-WORLD-029] given a wide home's view turned, when the life is reloaded, then the home opens on the quarter it was left on, each home its own, beside the arrangement without disturbing it; another life reads the house unturned, and a new life forgets it", () => {
    const storage = memoryStorage();
    expect(turnIn("place.family-house", "scenario.ada", storage)).toBe(0);
    keepArranged("place.compound-room", "thing.fan", [1, 2, QUARTER], "scenario.ada", storage);
    expect(keepTurn("place.family-house", 3, "scenario.ada", storage)).toBe(3);
    expect(keepTurn("place.compound-room", 5, "scenario.ada", storage)).toBe(1);
    expect(keepTurn("place.hostel-room", -1, "scenario.ada", storage)).toBe(3);
    expect(turnIn("place.family-house", "scenario.ada", storage)).toBe(3);
    expect(turnIn("place.compound-room", "scenario.ada", storage)).toBe(1);
    expect(turnIn("place.hostel-room", "scenario.ada", storage)).toBe(3);
    expect(arrangedIn("place.compound-room", "scenario.ada", storage)).toEqual({ "thing.fan": [1, 2, QUARTER] });
    keepArranged("place.compound-room", "thing.tv", [0, 1, 0], "scenario.ada", storage);
    expect(turnIn("place.compound-room", "scenario.ada", storage)).toBe(1);
    expect(turnIn("place.family-house", "scenario.tunde", storage)).toBe(0);
    forgetArranged(storage);
    expect(turnIn("place.family-house", "scenario.ada", storage)).toBe(0);
  });

  test("[R-WORLD-009] given a kept turn that is not a quarter, when it is read, then it is dropped and the house opens unturned", () => {
    const storage = memoryStorage();
    storage.setItem(ARRANGED_KEY, JSON.stringify({ scenario: "scenario.ada", homes: {}, turns: { "place.family-house": 1.5, "place.hostel-room": "2", "place.compound-room": 2 } }));
    expect(turnIn("place.family-house", "scenario.ada", storage)).toBe(0);
    expect(turnIn("place.hostel-room", "scenario.ada", storage)).toBe(0);
    expect(turnIn("place.compound-room", "scenario.ada", storage)).toBe(2);
    // An arrangement kept before the turn was kept still reads.
    storage.setItem(ARRANGED_KEY, JSON.stringify({ scenario: "scenario.ada", homes: { "place.compound-room": { "thing.tv": [0, 1, 0] } } }));
    expect(arrangedIn("place.compound-room", "scenario.ada", storage)).toEqual({ "thing.tv": [0, 1, 0] });
    expect(turnIn("place.compound-room", "scenario.ada", storage)).toBe(0);
  });
});
