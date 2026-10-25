// The ways to learn tech at the hub's long desk (activity:paid-tech-courses, activity:free-path-keeps-a-streak): the free path, the short
// course, the diploma, the bootcamp and the internship open from the desk where the day's class is found, and the hub stages each.
import { describe, expect, test } from "vitest";

import placeFile from "../../../../public/assets/places/yaba-hub/place.json";
import { staged } from "./place.testing";

const STUDIES = ["activity.learn-free", "activity.online-course", "activity.tech-diploma", "activity.bootcamp", "activity.free-internship"];
const { stage, entry } = staged(placeFile, "place.yaba");

describe("the study paths at the hub's desk", () => {
  test("[activity:paid-tech-courses] [activity:free-path-keeps-a-streak] given the hub, when its desk's acts are read, then every study path opens from the act that holds the day's class, and the hub stages each", () => {
    const desk = stage.things?.find((thing) => thing.id === "desk");
    const learn = desk?.acts.find((act) => act.stages === "activity.learn-tech");
    for (const study of STUDIES) {
      expect(learn?.more ?? []).toContain(study);
      expect(entry.stages).toContain(study);
    }
  });
});
