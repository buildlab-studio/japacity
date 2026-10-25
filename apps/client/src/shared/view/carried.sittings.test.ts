// The chartered exams are studied for eighteen months with a sitting every six (document:trade-papers): unlike an exam of one sitting,
// the study carries on from month to month until it is stopped or the paper is earned (world:month-acts-carry-on).
import type { Id, SlotPick } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { carriedPlan } from "./carried";

const ICAN = "activity.ican-exams" as Id<"activity">;

describe("study for the chartered exams carries on", () => {
  test("[document:trade-papers] [world:month-acts-carry-on] given the graduate studying for the chartered exams, when the month ends, then the study is still in next month's plan", () => {
    const game = newGame("scenario.graduate");
    const plan: SlotPick[] = [{ activity: ICAN, param: null }];
    expect(game.view().activities.find((option) => option.id === ICAN)?.allowed).toBe(true);
    game.endTurn(plan);
    expect(carriedPlan(plan, game.view())).toEqual(plan);
  });
});
