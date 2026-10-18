// The correctness check after a run (load:correctness-checked-after-run): every
// character replays from its seed and command log to the hashes the server
// stored, its ledger balances, no version was accepted twice, its latest
// snapshot is where server.md puts it, and across the run about one command
// in `snapshotEvery` wrote a snapshot. The replay runs here in Node, apart
// from the Worker that stepped the commands.
//
// Usage: pnpm tsx tools/load/verify.ts [--base http://127.0.0.1:8787] [--concurrency 32]
import type { Command, Content, Currency, Id, Sender, State, World } from "@japacity/sim";
import { checkInvariants, hashState, newState, step, ledgerReport, int } from "@japacity/sim";

import { content as shipped } from "../../packages/content/src/index";
import { argument, patient, pool, wholeArgument } from "./http";
import type { Target } from "./http";
import type { Manifest } from "./seed";
import { MANIFEST } from "./seed";
import { isMain, readJson } from "../repo";

/** The rows of one character as the load route hands them over. */
export interface CharacterRows {
  character: { id: string; account: string; v: number; segment: number };
  segments: {
    segment: number;
    fromV: number;
    content: string;
    overlay?: string;
    start: { scenario: Id<"scenario">; seed: string; worldSeed: string } | { base: State };
  }[];
  log: { v: number; tick: number; sender: Sender; command: Command; hash: string; at: number }[];
  snapshot: { v: number; segment: number; hash: string };
}

export interface CharacterCheck {
  id: string;
  problems: string[];
  /** wallet:ledger-report-raises-alarms: named as suspect by the ledger report. Reported, not a failure. */
  suspect: boolean;
}

const CURRENCIES: readonly Currency[] = ["NGN", "GBP", "USD", "CAD", "AED", "EUR"];

const sumFor = (totals: State["wallet"]["totals"]["in"], currency: Currency) => Object.values(totals).reduce((sum, byCurrency) => sum + (byCurrency?.[currency] ?? 0), 0);

/** load:correctness-checked-after-run, wallet:ledger-balances-each-currency: in each currency, what the pockets hold equals the ledger's money in less its money out. */
export function ledgerProblems(state: State): string[] {
  const problems: string[] = [];
  for (const currency of CURRENCIES) {
    const pocket = state.wallet.pockets[currency];
    const held = pocket.bank + pocket.cash + pocket.locked;
    const booked = sumFor(state.wallet.totals.in, currency) - sumFor(state.wallet.totals.out, currency);
    if (held !== booked) problems.push(`${currency}: the pockets hold ${String(held)}, the ledger says ${String(booked)}.`);
  }
  return problems;
}

/** load:correctness-checked-after-run: every accepted version once, from 1 up with no gap. */
export function versionProblems(versions: readonly number[]): string[] {
  const problems: string[] = [];
  const seen = new Set<number>();
  for (const [at, v] of versions.entries()) {
    if (seen.has(v)) problems.push(`Two commands were accepted at version ${String(v)}.`);
    else if (v !== at + 1) problems.push(`Version ${String(v)} is stored where ${String(at + 1)} belongs.`);
    seen.add(v);
  }
  return problems;
}

/** server:snapshots-bound-replay: the version of the latest snapshot: the segment's start, or the last multiple of `every` after it. */
export function latestSnapshotV(v: number, fromV: number, every: number): number {
  return Math.max(fromV, v - (v % every));
}

/** load:correctness-checked-after-run: one character replayed from its seed against the stored worlds. */
export function verifyCharacter(rows: CharacterRows, content: Content, worlds: ReadonlyMap<number, World>, snapshotEvery: number): CharacterCheck {
  const id = rows.character.id;
  const problems = versionProblems(rows.log.map((row) => row.v));
  const hashes = new Map<number, string>();
  let state: State | null = null;
  const ordered = [...rows.segments].sort((x, y) => x.segment - y.segment);
  for (const [at, segment] of ordered.entries()) {
    if (segment.content !== content.version || segment.overlay !== content.overlay) {
      problems.push(`Segment ${String(segment.segment)} ran under content ${segment.content}, not ${content.version}.`);
      return { id, problems, suspect: false };
    }
    const upTo = ordered[at + 1]?.fromV ?? rows.character.v;
    state = "base" in segment.start ? segment.start.base : newState(segment.start.scenario, segment.start.seed, content);
    hashes.set(state.v, hashState(state));
    for (const row of rows.log.filter((each) => each.v > segment.fromV && each.v <= upTo)) {
      const world = worlds.get(row.tick);
      if (world === undefined) {
        problems.push(`No stored world for tick ${String(row.tick)}.`);
        return { id, problems, suspect: false };
      }
      const result = step(state, { ...row.command, basedOn: state.v }, world, content, row.sender);
      if (!result.ok) {
        problems.push(`Version ${String(row.v)} (${row.command.type}) is rejected on replay with ${result.code}.`);
        return { id, problems, suspect: false };
      }
      state = result.state;
      const hash = hashState(state);
      hashes.set(state.v, hash);
      if (state.v !== row.v) problems.push(`Version ${String(row.v)} replays to version ${String(state.v)}.`);
      if (hash !== row.hash) problems.push(`Version ${String(row.v)} replays to another hash than the one stored.`);
    }
  }
  if (state === null) return { id, problems: [...problems, "No segment is stored."], suspect: false };
  if (state.v !== rows.character.v) problems.push(`The log ends at version ${String(state.v)}, the row says ${String(rows.character.v)}.`);
  problems.push(...ledgerProblems(state), ...checkInvariants(state, content));

  const current = ordered.find((segment) => segment.segment === rows.character.segment);
  const expected = latestSnapshotV(rows.character.v, current?.fromV ?? 0, snapshotEvery);
  if (rows.snapshot.v !== expected) problems.push(`The latest snapshot is at version ${String(rows.snapshot.v)}, not ${String(expected)}.`);
  else if (hashes.get(expected) !== rows.snapshot.hash) problems.push(`The snapshot at version ${String(expected)} differs from the replay.`);
  return { id, problems, suspect: ledgerReport(state, content).suspect };
}

