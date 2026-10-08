import { describe, expect, test } from "vitest";

import { config, planFor, scaled } from "./load.config";
import { fromK6, ms, passRule, percentile } from "./pass";
import type { RunResult } from "./pass";

const plan = planFor(scaled(config.load, 10), 10);

/** A run that meets every check by the smallest margin it can. */
function edgeRun(over: Partial<RunResult> = {}): RunResult {
  return {
    tool: "test",
    scenario: "commands",
    startedAt: 0,
    endedAt: 1,
    target: 10000,
    sent: 9900,
    dropped: 100,
    medUs: 1000,
    p95Us: plan.p95Ms * 1000,
    p99Us: plan.p99Ms * 1000,
    maxUs: 300000,
    accepted: 9800,
    staleExpected: 99,
    rateLimited: 0,
    // Under 10 in 10,000 of 9,900 sent: 9 is the most.
    unexpected: 9,
    serverErrors: 0,
    connectionErrors: 0,
    fallbacks: 0,
    ended: 0,
    viewFailures: 0,
    viewP95Us: 0,
    wanted: {},
    sentKinds: {},
    reads: null,
    ...over,
  };
}

const failing = (result: RunResult) => passRule(result, plan).checks.filter((check) => !check.ok).map((check) => check.name);

describe("the pass rule", () => {
  test("[R-LOAD-009] given a run at every threshold's edge, when it is judged, then it passes", () => {
    expect(passRule(edgeRun(), plan).verdict).toBe("pass");
  });

  test("[R-LOAD-009] given one command fewer than 99% of the target, when it is judged, then it fails on commands sent", () => {
    expect(failing(edgeRun({ sent: 9899, dropped: 101 }))).toEqual(["Commands sent against the target"]);
  });

  test("[R-LOAD-009] given the 95th or 99th percentile one microsecond over, when it is judged, then it fails on that check alone", () => {
    expect(failing(edgeRun({ p95Us: plan.p95Ms * 1000 + 1 }))).toEqual(["Time per command, 95th percentile"]);
    expect(failing(edgeRun({ p99Us: plan.p99Ms * 1000 + 1 }))).toEqual(["Time per command, 99th percentile"]);
  });

  test("[R-LOAD-009] given one server error, when it is judged, then it fails", () => {
    expect(passRule(edgeRun({ serverErrors: 1 }), plan).verdict).toBe("fail");
  });

  test("[R-LOAD-009] given unexpected rejections at the limit, rate limits among them, when it is judged, then it fails; expected stale answers never count", () => {
    expect(failing(edgeRun({ unexpected: 10 }))).toEqual(["Unexpected rejections"]);
    expect(failing(edgeRun({ unexpected: 5, rateLimited: 5 }))).toEqual(["Unexpected rejections"]);
    expect(failing(edgeRun({ staleExpected: 5000 }))).toEqual([]);
  });

  test("[R-LOAD-008] given a connection error on this machine, when it is judged, then the run is to be repeated, never read as the server's failure", () => {
    const judged = passRule(edgeRun({ connectionErrors: 1 }), plan);
    expect(judged.verdict).toBe("repeat");
    expect(judged.checks.filter((check) => !check.ok).map((check) => check.name)).toEqual(["Connection errors on this machine"]);
    expect(passRule(edgeRun({ connectionErrors: 1, serverErrors: 1 }), plan).verdict).toBe("repeat");
  });

  test("[R-LOAD-009] given sorted times, when a percentile is read, then it is the nearest rank", () => {
    const hundred = Array.from({ length: 100 }, (_, at) => at + 1);
    expect(percentile(hundred, 9500)).toBe(95);
    expect(percentile(hundred, 9900)).toBe(99);
    expect(percentile(hundred, 10000)).toBe(100);
    expect(percentile([7], 9500)).toBe(7);
    expect(percentile([], 9500)).toBe(0);
    expect(ms(12345)).toBe("12.345 ms");
    expect(ms(5)).toBe("0.005 ms");
  });

  test("[R-LOAD-009] given k6's summary, when it is read, then the measured scenario's submetrics fill the result", () => {
    const at = (values: Record<string, number>) => ({ values });
    const data = {
      metrics: {
        "command_ms{scenario:commands}": at({ med: 4.5, "p(95)": 20.25, "p(99)": 61.001, max: 90 }),
        "commands_sent{scenario:commands}": at({ count: 25000 }),
        "dropped_iterations{scenario:commands}": at({ count: 200 }),
        "accepted{scenario:commands}": at({ count: 24700 }),
        "stale_expected{scenario:commands}": at({ count: 250 }),
        "unexpected_replies{scenario:commands}": at({ count: 3 }),
        "server_errors{scenario:commands}": at({ count: 0 }),
        "connection_errors{scenario:commands}": at({ count: 0 }),
        "wanted_turn_end{scenario:commands}": at({ count: 12500 }),
        "sent_other{scenario:commands}": at({ count: 4 }),
      },
    };
    const result = fromK6(data, plan, "k6 v2.3.0", 1_000_000, "commands");
    expect(result).toMatchObject({ sent: 25000, dropped: 200, medUs: 4500, p95Us: 20250, p99Us: 61001, maxUs: 90000, accepted: 24700, staleExpected: 250, unexpected: 3, rateLimited: 0, target: plan.target });
    expect(result.wanted["turn/end"]).toBe(12500);
    expect(result.sentKinds.other).toBe(4);
    expect(result.reads).toBeNull();
  });
});
