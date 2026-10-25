// Learning tech said before the tap: the gain at the band the character is in, a course's months and what it ends with, what it costs
// when nothing is paid now, and why a study waits.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { formatMoney } from "./format";
import { bandGainNow, courseWords, heldBackWords, ownWorkCapital, studyDoesWords, studyPaysWords } from "./study";
import { nameOf, say } from "./text";

const TECH = "quality.tech";

/** The graduate's view with tech set to this figure. */
function atTech(tech: number): PlayerView {
  const view = newGame("scenario.graduate").view();
  return { ...view, qualities: [...view.qualities.filter((quality) => quality.id !== TECH), { id: TECH, value: tech }] };
}

describe("a study's gain by band", () => {
  test("[quality:skill-bands-slow-gains] given the free path, when its gain is read at each band, then it gives less as the bands rise and nothing from strong", () => {
    const gains = content.activity["activity.learn-free"]!.bandGains!;
    const [, junior = 0, working = 0, strong = 0] = content.tuning.quality.techBands;
    expect(bandGainNow(atTech(0), "activity.learn-free")).toBe(gains[0]);
    expect(bandGainNow(atTech(junior - 1), "activity.learn-free")).toBe(gains[0]);
    expect(bandGainNow(atTech(junior), "activity.learn-free")).toBe(gains[1]);
    expect(bandGainNow(atTech(working), "activity.learn-free")).toBe(gains[2]);
    expect(bandGainNow(atTech(strong), "activity.learn-free")).toBe(0);
    expect(studyDoesWords(atTech(0), "activity.learn-free")).toBe(say("ui.act.does.skill-month", { amount: gains[0]!, skill: nameOf(TECH) }));
    expect(studyDoesWords(atTech(strong), "activity.learn-free")).toBe(say("ui.act.does.taught"));
  });

  test("[activity:paid-tech-courses] given the bootcamp near its ceiling, when its gain is read, then it never takes tech past it", () => {
    const until = content.activity["activity.bootcamp"]!.bandUntil!;
    expect(bandGainNow(atTech(until - 1), "activity.bootcamp")).toBe(1);
    expect(bandGainNow(atTech(until), "activity.bootcamp")).toBe(0);
  });

  test("[activity:study-days-capped] given a day of class, when what it does is read, then it says the month's three days together, never a day's share as a month", () => {
    const month = content.activity["activity.learn-tech"]!.bandGains![0]!;
    expect(studyDoesWords(atTech(0), "activity.learn-tech")).toBe(say("ui.act.does.days", { amount: month, skill: nameOf(TECH) }));
  });

  test("[quality:skill-bands-slow-gains] given an act not read by band, when what it does is read, then nothing is said here", () => {
    expect(studyDoesWords(atTech(0), "activity.study-english")).toBeNull();
  });
});

describe("a course's months, its end and its cost", () => {
  test("[activity:paid-tech-courses] given the short course, when its course is read, then it says its months and that it ends with a piece for the portfolio", () => {
    const words = courseWords("activity.online-course");
    expect(words).toContain(say("ui.act.course.months", { count: content.activity["activity.online-course"]!.course!.months }));
    expect(words).toContain(say("ui.act.does.skill", { amount: 1, skill: nameOf("quality.portfolio") }));
    expect(courseWords("activity.learn-free")).toBeNull();
  });

  test("[activity:paid-tech-courses] given the diploma, when its cost is read, then it is a sum a month for its twelve months, as a bill", () => {
    expect(studyPaysWords("activity.tech-diploma")).toBe(say("ui.act.course.monthly", { amount: formatMoney(40_000_00, "NGN"), months: 12 }));
  });

  test("[activity:bootcamp-paid-after-a-job] given the bootcamp, when its cost is read, then nothing is paid now and the fee comes over its months once a developer job is held", () => {
    expect(studyPaysWords("activity.bootcamp")).toBe(say("ui.act.course.after-job", { amount: formatMoney(content.tuning.activity.bootcampFee, "NGN"), months: content.obligation["obligation.bootcamp"]!.term! }));
    expect(studyPaysWords("activity.learn-free")).toBeNull();
  });
});

describe("a study held back", () => {
  test("[activity:study-days-capped] [activity:paid-tech-courses] given the day's class capped or another path held, when the act is read, then it says which", () => {
    expect(heldBackWords({ capped: true })).toBe(say("ui.act.capped"));
    expect(heldBackWords({ onCourse: true })).toBe(say("ui.act.on-course"));
    expect(heldBackWords({})).toBeNull();
  });
});

describe("own work opened with capital", () => {
  test("[activity:capital-opens-own-work] [world:costly-acts-confirmed] given the kiln, the fish trade and the POS stand, when their sheets are read, then each names that its capital is not given back, and a bought meal does not", () => {
    for (const act of ["activity.buy-kiln", "activity.start-fish-trade", "activity.open-pos-stand"]) expect(ownWorkCapital(act)).toBe(true);
    expect(ownWorkCapital("activity.buy-suya")).toBe(false);
    expect(ownWorkCapital("activity.learn-free")).toBe(false);
  });
});
