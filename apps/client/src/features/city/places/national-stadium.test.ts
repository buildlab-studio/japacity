// The National Stadium staged (city.md place.national-stadium): the landmark at its place, one ramp
// running down to the forecourt, the road behind, the hawkers outside the bowl.
import { describe, expect, test } from "vitest";

import { STADIUM } from "@japacity/assets-src/lm/national-stadium/build";

import raw from "../../../../public/assets/places/national-stadium/place.json";
import { staged, stagedPlaceTests } from "./staged";

const ID = "place.national-stadium";
const { stage, at, file } = staged(raw, ID);

describe("the National Stadium", () => {
  stagedPlaceTests(raw, ID);

  test("[R-CITY-020] given the stadium's stage, when the place is read, then the landmark stands once at the origin, the ground holds it whole, and the player starts outside the bowl looking at it", () => {
    const stadium = at("lm_national-stadium.glb");
    expect(stadium).toHaveLength(1);
    expect(stadium[0]?.[0]).toBe(0);
    expect(stadium[0]?.[1]).toBe(0);
    const reach = STADIUM.masts.z + STADIUM.ramps.length + STADIUM.ramps.landing + 20;
    expect(stage.ground.size[1] / 2).toBeGreaterThan(reach);
    const [x, z, facing] = stage.start;
    expect(Math.hypot(x, z)).toBeGreaterThan(STADIUM.masts.z);
    expect(Math.cos(facing)).toBeLessThan(-0.9);
  });

  test("[R-CITY-014] given the hawkers outside, when the crowd stands, then every spot and stall is outside the bowl in the forecourt, and the road runs behind the forecourt", () => {
    const outside = (spot: readonly number[]): boolean => Math.hypot(spot[0] ?? 0, spot[1] ?? 0) > STADIUM.masts.z;
    expect(stage.people.every(outside)).toBe(true);
    expect(at("prop_stall.glb").every(outside)).toBe(true);
    expect(stage.prefer?.hawker?.length).toBeGreaterThanOrEqual(1);
    const roads = stage.roads.filter((road) => road.colour === "asphalt" && road.size[1] < 12);
    expect(roads.some((road) => road.at[1] > stage.start[1])).toBe(true);
    expect(file.people.sample.some((path) => path.includes("hawker"))).toBe(true);
  });
});
