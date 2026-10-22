// News tells the month, not the years before (world:month-end-results-sheet): the years are
// told once, on the page, so the prologue's lines (a grade, a quality up or down in the simulation's words) never list.
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { ARCHETYPES, answersInOrder, presetAnswer } from "../front-door/archetypes";
import { newGame } from "../testing/fixtures";
import { newsLines } from "./told";

const DEVELOPER = ARCHETYPES.find((archetype) => archetype.id === "developer")!;

describe("News after the years before", () => {
  test("[world:month-end-results-sheet] given the developer's years played as the door plays them and the first month ended, when News tells the month, then none of the prologue's lines is listed and the month's own are", () => {
    const game = newGame("scenario.prologue", "developer-0");
    const prologue: ReportLine[] = [];
    for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
      const step = game.view().prologue!;
      const answer = presetAnswer(DEVELOPER, step) ?? answersInOrder(DEVELOPER, step.step, step.answers.filter((each) => each.allowed))[0]?.id ?? "";
      prologue.push(...game.accept({ type: "prologue/choose", step: step.step, answer }).lines);
    }
    expect(prologue.some((line) => line.key === "line.prologue.graded")).toBe(true);
    game.endTurn();
    const view = game.view();
    const told = newsLines(prologue, view.report!.lines, view);
    expect(told.filter((line) => line.key.startsWith("line.prologue."))).toEqual([]);
    // The prologue's own lines are the objects it sent; none of them is told.
    expect(told.filter((line) => prologue.includes(line))).toEqual([]);
    expect(told.map((line) => line.key)).toContain("line.activity.rested");
  });
});
