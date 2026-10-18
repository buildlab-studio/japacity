// The National Stadium as one frontage (city.md place.national-stadium, world:place-is-one-screen,
// streets:stadium-morning-run): the south gate where the ramp comes down, a stretch of running track
// before it with a few runners, the road where the danfo stops, and the bowl rising behind.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { STADIUM } from "@japacity/assets-src/lm/national-stadium/build";

import raw from "../../../../public/assets/places/national-stadium/place.json";
import { stagedAt } from "../../../shared/scene/staging";
import { thingSpot, vehicleOf } from "../scene/things";
import { frontageTests } from "./frontage.testing";
import { copiesOf, staged } from "./place.testing";
import { cityWords } from "../city.words";
import { thingIn } from "../../../shared/testing/things";

const ID = "place.national-stadium";
const { stage, entry } = staged(raw, ID);
const thing = (id: string) => thingIn(stage.things, id);

describe("the National Stadium", () => {
  frontageTests(raw, ID);

  test("[streets:stadium-morning-run] given the track, when its act is read, then the morning run is done on the spot, and it is the only thing the stadium stages", () => {
    const track = thing("track");
    expect(track.acts.map((act) => [act.kind, act.stages])).toEqual([["do", "activity.morning-run"]]);
    expect(cityWords(track.acts[0]?.label ?? "")).toBe("Run");
    expect(entry.stages).toEqual(["activity.morning-run"]);
    expect(stagedAt("activity.morning-run", { where: "home", country: null }, Object.values(content.place))).toBe(ID);
  });

  test("[streets:stadium-morning-run] given the track, when the place is read, then its lanes run across the whole frontage, the track's thing stands at its edge and the runners' spots are on it", () => {
    const lanes = stage.roads.filter((road) => road.colour === "white");
    expect(lanes.length).toBeGreaterThanOrEqual(4);
    const top = Math.min(...lanes.map((lane) => lane.at[1]));
    const bottom = Math.max(...lanes.map((lane) => lane.at[1]));
    expect(lanes.every((lane) => lane.size[0] >= (stage.shot?.width ?? 0))).toBe(true);
    const spot = thingSpot(stage, thing("track"));
    if (spot === null) throw new Error("No track");
    expect(Math.min(Math.abs(spot[1] - top), Math.abs(spot[1] - bottom))).toBeLessThan(1.5);
    const on = stage.people.filter(([, z]) => z > top && z < bottom);
    expect(on.length).toBeGreaterThanOrEqual(2);
  });

  test("[city:landmarks-built-to-outline] given the gate, when the place is read, then the landmark stands once at the origin with the south ramp's landing at the gate, a flagpole either side, and the player starts outside the bowl looking at it", () => {
    const stadium = copiesOf(stage, "lm_national-stadium.glb");
    expect(stadium).toHaveLength(1);
    expect(stadium[0]?.[0]).toBe(0);
    expect(stadium[0]?.[1]).toBe(0);
    const poles = copiesOf(stage, "prop_flagpole.glb");
    expect(poles).toHaveLength(2);
    expect((poles[0]?.[0] ?? 0) + (poles[1]?.[0] ?? 0)).toBeCloseTo(0);
    expect(Math.hypot(poles[0]?.[0] ?? 0, poles[0]?.[1] ?? 0)).toBeGreaterThan(STADIUM.masts.z + STADIUM.ramps.length);
    const [x, z, facing] = stage.start;
    expect(Math.hypot(x, z)).toBeGreaterThan(STADIUM.masts.z);
    expect(Math.cos(facing)).toBeLessThan(-0.9);
    expect(thing("gate").acts.map((act) => act.kind)).toEqual(["plain"]);
  });

  test("[world:ride-sheet-shows-fares] given the danfo at the kerb, when it is tapped, then it opens the ride sheet for the danfo", () => {
    const danfo = thing("danfo");
    expect(danfo.acts.map((act) => act.kind)).toEqual(["ride"]);
    expect(vehicleOf(danfo)).toBe("danfo");
    expect(thingSpot(stage, danfo)).not.toBeNull();
  });
});
