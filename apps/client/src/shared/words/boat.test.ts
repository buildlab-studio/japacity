// The boat work's words on the screens (activity:catch-drawn-each-month, activity:boat-work-at-the-net-shed, activity:watch-the-match):
// a boat rung's pay is its base with words saying it depends on the catch, the month's pay line leads with the catch's word, and a
// place's answer with words of its own for this time says them.
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { nowLineWords } from "./acts";
import { tidyLines } from "./lines";
import { payLine } from "./pay";
import { words } from "./text";

const CREW = "activity.job-canoe-crew";
const RACKS = "activity.job-fish-racks";
const NAIRA = (whole: number) => ({ currency: "NGN" as const, amount: whole * 100 });

function said(lines: ReportLine[]): string[] {
  return tidyLines(lines).map((line) => words(line.key, line.params));
}

describe("the catch on the screens", () => {
  test("[activity:catch-drawn-each-month] given the crew's base and the racks' pay, when the pay line is said, then the crew's says it depends on the catch and the racks' is a plain month's pay", () => {
    expect(payLine(NAIRA(75000), CREW)).toBe("About ₦75,000 a month: it depends on the catch");
    expect(payLine(NAIRA(70000), RACKS)).toBe("Pays ₦70,000 a month");
    expect(payLine(NAIRA(70000))).toBe("Pays ₦70,000 a month");
  });

  test("[activity:catch-drawn-each-month] [world:month-end-results-sheet] given a good, a fair and a lean month in the crew, when the month's pay line is said, then it leads with the catch's word", () => {
    const pay = (band: string, whole: number): ReportLine => ({ key: "line.activity.salary", params: { job: CREW, amount: NAIRA(whole), catch: band }, tone: "good", attention: false, counts: [] });
    expect(said([pay("good", 120000)])).toEqual(["A good catch: ₦120,000 for your share."]);
    expect(said([pay("fair", 75000)])).toEqual(["A fair catch: ₦75,000 for your share."]);
    expect(said([pay("lean", 37500)])).toEqual(["A lean month on the water: ₦37,500 for your share."]);
  });
});

describe("answers with words of their own", () => {
  test("[activity:boat-work-at-the-net-shed] [activity:watch-the-match] given Sewanu's answer and the match's, each with and without its variant, when they are said, then the variant's words show where the line carries one", () => {
    const line = (key: string, variant?: string) => ({ key, params: { activity: key.replace(/^line\.activity\.(.+)\.now$/, "activity.$1"), ...(variant === undefined ? {} : { variant }) } });
    expect(nowLineWords(line("line.activity.ask-fisherman.now", "offer"))).toContain("Third for my canoe");
    expect(nowLineWords(line("line.activity.ask-fisherman.now"))).not.toContain("Third");
    expect(nowLineWords(line("line.activity.watch-match.now", "first"))).toContain("Sewanu");
    expect(nowLineWords(line("line.activity.watch-match.now"))).not.toContain("Sewanu");
    const told = said([{ ...line("line.activity.watch-match.now", "first"), tone: "plain", attention: false, counts: [] }]);
    expect(told.join(" ")).toContain("Sewanu at the net shed");
  });
});
