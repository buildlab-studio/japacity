// Fails a pull request that changes tests, goldens, schemas, the lint config,
// or loosens the pending-rules list, unless it carries the
// approved-test-change label. Editing a test is the quickest way to a pass;
// this makes that visible and gated. See docs/design/02-quality-and-testing.md section 5.
//
// Usage: pnpm check:protected -- <base-ref>
// CI sets APPROVED_TEST_CHANGE=1 when the label is present.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

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

const PROTECTED: ReadonlyArray<{ readonly reason: string; readonly matches: (path: string) => boolean }> = [
  { reason: "test file", matches: (path) => path.endsWith(".test.ts") || path.endsWith(".test.tsx") },
  { reason: "golden file", matches: (path) => path.startsWith("goldens/") || path.includes("/goldens/") },
  { reason: "schema", matches: (path) => path.endsWith(".schema.ts") },
  { reason: "lint config", matches: (path) => path === "eslint.config.js" },
  { reason: "engine contract", matches: (path) => path === "packages/sim/src/engine/types.ts" },
  { reason: "rule page", matches: (path) => path.startsWith("docs/rules/") },
  {
    reason: "check tooling",
    matches: (path) =>
      /^tsconfig[^/]*\.json$/.test(path) || path === "vitest.config.ts" || /^tools\/check[^/]*\.ts$/.test(path),
  },
  { reason: "pending rules list", matches: (path) => path === PENDING_FILE },
];

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

export function protectedReason(path: string): string | null {
  return PROTECTED.find((rule) => rule.matches(path))?.reason ?? null;
}

/** Ids present in `head` but not in `base`. Either side may be missing (null). */
export function addedPendingIds(base: string | null, head: string | null): string[] {
  const parse = (text: string | null): string[] => {
    if (text === null) return [];
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value.map(String) : [];
  };
  const before = new Set(parse(base));
  return parse(head).filter((id) => !before.has(id));
}

/**
 * Picks the changes that need approval. Additions are free, except that new
 * ids in the pending-rules list loosen the traceability check. Removing ids,
 * or deleting the list, only tightens it.
 */
export function findProtectedChanges(
  changes: readonly Change[],
  readPending: (side: "base" | "head") => string | null,
): ProtectedChange[] {
  const found: ProtectedChange[] = [];
  for (const change of changes) {
    const touchesPending = change.from === PENDING_FILE || change.path === PENDING_FILE;
    if (touchesPending && (change.status === "M" || change.status === "A")) {
      const added = addedPendingIds(readPending("base"), readPending("head"));
      if (added.length > 0) found.push({ change, reason: `pending rules list gained ${added.join(", ")}` });
      continue;
    }
    if (touchesPending && change.status === "D") continue;
    if (!["M", "D", "R", "T"].includes(change.status)) continue;
    const reason = protectedReason(change.from) ?? protectedReason(change.path);
    if (reason !== null) found.push({ change, reason });
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
    return execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
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
  const found = findProtectedChanges(changes, (side) => showOrNull(side === "base" ? mergeBase : "HEAD", PENDING_FILE));
  const approved = env["APPROVED_TEST_CHANGE"] === "1";

  if (found.length === 0) {
    console.log("protected: no protected files changed");
    return 0;
  }
  console.log(`protected: ${String(found.length)} protected change(s):`);
  for (const item of found) console.log(describeChange(item));
  if (approved) {
    console.log("protected: approved by the approved-test-change label");
    return 0;
  }
  console.log(
    "protected: FAILED. Tests, goldens, schemas, the lint config and the pending list are not changed to get a pass. " +
      "If this change is intended, a maintainer adds the approved-test-change label.",
  );
  return 1;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(realpathSync(entry)).href;
}

if (isMain()) {
  process.exitCode = main(process.argv.slice(2), process.env);
}
