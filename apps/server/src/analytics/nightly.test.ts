import type { BaseEvent, Command, Sender } from "@japacity/sim";
import { time } from "@japacity/sim";
import type { AccountRow } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { dayName } from "./day";
import { nightlyTotals } from "./nightly";
import type { Played } from "./replay";

const DAY = 20_370;
const AT = DAY * time.DAY_MS + time.HOUR_MS;
const account: AccountRow = { id: "account.a", country: "GB", age: { passed: true, at: 0, method: "declared" }, createdAt: 0, character: "character.a", notifyBankFull: false, sendUsageCounts: true, state: "secured", username: "account_a", usernameChangedAt: null, lastPlayedAt: 0 };

function played(events: object[], sender: Sender = "player", command: Command = { type: "turn/end", slots: [], basedOn: 0 }, at = AT): Played {
  return { row: { character: "character.a", v: 1, tick: 1, sender, command, hash: "h", at }, afterPrologue: true, turn: 1, events: events as BaseEvent[], lines: [] };
}

const facts = (rows: Played[], who: AccountRow | null = account) => ({ day: DAY, active: [{ character: "character.a", life: { account: "account.a", played: rows }, account: who }], created: [] });

describe("the day's game counters", () => {
  test("[R-ANALYTICS-008] given the events of a day, when they are counted, then each counter is keyed as the page gives it", () => {
    const rows = nightlyTotals(
      facts([
        played([
          { type: "chapter/closed", chapter: "chapter.home", next: null },
          { type: "chapter/reopened", chapters: ["chapter.home", "chapter.file"], current: "chapter.home" },
          { type: "route/moved", route: "route.uk-student", to: "granted" },
          { type: "route/refused", route: "route.uk-student", month: 3, reasons: ["funds", "history"], depositRefund: null },
          { type: "offer/taken", id: "o1", entry: "offer.loan", choice: "accept" },
          { type: "place/returned", shape: "by-choice", country: null, month: 9, kept: null },
          { type: "lottery/bought", draw: 1, tickets: 3, cost: 600 },
          { type: "lottery/bought", draw: 1, tickets: 2, cost: 400 },
          { type: "wallet/credited" },
        ]),
      ]),
    );
    const day = dayName(DAY);
    expect(rows).toEqual(
      expect.arrayContaining([
        { day, region: "GB", name: "chapter/closed", key: "chapter.home", count: 1 },
        { day, region: "GB", name: "chapter/reopened", key: "chapter.home", count: 1 },
        { day, region: "GB", name: "chapter/reopened", key: "chapter.file", count: 1 },
        { day, region: "GB", name: "route/moved", key: "route.uk-student:granted", count: 1 },
        { day, region: "GB", name: "route/refused", key: "funds", count: 1 },
        { day, region: "GB", name: "offer/chosen", key: "offer.loan:accept", count: 1 },
        { day, region: "GB", name: "place/returned", key: "by-choice", count: 1 },
        { day, region: "GB", name: "lottery/tickets", key: "GB", count: 5 },
        { day, region: "GB", name: "turns/ended", key: "GB", count: 1 },
        { day, region: "GB", name: "players/active", key: "GB", count: 1 },
      ]),
    );
    expect(rows).toHaveLength(10);
  });

  test("[R-ANALYTICS-008] given only the authority's grants and a stand-in's months on a day, when it is counted, then no player is active and no turn is counted as a player's", () => {
    const rows = nightlyTotals(facts([played([], "authority", { type: "turns/grant", count: 1, basedOn: 0 }), played([], "stand-in")]));
    expect(rows).toEqual([]);
  });

  test("[R-ANALYTICS-008] given commands on the days either side, when the day is counted, then only its own are", () => {
    const rows = nightlyTotals(facts([played([], "player", undefined, DAY * time.DAY_MS - 1), played([], "player", undefined, (DAY + 1) * time.DAY_MS)]));
    expect(rows).toEqual([]);
  });

  test("[R-ANALYTICS-007] given an account that is gone, when its character's day is counted, then it is counted under the unknown region and no row names it", () => {
    const rows = nightlyTotals(facts([played([])], null));
    expect(rows.map((row) => [row.region, row.name])).toEqual([
      ["XX", "turns/ended"],
      ["XX", "players/active"],
    ]);
    expect(JSON.stringify(rows)).not.toContain("account.a");
    expect(JSON.stringify(rows)).not.toContain("character.a");
  });
});
