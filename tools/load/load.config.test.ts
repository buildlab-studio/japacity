import { describe, expect, test } from "vitest";

import { bpFraction, config, DAY, MIX, planFor, RAMP_SECONDS, readRates, scaled } from "./load.config";

describe("the load test's numbers", () => {
  test("[R-LOAD-002] [R-LOAD-003] [R-LOAD-004] [R-LOAD-009] given the page's Numbers table, when the config is read, then every value matches it", () => {
    expect(config.load).toEqual({
      accounts: 100_000,
      warmTurns: 60,
      pairShareBp: 1000,
      staleShareBp: 100,
      commandsPerSecond: 420,
      requestsPerSecond: 3500,
      minutes: 10,
      p95Ms: 100,
      p99Ms: 250,
      unexpectedBp: 10,
      seed: config.load.seed,
    });
    expect(Number.isSafeInteger(config.load.seed)).toBe(true);
  });

  test("[R-LOAD-003] given the mix, when its shares are added, then they make the whole in the page's order, with a one-minute ramp", () => {
    expect(MIX.map((entry) => [entry.kind, entry.bp])).toEqual([
      ["turn/end", 5000],
      ["offer/choose", 1500],
      ["wallet/convert", 1000],
      ["obligation/pay", 1000],
      ["setpiece/answer", 1000],
      ["pair", 500],
    ]);
    expect(MIX.reduce((sum, entry) => sum + entry.bp, 0)).toBe(10000);
    expect(RAMP_SECONDS).toBe(60);
  });

  test("[R-LOAD-005] given the peak, when the reads are worked out, then commands and reads make requestsPerSecond, heartbeats in the research file's proportion", () => {
    for (const load of [config.load, scaled(config.load, 10), scaled(config.load, 1000)]) {
      const reads = readRates(load);
      expect(load.commandsPerSecond + reads.heartbeats + reads.views + reads.worlds).toBe(load.requestsPerSecond);
      expect(reads.heartbeats * (DAY.heartbeats + DAY.reads)).toBeLessThanOrEqual((load.requestsPerSecond - load.commandsPerSecond) * DAY.heartbeats);
      expect(Math.abs(reads.views - reads.worlds)).toBeLessThanOrEqual(1);
    }
    expect(readRates(config.load)).toEqual({ heartbeats: 2236, views: 422, worlds: 422 });
  });

  test("[R-LOAD-009] given a tenth of the target, when it is scaled, then counts and rates shrink and every threshold and the seed stay", () => {
    const tenth = scaled(config.load, 10);
    expect(tenth).toEqual({ ...config.load, accounts: 10_000, commandsPerSecond: 42, requestsPerSecond: 350 });
    expect(scaled(config.load, 1)).toEqual(config.load);
    expect(scaled(config.load, 1_000_000).commandsPerSecond).toBe(1);
    expect(() => scaled(config.load, 0)).toThrow();
  });

  test("[R-LOAD-009] given the full plan, when its target is worked out, then it is the rate times the duration and fewer than 1% may drop", () => {
    const plan = planFor(config.load, 1);
    expect(plan.target).toBe(420 * 600);
    expect(plan.droppedMax).toBe(2519);
    expect(plan.droppedMax * 100).toBeLessThan(plan.target);
    expect((plan.droppedMax + 1) * 100).toBe(plan.target);
    expect(plan.rampIterations).toBe(420 * 30);
    expect(plan.unexpectedFraction).toBe("0.0010");
  });

  test("[R-LOAD-009] given basis points, when they are written as a fraction for k6, then each edge reads right", () => {
    expect(bpFraction(0)).toBe("0.0000");
    expect(bpFraction(1)).toBe("0.0001");
    expect(bpFraction(10)).toBe("0.0010");
    expect(bpFraction(9999)).toBe("0.9999");
    expect(bpFraction(10000)).toBe("1.0000");
  });
});
