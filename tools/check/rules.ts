// Rule-id traceability: every rule defined in docs/rules has a test that cites
// it, and every cited id is defined. See docs/design/02-quality-and-testing.md.
//
// Usage: pnpm check:rules [--write-pending]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

import { isMain, REPO_ROOT } from "../repo";

export const RULE_ID = /R-[A-Z][A-Z0-9]*-\d{3}/;

// A definition is a line like `**R-STATUS-004.** A sponsored worker ...`,
// optionally inside a block quote or a list item.
const DEFINITION_LINE = new RegExp(
  String.raw`^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?\*\*(${RULE_ID.source})\.\*\*`,
);
const CITATION_TAG = new RegExp(String.raw`\[(${RULE_ID.source})\]`, "g");

const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "build", "coverage", ".git"]);
// Folders whose test-like files are inputs to other tests, not real tests.
export const DEFAULT_CITATION_EXCLUDES = ["tools/__fixtures__"];

// Calls that do not run their body do not count as testing a rule.
const NON_RUNNING_MODIFIERS = new Set(["skip", "todo", "skipIf", "runIf"]);

export interface Location {
  readonly file: string;
  readonly line: number;
}

export interface Citation extends Location {
  readonly id: string;
}

export interface Report {
  readonly problems: readonly string[];
  readonly defined: number;
  readonly tested: number;
  readonly pending: number;
  readonly untested: readonly string[];
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function walk(directory: string, visit: (path: string, name: string) => void, skip: (path: string) => boolean): void {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name) && !skip(path)) walk(path, visit, skip);
    } else if (entry.isFile()) {
      visit(path, entry.name);
    }
  }
}

/** Reads every rule definition under `rulesDir`. Files and folders starting with `_` are ignored. */
export function findDefinitions(rulesDir: string, root: string = rulesDir): Map<string, Location[]> {
  const definitions = new Map<string, Location[]>();
  walk(
    rulesDir,
    (path, name) => {
      if (!name.endsWith(".md") || name.startsWith("_")) return;
      const lines = readFileSync(path, "utf8").split(/\r?\n/);
      lines.forEach((text, index) => {
        const id = DEFINITION_LINE.exec(text)?.[1];
        if (id === undefined) return;
        const found = definitions.get(id) ?? [];
        found.push({ file: toPosix(relative(root, path)), line: index + 1 });
        definitions.set(id, found);
      });
    },
    (path) => (path.split(sep).pop() ?? "").startsWith("_"),
  );
  return definitions;
}

/** Returns the chain of names in a callee, such as ["test", "prop"], or null if it is not a plain chain. */
function calleeNames(expression: ts.Expression): string[] | null {
  if (ts.isIdentifier(expression)) return [expression.text];
  if (ts.isPropertyAccessExpression(expression)) {
    const head = calleeNames(expression.expression);
    return head === null ? null : [...head, expression.name.text];
  }
  // Curried forms such as test.each(table)("title") and test.prop(arbs)("title").
  if (ts.isCallExpression(expression)) return calleeNames(expression.expression);
  return null;
}

function testTitle(call: ts.CallExpression): string | null {
  const names = calleeNames(call.expression);
  if (names === null) return null;
  const [base, ...modifiers] = names;
  if (base !== "test" && base !== "it") return null;
  if (modifiers.some((name) => NON_RUNNING_MODIFIERS.has(name))) return null;
  // test.each(table) itself is not a test; its returned function is.
  if (ts.isPropertyAccessExpression(call.expression) && ["each", "for", "prop"].includes(modifiers.at(-1) ?? "")) {
    return null;
  }
  const first = call.arguments[0];
  if (first === undefined) return null;
  if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) return first.text;
  return null;
}

