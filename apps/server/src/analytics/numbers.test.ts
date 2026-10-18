import { SESSION_GAP_MINUTES } from "@japacity/content";
import type { BaseEvent, Command, Sender } from "@japacity/sim";
import { time } from "@japacity/sim";
import type { AccountRow, CounterTotal } from "@japacity/store";
import { describe, expect, test } from "vitest";

import type { NumbersFacts } from "./numbers";
import { heldKey, numbersTotals, sessionBand, sessionLengths } from "./numbers";
import type { Life, LifeAt, Played } from "./replay";

const DAY = 20_370;
const START = DAY * time.DAY_MS;
const MIN = time.MINUTE_MS;
const NAME = time.dayName(DAY);

function account(id: string, country = "GB"): AccountRow {
  return { id, country, age: { passed: true, at: 0, method: "declared" }, createdAt: 0, character: `character.${id}`, notifyBankFull: false, sendUsageCounts: true, state: "guest", username: id.replaceAll(/\W/g, "_"), usernameChangedAt: null, lastPlayedAt: 0 };
}

interface Row {
  at: number;
  v?: number;
  events?: object[];
  sender?: Sender;
  command?: Command;
  afterPrologue?: boolean;
  turn?: number;
}

function played({ at, v = 5, events = [], sender = "player", command = { type: "turn/end", slots: [], basedOn: 0 }, afterPrologue = true, turn = 4 }: Row): Played {
  return { row: { character: "character.x", v, tick: 1, sender, command, hash: "h", at }, afterPrologue, turn, events: events as BaseEvent[], lines: [] };
}

function life(owner: string, rows: Row[], atEnd: LifeAt | null = null): Life {
  return { account: owner, played: rows.map(played), atEnd };
}

function facts(lives: { life: Life; account: AccountRow | null }[], over: Partial<NumbersFacts> = {}): NumbersFacts {
  return { day: DAY, active: lives.map((each) => ({ character: "character.x", ...each })), created: [], weekly: [], monthly: [], accounts: [], openReports: [], ...over };
}

const count = (rows: readonly CounterTotal[], name: string, key: string, region = "GB") => rows.find((row) => row.day === NAME && row.name === name && row.key === key && row.region === region)?.count ?? 0;

describe("sessions", () => {
  test("[analytics:session-split-by-command-gaps] given commands with gaps either side of the session gap, when they are split, then a gap of exactly the gap keeps a session and one a minute more starts the next", () => {
    const gap = SESSION_GAP_MINUTES * MIN;
    expect(sessionLengths([START, START + gap])).toEqual([gap]);
    expect(sessionLengths([START, START + gap + MIN])).toEqual([0, 0]);
    expect(sessionLengths([START + 10 * MIN, START, START + 3 * MIN])).toEqual([10 * MIN]);
    expect(sessionLengths([])).toEqual([]);
  });

  test("[analytics:session-split-by-command-gaps] given lengths at each band's edge, when they are banded, then a band runs from its start up to the next band's", () => {
    expect([0, 2 * MIN - 1, 2 * MIN, 5 * MIN - 1, 5 * MIN, 15 * MIN - 1, 15 * MIN, 30 * MIN - 1, 30 * MIN, 5 * time.HOUR_MS].map(sessionBand)).toEqual(["under-2", "under-2", "2-5", "2-5", "5-15", "5-15", "15-30", "15-30", "over-30", "over-30"]);
  });

  test("[analytics:session-split-by-command-gaps] [analytics:nightly-game-counters] given one player's two sessions and a stand-in's months, when the day is counted, then two sessions are counted by region with their lengths, and the stand-in's commands make none", () => {
    const rows = numbersTotals(
      facts([
        { life: life("account.a", [{ at: START }, { at: START + 4 * MIN }, { at: START + 2 * time.HOUR_MS }, { at: START + 2 * time.HOUR_MS + 20 * MIN }]), account: account("account.a") },
        { life: life("account.b", [{ at: START, sender: "stand-in" }, { at: START + 3 * MIN, sender: "authority" }]), account: account("account.b") },
      ]),
    );
    expect(count(rows, "sessions/count", "GB")).toBe(2);
    expect(count(rows, "sessions/length", "2-5")).toBe(1);
    expect(count(rows, "sessions/length", "15-30")).toBe(1);
    expect(rows.filter((row) => row.name.startsWith("sessions/")).reduce((sum, row) => sum + (row.name === "sessions/length" ? row.count : 0), 0)).toBe(2);
  });

  test("[analytics:session-split-by-command-gaps] given commands either side of the day's edges, when the day is counted, then only the day's own make its sessions", () => {
    const rows = numbersTotals(facts([{ life: life("account.a", [{ at: START - 1 }, { at: START + 10 * MIN }, { at: START + time.DAY_MS }]), account: account("account.a") }]));
    expect(count(rows, "sessions/count", "GB")).toBe(1);
    expect(count(rows, "sessions/length", "under-2")).toBe(1);
  });
});