/** What the load Worker's write counts say: rows appended and snapshots written. */
export interface Counts {
  rows: number;
  snapshots: number;
  rowBytes: number;
  snapshotBytes: number;
  characters: number;
}

/** load:correctness-checked-after-run: snapshots written during the run against rows appended, within one point of 1 in `every`. */
export function snapshotShare(before: Counts, after: Counts, every: number): { ok: boolean; measuredBp: number; targetBp: number } {
  const rows = after.rows - before.rows;
  const snapshots = after.snapshots - before.snapshots;
  const targetBp = int.divFloor(10000, every);
  if (rows === 0) return { ok: false, measuredBp: 0, targetBp };
  // |snapshots / rows - 1 / every| <= 1%, multiplied through by rows and every.
  const ok = Math.abs(snapshots * 10000 * every - rows * 10000) <= 100 * rows * every;
  return { ok, measuredBp: int.mulDiv(snapshots, 10000, rows), targetBp };
}

export interface Verification {
  characters: number;
  touched: number;
  failed: CharacterCheck[];
  suspect: number;
  snapshots: { ok: boolean; measuredBp: number; targetBp: number } | null;
  /** load:correctness-checked-after-run: pairs touched, or why none were checked. */
  pairs: string;
  ok: boolean;
}

/** Fetches every seeded character's rows and the worlds they name, and checks each. */
export async function verifyAll(
  target: Target,
  manifest: Manifest,
  content: Content,
  width: number,
  counts: { before: Counts; after: Counts; snapshotEvery: number } | null,
): Promise<Verification> {
  const worlds = new Map<number, World>();
  const failed: CharacterCheck[] = [];
  let touched = 0;
  let suspect = 0;
  await pool(manifest.accounts, width, async (seeded) => {
    const fetched = await patient<CharacterRows & { ok: boolean }>(target, "GET", `/api/load/rows/${seeded.character}`, null);
    if (fetched.body === null || !fetched.body.ok) {
      failed.push({ id: seeded.character, problems: [`No rows (${String(fetched.status)}).`], suspect: false });
      return;
    }
    const rows = fetched.body;
    for (const tick of new Set(rows.log.map((row) => row.tick))) {
      if (worlds.has(tick)) continue;
      const world = await patient<{ ok: boolean; world: World }>(target, "GET", `/api/load/world/${String(tick)}`, null);
      if (world.body?.ok === true) worlds.set(tick, world.body.world);
    }
    if (rows.character.v > seeded.v) touched += 1;
    const check = verifyCharacter(rows, content, worlds, counts?.snapshotEvery ?? 20);
    if (check.problems.length > 0) failed.push(check);
    if (check.suspect) suspect += 1;
  });
  const snapshots = counts === null ? null : snapshotShare(counts.before, counts.after, counts.snapshotEvery);
  const pairs = manifest.pairs.length === 0 ? `not checked: no pairs were made (${manifest.pairsSkipped ?? "none planned"})` : `not checked: ${String(manifest.pairs.length)} pairs planned, and the load test has no route that reads pair rows`;
  return { characters: manifest.accounts.length, touched, failed, suspect, snapshots, pairs, ok: failed.length === 0 && (snapshots?.ok ?? true) };
}

/** The verification as lines for the terminal and the summary. */
export function verificationLines(verification: Verification): string[] {
  const lines = [
    `Characters replayed from their seeds: ${String(verification.characters)}, of which touched by the run: ${String(verification.touched)}.`,
    `Characters with a problem: ${String(verification.failed.length)}.`,
    `Named as suspect by the ledger report (reported only): ${String(verification.suspect)}.`,
    verification.snapshots === null
      ? "Snapshot share: not measured."
      : `Snapshot share: ${String(verification.snapshots.measuredBp)} in 10,000 against ${String(verification.snapshots.targetBp)}, ${verification.snapshots.ok ? "within" : "outside"} one point.`,
    `Pairs: ${verification.pairs}.`,
  ];
  for (const check of verification.failed.slice(0, 20)) lines.push(`  ${check.id}: ${check.problems.join(" ")}`);
  return lines;
}

async function main(args: readonly string[]): Promise<void> {
  const target = { base: argument(args, "base", "http://127.0.0.1:8787") };
  const manifest = readJson<Manifest>(MANIFEST);
  const verification = await verifyAll(target, manifest, shipped, wholeArgument(args, "concurrency", 32), null);
  for (const line of verificationLines(verification)) console.log(line);
  if (!verification.ok) process.exit(1);
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
