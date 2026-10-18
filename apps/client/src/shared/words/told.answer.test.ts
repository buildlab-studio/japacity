// An answer in News says what was chosen (world:month-end-results-sheet), never only "Answered: A hospital trust
// offers a nursing post.": the answer is told with the choice, in the choice's own words, where the offer has no
// words of its own for that answer.
import type { ReportLine } from "@japacity/sim";
import { applyEffects } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { engineView, newGame } from "../testing/fixtures";
import { newsLines } from "./told";
import { nameOf, words } from "./text";

function said(lines: readonly ReportLine[]): string[] {
  return lines.map((line) => words(line.key, line.params));
}

describe("an answer told with what was chosen", () => {
  test("[world:month-end-results-sheet] given the hospital trust's post declined, when News tells the month, then it says the post was declined", () => {
    const line: ReportLine = { key: "line.offer.taken", params: { offer: "offer.sponsor-trust", choice: "decline" }, tone: "plain", attention: false, counts: [] };
    const told = said(newsLines([line], [], engineView()));
    expect(told).toHaveLength(1);
    expect(told[0]).toContain(nameOf("offer.sponsor-trust"));
    expect(told[0]).toContain(words("offer.sponsor-trust.choice.decline", {}));
  });

  test("[world:month-end-results-sheet] given a guest's where-next answered with the family house, when News tells the month, then the answer names the family house", () => {
    const game = newGame("scenario.tunde");
    applyEffects(game, [{ type: "offer/open", offer: "offer.where-next" }]);
    const offer = game.view().offers.find((candidate) => candidate.entry === "offer.where-next")!;
    const lines = game.accept({ type: "offer/choose", offer: offer.id, choice: "family" }).lines;
    expect(lines.some((line) => line.key === "line.offer.taken")).toBe(true);
    expect(said(newsLines(lines, [], game.view())).join(" ")).toContain(words("offer.where-next.choice.family", {}));
  });
});
