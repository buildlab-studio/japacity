// The Month sheet's footer while a job is held (docs/rules/world.md R-WORLD-007): "Nothing planned. You rest." while the character works was wrong.
import { describe, expect, test } from "vitest";

import { slot } from "../../../../../packages/sim/src/route/route.journey";
import { engineView, newGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { MonthSheet } from "./MonthSheet";
import { turnWords } from "./turn.words";

function footer(): string {
  return document.querySelector("[data-month-end]")?.textContent ?? "";
}

describe("the Month sheet's footer", () => {
  test("[R-WORLD-007] given Ada working as a teacher with nothing else planned, when the sheet shows, then the footer says she works and nothing else is planned", async () => {
    const game = newGame("scenario.ada");
    game.endTurn([slot("activity.job-hunt", "activity.job-teacher")]);
    const offer = game.view().offers.find((candidate) => candidate.entry === "offer.job");
    if (offer === undefined) throw new Error("The hunt found no job on this seed.");
    game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
    await renderWithView(<MonthSheet />, game.view());
    expect(footer()).toContain(turnWords("turn.month.working-rest"));
    expect(turnWords("turn.month.working-rest")).toBe("Working. Nothing else planned.");
    expect(footer()).not.toContain(turnWords("ui.month.rest"));
  });

  test("[R-WORLD-007] given no job and nothing planned, when the sheet shows, then the footer says the character rests", async () => {
    await renderWithView(<MonthSheet />, engineView("scenario.ada"));
    expect(footer()).toContain(turnWords("ui.month.rest"));
  });
});
