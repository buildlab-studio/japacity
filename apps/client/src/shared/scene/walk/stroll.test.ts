import { join } from "node:path";

import { type Footprint, isFootprint } from "@japacity/assets";
import { describe, expect, test } from "vitest";

import { measureFile } from "../../../../../../tools/assets/assets-check";
import hubFile from "../../../../public/assets/places/ojuelegba/place.json";
import type { PlaceFile, Stage } from "../placeFile";
import { ARRIVED, WALK_SPEED } from "../walk";
import { groundAt, HARD, routeMap } from "./map";
import { advanceStrolls, FIRST_MAX, IDLE_MIN, type Strolls, strollsOf, turnToward } from "./stroll";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..", "..", "..");
const PATHS = { root: ROOT, source: join(ROOT, "assets-src"), public: join(ROOT, "apps", "client", "public", "assets"), dist: "" };
const hub = (hubFile as unknown as PlaceFile).stage as Stage;
const footprints = new Map<string, Footprint>();
for (const model of hub.models) {
  const { extras } = await measureFile(PATHS, model.file);
  if (isFootprint(extras.footprint)) footprints.set(model.file, extras.footprint);
}
const map = routeMap(hub, (file) => footprints.get(file) ?? null);
const kept = new Set<number>([...Object.values(hub.prefer ?? {}).flat(), ...(hub.acts ?? []).map((act) => act.spot)]);
/** The high mode's twelve, each at the spot of their slot. */
const placed = Array.from({ length: 12 }, (_, slot) => ({ slot, index: slot }));
const STEP = 1 / 30;

interface Run {
  strolls: Strolls;
  /** Each frame: every stroller's slot, spot, place and whether they are walking. */
  frames: { slot: number; spot: number; x: number; z: number; walking: boolean }[][];
}

function run(seconds: number, seed = "place.ojuelegba"): Run {
  const strolls = strollsOf(seed, hub.people, placed, kept, map);
  const frames: Run["frames"] = [];
  for (let time = 0; time < seconds; time += STEP) {
    advanceStrolls(strolls, map, time, STEP);
    frames.push(strolls.strollers.map(({ slot, spot, walker }) => ({ slot, spot, x: walker.x, z: walker.z, walking: walker.target !== null })));
  }
  return { strolls, frames };
}

const tenMinutes = run(600);

describe("people strolling between spots", () => {
  test("[city:players-shown-present-not-tracked] given the hub's crowd, when strolling begins, then those at spots kept for a role or an act stay and everyone else may stroll", () => {
    const { strolls } = tenMinutes;
    expect(strolls.strollers.length).toBeGreaterThan(0);
    for (const stroller of strolls.strollers) expect(kept.has(placed[stroller.slot]?.index ?? -1)).toBe(false);
    for (const index of strolls.open) expect(kept.has(index)).toBe(false);
  });

  test("[city:players-shown-present-not-tracked] given ten minutes of the hub's clock, when the crowd strolls, then no two ever hold one spot and no one ever holds a kept spot", () => {
    for (const frame of tenMinutes.frames) {
      const spots = frame.map((person) => person.spot);
      expect(new Set(spots).size).toBe(spots.length);
      for (const spot of spots) expect(kept.has(spot)).toBe(false);
    }
  });

  test("[city:players-shown-present-not-tracked] given ten minutes of the hub's clock, when the crowd strolls, then everyone strolls now and then, after first standing at their spot, and idles at each spot at least the shortest idle", () => {
    const { frames } = tenMinutes;
    const slots = frames[0]?.map((person) => person.slot) ?? [];
    for (const [column, slot] of slots.entries()) {
      const walking = frames.map((frame) => frame[column]?.walking ?? false);
      expect(walking.indexOf(true), `slot ${String(slot)} strolls`).toBeGreaterThan(0);
      expect(walking.indexOf(true) * STEP).toBeLessThanOrEqual(FIRST_MAX + STEP);
      // Every idle between two strolls, in seconds, after the first stroll.
      const idles: number[] = [];
      let stood = 0;
      let strolled = false;
      for (let frame = 1; frame < walking.length; frame += 1) {
        if (walking[frame] === false) stood += 1;
        if (walking[frame] === true && walking[frame - 1] === false) {
          if (strolled) idles.push(stood * STEP);
          strolled = true;
          stood = 0;
        }
      }
      expect(idles.filter((idle) => idle < IDLE_MIN - STEP)).toEqual([]);
    }
  });

  test("[city:players-shown-present-not-tracked] given ten minutes of the hub's clock, when the crowd strolls, then everyone walks at walking pace and never through a model or off the walkable ground", () => {
    const { frames } = tenMinutes;
    for (let frame = 1; frame < frames.length; frame += 1) {
      for (const [column, person] of (frames[frame] ?? []).entries()) {
        const before = frames[frame - 1]?.[column] ?? person;
        // A waypoint closer than ARRIVED is stepped onto at once, as the player's own walk does.
        expect(Math.hypot(person.x - before.x, person.z - before.z)).toBeLessThanOrEqual(WALK_SPEED * STEP + ARRIVED);
        expect(groundAt(map, person.x, person.z)).not.toBe(HARD);
      }
    }
  });

  test("[city:players-shown-present-not-tracked] given the same place and clock on two screens, when the crowd strolls, then both show the same walk, and another place walks its people another way", () => {
    const again = run(120);
    expect(again.frames).toEqual(tenMinutes.frames.slice(0, again.frames.length));
    const elsewhere = run(120, "place.bode-thomas");
    expect(elsewhere.frames).not.toEqual(again.frames);
  });

  test("[city:players-shown-present-not-tracked] given a person arriving at a spot, when they turn to look the way it looks, then they turn the short way and stop there", () => {
    expect(turnToward(0, 1, 0.3)).toBeCloseTo(0.3);
    expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1);
    expect(turnToward(1, 1.1, 0.3)).toBe(1.1);
  });
});
