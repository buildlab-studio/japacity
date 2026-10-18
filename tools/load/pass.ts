// The pass rule of the main scenario (docs/rules/load.md R-LOAD-009),
// measured at the load generator. Times are whole microseconds so nothing
// here divides. A run with any connection error on this machine is repeated
// before it counts (R-LOAD-008).
import { int } from "@japacity/sim";

import type { LoadPlan } from "./load.config";

/** One scenario's numbers, from k6's summary or from the Node driver. */
export interface RunResult {
  tool: string;
  scenario: "commands" | "reads";
  /** Real time the measured part began and ended, milliseconds since 1970. */
  startedAt: number;
  endedAt: number;
  /** R-LOAD-009: the commands the measured part should send, those it sent and those the generator dropped. */
  target: number;
  sent: number;
  dropped: number;
  /** Time per command in microseconds. */
  medUs: number;
  p95Us: number;
  p99Us: number;
  maxUs: number;
  accepted: number;
  staleExpected: number;
  rateLimited: number;
  unexpected: number;
  serverErrors: number;
  connectionErrors: number;
  /** R-LOAD-003: a command of another kind sent because the view offered none of the kind asked for. */
  fallbacks: number;
  ended: number;
  viewFailures: number;
  /** The load route's time, which is not the command's. */
  viewP95Us: number;
  wanted: Record<string, number>;
  sentKinds: Record<string, number>;
  /** R-LOAD-005: the added reads, reported and never gated. */
  reads: { count: number; p95Us: number; failures: number } | null;
}

export interface Check {
  name: string;
  threshold: string;
  measured: string;
  ok: boolean;
}

export type Verdict = "pass" | "fail" | "repeat";

/** Microseconds as milliseconds with three places, written without dividing. */
export function ms(us: number): string {
  const whole = Math.round(us);
  return `${String(int.divFloor(whole, 1000))}.${String(whole % 1000).padStart(3, "0")} ms`;
}

/** Nearest-rank percentile of sorted values, `bp` in basis points: 9500 is the 95th. */
export function percentile(sorted: readonly number[], bp: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.max(1, int.divCeil(sorted.length * bp, 10000));
  return sorted[rank - 1] ?? 0;
}

/** R-LOAD-009: every check of the table, and the verdict. */
export function passRule(result: RunResult, plan: Pick<LoadPlan, "p95Ms" | "p99Ms" | "unexpectedBp">): { verdict: Verdict; checks: Check[] } {
  const refused = result.unexpected + result.rateLimited;
  const checks: Check[] = [
    {
      name: "Commands sent against the target",
      threshold: `at least 99% of ${String(result.target)}`,
      measured: `${String(result.sent)} sent, ${String(result.dropped)} dropped`,
      ok: result.sent * 100 >= result.target * 99,
    },
    { name: "Time per command, 95th percentile", threshold: `${String(plan.p95Ms)} ms or less`, measured: ms(result.p95Us), ok: result.p95Us <= plan.p95Ms * 1000 },
    { name: "Time per command, 99th percentile", threshold: `${String(plan.p99Ms)} ms or less`, measured: ms(result.p99Us), ok: result.p99Us <= plan.p99Ms * 1000 },
    { name: "Server errors (5xx)", threshold: "none", measured: String(result.serverErrors), ok: result.serverErrors === 0 },
    {
      name: "Unexpected rejections",
      threshold: `under ${String(plan.unexpectedBp)} in 10,000`,
      measured: `${String(refused)} of ${String(result.sent)} (${String(result.rateLimited)} rate-limited); ${String(result.staleExpected)} expected stale not counted`,
      ok: refused * 10000 < plan.unexpectedBp * result.sent,
    },
    { name: "Connection errors on this machine", threshold: "reported; any means repeat", measured: String(result.connectionErrors), ok: result.connectionErrors === 0 },
  ];
  const failed = checks.slice(0, -1).some((check) => !check.ok);
  const verdict: Verdict = result.connectionErrors > 0 ? "repeat" : failed ? "fail" : "pass";
  return { verdict, checks };
}

interface K6Metric {
  values: Record<string, number>;
}

/** Milliseconds as k6 reports them, to whole microseconds. */
const micros = (value: number | undefined) => Math.round((value ?? 0) * 1000);

/** R-LOAD-009: k6's summary of the measured scenario as a run result. */
export function fromK6(data: { metrics: Record<string, K6Metric | undefined>; state?: { testRunDurationMs?: number } }, plan: LoadPlan, tool: string, endedAt: number, scenario: "commands" | "reads"): RunResult {
  const metric = (name: string) => data.metrics[`${name}{scenario:commands}`]?.values ?? {};
  const count = (name: string) => metric(name).count ?? 0;
  const durations = metric("command_ms");
  const kinds = (prefix: string, names: readonly string[]) => Object.fromEntries(names.map((kind) => [kind, count(`${prefix}_${kind.replace("/", "_")}`)]));
  const kindNames = plan.mix.map((entry) => entry.kind);
  const reads = data.metrics.read_ms?.values;
  const runMs = plan.minutes * 60 * 1000;
  return {
    tool,
    scenario,
    startedAt: endedAt - runMs,
    endedAt,
    target: plan.target,
    sent: count("commands_sent"),
    dropped: count("dropped_iterations"),
    medUs: micros(durations.med),
    p95Us: micros(durations["p(95)"]),
    p99Us: micros(durations["p(99)"]),
    maxUs: micros(durations.max),
    accepted: count("accepted"),
    staleExpected: count("stale_expected"),
    rateLimited: count("rate_limited"),
    unexpected: count("unexpected_replies"),
    serverErrors: count("server_errors"),
    connectionErrors: count("connection_errors"),
    fallbacks: count("fallbacks"),
    ended: count("ended_lives"),
    viewFailures: count("load_view_failures"),
    viewP95Us: micros(metric("load_view_ms")["p(95)"]),
    wanted: kinds("wanted", kindNames),
    sentKinds: kinds("sent", [...kindNames, "other"]),
    reads: reads === undefined ? null : { count: reads.count ?? 0, p95Us: micros(reads["p(95)"]), failures: data.metrics.read_failures?.values.count ?? 0 },
  };
}
