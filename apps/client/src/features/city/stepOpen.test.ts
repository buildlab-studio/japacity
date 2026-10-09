// The nudge's Go opens what it names (docs/rules/world.md R-WORLD-003, R-WORLD-006):
// "Apply to schools from the hub" at the hub opens the application's own card, the school chooser, in one
// tap; the desk's chip keeps its list for a player who browses.
import { describe, expect, test } from "vitest";

import raw from "../../../public/assets/places/yaba-hub/place.json";
import { stepThingHere, stepWayOf } from "./nudge";
import { staged } from "./places/placeTesting";
import { stepOpen } from "./stepOpen";

const { stage } = staged(raw, "place.yaba");
const things = stage.things ?? [];
const APPLY = "activity.apply-to-school";
const offerStep = { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: true }, { id: "transcript", met: true }, { id: "english", met: true }, { id: "offer", met: false }], done: [] };

describe("the nudge's Go on the application", () => {
  test("[R-WORLD-003] [R-WORLD-006] given the offer step and the player at the hub, when the nudge is followed, then the application's own card opens, not the desk's chip", () => {
    const way = stepWayOf(offerStep);
    if (way === null) throw new Error("The offer step has no way.");
    const thing = stepThingHere(way, "place.yaba", things);
    expect(thing).toBe("desk");
    expect(stepOpen(way, thing, [APPLY], "place.yaba")).toEqual({ kind: "act", activity: APPLY });
    // The desk itself still lists the application among its routes for a player who browses.
    const desk = things.find((candidate) => candidate.id === "desk");
    expect(desk?.acts.some((act) => act.stages === APPLY || (act.more ?? []).includes(APPLY))).toBe(true);
  });

  test("[R-WORLD-003] given the offer step away from the hub, when the nudge is followed, then the map opens with the hub picked; given the application not offered, the desk's chip opens", () => {
    const way = stepWayOf(offerStep);
    if (way === null) throw new Error("The offer step has no way.");
    expect(stepOpen(way, null, [APPLY], "place.family-house")).toEqual({ kind: "map", stop: "place.yaba" });
    expect(stepOpen(way, "desk", [], "place.yaba")).toEqual({ kind: "thing", thing: "desk" });
  });

  test("[R-WORLD-003] given a step done by ending the month, or a step whose thing stands here with no card of its own, when the nudge is followed, then the Month sheet or the thing opens as before", () => {
    const monthEnd = stepWayOf({ current: "chapter.find-your-feet", items: [{ id: "pay", met: false }], done: [] });
    if (monthEnd === null) throw new Error("No way for the month's end.");
    expect(stepOpen(monthEnd, null, [], "place.yaba")).toEqual({ kind: "month" });
    const jobs = stepWayOf({ current: "chapter.find-your-feet", items: [{ id: "job", met: false }], done: [] });
    if (jobs === null) throw new Error("No way for the job.");
    expect(stepOpen(jobs, "jobs", ["activity.job-hunt"], "place.yaba")).toEqual({ kind: "thing", thing: "jobs" });
    expect(stepOpen(jobs, null, [], "place.yaba")).toEqual({ kind: "map", stop: null });
  });
});
