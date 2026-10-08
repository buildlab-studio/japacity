// The one command to run before saying a change is done: pnpm check.
// Runs each step in order, stops at the first failure, and ends with one line
// that says whether everything passed.
import { spawnSync } from "node:child_process";

const STEPS = ["typecheck", "lint", "test", "check:rules", "check:assets"] as const;

for (const step of STEPS) {
  console.log(`\n> ${step}`);
  const result = spawnSync("pnpm", ["--silent", "run", step], { stdio: "inherit" });
  if (result.status !== 0) {
    console.log(`\nCHECK FAILED at step: ${step}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nCHECK PASSED");
