// A sitting of the chartered exams told in its own words (document:trade-papers): the score as a person says it, and that a failed
// sitting is sat again at the next, six months on, never "you can sit it again" as if at once.
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { countWords } from "./count";
import { words } from "./text";
import { toldOnResults } from "./told";

const ICAN = "activity.ican-exams";

describe("a sitting of the chartered exams on the results", () => {
  test("[document:trade-papers] given a sitting failed and one passed, when the results tell them, then each is in the exams' own words with the score in words", () => {
    const view = newGame("scenario.banker").view();
    const failed: ReportLine = { key: "line.activity.exam-failed", params: { right: 1, asked: 3, pass: 2, activity: ICAN }, tone: "bad", attention: true, counts: [] };
    const passed: ReportLine = { key: "line.activity.exam-passed", params: { right: 2, asked: 3, activity: ICAN }, tone: "good", attention: true, counts: [] };
    const toldFailed = toldOnResults(failed, view);
    const toldPassed = toldOnResults(passed, view);
    expect(toldFailed.key).toBe(`line.activity.exam-failed.${ICAN}`);
    expect(toldPassed.key).toBe(`line.activity.exam-passed.${ICAN}`);
    expect(words(toldFailed.key, toldFailed.params)).toContain(countWords(1));
    expect(words(toldFailed.key, toldFailed.params)).not.toMatch(/\d/);
    expect(words(toldPassed.key, toldPassed.params)).not.toMatch(/\d/);
  });
});
