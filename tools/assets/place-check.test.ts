import { readFileSync } from "node:fs";
import { join } from "node:path";

import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { crowdSize } from "../../apps/client/src/features/city/crowd";
import type { Budgets } from "./check-assets";
import { defaultPaths } from "./check-assets";
import { CHEAP_PHONE, CHECK_OWN, checkDrawn, checkMotion, type Measure, median, type PlaceMeasure, runOf, stagedPlaces, summarise } from "./place-check";

const ROOT = join(import.meta.dirname, "..", "..");
const budgets = JSON.parse(readFileSync(join(ROOT, "assets-src", "budgets.json"), "utf8")) as Budgets;
const still: Measure = { drawCalls: 40, triangles: 40000, scriptUs: 10, frameMs: 30 };
const measureOf = (moving: Partial<Measure>, mode: "low" | "high" = "high"): PlaceMeasure => ({ place: "place.x", mode, still, moving: { ...still, ...moving } });

describe("the place check", () => {
  test("[R-CITY-027] given a place still and moving, when motion adds draw calls, then the budget's extra passes and one more fails", () => {
    const { extraDrawCalls } = budgets.motion;
    expect(checkMotion(measureOf({ drawCalls: still.drawCalls + extraDrawCalls }), budgets)).toEqual([]);
    expect(checkMotion(measureOf({ drawCalls: still.drawCalls + extraDrawCalls + 1 }), budgets)).toEqual([`R-CITY-027: place.x in high mode: motion adds ${String(extraDrawCalls + 1)} draw calls, over ${String(extraDrawCalls)}`]);
  });

  test("[R-CITY-027] given a place still and moving, when motion adds script a frame, then the budget's microseconds pass and a microsecond more fails", () => {
    const { scriptUs } = budgets.motion;
    expect(checkMotion(measureOf({ scriptUs: still.scriptUs + scriptUs }), budgets)).toEqual([]);
    expect(checkMotion(measureOf({ scriptUs: still.scriptUs + scriptUs + 1 }), budgets)[0]).toMatch(/^R-CITY-027: place.x in high mode: motion adds \d+ microseconds of script a frame, over/);
  });

  test("[R-CITY-027] given a run's frames, when they are summed up, then draw calls and triangles are the heaviest frame's and script the median frame's, so one pause does not count", () => {
    const frame = (drawCalls: number, scriptUs: number) => ({ drawCalls, triangles: drawCalls * 1000, scriptUs, frameMs: 20 });
    expect(summarise([frame(40, 100), frame(42, 90000), frame(41, 110)])).toEqual({ drawCalls: 42, triangles: 42000, scriptUs: 110, frameMs: 20 });
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  test("[R-CITY-038] given the hub drawn on the cheap phone profile, when its rows are read, then its low mode is held to the first load and its high mode to the exterior row, at their edges", () => {
    const hub = { hub: true, scope: "exterior" as const };
    const { firstLoad, exterior } = budgets.place;
    expect(checkDrawn(measureOf({ drawCalls: firstLoad.drawCalls, triangles: firstLoad.triangles }, "low"), hub, budgets)).toEqual([]);
    expect(checkDrawn(measureOf({ drawCalls: firstLoad.drawCalls + 1, triangles: firstLoad.triangles + 1 }, "low"), hub, budgets)).toHaveLength(2);
    expect(checkDrawn(measureOf({ drawCalls: exterior.drawCalls, triangles: exterior.triangles }, "high"), hub, budgets)).toEqual([]);
    expect(checkDrawn(measureOf({ drawCalls: exterior.drawCalls + 1 }, "high"), hub, budgets)).toEqual([`R-CITY-038: place.x draws ${String(exterior.drawCalls + 1)} draw calls in high mode on the cheap phone profile, over ${String(exterior.drawCalls)}`]);
  });

  test("[R-CITY-028] given a staged place, when the check builds its runs, then each mode has its crowd on the cheap phone, low on coarse meshes without shadows and high on fine ones, and still differs from moving only in the motion", () => {
    const [file] = stagedPlaces(defaultPaths(ROOT)).filter((place) => place.hub);
    if (file === undefined) throw new Error("No hub is staged");
    const entry = content.place[file.place as keyof typeof content.place];
    if (entry === undefined) throw new Error(`${file.place} is not in the content`);
    for (const mode of ["low", "high"] as const) {
      const run = runOf(file, mode, true, {});
      expect(run.people).toHaveLength(crowdSize(entry, mode, content.tuning.city));
      expect(run.people.map((shown) => shown.person.file)).not.toContain(CHECK_OWN);
      expect(run.settings.mesh).toBe(mode === "low" ? "coarse" : "fine");
      expect(run.settings.pixelRatio).toBe(mode === "low" ? 1 : Math.min(CHEAP_PHONE.deviceScaleFactor, content.tuning.city.maxPixelRatio));
      expect(runOf(file, mode, false, {})).toEqual({ ...run, moving: false });
    }
    expect([CHEAP_PHONE.width, CHEAP_PHONE.height, CHEAP_PHONE.deviceScaleFactor, CHEAP_PHONE.slowdown]).toEqual([360, 640, 2, 6]);
  });
});
