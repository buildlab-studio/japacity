// The seeding before a run (load:seeded-test-accounts): test accounts
// through the test sign-in, a character each through the character route,
// played forward a seeded number of months between 0 and `warmTurns` by the
// load route, and the manifest the run and the verifier read. Pairs wait for
// the pair routes.
//
// Usage: pnpm tsx tools/load/seed.ts [--scale 10] [--base http://127.0.0.1:8787] [--concurrency 32]
import { int } from "@japacity/sim";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { content } from "../../packages/content/src/index";
import { argument, patient, pool, request, wholeArgument } from "./http";
import type { Target } from "./http";
import { config, scaled } from "./load.config";
import type { LoadConfig } from "./load.config";
import { roll, STREAM } from "./pick.js";
import { isMain } from "../repo";

export interface SeedAccount {
  account: string;
  scenario: string;
  /** load:seeded-test-accounts: months to play before the run, 0 to `warmTurns`. */
  warm: number;
}

/** load:seeded-test-accounts, load:fixed-seed-repeatable-run: every account, its scenario and its months, fixed by the seed. */
export function seedPlan(load: LoadConfig, scenarios: readonly string[]): SeedAccount[] {
  if (scenarios.length === 0) throw new Error("No scenario to start a character in.");
  const width = String(load.accounts).length;
  return Array.from({ length: load.accounts }, (_, index) => ({
    account: `load-${String(index).padStart(width, "0")}`,
    scenario: scenarios[roll(load.seed, index, STREAM.scenario, scenarios.length)] ?? scenarios[0] ?? "",
    warm: roll(load.seed, index, STREAM.warm, load.warmTurns + 1),
  }));
}

/** load:seeded-test-accounts: `pairShareBp` of the accounts, two by two in plan order; an odd one left over stays single. */
export function pairPlan(accounts: readonly string[], pairShareBp: number): [string, string][] {
  const paired = int.divFloor(accounts.length * pairShareBp, 10000);
  const pairs: [string, string][] = [];
  for (let at = 0; at + 1 < paired; at += 2) pairs.push([accounts[at] ?? "", accounts[at + 1] ?? ""]);
  return pairs;
}

/** One seeded account as the manifest keeps it. */
interface Seeded extends SeedAccount {
  character: string;
  /** Months actually played: under `warm` only when the life ended or a command was refused. */
  played: number;
  v: number;
}

export interface Manifest {
  seed: number;
  scale: number;
  base: string;
  madeAt: string;
  accounts: Seeded[];
  pairs: [string, string][];
  /** Why no pairs were made, or null. */
  pairsSkipped: string | null;
}

export const RESULTS = fileURLToPath(new URL("./results/", import.meta.url));
export const MANIFEST = `${RESULTS}accounts.json`;

/**
 * load.md names no route that joins a pair. Seeding probes this path and
 * makes no pairs while it answers 404.
 */
const PAIR_ROUTE = "/api/pair";

async function makeAccount(target: Target, planned: SeedAccount): Promise<Seeded> {
  await patient(target, "POST", "/api/load/account", planned.account);
  const made = await patient<{ ok: boolean; code?: string }>(target, "POST", "/api/character", planned.account, { scenario: planned.scenario });
  if (made.status !== 200 && made.body?.code !== "one-character") throw new Error(`${planned.account}: no character (${String(made.status)} ${made.body?.code ?? ""}).`);
  const named = await patient<{ character: string | null }>(target, "POST", "/api/load/account", planned.account);
  const character = named.body?.character ?? null;
  if (character === null) throw new Error(`${planned.account}: the account names no character.`);
  return { ...planned, character, played: 0, v: 0 };
}

/** load:seeded-test-accounts: the character played forward its planned months by the load route. */
async function warmUp(target: Target, seed: number, index: number, seeded: Seeded): Promise<void> {
  const warmed = await patient<{ ok: boolean; played: number; v: number }>(target, "POST", `/api/load/warm/${seeded.character}`, null, {
    months: seeded.warm,
    seed: roll(seed, index, STREAM.choice, 1 << 30),
  });
  if (warmed.body === null || !warmed.body.ok) throw new Error(`${seeded.account}: not warmed (${String(warmed.status)}).`);
  seeded.played = warmed.body.played;
  seeded.v = warmed.body.v;
}

export async function seed(target: Target, load: LoadConfig, scale: number, width: number, log: (line: string) => void): Promise<Manifest> {
  const planned = seedPlan(load, Object.keys(content.scenario));
  const accounts: Seeded[] = [];
  log(`Making ${String(planned.length)} accounts and characters.`);
  await pool(planned, width, async (each, index) => {
    accounts[index] = await makeAccount(target, each);
    if ((index + 1) % 1000 === 0) log(`  ${String(index + 1)} made.`);
  });

  log("Playing each character forward.");
  await pool(accounts, width, async (seeded, index) => {
    await warmUp(target, load.seed, index, seeded);
    if ((index + 1) % 1000 === 0) log(`  ${String(index + 1)} played.`);
  });

  const probe = await request(target, "GET", PAIR_ROUTE, accounts[0]?.account ?? null);
  const pairsSkipped = probe.status === 404 ? `${PAIR_ROUTE} answers 404: the server has no pair routes, so no account is paired.` : null;
  const pairs = pairsSkipped === null ? pairPlan(accounts.map((each) => each.account), load.pairShareBp) : [];
  if (pairsSkipped === null) log(`note: ${String(pairs.length)} pairs are planned; the load test does not join them.`);
  return { seed: load.seed, scale, base: target.base, madeAt: new Date().toISOString(), accounts, pairs, pairsSkipped };
}

async function main(args: readonly string[]): Promise<void> {
  const scale = wholeArgument(args, "scale", 1);
  const load = scaled(config.load, scale);
  const target = { base: argument(args, "base", "http://127.0.0.1:8787") };
  const stats = await request(target, "GET", "/api/load/stats", null);
  if (stats.status !== 200) throw new Error(`No load Worker answers at ${target.base}. Start it first (tools/load/README.md).`);
  const started = Date.now();
  const manifest = await seed(target, load, scale, wholeArgument(args, "concurrency", 32), (line) => console.log(line));
  mkdirSync(RESULTS, { recursive: true });
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
  const played = manifest.accounts.reduce((sum, each) => sum + each.played, 0);
  const short = manifest.accounts.filter((each) => each.played < each.warm).length;
  console.log(`Seeded ${String(manifest.accounts.length)} accounts, ${String(played)} months played, ${String(short)} short of their plan, in ${String(int.divFloor(Date.now() - started, 1000))} s.`);
  if (manifest.pairsSkipped !== null) console.log(manifest.pairsSkipped);
  console.log(`Manifest: ${MANIFEST}`);
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
