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
  test("[guide:early-win-in-three-turns] given every starting life and every prologue answer, when the first three months are played toward the chapter, then each has an early win by the third", () => {
    const sessions = everyFirstSession();
    expect(new Set(sessions.map((session) => session.life.scenario))).toEqual(new Set(Object.keys(content.scenario)));
    const offered = Object.values(content.prologue).flatMap((step) => step.answers.map((answer) => `${step.id}:${answer.id}`));
    const taken = new Set(sessions.flatMap((session) => session.path));
    expect(2 * taken.size).toBeGreaterThan(offered.length);
    expect(sessions.filter((session) => session.earlyWin === null).map((session) => `${session.life.name} (${session.path.join(" ")})`)).toEqual([]);
    for (const session of sessions) expect(session.earlyWin!.month).toBeLessThanOrEqual(FIRST_SESSION_MONTHS);
  }, 120000);

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
