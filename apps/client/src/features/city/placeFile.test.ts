// A place dressed while an offer it stages is open (city.md R-CITY-011), or for the person whose room it is (world.md
// R-WORLD-020): a dressing names an offer or a person. A small file of its own, so each way of
// dressing is read apart from any shipped place.
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { dressPlace, filesOf, OPEN_STAGE, type PlaceFile, stageOf } from "./placeFile";

const TOBI: Id<"person"> = "person.tobi-bank";
const PARTY = "offer.party-set";
const PARTNER = { thing: "partner", person: TOBI, file: "shared/chr/chr_kunle.glb", at: [0.5, 1, 2] as [number, number, number] };

const ROOM: PlaceFile = {
  place: "place.their-room",
  scope: "interior",
  hub: false,
  instances: [],
  people: { low: 2, high: 4, sample: [] },
  stage: {
    ...OPEN_STAGE,
    models: [{ file: "shared/prop/prop_bed.glb", at: [[0, 0, 0]] }],
    people: [[1, 1, 0]],
    things: [{ id: "door", file: "shared/prop/prop_room-door.glb", copy: 0, label: "city.thing.door", acts: [{ id: "out", label: "city.inside.out", kind: "out" }] }],
    dressings: [
      { offer: PARTY, models: [{ file: "shared/prop/prop_lantern.glb", at: [[2, 2, 0]] }], people: [[3, 3, 0]], motion: [], dancers: [], crowd: { low: 4, high: 8, target: 10 } },
      { person: TOBI, models: [{ file: "shared/prop/prop_dining-table.glb", at: [[1, -1, 0]] }], people: [[-1, 1, 0]], motion: [], dancers: [], standing: [PARTNER] },
    ],
  },
};

describe("a dressing for the person whose room it is", () => {
  test("[R-WORLD-020] [R-CITY-011] given a room with a dressing for Tobi, when it opens for his bond, then his props join the room's, his spots replace its own, he stands in it, its things stay, and the crowd is the entry's", () => {
    const { file, crowd } = dressPlace(ROOM, [], TOBI);
    const stage = stageOf(file);
    expect(stage.models.map((model) => model.file)).toEqual(["shared/prop/prop_bed.glb", "shared/prop/prop_dining-table.glb"]);
    expect(stage.people).toEqual([[-1, 1, 0]]);
    expect(stage.standing).toEqual([PARTNER]);
    expect(stage.things).toEqual(stageOf(ROOM).things);
    expect(crowd).toBeNull();
    // The partner's model is fetched with the place.
    expect(filesOf(file, [])).toContain(PARTNER.file);
  });

  test("[R-WORLD-020] [R-CITY-011] given the same room, when it opens for nobody's bond or for a person it has no dressing for, then it is the plain room, the same file", () => {
    expect(dressPlace(ROOM, [], null)).toEqual({ file: ROOM, crowd: null });
    expect(dressPlace(ROOM, [], "person.amaka-nurse").file).toBe(ROOM);
    expect(dressPlace(ROOM, [TOBI]).file).toBe(ROOM);
  });

  test("[R-CITY-011] [R-WORLD-020] given an open offer the place stages and a person's dressing, when both could dress it, then the offer's does, with its guests' crowd", () => {
    const { file, crowd } = dressPlace(ROOM, [PARTY], TOBI);
    expect(stageOf(file).models.map((model) => model.file)).toEqual(["shared/prop/prop_bed.glb", "shared/prop/prop_lantern.glb"]);
    expect(stageOf(file).standing).toBeUndefined();
    expect(crowd).toEqual({ low: 4, high: 8, target: 10 });
  });
});