/** Finds `[R-XXX-000]` tags in test titles. Parsed with the compiler, so comments never count. */
export function findCitationsInSource(file: string, source: string): Citation[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const citations: Citation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const title = testTitle(node);
      if (title !== null) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        for (const match of title.matchAll(CITATION_TAG)) {
          const id = match[1];
          if (id !== undefined) citations.push({ id, file, line });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return citations;
}

/** Finds citations in every test file under `root`, skipping the excluded folders (relative to root). */
export function findCitations(root: string, excludes: readonly string[] = DEFAULT_CITATION_EXCLUDES): Citation[] {
  const excluded = new Set(excludes.map((path) => join(root, path)));
  const citations: Citation[] = [];
  walk(
    root,
    (path, name) => {
      if (!TEST_FILE.test(name)) return;
      citations.push(...findCitationsInSource(toPosix(relative(root, path)), readFileSync(path, "utf8")));
    },
    (path) => excluded.has(path),
  );
  return citations;
}

export function readPending(path: string): string[] {
  if (!existsSync(path)) return [];
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === "string")) {
    throw new Error(`${path} must be a JSON array of rule id strings.`);
  }
  return parsed;
}

export function evaluate(
  definitions: ReadonlyMap<string, readonly Location[]>,
  citations: readonly Citation[],
  pending: readonly string[],
): Report {
  const problems: string[] = [];
  const at = (location: Location) => `${location.file}:${String(location.line)}`;

  for (const [id, locations] of definitions) {
    if (locations.length > 1) {
      problems.push(`${id} is defined more than once: ${locations.map(at).join(", ")}`);
    }
  }

  const testedIds = new Set<string>();
  for (const citation of citations) {
    if (definitions.has(citation.id)) {
      testedIds.add(citation.id);
    } else {
      problems.push(`${at(citation)} cites ${citation.id}, which is not defined in docs/rules`);
    }
  }

  const pendingSet = new Set<string>();
  for (const id of pending) {
    if (pendingSet.has(id)) problems.push(`${id} is listed twice in tools/rules-pending.json`);
    pendingSet.add(id);
    if (!definitions.has(id)) {
      problems.push(`${id} is in tools/rules-pending.json but is not defined. Remove it from the list`);
    } else if (testedIds.has(id)) {
      problems.push(`${id} now has a test. Remove it from tools/rules-pending.json`);
    }
  }

  const untested = [...definitions.keys()].filter((id) => !testedIds.has(id)).sort();
  for (const id of untested) {
    if (pendingSet.has(id)) continue;
    const where = definitions.get(id)?.[0];
    problems.push(`${id}${where ? ` (${at(where)})` : ""} has no test citing [${id}]`);
  }

  return {
    problems,
    defined: definitions.size,
    tested: testedIds.size,
    pending: untested.filter((id) => pendingSet.has(id)).length,
    untested,
  };
}

export function summary(report: Report): string {
  return `rules: ${String(report.defined)} defined, ${String(report.tested)} tested, ${String(report.pending)} pending`;
}

export function run(root: string, options: { readonly writePending: boolean }): { code: number; output: string[] } {
  const pendingPath = join(root, "tools", "rules-pending.json");
  const definitions = findDefinitions(join(root, "docs", "rules"), root);
  const citations = findCitations(root);
  if (options.writePending) {
    const tested = new Set(citations.map((citation) => citation.id));
    const untested = [...definitions.keys()].filter((id) => !tested.has(id)).sort();
    writeFileSync(pendingPath, `${JSON.stringify(untested, null, 2)}\n`);
  }
  const report = evaluate(definitions, citations, readPending(pendingPath));
  if (report.problems.length === 0) return { code: 0, output: [summary(report)] };
  return {
    code: 1,
    output: [
      ...report.problems.map((problem) => `  ${problem}`),
      `${summary(report)}. FAILED with ${String(report.problems.length)} problem(s).`,
    ],
  };
}

if (isMain(import.meta.url)) {
  const { code, output } = run(REPO_ROOT, { writePending: process.argv.includes("--write-pending") });
  for (const line of output) console.log(line);
  process.exitCode = code;
}
