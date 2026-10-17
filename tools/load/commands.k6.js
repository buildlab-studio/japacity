// The load test's two scenarios for k6 (docs/rules/load.md R-LOAD-003 to
// R-LOAD-009). Run by run.sh from this folder, which writes results/plan.json
// first; seed.ts writes results/accounts.json. LOAD_SCENARIO=commands is the
// main scenario and the gate; LOAD_SCENARIO=reads adds the peak's reads and is
// reported only (R-LOAD-005).
/* global __ENV, open */
import exec from "k6/execution";
import http from "k6/http";
import { SharedArray } from "k6/data";
import { Counter, Rate, Trend } from "k6/metrics";

import { accountAt, chooseCommand, classify, commandBody, kindAt, roll, staleAt, STREAM } from "./pick.js";

const PLAN = JSON.parse(open("./results/plan.json"));
const BASE = __ENV.LOAD_BASE || "http://127.0.0.1:8787";
const MODE = __ENV.LOAD_SCENARIO || "commands";
const SUMMARY = `./results/k6-${MODE}.json`;

const ACCOUNTS = new SharedArray("accounts", () => JSON.parse(open("./results/accounts.json")).accounts.map((each) => [each.account, each.character]));

const commandMs = new Trend("command_ms", true);
const viewMs = new Trend("load_view_ms", true);
const readMs = new Trend("read_ms", true);
const sent = new Counter("commands_sent");
const outcomes = {
  accepted: new Counter("accepted"),
  "stale-expected": new Counter("stale_expected"),
  "rate-limited": new Counter("rate_limited"),
  unexpected: new Counter("unexpected_replies"),
  "server-error": new Counter("server_errors"),
  "connection-error": new Counter("connection_errors"),
};
const unexpectedRate = new Rate("unexpected");
const fallbacks = new Counter("fallbacks");
const ended = new Counter("ended_lives");
const viewFailures = new Counter("load_view_failures");
const readFailures = new Counter("read_failures");
const wanted = Object.fromEntries(PLAN.mix.map((entry) => [entry.kind, new Counter(`wanted_${entry.kind.replace("/", "_")}`)]));
const sentKinds = Object.fromEntries([...PLAN.mix.map((entry) => entry.kind), "other"].map((kind) => [kind, new Counter(`sent_${kind.replace("/", "_")}`)]));

const ARRIVALS = { timeUnit: "1s", preAllocatedVUs: PLAN.preAllocatedVUs, maxVUs: PLAN.maxVUs };
const MEASURED = `${String(PLAN.rampSeconds)}s`;

function commandScenarios() {
  return {
    ramp: { executor: "ramping-arrival-rate", startRate: 0, stages: [{ target: PLAN.commandsPerSecond, duration: MEASURED }], exec: "command", ...ARRIVALS },
    commands: { executor: "constant-arrival-rate", rate: PLAN.commandsPerSecond, duration: `${String(PLAN.minutes)}m`, startTime: MEASURED, exec: "command", ...ARRIVALS },
  };
}

function readScenario(rate, name) {
  return { executor: "constant-arrival-rate", rate: Math.max(1, rate), duration: `${String(PLAN.minutes)}m`, startTime: MEASURED, exec: name, ...ARRIVALS, maxVUs: PLAN.maxVUs * 4 };
}

const scenarios =
  MODE === "reads"
    ? { ...commandScenarios(), heartbeats: readScenario(PLAN.reads.heartbeats, "heartbeat"), views: readScenario(PLAN.reads.views, "view"), worlds: readScenario(PLAN.reads.worlds, "world") }
    : commandScenarios();

const shown = (metric) => `${metric}{scenario:commands}`;

