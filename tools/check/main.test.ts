// Every check runs only when started as a script (`isMain` in tools/repo.ts). A guard that wrongly says no would turn a
// check into a silent exit 0, so each check here is started as `pnpm check` starts it and must say its verdict.
import { execFile } from "node:child_process";
import { symlinkSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, test } from "vitest";

import { isMain, REPO_ROOT } from "../repo";

const run = promisify(execFile);
const TSX = join(REPO_ROOT, "node_modules", ".bin", "tsx");

/** The script's output, whatever its exit: a failing check still speaks. */
async function started(script: string, ...args: string[]): Promise<string> {
  try {
    const { stdout, stderr } = await run(TSX, [join(REPO_ROOT, script), ...args], { cwd: REPO_ROOT, timeout: 90_000 });
    return `${stdout}${stderr}`;
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string };
    return `${failed.stdout ?? ""}${failed.stderr ?? ""}`;
  }
}

const argv = process.argv[1];
afterEach(() => {
  process.argv[1] = argv ?? "";
});

describe("a check started as a script runs", () => {
  test("given each check started as pnpm check starts it, when it ends, then it has said its verdict, never nothing", async () => {
    const [rules, version, scrub, protectedFiles, guides] = await Promise.all([
      started("tools/check/rules.ts"),
      started("tools/check/version.ts", "check"),
      started("tools/check/scrub.ts"),
      started("tools/check/protected.ts"),
      started("tools/check/guides-stale.ts"),
    ]);
    expect(rules).toMatch(/rules: \d+ defined, \d+ tested/);
    expect(version).toMatch(/Content version|content version/);
    expect(scrub).toMatch(/found/);
    expect(protectedFiles).toMatch(/usage: pnpm check:protected/);
    expect(guides).toMatch(/Usage: tsx tools\/check\/guides-stale\.ts/);
  }, 120_000);

  test("given the script node was started with, when a module asks whether it is that script, then only that module is, through a linked folder too", () => {
    const script = join(REPO_ROOT, "tools", "check", "rules.ts");
    process.argv[1] = script;
    expect(isMain(pathToFileURL(script).href)).toBe(true);
    expect(isMain(pathToFileURL(join(REPO_ROOT, "tools", "check", "size.ts")).href)).toBe(false);
    const linked = mkdtempSync(join(tmpdir(), "japacity-main-"));
    try {
      symlinkSync(join(REPO_ROOT, "tools", "check"), join(linked, "check"));
      process.argv[1] = join(linked, "check", "rules.ts");
      expect(isMain(pathToFileURL(script).href)).toBe(true);
    } finally {
      rmSync(linked, { recursive: true, force: true });
    }
    process.argv[1] = join(REPO_ROOT, "no-such-script.ts");
    expect(isMain(pathToFileURL(script).href)).toBe(false);
  });
});
