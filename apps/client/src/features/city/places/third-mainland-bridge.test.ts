// The Third Mainland Bridge staged (city.md place.third-mainland-bridge): the span on its water in the
// lagoon's colour, canoes on the moving water, houses on stilts with their washing, fish smoked on the shore.
import { describe, expect, test } from "vitest";

import { BRIDGE } from "@japacity/assets-src/lm/third-mainland-span/build";

import raw from "../../../../public/assets/places/third-mainland-bridge/place.json";
import { staged, stagedPlaceTests } from "./staged";

const ID = "place.third-mainland-bridge";
const { stage, at } = staged(raw, ID);

describe("the Third Mainland Bridge", () => {
  stagedPlaceTests(raw, ID);

  test("[R-CITY-026] given the lagoon, when the place is read, then one water grid in the lagoon's colour lies under the whole near span, the still lagoon beyond it is the same colour, and every canoe and stilt house near the bridge stands in it", () => {
    const water = stage.motion.filter((motion) => motion.kind === "water");
    expect(water).toHaveLength(1);
    const [grid] = water;
    if (grid === undefined) throw new Error("No water");
    const [width, depth] = grid.size ?? [0, 0];
    const inside = ([x, z]: readonly number[]): boolean => Math.abs((x ?? 0) - grid.at[0]) <= width / 2 && Math.abs((z ?? 0) - grid.at[2]) <= depth / 2;
    const [span] = at("lm_third-mainland-span.glb");
    if (span === undefined) throw new Error("No span");
    expect(inside([span[0], span[1] - BRIDGE.deckWidth / 2])).toBe(true);
    expect(inside([span[0], span[1] + BRIDGE.deckWidth / 2])).toBe(true);
    expect(stage.roads.some((road) => road.colour === grid.colours[0] && road.size[1] > depth)).toBe(true);
    expect(at("prop_canoe.glb").filter((spot) => !inside(spot))).toEqual([]);
    const near = at("bld_stilt-house.glb").filter(([, z]) => z > span[1]);
    expect(near.length).toBeGreaterThanOrEqual(2);
    expect(near.filter((spot) => !inside(spot))).toEqual([]);
  });

  test("[R-CITY-014] given the shore, when the crowd stands, then the first spot is a fisherman in a canoe and the player starts on dry ground facing the bridge", () => {
    const [first] = stage.people;
    if (first === undefined) throw new Error("No spots");
    expect(Math.min(...at("prop_canoe.glb").map(([x, z]) => Math.hypot(x - first[0], z - first[1])))).toBeLessThan(0.5);
    const water = stage.motion.find((motion) => motion.kind === "water");
    const shore = (water?.at[2] ?? 0) + (water?.size?.[1] ?? 0) / 2;
    expect(stage.start[1]).toBeGreaterThan(shore);
    expect(Math.cos(stage.start[2])).toBeLessThan(-0.9);
    expect(stage.motion.some((motion) => motion.kind === "smoke")).toBe(true);
    expect(stage.motion.some((motion) => motion.kind === "hang")).toBe(true);
  });
});
