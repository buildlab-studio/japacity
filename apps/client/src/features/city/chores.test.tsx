// Cooking, fetching water and lying down at the tap (docs/rules/world.md R-WORLD-005, R-WORLD-029; text.md R-TEXT-008;
// obligation.md R-OBLIGATION-014): each is done at once and the scene shows it, so the tap tells
// no line: the pot steams, the drum fills, the figure lies down. A month-act started at a thing carries on, and its name
// says "Ongoing" whenever it shows.
import { describe, expect, test } from "vitest";

import compoundFile from "../../../public/assets/places/home-room-house/place.json";
import parlourFile from "../../../public/assets/places/home-family-house/place.json";
import { engineView, newGame } from "../../shared/testing/fixtures";
import { answersNow, nowActsIn } from "../../shared/words/acts";
import { say } from "../../shared/words/text";
import { actsOffered } from "./acts";
import { doActLine, plainActLine, plannedMarks } from "./actLines";
import { type PlaceFile, showPlanned, stageOf } from "./placeFile";
import { thingsOf } from "./things";

const COOK = "activity.cook-at-home";
const WATER = "activity.fetch-water";
const FAMILY = "activity.family-time";

const parlour = parlourFile as unknown as PlaceFile;
const things = thingsOf(stageOf(parlour));

describe("the room's basics at the tap", () => {
  test("[R-OBLIGATION-014] [R-ACTIVITY-015] [R-WORLD-005] given the parlour, when cooking and water are done, then each answers now and stays at its thing for another time, and the scene shows it: the pot steams and the drum is full", () => {
    expect(answersNow(COOK)).toBe(true);
    expect(answersNow(WATER)).toBe(true);
    const game = newGame("scenario.ada");
    const answered = [...game.accept({ type: "activity/now", activity: COOK, param: null }).lines, ...game.accept({ type: "activity/now", activity: WATER, param: null }).lines];
    // Decision 0012 (R-ACTIVITY-019): a meal and the water repeat within the month, so each stays at its thing for another time.
    const offered = actsOffered(game.view());
    expect(offered).toContain(COOK);
    expect(offered).toContain(WATER);
    // Never done for the month, they are seen on their things by the month's own answers.
    expect(game.view().activities.filter((option) => option.id === COOK || option.id === WATER).every((option) => !option.done)).toBe(true);
    expect(nowActsIn(answered)).toEqual([COOK, WATER]);
    const shown = stageOf(showPlanned(parlour, nowActsIn(answered)));
    expect(shown.motion.length).toBeGreaterThan(stageOf(parlour).motion.length);
    expect(shown.models.length).toBeGreaterThan(stageOf(parlour).models.length);
  });

  test("[R-WORLD-005] [R-TEXT-008] [R-TURN-006] given the bed and the sofa, when Lie down lands, then no line is told: the figure lies down, and no thing's act plans rest", () => {
    for (const id of ["mattress", "sofa"]) {
      const thing = things.find((candidate) => candidate.id === id);
      // The bed's Lie down stands in for its nap while no nap can be had (decision 0012, R-ACTIVITY-019).
      const lie = thing?.acts.flatMap((act) => [act, ...(act.otherwise === undefined ? [] : [act.otherwise])]).find((act) => act.id === "lie");
      if (thing === undefined || lie === undefined) throw new Error(`No Lie down on the ${id}`);
      expect(lie).toMatchObject({ kind: "plain", pose: "lie" });
      expect(plainActLine(thing, lie)).toBeNull();
    }
    expect(things.flatMap((thing) => thing.acts).some((act) => act.stages === "activity.rest")).toBe(false);
    expect(actsOffered(engineView("scenario.ada"))).not.toContain("activity.rest");
  });

  test("[R-WORLD-005] [R-WORLD-007] given time with family started at Mama, when the names are read, then hers says Ongoing; with nothing started none carries a state", () => {
    expect(plannedMarks(things, new Set([FAMILY]))).toEqual({ mama: say("ui.world.thing.planned") });
    expect(say("ui.world.thing.planned")).toBe("Ongoing");
    expect(plannedMarks(things, new Set())).toEqual({});
  });

  test("[R-WORLD-005] given the month's free time all used, when a month-act is tapped, then the corner tells it is full; one taken tells no line", () => {
    expect(doActLine(true)).toBeNull();
    expect(doActLine(false)).toEqual({ kind: "tell", words: say("ui.world.full") });
  });

  test("[R-OBLIGATION-014] [R-TEXT-008] given the room in a compound, when the drum is filled from the yard's tap, then it answers now, no money comes off, and the drum shows full", () => {
    const compound = compoundFile as unknown as PlaceFile;
    expect(answersNow("activity.fill-drum")).toBe(true);
    const shown = stageOf(showPlanned(compound, ["activity.fill-drum"]));
    expect(shown.models.length + shown.motion.length).toBeGreaterThanOrEqual(stageOf(compound).models.length + stageOf(compound).motion.length);
  });
});
