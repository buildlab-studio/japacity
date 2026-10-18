// Rule-name traceability: every rule defined in docs/rules has a test that cites
// it, and every cited name is defined. See docs/design/02-quality-and-testing.md.
//
// Usage: pnpm check:rules [--write-pending]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import ts from "typescript";

import { isMain, readJson, REPO_ROOT, toPosix } from "../repo";

/** A rule's name: its page's file name, a colon and a kebab slug, such as `city:players-fill-the-crowd`. */
export const RULE_NAME = /[a-z][a-z0-9]*(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*/;

// Where a definition may start: a line, optionally inside a block quote or a list item.
const LINE_START = String.raw`^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?`;
// A definition is a line like `**status:expiry-lapses-or-moves-on** A sponsored worker ...`.
const DEFINITION_LINE = new RegExp(String.raw`${LINE_START}\*\*(${RULE_NAME.source})\*\*(?=\s|$)`);
// A line that opens like a definition but whose bold is not a well-formed name: `**City:Crowd**`, `**R-CITY-015.**`.
const MALFORMED_LINE = new RegExp(String.raw`${LINE_START}\*\*([^*\s]*(?::|R-[A-Z])[^*\s]*)\*\*`);
const CITATION_TAG = new RegExp(String.raw`\[(${RULE_NAME.source})\]`, "g");

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
  readonly name: string;
}

/** A line of a rule page that opens like a definition but whose bold is not a well-formed name. */
export interface Malformed extends Location {
  readonly text: string;
}

export interface Definitions {
  readonly names: Map<string, Location[]>;
  readonly malformed: readonly Malformed[];
}

export interface Report {
  readonly problems: readonly string[];
  readonly defined: number;
  readonly tested: number;
  readonly pending: number;
  readonly untested: readonly string[];
}

function walk(directory: string, visit: (path: string, fileName: string) => void, skip: (path: string) => boolean): void {
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

/** The page a rule name belongs to: the part before the colon. */
export function pageOf(name: string): string {
  return name.slice(0, name.indexOf(":"));
}

/** Reads every rule definition under `rulesDir`. Files and folders starting with `_` are ignored. */
export function findDefinitions(rulesDir: string, root: string = rulesDir): Definitions {
  const names = new Map<string, Location[]>();
  const malformed: Malformed[] = [];
  walk(
    rulesDir,
    (path, fileName) => {
      if (!fileName.endsWith(".md") || fileName.startsWith("_")) return;
      const file = toPosix(relative(root, path));
      const lines = readFileSync(path, "utf8").split(/\r?\n/);
      lines.forEach((text, index) => {
        const name = DEFINITION_LINE.exec(text)?.[1];
        if (name === undefined) {
          const bold = MALFORMED_LINE.exec(text)?.[1];
          if (bold !== undefined) malformed.push({ text: bold, file, line: index + 1 });
          return;
        }
        const found = names.get(name) ?? [];
        found.push({ file, line: index + 1 });
        names.set(name, found);
      });
    },
    (path) => (path.split(sep).pop() ?? "").startsWith("_"),
  );
  return { names, malformed };
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
  if (modifiers.some((modifier) => NON_RUNNING_MODIFIERS.has(modifier))) return null;
  // test.each(table) itself is not a test; its returned function is.
  if (ts.isPropertyAccessExpression(call.expression) && ["each", "for", "prop"].includes(modifiers.at(-1) ?? "")) {
    return null;
  }
  const first = call.arguments[0];
  if (first === undefined) return null;
  if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) return first.text;
  return null;
}

/** Finds `[page:slug]` tags in test titles. Parsed with the compiler, so comments never count. */
export function findCitationsInSource(file: string, source: string): Citation[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const citations: Citation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const title = testTitle(node);
      if (title !== null) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        for (const match of title.matchAll(CITATION_TAG)) {
          const name = match[1];
          if (name !== undefined) citations.push({ name, file, line });
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
    (path, fileName) => {
      if (!TEST_FILE.test(fileName)) return;
      citations.push(...findCitationsInSource(toPosix(relative(root, path)), readFileSync(path, "utf8")));
    },
    (path) => excluded.has(path),
  );
  return citations;
}

export function readPending(path: string): string[] {
  if (!existsSync(path)) return [];
  const parsed: unknown = readJson(path);
  if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === "string")) {
    throw new Error(`${path} must be a JSON array of rule name strings.`);
  }
  return parsed;
}

export function evaluate(definitions: Definitions, citations: readonly Citation[], pending: readonly string[]): Report {
  const problems: string[] = [];
  const at = (location: Location) => `${location.file}:${String(location.line)}`;
  const { names } = definitions;

  for (const bad of definitions.malformed) {
    problems.push(`${at(bad)} opens with **${bad.text}**, which is not a rule name of the form page:slug`);
  }

  for (const [name, locations] of names) {
    if (locations.length > 1) {
      problems.push(`${name} is defined more than once: ${locations.map(at).join(", ")}`);
    }
    for (const location of locations) {
      const page = basename(location.file, ".md");
      if (page !== pageOf(name)) problems.push(`${name} is defined in ${at(location)}, but its name says ${pageOf(name)}.md`);
    }
  }

  const testedNames = new Set<string>();
  for (const citation of citations) {
    if (names.has(citation.name)) {
      testedNames.add(citation.name);
    } else {
      problems.push(`${at(citation)} cites ${citation.name}, which is not defined in docs/rules`);
    }
  }

  const pendingSet = new Set<string>();
  for (const name of pending) {
    if (pendingSet.has(name)) problems.push(`${name} is listed twice in tools/rules-pending.json`);
    pendingSet.add(name);
    if (!names.has(name)) {
      problems.push(`${name} is in tools/rules-pending.json but is not defined. Remove it from the list`);
    } else if (testedNames.has(name)) {
      problems.push(`${name} now has a test. Remove it from tools/rules-pending.json`);
    }
  }

  const untested = [...names.keys()].filter((name) => !testedNames.has(name)).sort();
  for (const name of untested) {
    if (pendingSet.has(name)) continue;
    const where = names.get(name)?.[0];
    problems.push(`${name}${where ? ` (${at(where)})` : ""} has no test citing [${name}]`);
  }

  return {
    problems,
    defined: names.size,
    tested: testedNames.size,
    pending: untested.filter((name) => pendingSet.has(name)).length,
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
    const tested = new Set(citations.map((citation) => citation.name));
    const untested = [...definitions.names.keys()].filter((name) => !tested.has(name)).sort();
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
