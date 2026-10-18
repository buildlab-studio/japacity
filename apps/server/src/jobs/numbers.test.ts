import type { AccountRow, CounterTotal, DayLog, NumbersLog, RegionCount } from "@japacity/store";
import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { utcDay } from "../admin/day";
import { dayName } from "../analytics/day";
import { newLife, restMonth, send, signUp, testServer, view } from "../authority/authority.testing";
import type { TestServer } from "../authority/authority.testing";
import { countDay } from "./counters";

/** The day's log and the counts by region over the characters and accounts a test made, read from the memory stores. */
function knownLogs(server: TestServer, characters: readonly string[], accounts: readonly string[]): DayLog & NumbersLog {
  const { player, account } = server.deps.stores;
  const byRegion = (regions: readonly string[]): RegionCount[] => {
    const found = new Map<string, number>();
    for (const region of regions) found.set(region, (found.get(region) ?? 0) + 1);
    return [...found.entries()].map(([region, count]) => ({ region, count }));
  };
  return {
    active: async (start, end) => {
      const found: string[] = [];
      for (const character of characters) if ((await player.log(character, 0)).some((row) => row.at >= start && row.at < end)) found.push(character);
      return found;
    },
    created: async (start, end) => {
      const found: AccountRow[] = [];
      for (const id of accounts) {
        const row = await account.get(id);
        if (row !== null && row.createdAt >= start && row.createdAt < end) found.push(row);
      }
      return found;
    },
    players: async (start, end) => {
      const regions: string[] = [];
      for (const character of characters) {
        const held = await player.load(character);
        const row = held === null ? null : await account.get(held.character.account);
        if ((await player.log(character, 0)).some((each) => each.sender === "player" && each.at >= start && each.at < end)) regions.push(row?.country ?? "XX");
      }
      return byRegion(regions);
    },
    accounts: async (end) => {
      const regions: string[] = [];
      for (const id of accounts) {
        const row = await account.get(id);
        if (row !== null && row.createdAt < end) regions.push(row.country);
      }
      return byRegion(regions);
    },
  };
}

async function months(server: TestServer, account: string, count: number): Promise<void> {
  for (let played = 0; played < count; played += 1) {
    const seen = await view(server, account);
    if (!seen.body.ok) throw new Error(seen.body.detail);
    const sent = await send(server, account, restMonth(seen.body.view));
    if (!sent.body.ok) throw new Error(`${sent.body.code}: ${sent.body.detail}`);
    server.wait(time.MINUTE_MS);
  }
}

const pick = (rows: readonly CounterTotal[], day: string, name: string, key: string) => rows.find((row) => row.day === day && row.name === name && row.key === key)?.count ?? 0;

describe("the nightly job's numbers for the admin", () => {
  test("[R-ANALYTICS-008] [R-ANALYTICS-013] given a day of play with the counts by region, when the job counts it, then the life started, its first month, its session, its economy in its fourth month, the week's, month's and all players are counted from the log by region", async () => {
    const server = testServer();
    const day = utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await signUp(server, "account.idle");
    await months(server, "account.ada", 3);

    await countDay(server.deps, knownLogs(server, [ada], ["account.ada", "account.idle"]), day, knownLogs(server, [ada], ["account.ada", "account.idle"]));
    const rows = await server.deps.stores.counters.days("2000-01-01", "2100-01-01");
    const today = dayName(day);
    expect(pick(rows, today, "lives/started", "NG")).toBe(1);
    expect(pick(rows, today, "funnel/step", "begin")).toBe(1);
    expect(pick(rows, today, "funnel/step", "month-1")).toBe(1);
    expect(pick(rows, today, "sessions/count", "NG")).toBe(1);
    expect(pick(rows, today, "sessions/length", "2-5")).toBe(1);
    expect(rows.filter((row) => row.name === "economy/held").map((row) => [row.key.split(":")[0], row.count])).toEqual([["4-12", 1]]);
    expect(pick(rows, today, "players/weekly", "NG")).toBe(1);
    expect(pick(rows, today, "players/monthly", "NG")).toBe(1);
    expect(pick(rows, today, "players/total", "NG")).toBe(2);
    expect(pick(rows, today, "players/guest", "NG")).toBe(2);
    for (const row of rows) expect(row.region).toBe("NG");
  });

  test("[R-ANALYTICS-008] given a player seen six days before the day counted and another 29 days before, when the day is counted, then the week holds one and the month both", async () => {
    const server = testServer();
    const first = utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await months(server, "account.ada", 1);
    server.wait(23 * time.DAY_MS);
    const bola = await newLife(server, "account.bola");
    await months(server, "account.bola", 1);
    const day = first + 29;
    server.setNow(day * time.DAY_MS + time.HOUR_MS);

    const logs = knownLogs(server, [ada, bola], ["account.ada", "account.bola"]);
    await countDay(server.deps, logs, day, logs);
    const rows = await server.deps.stores.counters.days("2000-01-01", "2100-01-01");
    expect(pick(rows, dayName(day), "players/weekly", "NG")).toBe(1);
    expect(pick(rows, dayName(day), "players/monthly", "NG")).toBe(2);
    expect(pick(rows, dayName(day), "players/active", "NG")).toBe(0);
  });

  test("[R-ANALYTICS-008] given an open report as the day ends, when the day is counted, then it is counted by its reason under its reporter's region", async () => {
    const server = testServer();
    const day = utcDay(server.deps.now());
    await signUp(server, "account.ada");
    await signUp(server, "account.bola");
    const filed = await server.deps.stores.moderation.report(
      { id: "report.1", reporter: "account.ada", subject: { account: "account.bola" }, reason: "scam", cites: { messages: [] }, pair: null, unverified: false, at: server.deps.now() },
      { messages: [], pair: null, until: server.deps.now() + time.DAY_MS },
    );
    expect(filed.ok).toBe(true);

    await countDay(server.deps, knownLogs(server, [], []), day);
    const rows = await server.deps.stores.counters.days("2000-01-01", "2100-01-01");
    expect(rows.filter((row) => row.name === "moderation/open")).toEqual([{ day: dayName(day), region: "NG", name: "moderation/open", key: "scam", count: 1 }]);
  });
});
