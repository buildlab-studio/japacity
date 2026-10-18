// A paper on its way and the same paper ready are never told in one list (docs/rules/world.md R-WORLD-008):
// never "Your passport is on the way. It should be ready this month." beside "Your passport is ready.", nor the
// English test's "It should be ready this month." beside "Your English test result is out.". Real content, real draws.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../shared/testing/fixtures";
import { storyLines } from "../features/turn/month.results";
import { tidyLines } from "../shared/words/lines";
import { newsLines } from "../shared/words/told";

const PASSPORT = "document.passport";

/** A passport asked for mid-month on a seed whose wait is one month, and the month's end that issues it. */
function quickPassport(): { mid: ReportLine[]; end: ReportLine[]; view: PlayerView } {
  for (let at = 0; at < 40; at += 1) {
    const game = newGame("scenario.ada", `passport-${String(at)}`);
    const month = game.state.turn.month;
    const mid = game.accept({ type: "activity/now", activity: "activity.get-passport", param: null }).lines;
    if (mid.find((line) => line.key === "line.document.requested")?.params["month"] !== month + 1) continue;
    const end = game.endTurn().lines;
    return { mid, end, view: game.view() };
  }
  throw new Error("No seed gave a passport in one month.");
}

const about = (lines: readonly ReportLine[], key: string): ReportLine[] => lines.filter((line) => line.key === key && line.params["document"] === PASSPORT);

describe("a paper on its way and ready, told once", () => {
  test("[R-WORLD-008] given a passport asked for mid-month that is issued at that month's end, when the month's lines are told, then the results and News say it is ready and never that it is on the way", () => {
    const { mid, end, view } = quickPassport();
    const all = [...mid, ...end];
    expect(about(all, "line.document.requested")).toHaveLength(1);
    expect(about(all, "line.document.issued")).toHaveLength(1);
    const tidy = tidyLines(all);
    expect(about(tidy, "line.document.requested")).toEqual([]);
    expect(about(tidy, "line.document.issued")).toHaveLength(1);
    expect(about(storyLines(all), "line.document.requested")).toEqual([]);
    expect(about(newsLines(mid, end, view), "line.document.requested")).toEqual([]);
  });

  test("[R-WORLD-008] given a passport asked for that is not ready by the month's end, when the month's lines are told, then it is on the way", () => {
    const game = newGame("scenario.ada");
    const mid = game.accept({ type: "activity/now", activity: "activity.get-passport", param: null }).lines;
    const end = game.endTurn().lines;
    expect(about(end, "line.document.issued")).toEqual([]);
    expect(about(tidyLines([...mid, ...end]), "line.document.requested")).toHaveLength(1);
  });

  test("[R-WORLD-008] given the English test sat mid-month and its band out at that month's end, when the month's lines are told, then the results and News tell the band once and never that the result is on the way", () => {
    const game = newGame("scenario.tunde");
    const ENGLISH = "document.english-test";
    const mid = game.accept({ type: "activity/now", activity: "activity.sit-english-test", param: null }).lines;
    const end = game.endTurn().lines;
    const of = (lines: readonly ReportLine[], key: string): ReportLine[] => lines.filter((line) => line.key.startsWith(key) && line.params["document"] === ENGLISH);
    expect(of([...mid, ...end], "line.document.requested")).toHaveLength(1);
    expect(of(end, "line.document.issued-band")).toHaveLength(1);
    expect(of(tidyLines([...mid, ...end]), "line.document.requested")).toEqual([]);
    expect(of(storyLines([...mid, ...end]), "line.document.requested")).toEqual([]);
    expect(of(storyLines([...mid, ...end]), "line.document.issued-band")).toHaveLength(1);
    expect(of(newsLines(mid, end, game.view()), "line.document.requested")).toEqual([]);
  });
});
