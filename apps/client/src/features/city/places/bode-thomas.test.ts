// Bode Thomas Street staged (city.md place.bode-thomas): the lotto kiosk and the betting shop's
// street, measured as the build check measures it and read for what the place must show.
import { describe, expect, test } from "vitest";

import placeFile from "../../../../public/assets/places/bode-thomas/place.json";
import { allPalette, copiesOf, highCrowd, instancesOf, lowCrowd, onGround, rowOf, signKeys, staged, totalsOf, wordsOf } from "./place.testing";

const { file, stage, entry } = staged(placeFile, "place.bode-thomas");
// The two kerbs either side of the carriageway: the raised strips nearest the street's middle.
const kerbs = stage.roads.filter((road) => road.raise !== undefined).map((road) => road.at[1]).sort((one, two) => Math.abs(one) - Math.abs(two)).slice(0, 2);
const north = Math.min(...kerbs);
const south = Math.max(...kerbs);

describe("Bode Thomas Street's budget", () => {
  test("[R-ASSET-007] given the street's shipped files measured as the build check measures them, when the place is counted, then both modes fit the exterior row", async () => {
    const totals = await totalsOf(file);
    expect(file.scope).toBe("exterior");
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
  });

  test("[R-ASSET-007] given the street's file, when its counts are read, then the instances are the copies staged, the crowd is the client's in each mode, and the floor is one draw call of palette colours", () => {
    expect(file.instances).toEqual(instancesOf(stage));
    expect(file.people.low).toBe(lowCrowd(entry));
    expect(file.people.high).toBe(highCrowd(entry));
    expect(placeFile.groundRoadSky.drawCalls).toBe(1);
    expect(allPalette(stage)).toBe(true);
  });
});

describe("the street", () => {
  test("[R-CITY-010] given the place that stages the lotto and the betting slip, when its stage is read, then the kiosk stands on the south pavement across the road from the betting shop's building, each lettered with its own board", () => {
    expect(entry.stages).toEqual(expect.arrayContaining(["activity.play-lotto", "activity.bet-slip"]));
    const [kiosk] = copiesOf(stage, "shop_lotto-kiosk.glb");
    const [betting] = copiesOf(stage, "bld_bode-thomas-betting.glb");
    if (kiosk === undefined || betting === undefined) throw new Error("The kiosk or the betting shop is missing");
    expect(kiosk[1]).toBeGreaterThan(south);
    expect(betting[1]).toBeLessThan(north);
    expect(Math.abs(kiosk[0] - betting[0])).toBeLessThan(10);
    expect(wordsOf("place.bode-thomas.sign.1")).toContain("Lotto");
    expect(wordsOf("place.bode-thomas.sign.2")).toContain("Betting");
  });

  test("[R-CITY-014] given the street's crowd spots, when the high mode's sample stands, then there are spots for all of it on the ground, the low mode's first spots queue at the kiosk's hatch, and the roles' spots are in the sample", () => {
    expect(stage.people.length).toBeGreaterThanOrEqual(highCrowd(entry));
    expect(stage.people.every((spot) => onGround(stage, spot))).toBe(true);
    expect(onGround(stage, stage.start)).toBe(true);
    const [kiosk] = copiesOf(stage, "shop_lotto-kiosk.glb");
    if (kiosk === undefined) throw new Error("No kiosk");
    const queue = stage.people.slice(0, lowCrowd(entry)).filter(([x, z]) => Math.hypot(x - kiosk[0], z - kiosk[1]) < 3.5);
    expect(queue.length).toBeGreaterThanOrEqual(2);
    for (const indices of Object.values(stage.prefer ?? {})) for (const index of indices) expect(index).toBeLessThan(highCrowd(entry));
  });

  test("[R-CITY-024] given the shop rows and plazas standing twice, when their copies are lettered, then every copy has its own keys, each with words, and no key shows twice", () => {
    const keys = signKeys(stage);
    expect(keys.length).toBeGreaterThanOrEqual(16);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.startsWith("place.bode-thomas.sign.") && wordsOf(key).trim() !== "")).toBe(true);
    const lettered = stage.models.filter((model) => model.signs !== undefined);
    expect(lettered.map((model) => model.signs?.length)).toEqual(lettered.map((model) => model.at.length));
  });

  test("[R-CITY-025] given the street's motion, when it is read, then the grill smokes, leaves blow along the road, bunting hangs at the betting shop and a palm moves, all on the shared clock", () => {
    const kinds = stage.motion.map((motion) => motion.kind);
    expect(kinds).toEqual(expect.arrayContaining(["smoke", "leaves", "bunting", "frond"]));
  });
});
