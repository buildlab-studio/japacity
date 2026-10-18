import type { AccountRow, CounterTotal, DayLog } from "@japacity/store";
import { time, type Id } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { noteActive } from "../ops/active";
import { isolateDayLog } from "../analytics/daylog";
import { newLife, restMonth, send, signUp, testServer, view } from "../authority/authority.testing";
import type { TestServer } from "../authority/authority.testing";
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

/** A month whose one act is the life's sure first hunt, sent at once (guide:early-win-in-three-turns, activity:now-acts-and-month-acts). */
async function huntMonth(server: TestServer, account: string): Promise<void> {
  const seen = await view(server, account);
  if (!seen.body.ok) throw new Error(seen.body.detail);
  const job = seen.body.view.activities.find((option) => option.id === HUNT && option.allowed)?.params?.[0];
  if (job === undefined) throw new Error("No job to hunt.");
  const hunted = await send(server, account, { type: "activity/now", activity: HUNT, param: job, basedOn: seen.body.view.v });
  if (!hunted.body.ok) throw new Error(`${hunted.body.code}: ${hunted.body.detail}`);
  await months(server, account, 1);
}

async function totals(server: TestServer): Promise<CounterTotal[]> {
  return server.deps.stores.counters.days("2000-01-01", "2100-01-01");
}

const HUNT: Id<"activity"> = "activity.job-hunt";

const pick = (rows: readonly CounterTotal[], day: string, name: string, key: string) => rows.find((row) => row.day === day && row.name === name && row.key === key)?.count ?? 0;

describe("the nightly counters job", () => {
  test("[analytics:nightly-game-counters] [analytics:game-counters-from-server] given a day of play, when the job counts it, then active and new players, turns ended and the route heard are counted from the log by region", async () => {
    const server = testServer();
    const day = time.utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await signUp(server, "account.idle");
    await months(server, "account.ada", 3);

    const result = await countDay(server.deps, knownDayLog(server, [ada], ["account.ada", "account.idle"]), day);
    expect(result).toEqual({ day: time.dayName(day), added: true, skipped: [] });

    const rows = await totals(server);
    const today = time.dayName(day);
    expect(pick(rows, today, "players/active", "NG")).toBe(1);
    expect(pick(rows, today, "players/new", "NG")).toBe(2);
    expect(pick(rows, today, "turns/ended", "NG")).toBe(3);
    expect(rows.filter((row) => row.name === "route/moved").map((row) => row.key.endsWith(":heard"))).toEqual([true]);
    for (const row of rows) expect(row.region).toBe("NG");
  });

  test("[analytics:nightly-game-counters] given a day counted once, when the job runs for it again, then nothing more is added", async () => {
    const server = testServer();
    const day = time.utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await months(server, "account.ada", 2);
    const log = knownDayLog(server, [ada], ["account.ada"]);

    await countDay(server.deps, log, day);
    const once = await totals(server);
    expect(once.length).toBeGreaterThan(0);

    expect((await countDay(server.deps, log, day)).added).toBe(false);
    expect(await totals(server)).toEqual(once);
  });

  test("[analytics:day-one-and-seven-return] [analytics:nightly-game-counters] given an account that plays on the day after it signed up and again a week on, when those days are counted, then day-1, day-3 and day-7 returns are kept on the sign-up day", async () => {
    const server = testServer();
    const signUpDay = time.utcDay(server.deps.now());
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
    expect(pick(rows, time.dayName(signUpDay), "players/returned", "d1")).toBe(1);
    expect(pick(rows, time.dayName(signUpDay), "players/returned", "d3")).toBe(1);
    expect(pick(rows, time.dayName(signUpDay), "players/returned", "d7")).toBe(1);
    expect(pick(rows, time.dayName(signUpDay), "players/returned", "d30")).toBe(0);
    expect(rows.filter((row) => row.name === "players/returned")).toHaveLength(3);
    expect(pick(rows, time.dayName(signUpDay + 3), "players/active", "NG")).toBe(1);
  });

  test("[analytics:day-one-and-seven-return] given a new account that reaches its early win in the third month and one that never plays, when its first day is counted, then the early win is keyed 3 and the other none", async () => {
    const server = testServer();
    const day = time.utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await signUp(server, "account.idle");
    await months(server, "account.ada", 2);
    await huntMonth(server, "account.ada");

    await countDay(server.deps, knownDayLog(server, [ada], ["account.ada", "account.idle"]), day);
    const rows = await totals(server);
    expect(pick(rows, time.dayName(day), "first/early-win", "3")).toBe(1);
    expect(pick(rows, time.dayName(day), "first/early-win", "none")).toBe(1);
    expect(rows.filter((row) => row.name === "first/early-win").reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  test("[analytics:day-one-and-seven-return] [guide:early-win-in-three-turns] given a new account that only rests and hears of a route in its third month, when its first day is counted, then the route it never chose is no early win and it is keyed none", async () => {
    const server = testServer();
    const day = time.utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await months(server, "account.ada", 3);

    await countDay(server.deps, knownDayLog(server, [ada], ["account.ada"]), day);
    const rows = await totals(server);
    expect(pick(rows, time.dayName(day), "first/early-win", "none")).toBe(1);
    expect(rows.filter((row) => row.name === "first/early-win").reduce((sum, row) => sum + row.count, 0)).toBe(1);
  });

  test("[analytics:day-one-and-seven-return] [guide:early-win-in-three-turns] given a new account whose first month's job hunt lands, when its first day is counted, then the early win is keyed 1", async () => {
    const server = testServer();
    const day = time.utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await huntMonth(server, "account.ada");

    await countDay(server.deps, knownDayLog(server, [ada], ["account.ada"]), day);
    expect(pick(await totals(server), time.dayName(day), "first/early-win", "1")).toBe(1);
  });

  test("[analytics:day-one-and-seven-return] given a new account whose early win comes only after its first day ends, when that day is counted, then it is keyed none", async () => {
    const server = testServer();
    const day = time.utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await months(server, "account.ada", 1);
    server.wait(time.DAY_MS);
    await huntMonth(server, "account.ada");

    await countDay(server.deps, knownDayLog(server, [ada], ["account.ada"]), day);
    expect(pick(await totals(server), time.dayName(day), "first/early-win", "none")).toBe(1);
  });

  test("[analytics:nightly-game-counters] given the job at midnight, when it runs with the isolate's active list, then it counts the day that has just ended", async () => {
    const server = testServer();
    const day = time.utcDay(server.deps.now());
    const ada = await newLife(server, "account.ada");
    await months(server, "account.ada", 1);
    noteActive(server.deps, ada, day);
    server.setNow((day + 1) * time.DAY_MS);

    const result = await countersJob(server.deps, isolateDayLog(server.deps));
    expect(result).toEqual({ day: time.dayName(day), added: true, skipped: [] });
    const rows = await totals(server);
    expect(pick(rows, time.dayName(day), "players/active", "NG")).toBe(1);
    expect(pick(rows, time.dayName(day), "players/new", "NG")).toBe(1);
  });
});
