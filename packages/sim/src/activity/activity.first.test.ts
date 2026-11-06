// The first session: guide:early-win-in-three-turns.
// Every starting life sees an early win by its third month.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id } from "../engine/types";
import { isEarlyWin } from "../guide/guide.earlyWin";
import { FIRST_SESSION_MONTHS, playFirstSession, startingLives } from "../testing/firstSession";
import type { FirstSession } from "../testing/firstSession";

/** Every starting life played once; prologue lives that take the same path are kept once. */
function everyFirstSession(seed?: string): FirstSession[] {
  const seen = new Set<string>();
  const sessions: FirstSession[] = [];
  for (const life of startingLives(content)) {
    const session = playFirstSession(life, content, { seed });
    const path = `${life.scenario} ${session.path.join(" ")}`;
    if (seen.has(path)) continue;
    seen.add(path);
    sessions.push(session);
  }
  return sessions;
}

describe("the first session", () => {
  test("[guide:early-win-in-three-turns] given every starting life and every prologue answer, when the first three months are played toward the chapter, then none meets a dead end and each has an early win by the third", () => {
    const sessions = everyFirstSession();
    expect(new Set(sessions.map((session) => session.life.scenario))).toEqual(new Set(Object.keys(content.scenario)));
    const offered = Object.values(content.prologue).flatMap((step) => step.answers.map((answer) => `${step.id}:${answer.id}`));
    const taken = new Set(sessions.flatMap((session) => session.path));
    expect(2 * taken.size).toBeGreaterThan(offered.length);
    expect(sessions.filter((session) => session.deadEnds.length > 0).map((session) => `${session.life.name}: ${session.deadEnds.join(", ")}`)).toEqual([]);
    expect(sessions.filter((session) => session.earlyWin === null).map((session) => `${session.life.name} (${session.path.join(" ")})`)).toEqual([]);
    for (const session of sessions) expect(session.earlyWin!.month).toBeLessThanOrEqual(FIRST_SESSION_MONTHS);
  }, 120000);

  test("[guide:early-win-in-three-turns] given the graduate whose next step suggests nothing, when its first three months are played, then the months that leave it no job, no offer and no act are dead ends", () => {
    const session = playFirstSession({ name: "idle", scenario: "scenario.graduate", answers: {} }, content, { nextStep: () => [] });
    expect(session.deadEnds.length).toBeGreaterThan(0);
    expect(session.earlyWin).toBeNull();
  });

  test("[guide:early-win-in-three-turns] [activity:missed-hunt-opens-a-lead] given the starting lives played over several seeds, never taking an offer, when a first hunt misses, then the lead it opens is the early win, in the month it opens", () => {
    const leads = ["line.activity.hunt-lead", "line.activity.hunt-word"];
    const won = ["one", "two", "three", "four", "five", "six"].flatMap((seed) => everyFirstSession(`lead-${seed}`)).filter((session) => leads.includes(session.earlyWin?.line.key ?? ""));
    expect(won.length).toBeGreaterThan(0);
    for (const session of won) {
      const opened = session.months.findIndex((month) => month.lines.some((line) => leads.includes(line.key))) + 1;
      expect(session.earlyWin!.month).toBe(opened);
      expect(session.months[opened - 1]!.lines.some((line) => line.key === "line.activity.hunt-missed")).toBe(true);
    }
  }, 240000);

  test("[guide:early-win-in-three-turns] given report lines, when the early win is looked for, then only a good line from pay, a landed hunt, the lead after a miss, a chapter or goal, or a route heard by a choice counts", () => {
    const line = (key: string, tone: "good" | "plain" = "good") => ({ key, params: {}, tone, attention: false, counts: [] });
    const busy = [{ activity: "activity.meetup" as Id<"activity">, param: null }];
    const resting = [{ activity: "activity.rest" as Id<"activity">, param: null }];
    expect(isEarlyWin(line("line.activity.hunt-hired"), busy)).toBe(true);
    expect(isEarlyWin(line("line.activity.hunt-lead"), resting)).toBe(true);
    expect(isEarlyWin(line("line.activity.hunt-word"), resting)).toBe(true);
    expect(isEarlyWin(line("line.activity.hunt-missed", "plain"), busy)).toBe(false);
    expect(isEarlyWin(line("line.activity.salary"), resting)).toBe(true);
    expect(isEarlyWin(line("line.chapter.closed"), resting)).toBe(true);
    expect(isEarlyWin(line("line.activity.salary", "plain"), busy)).toBe(false);
    expect(isEarlyWin(line("line.route.heard"), resting)).toBe(false);
    expect(isEarlyWin(line("line.route.heard"), busy)).toBe(true);
    expect(isEarlyWin(line("line.quality.gain"), busy)).toBe(false);
  });
});
