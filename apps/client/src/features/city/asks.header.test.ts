// The asks sheet's header over the exam (docs/rules/world.md R-WORLD-006): with
// the exam, the fuel ask and an offer waiting, the header read "1 OF 3", and once the other two were answered it read
// "3 OF 3" over the exam's first question. Over a set piece of several questions the count is its own questions.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { applyEffects } from "../../../../../packages/sim/src/route/route.journey";
import { newGame } from "../../shared/testing/fixtures";
import { askHeader } from "./acts";

const EXAM = content.activity["activity.nurse-certification"]?.exam?.setpiece;

describe("the asks sheet's header", () => {
  test("[R-WORLD-006] given the nurse's exam open, its first question asked, when the other asks have been answered, then the header counts the exam's own questions, one of three, never three of three", () => {
    if (EXAM === undefined) throw new Error("The certification has no exam in content.");
    const game = newGame("scenario.ngozi");
    applyEffects(game, [{ type: "setpiece/open", setpiece: EXAM, route: null }]);
    const setpiece = game.view().setpiece;
    expect(setpiece).toMatchObject({ entry: EXAM, asked: 0 });
    expect(setpiece!.total).toBeGreaterThan(1);
    // The sheet opened with three asks; two are answered and the exam is left.
    expect(askHeader({ total: 3, left: 1, index: 0, setpiece })).toEqual({ n: 1, count: setpiece!.total });
    // Over any other ask, the count is the asks: the second of three.
    expect(askHeader({ total: 3, left: 2, index: 0, setpiece: null })).toEqual({ n: 2, count: 3 });
    expect(askHeader({ total: 1, left: 1, index: 0, setpiece: null })).toBeNull();
  });
});
