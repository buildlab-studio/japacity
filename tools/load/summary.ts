// The run's summary (load:run-summary-recorded): the thresholds, the
// measured values, the machine, the tool and runtime versions, the stores'
// size before and after, bytes written per command, and the seed. It is
// written to results/ and pasted into the change that adds or alters the test.
import { int } from "@japacity/sim";

import type { LoadPlan } from "./load.config";
import { ms, passRule } from "./pass";
import type { Check, RunResult, Verdict } from "./pass";
import type { Counts, Verification } from "./verify";
import { verificationLines } from "./verify";

interface Machine {
  cpu: string;
  cores: number;
  memoryBytes: number;
  os: string;
}

export interface Summary {
  at: string;
  seed: number;
  scale: number;
  plan: LoadPlan;
  result: RunResult;
  checks: Check[];
  verdict: Verdict;
  verification: Verification | null;
  machine: Machine;
  versions: Record<string, string>;
  /** The stores' size: for the memory stores, the JSON characters of every row and snapshot written. */
  stores: { kind: string; before: Counts; after: Counts; bytesPerCommand: number };
}

/** load:run-summary-recorded: everything the summary holds. Bytes per command are the stores' growth over the commands accepted. */
export function summaryOf(input: Omit<Summary, "checks" | "verdict" | "stores"> & { stores: { kind: string; before: Counts; after: Counts } }): Summary {
  const { verdict, checks } = passRule(input.result, input.plan);
  const grown = input.stores.after.rowBytes + input.stores.after.snapshotBytes - input.stores.before.rowBytes - input.stores.before.snapshotBytes;
  const bytesPerCommand = input.result.accepted === 0 ? 0 : int.divFloor(grown, input.result.accepted);
  const failedVerification = input.verification !== null && !input.verification.ok;
  return { ...input, checks, verdict: failedVerification && verdict === "pass" ? "fail" : verdict, stores: { ...input.stores, bytesPerCommand } };
}

const MEGABYTE = 1024 * 1024;
const megabytes = (bytes: number) => `${String(int.divFloor(bytes, MEGABYTE))} MB`;
const size = (counts: Counts) => `${megabytes(counts.rowBytes + counts.snapshotBytes)} (${String(counts.rows)} log rows, ${String(counts.snapshots)} snapshots, ${String(counts.characters)} characters)`;

/** load:run-summary-recorded: the summary as Markdown. */
export function summaryMarkdown(summary: Summary): string {
  const { result, plan } = summary;
  const lines = [
    `# Load test: ${result.scenario}, ${summary.verdict.toUpperCase()}`,
    "",
    `- When: ${summary.at}`,
    `- Seed: ${String(summary.seed)}; scale: 1/${String(summary.scale)} of the target (${String(plan.accounts)} accounts, ${String(plan.commandsPerSecond)} commands a second for ${String(plan.minutes)} minutes after a ${String(plan.rampSeconds)} s ramp)`,
    `- Tool: ${result.tool}`,
    `- Machine: ${summary.machine.cpu}, ${String(summary.machine.cores)} cores, ${megabytes(summary.machine.memoryBytes)}, ${summary.machine.os}`,
    `- Versions: ${Object.entries(summary.versions).map(([name, version]) => `${name} ${version}`).join(", ")}`,
    "",
    "## load:main-scenario-pass-thresholds",
    "",
    "| Check | Threshold | Measured | |",
    "|---|---|---|---|",
    ...summary.checks.map((check) => `| ${check.name} | ${check.threshold} | ${check.measured} | ${check.ok ? "ok" : "MISS"} |`),
    "",
    `Median ${ms(result.medUs)}, max ${ms(result.maxUs)}. The load route's own read, before each command and not timed with it: 95th percentile ${ms(result.viewP95Us)}.`,
    `Accepted ${String(result.accepted)}; expected stale ${String(result.staleExpected)}; sent as another kind because the view offered none of the kind asked for: ${String(result.fallbacks)}; lives ended: ${String(result.ended)}; load route failures: ${String(result.viewFailures)}.`,
    `Asked for: ${Object.entries(result.wanted).map(([kind, count]) => `${kind} ${String(count)}`).join(", ")}.`,
    `Sent: ${Object.entries(result.sentKinds).map(([kind, count]) => `${kind} ${String(count)}`).join(", ")}.`,
    ...(result.reads === null ? [] : ["", `load:peak-reads-reported-only (reported, not a gate): ${String(result.reads.count)} reads, 95th percentile ${ms(result.reads.p95Us)}, ${String(result.reads.failures)} not 200.`]),
    "",
    "## load:correctness-checked-after-run",
    "",
    ...(summary.verification === null ? ["Not run."] : verificationLines(summary.verification).map((line) => (line.startsWith("  ") ? `    ${line.trim()}` : `- ${line}`))),
    "",
    "## Stores",
    "",
    `- Kind: ${summary.stores.kind}`,
    `- Before: ${size(summary.stores.before)}`,
    `- After: ${size(summary.stores.after)}`,
    `- Bytes written per accepted command: ${String(summary.stores.bytesPerCommand)}`,
    "",
  ];
  return lines.join("\n");
}
