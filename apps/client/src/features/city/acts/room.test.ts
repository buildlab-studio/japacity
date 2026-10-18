import { describe, expect, test } from "vitest";

import familyHouse from "../../../../public/assets/places/family-house-compound/place.json";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { doorThing, HOUSE, insideOf, roomOf } from "./room";
import { thingsOf } from "../scene/things";

const house = familyHouse as unknown as PlaceFile;

describe("the cut into a room", () => {
  test("[world:entering-is-a-cut] given the compound, which names no room of its own, when the house is entered, then the room is a small scene of its own: no building over it, the door as the start and its one thing, and a shot of its own", () => {
    expect(insideOf(house)).toBeNull();
    const room = stageOf(roomOf(house, HOUSE));
    expect(room.models.some((model) => /\/bld_/.test(model.file))).toBe(false);
    expect(room.roads).toEqual([]);
    expect(room.shot).toBeDefined();
    const things = thingsOf(room);
    expect(things).toHaveLength(1);
    expect(things[0]?.acts.map((act) => act.kind)).toEqual(["out"]);
    expect(things[0]?.at).toEqual([room.start[0], room.start[1]]);
    expect(roomOf(house, HOUSE).scope).toBe("interior");
  });

  test("[world:entering-is-a-cut] given a place whose file names its room, when its door is read, then the room is that place, an interior file like any other, and the cut room is not used", () => {
    const stage = stageOf(house);
    const named: PlaceFile = { ...house, stage: { ...stage, inside: "place.parlour" } };
    expect(insideOf(named)).toBe("place.parlour");
    expect(insideOf(null)).toBeNull();
    // A cut room never names a further room.
    expect(stageOf(roomOf(named, HOUSE)).inside).toBeUndefined();
    expect(doorThing([1, 2]).acts).toEqual([{ id: "out", label: "scene.act.out", kind: "out" }]);
  });
});
