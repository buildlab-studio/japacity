// The asks sheet's header over the exam (world:one-action-one-sheet): over a set
// piece the header counts nothing, since the set piece counts its own questions ("Question 1 of 3"), so the exam never
// sits under "1 OF 3" or "3 OF 3". Elsewhere the count is what is left, and one ask left says no count.
import { content } from "@japacity/content";
import { applyEffects } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { askHeader } from "./acts";

const EXAM = content.activity["activity.nurse-certification"]?.exam?.setpiece;

describe("the asks sheet's header", () => {
  test("[world:one-action-one-sheet] given the nurse's exam open, its first question asked, when the asks are counted, then the header counts nothing over it, never three of three, since the exam counts its own questions", () => {
    if (EXAM === undefined) throw new Error("The certification has no exam in content.");
    const game = newGame("scenario.ngozi");
    applyEffects(game, [{ type: "setpiece/open", setpiece: EXAM, route: null }]);
    const setpiece = game.view().setpiece;
    expect(setpiece).toMatchObject({ entry: EXAM, asked: 0 });
    expect(setpiece!.total).toBeGreaterThan(1);
    // The sheet opened with three asks; over the exam, with the others waiting or answered, the header holds no count.
    expect(askHeader({ left: 1, index: 0, setpiece })).toBeNull();
    expect(askHeader({ left: 3, index: 0, setpiece })).toBeNull();
    // Over any other ask, the count is the asks still waiting: two left, the first of them.
    expect(askHeader({ left: 2, index: 0, setpiece: null })).toEqual({ n: 1, count: 2 });
    expect(askHeader({ left: 1, index: 0, setpiece: null })).toBeNull();
  });

  test("[world:one-action-one-sheet] given four asks waiting, when three are answered one by one, then the header counts what is left, 1 of 4, 1 of 3, 1 of 2, and none over the last one, never 4 of 4 with one ask left", () => {
    expect([4, 3, 2, 1].map((left) => askHeader({ left, index: 0, setpiece: null }))).toEqual([{ n: 1, count: 4 }, { n: 1, count: 3 }, { n: 1, count: 2 }, null]);
    // Stepping on to the next ask still waiting counts within what is left.
    expect(askHeader({ left: 3, index: 2, setpiece: null })).toEqual({ n: 3, count: 3 });
    expect(askHeader({ left: 2, index: 5, setpiece: null })).toEqual({ n: 2, count: 2 });
  });
});
