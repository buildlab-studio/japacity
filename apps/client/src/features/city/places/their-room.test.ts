// Their room (place.their-room; docs/rules/world.md R-WORLD-020, people.md R-PEOPLE-014): one shared room, on the map
// once a bond is courting, where time together is a visit on its chair and nobody is met. Built
// from the room in a compound's shell, the size such a room is. The checks the other rooms pass, read against the
// interior row; and for the two rooms a person is met in, the hub and the family house's parlour, everyone standing at a
// thing stands on walkable ground.
import { type Footprint, isFootprint } from "@japacity/assets";
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import budgets from "../../../../../../assets-src/budgets.json";
import { checkWalkable, placedBoxes, standingProblem } from "../../../../../../tools/assets/footprint-check";
import { checkLimits, SHEET_KINDS, WORLD_LIMITS } from "../../../../../../tools/assets/world-check";
import parlourRaw from "../../../../public/assets/places/family-house-parlour/place.json";
import placeFile from "../../../../public/assets/places/their-room/place.json";
import hubRaw from "../../../../public/assets/places/yaba-hub/place.json";
import { crowdSize } from "../crowd";
import { crowdTuning } from "../limits";
import type { PlaceFile } from "../placeFile";
import { personOfLook } from "../roster";
import { sceneWords } from "../scene.words";
import { thingSpot, thingsNow, thingsOf } from "../things";
import { groundGeometry } from "../world";
import { actEntries } from "./frontageTesting";
import { allPalette, city, instancesOf, measured, rowOf, staged, totalsOf } from "./placeTesting";

const ID = "place.their-room";
const { file, stage, entry } = staged(placeFile, ID);
const crowd = (mode: "low" | "high"): number => crowdSize(entry, mode, crowdTuning(city, "interior", false));
const things = stage.things ?? [];

async function footprintsOf(of: PlaceFile): Promise<Map<string, Footprint>> {
  const found = new Map<string, Footprint>();
  for (const path of new Set((of.stage?.models ?? []).map((model) => model.file))) {
    const footprint = (await measured(path)).extras.footprint;
    if (isFootprint(footprint)) found.set(path, footprint);
  }
  return found;
}

describe("their room's file", () => {
  test("[R-WORLD-020] given their room in content, when its folder is read, then it is its own file for its own entry, a room with no address where nobody stands to be met", () => {
    expect(entry.assets).toBe("their-room");
    expect(stage.standing).toBeUndefined();
    expect(file.place).toBe(ID);
    expect(entry.position).toBeNull();
    expect(file.scope).toBe("interior");
  });

  test("[R-ASSET-007] given the room's shipped files measured as the build check measures them, when it is counted, then both modes fit the interior row and its download fits the row's bytes", async () => {
    const totals = await totalsOf(file);
    for (const mode of ["low", "high"] as const) {
      expect(totals[mode].drawCalls).toBeLessThanOrEqual(rowOf(file).drawCalls);
      expect(totals[mode].triangles).toBeLessThanOrEqual(rowOf(file).triangles);
    }
    expect(totals.bytes).toBeLessThanOrEqual(budgets.place.interior.bytes);
  });

  test("[R-ASSET-007] given the room's file, when its counts are read, then the instances are the copies staged, the crowd is the entry's figure in each mode, the floor is one draw call of the triangles drawn, and every colour is a palette name", () => {
    expect(file.instances).toEqual(instancesOf(stage));
    expect(file.people.low).toBe(crowd("low"));
    expect(file.people.high).toBe(crowd("high"));
    expect(placeFile.groundRoadSky.drawCalls).toBe(1);
    expect(placeFile.groundRoadSky.triangles).toBe(groundGeometry(stage).getAttribute("position").count / 3);
    expect(allPalette(stage)).toBe(true);
  });

  test("[R-WORLD-011] given the room's file, when its limits are read, then it is within the indoor caps with no moving sheet, and its camera is declared", () => {
    expect(checkLimits(file)).toEqual([]);
    expect(file.people.high).toBeLessThanOrEqual(WORLD_LIMITS.people.interior.high);
    expect(stage.motion.filter((motion) => SHEET_KINDS.has(motion.kind))).toEqual([]);
    expect(stage.shot).toBeDefined();
  });

  test("[R-CITY-014] given the room's crowd spots, when the high mode's crowd stands, then there is a spot for everyone on walkable ground clear of every footprint, none where the player starts, and everyone in the sample a person of the city", async () => {
    expect(stage.people.length).toBeGreaterThanOrEqual(crowd("high"));
    expect(checkWalkable(ID, stage, await footprintsOf(file))).toEqual([]);
    const [x, z] = stage.start;
    expect(stage.people.filter(([px, pz]) => Math.hypot(px - x, pz - z) < 0.8)).toEqual([]);
    expect(file.people.sample.filter((path) => personOfLook(path) === null)).toEqual([]);
    expect(file.people.sample.length).toBeGreaterThan(crowd("high"));
  });
});

