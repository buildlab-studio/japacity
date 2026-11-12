// Fails a pull request that takes a check away, unless it carries the approved-test-change label.
// Editing a test is ordinary work: a test follows the behaviour it describes. What needs a maintainer's
// word is a change that removes a check: a test file deleted, a test file left with fewer tests or
// fewer assertions, a golden changed, or the pending-rules list grown. Skipped, focused and commented-out
// tests are refused by lint. See decision 0039 and docs/design/02-quality-and-testing.md section 5.
//
// Usage: pnpm check:protected -- <base-ref>
// CI sets APPROVED_TEST_CHANGE=1 when the label is present.
import { execFileSync } from "node:child_process";

import { isMain } from "../repo";

export const PENDING_FILE = "tools/rules-pending.json";

export interface Change {
  /** First letter of git's status: M, D, R, A, C or T. */
  readonly status: string;
  /** The path before the change. Same as `path` unless renamed or copied. */
  readonly from: string;
  readonly path: string;
}

export interface ProtectedChange {
  readonly change: Change;
  readonly reason: string;
}

/** Reads a file at the base (the merge base) or at the head; null when it does not exist there. */
export type ReadFile = (side: "base" | "head", path: string) => string | null;

export const isTestFile = (path: string): boolean => path.endsWith(".test.ts") || path.endsWith(".test.tsx");

// tools/goldens/ holds the tools that write the goldens, not goldens.
export const isGolden = (path: string): boolean =>
  !path.startsWith("tools/") && (path.startsWith("goldens/") || path.includes("/goldens/"));

/** Parses `git diff --name-status` output. */
export function parseNameStatus(output: string): Change[] {
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [code = "", first = "", second] = line.split("\t");
      const status = code.charAt(0);
      return second === undefined ? { status, from: first, path: first } : { status, from: first, path: second };
    });
}

/** Drops block comments and whole-line comments, so a commented-out check is not counted. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

/**
 * The tests and the assertions a test file holds: each `test(` or `it(` call, with any modifier such as
 * `.each` or `.prop` (a table counts once), and each `expect(` call, with any modifier such as `.soft`.
 */
export function countChecks(source: string): { readonly tests: number; readonly assertions: number } {
  const code = withoutComments(source);
  const tests = code.match(/(?<![\w.$])(?:test|it)(?:\.[A-Za-z]+)*\s*\(/g)?.length ?? 0;
  const assertions = code.match(/(?<![\w.$])expect(?:\.[A-Za-z]+)?\s*\(/g)?.length ?? 0;
  return { tests, assertions };
}

/** Ids present in `head` but not in `base`. Either side may be missing (null). */
export function addedPendingNames(base: string | null, head: string | null): string[] {
  const parse = (text: string | null): string[] => {
    if (text === null) return [];
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value.map(String) : [];
  };
  const before = new Set(parse(base));
  return parse(head).filter((name) => !before.has(name));
}

/** Why a change to an existing test file takes a check away, or null when it keeps every one. */
function weakenedTest(change: Change, read: ReadFile): string | null {
  if (change.status === "D" || (change.status === "R" && !isTestFile(change.path))) return "test file deleted";
  const before = read("base", change.from);
  const after = read("head", change.path);
  if (before === null) return null;
  if (after === null) return "test file deleted";
  const was = countChecks(before);
  const now = countChecks(after);
  const fewer: string[] = [];
  if (now.tests < was.tests) fewer.push(`tests ${String(was.tests)} to ${String(now.tests)}`);
  if (now.assertions < was.assertions) fewer.push(`assertions ${String(was.assertions)} to ${String(now.assertions)}`);
  return fewer.length === 0 ? null : `fewer ${fewer.join(", ")}`;
}

/**
 * Picks the changes that need approval. Added files are free, and so is an edit to a test that keeps its
 * tests and assertions. A copy leaves its source in place, so it takes nothing away.
 */
export function findProtectedChanges(changes: readonly Change[], read: ReadFile): ProtectedChange[] {
  const found: ProtectedChange[] = [];
  for (const change of changes) {
    if (change.from === PENDING_FILE || change.path === PENDING_FILE) {
      // Removing names, or deleting the list, only tightens the traceability check.
      if (change.status === "M" || change.status === "A") {
        const added = addedPendingNames(read("base", PENDING_FILE), read("head", PENDING_FILE));
        if (added.length > 0) found.push({ change, reason: `pending rules list gained ${added.join(", ")}` });
      }
      continue;
    }
    if (!["M", "D", "R", "T"].includes(change.status)) continue;
    if (isGolden(change.from) || isGolden(change.path)) {
      found.push({ change, reason: "golden file" });
      continue;
    }
    if (isTestFile(change.from)) {
      const reason = weakenedTest(change, read);
      if (reason !== null) found.push({ change, reason });
    }
  }
  return found;
}

export function describeChange({ change, reason }: ProtectedChange): string {
  const path = change.from === change.path ? change.path : `${change.from} -> ${change.path}`;
  return `  ${change.status} ${path} (${reason})`;
}

function git(args: readonly string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function showOrNull(ref: string, path: string): string | null {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

export function main(argv: readonly string[], env: NodeJS.ProcessEnv): number {
  const base = argv.find((arg) => arg !== "--");
  if (base === undefined) {
    console.error("usage: pnpm check:protected -- <base-ref>");
    return 2;
  }
  const mergeBase = git(["merge-base", base, "HEAD"]).trim();
  const changes = parseNameStatus(git(["diff", "--name-status", "-M", `${base}...HEAD`]));
  const found = findProtectedChanges(changes, (side, path) => showOrNull(side === "base" ? mergeBase : "HEAD", path));
  const approved = env["APPROVED_TEST_CHANGE"] === "1";

  if (found.length === 0) {
    console.log("protected: no test, assertion, golden or pending rule taken away");
    return 0;
  }
  console.log(`protected: ${String(found.length)} change(s) take a check away:`);
  for (const item of found) console.log(describeChange(item));
  if (approved) {
    console.log("protected: approved by the approved-test-change label");
    return 0;
  }
  console.log(
    "protected: FAILED. A test file is not deleted, a test or an assertion is not removed, a golden is not changed " +
      "and the pending list does not grow to get a pass. If this change is intended, a maintainer adds the approved-test-change label.",
  );
  return 1;
}

if (isMain(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2), process.env);
}
