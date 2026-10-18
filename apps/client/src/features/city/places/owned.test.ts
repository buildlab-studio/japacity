// The market's things in the homes (world:room-things-and-buy-mode, world:things-are-tappable-models,
// world:room-seen-down-its-length): each home's place file gives every thing it may hold a set spot (your corner at the family house; the
// room, the kitchenette and the yard in a home of your own), each spot fitting the floor rule buy mode uses with every
// other thing owned standing too, and the room's budgets held with everything owned in view.
import { type Footprint, isFootprint } from "@japacity/model-kit";
import { content } from "@japacity/content";
import type { HomePlace } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import budgets from "../../../../../../models/budgets.json";
import familyRaw from "../../../../public/assets/places/home-family-house/place.json";
import hostelRaw from "../../../../public/assets/places/home-hostel-house/place.json";
import roomRaw from "../../../../public/assets/places/home-room-house/place.json";
import makokoRaw from "../../../../public/assets/places/makoko/place.json";
import { misfit } from "../scene/arrange";
import { liftable, showOwned } from "../scene/owned";
import { parkCar, type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { measured, totalsOf } from "./place.testing";

interface Home {
  id: HomePlace;
  raw: unknown;
}

const HOMES: readonly Home[] = [
  { id: "place.family-house", raw: familyRaw },
  { id: "place.compound-room", raw: roomRaw },
  { id: "place.hostel-room", raw: hostelRaw },
  { id: "place.makoko", raw: makokoRaw },
];

/** The things a home may hold, the car apart: it stands at the home's car spot (`stage.car`, `parkCar`). */
function heldAt(home: HomePlace): string[] {
  return Object.values(content.thing)
    .filter((entry) => entry.homes.includes(home) && entry.drive !== true)
    .map((entry) => entry.id);
}

async function footprintsOf(files: readonly string[]): Promise<Map<string, Footprint>> {
  const found = new Map<string, Footprint>();
  for (const path of new Set(files)) {
    const footprint = (await measured(path)).extras.footprint;
    if (isFootprint(footprint)) found.set(path, footprint);
  }
  return found;
}

describe("the market's things in the homes", () => {
  test.each(HOMES.map((home) => [home.id, home] as const))("[world:room-things-and-buy-mode] [world:room-seen-down-its-length] given %s, when its set spots are read, then every thing the home may hold has exactly one, and none is for a thing it may not hold", (_id, home) => {
    const spots = stageOf(home.raw as PlaceFile).owned ?? [];
    expect(spots.map((spot) => spot.thing).sort()).toEqual(heldAt(home.id).sort());
  });

  test.each(HOMES.map((home) => [home.id, home] as const))("[world:room-things-and-buy-mode] [world:things-are-tappable-models] given %s with everything it may hold owned, when each thing stands at its set spot, then each fits the floor rule with all the others standing", async (_id, home) => {
    const file = showOwned(home.raw as PlaceFile, heldAt(home.id));
    const stage = stageOf(file);
    const footprints = await footprintsOf(stage.models.map((model) => model.file));
    const problems = liftable(file).flatMap((item) => {
      const why = misfit(stage, item.thing, item.file, item.at, (path) => footprints.get(path) ?? null);
      return why === null ? [] : [`${item.thing}: ${why}`];
    });
    expect(problems).toEqual([]);
  });

  test.each(HOMES.map((home) => [home.id, home] as const))("[world:room-things-and-buy-mode] [world:things-are-tappable-models] given %s, when its owned models are read against its own, then none shares a file with a model the home already stands, so each thing is its own to lift", (_id, home) => {
    const stage = stageOf(home.raw as PlaceFile);
    const own = new Set(stage.models.map((model) => model.file));
    expect((stage.owned ?? []).filter((spot) => own.has(spot.file) && spot.hides !== spot.file).map((spot) => spot.thing)).toEqual([]);
  });

  test.each(HOMES.map((home) => [home.id, home] as const))("[world:room-things-and-buy-mode] [world:room-seen-down-its-length] given %s with everything it may hold owned and the car at its spot, when it is counted as the build check counts it, then it stays inside its scope's budgets", async (_id, home) => {
    const plain = home.raw as PlaceFile;
    const file = parkCar(showOwned(plain, heldAt(home.id)), true);
    const files = new Map<string, number>();
    for (const model of stageOf(file).models) files.set(model.file, Math.max(files.get(model.file) ?? 0, model.at.length));
    const totals = await totalsOf({ ...file, instances: [...files].map(([path, count]) => ({ file: path, count })) });
    const scope = budgets.place[plain.scope];
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(scope.drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(scope.triangles);
    }
  });
});
