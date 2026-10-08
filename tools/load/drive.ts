// A stand-in load generator in Node for the smaller runs made before k6 is
// installed (docs/rules/load.md R-LOAD-007 names k6 for the gate). It sends
// what commands.k6.js sends, from the same picks in pick.js, on the same
// arrival schedule: a linear ramp, then a constant rate that never waits for
// the server, with an iteration dropped when every user is busy.
import { setTimeout as sleep } from "node:timers/promises";

import { divFloor } from "../../packages/sim/src/engine/int";
import { request } from "./http";
import type { Target } from "./http";
import type { LoadPlan } from "./load.config";
import { percentile } from "./pass";
import type { RunResult } from "./pass";
import { accountAt, chooseCommand, classify, commandBody, kindAt, roll, staleAt, STREAM } from "./pick.js";
import type { LooseCommand, Outcome } from "./pick.js";

const SECOND_MS = 1000;

/** R-LOAD-003: the ramp's arrival times in milliseconds from the start, rising linearly to the rate. */
export function rampArrivals(rate: number, seconds: number, count: number): number[] {
  return Array.from({ length: count }, (_, at) => Math.floor(Math.sqrt(divFloor(2 * seconds * SECOND_MS * SECOND_MS * (at + 1), rate))));
}

/** R-LOAD-003: a constant rate's arrival times from `startMs` for `count` arrivals. */
export function steadyArrivals(rate: number, startMs: number, count: number): number[] {
  return Array.from({ length: count }, (_, at) => startMs + divFloor(at * SECOND_MS, rate));
}

interface Tally {
  durations: number[];
  viewDurations: number[];
  outcomes: Record<Outcome, number>;
  sent: number;
  dropped: number;
  fallbacks: number;
  ended: number;
  viewFailures: number;
  wanted: Record<string, number>;
  sentKinds: Record<string, number>;
}

function emptyTally(plan: LoadPlan): Tally {
  const kinds = plan.mix.map((entry) => entry.kind);
  return {
    durations: [],
    viewDurations: [],
    outcomes: { accepted: 0, "stale-expected": 0, "rate-limited": 0, unexpected: 0, "server-error": 0, "connection-error": 0 },
    sent: 0,
    dropped: 0,
    fallbacks: 0,
    ended: 0,
    viewFailures: 0,
    wanted: Object.fromEntries(kinds.map((kind) => [kind, 0])),
    sentKinds: Object.fromEntries([...kinds, "other"].map((kind) => [kind, 0])),
  };
}

const micros = (milliseconds: number) => Math.round(milliseconds * SECOND_MS);

interface LoadViewBody {
  ok: boolean;
  basedOn: number;
  legal: LooseCommand[];
}

/** One iteration of commands.k6.js's `command`. */
async function command(target: Target, plan: LoadPlan, accounts: readonly [string, string][], index: number, tally: Tally | null): Promise<void> {
  const [account, character] = accounts[accountAt(plan.seed, index, accounts.length)] ?? ["", ""];
  const view = await request<LoadViewBody>(target, "GET", `/api/load/view/${character}`, null);
  tally?.viewDurations.push(micros(view.ms));
  if (view.status !== 200 || view.body === null || !view.body.ok) {
    if (tally !== null) {
      tally.viewFailures += 1;
      if (view.status === 0) tally.outcomes["connection-error"] += 1;
    }
    return;
  }
  const kind = kindAt(plan.seed, index, plan.mix);
  const chosen = chooseCommand(view.body.legal, kind, roll(plan.seed, index, STREAM.choice, 1 << 30));
  if (tally !== null) tally.wanted[kind] = (tally.wanted[kind] ?? 0) + 1;
  if (chosen === null) {
    if (tally !== null) tally.ended += 1;
    return;
  }
  const stale = staleAt(plan.seed, index, plan.staleShareBp);
  const reply = await request<{ ok?: unknown; code?: unknown }>(target, "POST", "/api/command", account, commandBody(chosen.command, view.body.basedOn, stale));
  if (tally === null) return;
  tally.sent += 1;
  if (chosen.fallback) tally.fallbacks += 1;
  const sentKind = chosen.command.type in tally.sentKinds ? chosen.command.type : "other";
  tally.sentKinds[sentKind] = (tally.sentKinds[sentKind] ?? 0) + 1;
  tally.durations.push(micros(reply.ms));
  tally.outcomes[classify(reply.status, reply.body, stale)] += 1;
}

