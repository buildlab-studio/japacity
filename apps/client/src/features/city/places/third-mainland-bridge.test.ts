// The Third Mainland Bridge as one frontage (city.md place.third-mainland-bridge, world.md
// world:place-is-one-screen, streets:sleeping-under-the-bridge): the shore under one span, the deck overhead, mats on pallets
// where people sleep, a drum fire, the lagoon's edge, and a danfo on the service road.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { BRIDGE, girderDepth } from "@japacity/assets-src/lm/third-mainland-span/build";

import raw from "../../../../public/assets/places/third-mainland-bridge/place.json";
import { stagedAt } from "../../../shared/scene/staging";
import { thingSpot, vehicleOf } from "../scene/things";
import { frontageTests } from "./frontage.testing";
import { copiesOf, staged } from "./place.testing";
import { cityWords } from "../city.words";
import { thingIn } from "../../../shared/testing/things";

const ID = "place.third-mainland-bridge";
const { stage } = staged(raw, ID);
const thing = (id: string) => thingIn(stage.things, id);
const NIGHT = ["offer.bridge-night", "offer.bridge-theft", "offer.bridge-mosquitoes"];

describe("the Third Mainland Bridge", () => {
  frontageTests(raw, ID);

  test("[streets:sleeping-under-the-bridge] given the mats under the bridge, when their acts are read, then sleeping rough is done on the spot lying on a mat, and the night's three blows open from the same mats on one sheet", () => {
    const mats = thing("mats");
    const [sleep, night] = mats.acts;
    expect(sleep?.kind).toBe("do");
    expect(sleep?.stages).toBe("activity.sleep-rough");
    expect(sleep?.pose).toBe("lie");
    expect(night?.kind).toBe("sheet");
    expect([night?.stages, ...(night?.more ?? [])]).toEqual(NIGHT);
    expect(mats.acts.map((act) => cityWords(act.label))).toEqual(["Sleep here", "The night"]);
  });

  test("[streets:sleeping-under-the-bridge] given the sleeping spot, when it is read against the pallets and the deck, then it lies on a mat on a pallet and under the span's girder", () => {
    const seat = thing("mats").acts[0]?.seat;
    if (seat === undefined) throw new Error("No seat");
    const pallets = stage.roads.filter((road) => road.colour === "wood");
    expect(pallets.length).toBeGreaterThanOrEqual(3);
    const onPallet = pallets.some((road) => Math.abs(seat[0] - road.at[0]) <= road.size[0] / 2 && Math.abs(seat[1] - road.at[1]) <= road.size[1] / 2);
    expect(onPallet).toBe(true);
    const [span] = copiesOf(stage, "lm_third-mainland-span.glb");
    if (span === undefined) throw new Error("No span");
    // Under the deck's near edge, and the girder there clears a standing person.
    expect(Math.abs(seat[1] - span[1])).toBeLessThan(BRIDGE.deckWidth / 2 - 1.5);
    const t = Math.max(-1, Math.min(1, ((seat[0] - span[0]) / BRIDGE.bay) * 2));
    expect(BRIDGE.top - girderDepth(t)).toBeGreaterThan(2);
  });

  test("[city:set-piece-shown-where-staged] given what the bridge stages, when the city looks for where each is shown at home, then sleeping rough and the night's blows are shown here", () => {
    const places = Object.values(content.place);
    for (const id of ["activity.sleep-rough", ...NIGHT]) expect(stagedAt(id, { where: "home", country: null }, places)).toBe(ID);
  });

  test("[world:ride-sheet-shows-fares] given the danfo on the service road, when it is tapped, then it opens the ride sheet for the danfo", () => {
    const danfo = thing("danfo");
    expect(danfo.acts.map((act) => act.kind)).toEqual(["ride"]);
    expect(vehicleOf(danfo)).toBe("danfo");
    expect(thingSpot(stage, danfo)).not.toBeNull();
  });

  test("[world:things-are-tappable-models] given the drum fire, when its act is read, then warming your hands is a plain act that says what happened, and its smoke rises from it", () => {
    const fire = thing("drum-fire");
    expect(fire.acts.map((act) => act.kind)).toEqual(["plain"]);
    expect(cityWords("city.act.warm-hands.done")).not.toBe("city.act.warm-hands.done");
    const spot = thingSpot(stage, fire);
    const smoke = stage.motion.find((motion) => motion.kind === "smoke");
    if (spot === null || smoke === undefined) throw new Error("No fire or smoke");
    expect(Math.hypot(smoke.at[0] - spot[0], smoke.at[2] - spot[1])).toBeLessThan(0.5);
  });

  test("[city:motion-in-vertex-shader] given the lagoon's edge, when the place is read, then one water grid in the lagoon's colour lies beside the shore and nobody stands in it", () => {
    const water = stage.motion.filter((motion) => motion.kind === "water");
    expect(water).toHaveLength(1);
    const [grid] = water;
    if (grid === undefined) throw new Error("No water");
    expect(grid.colours).toEqual(["lagoon"]);
    const [width, depth] = grid.size ?? [0, 0];
    const inside = ([x, z]: readonly number[]): boolean => Math.abs((x ?? 0) - grid.at[0]) <= width / 2 && Math.abs((z ?? 0) - grid.at[2]) <= depth / 2;
    expect(stage.people.filter((spot) => inside(spot))).toEqual([]);
    expect(inside(stage.start)).toBe(false);
  });
});
