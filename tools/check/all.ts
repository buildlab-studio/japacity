// The one command to run before saying a change is done: pnpm check.
// Runs each step in order, stops at the first failure, and ends with one line
// that says whether everything passed.
import { spawnSync } from "node:child_process";

// check:size after check:assets: it builds the client and holds what a first visit downloads to its budgets (engine:first-download-has-budget).
// check:types first: the Workers' typecheck reads the files `wrangler types` generated, so a stale one is named before it misleads.
const STEPS = ["check:types", "typecheck", "lint", "test", "test:play", "check:rules", "check:version", "check:assets", "check:size", "check:scrub"] as const;

for (const step of STEPS) {
  console.log(`\n> ${step}`);
  const result = spawnSync("pnpm", ["--silent", "run", step], { stdio: "inherit" });
  if (result.status !== 0) {
    console.log(`\nCHECK FAILED at step: ${step}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nCHECK PASSED");
