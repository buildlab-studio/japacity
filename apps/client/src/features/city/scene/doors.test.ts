// The doors of a place of several scenes (world:entering-is-a-cut, home:home-is-the-home-point): Makoko's channel, read from its own
// file. The rented house's door opens only for the life that lives on the water; the channel's other doors open for everyone; and a
// way to a thing behind a door points at the door, the racks' at the smoking deck's, the night's bed at the rented house's.
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/makoko/place.json";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { homeSceneOf, outOfHome } from "../acts/room";
import { stepThingHere } from "../nudge/nudge";
import { doorsFor, doorTo, thingsOf } from "./things";

const stage = stageOf(raw as unknown as PlaceFile);
const things = thingsOf(stage);
const ids = (shown: readonly { id: string }[]) => shown.map((thing) => thing.id).sort();
/** The racks' way as the nudge gives it: the racks at Makoko, else the boards in town (activity:fish-racks-at-makoko). */
const RACKS_WAY = { go: "place.makoko", at: ["place.makoko:racks", "place.yaba:jobs", "place.ojuelegba:hub"] };

describe("the doors on Makoko's channel", () => {
  test("[home:home-is-the-home-point] given the channel's things, when they are read for a life that lives on the water and for one that does not, then the rented house's door shows only for the first, and to the second the house is a neighbour's with nothing over it", () => {
    expect(ids(doorsFor(things, true))).toEqual(ids(things));
    const elsewhere = doorsFor(things, false);
    expect(elsewhere.some((thing) => thing.id === "room")).toBe(false);
    expect(ids(elsewhere)).toEqual(ids(things).filter((id) => id !== "room"));
    for (const door of ["smoking-deck", "net-shed", "viewing-centre"]) expect(elsewhere.some((thing) => thing.id === door)).toBe(true);
  });

  test("[world:entering-is-a-cut] given the racks behind the smoking deck's door, when the racks' way is read on the channel, then it points at the deck's door, and in a place with neither the racks nor a door to them it points at nothing", () => {
    expect(stepThingHere(RACKS_WAY, "place.makoko", things)).toBe("smoking-deck");
    expect(stepThingHere(RACKS_WAY, "place.makoko", things.filter((thing) => thing.id !== "smoking-deck"))).toBeNull();
    // On the deck itself the racks stand, and the way points at them.
    expect(stepThingHere(RACKS_WAY, "place.makoko", [{ id: "racks", acts: [] }])).toBe("racks");
  });

  test("[world:entering-is-a-cut] [world:sleep-ends-the-month] given the bed behind the rented house's door, when the door to it is looked for on the channel, then it is the house's, and none leads to it for a life the door is shut to", () => {
    expect(doorTo(things, "bed")).toBe("room");
    expect(doorTo(things, "racks")).toBe("smoking-deck");
    expect(doorTo(doorsFor(things, false), "bed")).toBeNull();
    expect(doorTo(things, "nothing-here")).toBeNull();
  });
});

describe("the room on the water as a home", () => {
  test("[home:home-is-the-home-point] given the channel's file, when its home door is read, then it opens the room on the water; a life standing in that room that does not live there steps out to the walk, and one that still does, or stands in another scene, stays", () => {
    const file = raw as unknown as PlaceFile;
    expect(homeSceneOf(file)).toBe("makoko-room");
    expect(homeSceneOf(null)).toBeNull();
    expect(outOfHome(true, "makoko-room", "makoko-room", false)).toBe(true);
    expect(outOfHome(true, "makoko-room", "makoko-room", true)).toBe(false);
    expect(outOfHome(true, "makoko-viewing-centre", "makoko-room", false)).toBe(false);
    expect(outOfHome(false, "makoko-room", "makoko-room", false)).toBe(false);
  });
});
