// One run of the load test (docs/rules/load.md):
// the plan, the stores' counts before, the scenario through k6 (or the Node
// driver before k6 is installed), the counts after, the verification and the
// summary in results/. run.sh raises the file limit and calls this.
//
// Usage: tools/load/run.sh [--scale 10] [--scenario commands|reads] [--tool k6|node] [--minutes 10] [--base http://127.0.0.1:8787] [--no-verify]
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform, release, totalmem } from "node:os";
import { fileURLToPath } from "node:url";

import { content } from "../../packages/content/src/index";
import { drive } from "./drive";
import { argument, request, wholeArgument } from "./http";
import type { Target } from "./http";
import { config, planFor, scaled } from "./load.config";
import type { LoadPlan } from "./load.config";
import { fromK6, passRule } from "./pass";
import type { RunResult } from "./pass";
import type { Manifest } from "./seed";
import { MANIFEST, RESULTS } from "./seed";
import { summaryMarkdown, summaryOf } from "./summary";
import type { Counts, Verification } from "./verify";
import { verifyAll } from "./verify";
import { isMain, readJson } from "../repo";

const HERE = fileURLToPath(new URL("./", import.meta.url));

/** load:arrival-rate-generator: k6's version, or null when it is not installed. */
export function k6Version(): string | null {
  const found = spawnSync("k6", ["version"], { encoding: "utf8" });
  if (found.error !== undefined || found.status !== 0) return null;
  return found.stdout.trim().split("\n")[0] ?? "k6";
}

function wranglerVersion(): string {
  const manifest = fileURLToPath(new URL("../../apps/server/node_modules/wrangler/package.json", import.meta.url));
  try {
    return readJson<{ version: string }>(manifest).version;
  } catch {
    return "unknown";
  }
}

async function counts(target: Target): Promise<{ counts: Counts; snapshotEvery: number }> {
  const stats = await request<{ counts: Counts; snapshotEvery: number }>(target, "GET", "/api/load/stats", null);
  if (stats.status !== 200 || stats.body === null) throw new Error(`No load Worker answers at ${target.base}. Start it first (tools/load/README.md).`);
  return stats.body;
}

function runK6(plan: LoadPlan, target: Target, scenario: "commands" | "reads", tool: string): RunResult {
  const ran = spawnSync("k6", ["run", "commands.k6.js"], { cwd: HERE, stdio: "inherit", env: { ...process.env, LOAD_BASE: target.base, LOAD_SCENARIO: scenario } });
  if (ran.error !== undefined) throw ran.error;
  const data = readJson<Parameters<typeof fromK6>[0]>(`${RESULTS}k6-${scenario}.json`);
  return fromK6(data, plan, tool, Date.now(), scenario);
}

async function main(args: readonly string[]): Promise<void> {
  const scale = wholeArgument(args, "scale", 1);
  const scenario = argument(args, "scenario", "commands") === "reads" ? "reads" : "commands";
  const tool = argument(args, "tool", "k6");
  const target = { base: argument(args, "base", "http://127.0.0.1:8787") };
  const load = scaled(config.load, scale);
  const minutes = wholeArgument(args, "minutes", load.minutes);
  const manifest = readJson<Manifest>(MANIFEST);
  if (manifest.accounts.length !== load.accounts) console.log(`The manifest holds ${String(manifest.accounts.length)} accounts where this scale plans ${String(load.accounts)}. The run uses the manifest's.`);
  const plan = planFor({ ...load, minutes, accounts: manifest.accounts.length }, scale);

  const k6 = k6Version();
  if (tool === "k6" && k6 === null) {
    console.error("k6 is not installed. It is a standalone tool, never a dependency of this repository (load:arrival-rate-generator): brew install k6");
    console.error("Until then a smaller run can use the Node driver: --tool node.");
    process.exit(1);
  }
  mkdirSync(RESULTS, { recursive: true });
  writeFileSync(`${RESULTS}plan.json`, `${JSON.stringify(plan, null, 1)}\n`);

  const before = await counts(target);
  console.log(`Running ${scenario} with ${tool}: ${String(plan.commandsPerSecond)} commands a second for ${String(minutes)} minutes after a ${String(plan.rampSeconds)} s ramp.`);
  const accounts = manifest.accounts.map((each): [string, string] => [each.account, each.character]);
  const result = tool === "k6" ? runK6(plan, target, scenario, k6 ?? "k6") : await drive(target, plan, accounts, scenario, (line) => console.log(line));
  const after = await counts(target);

  let verification: Verification | null = null;
  if (!args.includes("--no-verify")) {
    console.log("Verifying (load:correctness-checked-after-run).");
    verification = await verifyAll(target, manifest, content, 32, { before: before.counts, after: after.counts, snapshotEvery: after.snapshotEvery });
  }

  const cpu = cpus();
  const summary = summaryOf({
    at: new Date().toISOString(),
    seed: plan.seed,
    scale,
    plan,
    result,
    verification,
    machine: { cpu: cpu[0]?.model ?? "unknown", cores: cpu.length, memoryBytes: totalmem(), os: `${platform()} ${release()}` },
    versions: { node: process.version, k6: k6 ?? "not installed", wrangler: wranglerVersion(), content: content.version },
    stores: { kind: "memory (packages/store), in the Worker's isolate", before: before.counts, after: after.counts },
  });
  const stamp = summary.at.replaceAll(":", "-");
  const text = summaryMarkdown(summary);
  writeFileSync(`${RESULTS}summary-${scenario}-${stamp}.md`, text);
  writeFileSync(`${RESULTS}summary-${scenario}-${stamp}.json`, `${JSON.stringify(summary, null, 1)}\n`);
  console.log(`\n${text}`);
  // load:peak-reads-reported-only: the reads scenario is reported, never a gate.
  if (scenario === "commands" && passRule(result, plan).verdict !== "pass") process.exit(1);
  if (scenario === "commands" && summary.verdict !== "pass") process.exit(1);
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
