import { join } from "node:path";

import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Budgets } from "./assets-check";
import { defaultPaths } from "./assets-check";
import { CHEAP_PHONE, CHECK_OWN, checkDrawn, checkMotion, describeMeasure, inputOf, type Measure, median, type PlaceMeasure, ROUTE_TAPS, routeCost, stagedPlaces, summarise } from "./place-check";
import { readJson, REPO_ROOT } from "../repo";

const budgets = readJson<Budgets>(join(REPO_ROOT, "assets-src", "budgets.json"));
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

  test("[R-CITY-027] given a run's frames and timed blocks, when they are summed up, then draw calls and triangles are the heaviest frame's, time the median frame's and script the fastest block's", () => {
    const frame = (drawCalls: number, frameMs: number) => ({ drawCalls, triangles: drawCalls * 1000, scriptUs: 0, frameMs });
    expect(summarise([frame(40, 20), frame(42, 900), frame(41, 30)], [300, 120, 900])).toEqual({ drawCalls: 42, triangles: 42000, scriptUs: 120, frameMs: 30 });
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

  test("[R-CITY-038] given a staged place, when the check hands it to the page, then it goes as plain data on the cheap phone profile, still and moving alike but for the motion", () => {
    const [file] = stagedPlaces(defaultPaths(REPO_ROOT)).filter((place) => place.hub);
    if (file === undefined) throw new Error("No hub is staged");
    const input = inputOf(file, "high", true, {});
    expect(input.entry).toBe(content.place["place.ojuelegba"]);
    expect(input.device).toEqual({ finePointer: false, width: 360, pixelRatio: 2 });
    expect(input.own).toBe(CHECK_OWN);
    expect(inputOf(file, "high", false, {})).toEqual({ ...input, moving: false });
    expect(JSON.parse(JSON.stringify(input))).toEqual(input);
    expect([CHEAP_PHONE.width, CHEAP_PHONE.height, CHEAP_PHONE.deviceScaleFactor, CHEAP_PHONE.slowdown]).toEqual([360, 640, 2, 6]);
  });

  test("[R-CITY-030] given the milliseconds of a place's taps, when routing's cost is summed up, then the summary gives the map's build and the middle, average and worst of 300 taps", () => {
    expect(ROUTE_TAPS).toBe(300);
    const cost = routeCost({ cells: 1200, mapMs: 0.5, tapsMs: [0.1, 0.1, 0.2, 9.0] });
    expect(cost).toEqual({ cells: 1200, mapMs: 0.5, middleMs: 0.15000000000000002, averageMs: 2.35, worstMs: 9, taps: 4 });
    const line = describeMeasure({ ...measureOf({}, "low"), routes: cost }).split("\n")[1];
    expect(line).toBe("place.x routes: map of 1200 cells built in 0.50 ms; 4 taps middle 0.15 ms, average 2.35 ms, worst 9.00 ms");
    expect(describeMeasure(measureOf({}, "high"))).not.toContain("routes");
  });
});
