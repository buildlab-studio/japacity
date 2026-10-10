// Cooking, fetching water and rest at the tap (docs/rules/world.md R-WORLD-005, R-WORLD-029; text.md R-TEXT-008;
// obligation.md R-OBLIGATION-014): the scene shows the act, so the tap tells no line; the
// thing's label says it is planned ("Resting" on the bed), and the Month sheet and the results carry what it counts.
import { describe, expect, test } from "vitest";

import parlourFile from "../../../public/assets/places/family-house-parlour/place.json";
import { say } from "../../shared/words/text";
import { doActLine, plannedMarks } from "./actLines";
import { type PlaceFile, stageOf } from "./placeFile";
import { thingsOf } from "./things";

const COOK = "activity.cook-at-home";
const WATER = "activity.fetch-water";
const REST = "activity.rest";

const things = thingsOf(stageOf(parlourFile as unknown as PlaceFile));

describe("the room's basics at the tap", () => {
  test("[R-WORLD-005] [R-TEXT-008] given the parlour, when cooking, water and rest are planned at the tap, then no line is told and each thing's label carries its state", () => {
    expect(doActLine(true)).toBeNull();
    const marks = plannedMarks(things, new Set([COOK, WATER, REST]));
    expect(marks.cooking).toBe(say("ui.world.thing.planned"));
    expect(marks.drum).toBe(say("ui.world.thing.planned"));
    expect(marks.bed).toBe(say("ui.world.thing.resting"));
  });

  test("[R-WORLD-005] given nothing planned, when the labels are read, then none carries a state", () => {
    expect(plannedMarks(things, new Set())).toEqual({});
  });

  test("[R-WORLD-005] given the month's free time all planned, when cooking is tapped, then the corner tells it is full", () => {
    expect(doActLine(false)).toEqual({ kind: "tell", words: say("ui.world.full") });
  });
});
