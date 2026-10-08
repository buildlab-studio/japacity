import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import hubFile from "../../../../public/assets/places/ojuelegba/place.json";
import { crowdSize } from "../crowd";
import type { PlaceFile } from "../placeFile";
import { type CheckInput, runOf } from "./placeCheck";

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
  test("[R-CITY-028] given the hub on the cheap phone, when the check's page builds each mode, then low draws the coarse grids without shadows and high the fine ones, each with its own crowd and never the player's figure", () => {
    for (const mode of ["low", "high"] as const) {
      const run = runOf(input(mode, true));
      expect(run.settings.mesh).toBe(mode === "low" ? "coarse" : "fine");
      expect(run.settings.shadows).toBe(mode === "high");
      expect(run.settings.pixelRatio).toBe(mode === "low" ? 1 : Math.min(2, city.maxPixelRatio));
      expect(run.people).toHaveLength(crowdSize(hub, mode, city));
      expect(run.people.map((shown) => shown.person.file)).not.toContain(OWN);
    }
  });

  test("[R-CITY-027] given the hub, when it is built still and moving, then the two differ only in the motion, and the same day gives the same crowd", () => {
    const moving = runOf(input("high", true));
    expect(runOf(input("high", false))).toEqual({ ...moving, moving: false });
    expect(runOf(input("high", true)).people).toEqual(moving.people);
  });
});
