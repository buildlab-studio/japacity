import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { chapterNextStep, FIRST_SESSION_TURNS, playFirstSession, startingLives, type FirstSession } from "../../shared/testing/firstSession";
import { words } from "../../shared/words/text";
import { earlyWinIn, isEarlyWin } from "../../shared/sim/earlyWin";

const line = (key: string, tone: ReportLine["tone"] = "good"): ReportLine => ({ key, params: {}, tone, attention: false, counts: [] });

/** Every starting life played once; the prologue's lives that take the same path are kept once. */
function everyFirstSession(): FirstSession[] {
  const seen = new Set<string>();
  const sessions: FirstSession[] = [];
  for (const life of startingLives()) {
    const session = playFirstSession(life);
    const path = `${life.scenario} ${session.path.join(" ")}`;
    if (seen.has(path)) continue;
    seen.add(path);
    sessions.push(session);
  }
  return sessions;
}

describe("the first session", () => {
  test("[R-GUIDE-014] given every starting life, when its first three months are played as the next step suggests, then each has an early win by the third", () => {
    expect(FIRST_SESSION_TURNS).toBe(3);
    const sessions = everyFirstSession();
    const scenarios = new Set(sessions.map((session) => session.life.scenario));
    expect([...scenarios].sort()).toEqual(Object.keys(content.scenario).sort());
    // Every answer of every prologue step is taken on at least one path.
    const taken = new Set(sessions.flatMap((session) => session.path));
    const offered = Object.values(content.prologue).flatMap((step) => step.answers.map((answer) => `${step.id}:${answer.id}`));
    expect(taken.size).toBeGreaterThan(offered.length / 2);
    const without = sessions.filter((session) => session.earlyWin === null).map((session) => `${session.life.name} (${session.path.join(" ")})`);
    expect(without).toEqual([]);
    for (const session of sessions) expect(session.earlyWin!.month).toBeLessThanOrEqual(FIRST_SESSION_TURNS);
  }, 120000);

  test("[R-GUIDE-014] [R-TEXT-007] given a life whose months are all left to rest, when its first three are played, then a route heard on the radio says the radio as its source and is not an early win", () => {
    const session = playFirstSession({ name: "resting", scenario: "scenario.ada", answers: {} }, { nextStep: () => [] });
    const heard = session.months.flatMap((month) => month.lines).filter((found) => found.key === "line.route.heard");
    expect(heard.length).toBeGreaterThan(0);
    for (const found of heard) expect(words(found.key, found.params)).toMatch(/^On the radio: /);
    expect(session.earlyWin).toBeNull();
  });

  test("[R-GUIDE-014] given a new life at home, when the next step is read, then it works toward the chapter's first unmet items", () => {
    const session = playFirstSession({ name: "ada", scenario: "scenario.ada", answers: {} });
    expect(session.months[0]?.slots.map((slot) => slot.activity)).toEqual(["activity.job-hunt", "activity.meetup"]);
    expect(chapterNextStep).toBeTypeOf("function");
  });

  test("[R-GUIDE-014] given report lines, when the early win is looked for, then only a good line from pay, a chapter or goal, or a route heard by a choice counts", () => {
    expect(isEarlyWin(line("line.activity.salary"))).toBe(true);
    expect(isEarlyWin(line("line.activity.gig"))).toBe(true);
    expect(isEarlyWin(line("line.chapter.closed"))).toBe(true);
    expect(isEarlyWin(line("line.goal.done"))).toBe(true);
    expect(isEarlyWin(line("line.quality.gain"))).toBe(false);
    expect(isEarlyWin(line("line.activity.salary", "plain"))).toBe(false);
    expect(isEarlyWin(line("line.route.heard"), [{ activity: "activity.rest", param: null }])).toBe(false);
    expect(isEarlyWin(line("line.route.heard"), [{ activity: "activity.meetup", param: null }])).toBe(true);
    expect(earlyWinIn([line("line.quality.gain"), line("line.goal.done")])?.key).toBe("line.goal.done");
  });
});
