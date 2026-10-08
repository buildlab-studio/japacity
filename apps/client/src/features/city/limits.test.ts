import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { WORLD_LIMITS } from "../../../../../tools/assets/world-check";
import { crowdSize, localDate, poolOf, sampleCrowd } from "./crowd";
import { crowdTuning, limitMotion, sheetCost } from "./limits";
import { dressPlace, type Motion, stageOf } from "./placeFile";
import { builtPlaces } from "./scene.testing";

const city = content.tuning.city;
const SHEETS = new Set(["flag", "hang", "frond"]);
const sheetsIn = (motion: readonly Motion[]): Motion[] => motion.filter((entry) => SHEETS.has(entry.kind));

describe("the crowd a place may show", () => {
  test("[R-WORLD-011] given tuning's crowd figures, when a place's crowd is capped by its scope, then outdoors shows at most 6 in low mode and 10 in high, and a room 4 and 6", () => {
    const outdoors = crowdTuning(city, "exterior", false);
    const indoors = crowdTuning(city, "interior", false);
    expect([outdoors.crowdLow, outdoors.crowdHigh]).toEqual([Math.min(city.crowdLow, 6), Math.min(city.crowdHigh, 10)]);
    expect([indoors.crowdLow, indoors.crowdHigh]).toEqual([Math.min(city.crowdLow, 4), Math.min(city.crowdHigh, 6)]);
    expect(WORLD_LIMITS.people).toEqual({ exterior: { low: 6, high: 10 }, interior: { low: 4, high: 6 } });
  });

  test("[R-WORLD-011] given every built place in each mode, when its crowd is sampled as the world samples it, then it never shows more than its scope allows; the party keeps its own guests and its dancers, ten in all", () => {
    const date = localDate(new Date(2026, 9, 8));
    for (const { file } of builtPlaces()) {
      const entry = content.place[file.place as Id<"place">];
      if (entry === undefined) continue;
      for (const mode of ["low", "high"] as const) {
        const shown = sampleCrowd(entry, poolOf(file.people.sample), date, mode, crowdTuning(city, file.scope, false)).people.length;
        expect(shown, `${file.place} in ${mode}`).toBeLessThanOrEqual(WORLD_LIMITS.people[file.scope][mode]);
      }
      const dressing = stageOf(file).dressings?.[0];
      if (dressing === undefined) continue;
      const dressed = dressPlace(file, [dressing.offer]);
      const guests = crowdSize({ crowd: dressed.crowd ?? entry.crowd }, "high", crowdTuning(city, file.scope, true));
      expect(guests + (stageOf(dressed.file).dancers ?? []).length, `${file.place} dressed for ${dressing.offer}`).toBe(WORLD_LIMITS.party);
    }
  });
});

describe("moving sheets", () => {
  const motion: Motion[] = [
    { kind: "flag", at: [0, 4, 0], size: [1.5, 1], colours: ["white"] },
    { kind: "smoke", at: [0, 0, 0], colours: ["white"] },
    { kind: "hang", at: [0, 3, 0], size: [1, 1], count: 6, colours: ["white"] },
    { kind: "frond", at: [0, 5, 0], size: [2, 0.5], count: 5, colours: ["white"] },
    { kind: "bunting", at: [0, 3, 0], to: [5, 3, 0], count: 9, colours: ["white"] },
  ];

  test("[R-WORLD-011] given a place with three moving sheets, when it is built in high mode, then only the cheapest stays, and in low mode none; smoke and bunting stay in both", () => {
    const high = limitMotion(motion, "high");
    expect(sheetsIn(high)).toHaveLength(1);
    expect(sheetsIn(high)[0]?.kind).toBe("flag");
    expect(Math.min(...sheetsIn(motion).map(sheetCost))).toBe(sheetCost(sheetsIn(high)[0] ?? motion[0] ?? { kind: "flag" }));
    expect(high.filter((entry) => !SHEETS.has(entry.kind))).toEqual([motion[1], motion[4]]);
    const low = limitMotion(motion, "low");
    expect(sheetsIn(low)).toEqual([]);
    expect(low).toEqual([motion[1], motion[4]]);
  });

  test("[R-WORLD-011] given every built place, when it is built in each mode, then it draws at most one moving sheet in high and none in low", () => {
    for (const { file } of builtPlaces()) {
      const stage = stageOf(file);
      expect(sheetsIn(limitMotion(stage.motion, "high")).length, `${file.place}`).toBeLessThanOrEqual(WORLD_LIMITS.sheets.high);
      expect(sheetsIn(limitMotion(stage.motion, "low")), `${file.place}`).toEqual([]);
    }
  });
});
