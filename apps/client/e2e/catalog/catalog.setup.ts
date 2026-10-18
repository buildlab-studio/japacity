// Before the shoot: the folder made and emptied of an earlier run's pictures, the checklist copied beside them, and the
// start time kept for the contact sheet's line.
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "@playwright/test";

import { catalogDir, MISSED_FILE, shortCommit } from "./where";

function setup(): void {
  const dir = catalogDir();
  mkdirSync(dir, { recursive: true });
  // A second run of the same commit replaces its pictures; the review written beside them is kept.
  for (const name of readdirSync(dir)) if (name.endsWith(".png") || name === MISSED_FILE) rmSync(join(dir, name));
  copyFileSync(join(dirname(fileURLToPath(import.meta.url)), "CHECKLIST.md"), join(dir, "CHECKLIST.md"));
  writeFileSync(join(dir, "run.json"), JSON.stringify({ commit: shortCommit(), started: Date.now() }));
  console.log(`The catalog is shot into ${dir}`);
}

test("before the shoot, the folder is made and emptied and the checklist copied beside it", () => {
  setup();
});
