// The English test's card after a month of study (world:one-action-one-sheet): it never says "a month of study
// lifts the chance" when a month leaves it a long shot. It says how many months it takes, counted as the simulation
// adds English.
import { slot } from "@japacity/sim/testing";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { englishOf, ENGLISH_TEST, STUDY_ENGLISH, testChance } from "../../shared/words/englishTest";
import { ActivityPicker } from "./ActivityView";
import { studyMonths, studyWords } from "./study";

function gameWith(english: number) {
  const game = newGame("scenario.graduate");
  viewAfter(game, [
    { type: "quality/add", quality: "quality.english", amount: english - englishOf(game.view()) },
    { type: "document/grant", document: "document.passport" },
  ]);
  return game;
}

describe("how long study takes to lift the test's chance", () => {
  test("[world:one-action-one-sheet] given English a long shot that one month of study cannot lift, when the test's card opens, then it says how many months it takes, and after a month of study one fewer", async () => {
    const game = gameWith(30);
    const before = game.view();
    expect(testChance(before).band).toBe("long");
    expect(studyMonths(before)).toBe(3);
    expect(studyWords(before)).toBe("Study first: three months of study lift the chance.");
    await renderWithView(<ActivityPicker only={[ENGLISH_TEST]} />, before);
    expect(screen.getByText("Study first: three months of study lift the chance.")).toBeDefined();
    expect(screen.queryByText("Study first: a month of study lifts the chance.")).toBeNull();
    game.endTurn([slot(STUDY_ENGLISH)]);
    const after = game.view();
    expect(englishOf(after)).toBeGreaterThan(30);
    expect(testChance(after).band).toBe("long");
    expect(studyWords(after)).toBe("Study first: two months of study lift the chance.");
  });

  test("[world:one-action-one-sheet] given English one month of study lifts, when the card opens, then it keeps the one month's words, and the month after it is no longer a long shot", () => {
    const game = gameWith(40);
    expect(studyWords(game.view())).toBe("Study first: a month of study lifts the chance.");
    game.endTurn([slot(STUDY_ENGLISH)]);
    expect(testChance(game.view()).band).not.toBe("long");
    expect(studyWords(game.view())).toBeNull();
  });

  test("[world:one-action-one-sheet] given no English at all, when the card opens, then it says the months it takes and never a promise of one", () => {
    const view = gameWith(0).view();
    const months = studyMonths(view);
    expect(months).not.toBeNull();
    expect(months).toBeGreaterThan(1);
    expect(studyWords(view)).not.toBe("Study first: a month of study lifts the chance.");
  });
});
