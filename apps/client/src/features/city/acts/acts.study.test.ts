// A study held back stays on its thing and says why (activity:study-days-capped, activity:paid-tech-courses): the day's class with this
// month's days taken, or a study while another path is held, is still a thing's act, whose card says so where its button was.
import type { Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { actsOffered } from "./acts";

const CLASS = "activity.learn-tech" as Id<"activity">;
const FREE = "activity.learn-free" as Id<"activity">;

describe("a study held back stays on its thing", () => {
  test("[activity:study-days-capped] given three days of class taken this month, when the things' acts are read, then the day's class still stands", () => {
    const game = newGame("scenario.graduate");
    for (let day = 0; day < 3; day += 1) game.accept({ type: "activity/now", activity: CLASS, param: null });
    const view = game.view();
    expect(view.activities.find((option) => option.id === CLASS)).toMatchObject({ allowed: false, capped: true });
    expect(actsOffered(view)).toContain(CLASS);
  });

  test("[activity:paid-tech-courses] given another study path held, when the things' acts are read, then the free path still stands", () => {
    const view = newGame("scenario.graduate").view();
    const activities = view.activities.map((option) => (option.id === FREE ? { ...option, allowed: false, missing: [], onCourse: true as const } : option));
    expect(actsOffered({ activities })).toContain(FREE);
  });
});
