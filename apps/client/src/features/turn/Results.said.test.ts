// What came of an answer (world:month-end-results-sheet), so a recruiter's take-home task taken is never left without a
// line of what came of it. An answer whose choice moves a quality is told in its offer's own words as it is answered (the
// corner tells it then) and kept in News; the month's close does not tell it again. Real content, the offer opened and
// answered through step.
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { newGame, openOffer } from "../../shared/testing/fixtures";
import { isSaid, tidyLines } from "../../shared/words/lines";
import { words } from "../../shared/words/text";
import { newsLines } from "../../shared/words/told";
import { storyLines, toldOnResults } from "./month.results";

describe("the recruiter's task on the results", () => {
  test("[world:month-end-results-sheet] given the recruiter's take-home task done, when the month ends, then what came of it is told once in its own words as it was answered, kept in News, and not told again on the results", () => {
    const game = newGame("scenario.developer");
    const offer = openOffer(game, "offer.recruiter-message");
    const answered = game.accept({ type: "offer/choose", offer: offer.id, choice: "do-it" });
    const said = tidyLines(answered.lines).filter(isSaid);
    expect(said.map((line) => words(line.key, line.params))).toEqual([text["offer.recruiter-message.said.do-it"]]);
    game.endTurn();
    const report = game.view().report?.lines ?? [];
    const story = storyLines([...answered.lines, ...report]).map((line) => {
      const told = toldOnResults(line, game.view());
      return words(told.key, told.params);
    });
    expect(story).not.toContain(text["offer.recruiter-message.said.do-it"]);
    expect(newsLines(answered.lines, report, game.view()).map((line) => words(line.key, line.params))).toContain(text["offer.recruiter-message.said.do-it"]);
  });
});
