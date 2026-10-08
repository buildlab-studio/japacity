// Peckham staged as the hub abroad in London (city.md place.peckham, R-CITY-013): Rye Lane between
// its terraces down to the railway bridge by Peckham Rye station, measured as the build check
// measures it and read for what the place must show.
import { describe, expect, test } from "vitest";

import placeFile from "../../../../public/assets/places/peckham/place.json";
import { allPalette, copiesOf, highCrowd, instancesOf, lowCrowd, onGround, rowOf, signKeys, staged, totalsOf, wordsOf } from "./placeTesting";

const { file, stage, entry } = staged(placeFile, "place.peckham");
const QUARTER = Math.PI / 2;

describe("Peckham's budget", () => {
  test("[R-ASSET-007] given Peckham's shipped files measured as the build check measures them, when the place is counted, then both modes fit the exterior row, since the hub abroad comes on arrival and not in the first download", async () => {
    expect(entry.hub).toBe(true);
    expect(file.hub).toBe(false);
    expect(file.scope).toBe("exterior");
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
  });

  test("[R-ASSET-007] given Peckham's file, when its counts are read, then the instances are the copies staged, the crowd is the client's in each mode, and the floor is one draw call of palette colours", () => {
    expect(file.instances).toEqual(instancesOf(stage));
    expect(file.people.low).toBe(lowCrowd(entry));
    expect(file.people.high).toBe(highCrowd(entry));
    expect(placeFile.groundRoadSky.drawCalls).toBe(1);
    expect(allPalette(stage)).toBe(true);
  });
});

describe("Rye Lane", () => {
  test("[R-CITY-013] given the hub abroad, when its stage is read, then the railway bridge crosses the street ahead of the start with the station's name on it, terraces face the street from both sides, and the bus stop stands at the kerb", () => {
    const [bridge] = copiesOf(stage, "bld_railway-bridge.glb");
    if (bridge === undefined) throw new Error("No bridge");
    expect(bridge[1]).toBeLessThan(stage.start[1]);
    expect(wordsOf("place.peckham.sign.31")).toBe("PECKHAM RYE");
    expect(wordsOf("place.peckham.sign.30")).toContain("STATION");
    const terraces = [...copiesOf(stage, "bld_rye-lane-terrace_a.glb"), ...copiesOf(stage, "bld_rye-lane-terrace_b.glb")];
    const left = terraces.filter(([x, , turn]) => x < 0 && Math.abs(turn - QUARTER) < 1e-3);
    const right = terraces.filter(([x, , turn]) => x > 0 && Math.abs(turn + QUARTER) < 1e-3);
    expect(left.length).toBeGreaterThanOrEqual(2);
    expect(right.length).toBeGreaterThanOrEqual(2);
    const kerbs = stage.roads.filter((road) => road.raise !== undefined).map((road) => Math.abs(road.at[0]));
    const [shelter] = copiesOf(stage, "prop_bus-shelter.glb");
    if (shelter === undefined) throw new Error("No bus stop");
    expect(Math.abs(shelter[0]) - Math.min(...kerbs)).toBeLessThan(2.5);
  });

  test("[R-CITY-024] given the terraces standing six times and the bridge's boards, when the copies are lettered, then every copy has its own keys with words, the chicken shop and the Nigerian restaurant among them, and no key shows twice", () => {
    const keys = signKeys(stage);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.startsWith("place.peckham.sign.") && wordsOf(key).trim() !== "")).toBe(true);
    const words = keys.map(wordsOf);
    expect(words.some((said) => said.includes("CHICKEN"))).toBe(true);
    expect(words.some((said) => said.includes("NIGERIAN RESTAURANT"))).toBe(true);
    const lettered = stage.models.filter((model) => model.signs !== undefined);
    expect(lettered.map((model) => model.signs?.length)).toEqual(lettered.map((model) => model.at.length));
  });

  test("[R-CITY-014] given Peckham's crowd spots, when the high mode's sample stands, then there are spots for all of it on the ground, and the traders' spots are at the stalls under the arches", () => {
    expect(stage.people.length).toBeGreaterThanOrEqual(highCrowd(entry));
    expect(stage.people.every((spot) => onGround(stage, spot))).toBe(true);
    expect(onGround(stage, stage.start)).toBe(true);
    const stalls = copiesOf(stage, "prop_stall.glb");
    for (const index of stage.prefer?.trader ?? []) {
      const spot = stage.people[index];
      if (spot === undefined) throw new Error(`No spot ${String(index)}`);
      expect(index).toBeLessThan(highCrowd(entry));
      expect(stalls.some(([x, z]) => Math.hypot(x - spot[0], z - spot[1]) < 1.5)).toBe(true);
    }
  });

  test("[R-CITY-025] given Peckham's motion, when it is read, then bunting crosses the street, fabrics hang at the market arch, the grill smokes and leaves blow, each one moving thing on the shared clock", () => {
    expect(stage.motion.map((motion) => motion.kind)).toEqual(expect.arrayContaining(["bunting", "hang", "smoke", "leaves"]));
  });
});