describe("their room's things", () => {
  test("[R-WORLD-005] given the room's things, when their names and acts are read, then each stands at a copy of a staged model, offers one or two acts, and its name and every act's label resolve", () => {
    const wrong: string[] = [];
    for (const one of things) {
      const copies = stage.models.find((model) => model.file === one.file)?.at.length ?? 0;
      if (one.copy >= copies) wrong.push(`${one.id} stands at no copy`);
      if (thingSpot(stage, one) === null) wrong.push(`${one.id} has no spot`);
      if (one.acts.length < 1 || one.acts.length > 2) wrong.push(`${one.id} offers ${String(one.acts.length)} acts`);
      if (sceneWords(one.label) === one.label) wrong.push(`${one.id} has no name`);
      for (const act of one.acts) if (sceneWords(act.label) === act.label) wrong.push(`${one.id} ${act.id} has no label`);
    }
    expect(wrong).toEqual([]);
    expect(new Set(things.map((one) => one.id)).size).toBe(things.length);
  });

  test("[R-PEOPLE-014] [R-WORLD-005] given what the room stages in content, when its things' acts are read, then the visit opens from the chair, and with nothing offered the door alone stays, so the room is never shown with a dead act", () => {
    expect(entry.stages).toEqual(["activity.see-someone"]);
    expect(actEntries(placeFile, ID)).toEqual(["activity.see-someone"]);
    expect(thingsNow(thingsOf(stage), () => false).map((one) => one.id)).toEqual(["door"]);
  });
});

describe("everyone standing at a thing", () => {
  test("[R-WORLD-020] [R-ASSET-030] given the hub and the family house's parlour, where people are met, when everyone who can stand at a thing stands there, then each stands on walkable ground clear of every footprint, apart from where the player starts, and each thing's own spot is clear too", async () => {
    for (const [id, raw] of [
      ["place.yaba", hubRaw],
      ["place.family-house", parlourRaw],
    ] as const) {
      const room = raw as unknown as PlaceFile;
      const here = room.stage;
      expect(here?.walkable).toBeDefined();
      const boxes = placedBoxes(here?.models ?? [], await footprintsOf(room));
      const walkable = here?.walkable ?? [];
      const standers = here?.standing ?? [];
      expect(standers.length).toBeGreaterThan(0);
      const problems = [
        ...standers.map((one) => [`${id} ${one.thing} ${one.person ?? ""}`, standingProblem(walkable, boxes, one.at[0], one.at[1])] as const),
        ...(here?.things ?? []).filter((one) => one.at !== undefined).map((one) => [`${id} ${one.id}'s spot`, standingProblem(walkable, boxes, one.at?.[0] ?? 0, one.at?.[1] ?? 0)] as const),
      ].filter(([, problem]) => problem !== null);
      expect(problems).toEqual([]);
      const [x, z] = here?.start ?? [0, 0];
      expect(standers.filter((one) => Math.hypot(one.at[0] - x, one.at[1] - z) < 0.8)).toEqual([]);
      expect(standers.filter((one) => content.person[one.person as keyof typeof content.person] === undefined && one.person !== undefined)).toEqual([]);
    }
  });
});
