// The props and the taxi the staged places needed, built from the kit's shapes.
import { Box3, type Group, type Object3D } from "three";
import { describe, expect, test } from "vitest";

import { buildTaxi } from "../../veh/taxi/build";
import { buildBales } from "../bales/build";
import { buildBasins } from "../basins/build";
import { buildCanoe, CANOE } from "../canoe/build";
import { buildFlagpole, FLAGPOLE } from "../flagpole/build";
import { buildRepairTable } from "../repair-table/build";
import { buildTrolley } from "../trolley/build";
import { buildMarketStall, MARKET_STALL } from "./build";

const MODELS: [string, () => Group][] = [
  ["prop_market-stall", buildMarketStall],
  ["prop_bales", buildBales],
  ["prop_basins", buildBasins],
  ["prop_repair-table", buildRepairTable],
  ["prop_trolley", buildTrolley],
  ["prop_flagpole", buildFlagpole],
  ["prop_canoe", buildCanoe],
  ["veh_taxi", buildTaxi],
];

/** Whether a node or one of its parents up to the model is marked to ship smooth. */
function smooth(object: Object3D, root: Object3D): boolean {
  for (let at: Object3D | null = object; at !== null && at !== root; at = at.parent) if ((at.userData as { smooth?: unknown }).smooth === true) return true;
  return false;
}

describe("the staged places' new pieces", () => {
  test.each(MODELS)("[R-ASSET-003] given %s, when it is built, then its lowest point is on y = 0 and its origin is the centre of its footprint", (_, build) => {
    const box = new Box3().setFromObject(build());
    expect(Math.abs(box.min.y)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(box.min.x + box.max.x)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(box.min.z + box.max.z)).toBeLessThanOrEqual(0.02);
  });

  test("[R-ASSET-005] given the basins and the taxi, when they are built, then the round basins ship smooth whole and the taxi's wheels are their own smooth part while its body stays flat", () => {
    const basins = buildBasins();
    const meshes: Object3D[] = [];
    basins.traverse((object) => {
      if ((object as { isMesh?: boolean }).isMesh === true) meshes.push(object);
    });
    expect(meshes.every((mesh) => smooth(mesh, basins))).toBe(true);
    const taxi = buildTaxi();
    const parts: boolean[] = [];
    taxi.traverse((object) => {
      if ((object as { isMesh?: boolean }).isMesh === true) parts.push(smooth(object, taxi));
    });
    expect(parts.some(Boolean)).toBe(true);
    expect(parts.some((part) => !part)).toBe(true);
  });

  test("[R-ASSET-003] given the stall, the canoe and the mast, when they are built, then each is its stated size and faces +Z", () => {
    const stall = new Box3().setFromObject(buildMarketStall());
    expect(stall.max.x - stall.min.x).toBeGreaterThanOrEqual(MARKET_STALL.width);
    expect(stall.max.y).toBeGreaterThan(MARKET_STALL.front);
    const canoe = new Box3().setFromObject(buildCanoe());
    expect(canoe.max.z - canoe.min.z).toBeCloseTo(CANOE.length, 1);
    expect(canoe.max.z - canoe.min.z).toBeGreaterThan(canoe.max.x - canoe.min.x);
    const mast = new Box3().setFromObject(buildFlagpole());
    expect(mast.max.y).toBeGreaterThan(FLAGPOLE.height);
    const taxi = new Box3().setFromObject(buildTaxi());
    expect(taxi.max.z - taxi.min.z).toBeGreaterThan(taxi.max.x - taxi.min.x);
  });
});
