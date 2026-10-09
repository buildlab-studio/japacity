// The clinic's jobs notice (prologue.md R-PROLOGUE-010): the staff nurse's job is
// on the wall where a nurse from sixteen takes her first step, and only a life the hunt can ask for it sees it.
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/tb-clinic/place.json";
import { newGame, viewAfter } from "../../../shared/testing/fixtures";
import { sceneWords } from "../scene.words";
import { stagedNow, thingSpot, thingsNow } from "../things";
import { onGround, staged } from "./placeTesting";

const { stage, entry } = staged(raw, "place.tb-clinic");
const NURSE_JOB = "activity.job-nurse";

/** What the city offers here, as it reads the view: the allowed activities and the jobs the hunt can ask for. */
function noticeActs(view: PlayerView): string[] {
  const hunt = view.activities.find((option) => option.id === "activity.job-hunt");
  const offered = new Set([...view.activities.filter((option) => option.allowed).map((option) => option.id), ...(hunt?.params ?? [])]);
  const shown = thingsNow(stage.things ?? [], stagedNow(offered, new Set(entry.stages), new Set(), null));
  return (shown.find((thing) => thing.id === "jobs-notice")?.acts ?? []).map((act) => act.stages ?? "");
}

describe("the clinic's jobs notice", () => {
  test("[R-PROLOGUE-010] given a life with the care a staff nurse needs, when the clinic's things are read, then the jobs notice offers the staff nurse's job, standing on the floor by the back wall", () => {
    const view = viewAfter(newGame("scenario.ada"), [{ type: "quality/add", quality: "quality.care", amount: 60 }]);
    expect(noticeActs(view)).toEqual([NURSE_JOB]);
    const notice = (stage.things ?? []).find((thing) => thing.id === "jobs-notice")!;
    expect(sceneWords(notice.label)).toBe("Jobs notice");
    const spot = thingSpot(stage, notice);
    expect(spot !== null && onGround(stage, spot)).toBe(true);
  });

  test("[R-PROLOGUE-010] given a life without that care, when the clinic's things are read, then the notice offers nothing", () => {
    expect(noticeActs(newGame("scenario.ada").view())).toEqual([]);
  });
});
