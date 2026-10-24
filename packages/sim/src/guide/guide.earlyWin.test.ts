import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, ReportLine } from "../engine/types";
import { start } from "../testing/play";
import { earlyWinIn, isEarlyWin, picksOf } from "./guide.earlyWin";

const MEETUP: Id<"activity"> = "activity.meetup";
const line = (key: string): ReportLine => ({ key, params: {}, tone: "good", attention: false, counts: [] });

describe("the early win", () => {
  test("[guide:early-win-in-three-turns] given a new life whose months end with no pick, when a route is heard in the second, then no month holds an early win", () => {
    const game = start({ scenario: "scenario.graduate", content, seed: "s", worldSeed: "w" });
    const months = [1, 2, 3].map(() => game.endTurn([]).lines);
    expect(months[1]?.some((found) => found.key === "line.route.heard" && found.tone === "good")).toBe(true);
    for (const lines of months) expect(earlyWinIn(lines, [])).toBeNull();
  });

  test("[guide:early-win-in-three-turns] given a command, when its picks are read, then a month gives its slots, a now-act its one act and any other command is the choice itself, with no slots", () => {
    const slots = [{ activity: MEETUP, param: null }];
    expect(picksOf({ type: "turn/end", slots })).toEqual(slots);
    expect(picksOf({ type: "activity/now", activity: "activity.look-into-route", param: "route.uk-student" })).toEqual([{ activity: "activity.look-into-route", param: "route.uk-student" }]);
    expect(picksOf({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" })).toBeNull();
    expect(isEarlyWin(line("line.route.heard"), picksOf({ type: "activity/now", activity: MEETUP, param: null }))).toBe(true);
  });

  test("[guide:early-win-in-three-turns] given pay told by the ledger and a route read on the official page, when the early win is looked for, then each is one, as pay and a route heard are", () => {
    const busy = [{ activity: MEETUP, param: null }];
    const resting = [{ activity: "activity.rest" as Id<"activity">, param: null }];
    expect(isEarlyWin(line("line.wallet.salary"), resting)).toBe(true);
    expect(isEarlyWin(line("line.activity.hunt-hired"), busy)).toBe(true);
    expect(isEarlyWin(line("line.route.looked-into"), [{ activity: "activity.look-into-route", param: "route.uk-student" }])).toBe(true);
    expect(isEarlyWin(line("line.route.looked-into"), resting)).toBe(false);
  });

  test("[guide:early-win-in-three-turns] [guide:nothing-asked-before-early-win] given lines whose picks are not known (the prologue's preset, the authority's own lines, a command that is its own choice), when the early win is looked for, then a route heard or read counts", () => {
    expect(isEarlyWin(line("line.route.heard"), null)).toBe(true);
    expect(isEarlyWin(line("line.route.looked-into"), null)).toBe(true);
    expect(earlyWinIn([line("line.quality.gain"), line("line.route.heard")], null)?.key).toBe("line.route.heard");
    expect(isEarlyWin({ ...line("line.route.heard"), tone: "plain" }, null)).toBe(false);
  });
});
