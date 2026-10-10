// The first session: docs/rules/guides.md R-GUIDE-014, as amended on 8 Oct 2026.
// Every starting life sees an early win by its third month; the life's first
// hunt in those months is sure, at the lowest wage on offer.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { valueInKobo } from "../engine/int";
import type { ActivityEntry, Id, ReadCtx } from "../engine/types";
import { FIRST_SESSION_MONTHS, isEarlyWin, playFirstSession, startingLives } from "../testing/firstSession";
import type { FirstSession } from "../testing/firstSession";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { sureHuntJob } from "./activity.logic";

const HUNT: Id<"activity"> = "activity.job-hunt";

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

function entryOf(id: string): ActivityEntry {
  const entry = content.activity[id as Id<"activity">];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

/** The jobs the view offers to hunt now in this slot, by a month's pay in naira at the official rate, lowest first, then by id. */
function byWage(game: Game, slot: ActivityEntry["slot"]): Id<"activity">[] {
  const rates = Object.fromEntries(Object.entries(game.world().rates).map(([currency, rate]) => [currency, rate.official])) as Parameters<typeof valueInKobo>[2];
  const params = game.view().activities.find((option) => option.id === HUNT)?.params ?? [];
  return params
    .map(entryOf)
    .filter((entry) => entry.slot === slot && entry.pay !== null && typeof entry.pay.amount === "number")
    .map((entry) => ({ id: entry.id, kobo: valueInKobo(entry.pay!.amount as number, entry.pay!.currency, rates) }))
    .sort((a, b) => a.kobo - b.kobo || (a.id < b.id ? -1 : 1))
    .map((found) => found.id);
}

/** Every starting life played once; prologue lives that take the same path are kept once. */
function everyFirstSession(seed?: string): FirstSession[] {
  const seen = new Set<string>();
  const sessions: FirstSession[] = [];
  for (const life of startingLives(content)) {
    const session = playFirstSession(life, content, seed);
    const path = `${life.scenario} ${session.path.join(" ")}`;
    if (seen.has(path)) continue;
    seen.add(path);
    sessions.push(session);
  }
  return sessions;
}

describe("the first session", () => {
  test("[R-GUIDE-014] given every starting life and every prologue answer, when the first three months are played toward the chapter, then each has an early win by the third", () => {
    const sessions = everyFirstSession();
    expect(new Set(sessions.map((session) => session.life.scenario))).toEqual(new Set(Object.keys(content.scenario)));
    const offered = Object.values(content.prologue).flatMap((step) => step.answers.map((answer) => `${step.id}:${answer.id}`));
    const taken = new Set(sessions.flatMap((session) => session.path));
    expect(2 * taken.size).toBeGreaterThan(offered.length);
    expect(sessions.filter((session) => session.earlyWin === null).map((session) => `${session.life.name} (${session.path.join(" ")})`)).toEqual([]);
    for (const session of sessions) expect(session.earlyWin!.month).toBeLessThanOrEqual(FIRST_SESSION_MONTHS);
  }, 120000);

  test("[R-GUIDE-014] given report lines, when the early win is looked for, then only a good line from pay, a landed hunt, a chapter or goal, or a route heard by a choice counts", () => {
    const line = (key: string, tone: "good" | "plain" = "good") => ({ key, params: {}, tone, attention: false, counts: [] });
    const busy = [{ activity: "activity.meetup" as Id<"activity">, param: null }];
    const resting = [{ activity: "activity.rest" as Id<"activity">, param: null }];
    expect(isEarlyWin(line("line.activity.hunt-hired"), busy)).toBe(true);
    expect(isEarlyWin(line("line.activity.salary"), resting)).toBe(true);
    expect(isEarlyWin(line("line.chapter.closed"), resting)).toBe(true);
    expect(isEarlyWin(line("line.activity.salary", "plain"), busy)).toBe(false);
    expect(isEarlyWin(line("line.route.heard"), resting)).toBe(false);
    expect(isEarlyWin(line("line.route.heard"), busy)).toBe(true);
    expect(isEarlyWin(line("line.quality.gain"), busy)).toBe(false);
  });
});

describe("the sure first hunt", () => {
  test("[R-GUIDE-014] given Ada's first hunt in her first month, when the job it lands is read, then it is the main job with the lowest month's pay that covers her month's dues of those she may hunt, whichever she names", () => {
    const game = start({ scenario: "scenario.ada", content });
    const wages = byWage(game, "main");
    expect(wages.length).toBeGreaterThan(1);
    const dues = Object.values(game.state.obligation.items).reduce((sum, item) => sum + item.amount, 0);
    const covering = wages.find((id) => {
      const pay = entryOf(id).pay;
      return pay !== null && pay.currency === "NGN" && typeof pay.amount === "number" && pay.amount >= dues;
    });
    expect(covering).toBeDefined();
    // Ada's upkeep is above the teacher's pay, so the smallest job that pays her month is not the smallest job.
    expect(covering).not.toBe(wages[0]);
    for (const named of wages) expect(sureHuntJob(readOf(game), entryOf(named), 1, false)?.id).toBe(covering);
  });

  test("[R-GUIDE-014] given a side job named, when the sure hunt's job is read, then it is the side job with the lowest pay", () => {
    const game = start({ scenario: "scenario.ada", content });
    const sides = byWage(game, "side");
    expect(sides.length).toBeGreaterThan(1);
    expect(sureHuntJob(readOf(game), entryOf(sides[sides.length - 1]!), 1, false)?.id).toBe(sides[0]);
  });

  test("[R-GUIDE-014] given the months, when the sure hunt is read, then the third month is the last that has it and the fourth has none", () => {
    const game = start({ scenario: "scenario.ada", content });
    const named = entryOf(byWage(game, "main")[0]!);
    expect(sureHuntJob(readOf(game), named, FIRST_SESSION_MONTHS, false)).not.toBeNull();
    expect(sureHuntJob(readOf(game), named, FIRST_SESSION_MONTHS + 1, false)).toBeNull();
  });

  test("[R-GUIDE-014] given a hunt earlier this month or in a month before, when the sure hunt is read, then there is none: only the life's first hunt is sure", () => {
    const game = start({ scenario: "scenario.ada", content });
    const named = entryOf(byWage(game, "main")[0]!);
    expect(sureHuntJob(readOf(game), named, 1, true)).toBeNull();
    game.endTurn([{ activity: HUNT, param: named.id }]);
    expect(sureHuntJob(readOf(game), named, 2, false)).toBeNull();
    const rested = start({ scenario: "scenario.ada", content });
    rested.endTurn([]);
    expect(sureHuntJob(readOf(rested), named, 2, false)).not.toBeNull();
  });

  test("[R-GUIDE-014] [R-ACTIVITY-005] given a starting life's first hunt, for the best-paid job it may hunt, whatever the draw, when the turn is ended, then the hunt lands (the named job or the lowest-paid), the job offer opens, and the view's hunt reads sure before it and not after", () => {
    for (const seed of ["seed-1", "seed-2", "seed-3", "seed-4", "seed-5", "seed-6", "seed-7", "seed-8"]) {
      const game = start({ scenario: "scenario.ada", content, seed });
      const wages = byWage(game, "main");
      const best = wages[wages.length - 1]!;
      expect(game.view().activities.find((option) => option.id === HUNT)?.sure).toBe(true);
      game.endTurn([{ activity: HUNT, param: best }]);
      const lines = game.view().report?.lines ?? [];
      const landed = lines.find((line) => line.key === "line.activity.hunt-hired");
      expect(landed).toBeDefined();
      expect(wages).toContain(landed?.params["job"]);
      expect(game.view().offers.some((offer) => offer.entry === "offer.job")).toBe(true);
      expect(game.view().activities.find((option) => option.id === HUNT)?.sure).toBeUndefined();
    }
  });
});
