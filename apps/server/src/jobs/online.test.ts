import { ONLINE_MINUTES } from "@japacity/content";
import { time } from "@japacity/sim";
import type { NumbersLog, RegionCount } from "@japacity/store";
import { describe, expect, test } from "vitest";

import { testServer } from "../authority/authority.testing";
import { onlineAt, onlineJob, samplePeak } from "./online";
import { TICKS_CRON } from "./ticks";

/** A log whose players are commands at the given moments in the given regions. */
function logOf(commands: readonly { at: number; region: string; account: string }[]): Pick<NumbersLog, "players"> {
  return {
    players: (start, end) => {
      const seen = new Map<string, Set<string>>();
      for (const { at, region, account } of commands) if (at >= start && at < end) seen.set(region, (seen.get(region) ?? new Set()).add(account));
      return Promise.resolve([...seen.entries()].map(([region, accounts]): RegionCount => ({ region, count: accounts.size })));
    },
  };
}

describe("online now and the day's peak", () => {
  test("[R-ANALYTICS-013] given commands just inside and just outside the online minutes, when online now is read, then only the accounts inside are counted, each once", async () => {
    const now = Date.UTC(2026, 9, 11, 12, 0, 0);
    const edge = now - ONLINE_MINUTES * time.MINUTE_MS;
    const log = logOf([
      { at: edge, region: "NG", account: "a" },
      { at: now, region: "NG", account: "a" },
      { at: now, region: "NG", account: "b" },
      { at: edge - 1, region: "GB", account: "c" },
      { at: now + 1, region: "GB", account: "d" },
    ]);
    expect(await onlineAt(log, now)).toEqual([{ region: "NG", count: 2 }]);
  });

  test("[R-ANALYTICS-013] given samples that rise and fall through a day, when each is taken, then each region and the whole game (region all) keep their highest sample of the day and a new day starts again", async () => {
    const server = testServer();
    const day = time.utcDay(server.deps.now());
    const peak = async (on: number) => (await server.deps.stores.counters.days(time.dayName(on), time.dayName(on))).filter((row) => row.name === "players/online-peak");

    await samplePeak(server.deps, [{ region: "NG", count: 4 }]);
    await samplePeak(server.deps, [{ region: "NG", count: 9 }, { region: "GB", count: 2 }]);
    expect(await samplePeak(server.deps, [{ region: "NG", count: 3 }, { region: "GB", count: 2 }])).toEqual([]);
    expect(await peak(day)).toEqual([
      { day: time.dayName(day), region: "GB", name: "players/online-peak", key: "peak", count: 2 },
      { day: time.dayName(day), region: "NG", name: "players/online-peak", key: "peak", count: 9 },
      { day: time.dayName(day), region: "all", name: "players/online-peak", key: "peak", count: 11 },
    ]);

    server.setNow((day + 1) * time.DAY_MS);
    await samplePeak(server.deps, [{ region: "NG", count: 1 }]);
    expect((await peak(day + 1)).map((row) => [row.region, row.count])).toEqual([
      ["NG", 1],
      ["all", 1],
    ]);
  });

  test("[R-ANALYTICS-013] given the five-minute cron and the daily one, when the job runs, then only the five-minute cron samples", async () => {
    const server = testServer();
    const log = logOf([{ at: server.deps.now(), region: "NG", account: "a" }]);
    expect(await onlineJob(server.deps, log, "0 0 * * *")).toEqual([]);
    expect(await onlineJob(server.deps, log, TICKS_CRON)).toEqual([{ region: "NG", count: 1 }]);
    const day = time.dayName(time.utcDay(server.deps.now()));
    expect((await server.deps.stores.counters.days(day, day)).map((row) => [row.name, row.key, row.count])).toEqual([
      ["players/online-peak", "peak", 1],
      ["players/online-peak", "peak", 1],
    ]);
  });
});