export const options = {
  scenarios,
  // R-LOAD-008: keep-alive connections, never a new one per request.
  noConnectionReuse: false,
  noVUConnectionReuse: false,
  summaryTrendStats: ["min", "med", "avg", "p(90)", "p(95)", "p(99)", "max", "count"],
  // R-LOAD-009: the gate, on the measured scenario alone. The submetrics with `count>=0` are there to be reported.
  thresholds: {
    [shown("command_ms")]: [`p(95)<=${String(PLAN.p95Ms)}`, `p(99)<=${String(PLAN.p99Ms)}`],
    [shown("dropped_iterations")]: [`count<=${String(PLAN.droppedMax)}`],
    [shown("server_errors")]: ["count==0"],
    [shown("unexpected")]: [`rate<${PLAN.unexpectedFraction}`],
    [shown("connection_errors")]: ["count>=0"],
    [shown("commands_sent")]: ["count>=0"],
    [shown("accepted")]: ["count>=0"],
    [shown("stale_expected")]: ["count>=0"],
    [shown("rate_limited")]: ["count>=0"],
    [shown("unexpected_replies")]: ["count>=0"],
    [shown("fallbacks")]: ["count>=0"],
    [shown("ended_lives")]: ["count>=0"],
    [shown("load_view_failures")]: ["count>=0"],
    [shown("load_view_ms")]: ["max>=0"],
    ...Object.fromEntries([...Object.values(wanted), ...Object.values(sentKinds)].map((counter) => [shown(counter.name), ["count>=0"]])),
  },
};

function bodyOf(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}

/** R-LOAD-003, R-LOAD-004, R-LOAD-006: one legal command for the iteration's account, sent stale when the seed says so. */
export function command() {
  const index = (exec.scenario.name === "commands" ? PLAN.rampIterations : 0) + exec.scenario.iterationInTest;
  const [account, character] = ACCOUNTS[accountAt(PLAN.seed, index, ACCOUNTS.length)];
  const view = http.get(`${BASE}/api/load/view/${character}`, { tags: { name: "load-view" } });
  viewMs.add(view.timings.duration);
  const read = view.status === 200 ? bodyOf(view) : null;
  if (read === null || read.ok !== true) {
    viewFailures.add(1);
    if (view.status === 0) outcomes["connection-error"].add(1);
    return;
  }
  const kind = kindAt(PLAN.seed, index, PLAN.mix);
  wanted[kind].add(1);
  const chosen = chooseCommand(read.legal, kind, roll(PLAN.seed, index, STREAM.choice, 1 << 30));
  if (chosen === null) {
    ended.add(1);
    return;
  }
  if (chosen.fallback) fallbacks.add(1);
  (sentKinds[chosen.command.type] || sentKinds.other).add(1);
  const stale = staleAt(PLAN.seed, index, PLAN.staleShareBp);
  const res = http.post(`${BASE}/api/command`, JSON.stringify(commandBody(chosen.command, read.basedOn, stale)), {
    headers: { "content-type": "application/json", "x-test-account": account },
    tags: { name: "command" },
  });
  sent.add(1);
  commandMs.add(res.timings.duration);
  const outcome = classify(res.status, bodyOf(res), stale);
  outcomes[outcome].add(1);
  unexpectedRate.add(outcome === "unexpected" || outcome === "rate-limited");
}

function readAs(path, signedIn) {
  const index = exec.scenario.iterationInTest;
  const [account] = ACCOUNTS[accountAt(PLAN.seed ^ STREAM.reads, index, ACCOUNTS.length)];
  const res = http.get(`${BASE}${path}`, { headers: signedIn ? { "x-test-account": account } : {}, tags: { name: path } });
  readMs.add(res.timings.duration);
  if (res.status !== 200) readFailures.add(1);
}

/** R-LOAD-005. A heartbeat is the health route, since the socket's pings are answered without reaching the Worker (R-CLOCK-024). */
export function heartbeat() {
  readAs("/api/health", false);
}

export function view() {
  readAs("/api/view", true);
}

export function world() {
  readAs("/api/world", true);
}

export function handleSummary(data) {
  const line = `k6 ${MODE}: summary written to ${SUMMARY}. Run tools/load/pass.ts on it for the verdict.\n`;
  return { [SUMMARY]: JSON.stringify(data, null, 1), stdout: line };
}
