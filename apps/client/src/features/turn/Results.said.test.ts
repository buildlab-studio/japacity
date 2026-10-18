// What came of an answer, on the results (world:month-end-results-sheet), so a recruiter's take-home task taken is
// never left without a line of what came of it. An answer whose choice moves a quality
// is told in its offer's own words among the month's story. Real content, the offer opened and answered through step.
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { newGame, openOffer } from "../../shared/testing/fixtures";
import { words } from "../../shared/words/text";
import { storyLines, toldOnResults } from "./month.results";

describe("the recruiter's task on the results", () => {
  test("[world:month-end-results-sheet] given the recruiter's take-home task done, when the month ends, then the results tell what came of it in its own words", () => {
    const game = newGame("scenario.zainab");
    const offer = openOffer(game, "offer.recruiter-message");
    const answered = game.accept({ type: "offer/choose", offer: offer.id, choice: "do-it" });
    game.endTurn();
    const story = storyLines([...answered.lines, ...(game.view().report?.lines ?? [])]).map((line) => {
      const told = toldOnResults(line, game.view());
      return words(told.key, told.params);
    });
    expect(story).toContain(text["offer.recruiter-message.said.do-it"]);
  });
});