describe("the funnel's server steps and the lives", () => {
  test("[analytics:nightly-game-counters] given a life that begins, reaches the world, ends its first month and closes its first chapter on the day, when it is counted, then each step and the life started are counted once", () => {
    const rows = numbersTotals(
      facts([
        {
          life: life("account.a", [
            { at: START, v: 1, afterPrologue: false, command: { type: "prologue/choose", step: "a", answer: "b", basedOn: 0 } as unknown as Command },
            { at: START + MIN, v: 2, afterPrologue: false, events: [{ type: "prologue/closed" }] },
            { at: START + 2 * MIN, v: 3, turn: 1, events: [{ type: "chapter/closed", chapter: "chapter.home", next: null }] },
            { at: START + 3 * MIN, v: 4, turn: 2, events: [{ type: "chapter/closed", chapter: "chapter.file", next: null }] },
          ]),
          account: account("account.a"),
        },
      ]),
    );
    for (const step of ["begin", "world", "month-1", "chapter-1"]) expect([step, count(rows, "funnel/step", step)]).toEqual([step, 1]);
    expect(count(rows, "lives/started", "GB")).toBe(1);
  });

  test("[analytics:nightly-game-counters] given a life whose steps all came on an earlier day, when a later day is counted, then no step is counted again", () => {
    const rows = numbersTotals(
      facts([
        {
          life: life("account.a", [
            { at: START - time.DAY_MS, v: 1, afterPrologue: false, events: [{ type: "prologue/closed" }] },
            { at: START - time.DAY_MS + MIN, v: 2, turn: 1, events: [{ type: "chapter/closed", chapter: "chapter.home", next: null }] },
            { at: START + MIN, v: 3, turn: 2, events: [{ type: "chapter/closed", chapter: "chapter.file", next: null }] },
          ]),
          account: account("account.a"),
        },
      ]),
    );
    expect(rows.filter((row) => row.name === "funnel/step" || row.name === "lives/started")).toEqual([]);
  });

  test("[analytics:nightly-game-counters] given departures, a settlement then citizenship, and a top-up on the day, when it is counted, then each departure, the life secured once, and the top-up's count and kobo are counted", () => {
    const rows = numbersTotals(
      facts([
        {
          life: life("account.a", [
            { at: START, events: [{ type: "route/moved", route: "route.uk-student", to: "departed" }, { type: "route/moved", route: "route.uk-student", to: "granted" }] },
            { at: START + MIN, events: [{ type: "status/granted", why: "settled" }, { type: "wallet/credited", currency: "NGN", amount: 500_000, reason: "top-up" }] },
            { at: START + 2 * MIN, events: [{ type: "status/granted", why: "citizen" }, { type: "wallet/credited", currency: "NGN", amount: 250_000, reason: "top-up" }, { type: "wallet/credited", currency: "NGN", amount: 9_000, reason: "salary" }] },
          ]),
          account: account("account.a"),
        },
        { life: life("account.b", [{ at: START, events: [{ type: "route/moved", route: "route.uk-skilled", to: "departed" }] }]), account: account("account.b", "NG") },
      ]),
    );
    expect(count(rows, "japa/departed", "GB")).toBe(1);
    expect(count(rows, "japa/departed", "NG", "NG")).toBe(1);
    expect(count(rows, "lives/secured", "GB")).toBe(1);
    expect(count(rows, "wallet/topped-up", "count")).toBe(2);
    expect(count(rows, "wallet/topped-up", "kobo")).toBe(750_000);
  });
});

