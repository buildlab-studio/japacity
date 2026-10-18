import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, ReportLine } from "../engine/types";
import { start } from "../testing/play";
import { earlyWinIn, isEarlyWin, picksOf } from "./guide.earlyWin";

const MEETUP: Id<"activity"> = "activity.meetup";
const line = (key: string): ReportLine => ({ key, params: {}, tone: "good", attention: false, counts: [] });

describe("the early win", () => {
  test("[guide:early-win-in-three-turns] given a new life whose months end with no pick, when a route is heard in the third, then no month holds an early win", () => {
    const game = start({ scenario: "scenario.ada", content, seed: "s", worldSeed: "w" });
    const months = [1, 2, 3].map(() => game.endTurn([]).lines);
    expect(months[2]?.some((found) => found.key === "line.route.heard" && found.tone === "good")).toBe(true);
    for (const lines of months) expect(earlyWinIn(lines, [])).toBeNull();
  });

  test("[guide:early-win-in-three-turns] given a command, when its picks are read, then a month gives its slots, a now-act its one act and any other command none", () => {
    const slots = [{ activity: MEETUP, param: null }];
    expect(picksOf({ type: "turn/end", slots })).toEqual(slots);
    expect(picksOf({ type: "activity/now", activity: "activity.look-into-route", param: "route.uk-student" })).toEqual([{ activity: "activity.look-into-route", param: "route.uk-student" }]);
    expect(picksOf({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" })).toEqual([]);
    expect(isEarlyWin(line("line.route.heard"), picksOf({ type: "activity/now", activity: MEETUP, param: null }))).toBe(true);
  });

  test("[guide:early-win-in-three-turns] given the lines that only follow a choice or tell the same pay again, when the early win is looked for, then a route looked into and the ledger's salary line are not one", () => {
    const busy = [{ activity: MEETUP, param: null }];
    expect(isEarlyWin(line("line.route.looked-into"), busy)).toBe(false);
    expect(isEarlyWin(line("line.wallet.salary"), busy)).toBe(false);
  });
});
