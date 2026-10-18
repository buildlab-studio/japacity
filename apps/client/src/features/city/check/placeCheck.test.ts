import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import hubFile from "../../../../public/assets/places/ojuelegba/place.json";
import makokoFile from "../../../../public/assets/places/makoko/place.json";
import { advanceClock, type MotionUniforms } from "../../../shared/three/clock";
import { crowdSize } from "../../../shared/scene/crowd";
import type { PlaceFile } from "../../../shared/scene/placeFile";
import { CHECK_CLOCK, type CheckInput, runOf, startClock, tapsOf } from "./placeCheck";

const hub = content.place["place.ojuelegba"];
if (hub === undefined) throw new Error("The hub is missing from content");
const city = content.tuning.city;
const OWN = "shared/chr/chr_tunde.glb";
const input = (mode: "low" | "high", moving: boolean): CheckInput => ({
  file: hubFile as unknown as PlaceFile,
  entry: hub,
  city,
  date: "2026-10-08",
  own: OWN,
  mode,
  device: { finePointer: false, width: 360, pixelRatio: 2 },
  text: {},
  moving,
});

describe("the place check's runs", () => {
  test("[city:motion-never-turned-off] given the hub on the cheap phone, when the check's page builds each mode, then low draws the coarse grids without shadows and high the fine ones, each with its own crowd and never the player's figure", () => {
    for (const mode of ["low", "high"] as const) {
      const run = runOf(input(mode, true));
      expect(run.settings.mesh).toBe(mode === "low" ? "coarse" : "fine");
      expect(run.settings.shadows).toBe(mode === "high");
      expect(run.settings.pixelRatio).toBe(mode === "low" ? 1 : Math.min(2, city.maxPixelRatio));
      expect(run.people).toHaveLength(crowdSize(hub, mode, city));
      expect(run.people.map((shown) => shown.person.file)).not.toContain(OWN);
    }
  });

  test("[city:no-script-loop-per-sheet] given the clock moved on by the places checked before, when the next place is built, then the clock starts again at the moment every place starts at, whatever the place and the mode", () => {
    const makoko = content.place["place.makoko"];
    if (makoko === undefined) throw new Error("Makoko is missing from content");
    const runs = (["low", "high"] as const).flatMap((mode) => [runOf(input(mode, true)), runOf({ ...input(mode, true), file: makokoFile as unknown as PlaceFile, entry: makoko })]);
    for (const run of runs) {
      const uniforms = { uTime: { value: 0 }, uWind: { value: null } } as unknown as MotionUniforms;
      for (let frame = 0; frame < 900; frame += 1) advanceClock(1 / 30, uniforms);
      expect(uniforms.uTime.value).toBeGreaterThan(29);
      startClock(run, uniforms);
      expect(uniforms.uTime.value).toBe(CHECK_CLOCK);
    }
  });

  test("[city:no-script-loop-per-sheet] given the hub, when it is built still and moving, then the two differ only in the motion, and the same day gives the same crowd", () => {
    const moving = runOf(input("high", true));
    expect(runOf(input("high", false))).toEqual({ ...moving, moving: false });
    expect(runOf(input("high", true)).people).toEqual(moving.people);
  });

  test("[city:tap-to-walk] given the hub's walkable ground, when the check draws its taps, then the same 300 fall every run, over the ground and up to two metres past it", () => {
    const stage = (hubFile as unknown as PlaceFile).stage;
    if (stage === undefined) throw new Error("The hub has no stage");
    const taps = tapsOf(stage, "place.ojuelegba", 300);
    expect(taps).toHaveLength(300);
    expect(tapsOf(stage, "place.ojuelegba", 300)).toEqual(taps);
    const corners = (stage.walkable ?? []).flat();
    const xs = corners.map(([x]) => x);
    const zs = corners.map(([, z]) => z);
    for (const tap of taps) {
      expect(tap.x).toBeGreaterThanOrEqual(Math.min(...xs) - 2);
      expect(tap.x).toBeLessThanOrEqual(Math.max(...xs) + 2);
      expect(tap.z).toBeGreaterThanOrEqual(Math.min(...zs) - 2);
      expect(tap.z).toBeLessThanOrEqual(Math.max(...zs) + 2);
    }
    expect(new Set(taps.map((tap) => `${tap.x.toFixed(1)},${tap.z.toFixed(1)}`)).size).toBeGreaterThan(250);
  });
});