/** R-LOAD-005: one read of the second scenario. */
async function read(target: Target, plan: LoadPlan, accounts: readonly [string, string][], path: string, index: number, reads: { durations: number[]; failures: number }): Promise<void> {
  const [account] = accounts[accountAt(plan.seed ^ STREAM.reads, index, accounts.length)] ?? [""];
  const reply = await request(target, "GET", path, path === "/api/health" ? null : account);
  reads.durations.push(micros(reply.ms));
  if (reply.status !== 200) reads.failures += 1;
}

type Arrival = { at: number; run: (index: number) => Promise<void>; index: number; measured: boolean };

/** Runs the scenario and returns its numbers in the shape k6's summary is read into. */
export async function drive(target: Target, plan: LoadPlan, accounts: readonly [string, string][], scenario: "commands" | "reads", log: (line: string) => void): Promise<RunResult> {
  const tally = emptyTally(plan);
  const reads = { durations: [] as number[], failures: 0 };
  const startMs = plan.rampSeconds * SECOND_MS;
  const arrivals: Arrival[] = [
    ...rampArrivals(plan.commandsPerSecond, plan.rampSeconds, plan.rampIterations).map((at, index) => ({ at, index, measured: false, run: (i: number) => command(target, plan, accounts, i, null) })),
    ...steadyArrivals(plan.commandsPerSecond, startMs, plan.target).map((at, step) => ({ at, index: plan.rampIterations + step, measured: true, run: (i: number) => command(target, plan, accounts, i, tally) })),
  ];
  if (scenario === "reads") {
    const paths: [string, number][] = [["/api/health", plan.reads.heartbeats], ["/api/view", plan.reads.views], ["/api/world", plan.reads.worlds]];
    for (const [path, rate] of paths) {
      if (rate < 1) continue;
      for (const [index, at] of steadyArrivals(rate, startMs, rate * plan.minutes * 60).entries()) {
        arrivals.push({ at, index, measured: false, run: (i: number) => read(target, plan, accounts, path, i, reads) });
      }
    }
  }
  arrivals.sort((x, y) => x.at - y.at);

  const busy = new Set<Promise<void>>();
  const maxBusy = scenario === "reads" ? plan.maxVUs * 4 : plan.maxVUs;
  const began = performance.now();
  const startedAt = Date.now() + startMs;
  let shown = 0;
  for (const arrival of arrivals) {
    const wait = arrival.at - (performance.now() - began);
    if (wait > 0) await sleep(wait);
    if (busy.size >= maxBusy) {
      if (arrival.measured) tally.dropped += 1;
      continue;
    }
    const running = arrival.run(arrival.index).finally(() => busy.delete(running));
    busy.add(running);
    const elapsed = divFloor(arrival.at, 60 * SECOND_MS);
    if (elapsed > shown) {
      shown = elapsed;
      log(`  minute ${String(elapsed)}: ${String(tally.sent)} commands measured, ${String(busy.size)} in flight, ${String(tally.dropped)} dropped.`);
    }
  }
  await Promise.all(busy);
  const endedAt = Date.now();

  const sorted = [...tally.durations].sort((x, y) => x - y);
  const views = [...tally.viewDurations].sort((x, y) => x - y);
  const readsSorted = [...reads.durations].sort((x, y) => x - y);
  return {
    tool: `Node ${process.version} driver (tools/load/drive.ts)`,
    scenario,
    startedAt,
    endedAt,
    target: plan.target,
    sent: tally.sent,
    dropped: tally.dropped,
    medUs: percentile(sorted, 5000),
    p95Us: percentile(sorted, 9500),
    p99Us: percentile(sorted, 9900),
    maxUs: sorted.at(-1) ?? 0,
    accepted: tally.outcomes.accepted,
    staleExpected: tally.outcomes["stale-expected"],
    rateLimited: tally.outcomes["rate-limited"],
    unexpected: tally.outcomes.unexpected,
    serverErrors: tally.outcomes["server-error"],
    connectionErrors: tally.outcomes["connection-error"],
    fallbacks: tally.fallbacks,
    ended: tally.ended,
    viewFailures: tally.viewFailures,
    viewP95Us: percentile(views, 9500),
    wanted: tally.wanted,
    sentKinds: tally.sentKinds,
    reads: scenario === "reads" ? { count: readsSorted.length, p95Us: percentile(readsSorted, 9500), failures: reads.failures } : null,
  };
}
