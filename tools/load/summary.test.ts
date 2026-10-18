import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { config, planFor, scaled } from "./load.config";
import type { RunResult } from "./pass";
import { summaryMarkdown, summaryOf } from "./summary";
import type { Verification } from "./verify";

const plan = planFor(scaled(config.load, 10), 10);
const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");

const result: RunResult = {
  tool: "k6 v2.3.0",
  scenario: "commands",
  startedAt: 0,
  endedAt: 600_000,
  target: plan.target,
  sent: plan.target,
  dropped: 0,
  medUs: 3000,
  p95Us: 41_250,
  p99Us: 88_000,
  maxUs: 120_000,
  accepted: 25_000,
  staleExpected: 200,
  rateLimited: 0,
  unexpected: 0,
  serverErrors: 0,
  connectionErrors: 0,
  fallbacks: 5000,
  ended: 0,
  viewFailures: 0,
  viewP95Us: 9000,
  wanted: { "turn/end": 12_600 },
  sentKinds: { "turn/end": 17_000 },
  reads: null,
};

const verified: Verification = { characters: 10_000, touched: 9_000, failed: [], suspect: 0, snapshots: { ok: true, measuredBp: 497, targetBp: 500 }, pairs: "not checked", ok: true };

function summary(verification: Verification | null) {
  return summaryOf({
    at: "2026-10-08T12:00:00.000Z",
    seed: plan.seed,
    scale: 10,
    plan,
    result,
    verification,
    machine: { cpu: "Apple M3 Max", cores: 14, memoryBytes: 36 * 1024 * 1024 * 1024, os: "darwin 27.0.0" },
    versions: { node: "v22.16.0", k6: "k6 v2.3.0", wrangler: "4.148.0" },
    stores: {
      kind: "memory",
      before: { characters: 10_000, rows: 300_000, snapshots: 25_000, rowBytes: 84_000_000, snapshotBytes: 190_000_000 },
      after: { characters: 10_000, rows: 326_000, snapshots: 26_300, rowBytes: 91_280_000, snapshotBytes: 199_880_000 },
    },
  });
}

describe("the run's summary", () => {
  test("[load:run-summary-recorded] given a run, when its summary is written, then it holds the thresholds, the measured values, the machine, the versions, the stores before and after, bytes per command and the seed", () => {
    const made = summary(verified);
    expect(made.verdict).toBe("pass");
    expect(made.stores.bytesPerCommand).toBe(686);
    const text = summaryMarkdown(made);
    for (const piece of [
      `Seed: ${String(plan.seed)}`,
      "| Time per command, 95th percentile | 100 ms or less | 41.250 ms | ok |",
      "| Time per command, 99th percentile | 250 ms or less | 88.000 ms | ok |",
      "Apple M3 Max, 14 cores, 36864 MB",
      "k6 k6 v2.3.0",
      "wrangler 4.148.0",
      "- Before: 261 MB",
      "- After: 277 MB",
      "Bytes written per accepted command: 686",
      "Snapshot share: 497 in 10,000 against 500, within one point.",
    ]) {
      expect(text).toContain(piece);
    }
  });

  test("[load:correctness-checked-after-run] [load:run-summary-recorded] given a run that meets every threshold but fails verification, when it is summarised, then it fails", () => {
    expect(summary({ ...verified, ok: false, failed: [{ id: "character-1", problems: ["Version 3 replays to another hash than the one stored."], suspect: false }] }).verdict).toBe("fail");
    expect(summary(null).verdict).toBe("pass");
  });

  test("[load:run-summary-recorded] given the results folder, when git reads its ignore file, then only the README and the ignore file are kept", () => {
    expect(read("./results/.gitignore").split("\n").filter((line) => line !== "" && !line.startsWith("#"))).toEqual(["*", "!.gitignore", "!README.md"]);
    expect(read("./results/README.md")).toContain("load:run-summary-recorded");
  });
});
