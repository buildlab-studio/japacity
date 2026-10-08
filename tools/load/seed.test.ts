import { describe, expect, test } from "vitest";

import { content } from "../../packages/content/src/index";
import { rampArrivals, steadyArrivals } from "./drive";
import { config, planFor, scaled } from "./load.config";
import { pairPlan, seedPlan } from "./seed";

const scenarios = Object.keys(content.scenario);

describe("the seeding and the arrivals", () => {
  test("[R-LOAD-002] [R-LOAD-006] given the tenth plan, when it is made twice, then it is the same, every scenario is used, and the months run from 0 to warmTurns with both edges met", () => {
    const load = scaled(config.load, 10);
    const plan = seedPlan(load, scenarios);
    expect(seedPlan(load, scenarios)).toEqual(plan);
    expect(plan).toHaveLength(10_000);
    expect(new Set(plan.map((each) => each.account)).size).toBe(10_000);
    expect(new Set(plan.map((each) => each.scenario))).toEqual(new Set(scenarios));
    const months = plan.map((each) => each.warm);
    expect(Math.min(...months)).toBe(0);
    expect(Math.max(...months)).toBe(load.warmTurns);
    expect(seedPlan({ ...load, warmTurns: 0 }, scenarios).every((each) => each.warm === 0)).toBe(true);
    expect(() => seedPlan(load, [])).toThrow();
  });

  test("[R-LOAD-002] given a pair share of 10%, when the pairs are planned, then a tenth of the accounts are joined two by two and none twice", () => {
    const accounts = Array.from({ length: 1000 }, (_, at) => `load-${String(at)}`);
    const pairs = pairPlan(accounts, config.load.pairShareBp);
    expect(pairs).toHaveLength(50);
    expect(new Set(pairs.flat()).size).toBe(100);
    expect(pairPlan(accounts.slice(0, 30), config.load.pairShareBp)).toHaveLength(1);
    expect(pairPlan(accounts.slice(0, 19), config.load.pairShareBp)).toHaveLength(0);
    expect(pairPlan(accounts, 0)).toEqual([]);
  });

  test("[R-LOAD-003] given the ramp, when its arrivals are laid out, then they rise in order to the rate within the minute, and the steady part sends the rate each second", () => {
    const plan = planFor(scaled(config.load, 10), 10);
    const ramp = rampArrivals(plan.commandsPerSecond, plan.rampSeconds, plan.rampIterations);
    expect(ramp).toHaveLength(42 * 30);
    expect(ramp.every((at, index) => index === 0 || at >= (ramp[index - 1] ?? 0))).toBe(true);
    expect(ramp.at(-1)).toBeLessThanOrEqual(plan.rampSeconds * 1000);
    expect(ramp.filter((at) => at < 30_000).length).toBeLessThan(ramp.filter((at) => at >= 30_000).length);
    const steady = steadyArrivals(plan.commandsPerSecond, 60_000, plan.target);
    expect(steady).toHaveLength(plan.target);
    expect(steady.filter((at) => at >= 60_000 && at < 61_000)).toHaveLength(42);
    expect(steady.filter((at) => at >= 659_000)).toHaveLength(42);
  });
});
