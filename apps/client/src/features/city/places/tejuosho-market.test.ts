// Tejuosho Market staged (city.md place.tejuosho-market): rows of stalls up an aisle, their awnings
// and the bunting on the wind, bales and basins, the crowd packed between the rows.
import { describe, expect, test } from "vitest";

import { MARKET_STALL } from "@japacity/assets-src/prop/market-stall/build";

import frontRaw from "../../../../public/assets/places/tejuosho-front/place.json";
import raw from "../../../../public/assets/places/tejuosho-market/place.json";
import type { Act } from "../../../shared/world/contract";
import { sceneWords } from "../scene.words";
import { nearest, staged, stagedPlaceTests } from "./staged.testing";

const ID = "place.tejuosho-market";
const { stage, at } = staged(raw, ID);

describe("Tejuosho Market", () => {
  stagedPlaceTests(raw, ID);

  test("[R-CITY-026] given the market's stage, when its rows are read, then two rows of stalls face each other across the aisle a stall's width apart, and each row's awnings hang one a stall along its roof edge, pinned at the top", () => {
    const stalls = at("prop_market-stall.glb");
    const left = stalls.filter(([x]) => x < 0);
    const right = stalls.filter(([x]) => x > 0);
    expect(left.length).toBeGreaterThanOrEqual(6);
    expect(right).toHaveLength(left.length);
    for (const row of [left, right]) {
      const zs = row.map(([, z]) => z).sort((one, two) => one - two);
      zs.slice(1).forEach((z, index) => expect(z - (zs[index] ?? 0)).toBeGreaterThanOrEqual(MARKET_STALL.width));
    }
    const awnings = stage.motion.filter((motion) => motion.kind === "hang" && (motion.count ?? 1) === left.length);
    expect(awnings).toHaveLength(2);
    for (const awning of awnings) expect(awning.at[1]).toBeGreaterThanOrEqual(MARKET_STALL.back);
    expect(stage.motion.some((motion) => motion.kind === "bunting")).toBe(true);
  });

  test("[R-CITY-014] given the market's crowd, when the low mode's few stand, then traders stand behind the stalls' counters and the first spots are in the aisle, where the camera looks", () => {
    const stalls = at("prop_market-stall.glb");
    for (const index of stage.prefer?.trader ?? []) {
      const spot = stage.people[index];
      if (spot === undefined) throw new Error("No trader's spot");
      expect(nearest(spot, [...stalls, ...at("prop_basins.glb")])).toBeLessThan(1.5);
    }
    expect(at("prop_bales.glb").length).toBeGreaterThanOrEqual(2);
    expect(at("prop_basins.glb").length).toBeGreaterThanOrEqual(2);
    const aisle = stage.people.slice(0, 8).filter(([x]) => Math.abs(x) < 2.3);
    expect(aisle.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Mummy at her stall at Tejuosho", () => {
  test("[R-WORLD-005] given the market's front with no ask open at the stall, when its things are read, then Mummy stands at the stall with one act to greet her, and it goes while her ask can open", () => {
    const front = staged(frontRaw, "place.tejuosho-market").stage;
    const things = front.things ?? [];
    const stall = things.find((candidate) => candidate.id === "mum-stall");
    const mummy = things.find((candidate) => candidate.id === "mummy");
    if (stall === undefined || mummy === undefined) throw new Error("The stall or Mummy is missing.");
    expect(mummy.at).toEqual(stall.at);
    const greet = mummy.acts[0] as Act & { unless?: string[] };
    expect([greet.kind, sceneWords(greet.label)]).toEqual(["plain", "Greet Mama"]);
    expect(greet.unless).toEqual(stall.acts.map((act) => act.stages));
    expect(sceneWords(`${greet.label}.done`)).toMatch(/Mama/);
  });
});
