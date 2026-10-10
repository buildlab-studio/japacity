// Where the waiting months' acts are staged (docs/rules/activity.md R-ACTIVITY-013, world.md R-WORLD-005): the
// hub's desks for open source and the talk, its meetup corner's screen for the talk itself, the routes sheet
// for a master's at home, the board for being noticed, the Inverter Room's laptops for the posts, the clinic's
// notice for the certification and its chairs for the exam. Each opens from an act of a thing, at most two a thing.
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import clinicFile from "../../../../public/assets/places/tb-clinic/place.json";
import hubFile from "../../../../public/assets/places/yaba-hub/place.json";
import roomFile from "../../../../public/assets/places/inverter-room/place.json";
import { say } from "../../../shared/words/text";
import { plannedMarks } from "../actLines";
import { sceneWords } from "../scene.words";
import { stagedNow, thingsNow } from "../things";
import { staged } from "./placeTesting";

const CASES: { raw: unknown; place: Id<"place">; thing: string; act: string; entries: string[] }[] = [
  { raw: hubFile, place: "place.yaba", thing: "desk", act: "learn", entries: ["activity.open-source", "activity.conference-talk"] },
  { raw: hubFile, place: "place.yaba", thing: "desk", act: "routes", entries: ["activity.masters-at-home"] },
  { raw: hubFile, place: "place.yaba", thing: "jobs", act: "jobs", entries: ["activity.be-noticed"] },
  { raw: hubFile, place: "place.yaba", thing: "meetup", act: "talk", entries: ["setpiece.conference-talk"] },
  { raw: roomFile, place: "place.yaba-hub", thing: "laptops", act: "post", entries: ["activity.tech-posts"] },
  { raw: clinicFile, place: "place.tb-clinic", thing: "jobs-notice", act: "certify", entries: ["activity.nurse-certification"] },
  { raw: clinicFile, place: "place.tb-clinic", thing: "chairs", act: "exam", entries: ["setpiece.nurse-exam"] },
];

describe("the waiting months' acts on their things", () => {
  test("[R-ACTIVITY-013] [R-WORLD-005] given each act's place, when its things are read, then the place stages it in content, one act of one thing lists it, the thing offers at most two acts and every name resolves", () => {
    for (const { raw, place, thing, act, entries } of CASES) {
      const { stage, entry } = staged(raw, place);
      const found = stage.things?.find((candidate) => candidate.id === thing);
      if (found === undefined) throw new Error(`${place} has no ${thing}`);
      expect(found.acts.length, `${place} ${thing}`).toBeLessThanOrEqual(2);
      const listing = found.acts.find((candidate) => candidate.id === act);
      expect(sceneWords(found.label), `${thing}'s name`).not.toBe(found.label);
      expect(sceneWords(listing?.label ?? ""), `${act}'s label`).not.toBe(listing?.label);
      for (const id of entries) {
        expect(entry.stages, `${place} stages ${id}`).toContain(id);
        expect([listing?.stages, ...(listing?.more ?? [])], `${thing} ${act} lists ${id}`).toContain(id);
      }
    }
  });

  test("[R-ACTIVITY-013] [R-WORLD-005] given the posts offered, when the laptops' act is read for now, then it happens at once with the character seated and no line, its label saying planned, and with the posts not offered the laptops offer nothing", () => {
    const { stage, entry } = staged(roomFile, "place.yaba-hub");
    const laptops = stage.things?.find((candidate) => candidate.id === "laptops");
    if (laptops === undefined) throw new Error("The room has no laptops");
    const post = laptops.acts[0];
    expect(post?.kind).toBe("do");
    expect(post?.pose).toBe("sit");
    // The seat shows the act, so it says no line; the laptops' label says it is planned (R-WORLD-005, R-TEXT-008).
    expect(sceneWords(`${post?.label ?? ""}.done`)).toBe(`${post?.label ?? ""}.done`);
    expect(plannedMarks([laptops], new Set(["activity.tech-posts"]))).toEqual({ laptops: say("ui.world.thing.planned") });
    const offered = thingsNow([laptops], stagedNow(new Set(["activity.tech-posts"]), new Set(entry.stages), new Set(), null));
    expect(offered[0]?.acts.map((act) => act.stages)).toEqual(["activity.tech-posts"]);
    expect(thingsNow([laptops], stagedNow(new Set(), new Set(entry.stages), new Set(), null))).toEqual([]);
  });

  test("[R-ACTIVITY-013] [R-WORLD-006] given the exam open, when the clinic's chairs are read for now, then they offer the exam's sheet beside the seat; with no exam open, only the seat", () => {
    const { stage, entry } = staged(clinicFile, "place.tb-clinic");
    const chairs = stage.things?.find((candidate) => candidate.id === "chairs");
    if (chairs === undefined) throw new Error("The clinic has no chairs");
    const open = thingsNow([chairs], stagedNow(new Set(), new Set(entry.stages), new Set(), "setpiece.nurse-exam"));
    expect(open[0]?.acts.map((act) => act.id)).toEqual(["sit", "exam"]);
    const shut = thingsNow([chairs], stagedNow(new Set(), new Set(entry.stages), new Set(), null));
    expect(shut[0]?.acts.map((act) => act.id)).toEqual(["sit"]);
  });
});