describe("the economy in bands", () => {
  test("[analytics:nightly-game-counters] given naira and months at each band's edge, when they are keyed, then the bands meet where the page puts them", () => {
    expect(heldKey(1, 0)).toBe("1-3:0");
    expect(heldKey(3, 1)).toBe("1-3:under-50k");
    expect(heldKey(4, 4_999_999)).toBe("4-12:under-50k");
    expect(heldKey(12, 5_000_000)).toBe("4-12:50k-500k");
    expect(heldKey(13, 50_000_000)).toBe("13+:50k-500k");
    expect(heldKey(40, 50_000_001)).toBe("13+:over-500k");
    expect(heldKey(2, -100)).toBe("1-3:0");
  });

  test("[analytics:nightly-game-counters] [analytics:store-holds-nothing-personal] given lives at the day's end, one still in the years before, when the day is counted, then the others are counted by band and no figure for one life is kept", () => {
    const rows = numbersTotals(
      facts([
        { life: life("account.a", [{ at: START }], { prologueOpen: false, months: 0, nairaKobo: 7_654_321 }), account: account("account.a") },
        { life: life("account.b", [{ at: START }], { prologueOpen: false, months: 14, nairaKobo: 0 }), account: account("account.b") },
        { life: life("account.c", [{ at: START }], { prologueOpen: true, months: 0, nairaKobo: 100 }), account: account("account.c") },
      ]),
    );
    expect(rows.filter((row) => row.name === "economy/held").map((row) => [row.key, row.count])).toEqual([
      ["1-3:50k-500k", 1],
      ["13+:0", 1],
    ]);
    expect(JSON.stringify(rows)).not.toContain("7654321");
  });
});

describe("players, accounts and reports by region", () => {
  test("[analytics:nightly-game-counters] given the week's, the month's and every account's counts, new accounts and open reports, when the day is counted, then each is kept on the day by region, every new account a guest", () => {
    const rows = numbersTotals(
      facts([], {
        created: [account("account.n", "NG"), account("account.m", "NG"), account("account.g")],
        weekly: [{ region: "NG", count: 30 }],
        monthly: [{ region: "NG", count: 90 }, { region: "XX", count: 2 }],
        accounts: [{ region: "NG", count: 400 }],
        openReports: [{ reason: "scam", region: "NG" }, { reason: "scam", region: "NG" }, { reason: "hate", region: "GB" }],
      }),
    );
    expect(count(rows, "players/guest", "NG", "NG")).toBe(2);
    expect(count(rows, "players/guest", "GB")).toBe(1);
    expect(count(rows, "players/weekly", "NG", "NG")).toBe(30);
    expect(count(rows, "players/monthly", "XX", "XX")).toBe(2);
    expect(count(rows, "players/total", "NG", "NG")).toBe(400);
    expect(count(rows, "moderation/open", "scam", "NG")).toBe(2);
    expect(count(rows, "moderation/open", "hate")).toBe(1);
  });

  test("[analytics:store-holds-nothing-personal] given a day of play by two accounts, when it is counted, then no row names an account or a character", () => {
    const rows = numbersTotals(
      facts([
        { life: life("account.secret-a", [{ at: START, v: 1 }, { at: START + MIN, events: [{ type: "route/moved", route: "route.uk-student", to: "departed" }] }], { prologueOpen: false, months: 3, nairaKobo: 10 }), account: account("account.secret-a") },
        { life: life("account.secret-b", [{ at: START }]), account: null },
      ]),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain("secret");
    expect(JSON.stringify(rows)).not.toContain("character.");
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["count", "day", "key", "name", "region"]);
    expect(count(rows, "sessions/count", "XX", "XX")).toBe(1);
  });
});
