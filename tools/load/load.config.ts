// The load test's numbers (docs/rules/load.md, Numbers). They are the tool's,
// not the game's content. `scaled` gives the smaller runs this machine can
// make before Postgres and k6 are in place, and `planFor` turns a config into
// the plain numbers the k6 script and the Node driver read.
import { int } from "@japacity/sim";

export interface LoadConfig {
  /** load:seeded-test-accounts: test accounts made before the run. */
  accounts: number;
  /** load:seeded-test-accounts: the most turns a character is played before the run. */
  warmTurns: number;
  /** load:seeded-test-accounts: accounts joined in pairs, basis points. */
  pairShareBp: number;
  /** load:some-commands-sent-stale: commands sent with an old `basedOn`, basis points. */
  staleShareBp: number;
  /** load:constant-rate-command-mix: the main scenario's arrival rate. */
  commandsPerSecond: number;
  /** load:peak-reads-reported-only: every request of the peak, commands included. */
  requestsPerSecond: number;
  /** load:constant-rate-command-mix: the main scenario's length after the ramp. */
  minutes: number;
  /** load:main-scenario-pass-thresholds. */
  p95Ms: number;
  p99Ms: number;
  /** load:main-scenario-pass-thresholds: unexpected rejections must stay under this, basis points. */
  unexpectedBp: number;
  /** load:fixed-seed-repeatable-run: the account picks and the command mix. */
  seed: number;
}

export const config: { load: LoadConfig } = {
  load: {
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
    seed: 20261008,
  },
};

/** load:constant-rate-command-mix: the one-minute ramp before the measured run. */
export const RAMP_SECONDS = 60;

/** load:constant-rate-command-mix: the mix of the main scenario, in basis points. Working values. */
export const MIX = [
  { kind: "turn/end", bp: 5000 },
  { kind: "offer/choose", bp: 1500 },
  { kind: "wallet/convert", bp: 1000 },
  { kind: "obligation/pay", bp: 1000 },
  { kind: "setpiece/answer", bp: 1000 },
  { kind: "pair", bp: 500 },
] as const;

/**
 * load:peak-reads-reported-only: one player's day, 10 commands, 53 heartbeats and 20 other
 * reads. The other reads are split evenly between view fetches and world
 * fetches.
 */
export const DAY = { commands: 10, heartbeats: 53, reads: 20 } as const;

/** The same test with the counts and rates divided by `divisor`; thresholds and the seed stay. */
export function scaled(load: LoadConfig, divisor: number): LoadConfig {
  if (!Number.isSafeInteger(divisor) || divisor < 1) throw new Error(`A scale divides by a whole number of at least 1, not ${String(divisor)}.`);
  return {
    ...load,
    accounts: Math.max(1, int.divFloor(load.accounts, divisor)),
    commandsPerSecond: Math.max(1, int.divFloor(load.commandsPerSecond, divisor)),
    requestsPerSecond: Math.max(1, int.divFloor(load.requestsPerSecond, divisor)),
  };
}

/** load:peak-reads-reported-only: the reads a second added to the commands to reach `requestsPerSecond`. */
export function readRates(load: LoadConfig): { heartbeats: number; views: number; worlds: number } {
  const rest = Math.max(0, load.requestsPerSecond - load.commandsPerSecond);
  const heartbeats = int.mulDiv(rest, DAY.heartbeats, DAY.heartbeats + DAY.reads);
  const views = int.divCeil(rest - heartbeats, 2);
  return { heartbeats, views, worlds: rest - heartbeats - views };
}

/** What the k6 script and the Node driver read: every number already worked out. */
export interface LoadPlan {
  seed: number;
  scale: number;
  accounts: number;
  commandsPerSecond: number;
  reads: { heartbeats: number; views: number; worlds: number };
  rampSeconds: number;
  minutes: number;
  staleShareBp: number;
  mix: { kind: string; bp: number }[];
  /** Iterations the ramp is expected to send, so the measured run's picks follow on from them. */
  rampIterations: number;
  /** load:main-scenario-pass-thresholds: the measured run's commands, and the most it may drop. */
  target: number;
  droppedMax: number;
  p95Ms: number;
  p99Ms: number;
  unexpectedBp: number;
  /** `unexpectedBp` as the fraction a k6 threshold reads. */
  unexpectedFraction: string;
  /** The virtual users k6 holds ready, and the most it may start. */
  preAllocatedVUs: number;
  maxVUs: number;
}

/** Virtual users for a rate: room for each to wait about half a second. */
const VUS_PER_RATE_DIVISOR = 2;
const MIN_VUS = 20;

export function planFor(load: LoadConfig, scale: number): LoadPlan {
  const target = load.commandsPerSecond * load.minutes * 60;
  return {
    seed: load.seed,
    scale,
    accounts: load.accounts,
    commandsPerSecond: load.commandsPerSecond,
    reads: readRates(load),
    rampSeconds: RAMP_SECONDS,
    minutes: load.minutes,
    staleShareBp: load.staleShareBp,
    mix: MIX.map((entry) => ({ kind: entry.kind, bp: entry.bp })),
    rampIterations: int.divFloor(load.commandsPerSecond * RAMP_SECONDS, 2),
    target,
    // load:main-scenario-pass-thresholds: fewer than 1% of the target dropped.
    droppedMax: int.divCeil(target, 100) - 1,
    p95Ms: load.p95Ms,
    p99Ms: load.p99Ms,
    unexpectedBp: load.unexpectedBp,
    unexpectedFraction: bpFraction(load.unexpectedBp),
    preAllocatedVUs: Math.max(MIN_VUS, int.divCeil(load.commandsPerSecond, VUS_PER_RATE_DIVISOR)),
    maxVUs: Math.max(MIN_VUS, load.commandsPerSecond * 2),
  };
}

/** Basis points as the fraction k6 reads in a threshold, written without dividing: 10 is "0.0010". */
export function bpFraction(bp: number): string {
  const digits = String(bp).padStart(5, "0");
  return `${digits.slice(0, -4)}.${digits.slice(-4)}`;
}
