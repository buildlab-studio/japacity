// The nudge's Go opens what it names (docs/rules/world.md R-WORLD-003, R-WORLD-006):
// "Apply to schools from the hub" at the hub opens the application's own card, the school chooser, in one
// tap; the desk's chip keeps its list for a player who browses.
import { describe, expect, test } from "vitest";

import airport from "../../../public/assets/places/arrivals-hall/place.json";
import bank from "../../../public/assets/places/bank-counter/place.json";
import parlour from "../../../public/assets/places/family-house-parlour/place.json";
import testCentre from "../../../public/assets/places/english-test-centre/place.json";
import clinic from "../../../public/assets/places/tb-clinic/place.json";
import visaCentre from "../../../public/assets/places/visa-centre/place.json";
import raw from "../../../public/assets/places/yaba-hub/place.json";
import { say } from "../../shared/words/text";
import { stepThingHere, stepWayOf } from "./nudge";
import { staged } from "./places/placeTesting";
import { nudgeHere, stepOpen } from "./stepOpen";

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

// The smaller notes of the nudge names the place only while the player is elsewhere.

describe("the nudge where the player stands", () => {
  const cases = [
    { chapter: "chapter.find-your-feet", step: "job", file: raw, place: "place.yaba", names: /hub|Yaba/ },
    { chapter: "chapter.build-the-file", step: "passport", file: parlour, place: "place.family-house", names: /home/ },
    { chapter: "chapter.build-the-file", step: "english", file: testCentre, place: "place.english-test-centre", names: /centre/ },
    { chapter: "chapter.build-the-file", step: "offer", file: raw, place: "place.yaba", names: /hub/ },
    { chapter: "chapter.decision-day", step: "deposit", file: bank, place: "place.olokun-office", names: /bank/ },
    { chapter: "chapter.decision-day", step: "tb", file: clinic, place: "place.tb-clinic", names: /clinic/ },
    { chapter: "chapter.decision-day", step: "applied", file: visaCentre, place: "place.visa-centre", names: /visa centre/ },
    { chapter: "chapter.send-off", step: "departed", file: airport, place: "place.airport-lagos", names: /airport/ },
  ] as const;

  test("[R-WORLD-003] given each step whose nudge names a place, when the player stands where its thing is, then the nudge drops the place, in one sentence of at most eight words", () => {
    for (const { chapter, step, file, place, names } of cases) {
      const way = stepWayOf({ current: chapter, items: [{ id: step, met: false }], done: [] });
      if (way === null) throw new Error(`${chapter}.${step} has no way.`);
      const thing = stepThingHere(way, place, staged(file, place).stage.things ?? []);
      expect(thing).not.toBeNull();
      const elsewhere = { key: `${chapter}.item.${step}.nudge` };
      expect(say(elsewhere.key)).toMatch(names);
      const here = nudgeHere(elsewhere, thing);
      expect(here.key).toBe(`${elsewhere.key}.here`);
      const said = say(here.key);
      expect(said).not.toMatch(names);
      expect(said.split(" ").length).toBeLessThanOrEqual(8);
      expect(said.split(/[.!?] /)).toHaveLength(1);
      // Away from it, the nudge keeps the place.
      expect(nudgeHere(elsewhere, null)).toEqual(elsewhere);
    }
  });
});
