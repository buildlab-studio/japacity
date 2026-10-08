import type { AccountRow, CounterTotal, DayLog } from "@japacity/store";
import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { noteActive } from "../admin/active";
import { utcDay } from "../admin/day";
import { isolateDayLog } from "../analytics/daylog";
import { dayName } from "../analytics/day";
import { newLife, restMonth, send, signUp, testServer, view } from "../authority/testing";
import type { TestServer } from "../authority/testing";
import { countDay, countersJob } from "./counters";

/** The day's log over the characters and accounts a test made, read from the memory stores. */
function knownDayLog(server: TestServer, characters: readonly string[], accounts: readonly string[]): DayLog {
  return {
    active: async (start, end) => {
      const found: string[] = [];
      for (const character of characters) {
        const rows = await server.deps.stores.player.log(character, 0);
        if (rows.some((row) => row.at >= start && row.at < end)) found.push(character);
      }
      return found;
    },
    created: async (start, end) => {
      const found: AccountRow[] = [];
      for (const id of accounts) {
        const row = await server.deps.stores.account.get(id);
        if (row !== null && row.createdAt >= start && row.createdAt < end) found.push(row);
      }
      return found;
    },
  };
}

async function months(server: TestServer, account: string, count: number): Promise<void> {
  for (let played = 0; played < count; played += 1) {
    const seen = await view(server, account);
    if (!seen.body.ok) throw new Error(seen.body.detail);
    const sent = await send(server, account, restMonth(seen.body.view));
    if (!sent.body.ok) throw new Error(`${sent.body.code}: ${sent.body.detail}`);
  }
}

async function totals(server: TestServer): Promise<CounterTotal[]> {
  return server.deps.stores.counters.days("2000-01-01", "2100-01-01");
}

const pick = (rows: readonly CounterTotal[], day: string, name: string, key: string) => rows.find((row) => row.day === day && row.name === name && row.key === key)?.count ?? 0;

describe("the nightly counters job", () => {
  test("[R-ANALYTICS-008] [R-ANALYTICS-001] given a day of play, when the job counts it, then active and new players, turns ended and the route heard are counted from the log by region", async () => {
    const server = testServer();
    const day = utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await signUp(server, "account.idle");
    await months(server, "account.ada", 3);

    const result = await countDay(server.deps, knownDayLog(server, [ada], ["account.ada", "account.idle"]), day);
    expect(result).toEqual({ day: dayName(day), added: true, skipped: [] });

    const rows = await totals(server);
    const today = dayName(day);
    expect(pick(rows, today, "players/active", "NG")).toBe(1);
    expect(pick(rows, today, "players/new", "NG")).toBe(2);
    expect(pick(rows, today, "turns/ended", "NG")).toBe(3);
    expect(rows.filter((row) => row.name === "route/moved").map((row) => row.key.endsWith(":heard"))).toEqual([true]);
    for (const row of rows) expect(row.region).toBe("NG");
  });

  test("[R-ANALYTICS-008] given a day counted once, when the job runs for it again, then nothing more is added", async () => {
    const server = testServer();
    const day = utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await months(server, "account.ada", 2);
    const log = knownDayLog(server, [ada], ["account.ada"]);

    await countDay(server.deps, log, day);
    const once = await totals(server);
    expect(once.length).toBeGreaterThan(0);

    expect((await countDay(server.deps, log, day)).added).toBe(false);
    expect(await totals(server)).toEqual(once);
  });

  test("[R-ANALYTICS-011] [R-ANALYTICS-008] given an account that plays on the day after it signed up and again a week on, when those days are counted, then day-1 and day-7 returns are kept on the sign-up day", async () => {
    const server = testServer();
    const signUpDay = utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await months(server, "account.ada", 1);
    const log = knownDayLog(server, [ada], ["account.ada"]);

    server.wait(time.DAY_MS);
    await months(server, "account.ada", 1);
    await countDay(server.deps, log, signUpDay + 1);
    server.wait(2 * time.DAY_MS);
    await months(server, "account.ada", 1);
    await countDay(server.deps, log, signUpDay + 3);
    server.wait(4 * time.DAY_MS);
    await months(server, "account.ada", 1);
    await countDay(server.deps, log, signUpDay + 7);

    const rows = await totals(server);
    expect(pick(rows, dayName(signUpDay), "players/returned", "d1")).toBe(1);
    expect(pick(rows, dayName(signUpDay), "players/returned", "d7")).toBe(1);
    expect(pick(rows, dayName(signUpDay), "players/returned", "d30")).toBe(0);
    expect(rows.filter((row) => row.name === "players/returned")).toHaveLength(2);
    expect(pick(rows, dayName(signUpDay + 3), "players/active", "NG")).toBe(1);
  });

  test("[R-ANALYTICS-011] given a new account that reaches its early win in the third month and one that never plays, when its first day is counted, then the early win is keyed 3 and the other none", async () => {
    const server = testServer();
    const day = utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await signUp(server, "account.idle");
    await months(server, "account.ada", 4);

    await countDay(server.deps, knownDayLog(server, [ada], ["account.ada", "account.idle"]), day);
    const rows = await totals(server);
    expect(pick(rows, dayName(day), "first/early-win", "3")).toBe(1);
    expect(pick(rows, dayName(day), "first/early-win", "none")).toBe(1);
    expect(rows.filter((row) => row.name === "first/early-win").reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  test("[R-ANALYTICS-011] given a new account whose early win comes only after its first day ends, when that day is counted, then it is keyed none", async () => {
    const server = testServer();
    const day = utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await months(server, "account.ada", 1);
    server.wait(time.DAY_MS);
    await months(server, "account.ada", 3);

    await countDay(server.deps, knownDayLog(server, [ada], ["account.ada"]), day);
    expect(pick(await totals(server), dayName(day), "first/early-win", "none")).toBe(1);
  });

  test("[R-ANALYTICS-008] given the job at midnight, when it runs with the isolate's active list, then it counts the day that has just ended", async () => {
    const server = testServer();
    const day = utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await months(server, "account.ada", 1);
    noteActive(server.deps, ada, day);
    server.setNow((day + 1) * time.DAY_MS);

    const result = await countersJob(server.deps, isolateDayLog(server.deps));
    expect(result).toEqual({ day: dayName(day), added: true, skipped: [] });
    const rows = await totals(server);
    expect(pick(rows, dayName(day), "players/active", "NG")).toBe(1);
    expect(pick(rows, dayName(day), "players/new", "NG")).toBe(1);
  });
});
