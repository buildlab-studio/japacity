// The joke versions' guard played through the simulation: no joke is shown in
// a month told on the road or in a month whose
// report carries bad news. The simulation's own tone checks content's list of
// bad news: a line told as bad that is not money going out must be on it.
import { badNews, content, reportPlain, spendingLines, text, versionCount, versionKey } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { savedCommands } from "../engine/replay";
import type { ReportLine } from "../engine/types";
import { start } from "../testing/play";
import { runLife, STRATEGY_NAMES } from "./players";
import { LIVES } from "./report";

const SEEDS = 4;
const DRAWS = [0, 1, 2, 3, 4];

/** Money going out is told in a bad tone, and is not bad news: fees, rent, the cost of living. */
function spending(line: ReportLine): boolean {
  return (line.key.startsWith("line.wallet.") || line.key === "line.obligation.charged") && !line.attention;
}

interface Told {
  /** Every report: its lines, and whether the view at its end said the road. */
  reports: { lines: ReportLine[]; onRoad: boolean }[];
}

function tell(): Told {
  const told: Told = { reports: [] };
  for (const strategy of STRATEGY_NAMES) {
    for (const life of LIVES) {
      for (let index = 0; index < SEEDS; index += 1) {
        const seed = `versions-${String(index)}`;
        const { game } = runLife(strategy, life, seed, content, { months: 80, keepSave: true });
        const replay = start({ scenario: life, seed, worldSeed: `world-${seed}`, content });
        for (const { command, sender } of savedCommands(game.save)) {
          const before = replay.state.place.where;
          const result = replay.send(command, sender);
          if (!result.ok || result.lines.length === 0) continue;
          // A month that ends the road is still a road month: the report tells how it ended.
          told.reports.push({ lines: result.lines, onRoad: before === "road" || replay.view().place.where === "road" });
        }
      }
    }
  }
  return told;
}

describe("joke versions in play", () => {
  const told = tell();

  test("[engine:content-checked-before-play] given the simulated players on every life, when every line told in a bad tone is gathered, then each one that is not money going out is bad news on content's list", () => {
    const bad = new Set(told.reports.flatMap((report) => report.lines.filter((line) => line.tone === "bad" && !spending(line)).map((line) => line.key)));
    expect(bad.size).toBeGreaterThan(5);
    expect([...bad].filter((key) => !badNews(key, text[key] ?? ""))).toEqual([]);
  });

  test("[engine:content-checked-before-play] given every report the simulated players are told, when its versions are drawn as the screen draws them, then no joke shows on the road or beside bad news, and jokes do show in other months", () => {
    let jokes = 0;
    const wrong: string[] = [];
    for (const report of told.reports) {
      const plainOnly = { onRoad: report.onRoad, broke: false, badNews: reportPlain(report.lines.map((line) => line.key), text) };
      const unsafe = report.onRoad || report.lines.some((line) => line.tone === "bad" && !spending(line));
      for (const line of report.lines) {
        const shown = DRAWS.filter((draw) => versionKey(line.key, draw, plainOnly) !== line.key).length;
        if (unsafe && shown > 0) wrong.push(line.key);
        jokes += shown;
      }
    }
    expect([...new Set(wrong)]).toEqual([]);
    expect(jokes).toBeGreaterThan(0);
  });

  test("[engine:content-checked-before-play] given the same reports, when a line with jokes is told in a bad tone, then it is only ever a cost of living", () => {
    const bad = new Set(told.reports.flatMap((report) => report.lines.filter((line) => line.tone === "bad").map((line) => line.key)));
    expect([...bad].filter((key) => versionCount(key) > 1 && !spendingLines.includes(key))).toEqual([]);
  });
});
