// The room abroad (docs/rules/world.md R-WORLD-003, R-WORLD-005): the phone by the bed calls home and
// sends money home, so the landing's first request from home has a thing to do it in the room.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/the-room/place.json";
import { abroadView } from "../../../shared/testing/fixtures";
import { type PlaceFile, stageOf } from "../placeFile";
import { sceneWords } from "../scene.words";
import { stagedNow, thingsNow } from "../things";

const stage = stageOf(raw as unknown as PlaceFile);
const entry = content.place["place.the-room"];

describe("the room abroad", () => {
  test("[R-WORLD-005] [R-WORLD-003] given the phone by the bed, when its acts are read, then it calls home and sends money home, both staged in the room and both open to Ada just landed", () => {
    const phone = (stage.things ?? []).find((thing) => thing.id === "phone");
    expect(phone?.acts.map((act) => [act.kind, act.stages, sceneWords(act.label)])).toEqual([
      ["sheet", "activity.call-home", "Call home"],
      ["sheet", "activity.send-money", "Send money home"],
    ]);
    const staged = new Set<string>(entry?.stages ?? []);
    const view = abroadView();
    const offered = new Set(view.activities.filter((option) => option.allowed).map((option) => option.id));
    const now = thingsNow(stage.things ?? [], stagedNow(offered, staged, new Set(), null));
    expect(now.find((thing) => thing.id === "phone")?.acts.map((act) => act.stages)).toEqual(["activity.call-home", "activity.send-money"]);
  });
});
