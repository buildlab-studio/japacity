// News tells each of the month's events once (world:month-end-results-sheet): an act done at once by its place's own
// line, a hunt's offer by its own line, an exam by its mark. Played on the nurse's tile life through the engine, as the
// screens send it: the hunt at the clinic at once and the exam planned, then the exam's questions the next month.
import type { ReportLine } from "@japacity/sim";
import { slot } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { archetypeOf } from "../front-door/archetypes";
import { playTile } from "../front-door/archetypes.testing";
import { newGame } from "../testing/fixtures";
import { nowLineWords } from "./acts";
import { nameOf, words } from "./text";
import { newsLines } from "./told";

const HUNT = "activity.job-hunt";
const NURSE = "activity.job-nurse";
const EXAM = "activity.nurse-certification";

function nurseLife(): ReturnType<typeof newGame> {
  const game = newGame("scenario.prologue", "walk-nurse");
  playTile(game, archetypeOf("nurse")!);
  return game;
}

describe("News tells the month once", () => {
  test("[world:month-end-results-sheet] given the nurse's job hunt done at once and her exam planned, when the month's News is read, then the hunt is told by the place's own line with no \"Done this month\" beside it, and an offer the hunt landed by its own line with no \"Something new needs an answer\" beside it", () => {
    const game = nurseLife();
    const mid = game.accept({ type: "activity/now", activity: HUNT, param: NURSE }).lines;
    const report = game.endTurn([slot(EXAM)]).lines;
    const news = newsLines(mid, report, game.view());
    const said = news.map((line) => nowLineWords(line));
    const place = mid.find((line) => line.key === "line.activity.job-hunt.now");
    if (place === undefined) throw new Error("The clinic said nothing.");
    expect(said).toContain(nowLineWords(place));
    expect(said).not.toContain(words("line.activity.played-now", { activity: HUNT }));
    expect(said.filter((one) => one.includes(nameOf(HUNT)))).toHaveLength(0);
    // On this life the draw misses and the sure first hunt lands another job's offer (activity:job-hunt-lands-offer).
    expect(report.some((line) => line.key === "line.activity.hunt-hired")).toBe(true);
    expect(report.some((line) => line.key === "line.offer.opened" && line.params.offer === "offer.job")).toBe(true);
    expect(news.some((line) => line.key === "line.offer.opened" && line.params.offer === "offer.job")).toBe(false);
    // The offer is told by the hunt's own line, in the results' words: "An offer: {job}, {pay} a month."
    expect(news.some((line) => line.key === "ui.results.hunt-offer")).toBe(true);
  });

  test("[world:month-end-results-sheet] given the nurse's exam sat and marked, when the month's News is read, then the exam is told by its mark with no \"is over\" beside it", () => {
    const game = nurseLife();
    game.endTurn([slot(EXAM)]);
    const mid: ReportLine[] = [];
    for (let asked = 0; asked < 6 && game.view().setpiece?.question !== null && game.view().setpiece !== null; asked += 1) {
      const question = game.view().setpiece!.question!;
      mid.push(...game.accept({ type: "setpiece/answer", question: question.id, answer: question.allowed[0] ?? question.answers[0]! }).lines);
    }
    const report = game.endTurn().lines;
    const news = newsLines(mid, report, game.view());
    expect(news.some((line) => line.key === "line.activity.exam-passed" || line.key === "line.activity.exam-failed")).toBe(true);
    expect(news.some((line) => line.key === "line.setpiece.closed")).toBe(false);
  });
});
