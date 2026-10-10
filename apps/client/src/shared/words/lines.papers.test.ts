// A paper on its way and the same paper ready are never told in one list (docs/rules/world.md R-WORLD-008; the
// the results said "Your passport is on the way. It should be ready this month."
// and, on the next line, "Your passport is ready." Real content, real draws.
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { storyLines } from "../../features/turn/month.results";
import { tidyLines } from "./lines";
import { newsLines } from "./told";

const PASSPORT = "document.passport";

/** A passport asked for mid-month on a seed whose wait is one month, and the month's end that issues it. */
function quickPassport(): { mid: ReportLine[]; end: ReportLine[] } {
  for (let at = 0; at < 40; at += 1) {
    const game = newGame("scenario.ada", `passport-${String(at)}`);
    const month = game.state.turn.month;
    const mid = game.accept({ type: "activity/now", activity: "activity.get-passport", param: null }).lines;
    if (mid.find((line) => line.key === "line.document.requested")?.params["month"] !== month + 1) continue;
    return { mid, end: game.endTurn().lines };
  }
  throw new Error("No seed gave a passport in one month.");
}

const about = (lines: readonly ReportLine[], key: string): ReportLine[] => lines.filter((line) => line.key === key && line.params["document"] === PASSPORT);

describe("a paper on its way and ready, told once", () => {
  test("[R-WORLD-008] given a passport asked for mid-month that is issued at that month's end, when the month's lines are told, then the results and News say it is ready and never that it is on the way", () => {
    const { mid, end } = quickPassport();
    const all = [...mid, ...end];
    expect(about(all, "line.document.requested")).toHaveLength(1);
    expect(about(all, "line.document.issued")).toHaveLength(1);
    const tidy = tidyLines(all);
    expect(about(tidy, "line.document.requested")).toEqual([]);
    expect(about(tidy, "line.document.issued")).toHaveLength(1);
    expect(about(storyLines(all), "line.document.requested")).toEqual([]);
    expect(about(newsLines(mid, end), "line.document.requested")).toEqual([]);
  });

  test("[R-WORLD-008] given a passport asked for that is not ready by the month's end, when the month's lines are told, then it is on the way", () => {
    const game = newGame("scenario.ada");
    const mid = game.accept({ type: "activity/now", activity: "activity.get-passport", param: null }).lines;
    const end = game.endTurn().lines;
    expect(about(end, "line.document.issued")).toEqual([]);
    expect(about(tidyLines([...mid, ...end]), "line.document.requested")).toHaveLength(1);
  });
});
