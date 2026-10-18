import { content } from "@japacity/content";
import { time } from "@japacity/sim";
import type { CounterTotal } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { dashboard, WINDOW_DAYS } from "./dashboard";

const { minShown, refD1Bp, refD7Bp } = content.tuning.analytics;
const LAST = "2026-10-21";
const last = time.dayNumber(LAST) ?? 0;
const total = (day: number, name: string, key: string, count: number, region = "NG"): CounterTotal => ({ day: time.dayName(day), region, name, key, count });

describe("the dashboard's data", () => {
  test("[analytics:small-counts-shown-as-fewer] given totals either side of the smallest number shown, when the dashboard is built, then a key under it is hidden as fewer than that number and one at it is shown", () => {
    const board = dashboard(content, LAST, [total(last, "screen/opened", "wallet", minShown - 1), total(last, "screen/opened", "route", minShown)]);
    expect(board.counters).toEqual([
      { day: LAST, region: "NG", name: "screen/opened", key: "wallet", count: { fewerThan: minShown } },
      { day: LAST, region: "NG", name: "screen/opened", key: "route", count: minShown },
    ]);
    expect(JSON.stringify(board)).not.toContain(`"count":${String(minShown - 1)}`);
  });

  test("[analytics:dashboard-shows-fixed-list] given a day, when the dashboard is built, then it covers that day and the 30 before it, with daily players, new players and turns", () => {
    const board = dashboard(content, LAST, [total(last, "players/active", "NG", 40), total(last, "players/active", "GB", 2, "GB"), total(last, "players/new", "NG", 12), total(last, "turns/ended", "NG", 3)]);
    expect(board.from).toBe(time.dayName(last - WINDOW_DAYS));
    expect(board.daily).toHaveLength(WINDOW_DAYS + 1);
    expect(board.daily.at(-1)).toEqual({ day: LAST, players: 42, newPlayers: 12, turnsEnded: { fewerThan: minShown } });
  });

  test("[analytics:day-one-and-seven-return] given a sign-up week's new players and returns, when the dashboard is built, then day-1 and day-7 return are shown in basis points beside the reference lines", () => {
    const monday = time.dayNumber("2026-10-12") ?? 0;
    const board = dashboard(content, LAST, [
      total(monday, "players/new", "NG", 60),
      total(monday + 2, "players/new", "GB", 40, "GB"),
      total(monday, "players/returned", "d1", 25),
      total(monday + 2, "players/returned", "d1", 5, "GB"),
      total(monday, "players/returned", "d7", 9),
      total(monday, "first/early-win", "1", 70),
      total(monday, "first/early-win", "none", 3),
    ]);
    expect(board.reference).toEqual({ d1Bp: refD1Bp, d7Bp: refD7Bp });
    const week = board.weeks.find((each) => each.week === "2026-10-12");
    expect(week).toEqual({
      week: "2026-10-12",
      newPlayers: 100,
      d1: 30,
      d7: { fewerThan: minShown },
      d1Bp: 3000,
      d7Bp: null,
      earlyWin: { "1": 70, "2": { fewerThan: minShown }, "3": { fewerThan: minShown }, later: { fewerThan: minShown }, none: { fewerThan: minShown } },
    });
    for (const each of board.weeks) expect(new Date(`${each.week}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  test("[analytics:day-one-and-seven-return] given an ask counted before the early win, when the dashboard is built, then it is marked as a fault however small; asks after it are not", () => {
    expect(dashboard(content, LAST, [total(last, "ask/shown", "sign-in:after", 50), total(last, "ask/accepted", "notify:after", 20)]).askBeforeEarlyWin).toBe(false);
    expect(dashboard(content, LAST, [total(last, "ask/shown", "notify:before", 1)]).askBeforeEarlyWin).toBe(true);
  });
});
