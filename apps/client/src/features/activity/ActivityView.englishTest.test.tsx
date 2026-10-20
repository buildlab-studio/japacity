// The sit-the-test sheet (world:one-action-one-sheet): the chance of the band the
// route needs before ₦285,500 is paid, and on a long shot the advice to study first with the study act
// on the same sheet.
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { englishOf, ENGLISH_TEST, STUDY_ENGLISH, testChance } from "../../shared/words/englishTest";
import { nameOf } from "../../shared/words/text";
import { ActivityPicker } from "./ActivityView";

function graduateWith(english: number) {
  const game = newGame("scenario.graduate");
  return viewAfter(game, [
    { type: "quality/add", quality: "quality.english", amount: english - englishOf(game.view()) },
    { type: "document/grant", document: "document.passport" },
  ]);
}

describe("the sit-the-test sheet", () => {
  test("[world:one-action-one-sheet] given the graduate's English a long shot from 6.0, when the test's sheet opens from the desk, then it says the chance and to study first, and the study act is on the same sheet after the test", async () => {
    const view = graduateWith(40);
    expect(view.activities.find((option) => option.id === ENGLISH_TEST)?.allowed).toBe(true);
    await renderWithView(<ActivityPicker only={[ENGLISH_TEST]} />, view);
    const chance = testChance(view);
    expect(chance.band).toBe("long");
    expect(screen.getByText(chance.words)).toBeDefined();
    expect(screen.getByText("Study first: a month of study lifts the chance.")).toBeDefined();
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([nameOf(ENGLISH_TEST), nameOf(STUDY_ENGLISH)]);
  });

  test("[world:one-action-one-sheet] given the graduate's English likely to reach 6.0, when the test's sheet opens, then it says so and holds the test alone", async () => {
    const view = graduateWith(75);
    await renderWithView(<ActivityPicker only={[ENGLISH_TEST]} />, view);
    expect(screen.getByText("Band 6.0 this sitting: likely.")).toBeDefined();
    expect(screen.queryByText("Study first: a month of study lifts the chance.")).toBeNull();
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([nameOf(ENGLISH_TEST)]);
  });
});
